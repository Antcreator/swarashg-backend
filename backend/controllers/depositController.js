const { Op } = require('sequelize');
const { Deposit, Member, Loan, SeedCapital, Savings, LoanPayment, User, Fine, sequelize } = require('../models');
const { recordAgmFeeFromDeposit } = require('./agmFeeController');
const { sendEmail }    = require('../services/emailService');
const emailTemplates   = require('../services/emailTemplates');

// ─── Helper: get member email ────────────────────────────────────
const getMemberEmail = async (memberId) => {
  try {
    const member = await Member.findByPk(memberId, {
      include: [{ model: User, as: 'user', attributes: ['email'] }],
    });
    return member?.user?.email || null;
  } catch { return null; }
};

// ─── Helper: get all admin emails ───────────────────────────────
const getAdminEmails = async () => {
  try {
    const admins = await User.findAll({
      where: { role: 'admin', isActive: true },
      attributes: ['email'],
    });
    return admins.map(a => a.email).filter(Boolean);
  } catch { return []; }
};

// ─── Helper: evaluate if a savings payment is late ──────────────
// Mirrors the window logic in Savings.jsx / DepositModal.jsx:
// Window to pay for month M of year Y = 11th of (M-1) → 10th of M.
const evaluateSavingsPayment = (targetMonth, targetYear, paymentDate) => {
  let prevMonth = targetMonth - 1;
  let prevYear  = targetYear;
  if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }

  const windowStart = new Date(prevYear,  prevMonth - 1, 11);
  const windowEnd   = new Date(targetYear, targetMonth - 1, 10);

  const payDay   = paymentDate.getDate();
  const payMonth = paymentDate.getMonth() + 1;
  const payYear  = paymentDate.getFullYear();
  const payOnly  = new Date(payYear, payMonth - 1, payDay);

  const isWithinWindow = payOnly >= windowStart && payOnly <= windowEnd;

  if (isWithinWindow) {
    return { isLate: false, finalMonth: targetMonth, finalYear: targetYear, fineAmount: 0 };
  }

  // Payment is late — push to the next month and add KES 500 fine
  const finalMonth = targetMonth === 12 ? 1  : targetMonth + 1;
  const finalYear  = targetMonth === 12 ? targetYear + 1 : targetYear;
  return { isLate: true, finalMonth, finalYear, fineAmount: 500 };
};

