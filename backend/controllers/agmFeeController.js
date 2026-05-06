const { AgmFee, Member, User, Statutory } = require('../models');

// ─── GET /agm-fees/stats ────────────────────────────────────────
const getAgmFeeStats = async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();

    const totalAgmFees       = Number(await AgmFee.sum('amount') || 0);
    const totalThisYear      = Number(await AgmFee.sum('amount', { where: { year } }) || 0);
    const contributionCount  = await AgmFee.count();
    const membersContributed = await AgmFee.count({ distinct: true, col: 'memberId' });

    return res.json({ totalAgmFees, totalThisYear, contributionCount, membersContributed, year });
  } catch (error) {
    console.error('AGM fee stats error:', error);
    return res.status(500).json({ message: 'Failed to fetch AGM fee stats', error: error.message });
  }
};

// ─── GET /agm-fees ──────────────────────────────────────────────
const getAllAgmFees = async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();

    const members = await Member.findAll({
      where: { isActive: true },
      attributes: ['id', 'firstName', 'lastName', 'phone'],
      order: [['firstName', 'ASC']],
    });

    const result = await Promise.all(members.map(async (m) => {
      const contributions = await AgmFee.findAll({
        where: { memberId: m.id },
        order: [['createdAt', 'DESC']],
      });

      const recorderIds = [...new Set(contributions.map(c => c.recordedBy).filter(Boolean))];
      const recorders   = recorderIds.length
        ? await User.findAll({ where: { id: recorderIds }, attributes: ['id', 'firstName', 'lastName'] })
        : [];
      const recorderMap = Object.fromEntries(recorders.map(u => [u.id, `${u.firstName} ${u.lastName}`]));

      const totalAgmFee    = contributions.reduce((s, c) => s + Number(c.amount), 0);
      const totalThisYear  = contributions
        .filter(c => Number(c.year) === year)
        .reduce((s, c) => s + Number(c.amount), 0);

      return {
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        phone: m.phone,
        totalAgmFee,
        totalThisYear,
        contributionCount: contributions.length,
        lastContribution: contributions[0]?.createdAt || null,
        contributions: contributions.map(c => ({
          id:         c.id,
          amount:     Number(c.amount),
          year:       c.year,
          source:     c.source,
          depositId:  c.depositId,
          notes:      c.notes,
          createdAt:  c.createdAt,
          recordedBy: recorderMap[c.recordedBy] || null,
        })),
      };
    }));

    const grandTotal = result.reduce((s, m) => s + m.totalAgmFee, 0);
    return res.json({ members: result, grandTotal, year });
  } catch (error) {
    console.error('Get AGM fees error:', error);
    return res.status(500).json({ message: 'Failed to fetch AGM fees', error: error.message });
  }
};

// ─── Helper: recalculate total agm_fees for a member+year and sync to statutory ─
const syncAgmFeeToStatutory = async (memberId, year) => {
  try {
    const total = Number(
      await AgmFee.sum('amount', { where: { memberId, year } }) || 0
    );

    // Only update statutory if a record already exists for this member+year.
    // If none exists yet, leave it alone — statutory will use agm_fees as fallback.
    const statutory = await Statutory.findOne({ where: { memberId, year } });
    if (statutory) {
      statutory.agmFee = total;
      await statutory.save();
    }
  } catch (err) {
    console.error('syncAgmFeeToStatutory error:', err);
    // Non-fatal — don't bubble up; the primary operation already succeeded.
  }
};

// ─── POST /agm-fees ─────────────────────────────────────────────
const createAgmFee = async (req, res) => {
  const { memberId, amount, year, notes } = req.body;
  const adminId = req.user?.id;
  try {
    if (!memberId || !amount)
      return res.status(400).json({ message: 'memberId and amount are required' });

    const member = await Member.findByPk(memberId);
    if (!member) return res.status(404).json({ message: 'Member not found' });

    const targetYear = year || new Date().getFullYear();

    const record = await AgmFee.create({
      memberId,
      amount,
      year:       targetYear,
      source:     'manual',
      recordedBy: adminId,
      notes:      notes || '',
    });

    // ── Sync the new total back to the statutory record (if one exists) ──
    await syncAgmFeeToStatutory(memberId, targetYear);

    return res.status(201).json({
      message: `AGM fee of KES ${amount} recorded for ${member.firstName} ${member.lastName}`,
      record,
    });
  } catch (error) {
    console.error('Create AGM fee error:', error);
    return res.status(500).json({ message: 'Failed to create AGM fee', error: error.message });
  }
};

// ─── DELETE /agm-fees/:id ───────────────────────────────────────
const deleteAgmFee = async (req, res) => {
  try {
    const record = await AgmFee.findByPk(req.params.id);
    if (!record) return res.status(404).json({ message: 'AGM fee record not found' });
    if (record.source === 'deposit')
      return res.status(400).json({ message: 'Cannot delete a deposit-linked AGM fee. Reject the deposit instead.' });

    const { memberId, year } = record;
    await record.destroy();

    // ── Sync the reduced total back to the statutory record (if one exists) ──
    await syncAgmFeeToStatutory(memberId, year);

    return res.json({ message: 'AGM fee deleted successfully' });
  } catch (error) {
    console.error('Delete AGM fee error:', error);
    return res.status(500).json({ message: 'Failed to delete AGM fee', error: error.message });
  }
};

// ─── Internal: called from depositController on approval ────────
const recordAgmFeeFromDeposit = async ({ memberId, amount, depositId, year, recordedBy }) => {
  const targetYear = year || new Date().getFullYear();

  await AgmFee.create({
    memberId,
    amount,
    year:       targetYear,
    source:     'deposit',
    depositId:  depositId || null,
    recordedBy: recordedBy || null,
    notes:      `Paid via deposit #${depositId}`,
  });

  // ── Sync the new total back to the statutory record (if one exists) ──
  await syncAgmFeeToStatutory(memberId, targetYear);
};

module.exports = { getAgmFeeStats, getAllAgmFees, createAgmFee, deleteAgmFee, recordAgmFeeFromDeposit };