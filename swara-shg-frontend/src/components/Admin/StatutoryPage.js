import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { statutoryAPI, agmFeeAPI } from '../../Service/Api';
import { useIsStaff } from '../Protected Route/Protectedroute';
import Navbar from '../Navbar/navbar';
import {
  ArrowLeft, ScrollText, Download, Printer,
  Pencil, Save, X, CheckCircle, Eye, Send,
} from 'lucide-react';

const fmt = (v) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(v || 0);

const StatutoryPage = () => {
  const isStaff   = useIsStaff();
  const [year, setYear]       = useState(new Date().getFullYear());
  const [rows, setRows]       = useState([]);
  const [editing, setEditing] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [saving, setSaving]   = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statRes, agmRes] = await Promise.all([
        statutoryAPI.getAll(year),
        agmFeeAPI.getAll(year),
      ]);
      const agmMap = {};
      (agmRes.data.members || []).forEach(m => { agmMap[m.id] = Number(m.totalThisYear || 0); });
      const merged = (statRes.data.members || []).map(m => ({
        ...m,
        agmFee:             agmMap[m.id] || 0,
        guarantorDeduction: m.guarantorDeduction ? Number(m.guarantorDeduction) : 0,
        other:              m.other ? Number(m.other) : 0,
      }));
      setRows(merged);
    } catch (err) {
      setError('Failed to load statutory data: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const startEdit = (row) => {
    setEditing(prev => ({
      ...prev,
      [row.id]: { cautionaryFee: row.cautionaryFee, statutoryFee: row.statutoryFee, guarantorDeduction: row.guarantorDeduction, other: row.other, notes: row.notes || '' },
    }));
  };

  const cancelEdit = (memberId) => {
    setEditing(prev => { const n = { ...prev }; delete n[memberId]; return n; });
  };

  const handleEditChange = (memberId, field, value) => {
    setEditing(prev => ({ ...prev, [memberId]: { ...prev[memberId], [field]: value } }));
  };

  const saveRow = async (memberId) => {
    setSaving(prev => ({ ...prev, [memberId]: true }));
    try {
      await statutoryAPI.save(memberId, { ...editing[memberId], year });
      cancelEdit(memberId);
      await fetchData();
    } catch (err) {
      alert('Failed to save: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(prev => ({ ...prev, [memberId]: false }));
    }
  };

  const submitRow = async (memberId) => {
    if (!window.confirm('Mark this statutory record as officially submitted?')) return;
    try {
      await statutoryAPI.submit(memberId, { year });
      await fetchData();
    } catch (err) {
      alert('Failed to submit: ' + (err.response?.data?.message || err.message));
    }
  };

  const filtered = rows.filter(r =>
    `${r.firstName} ${r.lastName}`.toLowerCase().includes(search.toLowerCase()) || r.phone?.includes(search)
  );

  const totals = filtered.reduce((acc, r) => ({
    savings:            acc.savings            + r.totalSavings,
    seedCapital:        acc.seedCapital        + r.totalSeedCapital,
    savingsFine:        acc.savingsFine        + r.savingsFine,
    chamaaFine:         acc.chamaaFine         + r.chamaaFine,
    agmFee:             acc.agmFee             + r.agmFee,
    cautionaryFee:      acc.cautionaryFee      + r.cautionaryFee,
    statutoryFee:       acc.statutoryFee       + r.statutoryFee,
    guarantorDeduction: acc.guarantorDeduction + r.guarantorDeduction,
    other:              acc.other              + r.other,
  }), { savings: 0, seedCapital: 0, savingsFine: 0, chamaaFine: 0, agmFee: 0, cautionaryFee: 0, statutoryFee: 0, guarantorDeduction: 0, other: 0 });

  const yearOptions = [];
  for (let y = new Date().getFullYear(); y >= 2020; y--) yearOptions.push(y);

  const inputStyle = { width: '90px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #1976d2', fontSize: '13px' };

  const exportCSV = () => {
    const headers = ['#', 'Member', 'Phone', 'Total Savings', 'Seed Capital', 'Savings Fine', 'Chamaa Fine', 'AGM Fee', 'Cautionary Fee', 'Guarantor Deduction', 'Other', 'Statutory Fee', 'Notes', 'Status'];
    const csvRows = filtered.map((r, i) => [
      i + 1, `"${r.firstName} ${r.lastName}"`, r.phone || '',
      r.totalSavings, r.totalSeedCapital, r.savingsFine, r.chamaaFine, r.agmFee,
      r.cautionaryFee, r.guarantorDeduction, r.other, r.statutoryFee,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
      r.submittedAt ? 'Submitted' : r.statutoryId ? 'Draft' : 'None',
    ]);
    csvRows.push(['TOTAL', '', '', totals.savings, totals.seedCapital, totals.savingsFine, totals.chamaaFine, totals.agmFee, totals.cautionaryFee, totals.guarantorDeduction, totals.other, totals.statutoryFee, '', '']);
    const csv  = [headers, ...csvRows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `statutory_fees_${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const win    = window.open('', '_blank');
    const fmtNum = (v) => new Intl.NumberFormat('en-KE', { minimumFractionDigits: 0 }).format(v || 0);
    const colLabels = ['#', 'Member', 'Savings', 'Seed Cap.', 'Sav. Fine', 'Cha. Fine', 'AGM Fee', 'Cautionary', 'Guarantor Ded.', 'Other', 'Statutory', 'Status'];
    const theadCells = colLabels.map(l => `<th>${l}</th>`).join('');
    const tbodyRows  = filtered.map((r, i) => `
      <tr>
        <td>${i + 1}</td><td style="text-align:left">${r.firstName} ${r.lastName}</td>
        <td>${fmtNum(r.totalSavings)}</td><td>${fmtNum(r.totalSeedCapital)}</td>
        <td>${fmtNum(r.savingsFine)}</td><td>${fmtNum(r.chamaaFine)}</td>
        <td>${fmtNum(r.agmFee)}</td><td>${fmtNum(r.cautionaryFee)}</td>
        <td>${fmtNum(r.guarantorDeduction)}</td><td>${fmtNum(r.other)}</td>
        <td>${fmtNum(r.statutoryFee)}</td>
        <td>${r.submittedAt ? 'Submitted' : r.statutoryId ? 'Draft' : '—'}</td>
      </tr>`).join('');
    const totalRow = `<tr style="background:#1a1a2e;color:white;font-weight:bold"><td colspan="2">TOTALS (${filtered.length} members)</td><td>${fmtNum(totals.savings)}</td><td>${fmtNum(totals.seedCapital)}</td><td>${fmtNum(totals.savingsFine)}</td><td>${fmtNum(totals.chamaaFine)}</td><td>${fmtNum(totals.agmFee)}</td><td>${fmtNum(totals.cautionaryFee)}</td><td>${fmtNum(totals.guarantorDeduction)}</td><td>${fmtNum(totals.other)}</td><td>${fmtNum(totals.statutoryFee)}</td><td></td></tr>`;
    win.document.write(`<!DOCTYPE html><html><head><title>Statutory Fees ${year}</title>
      <style>body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#1a1a2e}h1{font-size:18px;margin-bottom:4px}p{color:#666;margin:0 0 16px;font-size:12px}table{width:100%;border-collapse:collapse}th{background:#1a1a2e;color:white;padding:7px 8px;text-align:center;font-size:10px}td{padding:6px 8px;border-bottom:1px solid #e0e0e0;text-align:center}tr:nth-child(even) td{background:#f9f9f9}@media print{body{margin:10px}@page{size:landscape}}</style>
    </head><body>
      <h1>Statutory Fees - ${year}</h1>
      <p>Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} &nbsp;·&nbsp; ${filtered.length} members</p>
      <table><thead><tr>${theadCells}</tr></thead><tbody>${tbodyRows}${totalRow}</tbody></table>
      <script>window.onload = () => { window.print(); }<script>
    </body></html>`);
    win.document.close();
  };

  const columns = ['#', 'Member', 'Total Savings', 'Seed Capital', 'Savings Fine', 'Chamaa Fine', 'AGM Fee', 'Cautionary Fee', 'Guarantor Deduction', 'Other', 'Statutory Fee', 'Notes', 'Actioned By', 'Status', 'Actions'];

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>
      <Navbar />
      <div style={{ padding: '24px', fontFamily: 'sans-serif' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <Link to="/admin/dashboard" style={{ color: '#1976d2', textDecoration: 'none', fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ArrowLeft size={14} /> Dashboard
            </Link>
            <h1 style={{ margin: '6px 0 0', fontSize: '24px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ScrollText size={24} color="#1a1a2e" /> Statutory Fees
            </h1>
            <p style={{ margin: '4px 0 0', color: '#666' }}>Manage member statutory contributions</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <input placeholder="Search member..." value={search} onChange={e => setSearch(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ddd', width: '200px', fontSize: '14px' }} />
            <button onClick={exportCSV} style={{ padding: '8px 16px', background: '#388e3c', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Download size={14} /> CSV
            </button>
            <button onClick={exportPDF} style={{ padding: '8px 16px', background: '#c62828', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Printer size={14} /> PDF
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          {[
            { label: 'Total Savings',        value: totals.savings,            color: '#ffffff', bg: '#000000' },
            { label: 'Seed Capital',         value: totals.seedCapital,        color: '#ffffff', bg: '#000000' },
            { label: 'AGM Fees',             value: totals.agmFee,             color: '#ffffff', bg: '#000000' },
            { label: 'Cautionary Fees',      value: totals.cautionaryFee,      color: '#ffffff', bg: '#000000' },
            { label: 'Statutory Fees',       value: totals.statutoryFee,       color: '#ffffff', bg: '#000000' },
            { label: 'Guarantor Deductions', value: totals.guarantorDeduction, color: '#ffffff', bg: '#000000' },
            { label: 'Other',                value: totals.other,              color: '#ffffff', bg: '#000000' },
            { label: 'Savings Fines',        value: totals.savingsFine,        color: '#ffffff', bg: '#000000' },
            { label: 'Chamaa Fines',         value: totals.chamaaFine,         color: '#ffffff', bg: '#000000' },
          ].map(card => (
            <div key={card.label} style={{ background: card.bg, borderRadius: '12px', padding: '14px', borderLeft: `4px solid ${card.color}` }}>
              <div style={{ fontSize: '11px', color: '#ffffff', marginBottom: '4px' }}>{card.label}</div>
              <div style={{ fontSize: '17px', fontWeight: 'bold', color: card.color }}>{fmt(card.value)}</div>
            </div>
          ))}
        </div>

        {error && <div style={{ background: '#ffebee', border: '1px solid #f44336', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: '#c62828' }}>{error}</div>}

        {loading ? <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Loading...</div> : (
          <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e0e0e0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  {columns.map(h => (
                    <th key={h} style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '2px solid #e0e0e0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, idx) => {
                  const isEditing = !!editing[row.id];
                  const ed        = editing[row.id] || {};
                  const isSaving  = saving[row.id];

                  return (
                    <tr key={row.id} style={{ borderBottom: '1px solid #f0f0f0', background: isEditing ? '#fffde7' : idx % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '10px' }}>{idx + 1}</td>
                      <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600 }}>{row.firstName} {row.lastName}</div>
                        <div style={{ fontSize: '11px', color: '#888' }}>{row.phone}</div>
                      </td>
                      <td style={{ padding: '10px' }}>{fmt(row.totalSavings)}</td>
                      <td style={{ padding: '10px' }}>{fmt(row.totalSeedCapital)}</td>
                      <td style={{ padding: '10px', color: row.savingsFine > 0 ? '#c62828' : '#666' }}>{fmt(row.savingsFine)}</td>
                      <td style={{ padding: '10px', color: row.chamaaFine  > 0 ? '#c62828' : '#666' }}>{fmt(row.chamaaFine)}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ background: row.agmFee > 0 ? '#f3e5f5' : '#f5f5f5', color: row.agmFee > 0 ? '#7b1fa2' : '#999', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                          {fmt(row.agmFee)}
                        </span>
                      </td>

                      {/* Cautionary Fee */}
                      <td style={{ padding: '10px' }}>
                        {!isStaff && isEditing
                          ? <input type="number" value={ed.cautionaryFee} min="0" style={inputStyle} onChange={e => handleEditChange(row.id, 'cautionaryFee', e.target.value)} />
                          : fmt(row.cautionaryFee)}
                      </td>

                      {/* Guarantor Deduction */}
                      <td style={{ padding: '10px' }}>
                        {!isStaff && isEditing
                          ? <input type="number" value={ed.guarantorDeduction} min="0" style={inputStyle} onChange={e => handleEditChange(row.id, 'guarantorDeduction', e.target.value)} />
                          : <span style={{ color: row.guarantorDeduction > 0 ? '#00695c' : '#999', fontWeight: row.guarantorDeduction > 0 ? 600 : 400 }}>{fmt(row.guarantorDeduction)}</span>
                        }
                      </td>

                      {/* Other */}
                      <td style={{ padding: '10px' }}>
                        {!isStaff && isEditing
                          ? <input type="number" value={ed.other} min="0" style={inputStyle} onChange={e => handleEditChange(row.id, 'other', e.target.value)} />
                          : <span style={{ color: row.other > 0 ? '#455a64' : '#999' }}>{fmt(row.other)}</span>
                        }
                      </td>

                      {/* Statutory Fee */}
                      <td style={{ padding: '10px' }}>
                        {!isStaff && isEditing
                          ? <input type="number" value={ed.statutoryFee} min="0" style={inputStyle} onChange={e => handleEditChange(row.id, 'statutoryFee', e.target.value)} />
                          : fmt(row.statutoryFee)}
                      </td>

                      {/* Notes */}
                      <td style={{ padding: '10px', maxWidth: '150px' }}>
                        {!isStaff && isEditing
                          ? <input type="text" value={ed.notes} placeholder="Notes..." style={{ ...inputStyle, width: '120px' }} onChange={e => handleEditChange(row.id, 'notes', e.target.value)} />
                          : <span style={{ color: '#666', fontSize: '12px' }}>{row.notes || '—'}</span>
                        }
                      </td>

                      {/* Actioned By */}
                      <td style={{ padding: '10px', fontSize: '11px', color: '#555', whiteSpace: 'nowrap' }}>
                        {row.editedByName && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Pencil size={11} color="#1976d2" /> {row.editedByName}
                          </div>
                        )}
                        {row.submittedByName && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={11} color="#2e7d32" /> {row.submittedByName}
                          </div>
                        )}
                        {!row.editedByName && !row.submittedByName && <span style={{ color: '#bbb' }}>—</span>}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '10px' }}>
                        {row.submittedAt
                          ? <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle size={12} /> Submitted
                            </span>
                          : row.statutoryId
                            ? <span style={{ background: '#fff3e0', color: '#e65100', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>Draft</span>
                            : <span style={{ background: '#f5f5f5', color: '#999', padding: '3px 10px', borderRadius: '12px', fontSize: '12px' }}>None</span>
                        }
                      </td>

                      {/* Actions — hidden for staff */}
                      <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                        {isStaff ? (
                          <span style={{ color: '#bbb', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Eye size={13} /> View only
                          </span>
                        ) : isEditing ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => saveRow(row.id)} disabled={isSaving} style={{ background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Save size={12} /> {isSaving ? 'Saving…' : 'Save'}
                            </button>
                            <button onClick={() => cancelEdit(row.id)} style={{ background: '#eee', border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <X size={12} /> Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => startEdit(row)} style={{ background: '#e3f2fd', color: '#1976d2', border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Pencil size={12} /> Edit
                            </button>
                            {!row.submittedAt && row.statutoryId && (
                              <button onClick={() => submitRow(row.id)} style={{ background: '#e8f5e9', color: '#2e7d32', border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Send size={12} /> Submit
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filtered.length > 0 && (
                  <tr style={{ background: '#f5f5f5', fontWeight: 'bold', borderTop: '2px solid #ddd' }}>
                    <td colSpan={2} style={{ padding: '12px 10px' }}>Totals ({filtered.length} members)</td>
                    <td style={{ padding: '12px 10px' }}>{fmt(totals.savings)}</td>
                    <td style={{ padding: '12px 10px' }}>{fmt(totals.seedCapital)}</td>
                    <td style={{ padding: '12px 10px' }}>{fmt(totals.savingsFine)}</td>
                    <td style={{ padding: '12px 10px' }}>{fmt(totals.chamaaFine)}</td>
                    <td style={{ padding: '12px 10px' }}>{fmt(totals.agmFee)}</td>
                    <td style={{ padding: '12px 10px' }}>{fmt(totals.cautionaryFee)}</td>
                    <td style={{ padding: '12px 10px' }}>{fmt(totals.guarantorDeduction)}</td>
                    <td style={{ padding: '12px 10px' }}>{fmt(totals.other)}</td>
                    <td style={{ padding: '12px 10px' }}>{fmt(totals.statutoryFee)}</td>
                    <td colSpan={4} />
                  </tr>
                )}

                {filtered.length === 0 && !loading && (
                  <tr><td colSpan={15} style={{ textAlign: 'center', padding: '40px', color: '#999' }}>No members found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatutoryPage;