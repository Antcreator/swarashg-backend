const { Fine, Member, sequelize } = require('../models');
const { Op } = require('sequelize');

// ─── GET /fines ─────────────────────────────────────────────────
const getAllFines = async (req, res) => {
  const { fineType, isPaid, year } = req.query;
  let { memberId } = req.query;

  try {
    if (req.user.role === 'member') {
      memberId = req.user.member_id;
    }

    const where = {};
    if (memberId) where.memberId = memberId;
    if (fineType) where.fineType = fineType;
    if (isPaid !== undefined) where.isPaid = isPaid === 'true';
    if (year) where.year = year;

    const fines = await Fine.findAll({
      where,
      include: [{ model: Member, as: 'member', attributes: ['firstName', 'lastName'] }],
      order: [['createdAt', 'DESC']],
    });

    return res.json({ fines });
  } catch (error) {
    console.error('Get all fines error:', error);
    return res.status(500).json({ message: 'Failed to fetch fines' });
  }
};

// ─── GET /fines/stats ───────────────────────────────────────────
const getFinesStats = async (req, res) => {
  const year = req.query.year ? parseInt(req.query.year) : null;

  const dateWhere = year ? {
    [Op.or]: [
      { year },
      {
        year: null,
        createdAt: {
          [Op.gte]: new Date(`${year}-01-01T00:00:00.000Z`),
          [Op.lt]:  new Date(`${year + 1}-01-01T00:00:00.000Z`),
        },
      },
    ],
  } : {};

  try {
    const [savingsFineTotal, chamaaFineTotal, arrearsTotal, unpaidFines] = await Promise.all([
      Fine.sum('amount', { where: { fineType: 'savings_late', ...dateWhere } }),
      Fine.sum('amount', { where: { fineType: 'chamaa_late',  ...dateWhere } }),
      Fine.sum('amount', { where: { fineType: 'loan_arrears', ...dateWhere } }),
      Fine.count({ where: { isPaid: false, ...dateWhere } }),
    ]);

    return res.json({
      year:              year || 'all',
      savingsFineTotal:  Number(savingsFineTotal  || 0),
      chamaaFineTotal:   Number(chamaaFineTotal   || 0),
      arrearsTotal:      Number(arrearsTotal      || 0),
      unpaidFinesCount:  Number(unpaidFines       || 0),
      totalFines:        Number(savingsFineTotal  || 0) +
                         Number(chamaaFineTotal   || 0) +
                         Number(arrearsTotal      || 0),
    });
  } catch (error) {
    console.error('Get fines stats error:', error);
    return res.status(500).json({ message: 'Failed to fetch fines statistics' });
  }
};

// ─── POST /fines ────────────────────────────────────────────────
const createFine = async (req, res) => {
  const { memberId, fineType, amount, month, year, referenceId, notes } = req.body;
  try {
    if (!memberId || !fineType || !amount)
      return res.status(400).json({ message: 'memberId, fineType and amount are required' });

    const fine = await Fine.create({ memberId, fineType, amount, month, year, referenceId, notes });
    return res.status(201).json({ message: 'Fine recorded successfully', fine });
  } catch (error) {
    console.error('Create fine error:', error);
    return res.status(500).json({ message: 'Failed to create fine' });
  }
};

// ─── PUT /fines/:id/pay ─────────────────────────────────────────
const markFinePaid = async (req, res) => {
  try {
    const fine = await Fine.findByPk(req.params.id);
    if (!fine) return res.status(404).json({ message: 'Fine not found' });

    fine.isPaid = true;
    fine.paidAt = new Date();
    await fine.save();

    return res.json({ message: 'Fine marked as paid', fine });
  } catch (error) {
    console.error('Mark fine paid error:', error);
    return res.status(500).json({ message: 'Failed to update fine' });
  }
};

// ─── DELETE /fines/:id ──────────────────────────────────────────
const deleteFine = async (req, res) => {
  try {
    const fine = await Fine.findByPk(req.params.id);
    if (!fine) return res.status(404).json({ message: 'Fine not found' });
    await fine.destroy();
    return res.json({ message: 'Fine deleted successfully' });
  } catch (error) {
    console.error('Delete fine error:', error);
    return res.status(500).json({ message: 'Failed to delete fine' });
  }
};

module.exports = { getAllFines, getFinesStats, createFine, markFinePaid, deleteFine };