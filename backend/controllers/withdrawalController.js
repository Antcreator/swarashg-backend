const { Withdrawal } = require('../models');

const TOTAL_ROWS = 150;

// ─── GET /withdrawals ────────────────────────────────────────────
// Returns all 150 rows. Rows not yet in DB are returned as empty objects.
const getWithdrawals = async (req, res) => {
  try {
    const records = await Withdrawal.findAll({
      order: [['rowNumber', 'ASC']],
    });

    // Build a map for O(1) lookup
    const map = {};
    records.forEach(r => { map[r.rowNumber] = r; });

    // Return all 150 rows — missing ones as empty
    const rows = Array.from({ length: TOTAL_ROWS }, (_, i) => {
      const rowNumber = i + 1;
      const r = map[rowNumber];
      return {
        rowNumber,
        date:      r?.date      ?? '',
        narrative: r?.narrative ?? '',
        loan:      r?.loan      !== null && r?.loan      !== undefined ? Number(r.loan)       : '',
        chamaa:    r?.chamaa    !== null && r?.chamaa    !== undefined ? Number(r.chamaa)     : '',
        expense:   r?.expense   !== null && r?.expense   !== undefined ? Number(r.expense)    : '',
        investment:r?.investment!== null && r?.investment!== undefined ? Number(r.investment) : '',
        others:    r?.others    !== null && r?.others    !== undefined ? Number(r.others)     : '',
      };
    });

    return res.json({ rows });
  } catch (error) {
    console.error('Get withdrawals error:', error);
    return res.status(500).json({ message: 'Failed to fetch withdrawals' });
  }
};

// ─── POST /withdrawals/save ──────────────────────────────────────
// Upserts all changed rows. Frontend sends only dirty rows to avoid
// unnecessary DB writes.
const saveWithdrawals = async (req, res) => {
  const { rows } = req.body;
  const adminId  = req.user?.id;

  if (!Array.isArray(rows)) {
    return res.status(400).json({ message: 'rows must be an array' });
  }

  try {
    await Promise.all(rows.map(async (row) => {
      const rowNumber = Number(row.rowNumber);
      if (!rowNumber || rowNumber < 1 || rowNumber > TOTAL_ROWS) return;

      const payload = {
        rowNumber,
        date:       row.date       || null,
        narrative:  row.narrative  || null,
        loan:       row.loan       !== '' && row.loan       != null ? Number(row.loan)       : null,
        chamaa:     row.chamaa     !== '' && row.chamaa     != null ? Number(row.chamaa)     : null,
        expense:    row.expense    !== '' && row.expense    != null ? Number(row.expense)    : null,
        investment: row.investment !== '' && row.investment != null ? Number(row.investment) : null,
        others:     row.others     !== '' && row.others     != null ? Number(row.others)     : null,
        updatedBy:  adminId ?? null,
      };

      await Withdrawal.upsert(payload);
    }));

    return res.json({ message: 'Withdrawals saved successfully' });
  } catch (error) {
    console.error('Save withdrawals error:', error);
    return res.status(500).json({ message: 'Failed to save withdrawals' });
  }
};

// ─── DELETE /withdrawals/clear ───────────────────────────────────
// Clears all rows (admin only)
const clearWithdrawals = async (req, res) => {
  try {
    await Withdrawal.destroy({ where: {}, truncate: true });
    return res.json({ message: 'All withdrawals cleared' });
  } catch (error) {
    console.error('Clear withdrawals error:', error);
    return res.status(500).json({ message: 'Failed to clear withdrawals' });
  }
};

module.exports = { getWithdrawals, saveWithdrawals, clearWithdrawals };