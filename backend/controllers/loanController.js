const { Op } = require('sequelize');
const {
  Member, Savings, Loan, LoanGuarantor, LoanPayment, Fine, User, GuarantorPayment, Statutory, sequelize
} = require('../models');
const { sendEmail }  = require('../services/emailService');
const emailTemplates = require('../services/emailTemplates');

const LOAN_TIERS = [
  { minAmount: 0,      maxAmount: 19999,    name: 'Tier 1', durations: [{ months: 1, interestRate: 7 }] },
  { minAmount: 20000,  maxAmount: 49999,    name: 'Tier 2', durations: [{ months: 1, interestRate: 7 }, { months: 2, interestRate: 8.5 }] },
  { minAmount: 50000,  maxAmount: 79999,    name: 'Tier 3', durations: [{ months: 1, interestRate: 7 }, { months: 2, interestRate: 8.5 }, { months: 3, interestRate: 10 }] },
  { minAmount: 80000,  maxAmount: 99999,    name: 'Tier 4', durations: [{ months: 1, interestRate: 7 }, { months: 2, interestRate: 8.5 }, { months: 3, interestRate: 10 }, { months: 4, interestRate: 11.5 }] },
  { minAmount: 100000, maxAmount: Infinity, name: 'Tier 5', durations: [{ months: 1, interestRate: 7 }, { months: 2, interestRate: 8.5 }, { months: 3, interestRate: 10 }, { months: 4, interestRate: 11.5 }, { months: 5, interestRate: 13 }] }
];

const MAX_ACTIVE_GUARANTEES = 5;
const OFFICE_GUARANTOR_ID   = -1;
const OFFICE_GUARANTOR_NAME = 'The Office';

// ─── Email helpers ───────────────────────────────────────────────
const getAdminEmails = async () => {
  try {
    const admins = await User.findAll({ where: { role: 'admin', isActive: true }, attributes: ['email'] });
    return admins.map(a => a.email).filter(Boolean);
  } catch { return []; }
};

const getMemberWithEmail = async (memberId) => {
  try {
    return await Member.findByPk(memberId, {
      include: [{ model: User, as: 'user', attributes: ['email', 'firstName', 'lastName'] }],
    });
  } catch { return null; }
};

// ─── Loan helpers ────────────────────────────────────────────────
const getLoanTier = (amount) => {
  const loanAmount = Number(amount);
  return LOAN_TIERS.find(tier => loanAmount >= tier.minAmount && loanAmount <= tier.maxAmount);
};

const calculateMaxLoan = async (totalSavings, memberId) => {
  let statutoryFee = 0;
  if (memberId && Statutory) {
    try {
      const record = await Statutory.findOne({
        where: { memberId, year: new Date().getFullYear() },
        attributes: ['statutoryFee'],
      });
      statutoryFee = record ? Number(record.statutoryFee) : 0;
    } catch (e) {}
  }
  const maxLoan = Math.round((totalSavings * 3) - statutoryFee);
  return maxLoan > 0 ? maxLoan : 0;
};

const calculateTotalRepayment = (amount, interestRate, transactionFee = 0) => {
  const principal = Number(amount);
  const rate      = Number(interestRate);
  const txFee     = Number(transactionFee);
  return Math.round(principal + (principal * rate / 100) + txFee);
};

const getRequiredGuarantors = (amount) => Number(amount) < 80000 ? 3 : 5;

const formatCurrency = (amt) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amt || 0);

const updateLoanStatus = async (loan) => {
  if (loan.approvalStatus !== 'approved') return loan;

  const now     = new Date();
  const dueDate = new Date(loan.dueDate);

  if (loan.remainingBalance <= 0) {
    loan.status          = 'paid';
    loan.penaltyInterest = 0;
    loan.isOverdue       = false;
    await loan.save();
    return loan;
  }

  if (now <= dueDate) {
    if (loan.status !== 'paid') {
      loan.status          = 'active';
      loan.penaltyInterest = 0;
      loan.isOverdue       = false;
      await loan.save();
    }
    return loan;
  }

  const daysPastDue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

  const totalRepayment = Math.round(
    Number(loan.amount) +
    (Number(loan.amount) * Number(loan.interestRate) / 100) +
    Number(loan.transactionFee || 0)
  );
  const baseBalance = Math.max(0, totalRepayment - Number(loan.amountPaid || 0));

  if (daysPastDue <= 90) {
    loan.status    = 'arrears';
    loan.isOverdue = true;

    const dailyRate      = 0.05 / 30;
    const compoundFactor = Math.pow(1 + dailyRate, daysPastDue) - 1;
    loan.penaltyInterest  = Math.round(baseBalance * compoundFactor);
    loan.remainingBalance = Math.round(baseBalance + loan.penaltyInterest);
    loan.arrearsMonths    = Math.ceil(daysPastDue / 30);
  } else {
    loan.status    = 'default';
    loan.isOverdue = true;

    if (loan.previousStatus !== 'default') {
      await clearMemberSavingsForDefault(loan.memberId, loan.id);
    }
  }

  loan.previousStatus = loan.status;
  await loan.save();
  return loan;
};

const clearMemberSavingsForDefault = async (memberId, loanId) => {
  try {
    const totalSavings = await Savings.sum('amount', { where: { memberId, isPaid: true } }) || 0;
    await Fine.create({
      memberId, fineType: 'loan_default', amount: Math.round(totalSavings),
      referenceId: loanId, notes: `All savings cleared due to loan default (Loan ID: ${loanId})`,
    });
    await Savings.update(
      { isPaid: false, notes: sequelize.fn('CONCAT', sequelize.col('notes'), ` - Cleared due to loan default (Loan ID: ${loanId})`) },
      { where: { memberId, isPaid: true } }
    );
  } catch (error) { console.error('Error clearing savings for default:', error); }
};

// ─── GET /loans ─────────────────────────────────────────────────
const getAllLoans = async (req, res) => {
  const { status, memberId, approvalStatus } = req.query;
  try {
    const where = {};
    if (status)         where.status         = status;
    if (memberId)       where.memberId       = memberId;
    if (approvalStatus) where.approvalStatus = approvalStatus;

    // Detect which top-up columns exist so we don't crash on older DBs
    let topUpAttrs = [];
    try {
      const desc = await Loan.sequelize.getQueryInterface().describeTable('loans');
      if (desc['loan_type'])        topUpAttrs.push(['loan_type',        'loanType']);
      if (desc['original_loan_id']) topUpAttrs.push(['original_loan_id', 'originalLoanId']);
      if (desc['previous_balance']) topUpAttrs.push(['previous_balance', 'previousBalance']);
      if (desc['amount_disbursed']) topUpAttrs.push(['amount_disbursed', 'amountDisbursed']);
    } catch (_) {}

    const loans = await Loan.findAll({
      where,
      attributes: [
        'id', 'memberId', 'amount', 'interestRate', 'durationMonths',
        'disbursementDate', 'dueDate', 'status', 'approvalStatus',
        'approvedBy', 'approvedAt', 'amountPaid', 'remainingBalance',
        'isOverdue', 'overdueSince', 'penaltyInterest', 'transactionFee',
        'rejectionReason', 'notes', 'createdAt', 'updatedAt',
        ...topUpAttrs,
      ],
      include: [
        { model: Member,       as: 'member',    attributes: ['firstName', 'lastName'] },
        { model: LoanPayment,  as: 'payments'  },
        { model: LoanGuarantor, as: 'guarantors',
          include: [{ model: Member, as: 'guarantor', attributes: ['firstName', 'lastName'] }] },
        { model: User, as: 'approver', attributes: ['firstName', 'lastName'], required: false },
      ],
      order: [['createdAt', 'DESC']],
    });

    const rows = await Promise.all(loans.map(async (l) => {
      if (l.approvalStatus === 'approved' && l.status !== 'pending') await updateLoanStatus(l);
      const totalPaid      = l.payments.reduce((s, p) => s + Number(p.amount), 0);
      const txFee          = Number(l.transactionFee ?? 108);
      const totalRepayment = calculateTotalRepayment(l.amount, l.interestRate, txFee);
      const balance        = Math.round(totalRepayment + Number(l.penaltyInterest || 0) - totalPaid);
      return {
        ...l.toJSON(),
        approvalStatus:   l.approvalStatus || 'pending',
        amountPaid:       Math.round(totalPaid),
        remainingBalance: balance,
        totalRepayment,
        isOverdue:        l.status === 'arrears' || l.status === 'default',
        approvedByName:   l.approver ? `${l.approver.firstName} ${l.approver.lastName}` : null,
        approvedAt:       l.approvedAt,
        transactionFee:   txFee,
        disbursedAmount:  Math.round(Number(l.amountDisbursed || l.amount)),
        loanType:         l.loanType,
        previousBalance:  l.previousBalance,
        amountDisbursed:  l.amountDisbursed,
      };
    }));

    return res.json({ loans: rows });
  } catch (error) {
    console.error('Get all loans error:', error);
    return res.status(500).json({ message: 'Failed to fetch loans' });
  }
};

