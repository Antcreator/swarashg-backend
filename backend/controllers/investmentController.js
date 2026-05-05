const { Investment, InvestmentColumnName, User } = require('../models');

// All valid months including 0 = Principal (all-time) row
const MONTH_DEFS = [
  { num: 0,  name: 'Principal' },
  { num: 12, name: 'December'  },
  { num: 1,  name: 'January'   },
  { num: 2,  name: 'February'  },
  { num: 3,  name: 'March'     },
  { num: 4,  name: 'April'     },
  { num: 5,  name: 'May'       },
  { num: 6,  name: 'June'      },
  { num: 7,  name: 'July'      },
  { num: 8,  name: 'August'    },
  { num: 9,  name: 'September' },
  { num: 10, name: 'October'   },
  { num: 11, name: 'November'  },
];

const VALID_MONTHS = new Set(MONTH_DEFS.map(m => m.num)); // 0-12
const COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// ─── GET /investments?year=2026 ─────────────────────────────────
const getAllInvestments = async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  try {
    const records = await Investment.findAll({
      where: { year },
      order: [['month', 'ASC']],
    });

    // Key by month number for O(1) lookup
    const recordMap = {};
    records.forEach(r => { recordMap[r.month] = r; });

    const rows = MONTH_DEFS.map(({ num, name }) => {
      const r   = recordMap[num];
      const row = {
        month:       num,
        monthName:   name,
        isPrincipal: num === 0,
        id:          r?.id        ?? null,
        notes:       r?.notes     ?? '',
        editedBy:    r?.editedBy  ?? '',   // display name string
        editedAt:    r?.editedAt  ?? null,
        recordedBy:  r?.recordedBy ?? null, // user FK for auditing
      };
      COLS.forEach(i => {
        row[`investment${i}Amount`] = Number(r?.[`investment${i}Amount`] ?? 0);
      });
      return row;
    });

    const colNamesRec = await InvestmentColumnName.findOne({ where: { year } });
    const colNames    = {};
    COLS.forEach(i => { colNames[`col${i}`] = colNamesRec?.[`col${i}`] ?? ''; });

    // Totals exclude the Principal row (month 0) to avoid double-counting
    const monthRows  = rows.filter(r => !r.isPrincipal);
    const colTotals  = COLS.map(i =>
      monthRows.reduce((sum, r) => sum + (Number(r[`investment${i}Amount`]) || 0), 0)
    );
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
  const adminId   = req.user?.id;
  // Use the name stored in the JWT / session; fall back to a safe default
  const adminName = req.user?.name || req.user?.username || req.user?.email || 'Admin';

  if (!year || !Array.isArray(rows))
    return res.status(400).json({ message: 'year and rows are required' });

  try {
    await Promise.all(rows.map(async (r) => {
      const month = Number(r.month);

      // Accept month 0 (Principal) and 1–12; reject anything else
      if (!VALID_MONTHS.has(month)) return;

      const payload = {
        year:       Number(year),
        month,
        notes:      r.notes ?? '',
        recordedBy: adminId ?? null,
        // Only stamp editedBy / editedAt when the row was actually dirty
        // The frontend sends editedBy = '' for untouched rows
        ...(r.editedBy !== undefined && r.editedBy !== ''
          ? { editedBy: r.editedBy, editedAt: r.editedAt ?? new Date() }
          : {}),
      };

      COLS.forEach(i => {
        payload[`investment${i}Amount`] = Number(r[`investment${i}Amount`] ?? 0);
      });

      await Investment.upsert(payload);
    }));

    if (colNames) {
      const colPayload = { year: Number(year) };
      COLS.forEach(i => { colPayload[`col${i}`] = colNames[`col${i}`] ?? ''; });
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
    // Exclude principal row from stats totals
    const records = await Investment.findAll({
      where: { year },
    });
    const monthRecords = records.filter(r => r.month !== 0);
    const colTotals    = COLS.map(i =>
      monthRecords.reduce((sum, r) => sum + Number(r[`investment${i}Amount`] || 0), 0)
    );
    const grandTotal = colTotals.reduce((a, b) => a + b, 0);
    return res.json({ year, grandTotal, colTotals });
  } catch (error) {
    console.error('Investment stats error:', error);
    return res.status(500).json({ message: 'Failed to fetch investment stats', error: error.message });
  }
};

module.exports = { getAllInvestments, saveInvestments, getInvestmentStats };