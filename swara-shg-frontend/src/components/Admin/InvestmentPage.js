import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { investmentAPI, loansAPI, finesAPI } from '../../Service/Api';
import { useIsStaff } from '../Protected Route/Protectedroute';

import Navbar from '../Navbar/navbar';
import { TrendingUp, Download, Printer, Save, CheckCircle, XCircle, Pencil, Lock, User, AlertCircle } from 'lucide-react';

// ── Month ordering (Principal first, then Dec → Nov) ─────────────────────────
const MONTHS = [
  { name: 'Principal', num: 0,  isPrincipal: true  },
  { name: 'December',  num: 12, isPrincipal: false },
  { name: 'January',   num: 1,  isPrincipal: false },
  { name: 'February',  num: 2,  isPrincipal: false },
  { name: 'March',     num: 3,  isPrincipal: false },
  { name: 'April',     num: 4,  isPrincipal: false },
  { name: 'May',       num: 5,  isPrincipal: false },
  { name: 'June',      num: 6,  isPrincipal: false },
  { name: 'July',      num: 7,  isPrincipal: false },
  { name: 'August',    num: 8,  isPrincipal: false },
  { name: 'September', num: 9,  isPrincipal: false },
  { name: 'October',   num: 10, isPrincipal: false },
  { name: 'November',  num: 11, isPrincipal: false },
];

const AUTO_COLS = [1, 2, 3];
const EDIT_COLS = [4, 5, 6, 7, 8, 9, 10];
const COLS      = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const FIXED_COL_NAMES = {
  col1: 'Loans',
  col2: 'Savings Fines',
  col3: 'Chamaa Fines',
};

const defaultEditColNames = () => {
  const c = {};
  EDIT_COLS.forEach(i => { c[`col${i}`] = ''; });
  return c;
};

const blankRow = ({ name, num, isPrincipal }) => {
  const row = {
    month:       num,
    monthName:   name,
    isPrincipal: isPrincipal || false,
    id:          null,
    notes:       '',
    editedBy:    '',
    editedAt:    null,
  };
  COLS.forEach(i => { row[`investment${i}Amount`] = ''; });
  return row;
};

const defaultRows = () => MONTHS.map(blankRow);

const getAdminDisplayName = () => {
  try {
    const keys = ['user', 'authUser', 'currentUser', 'loggedInUser'];
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.firstName || parsed?.lastName) {
        return `${parsed.firstName || ''} ${parsed.lastName || ''}`.trim();
      }
      if (parsed?.name)     return parsed.name;
      if (parsed?.fullName) return parsed.fullName;
      if (parsed?.username) return parsed.username;
      if (parsed?.email)    return parsed.email;
    }
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload?.firstName || payload?.lastName) {
        return `${payload.firstName || ''} ${payload.lastName || ''}`.trim();
      }
      if (payload?.name)  return payload.name;
      if (payload?.email) return payload.email;
    }
  } catch { /* ignore */ }
  return 'Admin';
};

