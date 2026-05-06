const { Statutory, Member, Savings, SeedCapital, Fine, User, AgmFee } = require('../models');

// Helper — safely get a user's full name by ID
const getAdminName = async (userId) => {
  if (!userId) return null;
  try {
    const user = await User.findByPk(userId, { attributes: ['firstName', 'lastName'] });
    return user ? `${user.firstName} ${user.lastName}` : null;
  } catch { return null; }
};

// GET /statutory?year=2025
const getAllStatutory = async (req, res) => {
  try {
    // ✅ Guard: should never reach here without req.user, but belt-and-suspenders
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const year     = Number(req.query.year) || new Date().getFullYear();
    const isMember = req.user.role === 'member';

    const whereClause = isMember
      ? { id: req.user.member_id, isActive: true }
      : { isActive: true };

    // ✅ Guard: member role but no member_id linked — misconfigured account
    if (isMember && !req.user.member_id) {
      return res.status(403).json({ message: 'No member profile linked to this account' });
    }

    const members = await Member.findAll({
      where: whereClause,
      attributes: ['id', 'firstName', 'lastName', 'phone'],
      order: [['firstName', 'ASC']],
    });

    // Build agmFee deposit map from the agm_fees table (used as fallback default)
    const agmRows = await AgmFee.findAll({
      where: { year },
      attributes: ['memberId', 'amount'],
    });
    const agmDepositMap = {};
    agmRows.forEach(r => {
      agmDepositMap[r.memberId] = (agmDepositMap[r.memberId] || 0) + Number(r.amount || 0);
    });

    const result = await Promise.all(members.map(async (m) => {
      const [totalSavings, totalSeedCapital, savingsFine, chamaaFine] = await Promise.all([
        Savings.sum('amount',     { where: { memberId: m.id, isPaid: true } }).then(v => Number(v || 0)),
        SeedCapital.sum('amount', { where: { memberId: m.id } }).then(v => Number(v || 0)),
        Fine.sum('amount', { where: { memberId: m.id, fineType: 'savings_late' } }).then(v => Number(v || 0)),
        Fine.sum('amount', { where: { memberId: m.id, fineType: 'chamaa_late'  } }).then(v => Number(v || 0)),
      ]);

      const statutory = await Statutory.findOne({ where: { memberId: m.id, year } });

      const [submittedByName, editedByName] = await Promise.all([
        getAdminName(statutory?.submittedBy),
        getAdminName(statutory?.editedBy),
      ]);

      // ✅ If a statutory record exists and agmFee was explicitly saved on it, use that.
      //    Otherwise fall back to the sum from agm_fees deposits.
      const agmFeeDeposit = agmDepositMap[m.id] || 0;
      const agmFeeSaved   = statutory ? Number(statutory.agmFee) : null;
      // null means "never set by admin" → show deposit value; 0 means admin explicitly set it to 0
      const agmFee = (agmFeeSaved !== null) ? agmFeeSaved : agmFeeDeposit;

      return {
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        phone: m.phone,
        totalSavings,
        totalSeedCapital,
        savingsFine,
        chamaaFine,
        agmFee,
        agmFeeDeposit,          // ← sent to frontend so it can show "Deposit: KES X" hint
        cautionaryFee:      statutory ? Number(statutory.cautionaryFee)      : 0,
        statutoryFee:       statutory ? Number(statutory.statutoryFee)       : 0,
        guarantorDeduction: statutory ? Number(statutory.guarantorDeduction) : 0,
        other:              statutory ? Number(statutory.other)              : 0,
        notes:              statutory?.notes       || '',
        submittedAt:        statutory?.submittedAt || null,
        submittedByName,
        editedByName,
        statutoryId:        statutory?.id          || null,
      };
    }));

    return res.json({ members: result, year });
  } catch (error) {
    console.error('Get statutory error:', error);
    return res.status(500).json({ message: 'Failed to fetch statutory data', error: error.message });
  }
};

// PUT /statutory/:memberId
const upsertStatutory = async (req, res) => {
  const { memberId } = req.params;
  // ✅ agmFee is now accepted from the request body
  const { cautionaryFee, statutoryFee, guarantorDeduction, other, agmFee, notes, year } = req.body;
  const adminId = req.user?.id;

  try {
    const targetYear = year || new Date().getFullYear();

    const [record, created] = await Statutory.findOrCreate({
      where: { memberId, year: targetYear },
      defaults: {
        cautionaryFee:      cautionaryFee      ?? 0,
        statutoryFee:       statutoryFee       ?? 0,
        guarantorDeduction: guarantorDeduction ?? 0,
        other:              other              ?? 0,
        agmFee:             agmFee             ?? null, // null = not yet overridden by admin
        notes:              notes              ?? '',
        editedBy:           adminId            ?? null,
      },
    });

    if (!created) {
      if (cautionaryFee      !== undefined) record.cautionaryFee      = cautionaryFee;
      if (statutoryFee       !== undefined) record.statutoryFee       = statutoryFee;
      if (guarantorDeduction !== undefined) record.guarantorDeduction = guarantorDeduction;
      if (other              !== undefined) record.other              = other;
      if (agmFee             !== undefined) record.agmFee             = agmFee; // ✅ persist it
      if (notes              !== undefined) record.notes              = notes;
      record.editedBy = adminId ?? null;
      await record.save();
    }

    return res.json({ message: 'Statutory record saved', record });
  } catch (error) {
    console.error('Upsert statutory error:', error);
    return res.status(500).json({ message: 'Failed to save statutory record', error: error.message });
  }
};

// POST /statutory/:memberId/submit
const submitStatutory = async (req, res) => {
  const { memberId } = req.params;
  const { year } = req.body;
  const adminId = req.user?.id;

  try {
    const targetYear = year || new Date().getFullYear();
    const record = await Statutory.findOne({ where: { memberId, year: targetYear } });
    if (!record) return res.status(404).json({ message: 'No statutory record found. Save first.' });

    record.submittedAt = new Date();
    record.submittedBy = adminId;
    await record.save();

    return res.json({ message: 'Statutory record submitted', record });
  } catch (error) {
    console.error('Submit statutory error:', error);
    return res.status(500).json({ message: 'Failed to submit statutory record', error: error.message });
  }
};

module.exports = { getAllStatutory, upsertStatutory, submitStatutory };