// ─── MEMBER: Submit deposit + distribution in one step ──────────
const createDeposit = async (req, res) => {
  // Accept either mpesaMessage (new) or mpesaCode (legacy fallback)
  const { memberId, totalAmount, mpesaMessage, mpesaCode: legacyCode, notes, distribution } = req.body;

  try {
    if (!memberId)    return res.status(400).json({ message: 'memberId is required' });
    if (!totalAmount) return res.status(400).json({ message: 'totalAmount is required' });

    // ── Derive code from message or fall back to legacy field ────
    const rawMessage  = mpesaMessage || legacyCode || '';
    if (!rawMessage.trim()) {
      return res.status(400).json({ message: 'M-PESA message is required' });
    }
    // Extract first 10 characters as the unique transaction code
    const derivedCode = rawMessage.replace(/\s/g, '').substring(0, 10).toUpperCase();
    if (!derivedCode) {
      return res.status(400).json({ message: 'Could not extract M-PESA code from message' });
    }

    if (!distribution) return res.status(400).json({ message: 'distribution is required' });

    const existing = await Deposit.findOne({ where: { mpesaCode: derivedCode } });
    if (existing) return res.status(400).json({ message: 'This M-PESA transaction has already been submitted' });

    const distributedTotal =
      Number(distribution.savings       || 0) +
      Number(distribution.loanPayment   || 0) +
      Number(distribution.chamaaPayment || 0) +
      Number(distribution.seedCapital   || 0) +
      Number(distribution.savingsFine   || 0) +
      Number(distribution.chamaaFine    || 0) +
      Number(distribution.agmFee        || 0) +
      Number(distribution.others        || 0);

    if (distributedTotal > Number(totalAmount))
      return res.status(400).json({ message: `Distribution (${distributedTotal}) exceeds deposit amount (${totalAmount})` });
    if (distributedTotal === 0)
      return res.status(400).json({ message: 'Please allocate funds to at least one category' });

    // ── Validate savingsMonth/savingsYear when savings > 0 ───────
    if (Number(distribution.savings || 0) > 0) {
      if (!distribution.savingsMonth || !distribution.savingsYear) {
        return res.status(400).json({ message: 'savingsMonth and savingsYear are required when savings amount is provided' });
      }
    }

    const depositPayload = {
      memberId, totalAmount,
      mpesaCode:    derivedCode,
      mpesaMessage: rawMessage,
      notes,
      depositStatus:           'pending_confirmation',
      distributionStatus:      'pending',
      availableBalance:        totalAmount,
      savingsAmount:           distribution.savings       || 0,
      // ── Store the member-specified savings month/year ──────────
      savingsMonth:            distribution.savingsMonth  || null,
      savingsYear:             distribution.savingsYear   || null,
      loanPaymentAmount:       distribution.loanPayment   || 0,
      loanId:                  distribution.loanId        || null,
      chamaaPaymentAmount:     distribution.chamaaPayment || 0,
      seedCapitalAmount:       distribution.seedCapital   || 0,
      savingsFineAmount:       distribution.savingsFine   || 0,
      chamaaFineAmount:        distribution.chamaaFine    || 0,
      agmFeeAmount:            distribution.agmFee        || 0,
      distributionRequestedAt: new Date(),
    };

    if ('othersAmount' in Deposit.rawAttributes) {
      depositPayload.othersAmount = distribution.others || 0;
    }

    const deposit = await Deposit.create(depositPayload);

    // ── Force-save mpesaMessage via raw SQL ──────────────────────
    try {
      try {
        await sequelize.query(
          'UPDATE deposits SET mpesa_message = :msg WHERE id = :id',
          { replacements: { msg: rawMessage, id: deposit.id } }
        );
      } catch (_) {
        await sequelize.query(
          'UPDATE deposits SET "mpesaMessage" = :msg WHERE id = :id',
          { replacements: { msg: rawMessage, id: deposit.id } }
        );
      }
    } catch (rawErr) {
      console.warn('Could not persist mpesaMessage via raw SQL:', rawErr.message);
    }

    // ── Emails (non-blocking) ────────────────────────────────────
    const [memberEmail, adminEmails, member] = await Promise.all([
      getMemberEmail(memberId),
      getAdminEmails(),
      Member.findByPk(memberId),
    ]);

    if (memberEmail && member) {
      try {
        const tmpl = emailTemplates.depositSubmitted(member, deposit);
        sendEmail({ to: memberEmail, ...tmpl });
      } catch (e) { console.error('Failed to send deposit submitted email to member:', e.message); }
    }
    for (const adminEmail of adminEmails) {
      try {
        const tmpl = emailTemplates.adminDepositPending(
          member || { firstName: 'Member', lastName: '' },
          { ...deposit.toJSON(), mpesaMessage: rawMessage }
        );
        sendEmail({ to: adminEmail, ...tmpl });
      } catch (e) { console.error('Failed to send deposit pending email to admin:', e.message); }
    }

    return res.status(201).json({
      message: 'Deposit submitted successfully. Waiting for admin approval.',
      deposit,
    });
  } catch (error) {
    console.error('Create deposit error:', error);
    return res.status(500).json({ message: 'Failed to submit deposit', error: error.message });
  }
};