// ─── GET /loans/:id ─────────────────────────────────────────────
const getLoanById = async (req, res) => {
  try {
    const loan = await Loan.findByPk(req.params.id, {
      include: [
        { model: Member,      as: 'member',    attributes: ['firstName', 'lastName'] },
        { model: LoanPayment, as: 'payments',  order: [['paymentDate', 'DESC']] },
        { model: LoanGuarantor, as: 'guarantors', include: [{ model: Member, as: 'guarantor' }] },
        { model: User, as: 'approver', attributes: ['firstName', 'lastName'], required: false },
      ],
    });
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    if (loan.approvalStatus === 'approved' && loan.status !== 'pending') await updateLoanStatus(loan);
    const totalPaid      = loan.payments.reduce((s, p) => s + Number(p.amount), 0);
    const txFee          = Number(loan.transactionFee ?? 108);
    const totalRepayment = calculateTotalRepayment(loan.amount, loan.interestRate, txFee);
    const balance        = Math.round(totalRepayment + Number(loan.penaltyInterest || 0) - totalPaid);
    return res.json({
      loan: {
        ...loan.toJSON(),
        amountPaid:       Math.round(totalPaid),
        remainingBalance: balance,
        totalRepayment,
        isOverdue:        loan.status === 'arrears' || loan.status === 'default',
        approvedByName:   loan.approver ? `${loan.approver.firstName} ${loan.approver.lastName}` : null,
        transactionFee:   txFee,
        disbursedAmount:  Math.round(Number(loan.amountDisbursed || loan.amount)),
        loanType:         loan.loanType,
        previousBalance:  loan.previousBalance,
      },
      guarantors: loan.guarantors.map(g => g.guarantor),
      payments:   loan.payments,
    });
  } catch (error) {
    console.error('Get loan error:', error);
    return res.status(500).json({ message: 'Failed to fetch loan details' });
  }
};

// ─── GET /loans/guaranteed/:memberId ────────────────────────────
const getGuaranteedLoans = async (req, res) => {
  const { memberId } = req.params;
  try {
    const guarantorRecords = await LoanGuarantor.findAll({
      where: { guarantorId: memberId },
      include: [{ model: Loan, as: 'loan',
        include: [
          { model: Member,      as: 'member',   attributes: ['firstName', 'lastName'] },
          { model: LoanPayment, as: 'payments' },
        ],
      }],
    });

    const loans = await Promise.all(guarantorRecords.map(async (gr) => {
      const loan = gr.loan;
      if (!loan || !loan.member) {
        console.warn('=== skipping orphaned guarantor record:', gr.id);
        return null;
      }
      if (loan.approvalStatus === 'approved' && loan.status !== 'pending') await updateLoanStatus(loan);
      const principal       = Number(loan.amount);
      const txFee           = Number(loan.transactionFee ?? 108);
      const totalRepayment  = calculateTotalRepayment(principal, loan.interestRate, txFee);
      const totalPaid       = loan.payments.reduce((s, p) => s + Number(p.amount), 0);
      const penaltyInterest = Number(loan.penaltyInterest || 0);
      return {
        loanId:           loan.id,
        borrowerName:     `${loan.member.firstName} ${loan.member.lastName}`,
        amount:           loan.amount,
        interestRate:     loan.interestRate,
        totalRepayment,
        amountPaid:       Math.round(totalPaid),
        penaltyInterest:  Math.round(penaltyInterest),
        remainingBalance: Math.round(totalRepayment + penaltyInterest - totalPaid),
        status:           loan.status,
        approvalStatus:   loan.approvalStatus,
        disbursementDate: loan.disbursementDate,
        dueDate:          loan.dueDate,
        isOverdue:        loan.status === 'arrears' || loan.status === 'default',
      };
    }));

    return res.json({ guaranteedLoans: loans.filter(Boolean) });
  } catch (error) {
    console.error('=== Get guaranteed loans FULL ERROR:', error);
    return res.status(500).json({ message: 'Failed to fetch guaranteed loans', error: error.message });
  }
};

// ─── POST /loans/apply ──────────────────────────────────────────
const applyForLoan = async (req, res) => {
  const { memberId, amount, durationMonths, guarantorIds } = req.body;
  try {
    const activeLoans = await Loan.count({ where: { memberId, status: ['active', 'arrears'] } });
    if (activeLoans > 0) return res.status(400).json({ message: 'You already have an active loan. Please clear your existing loan or request a top-up instead.' });
    const pendingLoans = await Loan.count({ where: { memberId, approvalStatus: 'pending' } });
    if (pendingLoans > 0) return res.status(400).json({ message: 'You already have a pending loan application. Please wait for approval.' });
    const member = await Member.findByPk(memberId);
    if (!member || !member.isActive) return res.status(404).json({ message: 'Member not found or inactive' });
    const totalSavings = await Savings.sum('amount', { where: { memberId, isPaid: true } }) || 0;
    const maxLoan = await calculateMaxLoan(totalSavings, memberId);
    if (Number(amount) > maxLoan) return res.status(400).json({ message: `Loan exceeds maximum. Your savings: ${totalSavings.toLocaleString()}. Max loan: ${maxLoan.toLocaleString()}` });
    const tier = getLoanTier(amount);
    if (!tier) return res.status(400).json({ message: 'Invalid loan amount' });
    const durationOption = tier.durations.find(d => d.months === Number(durationMonths));
    if (!durationOption) return res.status(400).json({ message: `For amount ${amount}, only these durations are allowed: ${tier.durations.map(d => `${d.months} month(s)`).join(', ')}` });
    const interestRate   = durationOption.interestRate;
    const txFee          = 108;
    const totalRepayment = calculateTotalRepayment(amount, interestRate, txFee);
    const requiredGuarantors = getRequiredGuarantors(amount);
    if (!guarantorIds || guarantorIds.length < requiredGuarantors)
      return res.status(400).json({ message: `This loan requires ${requiredGuarantors} guarantors. You provided ${guarantorIds?.length || 0}.` });
    const hasOfficeGuarantor = guarantorIds.includes(OFFICE_GUARANTOR_ID);
    for (const gId of guarantorIds) {
      if (Number(gId) === Number(memberId)) return res.status(400).json({ message: 'You cannot guarantee yourself' });
      if (Number(gId) === OFFICE_GUARANTOR_ID) continue;
      const guarantor = await Member.findOne({ where: { id: gId, isActive: true } });
      if (!guarantor) return res.status(400).json({ message: `Guarantor ID ${gId} not found or inactive` });
      try {
        const activeGuaranteeCount = await LoanGuarantor.count({
          where: { guarantorId: gId, approvalStatus: 'accepted' },
          include: [{ model: Loan, as: 'loan', where: { status: { [Op.in]: ['active', 'arrears'] } }, required: true }],
          distinct: true, col: 'LoanGuarantor.id',
        });
        if (activeGuaranteeCount >= MAX_ACTIVE_GUARANTEES)
          return res.status(400).json({ message: `${guarantor.firstName} ${guarantor.lastName} has already guaranteed ${MAX_ACTIVE_GUARANTEES} active loans` });
      } catch (countError) { console.error('Error counting guarantees:', countError); }
    }

    // ID is auto-generated by the beforeCreate hook in the Loan model
    const loan = await Loan.create({
      memberId,
      amount:           Math.round(Number(amount)),
      interestRate,
      durationMonths,
      disbursementDate: new Date(),
      dueDate:          new Date(),
      remainingBalance: totalRepayment,
      status:           'pending',
      approvalStatus:   'pending',
      transactionFee:   txFee,
    });

    const { createNotification } = require('./notificationController');

    for (const gId of guarantorIds) {
      const guarantorRecord = await LoanGuarantor.create({ loanId: loan.id, guarantorId: gId, approvalStatus: 'pending' });

      if (Number(gId) === OFFICE_GUARANTOR_ID) {
        const adminUsers = await User.findAll({ where: { role: 'admin' } });
        for (const adminUser of adminUsers) {
          await createNotification(adminUser.id, {
            memberId, type: 'office_guarantor_request', title: 'Office Guarantor Request',
            message: `${member.firstName} ${member.lastName} requests The Office as guarantor for ${formatCurrency(amount)} loan`,
            relatedLoanId: loan.id, relatedGuarantorId: guarantorRecord.id,
          });
          sendEmail({ to: adminUser.email, ...emailTemplates.adminGuarantorRequestOffice(member, loan) });
        }
      } else {
        const guarantorMember = await Member.findByPk(gId, { include: [{ model: User, as: 'user' }] });
        if (guarantorMember && guarantorMember.user) {
          await createNotification(guarantorMember.user.id, {
            memberId: gId, type: 'guarantor_request', title: 'Guarantor Request',
            message: `${member.firstName} ${member.lastName} wants you to guarantee their ${formatCurrency(amount)} loan for ${durationMonths} months`,
            relatedLoanId: loan.id, relatedGuarantorId: guarantorRecord.id,
          });
          sendEmail({ to: guarantorMember.user.email, ...emailTemplates.guarantorRequest(guarantorMember, member, { ...loan.toJSON(), interestRate, durationMonths }) });
        }
      }
    }

    const memberWithEmail = await getMemberWithEmail(memberId);
    if (memberWithEmail?.user?.email) {
      sendEmail({ to: memberWithEmail.user.email, ...emailTemplates.loanApplied(memberWithEmail, loan) });
    }
    const adminEmails = await getAdminEmails();
    for (const adminEmail of adminEmails) {
      sendEmail({ to: adminEmail, ...emailTemplates.adminLoanPending(member, loan) });
    }

    return res.status(201).json({
      message: `Loan application submitted! Waiting for guarantor approval. Amount: ${amount.toLocaleString()}, Duration: ${durationMonths} months at ${interestRate}% interest. Total repayment: ${totalRepayment.toLocaleString()}.`,
      loan: { ...loan.toJSON(), totalRepayment, tier: tier.name, hasOfficeGuarantor, needsGuarantorApproval: true },
    });
  } catch (error) {
    console.error('Apply for loan error:', error);
    return res.status(500).json({ message: 'Failed to process loan application', error: error.message });
  }
};

