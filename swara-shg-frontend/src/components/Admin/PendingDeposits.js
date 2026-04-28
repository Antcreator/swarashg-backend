import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { depositsAPI } from '../../Service/Api';
import { useIsStaff } from '../Protected Route/Protectedroute';
import Navbar from '../Navbar/navbar';
import { useToast, useConfirm, ToastContainer } from '../../useToast';
import './PendingDeposits.css';
import {
  PiggyBank, FileText, Handshake, Sprout, AlertTriangle,
  Bell, Package, Smartphone, CreditCard, User, X,
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
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchDeposits(); }, [fetchDeposits]);

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
    { key: 'savingsAmount',       Icon: PiggyBank,    label: 'Savings'        },
    { key: 'loanPaymentAmount',   Icon: FileText,     label: 'Loan Payment'   },
    { key: 'chamaaPaymentAmount', Icon: Handshake,    label: 'Chamaa Payment' },
    { key: 'seedCapitalAmount',   Icon: Sprout,       label: 'Seed Capital'   },
    { key: 'savingsFineAmount',   Icon: AlertTriangle,label: 'Savings Fine'   },
    { key: 'chamaaFineAmount',    Icon: Bell,         label: 'Chamaa Fine'    },
    { key: 'agmFeeAmount',        Icon: FileText,     label: 'AGM Fee'        },
    { key: 'othersAmount',        Icon: Package,      label: 'Others'         },
  ];

  const EDIT_FIELDS = [
    { key: 'savings',       Icon: PiggyBank,    label: 'Savings'        },
    { key: 'loanPayment',   Icon: FileText,     label: 'Loan Payment'   },
    { key: 'chamaaPayment', Icon: Handshake,    label: 'Chamaa Payment' },
    { key: 'seedCapital',   Icon: Sprout,       label: 'Seed Capital'   },
    { key: 'savingsFine',   Icon: AlertTriangle,label: 'Savings Fine'   },
    { key: 'chamaaFine',    Icon: Bell,         label: 'Chamaa Fine'    },
    { key: 'agmFee',        Icon: FileText,     label: 'AGM Fee'        },
    { key: 'others',        Icon: Package,      label: 'Others'         },
  ];

  return (
    <>
      <Navbar />
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <ConfirmDialog />

      <div className="pending-deposits-page">
        <Link to="/admin/dashboard" style={{ color: '#1976d2', textDecoration: 'none', fontSize: '14px' }}>← Dashboard</Link>
        <div className="page-header">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={26} /> Pending Deposits
          </h1>
          <p className="subtitle">Review and approve member deposit requests</p>
        </div>

        <div className="deposits-container">
          {loading ? (
            <div className="loading-state"><div className="spinner" /><p>Loading deposits...</p></div>
          ) : deposits.length === 0 ? (
            <div className="empty-state">
              <Package size={40} style={{ marginBottom: 8, color: '#bbb' }} />
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

                return (
                  <div key={deposit.id} className={`deposit-card ${isExpanded ? 'expanded' : ''}`}>
                    <div className="deposit-header" onClick={() => { setExpandedDeposit(isExpanded ? null : deposit.id); setEditMode(null); }}>
                      <div className="deposit-info">
                        <div className="member-info">
                          <span className="member-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={20} color="white" />
                          </span>
                          <div>
                            <h3 className="member-name">{deposit.member ? `${deposit.member.firstName} ${deposit.member.lastName}` : 'Unknown Member'}</h3>
                            <p className="deposit-date">Submitted: {fmtDate(deposit.createdAt)}</p>
                          </div>
                        </div>
                        <div className="amount-status">
                          <p className="total-amount">{fmt(deposit.totalAmount)}</p>
                          <span className="mpesa-tag">Code: {deposit.mpesaCode}</span>
                        </div>
                      </div>
                      <button className="expand-btn">{isExpanded ? '−' : '+'}</button>
                    </div>

                    {isExpanded && (
                      <div className="deposit-details">
                        {/* M-Pesa message */}
                        <div style={{ background: '#fffde7', border: '2px solid #f9a825', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                            <Smartphone size={18} color="#e65100" />
                            <strong style={{ fontSize: '14px', color: '#e65100' }}>M-PESA Message</strong>
                            {!isStaff && <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 10px', background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc02', borderRadius: '20px', marginLeft: 'auto' }}>Verify before approving</span>}
                          </div>
                          {deposit.mpesaMessage ? (
                            <div style={{ background: 'white', border: '1px solid #ffe082', borderRadius: '8px', padding: '14px 16px', fontFamily: 'monospace', fontSize: '13px', color: '#212121', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {deposit.mpesaMessage}
                            </div>
                          ) : (
                            <div style={{ background: 'white', border: '1px dashed #ccc', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#999', fontStyle: 'italic' }}>No message provided.</div>
                          )}
                          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#555' }}>
                            <span>Transaction code:</span>
                            <code style={{ background: '#e8f5e9', color: '#2e7d32', padding: '3px 12px', borderRadius: '4px', fontWeight: 700, fontSize: '14px' }}>{deposit.mpesaCode}</code>
                          </div>
                        </div>

                        {/* Distribution breakdown */}
                        <div className="detail-section">
                          <h4>Distribution Breakdown</h4>
                          {isEditing && !isStaff ? (
                            <>
                              <div className="form-group" style={{ marginBottom: '12px' }}>
                                <label>Total Deposit Amount</label>
                                <input type="number" className="edit-input" value={editData.totalAmount} onChange={e => setEditData({ ...editData, totalAmount: e.target.value })} />
                              </div>
                              <div className="distribution-edit-grid">
                                {EDIT_FIELDS.map(({ key, Icon, label }) => (
                                  <div className="form-group" key={key}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                      <Icon size={13} /> {label}
                                    </label>
                                    <input type="number" className="edit-input" min="0" value={editData[key]} onChange={e => setEditData({ ...editData, [key]: e.target.value })} />
                                  </div>
                                ))}
                              </div>
                              <div className="distribution-summary" style={{
                                background: editTotal() > Number(editData.totalAmount) ? '#ffebee' : '#e8f5e9',
                                border: `1px solid ${editTotal() > Number(editData.totalAmount) ? '#f44336' : '#4caf50'}`,
                                borderRadius: '6px', padding: '10px 14px', marginTop: '12px',
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Allocated:</span><strong>{fmt(editTotal())}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                                  <span>Remaining:</span>
                                  <strong style={{ color: (Number(editData.totalAmount) - editTotal()) < 0 ? '#f44336' : '#4caf50' }}>
                                    {fmt(Number(editData.totalAmount) - editTotal())}
                                  </strong>
                                </div>
                              </div>
                              <div className="edit-actions" style={{ marginTop: '12px' }}>
                                <button className="btn-cancel" onClick={() => setEditMode(null)}>Cancel</button>
                                <button className="btn-save" disabled={editTotal() > Number(editData.totalAmount)} onClick={() => handleSaveEdit(deposit.id)}>Save Changes</button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="distribution-grid">
                                {DIST_ROWS.filter(r => Number(deposit[r.key]) > 0).map(r => (
                                  <div className="distribution-item" key={r.key}>
                                    <span className="dist-icon" style={{ display: 'flex', alignItems: 'center' }}>
                                      <r.Icon size={14} />
                                    </span>
                                    <span className="dist-label">
                                      {r.label}{r.key === 'loanPaymentAmount' && deposit.loanId ? ` (#${deposit.loanId})` : ''}
                                    </span>
                                    <span className="dist-amount">{fmt(deposit[r.key])}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="distribution-summary">
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total Allocated:</span><strong>{fmt(distTotal)}</strong></div>
                                {unallocated > 0 && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', color: '#ff9800' }}>
                                    <span>Unallocated:</span><strong>{fmt(unallocated)}</strong>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Action buttons */}
                        {!isEditing && !isStaff && (
                          <div className="deposit-actions">
                            <button className="btn-edit" onClick={() => startEdit(deposit)}>✏️ Edit</button>
                            <button className="btn-reject" onClick={() => setShowRejectModal(deposit.id)}>✗ Reject</button>
                            <button className="btn-approve" onClick={() => handleApprove(deposit.id)}>✓ Approve &amp; Distribute</button>
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

        {/* Reject modal */}
        {!isStaff && showRejectModal && (
          <div className="modal-overlay" onClick={() => setShowRejectModal(null)}>
            <div className="modal-content reject-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header-small">
                <h3>Reject Deposit</h3>
                <button className="close-btn" onClick={() => setShowRejectModal(null)}>
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