// ─── ADMIN: Approve deposit + execute distribution ──────────────
const approveDeposit = async (req, res) => {
  const { id } = req.params;
  const adminUserId = req.user.id;
  const transaction = await sequelize.transaction();
  try {
    const deposit = await Deposit.findByPk(id, {
      include: [{ model: Member, as: 'member' }],
      transaction,
    });
    if (!deposit) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Deposit not found' });
    }
    if (deposit.depositStatus !== 'pending_confirmation') {
      await transaction.rollback();
      return res.status(400).json({ message: `Deposit already ${deposit.depositStatus}` });
    }

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();

    // ── Savings ──────────────────────────────────────────────────
    // Use the month/year the MEMBER specified (savingsMonth / savingsYear),
    // NOT today's date. This is the fix for savings appearing in the wrong month.
    if (deposit.savingsAmount > 0) {
      // Resolve target month/year — fall back to current month if somehow missing
      const targetMonth = Number(deposit.savingsMonth) || (currentDate.getMonth() + 1);
      const targetYear  = Number(deposit.savingsYear)  || currentYear;

      // Evaluate whether the payment is on-time or late using the same
      // window logic as the frontend (11th of prev month → 10th of target month)
      const { isLate, finalMonth, finalYear, fineAmount } =
        evaluateSavingsPayment(targetMonth, targetYear, currentDate);

      // If late, the saving is recorded for finalMonth/finalYear (pushed forward)
      const recordMonth = finalMonth;
      const recordYear  = finalYear;

      const existingSavings = await Savings.findOne({
        where: { memberId: deposit.memberId, month: recordMonth, year: recordYear },
        transaction,
      });

      if (existingSavings) {
        existingSavings.amount      = Number(existingSavings.amount) + Number(deposit.savingsAmount);
        existingSavings.isPaid      = true;
        existingSavings.isLate      = existingSavings.isLate || isLate;
        existingSavings.paymentDate = currentDate;
        existingSavings.fineAmount  = Number(existingSavings.fineAmount || 0) + fineAmount;
        existingSavings.notes       = existingSavings.notes
          ? `${existingSavings.notes}; From deposit ${deposit.mpesaCode}`
          : `From deposit ${deposit.mpesaCode}`;
        await existingSavings.save({ transaction });
      } else {
        await Savings.create({
          memberId:    deposit.memberId,
          amount:      deposit.savingsAmount,
          month:       recordMonth,
          year:        recordYear,
          paymentDate: currentDate,
          savingDate:  currentDate,
          isPaid:      true,
          isLate,
          fineAmount,
          notes: `From deposit ${deposit.mpesaCode}`,
        }, { transaction });
      }

      // If the payment was late, also create a Fine record for the KES 500 penalty
      if (isLate && fineAmount > 0) {
        await Fine.create({
          memberId:  deposit.memberId,
          fineType:  'savings_late',
          amount:    fineAmount,
          month:     recordMonth,
          year:      recordYear,
          isPaid:    false,
          notes:     `Auto-generated: late savings payment via deposit ${deposit.mpesaCode}`,
        }, { transaction });
      }
    }

    // ── Loan Payment ─────────────────────────────────────────────
    if (deposit.loanPaymentAmount > 0 && deposit.loanId) {
      const loan = await Loan.findByPk(deposit.loanId, { transaction });
      if (loan) {
        await LoanPayment.create({
          loanId: deposit.loanId, amount: deposit.loanPaymentAmount,
          paymentDate: currentDate, paymentMethod: 'M-PESA',
          notes: `From deposit ${deposit.mpesaCode}`,
        }, { transaction });
        loan.amountPaid       = Number(loan.amountPaid || 0) + Number(deposit.loanPaymentAmount);
        loan.remainingBalance = Number(loan.remainingBalance) - Number(deposit.loanPaymentAmount);
        if (loan.remainingBalance <= 0) { loan.status = 'paid'; loan.remainingBalance = 0; }
        await loan.save({ transaction });
      }
    }

    // ── Seed Capital ─────────────────────────────────────────────
    if (deposit.seedCapitalAmount > 0) {
      await SeedCapital.create({
        memberId: deposit.memberId, amount: deposit.seedCapitalAmount,
        depositId: deposit.id, paymentDate: currentDate,
        notes: `From deposit ${deposit.mpesaCode}`,
      }, { transaction });
      const member = await Member.findByPk(deposit.memberId, { transaction });
      member.totalSeedCapital = Number(member.totalSeedCapital || 0) + Number(deposit.seedCapitalAmount);
      await member.save({ transaction });
    }

    // ── Savings Fines ─────────────────────────────────────────────
    if (deposit.savingsFineAmount > 0) {
      const unpaidSavingsFines = await Fine.findAll({
        where: { memberId: deposit.memberId, fineType: 'savings_late', isPaid: false },
        order: [['year', 'ASC'], ['month', 'ASC']],
        transaction,
      });

      let remaining = Number(deposit.savingsFineAmount);
      for (const fine of unpaidSavingsFines) {
        if (remaining <= 0) break;
        const fineAmt = Number(fine.amount);
        if (remaining >= fineAmt) {
          fine.isPaid = true;
          fine.paidAt = currentDate;
          fine.notes  = fine.notes
            ? `${fine.notes}; Paid via deposit ${deposit.mpesaCode}`
            : `Paid via deposit ${deposit.mpesaCode}`;
          await fine.save({ transaction });
          remaining -= fineAmt;
        } else {
          fine.notes = fine.notes
            ? `${fine.notes}; Partial KES ${remaining} paid via deposit ${deposit.mpesaCode}`
            : `Partial KES ${remaining} paid via deposit ${deposit.mpesaCode}`;
          await fine.save({ transaction });
          remaining = 0;
        }
      }
    }

    // ── Chamaa Fines ──────────────────────────────────────────────
    if (deposit.chamaaFineAmount > 0) {
      const unpaidChamaaFines = await Fine.findAll({
        where: { memberId: deposit.memberId, fineType: 'chamaa_late', isPaid: false },
        order: [['year', 'ASC'], ['month', 'ASC']],
        transaction,
      });

      let remaining = Number(deposit.chamaaFineAmount);
      for (const fine of unpaidChamaaFines) {
        if (remaining <= 0) break;
        const fineAmt = Number(fine.amount);
        if (remaining >= fineAmt) {
          fine.isPaid = true;
          fine.paidAt = currentDate;
          fine.notes  = fine.notes
            ? `${fine.notes}; Paid via deposit ${deposit.mpesaCode}`
            : `Paid via deposit ${deposit.mpesaCode}`;
          await fine.save({ transaction });
          remaining -= fineAmt;
        } else {
          fine.notes = fine.notes
            ? `${fine.notes}; Partial KES ${remaining} paid via deposit ${deposit.mpesaCode}`
            : `Partial KES ${remaining} paid via deposit ${deposit.mpesaCode}`;
          await fine.save({ transaction });
          remaining = 0;
        }
      }
    }

    // ── Mark deposit as distributed ──────────────────────────────
    deposit.depositStatus      = 'distributed';
    deposit.distributionStatus = 'approved';
    deposit.availableBalance   = 0;
    deposit.confirmedBy        = adminUserId;
    deposit.confirmedAt        = currentDate;
    deposit.approvedBy         = adminUserId;
    deposit.approvedAt         = currentDate;
    deposit.confirmationNotes  = 'M-PESA transaction verified and distribution approved';
    await deposit.save({ transaction });

    await transaction.commit();

    // ── AGM Fee — after commit ────────────────────────────────────
    if (Number(deposit.agmFeeAmount) > 0) {
      try {
        await recordAgmFeeFromDeposit({
          memberId:  deposit.memberId,
          amount:    deposit.agmFeeAmount,
          depositId: deposit.id,
          year:      currentYear,
          recordedBy: adminUserId,
        });
      } catch (agmErr) {
        console.error('Failed to record AGM fee from deposit:', agmErr.message);
      }
    }

    // ── Email member (non-blocking) ──────────────────────────────
    const [memberEmail, member] = await Promise.all([
      getMemberEmail(deposit.memberId),
      Member.findByPk(deposit.memberId),
    ]);
    if (memberEmail && member) {
      try {
        const tmpl = emailTemplates.depositApproved(member, deposit);
        sendEmail({ to: memberEmail, ...tmpl });
      } catch (emailErr) {
        console.error('Failed to send deposit approval email to member:', emailErr.message);
      }
    } else {
      console.warn(`No email found for member ID ${deposit.memberId} on deposit approval`);
    }

    return res.json({ message: 'Deposit approved and funds distributed successfully', deposit });
  } catch (error) {
    await transaction.rollback();
    console.error('Approve deposit error:', error);
    return res.status(500).json({ message: 'Failed to approve deposit', error: error.message });
  }
};