// ─────────────────────────────────────────────────────────────────────────────
const InvestmentPage = () => {
  const isStaff = useIsStaff();

  const currentYear = new Date().getFullYear();
  const [year, setYear]                   = useState(currentYear);
  const [rows, setRows]                   = useState(defaultRows());
  const [editColNames, setEditColNames]   = useState(defaultEditColNames());
  const [editingColIdx, setEditingColIdx] = useState(null);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [toast, setToast]                 = useState(null);
  const [dirtyRows, setDirtyRows]         = useState(new Set());
  const [autoError, setAutoError]         = useState(false);

  const [autoData, setAutoData] = useState({
    byMonth:   {},
    principal: { loans: 0, savingsFines: 0, chamaaFines: 0 },
  });

  // ── Fetch auto-populated data (loans + fines) ─────────────────────────────
  const fetchAutoData = useCallback(async () => {
    setAutoError(false);
    try {
      // ── Loans: fetch all approved loans ────────────────────────────────
      // Use a fresh token on every call so a newly logged-in admin always
      // gets data (avoids stale auth from a previous session).
      const loansRes = await loansAPI.getAll({ _nocache: Date.now() });
      const allLoans = (loansRes.data.loans || []).filter(l => l.approvalStatus === 'approved');

      const principalLoansTotal = allLoans.reduce((sum, l) => sum + Number(l.amount || 0), 0);

      const loansByMonth = {};
      allLoans.forEach(loan => {
        if (!loan.disbursementDate) return;
        const d = new Date(loan.disbursementDate);
        if (d.getFullYear() !== year) return;
        const m = d.getMonth() + 1;
        loansByMonth[m] = (loansByMonth[m] || 0) + Number(loan.totalRepayment || 0);
      });

      // ── Fines: fetch ALL fines (not filtered by year) so the Principal
      //    row shows the all-time totals correctly ─────────────────────────
      const finesRes = await finesAPI.getAll({});
      const allFines = finesRes.data.fines || [];

      // For the monthly breakdown, only include fines for the selected year
      const savingsByMonth = {};
      const chamaaByMonth  = {};
      allFines.forEach(f => {
        if (Number(f.year) !== year) return;
        const m = Number(f.month);
        if (f.fineType === 'savings_late') {
          savingsByMonth[m] = (savingsByMonth[m] || 0) + Number(f.amount || 0);
        } else if (f.fineType === 'chamaa_late') {
          chamaaByMonth[m]  = (chamaaByMonth[m]  || 0) + Number(f.amount || 0);
        }
      });

      // For the Principal row: all-time totals across ALL years
      const principalSavingsFines = allFines
        .filter(f => f.fineType === 'savings_late')
        .reduce((s, f) => s + Number(f.amount || 0), 0);
      const principalChamaaFines = allFines
        .filter(f => f.fineType === 'chamaa_late')
        .reduce((s, f) => s + Number(f.amount || 0), 0);

      const byMonth = {};
      for (let m = 1; m <= 12; m++) {
        byMonth[m] = {
          loans:        loansByMonth[m]  || 0,
          savingsFines: savingsByMonth[m] || 0,
          chamaaFines:  chamaaByMonth[m]  || 0,
        };
      }

      setAutoData({
        byMonth,
        principal: {
          loans:        principalLoansTotal,
          savingsFines: principalSavingsFines,
          chamaaFines:  principalChamaaFines,
        },
      });
    } catch (err) {
      console.error('Failed to fetch auto data:', err);
      // Show a visible warning so admins know auto columns may be stale
      setAutoError(true);
    }
  }, [year]);

  // ── Fetch saved investment rows ───────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res     = await investmentAPI.getAll(year);
      const rawRows = res.data.rows || [];

      const sorted = MONTHS.map(m => {
        const saved = rawRows.find(r => r.month === m.num);
        const base  = blankRow(m);
        if (saved) {
          // Restore ALL 10 columns from DB — auto cols (1-3) are stored as 0
          // in the DB but displayed from autoData; edit cols (4-10) are the
          // values the admin actually typed. We restore both so the row
          // object is complete and any admin can see the edit cols correctly.
          COLS.forEach(i => {
            base[`investment${i}Amount`] = saved[`investment${i}Amount`] ?? '';
          });
          base.id       = saved.id       ?? null;
          base.notes    = saved.notes    ?? '';
          base.editedBy = saved.editedBy ?? '';
          base.editedAt = saved.editedAt ?? null;
        }
        return base;
      });

      setRows(sorted);
      setDirtyRows(new Set());

      const savedColNames = res.data.colNames || {};
      const restored      = defaultEditColNames();
      EDIT_COLS.forEach(i => { restored[`col${i}`] = savedColNames[`col${i}`] || ''; });
      setEditColNames(restored);
    } catch (err) {
      console.error('Failed to load investment data:', err);
      showToast('Failed to load investment data', 'error');
      setRows(defaultRows());
    } finally {
      setLoading(false);
    }
  }, [year]);

  // Run both fetches whenever year changes or component mounts.
  // They run in parallel — autoData and rows load independently so
  // neither blocks the other.
  useEffect(() => {
    fetchAutoData();
    fetchData();
  }, [fetchAutoData, fetchData]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCellChange = (month, field, value) => {
    setRows(prev => prev.map(r => r.month !== month ? r : { ...r, [field]: value }));
    setDirtyRows(prev => new Set(prev).add(month));
  };

  const handleEditColNameChange = (key, value) => {
    setEditColNames(prev => ({ ...prev, [key]: value }));
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const adminName = getAdminDisplayName();
      const now       = new Date().toISOString();

      const stampedRows = rows.map(r => {
        if (dirtyRows.has(r.month)) {
          return { ...r, editedBy: adminName, editedAt: now };
        }
        return r;
      });

      const colNames = { ...FIXED_COL_NAMES, ...editColNames };
      await investmentAPI.save({ year, rows: stampedRows, colNames });

      showToast('Investments saved successfully');
      await fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const colLabel = (i) => {
    if (AUTO_COLS.includes(i)) return FIXED_COL_NAMES[`col${i}`];
    return editColNames[`col${i}`] || `Investment ${i}`;
  };

  const autoValue = (row, col) => {
    if (row.isPrincipal) {
      if (col === 1) return autoData.principal.loans        || 0;
      if (col === 2) return autoData.principal.savingsFines || 0;
      if (col === 3) return autoData.principal.chamaaFines  || 0;
      return 0;
    }
    const src = autoData.byMonth[row.month] || {};
    if (col === 1) return src.loans        || 0;
    if (col === 2) return src.savingsFines || 0;
    if (col === 3) return src.chamaaFines  || 0;
    return 0;
  };

  const rowTotal = (row) => {
    const autoSum = AUTO_COLS.reduce((s, i) => s + autoValue(row, i), 0);
    const editSum = EDIT_COLS.reduce((s, i) => s + (Number(row[`investment${i}Amount`]) || 0), 0);
    return autoSum + editSum;
  };

  const colTotals = COLS.map(i => {
    const monthRows = rows.filter(r => !r.isPrincipal);
    if (AUTO_COLS.includes(i)) {
      return monthRows.reduce((sum, r) => sum + autoValue(r, i), 0);
    }
    return monthRows.reduce((sum, r) => sum + (Number(r[`investment${i}Amount`]) || 0), 0);
  });
  const grandTotal = colTotals.reduce((a, b) => a + b, 0);

  const fmtKES = (v) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(v || 0);
  const fmtNum = (v) =>
    new Intl.NumberFormat('en-KE', { minimumFractionDigits: 0 }).format(v || 0);

  const yearOptions = [];
  for (let y = currentYear; y >= 2020; y--) yearOptions.push(y);

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Month', ...COLS.map(i => colLabel(i)), 'Edited By', 'Row Total'];
    const csvRows = rows.map(r => [
      r.monthName,
      ...COLS.map(i => AUTO_COLS.includes(i) ? autoValue(r, i) : (r[`investment${i}Amount`] || 0)),
      r.editedBy || '—',
      rowTotal(r),
    ]);
    csvRows.push(['TOTAL', ...colTotals, '', grandTotal]);
    const csv  = [headers, ...csvRows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `investments_${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Export PDF ────────────────────────────────────────────────────────────
  const exportPDF = () => {
    const win        = window.open('', '_blank');
    const theadCells = `<th>Month</th>${COLS.map(i => `<th>${colLabel(i)}</th>`).join('')}<th>Edited By</th><th>Total</th>`;
    const tbodyRows  = rows.map((r, ri) => `
      <tr style="background:${r.isPrincipal ? '#f3e5f5' : ri % 2 === 0 ? 'white' : '#f9f9f9'}${r.isPrincipal ? ';font-weight:700' : ''}">
        <td style="font-weight:600;text-align:left">${r.monthName}</td>
        ${COLS.map(i => {
          const val   = AUTO_COLS.includes(i) ? autoValue(r, i) : (Number(r[`investment${i}Amount`]) || 0);
          const color = AUTO_COLS.includes(i) ? '#1565c0' : '#7b1fa2';
          return `<td style="color:${color};font-weight:600">${fmtNum(val)}</td>`;
        }).join('')}
        <td style="color:#555;font-size:9px;font-style:italic">${r.editedBy || '—'}</td>
        <td style="font-weight:700">${fmtNum(rowTotal(r))}</td>
      </tr>`).join('');
    const totalRow = `
      <tr style="background:#1a1a2e;color:white;font-weight:bold">
        <td>TOTALS</td>
        ${colTotals.map(t => `<td>${fmtNum(t)}</td>`).join('')}
        <td></td>
        <td>${fmtNum(grandTotal)}</td>
      </tr>`;
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Investments ${year}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:10px;margin:20px;color:#1a1a2e}
        h1{font-size:16px;margin-bottom:4px}
        table{width:100%;border-collapse:collapse}
        th{background:#1a1a2e;color:white;padding:6px 6px;text-align:center;font-size:9px}
        td{padding:5px 6px;border-bottom:1px solid #e0e0e0;text-align:center}
        @media print{@page{size:landscape}}
      </style>
    </head><body>
      <h1>Investment Records — ${year}</h1>
      <p style="color:#666;margin:0 0 14px">Generated: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})} · Grand Total: ${fmtNum(grandTotal)}</p>
      <table><thead><tr>${theadCells}</tr></thead><tbody>${tbodyRows}${totalRow}</tbody></table>
      <script>window.onload=()=>{window.print();}<script>
    </body></html>`);
    win.document.close();
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const amtSt = {
    width: '100%', padding: '5px 6px', border: '1px solid #ddd',
    borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box', textAlign: 'right',
  };
  const principalAmtSt = {
    ...amtSt,
    border: '1px solid #ce93d8',
    background: '#fdf6ff',
  };
  const rowBg = (row, idx) =>
    row.isPrincipal ? '#f3e5f5' : idx % 2 === 0 ? 'white' : '#fafafa';

  // ── Edited-By cell renderer ───────────────────────────────────────────────
  const renderEditedByCell = (row) => {
    const isDirtyRow = dirtyRows.has(row.month);
    const name       = row.editedBy;
    const ts         = row.editedAt
      ? new Date(row.editedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
      : null;

    const cellBase = {
      padding: '6px 8px',
      textAlign: 'center',
      background: row.isPrincipal ? '#f3e5f5' : 'transparent',
    };

    if (isDirtyRow && !saving) {
      return (
        <td style={cellBase}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', color: '#f57c00', fontStyle: 'italic' }}>
            <Pencil size={10} /> unsaved
          </span>
        </td>
      );
    }

    if (!name) {
      return <td style={{ ...cellBase, color: '#ccc', fontSize: '12px' }}>—</td>;
    }

    return (
      <td style={cellBase}>
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: '11px', fontWeight: 600, color: '#7b1fa2',
            background: '#f3e5f5', borderRadius: '12px',
            padding: '2px 8px', whiteSpace: 'nowrap',
          }}>
            <User size={9} /> {name}
          </span>
          {ts && <span style={{ fontSize: '9px', color: '#aaa', whiteSpace: 'nowrap' }}>{ts}</span>}
        </div>
      </td>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>
      <Navbar />
      <div style={{ padding: '24px', fontFamily: 'sans-serif' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <Link to="/admin/dashboard" style={{ color: '#1976d2', textDecoration: 'none', fontSize: '14px' }}>← Dashboard</Link>
            <h1 style={{ margin: '6px 0 0', fontSize: '24px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={24} /> Investment Records
            </h1>
            <p style={{ margin: '4px 0 0', color: '#666' }}>Track monthly investments for {year}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={exportCSV} style={{ padding: '8px 16px', background: '#388e3c', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Download size={14} /> CSV
            </button>
            <button onClick={exportPDF} style={{ padding: '8px 16px', background: '#c62828', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Printer size={14} /> PDF
            </button>
            {!isStaff && (
              <button
                onClick={handleSave}
                disabled={saving || dirtyRows.size === 0}
                style={{
                  padding: '8px 20px',
                  background: dirtyRows.size > 0 ? '#7b1fa2' : '#9e9e9e',
                  color: 'white', border: 'none', borderRadius: '8px',
                  cursor: (saving || dirtyRows.size === 0) ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: '14px',
                  opacity: saving ? 0.7 : 1,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  transition: 'background 0.2s',
                }}
              >
                <Save size={14} /> {saving ? 'Saving…' : `Save${dirtyRows.size > 0 ? ` (${dirtyRows.size})` : ''}`}
              </button>
            )}
          </div>
        </div>

        {/* Auto-data error warning */}
        {autoError && (
          <div style={{
            marginBottom: '16px', padding: '12px 16px', borderRadius: '8px',
            background: '#fff8e1', border: '1px solid #ffc107',
            display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#e65100',
          }}>
            <AlertCircle size={16} />
            <span>
              Could not load auto-populated data (Loans, Savings Fines, Chamaa Fines).
              Columns 1–3 may show — until data loads.
            </span>
            <button
              onClick={fetchAutoData}
              style={{ marginLeft: 'auto', padding: '4px 12px', background: '#e65100', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>Loading…</div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e0e0e0', background: 'white' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                {/* Auto-col indicator row */}
                <tr style={{ background: '#1565c0' }}>
                  <th style={{ padding: '4px 14px', background: '#1a1a2e', position: 'sticky', left: 0, zIndex: 2 }} />
                  {COLS.map(i => (
                    <th key={i} style={{
                      padding: '4px 8px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em',
                      color: AUTO_COLS.includes(i) ? '#ffffff' : 'transparent',
                      background: AUTO_COLS.includes(i) ? '#1565c0' : '#1a1a2e',
                      textAlign: 'center',
                    }}>
                      {AUTO_COLS.includes(i)
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Lock size={9} /> AUTO</span>
                        : ''}
                    </th>
                  ))}
                  <th style={{ background: '#1a1a2e', padding: '4px 8px', fontSize: '10px', color: 'transparent' }}>—</th>
                  <th style={{ background: '#1a1a2e', padding: '4px' }} />
                </tr>

                {/* Main header row */}
                <tr style={{ background: '#1a1a2e' }}>
                  <th style={{ padding: '12px 14px', color: 'white', textAlign: 'left', fontWeight: 600, minWidth: '110px', position: 'sticky', left: 0, background: '#1a1a2e', zIndex: 2 }}>
                    Month
                  </th>
                  {COLS.map(i => {
                    const isAuto = AUTO_COLS.includes(i);
                    return (
                      <th key={i} style={{ padding: '12px 8px', color: 'white', textAlign: 'center', fontWeight: 600, minWidth: '120px', background: isAuto ? '#1e3a5f' : '#1a1a2e' }}>
                        {isAuto ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '12px' }}>
                            <Lock size={11} style={{ opacity: 0.7 }} />
                            {FIXED_COL_NAMES[`col${i}`]}
                          </span>
                        ) : (
                          !isStaff && editingColIdx === i ? (
                            <input
                              autoFocus
                              value={editColNames[`col${i}`]}
                              onChange={e => handleEditColNameChange(`col${i}`, e.target.value)}
                              onBlur={() => setEditingColIdx(null)}
                              onKeyDown={e => e.key === 'Enter' && setEditingColIdx(null)}
                              style={{ background: 'transparent', border: 'none', borderBottom: '2px solid white', color: 'white', fontSize: '12px', width: '100px', outline: 'none', textAlign: 'center' }}
                              placeholder={`Investment ${i}`}
                            />
                          ) : (
                            <span
                              onClick={() => !isStaff && setEditingColIdx(i)}
                              style={{ cursor: isStaff ? 'default' : 'pointer', borderBottom: isStaff ? 'none' : '1px dashed rgba(255,255,255,0.4)', paddingBottom: '2px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              title={isStaff ? '' : 'Click to rename'}
                            >
                              {colLabel(i)}{!isStaff && <Pencil size={10} style={{ opacity: 0.7 }} />}
                            </span>
                          )
                        )}
                      </th>
                    );
                  })}
                  <th style={{ padding: '12px 10px', color: '#ce93d8', textAlign: 'center', fontWeight: 600, minWidth: '100px', background: '#1a1a2e', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <User size={12} style={{ opacity: 0.8 }} /> Edited By
                    </span>
                  </th>
                  <th style={{ padding: '12px 14px', color: 'white', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, idx) => {
                  const rt = rowTotal(row);
                  const bg = rowBg(row, idx);
                  return (
                    <tr key={`${row.month}-${idx}`} style={{ background: bg, borderBottom: '1px solid #f0f0f0' }}>
                      {/* Month label */}
                      <td style={{
                        padding: '10px 14px', fontWeight: row.isPrincipal ? 800 : 600,
                        color: row.isPrincipal ? '#7b1fa2' : '#1a1a2e', whiteSpace: 'nowrap',
                        position: 'sticky', left: 0, background: bg, zIndex: 1,
                        borderRight: '2px solid #e0e0e0',
                        fontStyle: row.isPrincipal ? 'italic' : 'normal',
                        letterSpacing: row.isPrincipal ? '0.02em' : 'normal',
                      }}>
                        {row.isPrincipal && (
                          <span style={{ fontSize: '10px', display: 'block', color: '#9c27b0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>
                            All-time
                          </span>
                        )}
                        {row.monthName}
                      </td>

                      {/* Columns */}
                      {COLS.map(i => {
                        const isAuto   = AUTO_COLS.includes(i);
                        const fieldKey = `investment${i}Amount`;
                        const fieldVal = row[fieldKey];

                        if (isAuto) {
                          const val = autoValue(row, i);
                          return (
                            <td key={i} style={{ padding: '6px 8px', background: row.isPrincipal ? '#ede7f6' : '#f0f7ff', borderRight: '1px solid #bbdefb' }}>
                              <span style={{ display: 'block', textAlign: 'right', color: val > 0 ? '#1565c0' : '#bbb', fontWeight: val > 0 ? 700 : 400, fontSize: '13px' }}>
                                {val > 0 ? fmtKES(val) : '—'}
                              </span>
                            </td>
                          );
                        }

                        return (
                          <td key={i} style={{ padding: '6px 8px', background: row.isPrincipal ? '#f3e5f5' : 'transparent' }}>
                            {isStaff ? (
                              <span style={{ display: 'block', textAlign: 'right', color: fieldVal ? '#7b1fa2' : '#bbb', fontWeight: 600, fontSize: '13px' }}>
                                {fieldVal ? fmtKES(Number(fieldVal)) : '—'}
                              </span>
                            ) : saving ? (
                              <span style={{ display: 'block', textAlign: 'right', color: '#bbb', fontWeight: 600, fontSize: '13px' }}>
                                {fieldVal ? fmtKES(Number(fieldVal)) : '—'}
                              </span>
                            ) : (
                              <input
                                type="number" min="0"
                                value={fieldVal}
                                onChange={e => handleCellChange(row.month, fieldKey, e.target.value)}
                                placeholder="0"
                                style={row.isPrincipal ? principalAmtSt : amtSt}
                              />
                            )}
                          </td>
                        );
                      })}

                      {renderEditedByCell(row)}

                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: rt > 0 ? (row.isPrincipal ? '#7b1fa2' : '#1a1a2e') : '#bbb', whiteSpace: 'nowrap' }}>
                        {rt > 0 ? fmtKES(rt) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr style={{ background: '#1a1a2e', color: 'white', fontWeight: 700 }}>
                  <td style={{ padding: '12px 14px', position: 'sticky', left: 0, background: '#1a1a2e' }}>TOTALS</td>
                  {colTotals.map((t, i) => (
                    <td key={i} style={{ padding: '12px 8px', textAlign: 'right', color: AUTO_COLS.includes(i + 1) ? '#90caf9' : '#ce93d8' }}>
                      {fmtNum(t)}
                    </td>
                  ))}
                  <td style={{ padding: '12px 8px' }} />
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: '#ce93d8' }}>{fmtNum(grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
          padding: '14px 20px', borderRadius: '8px', fontWeight: 600, fontSize: '14px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          background: toast.type === 'error' ? '#c62828' : '#2e7d32',
          color: 'white', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {toast.type === 'error' ? <XCircle size={16} /> : <CheckCircle size={16} />} {toast.msg}
        </div>
      )}
    </div>
  );
};

export default InvestmentPage;