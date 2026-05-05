import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../Navbar/navbar';
import { seedCapitalAPI } from '../../Service/Api';
import '../MembersManagementAdmin/Members.css';
import {
  Sprout, Pencil, Trash2, X, Save, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react';

const SeedCapitalPage = () => {
  const [data,    setData]    = useState([]);
  const [summary, setSummary] = useState({ total: 0, members: 0 });
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  // ── Which member's contributions are expanded ─────────────────────────────
  const [expandedMember, setExpandedMember] = useState(null);

  // ── Edit contribution modal ───────────────────────────────────────────────
  const [editingContrib, setEditingContrib] = useState(null);
  const [editForm,       setEditForm]       = useState({ amount: '', paymentDate: '', notes: '' });
  const [editLoading,    setEditLoading]    = useState(false);
  const [editError,      setEditError]      = useState('');

  // ── Delete confirmation ───────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await seedCapitalAPI.getAll();
      setData(res.data.members || []);
      setSummary({
        total:   res.data.totalSeedCapital   || 0,
        members: res.data.membersContributed || 0,
      });
    } catch (err) {
      console.error('Failed to fetch seed capital:', err);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n || 0);

  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const filtered = data.filter(m =>
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  // ── Edit helpers ──────────────────────────────────────────────────────────
  const openEdit = (contrib) => {
    setEditingContrib(contrib);
    setEditForm({
      amount:      contrib.amount      ?? '',
      paymentDate: contrib.paymentDate ?? '',
      notes:       contrib.notes       ?? '',
    });
    setEditError('');
  };

  const closeEdit = () => {
    setEditingContrib(null);
    setEditForm({ amount: '', paymentDate: '', notes: '' });
    setEditError('');
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editForm.amount || Number(editForm.amount) <= 0) {
      setEditError('Please enter a valid positive amount.');
      return;
    }
    if (!editForm.paymentDate) {
      setEditError('Payment date is required.');
      return;
    }
    setEditLoading(true);
    setEditError('');
    try {
      await seedCapitalAPI.update(editingContrib.id, {
        amount:      Number(editForm.amount),
        paymentDate: editForm.paymentDate,
        notes:       editForm.notes,
      });
      closeEdit();
      fetchData();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update contribution.');
    } finally {
      setEditLoading(false);
    }
  };

  // ── Delete helpers ────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleteLoading(true);
    try {
      await seedCapitalAPI.delete(deleteConfirm);
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete contribution.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const iconBtn = (bg) => ({
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '4px 10px', border: 'none', borderRadius: '6px',
    cursor: 'pointer', fontSize: '12px', fontWeight: 600,
    background: bg, color: 'white', transition: 'opacity 0.15s',
  });

  return (
    <>
      <Navbar />
      <div className="admin-container">
        <Link to="/admin/dashboard" style={{ color: '#1976d2', textDecoration: 'none', fontSize: '14px' }}>← Dashboard</Link>

        <div className="page-header">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sprout size={24} color="#2e7d32" /> Seed Capital
          </h1>
          <input
            type="text"
            placeholder="Search member..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', width: '220px' }}
          />
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: '#e8f5e9', border: '2px solid #4caf50', borderRadius: '10px', padding: '20px' }}>
            <p style={{ margin: '0 0 6px', color: '#555', fontSize: '13px' }}>Total Seed Capital</p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#2e7d32' }}>{fmt(summary.total)}</p>
          </div>
          <div style={{ background: '#e3f2fd', border: '2px solid #1976d2', borderRadius: '10px', padding: '20px' }}>
            <p style={{ margin: '0 0 6px', color: '#555', fontSize: '13px' }}>Members Contributed</p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#1565c0' }}>{summary.members}</p>
          </div>
        </div>

        {/* Main table */}
        {loading ? (
          <div className="loading">Loading seed capital data...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Member Name</th>
                  <th>Phone</th>
                  <th>Total Seed Capital</th>
                  <th>Contributions</th>
                  <th>Last Contribution</th>
                  <th style={{ textAlign: 'center' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>No records found</td>
                  </tr>
                ) : filtered.map((m, i) => {
                  const isExpanded = expandedMember === m.id;
                  return (
                    <React.Fragment key={m.id}>
                      {/* Member summary row */}
                      <tr>
                        <td>{i + 1}</td>
                        <td><strong>{m.firstName} {m.lastName}</strong></td>
                        <td>{m.phone || '—'}</td>
                        <td style={{ fontWeight: 'bold', color: '#2e7d32' }}>{fmt(m.totalSeedCapital)}</td>
                        <td>{m.contributionCount || 0}</td>
                        <td>{fmtDate(m.lastContribution)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => setExpandedMember(isExpanded ? null : m.id)}
                            style={iconBtn(isExpanded ? '#455a64' : '#1976d2')}
                            title={isExpanded ? 'Collapse' : 'View & edit contributions'}
                          >
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            {isExpanded ? 'Collapse' : 'View'}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded per-contribution rows */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="7" style={{ padding: 0, background: '#f9fbe7' }}>
                            <div style={{ padding: '12px 24px 16px' }}>
                              <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: '#558b2f' }}>
                                Contributions — {m.firstName} {m.lastName}
                              </p>
                              {(!m.contributions || m.contributions.length === 0) ? (
                                <p style={{ color: '#999', fontSize: '13px' }}>No contributions recorded yet.</p>
                              ) : (
                                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ background: '#dcedc8' }}>
                                      <th style={{ padding: '7px 10px', textAlign: 'left',   fontWeight: 700 }}>Payment Date</th>
                                      <th style={{ padding: '7px 10px', textAlign: 'right',  fontWeight: 700 }}>Amount</th>
                                      <th style={{ padding: '7px 10px', textAlign: 'left',   fontWeight: 700 }}>Notes</th>
                                      <th style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700 }}>Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {m.contributions.map((c) => (
                                      <tr key={c.id} style={{ borderBottom: '1px solid #e8f5e9' }}>
                                        <td style={{ padding: '7px 10px' }}>{fmtDate(c.paymentDate)}</td>
                                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, color: '#2e7d32' }}>
                                          {fmt(c.amount)}
                                        </td>
                                        <td style={{ padding: '7px 10px', color: '#666' }}>{c.notes || '—'}</td>
                                        <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                                            <button
                                              style={iconBtn('#1976d2')}
                                              onClick={() => openEdit(c)}
                                              title="Edit this contribution"
                                            >
                                              <Pencil size={12} /> Edit
                                            </button>
                                            <button
                                              style={iconBtn('#c62828')}
                                              onClick={() => setDeleteConfirm(c.id)}
                                              title="Delete this contribution"
                                            >
                                              <Trash2 size={12} /> Delete
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
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
                  <tr style={{ background: '#f5f5f5', fontWeight: 'bold' }}>
                    <td colSpan="3">Total</td>
                    <td style={{ color: '#2e7d32' }}>
                      {fmt(filtered.reduce((s, m) => s + Number(m.totalSeedCapital || 0), 0))}
                    </td>
                    <td>{filtered.reduce((s, m) => s + Number(m.contributionCount || 0), 0)}</td>
                    <td colSpan="2"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* ── Edit Contribution Modal ─────────────────────────────────────── */}
        {editingContrib && (
          <div className="modal-overlay" onClick={closeEdit}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '18px' }}>
                <Sprout size={20} color="#2e7d32" />
                <h2 style={{ margin: 0, fontSize: '18px' }}>Edit Contribution</h2>
              </div>

              <form onSubmit={handleEditSave}>
                <div className="form-group">
                  <label>Amount (KES) *</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={editForm.amount}
                    onChange={e => { setEditForm(f => ({ ...f, amount: e.target.value })); setEditError(''); }}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label>Payment Date *</label>
                  <input
                    type="date"
                    value={editForm.paymentDate}
                    onChange={e => { setEditForm(f => ({ ...f, paymentDate: e.target.value })); setEditError(''); }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={editForm.notes}
                    onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                    rows="3"
                    placeholder="Optional notes"
                  />
                </div>

                {editError && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    background: '#ffebee', border: '1px solid #e53935',
                    borderRadius: '6px', padding: '10px 12px',
                    color: '#c62828', fontSize: '13px', marginBottom: '12px',
                  }}>
                    <AlertTriangle size={14} /> {editError}
                  </div>
                )}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={closeEdit}
                    disabled={editLoading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <X size={14} /> Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={editLoading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: editLoading ? 0.65 : 1 }}
                  >
                    <Save size={14} /> {editLoading ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Delete Confirmation Modal ───────────────────────────────────── */}
        {deleteConfirm !== null && (
          <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '12px' }}>
                <AlertTriangle size={22} color="#c62828" />
                <h2 style={{ margin: 0, color: '#c62828' }}>Delete Contribution?</h2>
              </div>
              <p style={{ color: '#555', fontSize: '14px', marginBottom: '20px' }}>
                This will permanently remove this seed capital contribution. The member's total will update automatically.
              </p>
              <div className="modal-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleteLoading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <X size={14} /> Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  style={{ ...iconBtn('#c62828'), padding: '9px 18px', fontSize: '14px', opacity: deleteLoading ? 0.6 : 1 }}
                >
                  <Trash2 size={14} /> {deleteLoading ? 'Deleting…' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SeedCapitalPage;