// ─── ADMIN: Reject deposit ──────────────────────────────────────
const rejectDeposit = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const adminUserId = req.user.id;
  try {
    const deposit = await Deposit.findByPk(id, {
      include: [{ model: Member, as: 'member', include: [{ model: User, as: 'user' }] }],
    });
    if (!deposit) return res.status(404).json({ message: 'Deposit not found' });
    if (deposit.depositStatus === 'distributed')
      return res.status(400).json({ message: 'Cannot reject an already distributed deposit' });

    deposit.depositStatus      = 'rejected';
    deposit.distributionStatus = 'rejected';
    deposit.confirmedBy        = adminUserId;
    deposit.confirmedAt        = new Date();
    deposit.rejectionReason    = reason || 'No reason provided';
    await deposit.save();

    // ── In-app notification ───────────────────────────────────
    try {
      const { createNotification } = require('./notificationController');
      if (deposit.member?.user) {
        await createNotification(deposit.member.user.id, {
          memberId: deposit.memberId, type: 'deposit_rejected',
          title: 'Deposit Rejected',
          message: `Your deposit of KES ${Number(deposit.totalAmount).toLocaleString()} (M-PESA: ${deposit.mpesaCode}) was rejected. Reason: ${deposit.rejectionReason}`,
          relatedDepositId: deposit.id,
        });
      }
    } catch (notifErr) {
      console.error('Failed to send in-app notification:', notifErr.message);
    }

    // ── Email member (non-blocking) ──────────────────────────────
    const memberEmail = deposit.member?.user?.email || await getMemberEmail(deposit.memberId);
    if (memberEmail && deposit.member) {
      try {
        const tmpl = emailTemplates.depositRejected(deposit.member, deposit);
        sendEmail({ to: memberEmail, ...tmpl });
      } catch (emailErr) {
        console.error('Failed to send deposit rejection email:', emailErr.message);
      }
    } else {
      console.warn(`No email found for member ID ${deposit.memberId} on deposit rejection`);
    }

    return res.json({ message: 'Deposit rejected', deposit });
  } catch (error) {
    console.error('Reject deposit error:', error);
    return res.status(500).json({ message: 'Failed to reject deposit' });
  }
};

