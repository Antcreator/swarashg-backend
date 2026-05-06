import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { agmFeeAPI, membersAPI } from '../../Service/Api';
import { useIsStaff } from '../Protected Route/Protectedroute';
import Navbar from '../Navbar/navbar';
import {
  ClipboardList, Calendar, Users, Receipt, CreditCard,
  PenLine, Trash2, CheckCircle, XCircle, Save, ScrollText,
} from 'lucide-react';

const fmt = (amount) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount || 0);

const AgmFeePage = () => {
  const isStaff = useIsStaff();
  const currentYear = new Date().getFullYear();
  const [year, setYear]         = useState(currentYear);
  const [members, setMembers]   = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [expanded, setExpanded] = useState(null);
  const [toast, setToast]       = useState(null);
  const [showModal, setShowModal]   = useState(false);
  const [allMembers, setAllMembers] = useState([]);
  const [form, setForm] = useState({ memberId: '', amount: '', year: currentYear, notes: '' });
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await agmFeeAPI.getAll(year);
      setMembers(res.data.members || []);
      setGrandTotal(res.data.grandTotal || 0);
    } catch (err) {
      showToast('Failed to load AGM fee data', 'error');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    membersAPI.getAll().then(r => setAllMembers(r.data.members || [])).catch(() => {});
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleAdd = async () => {
    if (!form.memberId || !form.amount) {
      showToast('Member and amount are required', 'error'); return;
    }
    setSaving(true);
    try {
      await agmFeeAPI.create(form);
      showToast('AGM fee recorded successfully');
      setShowModal(false);
      setForm({ memberId: '', amount: '', year: currentYear, notes: '' });
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this AGM fee record?')) return;
    setDeleting(id);
    try {
      await agmFeeAPI.delete(id);
      showToast('AGM fee deleted');
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const filtered = members.filter(m =>
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  // Source badge config
  const sourceBadge = (source) => {
    if (source === 'deposit') {
      return {
        bg: '#e3f2fd', color: '#1565c0',
        icon: <CreditCard size={11} />, label: 'Deposit',
      };
    }
    if (source === 'statutory_override') {
      return {
        bg: '#fff8e1', color: '#e65100',
        icon: <ScrollText size={11} />, label: 'Statutory Adj.',
      };
    }
    return {
      bg: '#f3e5f5', color: '#6a1b9a',
      icon: <PenLine size={11} />, label: 'Manual',
    };
  };

  const s = {
    page:        { minHeight: '100vh', background: '#f8f9fa' },
    container:   { maxWidth: '1200px', margin: '0 auto', padding: '24px 20px' },
    header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' },
    title:       { fontSize: '26px', fontWeight: '700', color: '#1a1a2e', margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: 8 },
    backLink:    { color: '#1976d2', textDecoration: 'none', fontSize: '14px' },
    controls:    { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
    searchBox:   { padding: '9px 14px', border: '1.5px solid #ddd', borderRadius: '8px', fontSize: '14px', width: '220px' },
    yearSelect:  { padding: '9px 14px', border: '1.5px solid #ddd', borderRadius: '8px', fontSize: '14px', background: 'white', cursor: 'pointer' },
    btnPrimary:  { padding: '9px 18px', background: '#7b1fa2', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: 6 },
    summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '28px' },
    card:        { background: 'white', borderRadius: '10px', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderTop: '3px solid' },
    tableWrap:   { background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' },
    table:       { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
    th:          { padding: '12px 14px', background: '#1a1a2e', color: 'white', fontWeight: '600', textAlign: 'left', fontSize: '12px' },
    td:          { padding: '12px 14px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle' },
    tdAlt:       { padding: '12px 14px', borderBottom: '1px solid #f0f0f0', background: '#fafafa', verticalAlign: 'middle' },
    badge:       { padding: '3px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' },
    btnExpand:   { padding: '4px 10px', background: '#e3f2fd', color: '#1976d2', border: '1px solid #90caf9', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
    btnDelete:   { padding: '4px 10px', background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: 4 },
    historyRow:  { background: '#f3e5f5', padding: '16px', borderTop: '2px solid #ce93d8' },
    overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modal:       { background: 'white', borderRadius: '12px', padding: '28px', width: '480px', maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
    input:       { width: '100%', padding: '10px 12px', border: '1.5px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', marginTop: '6px' },
    label:       { fontSize: '13px', fontWeight: '600', color: '#444', display: 'block', marginTop: '14px' },
  };

  const summaryCards = [
    { label: 'Grand Total (All Time)', value: grandTotal,                                             color: '#7b1fa2', Icon: ClipboardList, isCnt: false },
    { label: `Total (${year})`,        value: filtered.reduce((a, m) => a + m.totalThisYear, 0),     color: '#9c27b0', Icon: Calendar,      isCnt: false },
    { label: 'Members Contributed',    value: filtered.filter(m => m.totalAgmFee > 0).length,        color: '#4caf50', Icon: Users,         isCnt: true  },
    { label: 'Total Contributions',    value: filtered.reduce((a, m) => a + m.contributionCount, 0), color: '#1976d2', Icon: Receipt,       isCnt: true  },
  ];

  return (
    <div style={s.page}>
      <Navbar />
      <div style={s.container}>
        <div style={s.header}>
          <div>
            <Link to="/admin/dashboard" style={s.backLink}>← Dashboard</Link>
            <h1 style={s.title}>
              <ClipboardList size={24} /> AGM Fee Contributions — {year}
            </h1>
          </div>
          <div style={s.controls}>
            <input placeholder="Search member..." value={search} onChange={e => setSearch(e.target.value)} style={s.searchBox} />
            <select value={year} onChange={e => setYear(Number(e.target.value))} style={s.yearSelect}>
              {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {!isStaff && (
              <button style={s.btnPrimary} onClick={() => setShowModal(true)}>
                <ClipboardList size={14} /> Add AGM Fee
              </button>
            )}
          </div>
        </div>

        <div style={s.summaryGrid}>
          {summaryCards.map(c => (
            <div key={c.label} style={{ ...s.card, borderTopColor: c.color }}>
              <div style={{ marginBottom: '6px' }}><c.Icon size={22} color={c.color} /></div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>{c.label}</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: c.color }}>
                {c.isCnt ? c.value : fmt(c.value)}
              </div>
            </div>
          ))}
        </div>

        <div style={s.tableWrap}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#888' }}>Loading...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['#', 'Member', 'Phone', `This Year (${year})`, 'All Time Total', 'Contributions', 'Last Payment', 'Actions'].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} style={{ ...s.td, textAlign: 'center', padding: '40px', color: '#888' }}>No members found</td></tr>
                  ) : filtered.map((m, idx) => {
                    const td = idx % 2 === 0 ? s.td : s.tdAlt;
                    const isExpanded = expanded === m.id;
                    return (
                      <React.Fragment key={m.id}>
                        <tr>
                          <td style={td}>{idx + 1}</td>
                          <td style={td}><div style={{ fontWeight: '600' }}>{m.firstName} {m.lastName}</div></td>
                          <td style={td}><span style={{ color: '#888', fontSize: '12px' }}>{m.phone}</span></td>
                          <td style={td}><span style={{ color: '#7b1fa2', fontWeight: '700', fontSize: '15px' }}>{fmt(m.totalThisYear)}</span></td>
                          <td style={td}><span style={{ color: '#1a1a2e', fontWeight: '600' }}>{fmt(m.totalAgmFee)}</span></td>
                          <td style={td}>
                            {m.contributionCount > 0
                              ? <span style={{ ...s.badge, background: '#ede7f6', color: '#6a1b9a', border: '1px solid #ce93d8' }}>{m.contributionCount} payment{m.contributionCount !== 1 ? 's' : ''}</span>
                              : <span style={{ color: '#bbb' }}>—</span>
                            }
                          </td>
                          <td style={td}>
                            {m.lastContribution
                              ? <span style={{ fontSize: '12px', color: '#666' }}>{new Date(m.lastContribution).toLocaleDateString()}</span>
                              : <span style={{ color: '#bbb' }}>—</span>
                            }
                          </td>
                          <td style={td}>
                            {m.contributionCount > 0 && (
                              <button style={s.btnExpand} onClick={() => setExpanded(isExpanded ? null : m.id)}>
                                {isExpanded ? '▲ Hide' : '▼ History'}
                              </button>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} style={{ padding: 0 }}>
                              <div style={s.historyRow}>
                                <div style={{ fontWeight: '600', marginBottom: '10px', color: '#6a1b9a' }}>
                                  Payment History — {m.firstName} {m.lastName}
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                  <thead>
                                    <tr style={{ background: '#ce93d8' }}>
                                      {['Date', 'Amount', 'Year', 'Source', 'Recorded By', 'Notes', !isStaff && 'Action'].filter(Boolean).map(h => (
                                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#4a148c', fontWeight: '600' }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {m.contributions.map((c, ci) => {
                                      const badge = sourceBadge(c.source);
                                      // statutory_override rows can only be removed by editing the Statutory page
                                      const isDeletable = !isStaff && c.source === 'manual';
                                      const isSystemRow = c.source === 'statutory_override';

                                      return (
                                        <tr key={c.id} style={{ background: ci % 2 === 0 ? 'white' : '#fce4ec', opacity: isSystemRow ? 0.85 : 1 }}>
                                          <td style={{ padding: '8px 10px' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                                          <td style={{ padding: '8px 10px', fontWeight: '700', color: '#7b1fa2' }}>{fmt(c.amount)}</td>
                                          <td style={{ padding: '8px 10px' }}>{c.year}</td>
                                          <td style={{ padding: '8px 10px' }}>
                                            <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', background: badge.bg, color: badge.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                              {badge.icon} {badge.label}
                                            </span>
                                          </td>
                                          <td style={{ padding: '8px 10px', color: '#555' }}>{c.recordedBy || '—'}</td>
                                          <td style={{ padding: '8px 10px', color: '#666' }}>
                                            {c.notes || '—'}
                                            {isSystemRow && (
                                              <span style={{ marginLeft: 6, fontSize: '10px', color: '#e65100', fontStyle: 'italic' }}>
                                                (edit via Statutory page)
                                              </span>
                                            )}
                                          </td>
                                          {!isStaff && (
                                            <td style={{ padding: '8px 10px' }}>
                                              {isDeletable && (
                                                <button
                                                  style={{ ...s.btnDelete, opacity: deleting === c.id ? 0.6 : 1 }}
                                                  onClick={() => handleDelete(c.id)}
                                                  disabled={deleting === c.id}
                                                >
                                                  {deleting === c.id ? '...' : <><Trash2 size={11} /> Delete</>}
                                                </button>
                                              )}
                                            </td>
                                          )}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#1a1a2e', color: 'white', fontWeight: '700' }}>
                      <td style={{ padding: '12px 14px' }} colSpan={3}><strong>TOTALS ({filtered.length} members)</strong></td>
                      <td style={{ padding: '12px 14px' }}>{fmt(filtered.reduce((a, m) => a + m.totalThisYear, 0))}</td>
                      <td style={{ padding: '12px 14px' }}>{fmt(filtered.reduce((a, m) => a + m.totalAgmFee, 0))}</td>
                      <td style={{ padding: '12px 14px' }}>{filtered.reduce((a, m) => a + m.contributionCount, 0)} payments</td>
                      <td colSpan={2} style={{ padding: '12px 14px' }}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add AGM Fee Modal */}
      {showModal && !isStaff && (
        <div style={s.overlay} onClick={() => setShowModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 20px', color: '#1a1a2e', fontSize: '20px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={20} /> Add AGM Fee
            </h2>
            <label style={s.label}>Member *</label>
            <select value={form.memberId} onChange={e => setForm({ ...form, memberId: e.target.value })} style={s.input}>
              <option value="">Select member...</option>
              {allMembers.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
            </select>
            <label style={s.label}>Amount (KES) *</label>
            <input type="number" min="1" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 500" style={s.input} />
            <label style={s.label}>Year</label>
            <select value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })} style={s.input}>
              {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <label style={s.label}>Notes</label>
            <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." style={s.input} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '10px 20px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
              <button onClick={handleAdd} disabled={saving} style={{ padding: '10px 20px', background: '#7b1fa2', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', opacity: saving ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Save size={14} /> {saving ? 'Saving...' : 'Save AGM Fee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, padding: '14px 20px', borderRadius: '8px', fontWeight: '600', fontSize: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', background: toast.type === 'error' ? '#c62828' : '#2e7d32', color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast.type === 'error' ? <XCircle size={16} /> : <CheckCircle size={16} />} {toast.msg}
        </div>
      )}
    </div>
  );
};

export default AgmFeePage;