// ─── POST /loans/:id/approve ────────────────────────────────────
const approveLoan = async (req, res) => {
  const { id } = req.params;
  const adminUserId = req.user.id;
  try {
    const loan = await Loan.findByPk(id, {
      include: [
        { model: Member, as: 'member' },
        {
          model: LoanGuarantor, as: 'guarantors',
          required: false,
          include: [{ model: Member, as: 'guarantor', include: [{ model: User, as: 'user' }] }],
        },
      ],
    });
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    if (loan.approvalStatus === 'approved') return res.status(400).json({ message: 'Loan is already approved' });
    if (loan.approvalStatus === 'rejected')  return res.status(400).json({ message: 'Cannot approve a rejected loan. Delete and reapply instead.' });

    const disbursementDate = new Date();
    const dueDate          = new Date(disbursementDate);
    dueDate.setMonth(dueDate.getMonth() + loan.durationMonths);

    const principal      = Math.round(Number(loan.amount));
    const txFee          = Number(loan.transactionFee ?? 108);
    const totalRepayment = calculateTotalRepayment(principal, loan.interestRate, txFee);

    loan.approvalStatus   = 'approved';
    loan.status           = 'active';
    loan.approvedBy       = adminUserId;
    loan.approvedAt       = new Date();
    loan.disbursementDate = disbursementDate;
    loan.dueDate          = dueDate;
    loan.remainingBalance = totalRepayment;
    loan.amountPaid       = 0;
    loan.transactionFee   = txFee;
    await loan.save();
    await loan.reload();

    let amountDisbursed = principal;
    let clearedBalance  = 0;

    if (loan.loanType === 'top_up' && loan.originalLoanId) {
      const originalLoan = await Loan.findByPk(loan.originalLoanId);
      if (originalLoan) {
        clearedBalance  = Math.round(Number(originalLoan.remainingBalance));
        amountDisbursed = Math.max(0, principal - clearedBalance);

        loan.amountDisbursed = amountDisbursed;
        await loan.save();

        await LoanPayment.create({
          loanId:        originalLoan.id,
          amount:        clearedBalance,
          paymentDate:   new Date(),
          paymentMethod: 'top_up_clearance',
          notes:         `Balance of ${formatCurrency(clearedBalance)} cleared automatically by top-up loan #${loan.id}`,
        });

        originalLoan.remainingBalance = 0;
        originalLoan.amountPaid       = Math.round(Number(originalLoan.amountPaid || 0) + clearedBalance);
        originalLoan.status           = 'paid';
        originalLoan.penaltyInterest  = 0;
        await originalLoan.save();
      }
    }

    // ── Check if ALL non-office guarantors rejected ──────────────
    const allGuarantors = loan.guarantors || [];
    const nonOffice     = allGuarantors.filter(g => g.guarantorId !== OFFICE_GUARANTOR_ID);
    const allRejected   = nonOffice.length > 0 && nonOffice.every(g => g.approvalStatus === 'rejected');

    if (allRejected) {
      for (const g of nonOffice) {
        g.approvalStatus = 'admin_override';
        await g.save();
      }

      let officeRecord = allGuarantors.find(g => g.guarantorId === OFFICE_GUARANTOR_ID);
      if (!officeRecord) {
        officeRecord = await LoanGuarantor.create({
          loanId:         loan.id,
          guarantorId:    OFFICE_GUARANTOR_ID,
          approvalStatus: 'admin_override',
        });
      } else {
        officeRecord.approvalStatus = 'admin_override';
        await officeRecord.save();
      }

      await GuarantorPayment.create({
        loanId:          loan.id,
        guarantorId:     OFFICE_GUARANTOR_ID,
        liabilityAmount: totalRepayment,
        amountPaid:      0,
        status:          'pending',
        notes:           `Admin override: all guarantors rejected. Full liability (${formatCurrency(totalRepayment)}) assigned to The Office by admin (User ID: ${adminUserId}).`,
      });
    }

    // ── Send approval emails ─────────────────────────────────────
    const memberWithEmail = await getMemberWithEmail(loan.memberId);
    if (memberWithEmail?.user?.email) {
      try {
        sendEmail({
          to: memberWithEmail.user.email,
          ...emailTemplates.loanApproved(memberWithEmail, {
            ...loan.toJSON(),
            totalRepayment,
            disbursedAmount: amountDisbursed,
          }),
        });
      } catch (emailErr) { console.error('Failed to send loan approval email to member:', emailErr.message); }
    }

    const acceptedGuarantors = allGuarantors.filter(g => g.approvalStatus === 'accepted');
    for (const guarantorRecord of acceptedGuarantors) {
      const guarantorMember = guarantorRecord.guarantor;
      if (guarantorMember && guarantorMember.user && guarantorMember.user.email) {
        try {
          sendEmail({
            to: guarantorMember.user.email,
            ...emailTemplates.guarantorLoanApproved(
              guarantorMember, loan.member,
              { ...loan.toJSON(), totalRepayment, disbursedAmount: amountDisbursed }
            ),
          });
        } catch (emailErr) { console.error(`Failed to send loan approval email to guarantor ${guarantorMember.id}:`, emailErr.message); }
      }
    }

    const overrideNote = allRejected
      ? ` All guarantors had rejected — full liability assigned to The Office.`
      : '';

    const topUpNote = loan.loanType === 'top_up' && clearedBalance > 0
      ? ` Previous balance of ${formatCurrency(clearedBalance)} cleared. Member receives ${formatCurrency(amountDisbursed)} in hand. New loan balance: ${formatCurrency(totalRepayment)}.`
      : '';

    return res.json({
      message: `Loan approved for ${loan.member.firstName} ${loan.member.lastName}. ` +
               `Loan amount: KES ${principal.toLocaleString()}. ` +
               `Total repayment (incl. KES ${txFee.toLocaleString()} fee): KES ${totalRepayment.toLocaleString()}. ` +
               `Duration: ${loan.durationMonths} months.${overrideNote}${topUpNote}`,
      loan: {
        ...loan.toJSON(),
        approvalStatus:  loan.approvalStatus,
        status:          loan.status,
        disbursedAmount: amountDisbursed,
        transactionFee:  txFee,
        totalRepayment,
        loanType:        loan.loanType,
        previousBalance: loan.previousBalance,
        clearedBalance,
      },
      adminLiabilityAssigned: allRejected,
      topUpClearedBalance: clearedBalance,
    });
  } catch (error) {
    console.error('Approve loan error:', error);
    return res.status(500).json({ message: 'Failed to approve loan' });
  }
};