// ─── ADMIN: Edit distribution before approving ─────────────────
const updateDeposit = async (req, res) => {
  const { id } = req.params;
  const { totalAmount, distribution, notes } = req.body;
  try {
    const deposit = await Deposit.findByPk(id);
    if (!deposit) return res.status(404).json({ message: 'Deposit not found' });
    if (deposit.depositStatus === 'distributed')
      return res.status(400).json({ message: 'Cannot edit a distributed deposit' });

    if (totalAmount) { deposit.totalAmount = totalAmount; deposit.availableBalance = totalAmount; }
    if (notes) deposit.confirmationNotes = notes;

    if (distribution) {
      const total =
        Number(distribution.savings       || 0) +
        Number(distribution.loanPayment   || 0) +
        Number(distribution.chamaaPayment || 0) +
        Number(distribution.seedCapital   || 0) +
        Number(distribution.savingsFine   || 0) +
        Number(distribution.chamaaFine    || 0) +
        Number(distribution.agmFee        || 0) +
        Number(distribution.others        || 0);

      if (total > Number(deposit.totalAmount))
        return res.status(400).json({ message: 'Distribution exceeds deposit amount' });

      deposit.savingsAmount       = distribution.savings       || 0;
      // ── Preserve updated savings month/year if admin edits them ─
      if (distribution.savingsMonth) deposit.savingsMonth = distribution.savingsMonth;
      if (distribution.savingsYear)  deposit.savingsYear  = distribution.savingsYear;
      deposit.loanPaymentAmount   = distribution.loanPayment   || 0;
      deposit.loanId              = distribution.loanId        || null;
      deposit.chamaaPaymentAmount = distribution.chamaaPayment || 0;
      deposit.seedCapitalAmount   = distribution.seedCapital   || 0;
      deposit.savingsFineAmount   = distribution.savingsFine   || 0;
      deposit.chamaaFineAmount    = distribution.chamaaFine    || 0;
      deposit.agmFeeAmount        = distribution.agmFee        || 0;
      if ('othersAmount' in Deposit.rawAttributes) {
        deposit.othersAmount = distribution.others || 0;
      }
    }

    await deposit.save();
    return res.json({ message: 'Deposit updated successfully', deposit });
  } catch (error) {
    console.error('Update deposit error:', error);
    return res.status(500).json({ message: 'Failed to update deposit' });
  }
};

