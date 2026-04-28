const { RegistrationFee, Member, User } = require('../models');
const { Op } = require('sequelize');

// ─── GET /registration-fees ─────────────────────────────────────
const getAllRegistrationFees = async (req, res) => {
  try {
    const members = await Member.findAll({
      where: { isActive: true },
      attributes: ['id', 'firstName', 'lastName', 'phone', 'dateJoined'],
      order: [['firstName', 'ASC']],
    });

    const fees = await RegistrationFee.findAll();
    const feeMap = {};
    fees.forEach(f => { feeMap[f.memberId] = f; });

    const recorderIds = [...new Set(fees.map(f => f.recordedBy).filter(Boolean))];
    const recorders   = recorderIds.length
      ? await User.findAll({ where: { id: recorderIds }, attributes: ['id', 'firstName', 'lastName'] })
      : [];
    const recorderMap = Object.fromEntries(recorders.map(u => [u.id, `${u.firstName} ${u.lastName}`]));

    const result = members.map(m => {
      const fee = feeMap[m.id];
      return {
        id:          m.id,
        firstName:   m.firstName,
        lastName:    m.lastName,
        phone:       m.phone,
        dateJoined:  m.dateJoined,
        feeId:       fee?.id       || null,
        amount:      fee ? Number(fee.amount) : null,
        paidAt:      fee?.paidAt   || null,
        recordedBy:  fee ? (recorderMap[fee.recordedBy] || null) : null,
        notes:       fee?.notes    || null,
        hasPaid:     !!fee,
      };
    });

    const grandTotal = fees.reduce((s, f) => s + Number(f.amount || 0), 0);
    const paidCount  = fees.length;

    return res.json({ members: result, grandTotal, paidCount, totalMembers: members.length });
  } catch (error) {
    console.error('Get registration fees error:', error);
    return res.status(500).json({ message: 'Failed to fetch registration fees', error: error.message });
  }
};

// ─── GET /registration-fees/stats ──────────────────────────────
// Accepts optional ?year=YYYY to scope totals to registrations paid in that year.
// When no year is passed the all-time total is returned (backward-compatible).
const getRegistrationFeeStats = async (req, res) => {
  const year      = req.query.year ? parseInt(req.query.year) : null;
  const yearWhere = year ? {
    paidAt: {
      [Op.gte]: new Date(`${year}-01-01T00:00:00.000Z`),
      [Op.lt]:  new Date(`${year + 1}-01-01T00:00:00.000Z`),
    },
  } : {};

  try {
    const total = Number(await RegistrationFee.sum('amount', { where: yearWhere }) || 0);
    const count = await RegistrationFee.count({ where: yearWhere });
    return res.json({
      year:               year || 'all',
      registrationTotal:  total,
      paidCount:          count,
      total,
    });
  } catch (error) {
    console.error('Registration fee stats error:', error);
    return res.status(500).json({ message: 'Failed to fetch stats', error: error.message });
  }
};

// ─── POST /registration-fees ────────────────────────────────────
const saveRegistrationFee = async (req, res) => {
  const { memberId, amount, paidAt, notes } = req.body;
  const adminId = req.user?.id;

  if (!memberId || amount === undefined || amount === null) {
    return res.status(400).json({ message: 'memberId and amount are required' });
  }

  try {
    const member = await Member.findByPk(memberId);
    if (!member) return res.status(404).json({ message: 'Member not found' });

    const [record, created] = await RegistrationFee.findOrCreate({
      where: { memberId },
      defaults: {
        amount,
        paidAt:     paidAt || new Date(),
        recordedBy: adminId,
        notes:      notes || '',
      },
    });

    if (!created) {
      record.amount     = amount;
      record.paidAt     = paidAt || record.paidAt || new Date();
      record.recordedBy = adminId;
      record.notes      = notes || record.notes;
      await record.save();
    }

    return res.status(created ? 201 : 200).json({
      message: `Registration fee ${created ? 'recorded' : 'updated'} for ${member.firstName} ${member.lastName}`,
      record,
    });
  } catch (error) {
    console.error('Save registration fee error:', error);
    return res.status(500).json({ message: 'Failed to save registration fee', error: error.message });
  }
};

// ─── DELETE /registration-fees/:memberId ───────────────────────
const deleteRegistrationFee = async (req, res) => {
  try {
    const record = await RegistrationFee.findOne({ where: { memberId: req.params.memberId } });
    if (!record) return res.status(404).json({ message: 'Registration fee not found' });
    await record.destroy();
    return res.json({ message: 'Registration fee deleted' });
  } catch (error) {
    console.error('Delete registration fee error:', error);
    return res.status(500).json({ message: 'Failed to delete registration fee', error: error.message });
  }
};

// ─── Internal helper ────────────────────────────────────────────
const recordRegistrationFeeForMember = async ({ memberId, amount, recordedBy }) => {
  if (!amount || Number(amount) <= 0) return null;
  try {
    const [record] = await RegistrationFee.findOrCreate({
      where: { memberId },
      defaults: { amount, paidAt: new Date(), recordedBy: recordedBy || null, notes: 'Recorded at registration' },
    });
    return record;
  } catch (e) {
    console.error('Auto-record registration fee error:', e);
    return null;
  }
};

module.exports = {
  getAllRegistrationFees,
  getRegistrationFeeStats,
  saveRegistrationFee,
  deleteRegistrationFee,
  recordRegistrationFeeForMember,
};