// ─── POST /loans/:id/reject ─────────────────────────────────────
const rejectLoan = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const adminUserId = req.user.id;
  try {
    const loan = await Loan.findByPk(id, { include: [{ model: Member, as: 'member' }] });
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    if (loan.approvalStatus !== 'pending') return res.status(400).json({ message: `Loan already ${loan.approvalStatus}` });

    loan.approvalStatus  = 'rejected';
    loan.status          = 'rejected';
    loan.approvedBy      = adminUserId;
    loan.approvedAt      = new Date();
    loan.rejectionReason = reason || 'No reason provided';
    await loan.save();

    const memberWithEmail = await getMemberWithEmail(loan.memberId);
    if (memberWithEmail?.user?.email) {
      try {
        sendEmail({ to: memberWithEmail.user.email, ...emailTemplates.loanRejected(memberWithEmail, loan.toJSON()) });
      } catch (emailErr) { console.error('Failed to send loan rejection email:', emailErr.message); }
    }

    return res.json({ message: `Loan rejected for ${loan.member.firstName} ${loan.member.lastName}.`, loan });
  } catch (error) {
    console.error('Reject loan error:', error);
    return res.status(500).json({ message: 'Failed to reject loan' });
  }
};

// ─── POST /loans/payment ────────────────────────────────────────
const recordLoanPayment = async (req, res) => {
  const { loanId, amount, paymentDate, paymentMethod, notes } = req.body;
  try {
    const loan = await Loan.findByPk(loanId, {
      include: [
        { model: LoanPayment, as: 'payments' },
        { model: Member, as: 'member', include: [{ model: User, as: 'user' }] },
      ],
    });
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    if (loan.approvalStatus !== 'approved') return res.status(400).json({ message: 'Can only record payment for approved loans' });
    await updateLoanStatus(loan);
    const totalPaid      = loan.payments.reduce((s, p) => s + Number(p.amount), 0);
    const txFee          = Number(loan.transactionFee ?? 108);
    const totalRepayment = calculateTotalRepayment(loan.amount, loan.interestRate, txFee);
    const balance        = Math.round(totalRepayment + Number(loan.penaltyInterest || 0) - totalPaid);
    if (Number(amount) > balance) return res.status(400).json({ message: `Payment exceeds remaining balance of ${balance.toLocaleString()}` });

    await LoanPayment.create({ loanId, amount: Math.round(Number(amount)), paymentDate: paymentDate || new Date(), paymentMethod, notes });
    const newPaid    = Math.round(totalPaid + Number(amount));
    const newBalance = Math.round(balance   - Number(amount));
    loan.amountPaid       = newPaid;
    loan.remainingBalance = newBalance;
    if (newBalance <= 0) { loan.status = 'paid'; loan.penaltyInterest = 0; }
    await loan.save();

    const { createNotification } = require('./notificationController');
    if (loan.member && loan.member.user) {
      await createNotification(loan.member.user.id, {
        memberId: loan.memberId, type: 'loan_payment', title: 'Loan Payment Recorded',
        message: `Payment of ${formatCurrency(amount)} received. Remaining balance: ${formatCurrency(newBalance)}${newBalance <= 0 ? '. Your loan is now fully paid!' : ''}`,
        relatedLoanId: loanId,
      });
      try {
        sendEmail({
          to: loan.member.user.email,
          ...emailTemplates.loanPaymentRecorded(
            loan.member,
            { amount, paymentDate: paymentDate || new Date(), paymentMethod },
            { remainingBalance: newBalance }
          ),
        });
      } catch (emailErr) { console.error('Failed to send payment email:', emailErr.message); }
    }

    return res.status(201).json({ message: 'Payment recorded successfully', remainingBalance: newBalance, status: loan.status });
  } catch (error) {
    console.error('Record loan payment error:', error);
    return res.status(500).json({ message: 'Failed to record payment' });
  }
};

// ─── GET /loans/statistics ──────────────────────────────────────
const getLoanStatistics = async (req, res) => {
  const year = req.query.year ? parseInt(req.query.year) : null;

  const yearWhere = year ? {
    createdAt: {
      [Op.gte]: new Date(`${year}-01-01T00:00:00.000Z`),
      [Op.lt]:  new Date(`${year + 1}-01-01T00:00:00.000Z`),
    },
  } : {};

  const disbursedYearWhere = year ? {
    disbursementDate: {
      [Op.gte]: new Date(`${year}-01-01T00:00:00.000Z`),
      [Op.lt]:  new Date(`${year + 1}-01-01T00:00:00.000Z`),
    },
  } : {};

  try {
    let pendingLoans = 0, activeLoans = 0, arrearsLoans = 0,
        defaultedLoans = 0, paidLoans = 0, rejectedLoans = 0;

    try { pendingLoans   = await Loan.count({ where: { approvalStatus: 'pending',  ...yearWhere } }); } catch (e) {}
    try { activeLoans    = await Loan.count({ where: { status: 'active', approvalStatus: 'approved', ...disbursedYearWhere } }); } catch (e) {}
    try { arrearsLoans   = await Loan.count({ where: { status: 'arrears',  ...disbursedYearWhere } }); } catch (e) {}
    try { defaultedLoans = await Loan.count({ where: { status: 'default',  ...disbursedYearWhere } }); } catch (e) {}
    try { paidLoans      = await Loan.count({ where: { status: 'paid',     ...disbursedYearWhere } }); } catch (e) {}
    try { rejectedLoans  = await Loan.count({ where: { approvalStatus: 'rejected', ...yearWhere } }); } catch (e) {}

    const totalDisbursed = await Loan.sum('amount', {
      where: { approvalStatus: 'approved', ...disbursedYearWhere },
    }).catch(() => 0) || 0;

    const allPayments = await LoanPayment.sum('amount', {
      where: year ? {
        paymentDate: {
          [Op.gte]: new Date(`${year}-01-01T00:00:00.000Z`),
          [Op.lt]:  new Date(`${year + 1}-01-01T00:00:00.000Z`),
        },
      } : {},
    }).catch(() => 0) || 0;

    let outstandingBalance = 0;
    try {
      const allLoans = await Loan.findAll({
        where: { approvalStatus: 'approved', ...disbursedYearWhere },
        include: [{ model: LoanPayment, as: 'payments' }],
      });
      for (const loan of allLoans) {
        if (loan.status !== 'paid') {
          const txFee = Number(loan.transactionFee ?? 108);
          const paid  = loan.payments
            ? loan.payments.reduce((s, p) => s + Number(p.amount || 0), 0)
            : 0;
          const repayment = calculateTotalRepayment(loan.amount, loan.interestRate, txFee);
          outstandingBalance += Math.round(repayment + Number(loan.penaltyInterest || 0) - paid);
        }
      }
    } catch (e) { outstandingBalance = Math.round(totalDisbursed - allPayments); }

    return res.json({
      statistics: {
        year: year || 'all',
        pending_loans:       pendingLoans,
        active_loans:        activeLoans,
        arrears_loans:       arrearsLoans,
        defaulted_loans:     defaultedLoans,
        paid_loans:          paidLoans,
        rejected_loans:      rejectedLoans,
        total_disbursed:     Math.round(totalDisbursed),
        total_collected:     Math.round(allPayments),
        outstanding_balance: Math.round(outstandingBalance),
      },
    });
  } catch (error) {
    console.error('Get loan statistics error:', error);
    return res.json({
      statistics: {
        year: year || 'all',
        pending_loans: 0, active_loans: 0, arrears_loans: 0,
        defaulted_loans: 0, paid_loans: 0, rejected_loans: 0,
        total_disbursed: 0, total_collected: 0, outstanding_balance: 0,
      },
    });
  }
};

