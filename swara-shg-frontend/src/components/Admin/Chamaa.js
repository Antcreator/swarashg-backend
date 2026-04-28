import React, { useState, useEffect } from 'react';
import Navbar from '../Navbar/navbar';
import { Link } from 'react-router-dom';
import '../MembersManagementAdmin/Members.css';
import { chamaaAPI, membersAPI } from '../../Service/Api';
import { useIsStaff } from '../Protected Route/Protectedroute';

const Chamaa = () => {
  const isStaff = useIsStaff();
  const [cycles, setCycles]       = useState([]);
  const [members, setMembers]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedCycleId, setExpandedCycleId] = useState(null);
  const [participants, setParticipants]       = useState([]);
  const [showContribModal, setShowContribModal] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState(null);

  // ─── position-editing state ───────────────────────────────────
  // editingPositionId: the participant whose position cell is in edit mode
  // positionDraft:     the value shown in the input while editing
  const [editingPositionId, setEditingPositionId] = useState(null);
  const [positionDraft, setPositionDraft]         = useState('');
  const [positionSaving, setPositionSaving]       = useState(false);

  const [contribForm, setContribForm] = useState({
    amount: '', month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    paymentDate: new Date().toISOString().split('T')[0],
  });
  const createDefaults = {
    name: '', contributionAmount: '',
    startDate: new Date().toISOString().split('T')[0],
    memberIds: [],
  };
  const [createForm, setCreateForm] = useState(createDefaults);

  useEffect(() => { fetchCycles(); fetchMembers(); }, []);

  const fetchMembers = async () => {
    try { const res = await membersAPI.getAll(); setMembers(res.data.members); }
    catch (err) { console.error('Failed to fetch members:', err); }
  };

  const fetchCycles = async () => {
    try { const res = await chamaaAPI.getAllCycles(); setCycles(res.data.cycles); }
    catch (err) { console.error('Failed to fetch cycles:', err); }
    finally { setLoading(false); }
  };

  const toggleMember = (id) => {
    setCreateForm((prev) => ({
      ...prev,
      memberIds: prev.memberIds.includes(id)
        ? prev.memberIds.filter((m) => m !== id)
        : [...prev.memberIds, id],
    }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (createForm.memberIds.length === 0) { alert('Select at least one member'); return; }
    try {
      await chamaaAPI.createCycle({
        name: createForm.name,
        contributionAmount: Number(createForm.contributionAmount),
        startDate: createForm.startDate,
        memberIds: createForm.memberIds,
      });
      alert('Chamaa cycle created successfully');
      setShowCreateModal(false);
      setCreateForm(createDefaults);
      fetchCycles();
    } catch (err) { alert(err.response?.data?.message || 'Failed to create cycle'); }
  };

  const toggleExpand = async (cycleId) => {
    if (expandedCycleId === cycleId) {
      setExpandedCycleId(null);
      setParticipants([]);
      setEditingPositionId(null);
      return;
    }
    try {
      const res = await chamaaAPI.getCycleById(cycleId);
      setParticipants(res.data.participants);
      setExpandedCycleId(cycleId);
    } catch (err) { alert(err.response?.data?.message || 'Failed to load cycle details'); }
  };

  const openContribModal = (participant, cycle) => {
    setSelectedParticipant({ ...participant, contributionAmount: cycle.contributionAmount });
    setContribForm({
      amount: cycle.contributionAmount,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      paymentDate: new Date().toISOString().split('T')[0],
    });
    setShowContribModal(true);
  };

  const handleContribSubmit = async (e) => {
    e.preventDefault();
    try {
      await chamaaAPI.recordContribution({
        participantId: selectedParticipant.id,
        month: Number(contribForm.month),
        year: Number(contribForm.year),
        amount: Number(contribForm.amount),
        paymentDate: contribForm.paymentDate,
      });
      alert('Contribution recorded successfully');
      setShowContribModal(false);
      if (expandedCycleId) toggleExpand(expandedCycleId);
      fetchCycles();
    } catch (err) { alert(err.response?.data?.message || 'Failed to record contribution'); }
  };

  const handleMarkReceived = async (participantId) => {
    try {
      await chamaaAPI.markAsReceived({
        participantId,
        receivedDate: new Date().toISOString().split('T')[0],
      });
      alert('Marked as received');
      if (expandedCycleId) toggleExpand(expandedCycleId);
      fetchCycles();
    } catch (err) { alert(err.response?.data?.message || 'Failed to mark as received'); }
  };

  const handleEndCycle = async (cycleId) => {
    if (!window.confirm('End this chamaa cycle? This cannot be undone.')) return;
    try {
      await chamaaAPI.endCycle(cycleId);
      alert('Cycle ended');
      setExpandedCycleId(null);
      setParticipants([]);
      fetchCycles();
    } catch (err) { alert(err.response?.data?.message || 'Failed to end cycle'); }
  };

  // ─── position editing helpers ─────────────────────────────────
  const startEditingPosition = (participant) => {
    setEditingPositionId(participant.id);
    setPositionDraft(String(participant.position));
  };

  const cancelEditingPosition = () => {
    setEditingPositionId(null);
    setPositionDraft('');
  };

  const savePosition = async (participantId) => {
    const newPos = parseInt(positionDraft, 10);
    if (!newPos || newPos < 1) {
      alert('Position must be a positive number');
      return;
    }

    setPositionSaving(true);
    try {
      const res = await chamaaAPI.updateParticipantPosition(participantId, newPos);
      // Backend returns the refreshed list already sorted — use it directly
      if (res.data.allParticipants) {
        setParticipants((prev) => {
          // Merge updated position data while preserving contribution stats
          // that only getCycleById returns.
          const updatedMap = {};
          res.data.allParticipants.forEach((p) => { updatedMap[p.id] = p; });
          return prev
            .map((p) => updatedMap[p.id]
              ? { ...p, position: updatedMap[p.id].position }
              : p)
            .sort((a, b) => a.position - b.position);
        });
      }
      setEditingPositionId(null);
      setPositionDraft('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update position');
    } finally {
      setPositionSaving(false);
    }
  };

  const handlePositionKeyDown = (e, participantId) => {
    if (e.key === 'Enter')  savePosition(participantId);
    if (e.key === 'Escape') cancelEditingPosition();
  };

  // ─── helpers ──────────────────────────────────────────────────
  const formatCurrency = (amt) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amt || 0);

  const getMemberName = (id) => {
    const m = members.find((mem) => mem.id === Number(id));
    return m ? `${m.firstName} ${m.lastName}` : `Member #${id}`;
  };

  return (
    <>
      <Navbar />
      <div className="admin-container">
        <Link to="/admin/dashboard" style={{ color: '#1976d2', textDecoration: 'none', fontSize: '14px' }}>
          ← Dashboard
        </Link>
        <div className="page-header">
          <h1>Chamaa (Merry-Go-Round) Management</h1>
          {!isStaff && (
            <button className="btn-primary" onClick={() => setShowCreateModal(true)}>+ Create New Cycle</button>
          )}
        </div>

        {loading ? (
          <div className="loading">Loading chamaa cycles...</div>
        ) : (
          <div className="table-container">
            {cycles.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                No chamaa cycles yet.{!isStaff && ' Click "+ Create New Cycle" to start one.'}
              </p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th><th>Contribution</th><th>Members</th>
                    <th>Rounds Done</th><th>Start Date</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((cycle) => (
                    <React.Fragment key={cycle.id}>
                      <tr>
                        <td>{cycle.name}</td>
                        <td>{formatCurrency(cycle.contributionAmount)}</td>
                        <td>{cycle.totalParticipants}</td>
                        <td>{cycle.completedRounds} / {cycle.totalParticipants}</td>
                        <td>{cycle.startDate ? new Date(cycle.startDate).toLocaleDateString() : '—'}</td>
                        <td>
                          <span style={cycle.isActive ? badges.active : badges.ended}>
                            {cycle.isActive ? 'Active' : 'Ended'}
                          </span>
                        </td>
                        <td style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button className="btn-primary" style={smallBtn} onClick={() => toggleExpand(cycle.id)}>
                            {expandedCycleId === cycle.id ? 'Collapse' : 'Expand'}
                          </button>
                          {!isStaff && cycle.isActive && (
                            <button className="btn-danger" style={smallBtn} onClick={() => handleEndCycle(cycle.id)}>
                              End
                            </button>
                          )}
                        </td>
                      </tr>

                      {expandedCycleId === cycle.id && (
                        <tr>
                          <td colSpan={7} style={{ background: '#f9f9f9', padding: '16px' }}>
                            <strong style={{ display: 'block', marginBottom: '10px' }}>Participants</strong>

                            {/* ── position editing legend (admin only) ── */}
                            {!isStaff && (
                              <p style={{ fontSize: '13px', color: '#888', marginBottom: '10px' }}>
                                💡 Click a position number to edit the payout order for that member.
                                Positions are swapped automatically so no two members share the same slot.
                              </p>
                            )}

                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ background: '#eee' }}>
                                  <th style={thSub}>Position {!isStaff && <span style={{ fontWeight: 400, color: '#999' }}>(click to edit)</span>}</th>
                                  <th style={thSub}>Member</th>
                                  <th style={thSub}>Contributions Made</th>
                                  <th style={thSub}>Received Pot</th>
                                  {!isStaff && <th style={thSub}>Actions</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {participants.map((p) => (
                                  <tr key={p.id} style={{ borderBottom: '1px solid #ddd' }}>

                                    {/* ── position cell ── */}
                                    <td style={tdSub}>
                                      {!isStaff && editingPositionId === p.id ? (
                                        // ── edit mode ──
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <input
                                            type="number"
                                            min="1"
                                            max={participants.length}
                                            value={positionDraft}
                                            onChange={(e) => setPositionDraft(e.target.value)}
                                            onKeyDown={(e) => handlePositionKeyDown(e, p.id)}
                                            style={positionInput}
                                            autoFocus
                                            disabled={positionSaving}
                                          />
                                          <button
                                            style={iconBtn('#2e7d32')}
                                            onClick={() => savePosition(p.id)}
                                            disabled={positionSaving}
                                            title="Save"
                                          >
                                            {positionSaving ? '…' : '✓'}
                                          </button>
                                          <button
                                            style={iconBtn('#c62828')}
                                            onClick={cancelEditingPosition}
                                            disabled={positionSaving}
                                            title="Cancel"
                                          >
                                            ✕
                                          </button>
                                        </span>
                                      ) : (
                                        // ── view mode ──
                                        <span
                                          style={!isStaff ? positionBadge : {}}
                                          title={!isStaff ? 'Click to edit position' : ''}
                                          onClick={() => !isStaff && startEditingPosition(p)}
                                        >
                                          {p.position}
                                          {!isStaff && <span style={{ marginLeft: '5px', fontSize: '11px', color: '#1976d2' }}>✎</span>}
                                        </span>
                                      )}
                                    </td>

                                    <td style={tdSub}>
                                      {p.member
                                        ? `${p.member.firstName} ${p.member.lastName}`
                                        : getMemberName(p.memberId)}
                                    </td>
                                    <td style={tdSub}>{p.paidContributions} / {cycle.totalParticipants}</td>
                                    <td style={tdSub}>
                                      {p.hasReceived
                                        ? <span style={badges.active}>Yes — {new Date(p.receivedDate).toLocaleDateString()}</span>
                                        : <span style={badges.ended}>No</span>
                                      }
                                    </td>

                                    {!isStaff && (
                                      <td style={tdSub}>
                                        {cycle.isActive && (
                                          <>
                                            <button
                                              className="btn-primary"
                                              style={smallBtn}
                                              onClick={() => openContribModal(p, cycle)}
                                            >
                                              Contribute
                                            </button>
                                            {!p.hasReceived && (
                                              <button
                                                className="btn-primary"
                                                style={{ ...smallBtn, background: '#7b1fa2' }}
                                                onClick={() => handleMarkReceived(p.id)}
                                              >
                                                Mark Received
                                              </button>
                                            )}
                                          </>
                                        )}
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Create Cycle Modal ── */}
        {showCreateModal && !isStaff && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Create New Chamaa Cycle</h2>
              <form onSubmit={handleCreateSubmit}>
                <div className="form-group">
                  <label>Cycle Name *</label>
                  <input type="text" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Contribution Amount (KES) *</label>
                  <input type="number" value={createForm.contributionAmount} onChange={(e) => setCreateForm({ ...createForm, contributionAmount: e.target.value })} min="1" required />
                </div>
                <div className="form-group">
                  <label>Start Date</label>
                  <input type="date" value={createForm.startDate} onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Members * — select participants (order = payout order)</label>
                  <div className="checkbox-group">
                    {members.map((m) => (
                      <label key={m.id} className="checkbox-item">
                        <input type="checkbox" checked={createForm.memberIds.includes(m.id)} onChange={() => toggleMember(m.id)} />
                        {m.firstName} {m.lastName}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Create Cycle</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Contribution Modal ── */}
        {showContribModal && selectedParticipant && !isStaff && (
          <div className="modal-overlay" onClick={() => setShowContribModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Record Contribution</h2>
              <p style={{ color: '#666', marginBottom: '16px' }}>
                For <strong>{selectedParticipant.member ? `${selectedParticipant.member.firstName} ${selectedParticipant.member.lastName}` : `Member #${selectedParticipant.memberId}`}</strong>
                {' '}— Required: <strong>{formatCurrency(selectedParticipant.contributionAmount)}</strong>
              </p>
              <form onSubmit={handleContribSubmit}>
                <div className="form-group">
                  <label>Amount (KES) *</label>
                  <input type="number" value={contribForm.amount} onChange={(e) => setContribForm({ ...contribForm, amount: e.target.value })} required />
                  <small style={{ color: '#999' }}>Must be exactly {formatCurrency(selectedParticipant.contributionAmount)}</small>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Month *</label>
                    <select value={contribForm.month} onChange={(e) => setContribForm({ ...contribForm, month: e.target.value })} required>
                      {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Year *</label>
                    <input type="number" value={contribForm.year} onChange={(e) => setContribForm({ ...contribForm, year: e.target.value })} min="2000" required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Payment Date</label>
                  <input type="date" value={contribForm.paymentDate} onChange={(e) => setContribForm({ ...contribForm, paymentDate: e.target.value })} />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowContribModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Record Contribution</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ─── styles ────────────────────────────────────────────────────
const badges = {
  active: { background: '#e8f5e9', color: '#2e7d32', padding: '4px 10px', borderRadius: '12px', fontWeight: 600, fontSize: '13px' },
  ended:  { background: '#eceff1', color: '#546e7a', padding: '4px 10px', borderRadius: '12px', fontWeight: 600, fontSize: '13px' },
};
const smallBtn     = { padding: '6px 12px', fontSize: '13px' };
const thSub        = { padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#666', fontSize: '13px', borderBottom: '2px solid #ddd' };
const tdSub        = { padding: '8px 10px', fontSize: '14px', color: '#333' };
const positionBadge = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  cursor: 'pointer', fontWeight: 700,
  padding: '3px 8px', borderRadius: '6px',
  background: '#e3f2fd', color: '#1565c0',
  border: '1px dashed #90caf9',
  transition: 'background 0.15s',
};
const positionInput = {
  width: '60px', padding: '4px 6px', fontSize: '14px',
  border: '2px solid #1976d2', borderRadius: '4px',
  textAlign: 'center',
};
const iconBtn = (color) => ({
  background: color, color: '#fff', border: 'none',
  borderRadius: '4px', padding: '4px 8px',
  cursor: 'pointer', fontSize: '13px', fontWeight: 700,
});

export default Chamaa;