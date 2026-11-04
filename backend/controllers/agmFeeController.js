const { AgmFee, Member, User, Statutory, Savings, sequelize } = require('../models');

// Annual AGM fee per member. A member settles it either by paying (deposit)
// or by having it deducted from savings (bulk action in December).
const AGM_FEE_ANNUAL = 2000;

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

// ─── GET /agm-fees/member/:memberId ─────────────────────────────
// Member-safe: returns ONLY this member's AGM contributions (manual +
// deposit-sourced, i.e. exactly what the admin AGM Fees page shows for them).
// Admins/staff may view any member; a member may only view their own record.
const getMemberAgmFees = async (req, res) => {
  try {
    const memberId = Number(req.params.memberId);
    const year     = Number(req.query.year) || new Date().getFullYear();
    if (!memberId) return res.status(400).json({ message: 'Invalid memberId' });

    const requester = await User.findByPk(req.user.id, {
      include: [{ model: Member, as: 'member', attributes: ['id'] }],
    });
    if (!requester) return res.status(401).json({ message: 'Unauthorized' });

    const isPrivileged = ['admin', 'staff'].includes(requester.role);
    if (!isPrivileged && Number(requester.member?.id) !== memberId) {
      return res.status(403).json({ message: 'You can only view your own AGM contributions' });
    }

    const contributions = await AgmFee.findAll({
      where: { memberId },
      order: [['createdAt', 'DESC']],
    });

    const totalAgmFee   = contributions.reduce((s, c) => s + Number(c.amount), 0);
    const totalThisYear = contributions
      .filter(c => Number(c.year) === year)
      .reduce((s, c) => s + Number(c.amount), 0);

    return res.json({
      memberId,
      year,
      annualFee:   AGM_FEE_ANNUAL,
      outstanding: Math.max(0, AGM_FEE_ANNUAL - totalThisYear),
      totalThisYear,
      totalAgmFee,
      contributionCount: contributions.length,
      contributions: contributions.map(c => ({
        id:        c.id,
        amount:    Number(c.amount),
        year:      c.year,
        source:    c.source,
        notes:     c.notes,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get member AGM fees error:', error);
    return res.status(500).json({ message: 'Failed to fetch AGM contributions', error: error.message });
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

    if (record.source === 'savings') {
      // Undo a savings deduction: add the money back as a positive savings
      // entry (keeps an audit trail) and remove the AGM record, atomically.
      const now = new Date();
      const t = await sequelize.transaction();
      try {
        await Savings.create({
          memberId, amount: Number(record.amount),
          month: now.getMonth() + 1, year: now.getFullYear(),
          paymentDate: now, savingDate: now, isPaid: true, isLate: false, fineAmount: 0,
          notes: `Reversal: ${year} AGM fee deduction (record #${record.id}) deleted`,
        }, { transaction: t });
        await record.destroy({ transaction: t });
        await t.commit();
      } catch (err) { await t.rollback(); throw err; }
    } else {
      await record.destroy();
    }

    // ── Sync the reduced total back to the statutory record (if one exists) ──
    await syncAgmFeeToStatutory(memberId, year);

    return res.json({
      message: record.source === 'savings'
        ? 'AGM fee deleted and the amount returned to the member\'s savings'
        : 'AGM fee deleted successfully',
    });
  } catch (error) {
    console.error('Delete AGM fee error:', error);
    return res.status(500).json({ message: 'Failed to delete AGM fee', error: error.message });
  }
};

// ─── POST /agm-fees/bulk-deduct-from-savings ────────────────────
// Body: { year, confirm }
//   confirm !== true  → PREVIEW only, nothing is changed
//   confirm === true  → deduct the outstanding AGM fee from each member's savings
// A member is deducted only if their savings cover what they still owe;
// otherwise they are listed under `insufficient` so they can pay instead.
// Safe to run twice: already-settled members are skipped.
const bulkDeductFromSavings = async (req, res) => {
  try {
    const year    = Number(req.body.year) || new Date().getFullYear();
    const confirm = req.body.confirm === true;
    const adminId = req.user?.id;

    const members = await Member.findAll({
      where: { isActive: true },
      attributes: ['id', 'firstName', 'lastName'],
      order: [['firstName', 'ASC']],
    });

    const toDeduct = [];
    const insufficient = [];
    let alreadySettled = 0;

    for (const m of members) {
      const paid = Number(await AgmFee.sum('amount', { where: { memberId: m.id, year } }) || 0);
      const outstanding = Math.max(0, AGM_FEE_ANNUAL - paid);
      if (outstanding === 0) { alreadySettled++; continue; }

      const savingsBalance = Number(
        await Savings.sum('amount', { where: { memberId: m.id, isPaid: true } }) || 0
      );
      const row = {
        memberId: m.id, name: `${m.firstName} ${m.lastName}`,
        outstanding, savingsBalance,
      };
      (savingsBalance >= outstanding ? toDeduct : insufficient).push(row);
    }

    const totalToDeduct = toDeduct.reduce((s, r) => s + r.outstanding, 0);

    if (!confirm) {
      return res.json({
        preview: true, year, annualFee: AGM_FEE_ANNUAL,
        toDeduct, insufficient, alreadySettled, totalToDeduct,
      });
    }

    // One transaction per member so a single failure doesn't block the rest.
    const deducted = [];
    const failed   = [];
    const now = new Date();
    for (const row of toDeduct) {
      const t = await sequelize.transaction();
      try {
        await Savings.create({
          memberId: row.memberId, amount: -row.outstanding,
          month: now.getMonth() + 1, year: now.getFullYear(),
          paymentDate: now, savingDate: now, isPaid: true, isLate: false, fineAmount: 0,
          notes: `${year} AGM fee deducted from savings`,
        }, { transaction: t });
        await AgmFee.create({
          memberId: row.memberId, amount: row.outstanding, year,
          source: 'savings', recordedBy: adminId,
          notes: `Deducted from savings (${year} AGM fee)`,
        }, { transaction: t });
        await t.commit();
        await syncAgmFeeToStatutory(row.memberId, year);
        deducted.push(row);
      } catch (err) {
        await t.rollback();
        console.error(`AGM savings deduction failed for member ${row.memberId}:`, err.message);
        failed.push({ ...row, error: err.message });
      }
    }

    return res.json({
      preview: false, year,
      message: `AGM fee deducted from savings for ${deducted.length} member(s)`,
      deducted, failed, insufficient, alreadySettled,
      totalDeducted: deducted.reduce((s, r) => s + r.outstanding, 0),
    });
  } catch (error) {
    console.error('Bulk AGM savings deduction error:', error);
    return res.status(500).json({ message: 'Failed to deduct AGM fees from savings', error: error.message });
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

module.exports = {
  getAgmFeeStats, getAllAgmFees, getMemberAgmFees,
  createAgmFee, deleteAgmFee, bulkDeductFromSavings, recordAgmFeeFromDeposit,
  AGM_FEE_ANNUAL,
};