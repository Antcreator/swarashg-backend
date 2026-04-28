import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  KeyRound,
  Eye,
  EyeOff,
  UserPlus,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Trash2,
  RefreshCw,
  ShieldCheck,
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  X,
  Check,
  Circle,
} from 'lucide-react';
import { adminsAPI } from '../../Service/Api';
import Navbar from '../Navbar/navbar';

const AdminManagement = () => {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const [admins, setAdmins]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResetModal, setShowResetModal]   = useState(false);
  const [selectedAdmin, setSelectedAdmin]     = useState(null);
  const [saving, setSaving]     = useState(false);

  const [createForm, setCreateForm] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '', role: 'admin',
  });
  const [resetForm, setResetForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showPass, setShowPass]           = useState(false);
  const [showResetPass, setShowResetPass] = useState(false);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminsAPI.getAll();
      setAdmins(res.data.admins || []);
    } catch {
      showToast('Failed to load admins', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (createForm.password !== createForm.confirmPassword) {
      showToast('Passwords do not match', 'error'); return;
    }
    if (createForm.password.length < 8) {
      showToast('Password must be at least 8 characters', 'error'); return;
    }
    setSaving(true);
    try {
      const res = await adminsAPI.create({
        firstName: createForm.firstName,
        lastName:  createForm.lastName,
        email:     createForm.email,
        password:  createForm.password,
        role:      createForm.role,
      });
      showToast(res.data.message);
      setShowCreateModal(false);
      setCreateForm({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', role: 'admin' });
      fetchAdmins();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create admin', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (resetForm.newPassword !== resetForm.confirmPassword) {
      showToast('Passwords do not match', 'error'); return;
    }
    if (resetForm.newPassword.length < 8) {
      showToast('Password must be at least 8 characters', 'error'); return;
    }
    setSaving(true);
    try {
      const res = await adminsAPI.resetPassword(selectedAdmin.id, resetForm.newPassword);
      showToast(res.data.message);
      setShowResetModal(false);
      setResetForm({ newPassword: '', confirmPassword: '' });
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to reset password', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (admin) => {
    const action = admin.isActive ? 'deactivate' : 'activate';
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${admin.email}?`)) return;
    try {
      const res = await adminsAPI.toggleActive(admin.id);
      showToast(res.data.message);
      fetchAdmins();
    } catch (err) {
      showToast(err.response?.data?.message || `Failed to ${action} admin`, 'error');
    }
  };

  const handleDelete = async (admin) => {
    if (!window.confirm(`Permanently delete ${admin.email}? This cannot be undone.`)) return;
    try {
      const res = await adminsAPI.delete(admin.id);
      showToast(res.data.message);
      fetchAdmins();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete admin', 'error');
    }
  };

  const getRoleBadge = (role) => {
    if (role === 'staff') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fff8e1', color: '#e65100', padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
          <Eye size={12} /> Staff
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#e8eaf6', color: '#283593', padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
        <KeyRound size={12} /> Admin
      </span>
    );
  };

  const inputSt = {
    width: '100%', padding: '10px 12px', border: '1.5px solid #ddd',
    borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', marginTop: '6px',
  };
  const labelSt = { fontSize: '13px', fontWeight: 600, color: '#444', display: 'block', marginTop: '14px' };

  /* ── Responsive card for mobile admin rows ── */
  const AdminCard = ({ admin, idx }) => {
    const isMe = admin.id === currentUser.id;
    return (
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
        borderLeft: '4px solid #1a1a2e',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        {/* Top row: name + badges */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {admin.firstName} {admin.lastName}
              {isMe && (
                <span style={{ background: '#e3f2fd', color: '#1565c0', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>You</span>
              )}
            </div>
            <div style={{ color: '#555', fontSize: '13px', marginTop: '2px' }}>{admin.email}</div>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {getRoleBadge(admin.role)}
            {admin.isActive
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#e8f5e9', color: '#2e7d32', padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}><CheckCircle2 size={11} /> Active</span>
              : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ffebee', color: '#c62828', padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}><XCircle size={11} /> Inactive</span>
            }
          </div>
        </div>

        {/* Created date */}
        <div style={{ fontSize: '12px', color: '#999' }}>
          Created: {new Date(admin.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>

        {/* Actions */}
        {!isMe ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => { setSelectedAdmin(admin); setResetForm({ newPassword: '', confirmPassword: '' }); setShowResetModal(true); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 14px', background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
            >
              <RefreshCw size={12} /> Reset Password
            </button>
            <button
              onClick={() => handleToggle(admin)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 14px', background: admin.isActive ? '#fff8e1' : '#e8f5e9', color: admin.isActive ? '#e65100' : '#2e7d32', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
            >
              {admin.isActive ? <><XCircle size={12} /> Deactivate</> : <><CheckCircle2 size={12} /> Activate</>}
            </button>
            <button
              onClick={() => handleDelete(admin)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 14px', background: '#ffebee', color: '#c62828', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        ) : (
          <span style={{ color: '#bbb', fontSize: '12px' }}>Your account</span>
        )}
      </div>
    );
  };

  return (
    <>
      <style>{`
        .am-table-wrap { display: block; }
        .am-cards-wrap  { display: none; }

        @media (max-width: 768px) {
          .am-table-wrap { display: none !important; }
          .am-cards-wrap  { display: flex !important; flex-direction: column; gap: 12px; }
          .am-header      { flex-direction: column !important; align-items: flex-start !important; }
          .am-stats-grid  { grid-template-columns: repeat(2, 1fr) !important; }
          .am-modal-inner { padding: 20px !important; }
          .am-name-grid   { grid-template-columns: 1fr !important; }
          .am-toast       { left: 16px !important; right: 16px !important; bottom: 16px !important; }
        }

        @media (max-width: 480px) {
          .am-stats-grid  { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>
        <Navbar />
        <div style={{ padding: '16px', fontFamily: 'sans-serif', maxWidth: '1100px', margin: '0 auto' }}>

          {/* Header */}
          <div className="am-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <Link to="/admin/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#1976d2', textDecoration: 'none', fontSize: '14px' }}>
                <ArrowLeft size={14} /> Dashboard
              </Link>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '6px 0 0', fontSize: 'clamp(18px, 4vw, 24px)' }}>
                <KeyRound size={22} /> Admin Management
              </h1>
              <p style={{ margin: '4px 0 0', color: '#666', fontSize: '13px' }}>Manage admin accounts for Swara SHG</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: '#1a1a2e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap' }}
            >
              <UserPlus size={16} /> Add Admin
            </button>
          </div>

          {/* Info banners */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '8px', padding: '12px 16px', marginBottom: '10px', fontSize: '13px', color: '#2e7d32' }}>
            <ShieldCheck size={16} style={{ marginTop: '1px', flexShrink: 0 }} />
            <span><strong>Admin accounts</strong> have full access to all system data. Only create accounts for trusted personnel. You cannot deactivate or delete your own account.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', padding: '12px 16px', marginBottom: '24px', fontSize: '13px', color: '#e65100' }}>
            <Eye size={16} style={{ marginTop: '1px', flexShrink: 0 }} />
            <span><strong>Staff accounts</strong> can view all pages but cannot perform any actions (add, edit, delete, approve, etc).</span>
          </div>

          {/* Summary stats */}
          <div className="am-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Total',    value: admins.length,                                 color: '#1a1a2e', bg: '#f5f5f5', Icon: Users },
              { label: 'Admins',   value: admins.filter(a => a.role === 'admin').length, color: '#283593', bg: '#e8eaf6', Icon: KeyRound },
              { label: 'Staff',    value: admins.filter(a => a.role === 'staff').length, color: '#e65100', bg: '#fff8e1', Icon: Eye },
              { label: 'Active',   value: admins.filter(a => a.isActive).length,         color: '#2e7d32', bg: '#e8f5e9', Icon: UserCheck },
              { label: 'Inactive', value: admins.filter(a => !a.isActive).length,        color: '#c62828', bg: '#ffebee', Icon: UserX },
            ].map(c => (
              <div key={c.label} style={{ background: c.bg, borderRadius: '12px', padding: '14px 16px', borderLeft: `4px solid ${c.color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#666', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>
                  <c.Icon size={12} color={c.color} /> {c.label}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>Loading admins...</div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="am-table-wrap" style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '700px' }}>
                  <thead>
                    <tr style={{ background: '#1a1a2e' }}>
                      {['#', 'Name', 'Email', 'Role', 'Created', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '14px 16px', color: 'white', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((admin, idx) => {
                      const isMe = admin.id === currentUser.id;
                      return (
                        <tr key={admin.id} style={{ borderBottom: '1px solid #f0f0f0', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ padding: '14px 16px', color: '#888' }}>{idx + 1}</td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              {admin.firstName} {admin.lastName}
                              {isMe && (
                                <span style={{ background: '#e3f2fd', color: '#1565c0', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>You</span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', color: '#555' }}>{admin.email}</td>
                          <td style={{ padding: '14px 16px' }}>{getRoleBadge(admin.role)}</td>
                          <td style={{ padding: '14px 16px', color: '#888', fontSize: '13px', whiteSpace: 'nowrap' }}>
                            {new Date(admin.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            {admin.isActive
                              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#e8f5e9', color: '#2e7d32', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}><CheckCircle2 size={13} /> Active</span>
                              : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#ffebee', color: '#c62828', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}><XCircle size={13} /> Inactive</span>
                            }
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {!isMe && (
                                <>
                                  <button
                                    onClick={() => { setSelectedAdmin(admin); setResetForm({ newPassword: '', confirmPassword: '' }); setShowResetModal(true); }}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}
                                  >
                                    <RefreshCw size={12} /> Reset Password
                                  </button>
                                  <button
                                    onClick={() => handleToggle(admin)}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', background: admin.isActive ? '#fff8e1' : '#e8f5e9', color: admin.isActive ? '#e65100' : '#2e7d32', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}
                                  >
                                    {admin.isActive ? <><XCircle size={12} /> Deactivate</> : <><CheckCircle2 size={12} /> Activate</>}
                                  </button>
                                  <button
                                    onClick={() => handleDelete(admin)}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', background: '#ffebee', color: '#c62828', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}
                                  >
                                    <Trash2 size={12} /> Delete
                                  </button>
                                </>
                              )}
                              {isMe && <span style={{ color: '#bbb', fontSize: '12px', padding: '5px 0' }}>Your account</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {admins.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>No admins found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="am-cards-wrap">
                {admins.length === 0
                  ? <div style={{ textAlign: 'center', padding: '40px', color: '#aaa', background: 'white', borderRadius: '12px' }}>No admins found</div>
                  : admins.map((admin, idx) => <AdminCard key={admin.id} admin={admin} idx={idx} />)
                }
              </div>
            </>
          )}
        </div>

        {/* ── CREATE ADMIN MODAL ── */}
        {showCreateModal && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}
            onClick={() => setShowCreateModal(false)}
          >
            <div
              className="am-modal-inner"
              style={{ background: 'white', borderRadius: '14px', padding: '28px', width: '100%', maxWidth: '480px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', margin: 'auto' }}
              onClick={e => e.stopPropagation()}
            >
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 4px', color: '#1a1a2e', fontSize: '20px' }}>
                <KeyRound size={20} /> Add New Admin
              </h2>
              <p style={{ margin: '0 0 20px', color: '#888', fontSize: '13px' }}>Create a new administrator account</p>

              <form onSubmit={handleCreate}>
                <div className="am-name-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelSt}>First Name *</label>
                    <input value={createForm.firstName} required
                      onChange={e => setCreateForm({ ...createForm, firstName: e.target.value })}
                      style={inputSt} />
                  </div>
                  <div>
                    <label style={labelSt}>Last Name *</label>
                    <input value={createForm.lastName} required
                      onChange={e => setCreateForm({ ...createForm, lastName: e.target.value })}
                      style={inputSt} />
                  </div>
                </div>

                <label style={labelSt}>Email Address *</label>
                <input type="email" value={createForm.email} required
                  onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                  style={inputSt} />

                <label style={labelSt}>Role *</label>
                <select
                  value={createForm.role}
                  onChange={e => setCreateForm({ ...createForm, role: e.target.value })}
                  style={inputSt}
                >
                  <option value="admin">Admin — Full access</option>
                  <option value="staff">Staff — View only</option>
                </select>
                {createForm.role === 'staff' && (
                  <p style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#e65100', marginTop: '6px' }}>
                    <AlertTriangle size={13} /> Staff can view all pages but cannot add, edit, delete, or approve anything.
                  </p>
                )}

                <label style={labelSt}>
                  Password * <span style={{ color: '#888', fontWeight: 400 }}>(min 8 characters)</span>
                </label>
                <div style={{ position: 'relative', marginTop: '6px' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={createForm.password} required minLength={8}
                    onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="Strong password"
                    style={{ ...inputSt, marginTop: 0, paddingRight: '40px' }}
                  />
                  <span
                    onClick={() => setShowPass(p => !p)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#888', display: 'flex' }}
                  >
                    {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </span>
                </div>

                <label style={labelSt}>Confirm Password *</label>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={createForm.confirmPassword} required
                  onChange={e => setCreateForm({ ...createForm, confirmPassword: e.target.value })}
                  placeholder="Repeat password" style={inputSt}
                />

                {createForm.password && createForm.confirmPassword && createForm.password !== createForm.confirmPassword && (
                  <p style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#c62828', fontSize: '12px', marginTop: '6px' }}>
                    <AlertTriangle size={13} /> Passwords do not match
                  </p>
                )}

                {createForm.password && (
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {[
                      { test: createForm.password.length >= 8,          label: '8+ characters' },
                      { test: /[A-Z]/.test(createForm.password),        label: 'Uppercase letter' },
                      { test: /[0-9]/.test(createForm.password),        label: 'Number' },
                      { test: /[^A-Za-z0-9]/.test(createForm.password), label: 'Special character' },
                    ].map(r => (
                      <span key={r.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', marginRight: '6px', color: r.test ? '#2e7d32' : '#bbb', fontWeight: 600 }}>
                        {r.test ? <Check size={12} /> : <Circle size={12} />} {r.label}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    <X size={15} /> Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: '#1a1a2e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, opacity: saving ? 0.7 : 1 }}
                  >
                    <CheckCircle2 size={15} /> {saving ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── RESET PASSWORD MODAL ── */}
        {showResetModal && selectedAdmin && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}
            onClick={() => setShowResetModal(false)}
          >
            <div
              className="am-modal-inner"
              style={{ background: 'white', borderRadius: '14px', padding: '28px', width: '100%', maxWidth: '440px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', margin: 'auto' }}
              onClick={e => e.stopPropagation()}
            >
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 4px', color: '#1a1a2e', fontSize: '20px' }}>
                <KeyRound size={20} /> Reset Password
              </h2>
              <p style={{ margin: '0 0 20px', color: '#888', fontSize: '13px' }}>
                Resetting password for <strong>{selectedAdmin.firstName} {selectedAdmin.lastName}</strong> ({selectedAdmin.email})
              </p>

              <form onSubmit={handleReset}>
                <label style={labelSt}>
                  New Password * <span style={{ color: '#888', fontWeight: 400 }}>(min 8 characters)</span>
                </label>
                <div style={{ position: 'relative', marginTop: '6px' }}>
                  <input
                    type={showResetPass ? 'text' : 'password'}
                    value={resetForm.newPassword} required minLength={8}
                    onChange={e => setResetForm({ ...resetForm, newPassword: e.target.value })}
                    placeholder="New strong password"
                    style={{ ...inputSt, marginTop: 0, paddingRight: '40px' }}
                  />
                  <span
                    onClick={() => setShowResetPass(p => !p)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#888', display: 'flex' }}
                  >
                    {showResetPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </span>
                </div>

                <label style={labelSt}>Confirm New Password *</label>
                <input
                  type={showResetPass ? 'text' : 'password'}
                  value={resetForm.confirmPassword} required
                  onChange={e => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                  placeholder="Repeat new password" style={inputSt}
                />

                {resetForm.newPassword && resetForm.confirmPassword && resetForm.newPassword !== resetForm.confirmPassword && (
                  <p style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#c62828', fontSize: '12px', marginTop: '6px' }}>
                    <AlertTriangle size={13} /> Passwords do not match
                  </p>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    <X size={15} /> Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: '#c62828', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, opacity: saving ? 0.7 : 1 }}
                  >
                    <KeyRound size={15} /> {saving ? 'Saving...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="am-toast" style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, padding: '14px 20px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', background: toast.type === 'error' ? '#c62828' : '#2e7d32', color: 'white', maxWidth: 'calc(100vw - 32px)' }}>
            {toast.type === 'error' ? <XCircle size={17} /> : <CheckCircle2 size={17} />}
            {toast.msg}
          </div>
        )}
      </div>
    </>
  );
};

export default AdminManagement;