import React, { useState, useEffect } from 'react';
import Navbar from '../Navbar/navbar';
import { Link } from 'react-router-dom';
import '../MembersManagementAdmin/Members.css';
import { chamaaAPI, membersAPI } from '../../Service/Api';
import { useIsStaff } from '../Protected Route/Protectedroute';

const Chamaa = () => {
  const isStaff = useIsStaff();
  const [cycles, setCycles]     = useState([]);
  const [members, setMembers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedCycleId, setExpandedCycleId] = useState(null);
  const [participants, setParticipants]       = useState([]);
  const [showContribModal, setShowContribModal]   = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState(null);

  // position-editing state
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
    // slotList is the ordered array: e.g. [Mary, Paul, James, Mary, Mary, Levis, Paul]
    // Each index+1 = payout position; duplicates are fully allowed.
    slotList: [],
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

  // ── slot list helpers ──────────────────────────────────────────

  // Append a member to the bottom of the list (next available position).
  const appendSlot = (memberId) => {
    setCreateForm((prev) => ({ ...prev, slotList: [...prev.slotList, memberId] }));
  };

  // Remove the slot at a specific index.
  const removeSlot = (index) => {
    setCreateForm((prev) => ({
      ...prev,
      slotList: prev.slotList.filter((_, i) => i !== index),
    }));
  };

  // Move a slot up or down.
  const moveSlot = (index, direction) => {
    const list     = [...createForm.slotList];
    const swapIdx  = index + direction;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    [list[index], list[swapIdx]] = [list[swapIdx], list[index]];
    setCreateForm((prev) => ({ ...prev, slotList: list }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (createForm.slotList.length === 0) { alert('Add at least one member to the list'); return; }
    try {
      await chamaaAPI.createCycle({
        name: createForm.name,
        contributionAmount: Number(createForm.contributionAmount),
        startDate: createForm.startDate,
        memberIds: createForm.slotList,   // order preserved; duplicates allowed
      });
      alert('Chamaa cycle created successfully');
      setShowCreateModal(false);
      setCreateForm(createDefaults);
      fetchCycles();
    } catch (err) { alert(err.response?.data?.message || 'Failed to create cycle'); }
  };

  const toggleExpand = async (cycleId) => {
    if (expandedCycleId === cycleId) {
      setExpandedCycleId(null); setParticipants([]); setEditingPositionId(null); return;
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
      setExpandedCycleId(null); setParticipants([]); fetchCycles();
    } catch (err) { alert(err.response?.data?.message || 'Failed to end cycle'); }
  };

  // position editing
  const startEditingPosition = (p) => { setEditingPositionId(p.id); setPositionDraft(String(p.position)); };
  const cancelEditingPosition = () => { setEditingPositionId(null); setPositionDraft(''); };
  const savePosition = async (participantId) => {
    const newPos = parseInt(positionDraft, 10);
    if (!newPos || newPos < 1) { alert('Position must be a positive number'); return; }
    setPositionSaving(true);
    try {
      const res = await chamaaAPI.updateParticipantPosition(participantId, newPos);
      if (res.data.allParticipants) {
        setParticipants((prev) => {
          const map = {};
          res.data.allParticipants.forEach((p) => { map[p.id] = p; });
          return prev.map((p) => map[p.id] ? { ...p, position: map[p.id].position } : p)
                     .sort((a, b) => a.position - b.position);
        });
      }
      setEditingPositionId(null); setPositionDraft('');
    } catch (err) { alert(err.response?.data?.message || 'Failed to update position'); }
    finally { setPositionSaving(false); }
  };
  const handlePositionKeyDown = (e, id) => {
    if (e.key === 'Enter')  savePosition(id);
    if (e.key === 'Escape') cancelEditingPosition();
  };

  // helpers
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
        <Link to="/admin/dashboard" style={{ color: '#1976d2', textDecoration: 'none', fontSize: '14px' }}>← Dashboard</Link>
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
                    <th>Name</th><th>Contribution</th><th>Positions</th>
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
                            <button className="btn-danger" style={smallBtn} onClick={() => handleEndCycle(cycle.id)}>End</button>
                          )}
                        </td>
                      </tr>

                      {expandedCycleId === cycle.id && (
                        <tr>
                          <td colSpan={7} style={{ background: '#f9f9f9', padding: '16px' }}>
                            <strong style={{ display: 'block', marginBottom: '10px' }}>
                              Payout List — {participants.length} position{participants.length !== 1 ? 's' : ''}
                            </strong>
                            {!isStaff && (
                              <p style={{ fontSize: '13px', color: '#888', marginBottom: '10px' }}>
                                💡 A member can appear more than once in the list. Click a position number to change the order.
                              </p>
                            )}
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ background: '#eee' }}>
                                  <th style={thSub}>Position{!isStaff && <span style={{ fontWeight: 400, color: '#999' }}> (click to edit)</span>}</th>
                                  <th style={thSub}>Member</th>
                                  <th style={thSub}>Contributions Made</th>
                                  <th style={thSub}>Received Pot</th>
                                  {!isStaff && <th style={thSub}>Actions</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {participants.map((p) => {
                                  const memberName  = p.member
                                    ? `${p.member.firstName} ${p.member.lastName}`
                                    : getMemberName(p.memberId);
                                  // Count how many times this member appears so we can show "(2nd turn)" etc.
                                  const sameSlots  = participants.filter((s) => s.memberId === p.memberId);
                                  const turnIndex  = sameSlots.findIndex((s) => s.id === p.id) + 1;
                                  const turnLabel  = sameSlots.length > 1
                                    ? ` (turn ${turnIndex} of ${sameSlots.length})`
                                    : '';

                                  return (
                                    <tr key={p.id} style={{ borderBottom: '1px solid #ddd' }}>
                                      <td style={tdSub}>
                                        {!isStaff && editingPositionId === p.id ? (
                                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <input
                                              type="number" min="1" max={participants.length}
                                              value={positionDraft}
                                              onChange={(e) => setPositionDraft(e.target.value)}
                                              onKeyDown={(e) => handlePositionKeyDown(e, p.id)}
                                              style={positionInput} autoFocus disabled={positionSaving}
                                            />
                                            <button style={iconBtn('#2e7d32')} onClick={() => savePosition(p.id)} disabled={positionSaving}>{positionSaving ? '…' : '✓'}</button>
                                            <button style={iconBtn('#c62828')} onClick={cancelEditingPosition} disabled={positionSaving}>✕</button>
                                          </span>
                                        ) : (
                                          <span
                                            style={!isStaff ? positionBadge : {}}
                                            title={!isStaff ? 'Click to edit position' : ''}
                                            onClick={() => !isStaff && startEditingPosition(p)}
                                          >
                                            {p.position}
                                            {!isStaff && <span style={{ marginLeft: '4px', fontSize: '11px', color: '#1976d2' }}>✎</span>}
                                          </span>
                                        )}
                                      </td>
                                      <td style={tdSub}>
                                        {memberName}
                                        {turnLabel && (
                                          <span style={{ fontSize: '11px', color: '#999', marginLeft: '4px' }}>{turnLabel}</span>
                                        )}
                                      </td>
                                      <td style={tdSub}>{p.paidContributions} / {cycle.totalParticipants}</td>
                                      <td style={tdSub}>
                                        {p.hasReceived
                                          ? <span style={badges.active}>Yes — {new Date(p.receivedDate).toLocaleDateString()}</span>
                                          : <span style={badges.ended}>No</span>}
                                      </td>
                                      {!isStaff && (
                                        <td style={tdSub}>
                                          {cycle.isActive && (
                                            <>
                                              <button className="btn-primary" style={smallBtn} onClick={() => openContribModal(p, cycle)}>Contribute</button>
                                              {!p.hasReceived && (
                                                <button className="btn-primary" style={{ ...smallBtn, background: '#7b1fa2', marginLeft: '6px' }} onClick={() => handleMarkReceived(p.id)}>Mark Received</button>
                                              )}
                                            </>
                                          )}
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })}
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

        {/* ── Create Cycle Modal ─────────────────────────────────── */}
        {showCreateModal && !isStaff && (
          <div className="modal-overlay" onClick={() => { setShowCreateModal(false); setCreateForm(createDefaults); }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
              <h2>Create New Chamaa Cycle</h2>
              <form onSubmit={handleCreateSubmit}>

                <div className="form-group">
                  <label>Cycle Name *</label>
                  <input type="text" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Contribution Amount (KES) *</label>
                  <input type="number" min="1" value={createForm.contributionAmount} onChange={(e) => setCreateForm({ ...createForm, contributionAmount: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Start Date</label>
                  <input type="date" value={createForm.startDate} onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })} />
                </div>

                {/* ── two-panel slot builder ── */}
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '4px' }}>
                    Payout List *
                  </label>
                  <p style={{ fontSize: '12px', color: '#888', marginTop: 0, marginBottom: '10px' }}>
                    Click a member on the left to add them to the next position on the right.
                    The same member can be added multiple times.
                  </p>

                  <div style={styles.builderWrap}>
                    {/* LEFT: member picker */}
                    <div style={styles.leftPanel}>
                      <p style={styles.panelHeader}>Members</p>
                      {members.map((m) => {
                        const count = createForm.slotList.filter((id) => id === m.id).length;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            style={styles.memberBtn}
                            onClick={() => appendSlot(m.id)}
                            title={`Add ${m.firstName} to the next position`}
                          >
                            <span style={styles.memberBtnName}>{m.firstName} {m.lastName}</span>
                            {count > 0 && (
                              <span style={styles.memberBtnBadge}>×{count}</span>
                            )}
                            <span style={styles.memberBtnPlus}>＋</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* RIGHT: ordered slot list */}
                    <div style={styles.rightPanel}>
                      <p style={styles.panelHeader}>
                        Payout order {createForm.slotList.length > 0 && `(${createForm.slotList.length})`}
                      </p>
                      {createForm.slotList.length === 0 ? (
                        <p style={styles.emptyHint}>← Click a member to add them here</p>
                      ) : (
                        createForm.slotList.map((memberId, idx) => (
                          <div key={idx} style={styles.slotRow}>
                            <span style={styles.slotPos}>{idx + 1}</span>
                            <span style={styles.slotName}>{getMemberName(memberId)}</span>
                            <button type="button" style={styles.slotMoveBtn} onClick={() => moveSlot(idx, -1)} disabled={idx === 0} title="Move up">▲</button>
                            <button type="button" style={styles.slotMoveBtn} onClick={() => moveSlot(idx, 1)} disabled={idx === createForm.slotList.length - 1} title="Move down">▼</button>
                            <button type="button" style={{ ...styles.slotMoveBtn, color: '#c62828', borderColor: '#ffcdd2' }} onClick={() => removeSlot(idx)} title="Remove">✕</button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => { setShowCreateModal(false); setCreateForm(createDefaults); }}>Cancel</button>
                  <button type="submit" className="btn-primary">Create Cycle</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Contribution Modal ─────────────────────────────────── */}
        {showContribModal && selectedParticipant && !isStaff && (
          <div className="modal-overlay" onClick={() => setShowContribModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Record Contribution</h2>
              <p style={{ color: '#666', marginBottom: '16px' }}>
                For <strong>
                  {selectedParticipant.member
                    ? `${selectedParticipant.member.firstName} ${selectedParticipant.member.lastName}`
                    : `Member #${selectedParticipant.memberId}`}
                </strong>
                {' '}— Position <strong>#{selectedParticipant.position}</strong>
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

// ── styles ─────────────────────────────────────────────────────
const badges = {
  active: { background: '#e8f5e9', color: '#2e7d32', padding: '4px 10px', borderRadius: '12px', fontWeight: 600, fontSize: '13px' },
  ended:  { background: '#eceff1', color: '#546e7a', padding: '4px 10px', borderRadius: '12px', fontWeight: 600, fontSize: '13px' },
};
const smallBtn      = { padding: '6px 12px', fontSize: '13px' };
const thSub         = { padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#666', fontSize: '13px', borderBottom: '2px solid #ddd' };
const tdSub         = { padding: '8px 10px', fontSize: '14px', color: '#333' };
const positionBadge = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  cursor: 'pointer', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
  background: '#e3f2fd', color: '#1565c0', border: '1px dashed #90caf9',
};
const positionInput = {
  width: '60px', padding: '4px 6px', fontSize: '14px',
  border: '2px solid #1976d2', borderRadius: '4px', textAlign: 'center',
};
const iconBtn = (color) => ({
  background: color, color: '#fff', border: 'none',
  borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
});

const styles = {
  // two-column builder
  builderWrap: {
    display: 'flex', gap: '12px', alignItems: 'flex-start',
  },
  leftPanel: {
    flex: '0 0 200px', border: '1px solid #ddd', borderRadius: '6px',
    overflow: 'hidden', maxHeight: '340px', overflowY: 'auto',
  },
  rightPanel: {
    flex: 1, border: '1px solid #ddd', borderRadius: '6px',
    overflow: 'hidden', maxHeight: '340px', overflowY: 'auto',
  },
  panelHeader: {
    margin: 0, padding: '7px 10px', background: '#f5f5f5',
    fontSize: '12px', fontWeight: 600, color: '#555',
    borderBottom: '1px solid #ddd', position: 'sticky', top: 0,
  },

  // member button (left panel)
  memberBtn: {
    display: 'flex', alignItems: 'center', width: '100%',
    padding: '8px 10px', background: '#fff', border: 'none',
    borderBottom: '1px solid #f0f0f0', cursor: 'pointer',
    textAlign: 'left', gap: '6px',
    transition: 'background 0.12s',
  },
  memberBtnName: { flex: 1, fontSize: '13px', color: '#333' },
  memberBtnBadge: {
    background: '#1976d2', color: '#fff', borderRadius: '10px',
    padding: '1px 7px', fontSize: '11px', fontWeight: 700,
  },
  memberBtnPlus: {
    fontSize: '16px', fontWeight: 700, color: '#1976d2', lineHeight: 1,
  },

  emptyHint: {
    padding: '20px 12px', fontSize: '13px', color: '#aaa', textAlign: 'center', margin: 0,
  },

  // slot rows (right panel)
  slotRow: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '6px 8px', borderBottom: '1px solid #f0f0f0',
  },
  slotPos: {
    width: '22px', height: '22px', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center',
    background: '#1976d2', color: '#fff', borderRadius: '50%',
    fontSize: '11px', fontWeight: 700, flexShrink: 0,
  },
  slotName: { flex: 1, fontSize: '13px', color: '#333' },
  slotMoveBtn: {
    background: 'none', border: '1px solid #ddd', borderRadius: '4px',
    padding: '2px 6px', cursor: 'pointer', fontSize: '11px', color: '#555',
  },
};

export default Chamaa;