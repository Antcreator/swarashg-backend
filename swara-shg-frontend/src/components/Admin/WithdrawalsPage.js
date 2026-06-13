import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../Navbar/navbar';
import {
  ArrowLeft, TrendingDown,
  Download, Printer, RotateCcw, Save, AlertCircle,
} from 'lucide-react';
import './Withdrawals.css';
import api from '../../Service/Api';

const TOTAL_ROWS = 150;

const emptyRow = (rowNumber) => ({
  rowNumber, date: '', narrative: '',
  loan: '', chamaa: '', expense: '', investment: '', others: '',
});

const initRows = () => Array.from({ length: TOTAL_ROWS }, (_, i) => emptyRow(i + 1));

const fmt = (n) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n || 0);

const parseAmt = (v) => {
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
};

const rowTotal = (r) =>
  parseAmt(r.loan) + parseAmt(r.chamaa) + parseAmt(r.expense) + parseAmt(r.investment) + parseAmt(r.others);

const getYear = (dateStr) => {
  if (!dateStr) return null;
  const y = parseInt(dateStr.slice(0, 4), 10);
  return isNaN(y) ? null : y;
};

const WithdrawalsPage = () => {
  const [rows, setRows]               = useState(initRows);
  const [loading, setLoading]         = useState(true);
  const [saveFlash, setSaveFlash]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [dirty, setDirty]             = useState(false);
  const [saveError, setSaveError]     = useState('');
  const [filter, setFilter]           = useState('all');
  const [search, setSearch]           = useState('');
  const [yearFilter, setYearFilter]   = useState('all');

  // Track which row indices have changed since last save
  const dirtyRows = useRef(new Set());
  const saveTimer = useRef(null);

  // ── Load from API on mount ────────────────────────────────────
  useEffect(() => {
    const fetchWithdrawals = async () => {
      try {
        setLoading(true);
        const res  = await api.get('/withdrawals');
        const data = res.data.rows || [];
        // Merge API data into our 150-row grid
        setRows(prev => prev.map((emptyR, i) => {
          const apiRow = data[i];
          if (!apiRow) return emptyR;
          return {
            rowNumber:  apiRow.rowNumber ?? i + 1,
            date:       apiRow.date       ?? '',
            narrative:  apiRow.narrative  ?? '',
            loan:       apiRow.loan       !== null && apiRow.loan       !== undefined && apiRow.loan       !== '' ? String(apiRow.loan)       : '',
            chamaa:     apiRow.chamaa     !== null && apiRow.chamaa     !== undefined && apiRow.chamaa     !== '' ? String(apiRow.chamaa)     : '',
            expense:    apiRow.expense    !== null && apiRow.expense    !== undefined && apiRow.expense    !== '' ? String(apiRow.expense)    : '',
            investment: apiRow.investment !== null && apiRow.investment !== undefined && apiRow.investment !== '' ? String(apiRow.investment) : '',
            others:     apiRow.others     !== null && apiRow.others     !== undefined && apiRow.others     !== '' ? String(apiRow.others)     : '',
          };
        }));
      } catch (err) {
        console.error('Failed to load withdrawals:', err);
        setSaveError('Could not load withdrawals from server.');
      } finally {
        setLoading(false);
      }
    };
    fetchWithdrawals();
  }, []);

  // ── Auto-save 1.5s after last keystroke ──────────────────────
  useEffect(() => {
    if (loading) return; // don't auto-save during initial load
    setDirty(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      handleSave(false); // silent save
    }, 1500);
    return () => clearTimeout(saveTimer.current);
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save only dirty rows to API ───────────────────────────────
  const handleSave = useCallback(async (showFlash = true) => {
    if (dirtyRows.current.size === 0 && showFlash) {
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 1400);
      return;
    }

    setSaving(true);
    setSaveError('');

    try {
      // Only send rows that have changed
      const rowsToSave = rows.filter((_, i) => dirtyRows.current.has(i));

      if (rowsToSave.length > 0) {
        await api.post('/withdrawals/save', { rows: rowsToSave });
      }

      dirtyRows.current.clear();
      setDirty(false);

      if (showFlash) {
        setSaveFlash(true);
        setTimeout(() => setSaveFlash(false), 1400);
      }
    } catch (err) {
      console.error('Save failed:', err);
      setSaveError(err.response?.data?.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [rows]);

  const updateCell = useCallback((rowIdx, field, value) => {
    dirtyRows.current.add(rowIdx);
    setRows(prev => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [field]: value };
      return next;
    });
  }, []);

  const clearAll = async () => {
    if (!window.confirm('Clear all 150 rows? This cannot be undone.')) return;
    try {
      await api.delete('/withdrawals/clear');
      setRows(initRows());
      dirtyRows.current.clear();
      setDirty(false);
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 1400);
    } catch (err) {
      setSaveError('Failed to clear withdrawals.');
    }
  };

  // ── Derived values ────────────────────────────────────────────
  const availableYears = React.useMemo(() => {
    const years = new Set();
    rows.forEach(r => { const y = getYear(r.date); if (y) years.add(y); });
    return [...years].sort((a, b) => b - a);
  }, [rows]);

  const rowsForYear = React.useMemo(() =>
    yearFilter === 'all' ? rows : rows.filter(r => getYear(r.date) === Number(yearFilter)),
  [rows, yearFilter]);

  const filledRows  = rows.filter(r => r.date || r.narrative || r.loan || r.chamaa || r.expense || r.investment || r.others);
  const filledCount = filledRows.length;

  const colTotals = {
    loan:       rowsForYear.reduce((s, r) => s + parseAmt(r.loan),       0),
    chamaa:     rowsForYear.reduce((s, r) => s + parseAmt(r.chamaa),     0),
    expense:    rowsForYear.reduce((s, r) => s + parseAmt(r.expense),    0),
    investment: rowsForYear.reduce((s, r) => s + parseAmt(r.investment), 0),
    others:     rowsForYear.reduce((s, r) => s + parseAmt(r.others),     0),
  };
  const grandTotal = Object.values(colTotals).reduce((s, v) => s + v, 0);

  const visibleRows = rows.map((r, i) => ({ ...r, _idx: i })).filter(r => {
    if (yearFilter !== 'all' && getYear(r.date) !== Number(yearFilter)) return false;
    const hasContent = r.date || r.narrative || r.loan || r.chamaa || r.expense || r.investment || r.others;
    if (filter === 'filled' && !hasContent) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.narrative?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const visibleFilledCount = visibleRows.filter(r =>
    r.date || r.narrative || r.loan || r.chamaa || r.expense || r.investment || r.others
  ).length;

  // ── Export CSV ────────────────────────────────────────────────
  const exportCSV = () => {
    const header   = ['#', 'Date', 'Narrative', 'Loan (KES)', 'Chamaa (KES)', 'Expense (KES)', 'Investment (KES)', 'Others (KES)', 'Total (KES)'];
    const dataRows = rowsForYear
      .map((r, i) => [
        i + 1, r.date,
        `"${(r.narrative || '').replace(/"/g, '""')}"`,
        parseAmt(r.loan)       || '',
        parseAmt(r.chamaa)     || '',
        parseAmt(r.expense)    || '',
        parseAmt(r.investment) || '',
        parseAmt(r.others)     || '',
        rowTotal(r)            || '',
      ])
      .filter(r => r[1] || r[2] || r[3] || r[4] || r[5] || r[6] || r[7]);
    dataRows.push(['', '', 'TOTALS',
      colTotals.loan, colTotals.chamaa, colTotals.expense,
      colTotals.investment, colTotals.others, grandTotal]);
    const csv  = [header, ...dataRows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const filename = yearFilter === 'all' ? 'withdrawals.csv' : `withdrawals_${yearFilter}.csv`;
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Print ─────────────────────────────────────────────────────
  const printTable = () => {
    const win = window.open('', '_blank');
    const pr  = rowsForYear.map((r, i) => ({ ...r, _num: i + 1 }))
                    .filter(r => r.date || r.narrative || r.loan || r.chamaa || r.expense || r.investment || r.others);
    const yearLabel = yearFilter === 'all' ? 'All Years' : yearFilter;
    win.document.write(`<!DOCTYPE html><html><head><title>Withdrawals</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:10px;margin:20px;color:#1a1a2e}
        h1{font-size:16px;margin-bottom:4px}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th{background:#1a1a2e;color:white;padding:7px 8px;text-align:left;font-size:9px}
        td{padding:5px 8px;border-bottom:1px solid #e0e0e0;font-size:9px}
        tr:nth-child(even){background:#f9f9f9}
        .foot{background:#1a1a2e;color:white;font-weight:bold}
        .num{text-align:right}
        @media print{@page{size:landscape}body{margin:8px}}
      </style></head><body>
      <h1>Swara SHG — Withdrawals Register (${yearLabel})</h1>
      <p style="color:#666;margin:0 0 4px">Generated: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})} · ${pr.length} entries · Grand Total: ${fmt(grandTotal)}</p>
      <table><thead><tr>
        <th>#</th><th>Date</th><th>Narrative</th>
        <th class="num">Loan</th><th class="num">Chamaa</th><th class="num">Expense</th>
        <th class="num">Investment</th><th class="num">Others</th><th class="num">Total</th>
      </tr></thead><tbody>
      ${pr.map(r => `<tr>
        <td>${r._num}</td><td>${r.date||'—'}</td><td>${r.narrative||'—'}</td>
        <td class="num">${r.loan?fmt(parseAmt(r.loan)):'—'}</td>
        <td class="num">${r.chamaa?fmt(parseAmt(r.chamaa)):'—'}</td>
        <td class="num">${r.expense?fmt(parseAmt(r.expense)):'—'}</td>
        <td class="num">${r.investment?fmt(parseAmt(r.investment)):'—'}</td>
        <td class="num">${r.others?fmt(parseAmt(r.others)):'—'}</td>
        <td class="num" style="font-weight:700">${rowTotal(r)?fmt(rowTotal(r)):'—'}</td>
      </tr>`).join('')}
      </tbody><tfoot>
        <tr class="foot">
          <td colspan="3">TOTALS (${pr.length} entries)</td>
          <td class="num">${fmt(colTotals.loan)}</td>
          <td class="num">${fmt(colTotals.chamaa)}</td>
          <td class="num">${fmt(colTotals.expense)}</td>
          <td class="num">${fmt(colTotals.investment)}</td>
          <td class="num">${fmt(colTotals.others)}</td>
          <td class="num">${fmt(grandTotal)}</td>
        </tr>
      </tfoot></table>
      <script>window.onload=()=>{window.print()}<script></body></html>`);
    win.document.close();
  };

  const filterTabs = [
    { key: 'all',    label: 'All Rows' },
    { key: 'filled', label: `Filled (${filledCount})` },
  ];

  if (loading) return (
    <>
      <Navbar />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:'16px' }}>
        <div style={{ width:'32px', height:'32px', border:'3px solid #e2e8f0', borderTop:'3px solid #1a1a2e', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <p style={{ color:'#94a3b8', fontSize:'14px' }}>Loading withdrawals…</p>
      </div>
    </>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Navbar />

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 20px', fontFamily: 'sans-serif' }}>

        <div style={{ marginBottom: '8px' }}>
          <Link to="/admin/dashboard" style={{ color: '#1976d2', textDecoration: 'none', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ArrowLeft size={14} /> Dashboard
          </Link>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingDown size={26} color="#be123c" /> Withdrawals
            </h1>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
              {filledCount} of {TOTAL_ROWS} rows filled
              {saving && <span style={{ marginLeft:10, color:'#d97706', fontSize:'12px' }}>saving…</span>}
              {saveFlash && !saving && <span style={{ marginLeft:10, color:'#15803d', fontWeight:700, fontSize:'12px' }}>✓ Saved to server</span>}
              {dirty && !saving && !saveFlash && <span style={{ marginLeft:10, color:'#d97706', fontSize:'12px' }}>unsaved changes…</span>}
            </p>
            {/* Data persisted notice */}
            <p style={{ margin:'2px 0 0', color:'#15803d', fontSize:'11px', display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'#15803d', display:'inline-block' }} />
              Data saved to server — visible to all admins across devices
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              style={{
                position: 'relative', padding: '8px 18px',
                background: dirty ? '#1a1a2e' : '#64748b',
                color: 'white', border: 'none', borderRadius: '8px',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: '13px',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                opacity: saving ? 0.7 : 1,
                transition: 'all 0.2s',
              }}
            >
              <Save size={14} />
              {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
              {dirty && !saving && (
                <span style={{ position:'absolute', top:-4, right:-4, width:9, height:9, borderRadius:'50%', background:'#f59e0b', border:'2px solid white' }} />
              )}
            </button>
            <button onClick={exportCSV}  style={btnStyle('#15803d')}><Download size={13} /> CSV</button>
            <button onClick={printTable} style={btnStyle('#1d4ed8')}><Printer  size={13} /> Print</button>
            <button onClick={clearAll}   style={btnStyle('#be123c')}><RotateCcw size={13} /> Clear All</button>
          </div>
        </div>

        {/* Error banner */}
        {saveError && (
          <div style={{ marginBottom:'16px', padding:'10px 16px', background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'8px', display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', color:'#c62828' }}>
            <AlertCircle size={15} />
            {saveError}
            <button onClick={() => setSaveError('')} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'#c62828', fontWeight:700 }}>✕</button>
          </div>
        )}

        {/* Year filter */}
        <div style={{ background:'white', borderRadius:'12px', border:'1px solid #e2e8f0', padding:'14px 18px', marginBottom:'14px', display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
          <span style={{ fontSize:'12px', fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>Year</span>
          <button onClick={() => setYearFilter('all')} style={{ padding:'5px 14px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:600, background: yearFilter === 'all' ? '#1a1a2e' : '#e2e8f0', color: yearFilter === 'all' ? 'white' : '#475569', transition:'all 0.15s' }}>
            All Years
          </button>
          {availableYears.length === 0 && <span style={{ fontSize:'12px', color:'#94a3b8', fontStyle:'italic' }}>No dated entries yet</span>}
          {availableYears.map(y => (
            <button key={y} onClick={() => setYearFilter(String(y))} style={{ padding:'5px 14px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:600, background: yearFilter === String(y) ? '#1d4ed8' : '#e2e8f0', color: yearFilter === String(y) ? 'white' : '#475569', transition:'all 0.15s' }}>
              {y}
            </button>
          ))}
          {yearFilter !== 'all' && grandTotal > 0 && (
            <div style={{ marginLeft:'auto', display:'flex', gap:'16px', flexWrap:'wrap' }}>
              {[
                { label:'Loan',       value:colTotals.loan,       color:'#1d4ed8' },
                { label:'Chamaa',     value:colTotals.chamaa,     color:'#15803d' },
                { label:'Expense',    value:colTotals.expense,    color:'#be123c' },
                { label:'Investment', value:colTotals.investment, color:'#a16207' },
                { label:'Others',     value:colTotals.others,     color:'#475569' },
              ].filter(c => c.value > 0).map(c => (
                <div key={c.label} style={{ textAlign:'right' }}>
                  <div style={{ fontSize:'10px', color:'#94a3b8', fontWeight:600, textTransform:'uppercase' }}>{c.label}</div>
                  <div style={{ fontSize:'13px', fontWeight:800, color:c.color }}>{fmt(c.value)}</div>
                </div>
              ))}
              <div style={{ textAlign:'right', borderLeft:'2px solid #e2e8f0', paddingLeft:'16px' }}>
                <div style={{ fontSize:'10px', color:'#94a3b8', fontWeight:600, textTransform:'uppercase' }}>Total {yearFilter}</div>
                <div style={{ fontSize:'15px', fontWeight:800, color:'#1a1a2e' }}>{fmt(grandTotal)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Filter tabs + search */}
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'16px', alignItems:'center' }}>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            {filterTabs.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding:'6px 14px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:600, background: filter === f.key ? '#1a1a2e' : '#e2e8f0', color: filter === f.key ? 'white' : '#475569', transition:'all 0.15s' }}>
                {f.label}
              </button>
            ))}
          </div>
          <input placeholder="Search narrative…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ marginLeft:'auto', padding:'7px 14px', borderRadius:'8px', border:'1.5px solid #e2e8f0', fontSize:'13px', width:'230px', outline:'none', background:'white' }} />
        </div>

        {/* Table */}
        <div style={{ background:'white', borderRadius:'14px', border:'1px solid #e2e8f0', boxShadow:'0 2px 16px rgba(0,0,0,0.07)', overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table className="wd-table" style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px', minWidth:'900px' }}>
              <thead>
                <tr style={{ background:'#1a1a2e' }}>
                  <th style={thStyle('48px')}>#</th>
                  <th style={thStyle('120px')}>Date</th>
                  <th style={thStyle()}>Narrative</th>
                  <th style={thStyle('110px','right')}>Loan</th>
                  <th style={thStyle('110px','right')}>Chamaa</th>
                  <th style={thStyle('110px','right')}>Expense</th>
                  <th style={thStyle('120px','right')}>Investment</th>
                  <th style={thStyle('110px','right')}>Others</th>
                  <th style={{ ...thStyle('120px','right'), background:'#111827' }}>Totals</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, viewIdx) => {
                  const ri    = row._idx;
                  const isEven = viewIdx % 2 === 0;
                  const total  = rowTotal(row);
                  return (
                    <tr key={ri} style={{ background: isEven ? 'white' : '#fafafa', borderBottom:'1px solid #f0f0f0' }}>
                      <td style={{ padding:'4px 8px', textAlign:'center', color:'#94a3b8', fontSize:'11px', fontWeight:600, userSelect:'none' }}>
                        {ri + 1}
                      </td>
                      <td style={{ padding:'3px 6px' }}>
                        <input type="date" value={row.date} onChange={e => updateCell(ri, 'date', e.target.value)} style={cellInputStyle()} />
                      </td>
                      <td style={{ padding:'3px 6px' }}>
                        <input type="text" value={row.narrative} onChange={e => updateCell(ri, 'narrative', e.target.value)} placeholder="Enter narrative…" style={{ ...cellInputStyle(), width:'100%' }} />
                      </td>
                      <td style={{ padding:'3px 6px' }}>
                        <input type="number" value={row.loan} onChange={e => updateCell(ri, 'loan', e.target.value)} placeholder="0" min="0" step="1"
                          style={{ ...cellInputStyle('right'), color: row.loan ? '#1d4ed8' : '#94a3b8', fontWeight: row.loan ? 700 : 400 }} />
                      </td>
                      <td style={{ padding:'3px 6px' }}>
                        <input type="number" value={row.chamaa} onChange={e => updateCell(ri, 'chamaa', e.target.value)} placeholder="0" min="0" step="1"
                          style={{ ...cellInputStyle('right'), color: row.chamaa ? '#15803d' : '#94a3b8', fontWeight: row.chamaa ? 700 : 400 }} />
                      </td>
                      <td style={{ padding:'3px 6px' }}>
                        <input type="number" value={row.expense} onChange={e => updateCell(ri, 'expense', e.target.value)} placeholder="0" min="0" step="1"
                          style={{ ...cellInputStyle('right'), color: row.expense ? '#be123c' : '#94a3b8', fontWeight: row.expense ? 700 : 400 }} />
                      </td>
                      <td style={{ padding:'3px 6px' }}>
                        <input type="number" value={row.investment} onChange={e => updateCell(ri, 'investment', e.target.value)} placeholder="0" min="0" step="1"
                          style={{ ...cellInputStyle('right'), color: row.investment ? '#a16207' : '#94a3b8', fontWeight: row.investment ? 700 : 400 }} />
                      </td>
                      <td style={{ padding:'3px 6px' }}>
                        <input type="number" value={row.others} onChange={e => updateCell(ri, 'others', e.target.value)} placeholder="0" min="0" step="1"
                          style={{ ...cellInputStyle('right'), color: row.others ? '#475569' : '#94a3b8', fontWeight: row.others ? 700 : 400 }} />
                      </td>
                      <td style={{ padding:'4px 10px', textAlign:'right', fontWeight:800, fontSize:'12px', color: total ? '#1a1a2e' : '#d1d5db', background: total ? '#f8fafc' : 'transparent', borderLeft:'2px solid #e2e8f0' }}>
                        {total ? fmt(total) : '—'}
                      </td>
                    </tr>
                  );
                })}
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign:'center', padding:'48px', color:'#94a3b8' }}>
                      {yearFilter !== 'all' ? `No entries found for ${yearFilter}.` : 'No rows match your filter or search.'}
                    </td>
                  </tr>
                )}
              </tbody>
              {grandTotal > 0 && (
                <tfoot>
                  <tr style={{ background:'#1a1a2e' }}>
                    <td colSpan={3} style={{ padding:'12px 12px', fontWeight:700, fontSize:'12px', color:'#f8fafc', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                      {yearFilter === 'all' ? `Column Totals (${filledCount} entries)` : `Totals for ${yearFilter} (${visibleFilledCount} entries)`}
                    </td>
                    <td style={tfootNumStyle('#93c5fd')}>{fmt(colTotals.loan)}</td>
                    <td style={tfootNumStyle('#86efac')}>{fmt(colTotals.chamaa)}</td>
                    <td style={tfootNumStyle('#fda4af')}>{fmt(colTotals.expense)}</td>
                    <td style={tfootNumStyle('#fde047')}>{fmt(colTotals.investment)}</td>
                    <td style={tfootNumStyle('#cbd5e1')}>{fmt(colTotals.others)}</td>
                    <td style={{ ...tfootNumStyle('#fbbf24'), fontSize:'15px', background:'#111827' }}>{fmt(grandTotal)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <p style={{ textAlign:'center', fontSize:'11px', color:'#94a3b8', marginTop:'12px' }}>
          Auto-saves 1.5s after your last edit. Hit <strong>Save</strong> to save immediately.
          Data is stored on the server and shared across all admin accounts.
        </p>
      </div>
    </div>
  );
};

const thStyle = (width, align = 'left') => ({
  padding:'12px 10px', color:'white', fontWeight:700,
  fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.06em',
  textAlign:align, whiteSpace:'nowrap',
  ...(width ? { width, minWidth:width } : {}),
});

const cellInputStyle = (textAlign = 'left') => ({
  width:'100%', padding:'5px 8px',
  border:'1.5px solid transparent', borderRadius:'6px',
  fontSize:'12px', background:'transparent', outline:'none',
  textAlign, transition:'border-color 0.15s, background 0.15s',
  cursor:'text', boxSizing:'border-box',
});

const btnStyle = (bg) => ({
  padding:'8px 16px', background:bg, color:'white',
  border:'none', borderRadius:'8px', cursor:'pointer',
  fontWeight:700, fontSize:'13px',
  display:'inline-flex', alignItems:'center', gap:6,
});

const tfootNumStyle = (color) => ({
  padding:'12px 10px', textAlign:'right',
  fontWeight:800, fontSize:'13px', color,
});

export default WithdrawalsPage;