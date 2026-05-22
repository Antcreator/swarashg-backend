const { SeedCapital, Member } = require('../models');

const getAdminName = (reqUser) => {
  if (!reqUser) return 'Admin';
  return (
    reqUser.name      ||
    reqUser.fullName  ||
    reqUser.firstName ||
    reqUser.username  ||
    reqUser.email     ||
    `Admin #${reqUser.userId || reqUser.id}`
  );
};

// ─── GET /seed-capital/stats ─────────────────────────────────────────────────
const getSeedCapitalStats = async (req, res) => {
  try {
    const total       = await SeedCapital.sum('amount');
    const count       = await SeedCapital.count();
    const memberCount = await SeedCapital.count({ distinct: true, col: 'memberId' });

    return res.json({
      totalSeedCapital:   Number(total       || 0),
      contributionCount:  Number(count       || 0),
      membersContributed: Number(memberCount || 0),
    });
  } catch (error) {
    console.error('Get seed capital stats error:', error);
    return res.status(500).json({ message: 'Failed to fetch seed capital statistics' });
  }
};

// ─── GET /seed-capital/member/:memberId ──────────────────────────────────────
// Member-accessible: returns only that member's own seed capital total
const getMemberSeedCapital = async (req, res) => {
  const { memberId } = req.params;

  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'staff';

  // req.user.member_id is the Member table ID, set by authenticateToken
  if (!isAdmin && String(req.user?.member_id) !== String(memberId)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const contributions = await SeedCapital.findAll({
      where: { memberId },
      order: [['paymentDate', 'DESC']],
    });

    const totalSeedCapital = contributions.reduce((sum, c) => sum + Number(c.amount || 0), 0);

    return res.json({ memberId, totalSeedCapital, contributions });
  } catch (error) {
    console.error('Get member seed capital error:', error);
    return res.status(500).json({ message: 'Failed to fetch seed capital' });
  }
};

// ─── GET /seed-capital ────────────────────────────────────────────────────────
const getAllSeedCapital = async (req, res) => {
  try {
    const members = await Member.findAll({
      where: { isActive: true },
      attributes: ['id', 'firstName', 'lastName', 'phone'],
      order: [['firstName', 'ASC']],
    });

    const result = await Promise.all(members.map(async (m) => {
      const contributions = await SeedCapital.findAll({
        where: { memberId: m.id },
        order: [['paymentDate', 'DESC'], ['createdAt', 'DESC']],
      });

      const totalSeedCapital = contributions.reduce((sum, c) => sum + Number(c.amount || 0), 0);
      const lastContribution = contributions.length > 0
        ? contributions[0].paymentDate || contributions[0].createdAt
        : null;

      return {
        id:                m.id,
        firstName:         m.firstName,
        lastName:          m.lastName,
        phone:             m.phone,
        totalSeedCapital,
        contributionCount: contributions.length,
        lastContribution,
        contributions: contributions.map(c => ({
          id:          c.id,
          amount:      Number(c.amount),
          paymentDate: c.paymentDate,
          notes:       c.notes    || '',
          editedBy:    c.editedBy || '',
          editedAt:    c.editedAt || null,
          depositId:   c.depositId || null,
          createdAt:   c.createdAt,
        })),
      };
    }));

    const totalSeedCapital   = result.reduce((s, m) => s + m.totalSeedCapital, 0);
    const membersContributed = result.filter(m => m.totalSeedCapital > 0).length;

    return res.json({ members: result, totalSeedCapital, membersContributed });
  } catch (error) {
    console.error('Get all seed capital error:', error);
    return res.status(500).json({ message: 'Failed to fetch seed capital data' });
  }
};

// ─── POST /seed-capital ───────────────────────────────────────────────────────
const createSeedCapital = async (req, res) => {
  const { memberId, amount, paymentDate, notes, depositId } = req.body;

  if (!memberId || !amount || !paymentDate) {
    return res.status(400).json({ message: 'memberId, amount, and paymentDate are required' });
  }
  if (Number(amount) <= 0) {
    return res.status(400).json({ message: 'Amount must be greater than zero' });
  }

  try {
    const member = await Member.findByPk(memberId);
    if (!member) return res.status(404).json({ message: 'Member not found' });

    const adminName = getAdminName(req.user);

    const contribution = await SeedCapital.create({
      memberId:    Number(memberId),
      amount:      Number(amount),
      paymentDate,
      notes:       notes     || null,
      depositId:   depositId || null,
      editedBy:    adminName,
      editedAt:    new Date(),
    });

    return res.status(201).json({
      message: 'Seed capital contribution recorded successfully',
      contribution: {
        id:          contribution.id,
        memberId:    contribution.memberId,
        amount:      Number(contribution.amount),
        paymentDate: contribution.paymentDate,
        notes:       contribution.notes,
        editedBy:    contribution.editedBy,
        editedAt:    contribution.editedAt,
      },
    });
  } catch (error) {
    console.error('Create seed capital error:', error);
    return res.status(500).json({ message: 'Failed to record seed capital contribution' });
  }
};

// ─── PUT /seed-capital/:id ────────────────────────────────────────────────────
const updateSeedCapital = async (req, res) => {
  const { id } = req.params;
  const { amount, paymentDate, notes } = req.body;

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ message: 'A valid positive amount is required' });
  }
  if (!paymentDate) {
    return res.status(400).json({ message: 'paymentDate is required' });
  }

  try {
    const contribution = await SeedCapital.findByPk(id);
    if (!contribution) {
      return res.status(404).json({ message: 'Seed capital contribution not found' });
    }

    const adminName = getAdminName(req.user);

    await contribution.update({
      amount:      Number(amount),
      paymentDate,
      notes:       notes ?? contribution.notes,
      editedBy:    adminName,
      editedAt:    new Date(),
    });

    return res.json({
      message: 'Seed capital contribution updated successfully',
      contribution: {
        id:          contribution.id,
        memberId:    contribution.memberId,
        amount:      Number(contribution.amount),
        paymentDate: contribution.paymentDate,
        notes:       contribution.notes,
        editedBy:    contribution.editedBy,
        editedAt:    contribution.editedAt,
      },
    });
  } catch (error) {
    console.error('Update seed capital error:', error);
    return res.status(500).json({ message: 'Failed to update seed capital contribution' });
  }
};

// ─── DELETE /seed-capital/:id ─────────────────────────────────────────────────
const deleteSeedCapital = async (req, res) => {
  const { id } = req.params;
  try {
    const contribution = await SeedCapital.findByPk(id);
    if (!contribution) {
      return res.status(404).json({ message: 'Seed capital contribution not found' });
    }
    await contribution.destroy();
    return res.json({ message: 'Seed capital contribution deleted successfully' });
  } catch (error) {
    console.error('Delete seed capital error:', error);
    return res.status(500).json({ message: 'Failed to delete seed capital contribution' });
  }
};

module.exports = {
  getSeedCapitalStats,
  getMemberSeedCapital,
  getAllSeedCapital,
  createSeedCapital,
  updateSeedCapital,
  deleteSeedCapital,
};