// ─── POST /loans/update-statuses ────────────────────────────────
const updateAllLoanStatuses = async (req, res) => {
  try {
    const loans = await Loan.findAll({ where: { status: { [Op.in]: ['active', 'arrears'] }, approvalStatus: 'approved' } });
    let updated = 0;
    for (const loan of loans) { await updateLoanStatus(loan); updated++; }
    return res.json({ message: `Updated ${updated} loan statuses`, updated });
  } catch (error) {
    console.error('Update loan statuses error:', error);
    return res.status(500).json({ message: 'Failed to update loan statuses' });
  }
};

// ─── GET /loans/duration-options ────────────────────────────────
const getDurationOptions = async (req, res) => {
  const { amount } = req.query;
  if (amount) {
    const tier = getLoanTier(amount);
    if (tier) return res.json({ tier: tier.name, minAmount: tier.minAmount, maxAmount: tier.maxAmount, durationOptions: tier.durations, message: `For ${amount}, you can select from ${tier.durations.length} duration option(s)` });
  }
  return res.json({ tiers: LOAN_TIERS, message: 'Duration options are based on loan amount tiers' });
};

// ─── PUT /loans/:id ─────────────────────────────────────────────
const updateLoan = async (req, res) => {
  const { id } = req.params;
  const { amount, durationMonths, guarantorIds } = req.body;
  try {
    const loan = await Loan.findByPk(id, { include: [{ model: Member, as: 'member' }, { model: LoanGuarantor, as: 'guarantors' }] });
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    if (loan.approvalStatus === 'approved') return res.status(400).json({ message: 'Cannot edit approved loans. Use payment recording instead.' });
    if (amount) {
      if (loan.member) {
        const totalSavings = await Savings.sum('amount', { where: { memberId: loan.memberId, isPaid: true } }) || 0;
        const maxLoan = await calculateMaxLoan(totalSavings, loan.memberId);
        if (Number(amount) > maxLoan) return res.status(400).json({ message: `Amount exceeds maximum eligible loan of ${maxLoan.toLocaleString()}` });
      }
      const tier = getLoanTier(amount);
      if (!tier) return res.status(400).json({ message: 'Invalid loan amount' });
      const duration = durationMonths || loan.durationMonths;
      const durationOption = tier.durations.find(d => d.months === Number(duration));
      if (!durationOption) return res.status(400).json({ message: `For amount ${amount}, only these durations are allowed: ${tier.durations.map(d => `${d.months} month(s)`).join(', ')}` });
      const txFee = Number(loan.transactionFee ?? 108);
      loan.amount = Math.round(Number(amount));
      loan.interestRate = durationOption.interestRate;
      loan.remainingBalance = calculateTotalRepayment(amount, durationOption.interestRate, txFee);
    }
    if (durationMonths) {
      const tier = getLoanTier(loan.amount);
      const durationOption = tier.durations.find(d => d.months === Number(durationMonths));
      if (!durationOption) return res.status(400).json({ message: 'Invalid duration for this loan amount' });
      const txFee = Number(loan.transactionFee ?? 108);
      loan.durationMonths = durationMonths;
      loan.interestRate = durationOption.interestRate;
      loan.remainingBalance = calculateTotalRepayment(loan.amount, durationOption.interestRate, txFee);
    }
    await loan.save();
    if (guarantorIds && Array.isArray(guarantorIds)) {
      await LoanGuarantor.destroy({ where: { loanId: id } });
      for (const gId of guarantorIds) {
        if (Number(gId) !== OFFICE_GUARANTOR_ID) {
          const guarantor = await Member.findOne({ where: { id: gId, isActive: true } });
          if (!guarantor) return res.status(400).json({ message: `Guarantor ID ${gId} not found` });
        }
        await LoanGuarantor.create({ loanId: id, guarantorId: gId });
      }
    }
    await loan.reload({ include: [{ model: Member, as: 'member' }, { model: LoanGuarantor, as: 'guarantors' }] });
    return res.json({ message: 'Loan updated successfully', loan });
  } catch (error) {
    console.error('Update loan error:', error);
    return res.status(500).json({ message: 'Failed to update loan' });
  }
};

// ─── DELETE /loans/:id ──────────────────────────────────────────
const deleteLoan = async (req, res) => {
  const { id } = req.params;
  try {
    const loan = await Loan.findByPk(id, { include: [{ model: Member, as: 'member' }, { model: LoanPayment, as: 'payments' }, { model: LoanGuarantor, as: 'guarantors' }] });
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    if (loan.payments && loan.payments.length > 0) return res.status(400).json({ message: 'Cannot delete loan with payment history. Consider marking as paid instead.' });
    await LoanGuarantor.destroy({ where: { loanId: id } });
    await loan.destroy();
    return res.json({ message: `Loan for ${loan.member?.firstName} ${loan.member?.lastName} deleted successfully` });
  } catch (error) {
    console.error('Delete loan error:', error);
    return res.status(500).json({ message: 'Failed to delete loan' });
  }
};

// ─── GET /loans/office-guarantor ────────────────────────────────
const getOfficeGuarantor = async (req, res) => {
  return res.json({ id: OFFICE_GUARANTOR_ID, name: OFFICE_GUARANTOR_NAME, firstName: 'The', lastName: 'Office', isVirtual: true, unlimitedCapacity: true, active_guarantees: '∞', total_savings: 0 });
};

// ─── GET /loans/my-guarantor-requests ───────────────────────────
const getMyGuarantorRequests = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { include: [{ model: Member, as: 'member' }] });
    if (!user || !user.member) return res.json({ requests: [] });
    const memberId = user.member.id;
    const guarantorRequests = await LoanGuarantor.findAll({
      where: { guarantorId: memberId, approvalStatus: 'pending' },
      include: [{ model: Loan, as: 'loan', include: [{ model: Member, as: 'member', attributes: ['id', 'firstName', 'lastName'] }, { model: LoanGuarantor, as: 'guarantors' }] }],
      order: [['createdAt', 'DESC']],
    });
    const formattedRequests = guarantorRequests
      .filter(gr => gr.loan && gr.loan.member)
      .map(gr => {
        const loan      = gr.loan;
        const applicant = loan.member;
        const principal = Number(loan.amount);
        const rate      = Number(loan.interestRate);
        const txFee     = Number(loan.transactionFee ?? 108);
        return {
          id:             gr.id,
          loanId:         loan.id,
          applicantId:    applicant.id,
          applicantName:  `${applicant.firstName} ${applicant.lastName}`,
          loanAmount:     loan.amount,
          interestRate:   loan.interestRate,
          durationMonths: loan.durationMonths,
          totalRepayment: calculateTotalRepayment(principal, rate, txFee),
          guarantorCount: loan.guarantors ? loan.guarantors.length : 1,
          createdAt:      gr.createdAt,
          approvalStatus: gr.approvalStatus,
        };
      });
    return res.json({ requests: formattedRequests });
  } catch (error) {
    console.error('Get guarantor requests error:', error);
    return res.status(500).json({ message: 'Failed to fetch guarantor requests' });
  }
};

