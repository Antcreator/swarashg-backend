import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { membersAPI, registrationFeeAPI } from '../../Service/Api';
import { useIsStaff } from '../Protected Route/Protectedroute';
import Navbar from '../Navbar/navbar';
import './Members.css';
import { Pencil, Trash2, BadgeCheck, X } from 'lucide-react';

const Members = () => {
  const isStaff = useIsStaff();
  const [members, setMembers]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [showModal, setShowModal]         = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [formErrors, setFormErrors]       = useState({});
  const [submitting, setSubmitting]       = useState(false);
  const [successMsg, setSuccessMsg]       = useState('');

  const [formData, setFormData] = useState({
    email: '', password: '', firstName: '', lastName: '',
    phone: '',
    dateJoined: new Date().toISOString().split('T')[0],
    registrationFee: '',
  });

  const [editFormData, setEditFormData] = useState({
    firstName: '', lastName: '', phone: '', dateJoined: '',
  });

  useEffect(() => { fetchMembers(); }, []);

  // Lock body scroll when any modal is open
  useEffect(() => {
    if (showModal || showEditModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showModal, showEditModal]);

  const fetchMembers = async () => {
    try {
      const response = await membersAPI.getAll();
      setMembers(response.data.members);
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const isDuplicateEmailError = (error) => {
    const status  = error.response?.status;
    const message = (error.response?.data?.message || '').toLowerCase();
    if (status === 409) return true;
    if (
      status === 400 &&
      message.includes('email') &&
      (message.includes('already') ||
       message.includes('unique')  ||
       message.includes('exists')  ||
       message.includes('taken'))
    ) return true;
    return false;
  };

  const resetForm = () => {
    setFormData({
      email: '', password: '', firstName: '', lastName: '',
      phone: '',
      dateJoined: new Date().toISOString().split('T')[0],
      registrationFee: '',
    });
    setFormErrors({});
  };

  const closeAddModal = () => {
    setShowModal(false);
    resetForm();
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingMember(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setFormErrors({});
    setSubmitting(true);

    // ── Step 1: Create the member ────────────────────────────────
    let newMemberId   = null;
    let registrationFee = Number(formData.registrationFee);

    try {
      const res = await membersAPI.create({
        email:      formData.email,
        password:   formData.password,
        firstName:  formData.firstName,
        lastName:   formData.lastName,
        phone:      formData.phone,
        dateJoined: formData.dateJoined,
      });
      newMemberId = res.data.member?.id || res.data.memberId;
    } catch (error) {
      console.error('Create member failed →', 'status:', error.response?.status, 'body:', error.response?.data);
      if (isDuplicateEmailError(error)) {
        setFormErrors({ email: 'This email is already registered. Please use a different email.' });
      } else {
        alert(error.response?.data?.message || 'Failed to create member');
      }
      setSubmitting(false);
      return;
    }

    // ── Step 2: Close modal + show success IMMEDIATELY ───────────
    setSubmitting(false);

    // Use requestAnimationFrame to ensure React flushes the state
    // update on mobile before unmounting the modal
    requestAnimationFrame(() => {
      setShowModal(false);
      resetForm();
      showSuccess('Member added successfully!');
      fetchMembers();
    });

    // ── Step 3: Save fee silently in the background ──────────────
    if (registrationFee > 0 && newMemberId) {
      registrationFeeAPI
        .save({ memberId: newMemberId, amount: registrationFee, notes: 'Recorded at registration' })
        .catch(feeError => {
          console.warn('Registration fee recording failed (member was still created):', feeError);
        });
    }
  };

  const handleEdit = (member) => {
    setEditingMember(member);
    setEditFormData({
      firstName:  member.firstName,
      lastName:   member.lastName,
      phone:      member.phone,
      dateJoined: member.dateJoined,
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await membersAPI.update(editingMember.id, editFormData);
      requestAnimationFrame(() => {
        setShowEditModal(false);
        setEditingMember(null);
        fetchMembers();
        showSuccess('Member updated successfully!');
      });
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update member');
    }
  };

  const handleDelete = async (member) => {
    if (!window.confirm(
      `Are you sure you want to permanently delete ${member.firstName} ${member.lastName} (${member.memberId})? This cannot be undone.`
    )) return;
    try {
      await membersAPI.deletePermanent(member.id);
      fetchMembers();
      showSuccess('Member deleted successfully.');
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete member');
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-KE', {
      style: 'currency', currency: 'KES', minimumFractionDigits: 0,
    }).format(amount || 0);

  // ── Shared modal styles ──────────────────────────────────────
  const overlayStyle = {
    position:        'fixed',
    inset:           0,
    background:      'rgba(0,0,0,0.55)',
    zIndex:          1000,
    display:         'flex',
    alignItems:      'flex-end',      // bottom sheet on mobile
    justifyContent:  'center',
    padding:         0,
    overflowY:       'auto',
    WebkitOverflowScrolling: 'touch',
  };

  const contentStyle = {
    background:      'white',
    borderRadius:    '20px 20px 0 0',
    width:           '100%',
    maxHeight:       '92dvh',
    overflowY:       'auto',
    WebkitOverflowScrolling: 'touch',
    padding:         '0 0 env(safe-area-inset-bottom)',
    position:        'relative',
  };

  const modalHeaderStyle = {
    display:         'flex',
    justifyContent:  'space-between',
    alignItems:      'center',
    padding:         '18px 20px 14px',
    borderBottom:    '1px solid #f0f0f0',
    position:        'sticky',
    top:             0,
    background:      'white',
    zIndex:          10,
    borderRadius:    '20px 20px 0 0',
  };

  const formBodyStyle = {
    padding: '16px 20px 24px',
  };

  return (
    <>
      <Navbar />
      <div className="admin-container">
        <Link
          to="/admin/dashboard"
          style={{ color: '#1976d2', textDecoration: 'none', fontSize: '14px' }}
        >
          ← Dashboard
        </Link>

        <div className="page-header">
          <h1>Members Management</h1>
          {!isStaff && (
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              + Add New Member
            </button>
          )}
        </div>

        {/* ── Success banner ── */}
        {successMsg && (
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          '10px',
            background:   '#e8f5e9',
            border:       '1px solid #a5d6a7',
            borderRadius: '10px',
            padding:      '12px 18px',
            marginBottom: '16px',
            color:        '#1b5e20',
            fontSize:     '14px',
            fontWeight:   600,
          }}>
            <BadgeCheck size={18} color="#2e7d32" />
            {successMsg}
          </div>
        )}

        {loading ? (
          <div className="loading">Loading members…</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Member ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Total Savings</th>
                  <th>Months Paid</th>
                  <th>Active Guarantees</th>
                  {!isStaff && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <span style={{
                        fontFamily:    'monospace',
                        fontWeight:    700,
                        background:    '#f0f4ff',
                        color:         '#1a3a8f',
                        padding:       '2px 8px',
                        borderRadius:  '6px',
                        fontSize:      '13px',
                        letterSpacing: '0.04em',
                        border:        '1px solid #c7d4f7',
                        whiteSpace:    'nowrap',
                      }}>
                        {member.memberId}
                      </span>
                    </td>
                    <td>{member.firstName} {member.lastName}</td>
                    <td>{member.email}</td>
                    <td>{member.phone}</td>
                    <td>{formatCurrency(member.total_savings)}</td>
                    <td>{member.monthsPaid}</td>
                    <td>{member.active_guarantees || 0}/3</td>
                    {!isStaff && (
                      <td>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          <button
                            className="btn-primary"
                            onClick={() => handleEdit(member)}
                            style={{
                              fontSize: '12px', padding: '5px 10px',
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            <Pencil size={13} /> Edit
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={() => handleDelete(member)}
                            style={{
                              fontSize: '12px', padding: '5px 10px',
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── ADD MEMBER MODAL ── */}
        {showModal && !isStaff && (
          <div
            style={overlayStyle}
            onMouseDown={closeAddModal}   /* desktop */
            onTouchStart={closeAddModal}  /* mobile — fires before click */
          >
            <div
              style={contentStyle}
              onMouseDown={e => e.stopPropagation()}
              onTouchStart={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
            >
              {/* Sticky header with close button */}
              <div style={modalHeaderStyle}>
                <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                  Add New Member
                </h2>
                <button
                  type="button"
                  onClick={closeAddModal}
                  style={{
                    background: '#f5f5f5', border: 'none',
                    borderRadius: '50%', width: 32, height: 32,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#555',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div style={formBodyStyle}>
                <form onSubmit={handleSubmit} onMouseDown={e => e.stopPropagation()}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>First Name *</label>
                      <input
                        type="text"
                        value={formData.firstName}
                        required
                        onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Last Name *</label>
                      <input
                        type="text"
                        value={formData.lastName}
                        required
                        onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={formData.email}
                      required
                      onChange={e => {
                        setFormData({ ...formData, email: e.target.value });
                        if (formErrors.email) setFormErrors({});
                      }}
                      style={formErrors.email ? { borderColor: '#e53935' } : {}}
                    />
                    {formErrors.email && (
                      <p style={{
                        color: '#e53935', fontSize: '12px',
                        marginTop: '4px', marginBottom: 0,
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}>
                        ⚠ {formErrors.email}
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Password *</label>
                    <input
                      type="password"
                      value={formData.password}
                      required
                      minLength="6"
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Phone *</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      required
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Date Joined</label>
                    <input
                      type="date"
                      value={formData.dateJoined}
                      onChange={e => setFormData({ ...formData, dateJoined: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Registration Fee (KES){' '}
                      <span style={{ color: '#888', fontWeight: 400 }}>— optional</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formData.registrationFee}
                      placeholder="Leave blank if not paid yet"
                      onChange={e => setFormData({ ...formData, registrationFee: e.target.value })}
                    />
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      You can also record or update this later on the Registration Fees page.
                    </p>
                  </div>

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={closeAddModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={submitting}
                    >
                      {submitting ? 'Creating…' : 'Create Member'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ── EDIT MEMBER MODAL ── */}
        {showEditModal && editingMember && !isStaff && (
          <div
            style={overlayStyle}
            onMouseDown={closeEditModal}
            onTouchStart={closeEditModal}
          >
            <div
              style={contentStyle}
              onMouseDown={e => e.stopPropagation()}
              onTouchStart={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
            >
              <div style={modalHeaderStyle}>
                <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                  Edit Member
                </h2>
                <button
                  type="button"
                  onClick={closeEditModal}
                  style={{
                    background: '#f5f5f5', border: 'none',
                    borderRadius: '50%', width: 32, height: 32,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#555',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div style={formBodyStyle}>
                <div style={{
                  background:   '#f0f4ff',
                  border:       '1px solid #c7d4f7',
                  borderRadius: '8px',
                  padding:      '10px 14px',
                  marginBottom: '16px',
                  fontSize:     '13px',
                  color:        '#1a3a8f',
                  display:      'flex',
                  alignItems:   'center',
                  gap:          '8px',
                }}>
                  <BadgeCheck size={16} color="#1a3a8f" />
                  <span>
                    Member ID:{' '}
                    <strong style={{ fontFamily: 'monospace', fontSize: '15px' }}>
                      {editingMember.memberId}
                    </strong>
                    {' '}(cannot be changed)
                  </span>
                </div>

                <form onSubmit={handleEditSubmit} onMouseDown={e => e.stopPropagation()}>
                  <div className="form-group">
                    <label>First Name *</label>
                    <input
                      type="text"
                      value={editFormData.firstName}
                      required
                      onChange={e => setEditFormData({ ...editFormData, firstName: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Last Name *</label>
                    <input
                      type="text"
                      value={editFormData.lastName}
                      required
                      onChange={e => setEditFormData({ ...editFormData, lastName: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Phone *</label>
                    <input
                      type="tel"
                      value={editFormData.phone}
                      required
                      onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Date Joined *</label>
                    <input
                      type="date"
                      value={editFormData.dateJoined}
                      required
                      onChange={e => setEditFormData({ ...editFormData, dateJoined: e.target.value })}
                    />
                  </div>

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={closeEditModal}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary">
                      Update Member
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Members;