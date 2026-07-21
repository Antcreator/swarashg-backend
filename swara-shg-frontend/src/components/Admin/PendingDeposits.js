import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { depositsAPI } from '../../Service/Api';
import { useIsStaff } from '../Protected Route/Protectedroute';
import Navbar from '../Navbar/navbar';
import { useToast, useConfirm, ToastContainer } from '../../useToast';
import './PendingDeposits.css';
import {
  PiggyBank, FileText, Handshake, Sprout, AlertTriangle,
  Bell, Package, Smartphone, CreditCard, User, X, ChevronDown, ChevronUp,
  MessageSquare, Pencil,
} from 'lucide-react';

const PendingDeposits = () => {
  const isStaff = useIsStaff();
  const { toasts, toast, dismiss } = useToast();
  const { confirm, ConfirmDialog  } = useConfirm();

  const [deposits, setDeposits]               = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [expandedDeposit, setExpandedDeposit] = useState(null);
  const [editMode, setEditMode]               = useState(null);
  const [editData, setEditData]               = useState({});
  const [rejectReason, setRejectReason]       = useState('');
  const [showRejectModal, setShowRejectModal] = useState(null);

  const fetchDeposits = useCallback(async () => {
    try {
      setLoading(true);
      const res = await depositsAPI.getPending();
      setDeposits(res.data.deposits || []);
    } catch (err) {
      console.error('Error fetching deposits:', err);
      toast.error('Load Failed', 'Could not fetch pending deposits.');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchDeposits(); }, [fetchDeposits]);

  useEffect(() => {
    if (showRejectModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showRejectModal]);

  const handleApprove = async (depositId) => {
    const ok = await confirm({
      title:        'Approve Deposit',
      message:      'Approve this deposit? Funds will be distributed to the member immediately.',
      confirmLabel: 'Approve & Distribute',
      variant:      'default',
    });
    if (!ok) return;
    try {
      await depositsAPI.approveDeposit(depositId);
      toast.success('Deposit Approved', 'Funds have been distributed successfully.');
      fetchDeposits();
    } catch (err) {
      toast.error('Approval Failed', err.response?.data?.message || 'Failed to approve deposit.');
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.warning('Reason Required', 'Please provide a reason for rejection before submitting.');
      return;
    }
    try {
      await depositsAPI.rejectDeposit(showRejectModal, { reason: rejectReason });
      toast.info('Deposit Rejected', 'The member will be notified of the rejection.');
      setShowRejectModal(null);
      setRejectReason('');
      fetchDeposits();
    } catch (err) {
      toast.error('Rejection Failed', err.response?.data?.message || 'Failed to reject deposit.');
    }
  };

  const startEdit = (deposit) => {
    setEditMode(deposit.id);
    setEditData({
      totalAmount:   deposit.totalAmount,
      savings:       deposit.savingsAmount       || 0,
      loanPayment:   deposit.loanPaymentAmount   || 0,
      loanId:        deposit.loanId              || '',
      chamaaPayment: deposit.chamaaPaymentAmount  || 0,
      seedCapital:   deposit.seedCapitalAmount    || 0,
      savingsFine:   deposit.savingsFineAmount    || 0,
      chamaaFine:    deposit.chamaaFineAmount     || 0,
      agmFee:        deposit.agmFeeAmount         || 0,
      others:        deposit.othersAmount         || 0,
      notes:         deposit.confirmationNotes    || '',
    });
  };

  const handleSaveEdit = async (depositId) => {
    try {
      await depositsAPI.updateDeposit(depositId, {
        totalAmount: editData.totalAmount,
        notes: editData.notes,
        distribution: {
          savings:       Number(editData.savings       || 0),
          loanPayment:   Number(editData.loanPayment   || 0),
          loanId:        editData.loanId               || null,
          chamaaPayment: Number(editData.chamaaPayment || 0),
          seedCapital:   Number(editData.seedCapital   || 0),
          savingsFine:   Number(editData.savingsFine   || 0),
          chamaaFine:    Number(editData.chamaaFine    || 0),
          agmFee:        Number(editData.agmFee        || 0),
          others:        Number(editData.others        || 0),
        }
      });
      toast.success('Changes Saved', 'The deposit distribution has been updated.');
      setEditMode(null);
      setEditData({});
      fetchDeposits();
    } catch (err) {
      toast.error('Save Failed', err.response?.data?.message || 'Failed to update deposit.');
    }
  };

  const fmt     = (v) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(v || 0);
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

  const distributionTotal = (d) =>
    Number(d.savingsAmount       || 0) +
    Number(d.loanPaymentAmount   || 0) +
    Number(d.chamaaPaymentAmount || 0) +
    Number(d.seedCapitalAmount   || 0) +
    Number(d.savingsFineAmount   || 0) +
    Number(d.chamaaFineAmount    || 0) +
    Number(d.agmFeeAmount        || 0) +
    Number(d.othersAmount        || 0);

  const editTotal = () =>
    Number(editData.savings       || 0) +
    Number(editData.loanPayment   || 0) +
    Number(editData.chamaaPayment || 0) +
    Number(editData.seedCapital   || 0) +
    Number(editData.savingsFine   || 0) +
    Number(editData.chamaaFine    || 0) +
    Number(editData.agmFee        || 0) +
    Number(editData.others        || 0);

  const DIST_ROWS = [
    { key: 'savingsAmount',       Icon: PiggyBank,     label: 'Savings'        },
    { key: 'loanPaymentAmount',   Icon: FileText,      label: 'Loan Payment'   },
    { key: 'chamaaPaymentAmount', Icon: Handshake,     label: 'Chamaa Payment' },
    { key: 'seedCapitalAmount',   Icon: Sprout,        label: 'Seed Capital'   },
    { key: 'savingsFineAmount',   Icon: AlertTriangle, label: 'Savings Fine'   },
    { key: 'chamaaFineAmount',    Icon: Bell,          label: 'Chamaa Fine'    },
    { key: 'agmFeeAmount',        Icon: FileText,      label: 'AGM Fee'        },
    { key: 'othersAmount',        Icon: Package,       label: 'Others'         },
  ];

  const EDIT_FIELDS = [
    { key: 'savings',       Icon: PiggyBank,     label: 'Savings'        },
    { key: 'loanPayment',   Icon: FileText,      label: 'Loan Payment'   },
    { key: 'chamaaPayment', Icon: Handshake,     label: 'Chamaa Payment' },
    { key: 'seedCapital',   Icon: Sprout,        label: 'Seed Capital'   },
    { key: 'savingsFine',   Icon: AlertTriangle, label: 'Savings Fine'   },
    { key: 'chamaaFine',    Icon: Bell,          label: 'Chamaa Fine'    },
    { key: 'agmFee',        Icon: FileText,      label: 'AGM Fee'        },
    { key: 'others',        Icon: Package,       label: 'Others'         },
  ];

  return (
    <>
      <Navbar />
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <ConfirmDialog />

      <div className="pending-deposits-page">
        <Link to="/admin/dashboard" className="back-link">← Dashboard</Link>

        <div className="page-header">
          <h1>
            <CreditCard size={24} className="page-header-icon" />
            Pending Deposits
          </h1>
          <p className="subtitle">Review and approve member deposit requests</p>
        </div>

        <div className="deposits-container">
          {loading ? (
            <div className="loading-state">
              <div className="spinner" />
              <p>Loading deposits...</p>
            </div>
          ) : deposits.length === 0 ? (
            <div className="empty-state">
              <Package size={40} className="empty-icon-svg" />
              <h3>No pending deposits</h3>
              <p>All caught up!</p>
            </div>
          ) : (
            <div className="deposits-list">
              {deposits.map((deposit) => {
                const isExpanded  = expandedDeposit === deposit.id;
                const isEditing   = editMode === deposit.id;
                const distTotal   = distributionTotal(deposit);
                const unallocated = Number(deposit.totalAmount) - distTotal;
                const memberNotes = deposit.confirmationNotes || deposit.memberNotes || deposit.notes || '';

                return (
                  <div key={deposit.id} className={`deposit-card${isExpanded ? ' expanded' : ''}`}>

                    {/* ── Card Header ── */}
                    <div
                      className="deposit-header"
                      onClick={() => {
                        setExpandedDeposit(isExpanded ? null : deposit.id);
                        setEditMode(null);
                      }}
                    >
                      {/* Left: avatar + name/date */}
                      <div className="member-info">
                        <span className="member-icon">
                          <User size={20} color="white" />
                        </span>
                        <div className="member-text">
                          <h3 className="member-name">
                            {deposit.member
                              ? `${deposit.member.firstName} ${deposit.member.lastName}`
                              : 'Unknown Member'}
                          </h3>
                          <p className="deposit-date">
                            {fmtDate(deposit.createdAt)}
                          </p>
                        </div>
                      </div>

                      {/* Right: amount + code + note indicator + chevron */}
                      <div className="header-right">
                        <div className="amount-block">
                          <p className="total-amount">{fmt(deposit.totalAmount)}</p>
                          <span className="mpesa-tag">Code: {deposit.mpesaCode}</span>
                          {/* Show a note pill in header if member left a note */}
                          {memberNotes && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              fontSize: '10px', fontWeight: 600,
                              background: '#fff8e1', color: '#e65100',
                              border: '1px solid #ffc107',
                              borderRadius: '10px', padding: '2px 8px',
                              marginTop: '4px',
                            }}>
                              <MessageSquare size={9} /> Note from member
                            </span>
                          )}
                        </div>
                        <button className="expand-btn" aria-label="Toggle details">
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* ── Card Body ── */}
                    {isExpanded && (
                      <div className="deposit-details">

                        {/* ── Member Notes — shown when member left a note ── */}
                        {memberNotes && (
                          <div style={{
                            background: '#fff8e1',
                            border: '1px solid #ffc107',
                            borderRadius: '8px',
                            padding: '12px 14px',
                            marginBottom: '14px',
                          }}>
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: '6px',
                              fontSize: '11px', fontWeight: 700, color: '#e65100',
                              marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em',
                            }}>
                              <MessageSquare size={13} />
                              Note from Member
                            </div>
                            <p style={{
                              fontSize: '13px', color: '#1a1a2e',
                              lineHeight: 1.6, margin: 0,
                              fontStyle: 'italic',
                            }}>
                              "{memberNotes}"
                            </p>
                          </div>
                        )}

                        {/* M-Pesa Message */}
                        <div className="mpesa-box">
                          <div className="mpesa-box-header">
                            <span className="mpesa-box-title">
                              <Smartphone size={16} color="#e65100" />
                              M-PESA Message
                            </span>
                            {!isStaff && (
                              <span className="verify-badge">Verify before approving</span>
                            )}
                          </div>

                          {deposit.mpesaMessage ? (
                            <div className="mpesa-message-body">
                              {deposit.mpesaMessage}
                            </div>
                          ) : (
                            <div className="mpesa-message-empty">No message provided.</div>
                          )}

                          <div className="mpesa-code-row">
                            <span>Transaction code:</span>
                            <code className="mpesa-code-chip">{deposit.mpesaCode}</code>
                          </div>
                        </div>

                        {/* Distribution Breakdown */}
                        <div className="detail-section">
                          <h4>Distribution Breakdown</h4>

                          {isEditing && !isStaff ? (
                            <>
                              <div className="form-group">
                                <label>Total Deposit Amount (KES)</label>
                                <input
                                  type="number"
                                  className="edit-input"
                                  value={editData.totalAmount}
                                  onChange={e => setEditData({ ...editData, totalAmount: e.target.value })}
                                />
                              </div>

                              <div className="distribution-edit-grid">
                                {EDIT_FIELDS.map(({ key, Icon, label }) => (
                                  <div className="form-group" key={key}>
                                    <label>
                                      <Icon size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                      {label}
                                    </label>
                                    <input
                                      type="number"
                                      className="edit-input"
                                      min="0"
                                      value={editData[key]}
                                      onChange={e => setEditData({ ...editData, [key]: e.target.value })}
                                    />
                                  </div>
                                ))}
                              </div>

                              <div className={`distribution-summary edit-summary${editTotal() > Number(editData.totalAmount) ? ' over' : ''}`}>
                                <div className="summary-row">
                                  <span>Allocated:</span>
                                  <strong>{fmt(editTotal())}</strong>
                                </div>
                                <div className="summary-row">
                                  <span>Remaining:</span>
                                  <strong className={Number(editData.totalAmount) - editTotal() < 0 ? 'text-danger' : 'text-success'}>
                                    {fmt(Number(editData.totalAmount) - editTotal())}
                                  </strong>
                                </div>
                              </div>

                              {/* Admin notes field in edit mode */}
                              <div className="form-group" style={{ marginTop: '12px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Pencil size={12} /> Admin Notes
                                </label>
                                <textarea
                                  className="edit-input"
                                  rows="2"
                                  placeholder="Add any notes for this deposit..."
                                  value={editData.notes}
                                  onChange={e => setEditData({ ...editData, notes: e.target.value })}
                                  style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '13px' }}
                                />
                              </div>

                              <div className="edit-actions">
                                <button className="btn-cancel" onClick={() => setEditMode(null)}>Cancel</button>
                                <button
                                  className="btn-save"
                                  disabled={editTotal() > Number(editData.totalAmount)}
                                  onClick={() => handleSaveEdit(deposit.id)}
                                >
                                  Save Changes
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="distribution-grid">
                                {DIST_ROWS.filter(r => Number(deposit[r.key]) > 0).map(r => (
                                  <div className="distribution-item" key={r.key}>
                                    <span className="dist-icon">
                                      <r.Icon size={14} />
                                    </span>
                                    <span className="dist-label">
                                      {r.label}
                                      {r.key === 'loanPaymentAmount' && deposit.loanId ? ` (#${deposit.loanId})` : ''}
                                    </span>
                                    <span className="dist-amount">{fmt(deposit[r.key])}</span>
                                  </div>
                                ))}
                              </div>

                              <div className="distribution-summary">
                                <div className="summary-row">
                                  <span>Total Allocated:</span>
                                  <strong>{fmt(distTotal)}</strong>
                                </div>
                                {unallocated > 0 && (
                                  <div className="summary-row text-warning">
                                    <span>Unallocated:</span>
                                    <strong>{fmt(unallocated)}</strong>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Action buttons */}
                        {!isEditing && !isStaff && (
                          <div className="deposit-actions">
                            <button className="btn-edit" onClick={() => startEdit(deposit)}>
                              <Pencil size={13} style={{ marginRight: 4 }} /> Edit
                            </button>
                            <button className="btn-reject" onClick={() => setShowRejectModal(deposit.id)}>
                              <X size={13} style={{ marginRight: 4 }} /> Reject
                            </button>
                            <button className="btn-approve" onClick={() => handleApprove(deposit.id)}>
                              ✓ Approve &amp; Distribute
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Reject Modal ── */}
        {!isStaff && showRejectModal && (
          <div
            className="modal-overlay"
            onMouseDown={() => setShowRejectModal(null)}
            onTouchStart={() => setShowRejectModal(null)}
          >
            <div
              className="reject-modal"
              onMouseDown={e => e.stopPropagation()}
              onTouchStart={e => e.stopPropagation()}
            >
              <div className="modal-header-small">
                <h3>Reject Deposit</h3>
                <button className="close-btn" onClick={() => setShowRejectModal(null)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>
              <div className="modal-body">
                <label>Reason for Rejection *</label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Enter the reason for rejection..."
                  rows="4"
                />
              </div>
              <div className="modal-actions-small">
                <button className="btn-cancel" onClick={() => setShowRejectModal(null)}>Cancel</button>
                <button className="btn-confirm-reject" onClick={handleReject}>Reject Deposit</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PendingDeposits;