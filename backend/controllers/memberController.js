const bcrypt = require('bcrypt');
const { Op }  = require('sequelize');
const {
  User, Member, Savings, Loan, LoanGuarantor, LoanPayment,
  ChamaaCycle, ChamaaParticipant, ChamaaContribution, Fine,
} = require('../models');
const { sendEmail }  = require('../services/emailService');
const emailTemplates = require('../services/emailTemplates');

// ─── Helper: generate next memberId (SSHG001, SSHG002 …) ────────
const generateMemberId = async () => {
  // Find the highest existing numeric suffix across ALL members (active + inactive)
  const last = await Member.findOne({
    where: {
      memberId: { [Op.like]: 'SSHG%' },
    },
    order: [['memberId', 'DESC']],
  });

  if (!last) return 'SSHG001';

  const num = parseInt(last.memberId.replace('SSHG', ''), 10);
  return `SSHG${String(num + 1).padStart(3, '0')}`;
};

// ─── GET /members ───────────────────────────────────────────────
const getAllMembers = async (req, res) => {
  try {
    const members = await Member.findAll({
      where: { isActive: true },
      include: [{ model: User, as: 'user', attributes: ['email'] }],
      order: [['lastName', 'ASC'], ['firstName', 'ASC']],
    });

    const rows = await Promise.all(
      members.map(async (m) => {
        const totalSavings = await Savings.sum('amount', {
          where: { memberId: m.id, isPaid: true },
        }) || 0;

        const activeGuarantees = await LoanGuarantor.count({
          include: [{ model: Loan, as: 'loan', where: { status: 'active' } }],
          where: { guarantorId: m.id },
        });

        return {
          ...m.toJSON(),
          email: m.user ? m.user.email : null,
          total_savings: totalSavings,
          active_guarantees: activeGuarantees,
        };
      })
    );

    return res.json({ members: rows });
  } catch (error) {
    console.error('Get all members error:', error);
    return res.status(500).json({ message: 'Failed to fetch members' });
  }
};

// ─── GET /members/:id ───────────────────────────────────────────
const getMemberById = async (req, res) => {
  try {
    const member = await Member.findByPk(req.params.id, {
      include: [{ model: User, as: 'user', attributes: ['email'] }],
    });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    const totalSavings = await Savings.sum('amount', {
      where: { memberId: member.id, isPaid: true },
    }) || 0;

    const maxLoanAmount = totalSavings > 3000 ? (totalSavings - 3000) * 3 : 0;

    const activeGuarantees = await LoanGuarantor.count({
      include: [{ model: Loan, as: 'loan', where: { status: 'active' } }],
      where: { guarantorId: member.id },
    });

    return res.json({
      member: {
        ...member.toJSON(),
        email: member.user ? member.user.email : null,
        total_savings: totalSavings,
        max_loan_amount: maxLoanAmount,
        active_guarantees: activeGuarantees,
      },
    });
  } catch (error) {
    console.error('Get member error:', error);
    return res.status(500).json({ message: 'Failed to fetch member' });
  }
};

// ─── POST /members ──────────────────────────────────────────────
const createMember = async (req, res) => {
  const { email, password, firstName, lastName, phone, dateJoined } = req.body;

  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Auto-generate the member ID
    const memberId = await generateMemberId();

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password:           hashedPassword,
      role:               'member',
      mustChangePassword: true, // ← member must set their own password on first login
    });

    const member = await Member.create({
      userId:     user.id,
      memberId,
      firstName,
      lastName,
      phone,
      dateJoined: dateJoined || new Date(),
    });

    // ── Send welcome email with login credentials ─────────────────
    // The password is sent in plain text here because mustChangePassword
    // is true — the member will be forced to change it on first login.
    try {
      await sendEmail({
        to: email,
        ...emailTemplates.memberWelcome({ firstName, lastName }, { email, password }),
      });
    } catch (emailErr) {
      // Non-fatal — member is created, just log the failure
      console.error('Failed to send welcome email:', emailErr.message);
    }

    return res.status(201).json({ message: 'Member created successfully', member });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'Duplicate email' });
    }
    console.error('Create member error:', error);
    return res.status(500).json({ message: 'Failed to create member' });
  }
};

