import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { membersAPI } from '../../Service/Api';
import { useIsStaff } from '../Protected Route/Protectedroute';
import Navbar from '../Navbar/navbar';
import './Members.css';
import { Search, X, UserPlus, Users } from 'lucide-react';

const Members = () => {
  const isStaff = useIsStaff();

  const [members, setMembers]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [searchTerm, setSearchTerm]   = useState('');
  const [showAddModal, setShowAddModal]   = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', phone: '', email: '',
    idNumber: '', dateJoined: '', isActive: true,
  });

  useEffect(() => { fetchMembers(); }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await membersAPI.getAll();
      setMembers(res.data.members || []);
    } catch (err) {
      setError('Failed to load members');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      await membersAPI.create(formData);
      setShowAddModal(false);
      resetForm();
      fetchMembers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add member');
    }
  };

  const handleEditMember = async (e) => {
    e.preventDefault();
    try {
      await membersAPI.update(selectedMember.id, formData);
      setShowEditModal(false);
      resetForm();
      fetchMembers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update member');
    }
  };

  const handleDeleteMember = async (id) => {
    if (!window.confirm('Are you sure you want to delete this member?')) return;
    try {
      await membersAPI.delete(id);
      fetchMembers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete member');
    }
  };

  const openEditModal = (member) => {
    setSelectedMember(member);
    setFormData({
      firstName:  member.firstName  || '',
      lastName:   member.lastName   || '',
      phone:      member.phone      || '',
      email:      member.email      || '',
      idNumber:   member.idNumber   || '',
      dateJoined: member.dateJoined ? member.dateJoined.split('T')[0] : '',
      isActive:   member.isActive   ?? true,
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({ firstName: '', lastName: '', phone: '', email: '', idNumber: '', dateJoined: '', isActive: true });
    setSelectedMember(null);
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  // ── Search filter ─────────────────────────────────────────────────────────
  // Matches against name, phone, email, ID number — case-insensitive
  const filteredMembers = members.filter(m => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
      (m.phone    || '').toLowerCase().includes(q) ||
      (m.email    || '').toLowerCase().includes(q) ||
      (m.idNumber || '').toLowerCase().includes(q)
    );
  });

  return (
    <>
      <Navbar />
      <div className="admin-container">
        <Link to="/admin/dashboard" style={{ color: '#1976d2', textDecoration: 'none', fontSize: '14px' }}>
          ← Dashboard
        </Link>

        <div className="page-header">
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={24} /> Members
            </h1>
            <p style={{ color: '#888', margin: '4px 0 0', fontSize: '14px' }}>
              {filteredMembers.length} of {members.length} member{members.length !== 1 ? 's' : ''}
              {searchTerm && ` matching "${searchTerm}"`}
            </p>
          </div>
          {!isStaff && (
            <button className="btn-primary" onClick={() => { resetForm(); setShowAddModal(true); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <UserPlus size={15} /> Add Member
            </button>
          )}
        </div>

        {/* ── Search bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'white', border: '1.5px solid #e0e0e0',
          borderRadius: '10px', padding: '10px 14px',
          marginBottom: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <Search size={16} color="#888" style={{ flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search by name, phone, email or ID number…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: '14px', background: 'transparent', color: '#1a1a2e',
            }}
            autoComplete="off"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
              title="Clear search"
            >
              <X size={15} color="#aaa" />
            </button>
          )}
        </div>

        {/* ── Members table ── */}
        {loading ? (
          <div className="loading">Loading members…</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : filteredMembers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#aaa' }}>
            {searchTerm
              ? <>No members found matching <strong>"{searchTerm}"</strong>. <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', color: '#1976d2', cursor: 'pointer', padding: 0 }}>Clear search</button></>
              : 'No members yet.'}
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>ID Number</th>
                  <th>Date Joined</th>
                  <th>Status</th>
                  {!isStaff && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member, index) => (
                  <tr key={member.id}>
                    <td>{index + 1}</td>
                    <td>
                      <strong>{member.firstName} {member.lastName}</strong>
                    </td>
                    <td>{member.phone || '—'}</td>
                    <td>{member.email || '—'}</td>
                    <td>{member.idNumber || '—'}</td>
                    <td>{formatDate(member.dateJoined)}</td>
                    <td>
                      <span style={{
                        padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                        background: member.isActive ? '#e8f5e9' : '#ffebee',
                        color:      member.isActive ? '#2e7d32' : '#c62828',
                      }}>
                        {member.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {!isStaff && (
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <Link
                            to={`/admin/members/${member.id}`}
                            className="btn-secondary"
                            style={{ fontSize: '12px', padding: '4px 10px' }}
                          >
                            View
                          </Link>
                          <button
                            className="btn-primary"
                            style={{ fontSize: '12px', padding: '4px 10px', background: '#1976d2' }}
                            onClick={() => openEditModal(member)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-secondary"
                            style={{ fontSize: '12px', padding: '4px 10px', color: '#c62828', borderColor: '#c62828' }}
                            onClick={() => handleDeleteMember(member.id)}
                          >
                            Delete
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

        {/* ── Add Member Modal ── */}
        {showAddModal && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h2>Add New Member</h2>
              <form onSubmit={handleAddMember}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>First Name *</label>
                    <input required value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Last Name *</label>
                    <input required value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Phone *</label>
                    <input required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>ID Number</label>
                    <input value={formData.idNumber} onChange={e => setFormData({ ...formData, idNumber: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Date Joined</label>
                    <input type="date" value={formData.dateJoined} onChange={e => setFormData({ ...formData, dateJoined: e.target.value })} />
                  </div>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Add Member</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Edit Member Modal ── */}
        {showEditModal && selectedMember && (
          <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h2>Edit Member</h2>
              <form onSubmit={handleEditMember}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>First Name *</label>
                    <input required value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Last Name *</label>
                    <input required value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Phone *</label>
                    <input required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>ID Number</label>
                    <input value={formData.idNumber} onChange={e => setFormData({ ...formData, idNumber: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Date Joined</label>
                    <input type="date" value={formData.dateJoined} onChange={e => setFormData({ ...formData, dateJoined: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select value={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.value === 'true' })}>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Save Changes</button>
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