// ─── POST /loans/guarantor-requests/:id/respond ─────────────────
const respondToGuarantorRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { response, reason } = req.body;
    const guarantorRecord = await LoanGuarantor.findByPk(id, {
      include: [{ model: Loan, as: 'loan', include: [{ model: Member, as: 'member', include: [{ model: User, as: 'user' }] }] }],
    });
    if (!guarantorRecord) return res.status(404).json({ message: 'Guarantor request not found' });
    if (guarantorRecord.approvalStatus !== 'pending') return res.status(400).json({ message: 'Request already responded to' });

    guarantorRecord.approvalStatus = response === 'accept' ? 'accepted' : 'rejected';
    guarantorRecord.responseDate   = new Date();
    if (response === 'reject') guarantorRecord.rejectionReason = reason || 'No reason provided';
    await guarantorRecord.save();

    const { createNotification } = require('./notificationController');
    const guarantorMember = await Member.findByPk(guarantorRecord.guarantorId);
    const applicant       = guarantorRecord.loan.member;

    if (applicant && applicant.user) {
      await createNotification(applicant.user.id, {
        memberId: applicant.id,
        type: 'guarantor_response',
        title: response === 'accept' ? 'Guarantor Accepted' : 'Guarantor Declined',
        message: response === 'accept'
          ? `${guarantorMember?.firstName} ${guarantorMember?.lastName} accepted to guarantee your loan`
          : `${guarantorMember?.firstName} ${guarantorMember?.lastName} declined to guarantee your loan${reason ? `: ${reason}` : ''}`,
        relatedLoanId: guarantorRecord.loanId, relatedGuarantorId: id,
      });

      const borrowerWithEmail = await getMemberWithEmail(applicant.id);
      if (borrowerWithEmail?.user?.email && guarantorMember) {
        const tmpl = response === 'accept'
          ? emailTemplates.guarantorAccepted(borrowerWithEmail, guarantorMember)
          : emailTemplates.guarantorDeclined(borrowerWithEmail, guarantorMember, reason);
        sendEmail({ to: borrowerWithEmail.user.email, ...tmpl });
      }
    }

    return res.json({ message: response === 'accept' ? 'Guarantor request accepted' : 'Guarantor request declined', guarantorRecord });
  } catch (error) {
    console.error('Respond to guarantor request error:', error);
    return res.status(500).json({ message: 'Failed to respond to request', error: error.message });
  }
};

// ─── GET /loans/:id/guarantor-status ────────────────────────────
const getLoanGuarantorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const guarantors = await LoanGuarantor.findAll({ where: { loanId: id }, include: [{ model: Member, as: 'guarantor', attributes: ['id', 'firstName', 'lastName'] }] });
    const allAccepted = guarantors.every(g => g.approvalStatus === 'accepted' || g.approvalStatus === 'admin_override');
    const anyRejected = guarantors.some(g => g.approvalStatus === 'rejected');
    const anyPending  = guarantors.some(g => g.approvalStatus === 'pending');
    return res.json({
      guarantors: guarantors.map(g => ({
        id:              g.id,
        guarantorId:     g.guarantorId,
        guarantorName:   g.guarantorId === OFFICE_GUARANTOR_ID ? 'The Office' : `${g.guarantor?.firstName} ${g.guarantor?.lastName}`,
        approvalStatus:  g.approvalStatus,
        responseDate:    g.responseDate,
        rejectionReason: g.rejectionReason,
      })),
      summary: { allAccepted, anyRejected, anyPending, canApprove: allAccepted && !anyRejected && !anyPending },
    });
  } catch (error) {
    console.error('Get guarantor status error:', error);
    return res.status(500).json({ message: 'Failed to get guarantor status' });
  }
};

// ─── POST /loans/:id/replace-guarantor ──────────────────────────
const replaceGuarantor = async (req, res) => {
  const { id: loanId } = req.params;
  const { oldGuarantorId, newGuarantorId } = req.body;
  try {
    if (!oldGuarantorId || !newGuarantorId) return res.status(400).json({ message: 'Both old and new guarantor IDs are required' });
    const loan = await Loan.findByPk(loanId, { include: [{ model: LoanGuarantor, as: 'guarantors' }, { model: Member, as: 'member' }] });
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    if (loan.approvalStatus !== 'pending') return res.status(400).json({ message: 'Can only replace guarantors for pending loans' });
    const oldGuarantorRecord = await LoanGuarantor.findOne({ where: { id: parseInt(oldGuarantorId), loanId } });
    if (!oldGuarantorRecord) return res.status(404).json({ message: 'Old guarantor record not found. Please refresh and try again.' });
    if (oldGuarantorRecord.approvalStatus !== 'rejected') return res.status(400).json({ message: 'Can only replace guarantors who have declined' });
    const newGuarantor = await Member.findByPk(newGuarantorId);
    if (!newGuarantor || !newGuarantor.isActive) return res.status(400).json({ message: 'New guarantor must be an active member' });
    if (newGuarantorId === loan.memberId) return res.status(400).json({ message: 'Cannot select yourself as guarantor' });
    const existingGuarantor = await LoanGuarantor.findOne({ where: { loanId, guarantorId: newGuarantorId } });
    if (existingGuarantor) return res.status(400).json({ message: 'This member is already a guarantor for this loan' });
    const activeGuarantees = await LoanGuarantor.count({ where: { guarantorId: newGuarantorId, approvalStatus: { [Op.in]: ['pending', 'accepted'] } } });
    if (activeGuarantees >= 3) return res.status(400).json({ message: `${newGuarantor.firstName} ${newGuarantor.lastName} already has 3 active guarantees` });
    await oldGuarantorRecord.destroy();
    await LoanGuarantor.create({ loanId, guarantorId: newGuarantorId, approvalStatus: 'pending', createdAt: new Date() });
    const { createNotification } = require('./notificationController');
    const newGuarantorMember = await Member.findByPk(newGuarantorId, { include: [{ model: User, as: 'user' }] });
    if (newGuarantorMember && newGuarantorMember.user) {
      await createNotification(newGuarantorMember.user.id, {
        memberId: newGuarantorId, type: 'guarantor_request', title: 'New Guarantor Request',
        message: `${loan.member.firstName} ${loan.member.lastName} has selected you as a guarantor for a loan of KES ${loan.amount.toLocaleString()}`,
        relatedLoanId: loanId,
      });
      sendEmail({ to: newGuarantorMember.user.email, ...emailTemplates.guarantorRequest(newGuarantorMember, loan.member, loan) });
    }
    return res.json({ message: 'Guarantor replaced successfully', newGuarantorName: `${newGuarantor.firstName} ${newGuarantor.lastName}` });
  } catch (error) {
    console.error('Replace guarantor error:', error);
    return res.status(500).json({ message: 'Failed to replace guarantor' });
  }
};

// ─── Arrears / Default notifications ────────────────────────────
const notifyMemberArrears = async (loan) => {
  try {
    const { createNotification } = require('./notificationController');
    const member = await Member.findByPk(loan.memberId, { include: [{ model: User, as: 'user' }] });
    if (member && member.user) {
      await createNotification(member.user.id, {
        memberId: loan.memberId, type: 'loan_arrears', title: 'Loan Payment Overdue - Arrears',
        message: `Your loan is overdue. You have 3 months to clear KES ${Math.round(loan.remainingBalance).toLocaleString()}. Penalty: 5% per month.`,
        relatedLoanId: loan.id,
      });
      sendEmail({ to: member.user.email, ...emailTemplates.loanArrears(member, loan) });
    }
  } catch (error) { console.error('Error sending arrears notification:', error); }
};

const notifyMemberDefault = async (loan, savingsDeducted) => {
  try {
    const { createNotification } = require('./notificationController');
    const member = await Member.findByPk(loan.memberId, { include: [{ model: User, as: 'user' }] });
    if (member && member.user) {
      const message = savingsDeducted > 0
        ? `Loan defaulted. Savings deducted: KES ${Math.round(savingsDeducted).toLocaleString()}. ${loan.remainingBalance > 0 ? `Guarantors liable for KES ${Math.round(loan.remainingBalance).toLocaleString()}.` : 'Settled.'}`
        : `Loan defaulted. ${loan.remainingBalance > 0 ? `Guarantors liable for KES ${Math.round(loan.remainingBalance).toLocaleString()}.` : 'Settled.'}`;
      await createNotification(member.user.id, { memberId: loan.memberId, type: 'loan_default', title: 'Loan Defaulted', message, relatedLoanId: loan.id });
      sendEmail({ to: member.user.email, ...emailTemplates.loanDefault(member, loan, savingsDeducted) });
    }
  } catch (error) { console.error('Error sending default notification:', error); }
};