// ─── GET deposits ───────────────────────────────────────────────
const getDeposits = async (req, res) => {
  const { depositStatus, memberId, year } = req.query;
  const parsedYear = year ? parseInt(year) : null;
  try {
    const where = {};
    if (depositStatus) where.depositStatus = depositStatus;
    if (memberId)      where.memberId      = memberId;
    if (parsedYear) {
      where.createdAt = {
        [Op.gte]: new Date(`${parsedYear}-01-01T00:00:00.000Z`),
        [Op.lt]:  new Date(`${parsedYear + 1}-01-01T00:00:00.000Z`),
      };
    }

    const deposits = await Deposit.findAll({
      where,
      include: [
        { model: Member, as: 'member',          attributes: ['id', 'firstName', 'lastName'] },
        { model: Loan,   as: 'loan',            attributes: ['id', 'amount', 'remainingBalance'] },
        { model: User,   as: 'confirmer',       attributes: ['id', 'email'] },
        { model: User,   as: 'depositApprover', attributes: ['id', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    // ── Pull mpesaMessage via raw SQL ────────────────────────────
    let messageMap = {};
    try {
      const ids = deposits.map(d => d.id);
      if (ids.length > 0) {
        let rows = [];
        try {
          rows = await sequelize.query(
            'SELECT id, mpesa_message AS "mpesaMessage" FROM deposits WHERE id IN (:ids)',
            { replacements: { ids }, type: sequelize.QueryTypes.SELECT }
          );
        } catch (_) {
          rows = await sequelize.query(
            'SELECT id, "mpesaMessage" FROM deposits WHERE id IN (:ids)',
            { replacements: { ids }, type: sequelize.QueryTypes.SELECT }
          );
        }
        rows.forEach(r => { if (r && r.id != null) messageMap[r.id] = r.mpesaMessage || null; });
      }
    } catch (rawErr) {
      console.warn('mpesaMessage raw fetch failed:', rawErr.message);
    }

    const serialized = deposits.map(d => {
      const plain = d.toJSON();
      return {
        ...plain,
        mpesaMessage: messageMap[d.id] !== undefined
          ? messageMap[d.id]
          : (plain.mpesaMessage ?? null),
      };
    });

    return res.json({ deposits: serialized });
  } catch (error) {
    console.error('Get deposits error:', error);
    return res.status(500).json({ message: 'Failed to fetch deposits' });
  }
};

// ─── GET member deposit summary ─────────────────────────────────
const getDepositSummary = async (req, res) => {
  const { memberId } = req.params;
  try {
    const deposits = await Deposit.findAll({ where: { memberId }, order: [['createdAt', 'DESC']] });

    const totalDeposited   = deposits
      .filter(d => d.depositStatus === 'distributed')
      .reduce((sum, d) => sum + Number(d.totalAmount), 0);
    const pendingApproval  = deposits.filter(d => d.depositStatus === 'pending_confirmation').length;
    const rejectedDeposits = deposits.filter(d => d.depositStatus === 'rejected');

    const mapDeposit = (d) => ({
      id: d.id, totalAmount: d.totalAmount, mpesaCode: d.mpesaCode,
      mpesaMessage: d.mpesaMessage,
      depositStatus: d.depositStatus, distributionStatus: d.distributionStatus,
      availableBalance: d.availableBalance,
      savingsAmount:       d.savingsAmount,
      savingsMonth:        d.savingsMonth,
      savingsYear:         d.savingsYear,
      loanPaymentAmount:   d.loanPaymentAmount,
      chamaaPaymentAmount: d.chamaaPaymentAmount,
      seedCapitalAmount:   d.seedCapitalAmount,
      savingsFineAmount:   d.savingsFineAmount,
      chamaaFineAmount:    d.chamaaFineAmount,
      agmFeeAmount:        d.agmFeeAmount,
      othersAmount:        d.othersAmount,
      rejectionReason:     d.rejectionReason,
      rejectedAt:          d.confirmedAt,
      createdAt:           d.createdAt,
    });

    return res.json({
      totalDeposited, pendingApproval,
      rejectedDeposits: rejectedDeposits.map(mapDeposit),
      deposits:         deposits.map(mapDeposit),
    });
  } catch (error) {
    console.error('Get deposit summary error:', error);
    return res.status(500).json({ message: 'Failed to fetch deposit summary' });
  }
};

module.exports = {
  createDeposit, approveDeposit, rejectDeposit, updateDeposit, getDeposits, getDepositSummary,
  confirmDeposit:       approveDeposit,
  approveDistribution:  approveDeposit,
  rejectDistribution:   rejectDeposit,
  requestDistribution:  (req, res) => res.status(410).json({ message: 'Use POST /deposits instead' }),
  updateDistribution:   updateDeposit,
  getPendingDeposits:   (req, res) => getDeposits({ ...req, query: { ...req.query, depositStatus: 'pending_confirmation' } }, res),
  getAllDeposits:        getDeposits,
  getSeedCapitalSummary:(req, res) => res.status(410).json({ message: 'Not implemented' }),
};