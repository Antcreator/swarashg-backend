import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { registrationFeeAPI } from '../../Service/Api';
import { useIsStaff } from '../Protected Route/Protectedroute';
import Navbar from '../Navbar/navbar';
import {
  FilePen, Download, Printer, Save, Pencil, Trash2,
  CheckCircle, XCircle,
} from 'lucide-react';

const fmt = (v) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(v || 0);

const RegistrationFeePage = () => {
  const isStaff = useIsStaff();
  const [members, setMembers]       = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [paidCount, setPaidCount]   = useState(0);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState('all');
  const [editing, setEditing]       = useState({});
  const [saving, setSaving]         = useState({});
  const [toast, setToast]           = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await registrationFeeAPI.getAll();
      setMembers(res.data.members || []);
      setGrandTotal(res.data.grandTotal || 0);
      setPaidCount(res.data.paidCount || 0);
    } catch {
      showToast('Failed to load registration fees', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const startEdit = (m) => {
    setEditing(prev => ({ ...prev, [m.id]: { amount: m.amount || '', notes: m.notes || '' } }));
  };

  const cancelEdit = (id) => {
    setEditing(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleSave = async (memberId) => {
    const ed = editing[memberId];
    if (!ed?.amount || Number(ed.amount) <= 0) { showToast('Please enter a valid amount', 'error'); return; }
    setSaving(prev => ({ ...prev, [memberId]: true }));
    try {
      await registrationFeeAPI.save({ memberId, amount: Number(ed.amount), notes: ed.notes });
      showToast('Registration fee saved');
      cancelEdit(memberId);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save', 'error');
    } finally {
      setSaving(prev => ({ ...prev, [memberId]: false }));
    }
  };

  const handleDelete = async (memberId, name) => {
    if (!window.confirm(`Remove registration fee for ${name}?`)) return;
    try {
      await registrationFeeAPI.delete(memberId);
      showToast('Registration fee removed');
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete', 'error');
    }
  };

  const filtered = members
    .filter(m => `${m.firstName} ${m.lastName}`.toLowerCase().includes(search.toLowerCase()) || m.phone?.includes(search))
    .filter(m => filter === 'all' ? true : filter === 'paid' ? m.hasPaid : !m.hasPaid);

  const inputSt = { padding: '6px 10px', border: '1.5px solid #1976d2', borderRadius: '6px', fontSize: '13px', width: '110px' };

  const exportCSV = () => {
    const headers = ['#', 'Member', 'Phone', 'Date Joined', 'Amount (KES)', 'Paid At', 'Recorded By', 'Notes'];
    const rows = filtered.map((m, i) => [i + 1, `"${m.firstName} ${m.lastName}"`, m.phone || '', m.dateJoined ? new Date(m.dateJoined).toLocaleDateString('en-GB') : '', m.amount || 0, m.paidAt ? new Date(m.paidAt).toLocaleDateString('en-GB') : '', m.recordedBy || '', `"${(m.notes || '').replace(/"/g, '""')}"`]);
    rows.push(['TOTAL', '', '', '', grandTotal, '', '', '']);
    const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'registration_fees.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const win  = window.open('', '_blank');
    const fmtN = (v) => new Intl.NumberFormat('en-KE', { minimumFractionDigits: 0 }).format(v || 0);
    const rows = filtered.map((m, i) => `
      <tr style="background:${i % 2 === 0 ? 'white' : '#f9f9f9'}">
        <td>${i + 1}</td>
        <td style="text-align:left;font-weight:600">${m.firstName} ${m.lastName}</td>
        <td>${m.phone || '—'}</td>
        <td style="color:${m.hasPaid ? '#2e7d32' : '#c62828'};font-weight:600">${m.hasPaid ? fmtN(m.amount) : '—'}</td>
        <td>${m.paidAt ? new Date(m.paidAt).toLocaleDateString('en-GB') : '—'}</td>
        <td style="color:${m.hasPaid ? '#2e7d32' : '#c62828'};font-weight:600">${m.hasPaid ? 'Paid' : 'Unpaid'}</td>
      </tr>`).join('');
    const totalRow = `<tr style="background:#1a1a2e;color:white;font-weight:bold"><td colspan="3">TOTALS (${filtered.length} members)</td><td>${fmtN(grandTotal)}</td><td></td><td>${paidCount} paid</td></tr>`;
    win.document.write(`<!DOCTYPE html><html><head><title>Registration Fees</title>
      <style>body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#1a1a2e}h1{font-size:17px;margin-bottom:4px}table{width:100%;border-collapse:collapse}th{background:#1a1a2e;color:white;padding:7px 8px;text-align:center;font-size:10px}td{padding:6px 8px;border-bottom:1px solid #e0e0e0;text-align:center}@media print{@page{size:landscape}}</style>
    </head><body>
      <h1>Registration Fees</h1>
      <p style="color:#666;margin:0 0 14px">Generated: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})} · Grand Total: ${fmtN(grandTotal)} · ${paidCount} members paid</p>
      <table><thead><tr><th>#</th><th>Member</th><th>Phone</th><th>Amount</th><th>Paid On</th><th>Status</th></tr></thead><tbody>${rows}${totalRow}</tbody></table>
      <script>window.onload=()=>{window.print();}<script>
    </body></html>`);
    win.document.close();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>
      <Navbar />
      <div style={{ padding: '24px', fontFamily: 'sans-serif' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <Link to="/admin/dashboard" style={{ color: '#1976d2', textDecoration: 'none', fontSize: '14px' }}>← Dashboard</Link>
            <h1 style={{ margin: '6px 0 0', fontSize: '24px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FilePen size={24} /> Registration Fees
            </h1>
            <p style={{ margin: '4px 0 0', color: '#666' }}>Member registration fee records</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
              <option value="all">All Members</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Not Paid</option>
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

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          {[
            { label: 'Grand Total',   value: fmt(grandTotal),              color: '#1976d2', bg: '#e3f2fd' },
            { label: 'Members Paid',  value: paidCount,                    color: '#2e7d32', bg: '#e8f5e9' },
            { label: 'Not Yet Paid',  value: members.length - paidCount,   color: '#c62828', bg: '#ffebee' },
            { label: 'Total Members', value: members.length,               color: '#555',    bg: '#f5f5f5' },
          ].map(c => (
            <div key={c.label} style={{ background: c.bg, borderRadius: '12px', padding: '14px', borderLeft: `4px solid ${c.color}` }}>
              <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>{c.label}</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>Loading...</div> : (
          <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e0e0e0', background: 'white' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#1a1a2e' }}>
                  {['#', 'Member', 'Phone', 'Date Joined', 'Registration Fee', 'Paid On', 'Recorded By', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 10px', color: 'white', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, idx) => {
                  const isEditing = !!editing[m.id];
                  const ed        = editing[m.id] || {};
                  const isSaving  = saving[m.id];

                  return (
                    <tr key={m.id} style={{ background: isEditing ? '#fffde7' : idx % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '10px' }}>{idx + 1}</td>
                      <td style={{ padding: '10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{m.firstName} {m.lastName}</td>
                      <td style={{ padding: '10px', color: '#666', fontSize: '12px' }}>{m.phone}</td>
                      <td style={{ padding: '10px', color: '#666', fontSize: '12px' }}>{m.dateJoined ? new Date(m.dateJoined).toLocaleDateString('en-GB') : '—'}</td>

                      <td style={{ padding: '10px' }}>
                        {!isStaff && isEditing ? (
                          <input type="number" min="0" value={ed.amount} placeholder="Amount" style={inputSt}
                            onChange={e => setEditing(prev => ({ ...prev, [m.id]: { ...prev[m.id], amount: e.target.value } }))} />
                        ) : m.hasPaid ? (
                          <span style={{ color: '#1976d2', fontWeight: 700 }}>{fmt(m.amount)}</span>
                        ) : (
                          <span style={{ color: '#bbb' }}>—</span>
                        )}
                      </td>

                      <td style={{ padding: '10px', fontSize: '12px', color: '#666' }}>{m.paidAt ? new Date(m.paidAt).toLocaleDateString('en-GB') : '—'}</td>
                      <td style={{ padding: '10px', fontSize: '12px', color: '#555' }}>{m.recordedBy || '—'}</td>

                      <td style={{ padding: '10px' }}>
                        {m.hasPaid
                          ? <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle size={11} /> Paid</span>
                          : <span style={{ background: '#ffebee', color: '#c62828', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><XCircle size={11} /> Unpaid</span>
                        }
                      </td>

                      <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                        {isStaff ? (
                          <span style={{ color: '#bbb', fontSize: '12px' }}>View only</span>
                        ) : isEditing ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => handleSave(m.id)} disabled={isSaving}
                              style={{ background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', opacity: isSaving ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Save size={12} /> {isSaving ? '...' : 'Save'}
                            </button>
                            <button onClick={() => cancelEdit(m.id)}
                              style={{ background: '#eee', border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px' }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => startEdit(m)}
                              style={{ background: '#e3f2fd', color: '#1976d2', border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Pencil size={11} /> {m.hasPaid ? 'Edit' : 'Record'}
                            </button>
                            {m.hasPaid && (
                              <button onClick={() => handleDelete(m.id, `${m.firstName} ${m.lastName}`)}
                                style={{ background: '#ffebee', color: '#c62828', border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filtered.length > 0 && (
                  <tr style={{ background: '#1a1a2e', color: 'white', fontWeight: 700 }}>
                    <td colSpan={4} style={{ padding: '12px 10px' }}>Totals ({filtered.length} members)</td>
                    <td style={{ padding: '12px 10px', color: '#90caf9' }}>{fmt(filtered.reduce((s, m) => s + (m.amount || 0), 0))}</td>
                    <td colSpan={4} />
                  </tr>
                )}

                {filtered.length === 0 && !loading && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#999' }}>No members found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, padding: '14px 20px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', background: toast.type === 'error' ? '#c62828' : '#2e7d32', color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast.type === 'error' ? <XCircle size={16} /> : <CheckCircle size={16} />} {toast.msg}
        </div>
      )}
    </div>
  );
};

export default RegistrationFeePage;