// ─── PUT /members/:id ───────────────────────────────────────────
const updateMember = async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, phone, dateJoined } = req.body;

  try {
    const member = await Member.findByPk(id);
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    if (firstName)  member.firstName  = firstName;
    if (lastName)   member.lastName   = lastName;
    if (phone)      member.phone      = phone;
    if (dateJoined) member.dateJoined = dateJoined;
    // memberId is never updated — it is immutable once assigned

    await member.save();

    return res.json({ message: 'Member updated successfully', member });
  } catch (error) {
    console.error('Update member error:', error);
    return res.status(500).json({ message: 'Failed to update member' });
  }
};

// ─── DELETE /members/:id (soft-deactivate) ──────────────────────
const deactivateMember = async (req, res) => {
  try {
    const member = await Member.findByPk(req.params.id);
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }
    member.isActive = false;
    await member.save();
    return res.json({ message: 'Member deactivated successfully', member });
  } catch (error) {
    console.error('Deactivate member error:', error);
    return res.status(500).json({ message: 'Failed to deactivate member' });
  }
};

// ─── DELETE /members/:id/permanent ──────────────────────────────
const deleteMember = async (req, res) => {
  const { id } = req.params;

  try {
    const member = await Member.findByPk(id, {
      include: [
        { model: User,    as: 'user'    },
        { model: Savings, as: 'savings' },
        { model: Loan,    as: 'loans'   },
      ],
    });

    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    const hasActiveLoans = member.loans &&
      member.loans.some(l => l.status === 'active' || l.status === 'arrears');

    if (hasActiveLoans) {
      return res.status(400).json({
        message: 'Cannot delete member with active or overdue loans. Clear loans first.',
      });
    }

    const hasSavings = member.savings && member.savings.length > 0;
    if (hasSavings) {
      return res.status(400).json({
        message: 'Cannot delete member with savings history. Consider deactivating instead.',
      });
    }

    if (member.user) await member.user.destroy();
    await member.destroy();

    return res.json({
      message: `Member ${member.firstName} ${member.lastName} (${member.memberId}) deleted successfully`,
    });
  } catch (error) {
    console.error('Delete member error:', error);
    return res.status(500).json({ message: 'Failed to delete member' });
  }
};

// ─── GET /members/:id/dashboard ─────────────────────────────────
const getMemberDashboard = async (req, res) => {
  const memberId = req.params.id;

  try {
    const member = await Member.findByPk(memberId, {
      include: [{ model: User, as: 'user', attributes: ['email'] }],
    });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    const totalSavings = await Savings.sum('amount', {
      where: { memberId, isPaid: true },
    }) || 0;

    const maxLoanAmount = totalSavings > 3000 ? (totalSavings - 3000) * 3 : 0;

    const savings = await Savings.findAll({
      where: { memberId },
      order: [['year', 'DESC'], ['month', 'DESC']],
      limit: 12,
    });

    const loans = await Loan.findAll({
      where: { memberId, status: 'active' },
      include: [{ model: LoanPayment, as: 'payments' }],
      order: [['disbursementDate', 'DESC']],
    });

    const loansWithPaid = loans.map((l) => {
      const totalPaid = l.payments.reduce((s, p) => s + Number(p.amount), 0);
      return { ...l.toJSON(), total_paid: totalPaid };
    });

    const guaranteedLoans = await LoanGuarantor.findAll({
      where: { guarantorId: memberId },
      include: [{
        model: Loan, as: 'loan',
        where: { status: 'active' },
        include: [{ model: Member, as: 'member', attributes: ['firstName', 'lastName', 'memberId'] }],
      }],
    });

    const guaranteedData = guaranteedLoans.map((g) => ({
      ...g.loan.toJSON(),
      borrower: g.loan.member,
    }));

    const chamaa = await ChamaaParticipant.findAll({
      where: { memberId },
      include: [{
        model: ChamaaCycle, as: 'cycle',
        where: { isActive: true },
      }],
    });

    const fines = await Fine.findAll({
      where: { memberId, isPaid: false },
      order: [['year', 'DESC'], ['month', 'DESC']],
    });

    return res.json({
      member: {
        ...member.toJSON(),
        email:           member.user ? member.user.email : null,
        total_savings:   totalSavings,
        max_loan_amount: maxLoanAmount,
      },
      savings,
      loans: loansWithPaid,
      guaranteedLoans: guaranteedData,
      chamaa,
      fines,
    });
  } catch (error) {
    console.error('Get member dashboard error:', error);
    return res.status(500).json({
      message: 'Failed to fetch dashboard data',
      error:  error.message,
      detail: error.parent?.message,
    });
  }
};

module.exports = {
  getAllMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
  deactivateMember,
  getMemberDashboard,
};