const notifyGuarantorLiability = async (guarantorId, loanId, borrower, amount) => {
  try {
    const { createNotification } = require('./notificationController');
    const guarantor = await Member.findByPk(guarantorId, { include: [{ model: User, as: 'user' }] });
    if (guarantor && guarantor.user) {
      await createNotification(guarantor.user.id, {
        memberId: guarantorId, type: 'guarantor_liability', title: 'Guarantor Payment Required',
        message: `Loan you guaranteed for ${borrower.firstName} ${borrower.lastName} defaulted. Your liability: KES ${Math.round(amount).toLocaleString()}.`,
        relatedLoanId: loanId,
      });
      sendEmail({ to: guarantor.user.email, ...emailTemplates.guarantorLiability(guarantor, borrower, loanId, amount) });
    }
  } catch (error) { console.error('Error sending guarantor notification:', error); }
};

const calculateArrearsInterest = (remainingBalance, monthsInArrears) => {
  const monthlyRate = 0.05;
  let balance = Number(remainingBalance);
  let totalPenalty = 0;
  for (let i = 0; i < monthsInArrears; i++) {
    const monthlyPenalty = balance * monthlyRate;
    totalPenalty += monthlyPenalty;
    balance += monthlyPenalty;
  }
  return Math.round(totalPenalty);
};

const updateSingleLoanStatus = async (loan) => {
  try {
    const now         = new Date();
    const dueDate     = new Date(loan.dueDate);
    const daysPastDue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
    if (loan.status === 'default') return loan.status;
    if (loan.remainingBalance <= 0) { if (loan.status !== 'paid') { loan.status = 'paid'; loan.isOverdue = false; await loan.save(); } return 'paid'; }
    if (daysPastDue <= 0) { if (loan.status !== 'active') { loan.status = 'active'; loan.isOverdue = false; await loan.save(); } return 'active'; }
    if (daysPastDue > 0 && daysPastDue <= 90) {
      const monthsInArrears = Math.floor(daysPastDue / 30);
      if (loan.status !== 'arrears') { loan.status = 'arrears'; loan.arrearsStartDate = dueDate; loan.arrearsEndDate = new Date(dueDate.getTime() + (90 * 24 * 60 * 60 * 1000)); loan.isOverdue = true; await notifyMemberArrears(loan); }
      const txFee           = Number(loan.transactionFee ?? 108);
      const originalBalance = calculateTotalRepayment(loan.amount, loan.interestRate, txFee);
      const baseBalance     = Math.round(originalBalance - Number(loan.amountPaid));
      const arrearsInterest = calculateArrearsInterest(baseBalance, monthsInArrears);
      loan.penaltyInterest  = arrearsInterest;
      loan.arrearsMonths    = monthsInArrears;
      loan.remainingBalance = Math.round(baseBalance + arrearsInterest);
      await loan.save(); return 'arrears';
    }
    if (daysPastDue > 90 && loan.status !== 'default') { await processDefaultLoan(loan); return 'default'; }
    return loan.status;
  } catch (error) { console.error('Error updating loan status:', error); throw error; }
};

const processDefaultLoan = async (loan) => {
  try {
    const fullLoan = await Loan.findByPk(loan.id, {
      include: [
        { model: Member, as: 'member' },
        {
          model: LoanGuarantor, as: 'guarantors',
          where: { approvalStatus: 'accepted' },
          required: false,
          include: [{ model: Member, as: 'guarantor' }],
        },
      ],
    });
    if (!fullLoan) throw new Error('Loan not found');

    const totalSavings    = Math.round(Number(await Savings.sum('amount', { where: { memberId: loan.memberId } })) || 0);
    const deductionAmount = Math.min(totalSavings, Math.round(loan.remainingBalance));

    if (deductionAmount > 0) {
      await Savings.create({
        memberId:    loan.memberId,
        amount:      -deductionAmount,
        month:       new Date().getMonth() + 1,
        year:        new Date().getFullYear(),
        paymentDate: new Date(),
        savingDate:  new Date(),
        isPaid:      true,
        isLate:      false,
        notes:       `Savings deducted for defaulted loan #${loan.id}`,
        fineAmount:  0,
      });
      loan.savingsDeducted  = deductionAmount;
      loan.remainingBalance = Math.round(loan.remainingBalance - deductionAmount);
    }

    if (loan.remainingBalance > 0 && fullLoan.guarantors && fullLoan.guarantors.length > 0) {
      // ── Liability split: floor each share, assign remainder to first guarantor ──
      const totalGuarantors = fullLoan.guarantors.length;
      const baseShare       = Math.floor(loan.remainingBalance / totalGuarantors);
      const remainder       = Math.round(loan.remainingBalance) - (baseShare * totalGuarantors);

      for (let i = 0; i < totalGuarantors; i++) {
        const g       = fullLoan.guarantors[i];
        // First guarantor absorbs any remainder so the total always equals remainingBalance exactly
        const liability = i === 0 ? baseShare + remainder : baseShare;

        await GuarantorPayment.create({
          loanId:          loan.id,
          guarantorId:     g.guarantorId,
          liabilityAmount: liability,
          amountPaid:      0,
          status:          'pending',
          notes:           `Liability for defaulted loan #${loan.id}`,
        });
        await notifyGuarantorLiability(g.guarantorId, loan.id, fullLoan.member, liability);
      }
    } else if (loan.remainingBalance <= 0) {
      loan.status = 'paid';
    }

    if (loan.status !== 'paid') loan.status = 'default';
    loan.defaultDate = new Date();
    await loan.save();
    await notifyMemberDefault(loan, deductionAmount);
    return true;
  } catch (error) { console.error('Error processing default:', error); throw error; }
};

const recordGuarantorPayment = async (req, res) => {
  const { guarantorPaymentId } = req.params;
  const { amount, paymentDate, notes } = req.body;
  try {
    const payment = await GuarantorPayment.findByPk(guarantorPaymentId, {
      include: [{ model: Loan, as: 'loan' }, { model: Member, as: 'guarantor' }],
    });
    if (!payment) return res.status(404).json({ message: 'Guarantor payment record not found' });
    const amountToAdd   = Math.round(Number(amount));
    const newAmountPaid = Math.round(Number(payment.amountPaid) + amountToAdd);
    payment.amountPaid  = newAmountPaid;
    payment.paymentDate = paymentDate || new Date();
    payment.notes       = notes || payment.notes;
    payment.status      = newAmountPaid >= Math.round(Number(payment.liabilityAmount)) ? 'paid' : 'partial';
    await payment.save();
    const loan = payment.loan;
    loan.remainingBalance = Math.round(Number(loan.remainingBalance) - amountToAdd);
    loan.amountPaid       = Math.round(Number(loan.amountPaid) + amountToAdd);
    if (loan.remainingBalance <= 0) { loan.status = 'paid'; loan.remainingBalance = 0; }
    await loan.save();
    await LoanPayment.create({
      loanId:        loan.id,
      amount:        amountToAdd,
      paymentDate:   paymentDate || new Date(),
      paymentMethod: 'Guarantor Payment',
      notes:         `Payment by guarantor ${payment.guarantor.firstName} ${payment.guarantor.lastName}`,
    });
    return res.json({ message: 'Guarantor payment recorded successfully', payment, loanStatus: loan.status });
  } catch (error) {
    console.error('Error recording guarantor payment:', error);
    return res.status(500).json({ message: 'Failed to record guarantor payment' });
  }
};

const checkLoanEligibility = async (req, res) => {
  const { memberId } = req.params;
  try {
    const activeLoans = await Loan.findAll({ where: { memberId, status: ['active', 'arrears'] } });
    if (activeLoans.length > 0) {
      const activeLoan = activeLoans[0];
      return res.json({
        canApply: false, hasActiveLoan: true, canTopUp: true,
        message: 'You have an active loan. You can request a top-up instead.',
        activeLoan: {
          id: activeLoan.id, amount: activeLoan.amount,
          remainingBalance: activeLoan.remainingBalance, amountPaid: activeLoan.amountPaid,
          interestRate: activeLoan.interestRate, durationMonths: activeLoan.durationMonths,
          disbursementDate: activeLoan.disbursementDate, dueDate: activeLoan.dueDate,
        },
      });
    }
    const pendingLoans = await Loan.findAll({ where: { memberId, approvalStatus: 'pending' } });
    if (pendingLoans.length > 0) return res.json({ canApply: false, hasActiveLoan: false, canTopUp: false, message: 'You have a pending loan application. Please wait for approval.', pendingLoan: { id: pendingLoans[0].id, amount: pendingLoans[0].amount, appliedOn: pendingLoans[0].createdAt } });
    return res.json({ canApply: true, hasActiveLoan: false, canTopUp: false, message: 'You are eligible to apply for a new loan.' });
  } catch (error) {
    console.error('Check loan eligibility error:', error);
    return res.status(500).json({ message: 'Failed to check loan eligibility' });
  }
};

