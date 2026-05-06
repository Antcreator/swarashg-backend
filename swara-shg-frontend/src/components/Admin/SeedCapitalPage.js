import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../Navbar/navbar';
import { seedCapitalAPI } from '../../Service/Api';
import '../MembersManagementAdmin/Members.css';
import {
  Sprout, Pencil, Trash2, X, Save, AlertTriangle, ChevronDown, ChevronUp, User, Plus,
} from 'lucide-react';

const SeedCapitalPage = () => {
  const [data,    setData]    = useState([]);
  const [summary, setSummary] = useState({ total: 0, members: 0 });
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  const [expandedMember, setExpandedMember] = useState(null);

  // ── Edit existing contribution ────────────────────────────────────────────
  const [editingContrib, setEditingContrib] = useState(null);
  const [editForm,       setEditForm]       = useState({ amount: '', paymentDate: '', notes: '' });
  const [editLoading,    setEditLoading]    = useState(false);
  const [editError,      setEditError]      = useState('');

  // ── Add new contribution ──────────────────────────────────────────────────
  const [addingMember,  setAddingMember]  = useState(null); // { id, firstName, lastName }
  const [addForm,       setAddForm]       = useState({ amount: '', paymentDate: '', notes: '' });
  const [addLoading,    setAddLoading]    = useState(false);
  const [addError,      setAddError]      = useState('');

  // ── Delete ────────────────────────────────────────────────────────────────
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

  const fmtDateShort = (d) =>
    d ? new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: '2-digit' }) : null;

  const todayStr = () => new Date().toISOString().split('T')[0];

  const filtered = data.filter(m =>
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  // ── Edit helpers ──────────────────────────────────────────────────────────
  const openEdit = (contrib) => {
    setEditingContrib(contrib);
    setEditForm({
      amount:      contrib.amount ?? '',
      paymentDate: contrib.paymentDate
        ? new Date(contrib.paymentDate).toISOString().split('T')[0]
        : todayStr(),
      notes: contrib.notes ?? '',
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

  // ── Add helpers ───────────────────────────────────────────────────────────
  const openAdd = (member) => {
    setAddingMember(member);
    setAddForm({ amount: '', paymentDate: todayStr(), notes: '' });
    setAddError('');
  };

  const closeAdd = () => {
    setAddingMember(null);
    setAddForm({ amount: '', paymentDate: '', notes: '' });
    setAddError('');
  };

  const handleAddSave = async (e) => {
    e.preventDefault();
    if (!addForm.amount || Number(addForm.amount) <= 0) {
      setAddError('Please enter a valid positive amount.');
      return;
    }
    if (!addForm.paymentDate) {
      setAddError('Payment date is required.');
      return;
    }
    setAddLoading(true);
    setAddError('');
    try {
      await seedCapitalAPI.create({
        memberId:    addingMember.id,
        amount:      Number(addForm.amount),
        paymentDate: addForm.paymentDate,
        notes:       addForm.notes,
      });
      closeAdd();
      fetchData();
    } catch (err) {
      setAddError(err.response?.data?.message || 'Failed to add contribution.');
    } finally {
      setAddLoading(false);
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

  // ── Shared styles ─────────────────────────────────────────────────────────
  const iconBtn = (bg) => ({
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '6px 12px', border: 'none', borderRadius: '6px',
    cursor: 'pointer', fontSize: '12px', fontWeight: 600,
    background: bg, color: 'white', transition: 'opacity 0.15s',
    whiteSpace: 'nowrap', minHeight: '34px',
  });

  const subTh = (align = 'left') => ({
    padding: '8px 10px',
    textAlign: align,
    fontWeight: 700,
    fontSize: '11px',
    whiteSpace: 'nowrap',
    background: '#dcedc8',
    borderBottom: '2px solid #aed581',
  });

  const subTd = (align = 'left', extra = {}) => ({
    padding: '8px 10px',
    textAlign: align,
    fontSize: '12px',
    verticalAlign: 'middle',
    borderBottom: '1px solid #e8f5e9',
    ...extra,
  });

  // ── Reusable form fields ──────────────────────────────────────────────────
  const ContribFormFields = ({ form, setForm, error }) => (
    <>
      <div className="form-group">
        <label>Amount (KES) *</label>
        <input
          type="number"
          min="1"
          step="1"
          value={form.amount}
          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          required
          autoFocus
          style={{ fontSize: '16px' }}
          placeholder="e.g. 5000"
        />
      </div>
      <div className="form-group">
        <label>Payment Date *</label>
        <input
          type="date"
          value={form.paymentDate}
          onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
          required
          style={{ fontSize: '16px' }}
        />
      </div>
      <div className="form-group">
        <label>Notes</label>
        <textarea
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          rows="3"
          placeholder="Optional notes"
          style={{ fontSize: '16px' }}
        />
      </div>
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: '#ffebee', border: '1px solid #e53935',
          borderRadius: '6px', padding: '10px 12px',
          color: '#c62828', fontSize: '13px', marginBottom: '12px',
        }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}
    </>
  );

  // ── Edited-by badge ───────────────────────────────────────────────────────
  const EditedByBadge = ({ editedBy, editedAt }) => {
    if (!editedBy) return <span style={{ color: '#ccc', fontSize: '12px' }}>—</span>;
    const ts = fmtDateShort(editedAt);
    return (
      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: '11px', fontWeight: 600, color: '#2e7d32',
          background: '#e8f5e9', borderRadius: '12px',
          padding: '2px 8px', whiteSpace: 'nowrap',
        }}>
          <User size={9} /> {editedBy}
        </span>
        {ts && <span style={{ fontSize: '9px', color: '#aaa', whiteSpace: 'nowrap' }}>{ts}</span>}
      </div>
    );
  };

  // ── Mobile contribution card ──────────────────────────────────────────────
  const ContribCard = ({ c }) => (
    <div style={{
      background: 'white', border: '1px solid #e8f5e9',
      borderRadius: '8px', padding: '12px', marginBottom: '8px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#2e7d32' }}>{fmt(c.amount)}</span>
        <span style={{ fontSize: '11px', color: '#777' }}>{fmtDate(c.paymentDate)}</span>
      </div>
      {c.notes && (
        <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#666' }}>{c.notes}</p>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
        <EditedByBadge editedBy={c.editedBy} editedAt={c.editedAt} />
        <div style={{ display: 'flex', gap: '6px' }}>
          <button style={iconBtn('#1976d2')} onClick={() => openEdit(c)}><Pencil size={12} /> Edit</button>
          <button style={iconBtn('#c62828')} onClick={() => setDeleteConfirm(c.id)}><Trash2 size={12} /> Delete</button>
        </div>
      </div>
    </div>
  );

  // ── Mobile member card ────────────────────────────────────────────────────
  const MemberCard = ({ m, index }) => {
    const isExpanded = expandedMember === m.id;
    const hasContribs = m.contributions && m.contributions.length > 0;
    return (
      <div style={{
        border: '1px solid #e0e0e0', borderRadius: '10px',
        marginBottom: '10px', overflow: 'hidden',
        background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '26px', height: '26px', borderRadius: '50%',
                background: '#e8f5e9', color: '#2e7d32',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, flexShrink: 0,
              }}>{index + 1}</span>
              <strong style={{ fontSize: '15px', color: '#1a1a1a' }}>{m.firstName} {m.lastName}</strong>
            </div>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#2e7d32', whiteSpace: 'nowrap', marginLeft: '8px' }}>
              {fmt(m.totalSeedCapital)}
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
            {m.phone && (
              <span style={{ fontSize: '12px', color: '#555', background: '#f5f5f5', borderRadius: '4px', padding: '2px 8px' }}>
                {m.phone}
              </span>
            )}
            <span style={{ fontSize: '12px', color: '#555', background: '#f5f5f5', borderRadius: '4px', padding: '2px 8px' }}>
              {m.contributionCount || 0} contribution{m.contributionCount !== 1 ? 's' : ''}
            </span>
            {m.lastContribution && (
              <span style={{ fontSize: '12px', color: '#555', background: '#f5f5f5', borderRadius: '4px', padding: '2px 8px' }}>
                Last: {fmtDate(m.lastContribution)}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => openAdd(m)}
              style={{ ...iconBtn('#2e7d32'), flex: 1, justifyContent: 'center' }}
            >
              <Plus size={13} /> Add Contribution
            </button>
            {hasContribs && (
              <button
                onClick={() => setExpandedMember(isExpanded ? null : m.id)}
                style={{ ...iconBtn(isExpanded ? '#455a64' : '#1976d2'), flex: 1, justifyContent: 'center' }}
              >
                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {isExpanded ? 'Collapse' : 'View'}
              </button>
            )}
          </div>
        </div>

        {isExpanded && hasContribs && (
          <div style={{ background: '#f9fbe7', borderTop: '2px solid #aed581', padding: '12px 16px' }}>
            <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: '#558b2f' }}>Contributions</p>
            {m.contributions.map((c) => <ContribCard key={c.id} c={c} />)}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Navbar />
      <div className="admin-container">
        <style>{`
          @media (max-width: 767px) {
            .seed-desktop-table { display: none !important; }
            .seed-mobile-list   { display: block !important; }
            .seed-page-header   { flex-direction: column !important; align-items: stretch !important; gap: 10px !important; }
            .seed-search-input  { width: 100% !important; box-sizing: border-box !important; }
          }
          @media (min-width: 768px) {
            .seed-mobile-list { display: none !important; }
          }
          .seed-mobile-list { display: none; }

          @media (max-width: 480px) {
            .seed-modal-content {
              max-width: 100% !important;
              width: calc(100vw - 32px) !important;
              margin: 16px !important;
              padding: 18px !important;
            }
            .seed-modal-actions {
              flex-direction: column !important;
              gap: 8px !important;
            }
            .seed-modal-actions button {
              width: 100% !important;
              justify-content: center !important;
            }
          }
        `}</style>

        <Link to="/admin/dashboard" style={{ color: '#1976d2', textDecoration: 'none', fontSize: '14px' }}>
          ← Dashboard
        </Link>

        {/* Page header */}
        <div
          className="page-header seed-page-header"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}
        >
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Sprout size={24} color="#2e7d32" /> Seed Capital
          </h1>
          <input
            type="text"
            placeholder="Search member..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="seed-search-input"
            style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', width: '220px' }}
          />
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: '#e8f5e9', border: '2px solid #4caf50', borderRadius: '10px', padding: '16px' }}>
            <p style={{ margin: '0 0 6px', color: '#555', fontSize: '12px' }}>Total Seed Capital</p>
            <p style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', color: '#2e7d32', wordBreak: 'break-word' }}>{fmt(summary.total)}</p>
          </div>
          <div style={{ background: '#e3f2fd', border: '2px solid #1976d2', borderRadius: '10px', padding: '16px' }}>
            <p style={{ margin: '0 0 6px', color: '#555', fontSize: '12px' }}>Members Contributed</p>
            <p style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', color: '#1565c0' }}>{summary.members}</p>
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading seed capital data...</div>
        ) : (
          <>
            {/* ── DESKTOP TABLE ──────────────────────────────────────── */}
            <div className="seed-desktop-table table-container">
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '4%'  }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '25%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center' }}>#</th>
                    <th>Member Name</th>
                    <th>Phone</th>
                    <th style={{ textAlign: 'right' }}>Total Seed Capital</th>
                    <th style={{ textAlign: 'center' }}>Contributions</th>
                    <th style={{ textAlign: 'center' }}>Last Contribution</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>No records found</td>
                    </tr>
                  ) : filtered.map((m, i) => {
                    const isExpanded = expandedMember === m.id;
                    const hasContribs = m.contributions && m.contributions.length > 0;
                    return (
                      <React.Fragment key={m.id}>
                        <tr>
                          <td style={{ textAlign: 'center' }}>{i + 1}</td>
                          <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <strong>{m.firstName} {m.lastName}</strong>
                          </td>
                          <td>{m.phone || '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#2e7d32' }}>
                            {fmt(m.totalSeedCapital)}
                          </td>
                          <td style={{ textAlign: 'center' }}>{m.contributionCount || 0}</td>
                          <td style={{ textAlign: 'center' }}>{fmtDate(m.lastContribution)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                              {/* Always-visible Add button */}
                              <button
                                onClick={() => openAdd(m)}
                                style={iconBtn('#2e7d32')}
                                title="Add contribution"
                              >
                                <Plus size={12} /> Add
                              </button>
                              {/* View only shown when contributions exist */}
                              {hasContribs && (
                                <button
                                  onClick={() => setExpandedMember(isExpanded ? null : m.id)}
                                  style={iconBtn(isExpanded ? '#455a64' : '#1976d2')}
                                  title={isExpanded ? 'Collapse' : 'View & edit contributions'}
                                >
                                  {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                  {isExpanded ? 'Collapse' : 'View'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded contributions sub-table */}
                        {isExpanded && hasContribs && (
                          <tr>
                            <td colSpan="7" style={{ padding: 0, background: '#f9fbe7', borderBottom: '2px solid #aed581' }}>
                              <div style={{ padding: '14px 28px 18px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#558b2f' }}>
                                    Contributions — {m.firstName} {m.lastName}
                                  </p>
                                  <button
                                    onClick={() => openAdd(m)}
                                    style={{ ...iconBtn('#2e7d32'), fontSize: '11px', padding: '4px 10px', minHeight: 'unset' }}
                                  >
                                    <Plus size={11} /> Add Another
                                  </button>
                                </div>

                                <div style={{ overflowX: 'auto' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '580px' }}>
                                    <colgroup>
                                      <col style={{ width: '14%' }} />
                                      <col style={{ width: '14%' }} />
                                      <col style={{ width: '22%' }} />
                                      <col style={{ width: '24%' }} />
                                      <col style={{ width: '26%' }} />
                                    </colgroup>
                                    <thead>
                                      <tr>
                                        <th style={subTh('left')}>Payment Date</th>
                                        <th style={subTh('right')}>Amount</th>
                                        <th style={subTh('left')}>Notes</th>
                                        <th style={subTh('center')}>
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            <User size={11} /> Edited By
                                          </span>
                                        </th>
                                        <th style={subTh('center')}>Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {m.contributions.map((c) => (
                                        <tr key={c.id} style={{ background: 'white' }}>
                                          <td style={subTd('left')}>{fmtDate(c.paymentDate)}</td>
                                          <td style={subTd('right', { fontWeight: 600, color: '#2e7d32' })}>
                                            {fmt(c.amount)}
                                          </td>
                                          <td style={subTd('left', { color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>
                                            {c.notes || '—'}
                                          </td>
                                          <td style={subTd('center')}>
                                            <EditedByBadge editedBy={c.editedBy} editedAt={c.editedAt} />
                                          </td>
                                          <td style={subTd('center')}>
                                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                                              <button style={iconBtn('#1976d2')} onClick={() => openEdit(c)}>
                                                <Pencil size={12} /> Edit
                                              </button>
                                              <button style={iconBtn('#c62828')} onClick={() => setDeleteConfirm(c.id)}>
                                                <Trash2 size={12} /> Delete
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
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
                      <td style={{ textAlign: 'right', color: '#2e7d32' }}>
                        {fmt(filtered.reduce((s, m) => s + Number(m.totalSeedCapital || 0), 0))}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {filtered.reduce((s, m) => s + Number(m.contributionCount || 0), 0)}
                      </td>
                      <td colSpan="2"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* ── MOBILE CARD LIST ───────────────────────────────────── */}
            <div className="seed-mobile-list">
              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>No records found</div>
              ) : (
                <>
                  {filtered.map((m, i) => <MemberCard key={m.id} m={m} index={i} />)}
                  <div style={{
                    background: '#f5f5f5', border: '1px solid #e0e0e0',
                    borderRadius: '10px', padding: '14px 16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontWeight: 700,
                  }}>
                    <span style={{ fontSize: '13px', color: '#555' }}>
                      Total ({filtered.reduce((s, m) => s + Number(m.contributionCount || 0), 0)} contributions)
                    </span>
                    <span style={{ fontSize: '15px', color: '#2e7d32' }}>
                      {fmt(filtered.reduce((s, m) => s + Number(m.totalSeedCapital || 0), 0))}
                    </span>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ── Add Contribution Modal ──────────────────────────────────────── */}
        {addingMember && (
          <div className="modal-overlay" onClick={closeAdd}>
            <div
              className="modal-content seed-modal-content"
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '440px', width: '100%', boxSizing: 'border-box' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '6px' }}>
                <Sprout size={20} color="#2e7d32" />
                <h2 style={{ margin: 0, fontSize: '18px' }}>Add Contribution</h2>
              </div>
              <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#666' }}>
                Member: <strong>{addingMember.firstName} {addingMember.lastName}</strong>
              </p>

              <form onSubmit={handleAddSave}>
                <ContribFormFields form={addForm} setForm={setAddForm} error={addError} />
                <div className="modal-actions seed-modal-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={closeAdd}
                    disabled={addLoading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <X size={14} /> Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={addLoading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: addLoading ? 0.65 : 1 }}
                  >
                    <Plus size={14} /> {addLoading ? 'Saving…' : 'Add Contribution'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Edit Contribution Modal ─────────────────────────────────────── */}
        {editingContrib && (
          <div className="modal-overlay" onClick={closeEdit}>
            <div
              className="modal-content seed-modal-content"
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '440px', width: '100%', boxSizing: 'border-box' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '18px' }}>
                <Sprout size={20} color="#2e7d32" />
                <h2 style={{ margin: 0, fontSize: '18px' }}>Edit Contribution</h2>
              </div>

              <form onSubmit={handleEditSave}>
                <ContribFormFields form={editForm} setForm={setEditForm} error={editError} />
                <div className="modal-actions seed-modal-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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
            <div
              className="modal-content seed-modal-content"
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '420px', width: '100%', boxSizing: 'border-box' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '12px' }}>
                <AlertTriangle size={22} color="#c62828" />
                <h2 style={{ margin: 0, color: '#c62828' }}>Delete Contribution?</h2>
              </div>
              <p style={{ color: '#555', fontSize: '14px', marginBottom: '20px' }}>
                This will permanently remove this seed capital contribution. The member's total will update automatically.
              </p>
              <div className="modal-actions seed-modal-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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