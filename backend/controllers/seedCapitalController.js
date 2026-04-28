const { SeedCapital, Member } = require('../models');

// ─── GET /seed-capital/stats ────────────────────────────────────
const getSeedCapitalStats = async (req, res) => {
  try {
    const total = await SeedCapital.sum('amount');
    const count = await SeedCapital.count();
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

// Returns all members with their total seed capital amounts
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
        order: [['createdAt', 'DESC']],
      });

      const totalSeedCapital = contributions.reduce((sum, c) => sum + Number(c.amount || 0), 0);
      const lastContribution = contributions.length > 0 ? contributions[0].createdAt : null;

      return {
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        phone: m.phone,
        totalSeedCapital,
        contributionCount: contributions.length,
        lastContribution,
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

module.exports = { getSeedCapitalStats, getAllSeedCapital };