// ─── POST /loans/top-up ─────────────────────────────────────────
const requestTopUp = async (req, res) => {
  const { memberId, topUpAmount, durationMonths, guarantorIds } = req.body;
  try {
    const activeLoan = await Loan.findOne({
      where: { memberId, status: ['active', 'arrears'] },
      include: [{ model: Member, as: 'member' }],
    });
    if (!activeLoan) return res.status(400).json({ message: 'No active loan found. You can apply for a new loan instead.' });

    const currentBalance = Math.round(Number(activeLoan.remainingBalance));

    if (Number(topUpAmount) <= currentBalance) {
      return res.status(400).json({
        message: `Top-up amount must be greater than your current balance of ${formatCurrency(currentBalance)}. This ensures your old loan is cleared and you receive additional funds.`,
      });
    }

    const newTotalAmount  = Math.round(Number(topUpAmount));
    const amountDisbursed = Math.round(newTotalAmount - currentBalance);

    const tier = getLoanTier(newTotalAmount);
    if (!tier) return res.status(400).json({ message: 'Invalid loan amount for top-up' });
    const durationOption = tier.durations.find(d => d.months === Number(durationMonths));
    if (!durationOption) return res.status(400).json({ message: `For amount ${newTotalAmount}, only these durations are allowed: ${tier.durations.map(d => `${d.months} month(s)`).join(', ')}` });

    const interestRate      = durationOption.interestRate;
    const txFee             = 108;
    const newTotalRepayment = calculateTotalRepayment(newTotalAmount, interestRate, txFee);

    const requiredGuarantors = getRequiredGuarantors(newTotalAmount);
    if (!guarantorIds || guarantorIds.length < requiredGuarantors)
      return res.status(400).json({ message: `This top-up requires ${requiredGuarantors} guarantors. You provided ${guarantorIds?.length || 0}.` });

    for (const gId of guarantorIds) {
      if (Number(gId) === Number(memberId)) return res.status(400).json({ message: 'You cannot guarantee yourself' });
      if (Number(gId) === OFFICE_GUARANTOR_ID) continue;
      const guarantor = await Member.findOne({ where: { id: gId, isActive: true } });
      if (!guarantor) return res.status(400).json({ message: `Guarantor ID ${gId} not found or inactive` });
      const activeGuaranteeCount = await LoanGuarantor.count({
        where: { guarantorId: gId, approvalStatus: 'accepted' },
        include: [{ model: Loan, as: 'loan', where: { status: ['active', 'arrears'] }, required: true }],
      });
      if (activeGuaranteeCount >= MAX_ACTIVE_GUARANTEES)
        return res.status(400).json({ message: `${guarantor.firstName} ${guarantor.lastName} has already guaranteed ${MAX_ACTIVE_GUARANTEES} active loans` });
    }

    // ID is auto-generated by the beforeCreate hook in the Loan model
    const topUpLoan = await Loan.create({
      memberId,
      amount:           newTotalAmount,
      originalLoanId:   activeLoan.id,
      topUpAmount:      newTotalAmount,
      previousBalance:  currentBalance,
      amountDisbursed,
      durationMonths,
      interestRate,
      transactionFee:   txFee,
      totalRepayment:   newTotalRepayment,
      remainingBalance: newTotalRepayment,
      approvalStatus:   'pending',
      status:           'pending',
      loanType:         'top_up',
      disbursementDate: new Date(),
      dueDate:          new Date(),
    });

    activeLoan.status     = 'topped_up';
    activeLoan.toppedUpBy = topUpLoan.id;
    await activeLoan.save();

    const { createNotification } = require('./notificationController');
    for (const gId of guarantorIds) {
      const guarantorRecord = await LoanGuarantor.create({ loanId: topUpLoan.id, guarantorId: gId, approvalStatus: 'pending' });
      if (Number(gId) === OFFICE_GUARANTOR_ID) {
        const adminUsers = await User.findAll({ where: { role: 'admin' } });
        for (const adminUser of adminUsers) {
          await createNotification(adminUser.id, {
            memberId, type: 'office_guarantor_request', title: 'Office Guarantor Request (Top-Up)',
            message: `${activeLoan.member.firstName} ${activeLoan.member.lastName} requests Office as guarantor for ${formatCurrency(newTotalAmount)} top-up loan`,
            relatedLoanId: topUpLoan.id, relatedGuarantorId: guarantorRecord.id,
          });
          sendEmail({ to: adminUser.email, ...emailTemplates.adminGuarantorRequestOffice(activeLoan.member, topUpLoan) });
        }
      } else {
        const guarantorMember = await Member.findByPk(gId, { include: [{ model: User, as: 'user' }] });
        if (guarantorMember && guarantorMember.user) {
          await createNotification(guarantorMember.user.id, {
            memberId: gId, type: 'guarantor_request', title: 'Top-Up Loan Guarantor Request',
            message: `${activeLoan.member.firstName} ${activeLoan.member.lastName} wants you to guarantee their ${formatCurrency(newTotalAmount)} top-up loan`,
            relatedLoanId: topUpLoan.id, relatedGuarantorId: guarantorRecord.id,
          });
          sendEmail({ to: guarantorMember.user.email, ...emailTemplates.guarantorRequest(guarantorMember, activeLoan.member, topUpLoan) });
        }
      }
    }

    const memberWithEmail = await getMemberWithEmail(memberId);
    if (memberWithEmail?.user?.email) {
      sendEmail({ to: memberWithEmail.user.email, ...emailTemplates.loanApplied(memberWithEmail, topUpLoan) });
    }

    return res.status(201).json({
      message: 'Top-up loan request submitted successfully',
      topUpLoan: {
        id:               topUpLoan.id,
        previousBalance:  currentBalance,
        newTotalAmount,
        amountDisbursed,
        totalRepayment:   newTotalRepayment,
        interestRate,
        needsGuarantorApproval: true,
      },
    });
  } catch (error) {
    console.error('Request top-up error:', error);
    return res.status(500).json({ message: 'Failed to request top-up loan' });
  }
};

// ─── GET /loans/max-loan/:memberId ──────────────────────────────
const getMaxLoan = async (req, res) => {
  const { memberId } = req.params;
  try {
    const totalSavings = Math.round(Number(await Savings.sum('amount', { where: { memberId, isPaid: true } }) || 0));
    const maxLoan      = await calculateMaxLoan(totalSavings, memberId);
    let statutoryFee   = 0;
    if (Statutory) {
      try {
        const record = await Statutory.findOne({ where: { memberId, year: new Date().getFullYear() }, attributes: ['statutoryFee'] });
        statutoryFee = record ? Math.round(Number(record.statutoryFee)) : 0;
      } catch (e) {}
    }
    return res.json({ totalSavings, statutoryFee, maxLoan });
  } catch (error) {
    console.error('Get max loan error:', error);
    return res.status(500).json({ message: 'Failed to calculate max loan' });
  }
};

module.exports = {
  getAllLoans, getLoanById, getGuaranteedLoans, applyForLoan, approveLoan, rejectLoan,
  updateLoan, deleteLoan, recordLoanPayment, getLoanStatistics, updateAllLoanStatuses,
  getDurationOptions, getOfficeGuarantor, getMyGuarantorRequests, respondToGuarantorRequest,
  getLoanGuarantorStatus, replaceGuarantor, calculateArrearsInterest, updateSingleLoanStatus,
  processDefaultLoan, recordGuarantorPayment, notifyMemberArrears, notifyMemberDefault,
  notifyGuarantorLiability, checkLoanEligibility, requestTopUp, getMaxLoan,
  MAX_ACTIVE_GUARANTEES, LOAN_TIERS, OFFICE_GUARANTOR_ID, OFFICE_GUARANTOR_NAME,
};