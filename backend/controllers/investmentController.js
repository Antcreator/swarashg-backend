const { Investment, InvestmentColumnName } = require('../models');

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const COLS = [1,2,3,4,5,6,7,8,9,10];

// ─── GET /investments?year=2026 ─────────────────────────────────
const getAllInvestments = async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  try {
    const records = await Investment.findAll({ where: { year }, order: [['month', 'ASC']] });
    const recordMap = {};
    records.forEach(r => { recordMap[r.month] = r; });

    const rows = MONTHS.map((name, idx) => {
      const month = idx + 1;
      const r     = recordMap[month];
      const row   = { month, monthName: name, id: r?.id || null, notes: r?.notes || '', recordedBy: r?.recordedBy || null };
      COLS.forEach(i => { row[`investment${i}Amount`] = Number(r?.[`investment${i}Amount`] || 0); });
      return row;
    });

    const colNamesRec = await InvestmentColumnName.findOne({ where: { year } });
    const colNames    = {};
    COLS.forEach(i => { colNames[`col${i}`] = colNamesRec?.[`col${i}`] || ''; });

    const colTotals = COLS.map(i => rows.reduce((sum, r) => sum + (r[`investment${i}Amount`] || 0), 0));
    const grandTotal = colTotals.reduce((a, b) => a + b, 0);

    return res.json({ year, rows, colNames, colTotals, grandTotal });
  } catch (error) {
    console.error('Get investments error:', error);
    return res.status(500).json({ message: 'Failed to fetch investments', error: error.message });
  }
};

// ─── POST /investments/save ─────────────────────────────────────
const saveInvestments = async (req, res) => {
  const { year, rows, colNames } = req.body;
  const adminId = req.user?.id;

  if (!year || !Array.isArray(rows))
    return res.status(400).json({ message: 'year and rows are required' });

  try {
    await Promise.all(rows.map(async (r) => {
      const month = Number(r.month);
      if (!month || month < 1 || month > 12) return;
      const payload = { year: Number(year), month, notes: r.notes || '', recordedBy: adminId || null };
      COLS.forEach(i => { payload[`investment${i}Amount`] = Number(r[`investment${i}Amount`] || 0); });
      await Investment.upsert(payload);
    }));

    if (colNames) {
      const colPayload = { year: Number(year) };
      COLS.forEach(i => { colPayload[`col${i}`] = colNames[`col${i}`] || ''; });
      await InvestmentColumnName.upsert(colPayload);
    }

    return res.json({ message: `Investments saved for ${year}` });
  } catch (error) {
    console.error('Save investments error:', error);
    return res.status(500).json({ message: 'Failed to save investments', error: error.message });
  }
};

// ─── GET /investments/stats ─────────────────────────────────────
const getInvestmentStats = async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  try {
    const records  = await Investment.findAll({ where: { year } });
    const colTotals = COLS.map(i => records.reduce((sum, r) => sum + Number(r[`investment${i}Amount`] || 0), 0));
    const grandTotal = colTotals.reduce((a, b) => a + b, 0);
    return res.json({ year, grandTotal, colTotals });
  } catch (error) {
    console.error('Investment stats error:', error);
    return res.status(500).json({ message: 'Failed to fetch investment stats', error: error.message });
  }
};

module.exports = { getAllInvestments, saveInvestments, getInvestmentStats };