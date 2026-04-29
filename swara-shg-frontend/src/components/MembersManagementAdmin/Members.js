import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { membersAPI, registrationFeeAPI } from '../../Service/Api';
import { useIsStaff } from '../Protected Route/Protectedroute';
import Navbar from '../Navbar/navbar';
import './Members.css';
import { Pencil, Trash2 } from 'lucide-react';

const Members = () => {
  const isStaff = useIsStaff();
  const [members, setMembers]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [showModal, setShowModal]         = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);

  // ── per-field error state ──────────────────────────────────────
  const [formErrors, setFormErrors] = useState({});

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});   // clear previous errors

    try {
      const res = await membersAPI.create({
        email:      formData.email,
        password:   formData.password,
        firstName:  formData.firstName,
        lastName:   formData.lastName,
        phone:      formData.phone,
        dateJoined: formData.dateJoined,
      });

      const fee = Number(formData.registrationFee);
      if (fee > 0) {
        const newMemberId = res.data.member?.id || res.data.memberId;
        if (newMemberId) {
          await registrationFeeAPI.save({
            memberId: newMemberId,
            amount:   fee,
            notes:    'Recorded at registration',
          });
        }
      }

      alert('Member created successfully');
      setShowModal(false);
      setFormErrors({});
      setFormData({
        email: '', password: '', firstName: '', lastName: '',
        phone: '',
        dateJoined: new Date().toISOString().split('T')[0],
        registrationFee: '',
      });
      fetchMembers();

    } catch (error) {
      const message = error.response?.data?.message || '';

      // ── Show inline error only on the email field for duplicate emails ──
      if (
        message.toLowerCase().includes('email') &&
        (message.toLowerCase().includes('already') ||
         message.toLowerCase().includes('exists')  ||
         message.toLowerCase().includes('taken')   ||
         error.response?.status === 409)
      ) {
        setFormErrors({ email: 'This email is already registered. Please use a different email.' });
      } else {
        // Any other error (server error, validation, etc.) → generic alert
        alert(message || 'Failed to create member');
      }
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
    try {
      await membersAPI.update(editingMember.id, editFormData);
      alert('Member updated successfully');
      setShowEditModal(false);
      setEditingMember(null);
      fetchMembers();
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
      alert('Member deleted successfully');
      fetchMembers();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete member');
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-KE', {
      style: 'currency', currency: 'KES', minimumFractionDigits: 0,
    }).format(amount || 0);

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
          <div className="modal-overlay" onClick={() => { setShowModal(false); setFormErrors({}); }}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h2>Add New Member</h2>

              <form onSubmit={handleSubmit}>
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
                    // clear the email error as soon as the user starts typing a new address
                    onChange={e => {
                      setFormData({ ...formData, email: e.target.value });
                      if (formErrors.email) setFormErrors({ ...formErrors, email: '' });
                    }}
                    style={formErrors.email ? { borderColor: '#e53935' } : {}}
                  />
                  {/* inline error — only shown for duplicate email */}
                  {formErrors.email && (
                    <p style={{
                      color:      '#e53935',
                      fontSize:   '12px',
                      marginTop:  '4px',
                      marginBottom: 0,
                    }}>
                      {formErrors.email}
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
                    onClick={() => { setShowModal(false); setFormErrors({}); }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Create Member
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── EDIT MEMBER MODAL ── */}
        {showEditModal && editingMember && !isStaff && (
          <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h2>Edit Member: {editingMember.firstName} {editingMember.lastName}</h2>

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
                <span style={{ fontSize: '16px' }}>🪪</span>
                <span>
                  Member ID:{' '}
                  <strong style={{ fontFamily: 'monospace', fontSize: '15px' }}>
                    {editingMember.memberId}
                  </strong>
                  {' '}(cannot be changed)
                </span>
              </div>

              <form onSubmit={handleEditSubmit}>
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
                    onClick={() => setShowEditModal(false)}
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
        )}
      </div>
    </>
  );
};

export default Members;