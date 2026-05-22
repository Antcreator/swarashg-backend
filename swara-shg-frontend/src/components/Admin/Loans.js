import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../Navbar/navbar';
import { Link } from 'react-router-dom';
import '../MembersManagementAdmin/Members.css';
import { loansAPI } from '../../Service/Api';
import { useIsStaff } from '../Protected Route/Protectedroute';
import { useToast, useConfirm, ToastContainer } from '../../useToast';
import {
  CreditCard, BarChart2, Pencil, Check, X, Trash2, Eye,
  Banknote, RefreshCw, AlertTriangle, CheckCircle, Building2,
  Users, Wallet, FileText,
} from 'lucide-react';

const TRANSACTION_FEE = 108;

const Loans = () => {
  const isStaff  = useIsStaff();
  const location = useLocation();
  const { toasts, toast, dismiss } = useToast();
  const { confirm, ConfirmDialog  } = useConfirm();

  const [loans, setLoans]                   = useState([]);
  const [loading, setLoading]               = useState(true);
  const [activeTab, setActiveTab]           = useState('pending');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRejectModal, setShowRejectModal]   = useState(false);
  const [showEditModal, setShowEditModal]       = useState(false);
  const [showDetailModal, setShowDetailModal]   = useState(false);
  const [selectedLoan, setSelectedLoan]         = useState(null);
  const [rejectionReason, setRejectionReason]   = useState('');
  const [editFormData, setEditFormData] = useState({ amount: '', durationMonths: '', guarantorIds: [] });
  const [paymentForm, setPaymentForm]   = useState({
    amount: '', paymentDate: new Date().toISOString().split('T')[0], paymentMethod: '', notes: ''
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab && ['pending', 'approved', 'all'].includes(tab)) setActiveTab(tab);
  }, [location.search]);

  const fetchLoans = useCallback(async () => {
    try {
      setLoading(true);
      const res = await loansAPI.getAll({ _nocache: Date.now() });
      setLoans(res.data.loans || []);
    } catch (err) {
      console.error('Failed to fetch loans:', err);
      toast.error('Load Failed', 'Could not fetch loans. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  const allGuarantorsRejected = (loan) => {
    const guarantors = loan.guarantors || [];
    const nonOffice  = guarantors.filter(g => g.guarantorId !== -1);
    return nonOffice.length > 0 && nonOffice.every(g => g.approvalStatus === 'rejected');
  };

  // Returns guarantors who have accepted (non-office, status === 'accepted')
  const getAcceptedGuarantors = (loan) => {
    return (loan.guarantors || []).filter(
      g => g.guarantorId !== -1 && g.approvalStatus === 'accepted'
    );
  };

  // Returns guarantors who are still pending (non-office)
  const getPendingGuarantors = (loan) => {
    return (loan.guarantors || []).filter(
      g => g.guarantorId !== -1 && g.approvalStatus === 'pending'
    );
  };

  // Returns guarantors who have rejected (non-office)
  const getRejectedGuarantors = (loan) => {
    return (loan.guarantors || []).filter(
      g => g.guarantorId !== -1 && g.approvalStatus === 'rejected'
    );
  };

  const guarantorName = (g) =>
    g.guarantor ? `${g.guarantor.firstName} ${g.guarantor.lastName}` : `Guarantor #${g.guarantorId}`;

  const handleApproveLoan = async (loanId) => {
    const loan        = loans.find(l => l.id === loanId);
    const allRejected = loan && allGuarantorsRejected(loan);
    const isTopUp     = loan?.loanType === 'top_up';

    const accepted = getAcceptedGuarantors(loan);
    const pending  = getPendingGuarantors(loan);
    const rejected = getRejectedGuarantors(loan);

    // Build guarantor summary lines for the confirm message
    const guarantorSection = (() => {
      const lines = [];

      if (accepted.length > 0) {
        lines.push(`✅ Accepted (${accepted.length}):`);
        accepted.forEach(g => lines.push(`   • ${guarantorName(g)}`));
      }
      if (pending.length > 0) {
        lines.push(`⏳ Pending (${pending.length}):`);
        pending.forEach(g => lines.push(`   • ${guarantorName(g)}`));
      }
      if (rejected.length > 0) {
        lines.push(`❌ Rejected (${rejected.length}):`);
        rejected.forEach(g => lines.push(`   • ${guarantorName(g)}`));
      }

      return lines.length > 0 ? `\n\nGuarantor Status:\n${lines.join('\n')}` : '';
    })();

    let message = `Are you sure you want to approve this loan?${guarantorSection}`;
    let variant = 'default';

    if (allRejected) {
      message = `All guarantors have rejected this loan.\n\nApproving will assign full liability to The Office (Admin).${guarantorSection}\n\nDo you want to proceed?`;
      variant = 'warning';
    } else if (isTopUp) {
      const disbursed = Number(loan.amount) - Number(loan.previousBalance || 0);
      message = `This is a TOP-UP loan.\n\nApproving will:\n• Clear the old loan balance of KES ${Number(loan.previousBalance || 0).toLocaleString()}\n• Disburse KES ${disbursed.toLocaleString()} to the member\n• New loan balance: KES ${Number(loan.totalRepayment).toLocaleString()} (full repayment)${guarantorSection}\n\nDo you want to proceed?`;
      variant = 'warning';
    }

    const ok = await confirm({
      title:        isTopUp ? 'Approve Top-Up Loan' : 'Approve Loan',
      message,
      confirmLabel: isTopUp ? 'Approve Top-Up' : 'Approve Loan',
      variant,
    });
    if (!ok) return;

    try {
      const response = await loansAPI.approveLoan(loanId);
      toast.success('Loan Approved', response.data?.message || 'Loan approved successfully.');
      setLoans([]);
      await fetchLoans();
    } catch (err) {
      toast.error('Approval Failed', err.response?.data?.message || 'Failed to approve loan.');
    }
  };

  const openRejectModal  = (loan) => { setSelectedLoan(loan); setRejectionReason(''); setShowRejectModal(true); };

  const handleRejectLoan = async () => {
    if (!rejectionReason.trim()) {
      toast.warning('Reason Required', 'Please provide a reason for rejection.');
      return;
    }
    try {
      const response = await loansAPI.rejectLoan(selectedLoan.id, rejectionReason);
      toast.info('Loan Rejected', response.data.message);
      setShowRejectModal(false);
      fetchLoans();
    } catch (err) {
      toast.error('Rejection Failed', err.response?.data?.message || 'Failed to reject loan.');
    }
  };

  const handleDeleteLoan = async (loanId) => {
    const ok = await confirm({
      title:        'Delete Loan Application',
      message:      'This will permanently delete the loan application. This action cannot be undone.',
      confirmLabel: 'Delete',
      variant:      'danger',
    });
    if (!ok) return;
    try {
      const response = await loansAPI.deleteLoan(loanId);
      toast.success('Loan Deleted', response.data.message || 'Loan deleted successfully.');
      fetchLoans();
    } catch (err) {
      toast.error('Delete Failed', err.response?.data?.message || 'Failed to delete loan.');
    }
  };

  const handleEditLoan = (loan) => {
    setSelectedLoan(loan);
    setEditFormData({ amount: loan.amount, durationMonths: loan.durationMonths, guarantorIds: loan.guarantors?.map(g => g.guarantorId) || [] });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await loansAPI.updateLoan(selectedLoan.id, editFormData);
      toast.success('Loan Updated', 'Loan application has been updated successfully.');
      setShowEditModal(false);
      fetchLoans();
    } catch (err) {
      toast.error('Update Failed', err.response?.data?.message || 'Failed to update loan.');
    }
  };

  const openPaymentModal = (loan) => {
    setSelectedLoan(loan);
    setPaymentForm({ amount: '', paymentDate: new Date().toISOString().split('T')[0], paymentMethod: '', notes: '' });
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    try {
      await loansAPI.recordPayment({
        loanId: selectedLoan.id, amount: Number(paymentForm.amount),
        paymentDate: paymentForm.paymentDate, paymentMethod: paymentForm.paymentMethod, notes: paymentForm.notes
      });
      toast.success('Payment Recorded', 'The loan payment has been recorded successfully.');
      setShowPaymentModal(false);
      fetchLoans();
    } catch (err) {
      toast.error('Payment Failed', err.response?.data?.message || 'Failed to record payment.');
    }
  };

  const fmt = (amount) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount || 0);
  const fd = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' }) : '—';
  const txFee        = (loan) => Number(loan.transactionFee ?? TRANSACTION_FEE);
  const cashReceived = (loan) => loan.loanType === 'top_up'
    ? Number(loan.amount) - Number(loan.previousBalance || 0)
    : Number(loan.amount);
  const totalWithFee = (loan) => Number(loan.totalRepayment);

  const statusCfg = (loan) => {
    if (loan.approvalStatus === 'pending')  return { bg: '#fff3e0', color: '#e65100', label: 'Pending'   };
    if (loan.approvalStatus === 'rejected') return { bg: '#ffebee', color: '#c62828', label: 'Rejected'  };
    return {
      active:    { bg: '#e3f2fd', color: '#1565c0', label: 'Active'    },
      arrears:   { bg: '#fff8e1', color: '#e65100', label: 'Arrears'   },
      default:   { bg: '#ffebee', color: '#c62828', label: 'Default'   },
      paid:      { bg: '#e8f5e9', color: '#2e7d32', label: 'Paid'      },
      topped_up: { bg: '#f3e5f5', color: '#7b1fa2', label: 'Topped Up' },
    }[loan.status] || { bg: '#f5f5f5', color: '#777', label: loan.status };
  };

  const getStatusBadge = (loan) => {
    const s = statusCfg(loan);
    return <span className="status" style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}` }}>{s.label}</span>;
  };

  // Inline guarantor summary shown in the table row (pending loans only)
  const GuarantorSummaryInline = ({ loan }) => {
    const accepted = getAcceptedGuarantors(loan);
    const pending  = getPendingGuarantors(loan);
    const rejected = getRejectedGuarantors(loan);
    const total    = accepted.length + pending.length + rejected.length;
    if (total === 0) return null;

    return (
      <div style={{ marginTop: '8px', padding: '8px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '11px' }}>
        <div style={{ fontWeight: 700, color: '#374151', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Users size={11} /> Guarantors ({total})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {accepted.map((g, i) => (
            <div key={`a-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#2e7d32' }}>
              <Check size={10} style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>{guarantorName(g)}</span>
              <span style={{ fontSize: '10px', background: '#e8f5e9', color: '#2e7d32', padding: '1px 6px', borderRadius: '8px', fontWeight: 700 }}>Accepted</span>
            </div>
          ))}
          {pending.map((g, i) => (
            <div key={`p-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#e65100' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff9800', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>{guarantorName(g)}</span>
              <span style={{ fontSize: '10px', background: '#fff8e1', color: '#e65100', padding: '1px 6px', borderRadius: '8px', fontWeight: 700 }}>Pending</span>
            </div>
          ))}
          {rejected.map((g, i) => (
            <div key={`r-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#c62828' }}>
              <X size={10} style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>{guarantorName(g)}</span>
              <span style={{ fontSize: '10px', background: '#ffebee', color: '#c62828', padding: '1px 6px', borderRadius: '8px', fontWeight: 700 }}>Rejected</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const filteredLoans = loans.filter(loan => {
    const s = loan.approvalStatus || 'pending';
    if (activeTab === 'pending')  return s === 'pending';
    if (activeTab === 'approved') return s === 'approved';
    return true;
  });

  return (
    <>
      <Navbar />
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <ConfirmDialog />

      <div className="admin-container">
        <Link to="/admin/dashboard" style={{ color: '#1976d2', textDecoration: 'none', fontSize: '14px' }}>← Dashboard</Link>
        <div className="page-header">
          <h1>Loans Management</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className={`btn-${activeTab === 'pending'  ? 'primary' : 'secondary'}`} onClick={() => setActiveTab('pending')}>Pending ({loans.filter(l => (l.approvalStatus || 'pending') === 'pending').length})</button>
            <button className={`btn-${activeTab === 'approved' ? 'primary' : 'secondary'}`} onClick={() => setActiveTab('approved')}>Approved ({loans.filter(l => l.approvalStatus === 'approved').length})</button>
            <button className={`btn-${activeTab === 'all'      ? 'primary' : 'secondary'}`} onClick={() => setActiveTab('all')}>All ({loans.length})</button>
          </div>
        </div>

        {loading ? <div className="loading">Loading loans...</div> : (
          <>
            <div style={{ background: '#e3f2fd', padding: '8px 12px', marginBottom: '10px', borderRadius: '4px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <BarChart2 size={14} /> <strong>{activeTab === 'pending' ? 'Pending' : activeTab === 'approved' ? 'Approved' : 'All'} Loans</strong>
              </span>
              <span><strong>Showing:</strong> {filteredLoans.length} of {loans.length}</span>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Borrower</th><th>Loan Amount</th><th>Tx Fee</th><th>Cash to Member</th><th>Interest</th><th>Duration</th><th>Total Repayment</th><th>Applied On</th>
                    {activeTab !== 'pending' && <><th>Disbursed</th><th>Due Date</th><th>Paid</th><th>Balance</th><th>Penalty</th><th>Actioned By</th></>}
                    <th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLoans.length === 0 ? (
                    <tr><td colSpan="16" style={{ textAlign: 'center', padding: '40px' }}>{activeTab === 'pending' ? 'No pending loan applications' : 'No loans found'}</td></tr>
                  ) : filteredLoans.map(loan => {
                    const danger  = allGuarantorsRejected(loan);
                    const isTopUp = loan.loanType === 'top_up';
                    const isPending = (loan.approvalStatus === 'pending' || loan.status === 'pending');
                    return (
                      <tr key={loan.id} style={danger ? { outline: '2px solid #f44336', outlineOffset: '-2px', background: '#fff5f5' } : {}}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {danger && (
                              <span title="All guarantors have rejected this loan" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#f44336', color: 'white', borderRadius: '50%', width: '20px', height: '20px', fontSize: '12px', fontWeight: 'bold', flexShrink: 0, cursor: 'help' }}>!</span>
                            )}
                            <strong>{loan.member?.firstName} {loan.member?.lastName}</strong>
                          </div>
                          {danger && (
                            <div style={{ fontSize: '11px', color: '#c62828', marginTop: '3px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <AlertTriangle size={11} /> All guarantors rejected — approval assigns liability to Admin
                            </div>
                          )}
                          {isTopUp && (
                            <div style={{ marginTop: '3px' }}>
                              <span style={{ padding: '2px 8px', background: '#f3e5f5', color: '#7b1fa2', borderRadius: '10px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <RefreshCw size={10} /> Top-Up
                              </span>
                            </div>
                          )}
                          {/* Show guarantor summary inline for pending loans */}
                          {isPending && !isStaff && <GuarantorSummaryInline loan={loan} />}
                        </td>
                        <td>
                          {fmt(loan.amount)}
                          {isTopUp && loan.previousBalance > 0 && (
                            <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>Clears: {fmt(loan.previousBalance)}</div>
                          )}
                        </td>
                        <td><span style={{ background: '#fff8e1', color: '#f57f17', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 600 }}>{fmt(txFee(loan))}</span></td>
                        <td>
                          <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '3px 10px', borderRadius: '10px', fontSize: '13px', fontWeight: 700 }}>{fmt(cashReceived(loan))}</span>
                          {isTopUp && loan.previousBalance > 0 && (
                            <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>After clearing old balance</div>
                          )}
                        </td>
                        <td>{loan.interestRate}%</td>
                        <td>{loan.durationMonths} mo</td>
                        <td style={{ fontWeight: 'bold', color: '#1976d2' }}>{fmt(totalWithFee(loan))}</td>
                        <td>{fd(loan.createdAt)}</td>
                        {activeTab !== 'pending' && (
                          <>
                            <td>{fd(loan.disbursementDate)}</td>
                            <td>{fd(loan.dueDate)}</td>
                            <td>{fmt(loan.amountPaid)}</td>
                            <td>{fmt(loan.remainingBalance)}</td>
                            <td>{fmt(loan.penaltyInterest || 0)}</td>
                            <td>
                              {loan.approvedByName ? (
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: '13px', color: loan.approvalStatus === 'rejected' ? '#c62828' : '#1976d2' }}>{loan.approvedByName}</div>
                                  <div style={{ fontSize: '11px', color: '#888', marginTop: '2px', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {loan.approvalStatus === 'approved'
                                      ? <><Check size={10} /> Approved</>
                                      : <><X size={10} /> Rejected</>}
                                    {loan.approvedAt && ` · ${fd(loan.approvedAt)}`}
                                  </div>
                                </div>
                              ) : '—'}
                            </td>
                          </>
                        )}
                        <td>{getStatusBadge(loan)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', minWidth: '120px' }}>
                            {isStaff ? (
                              <button className="btn-secondary" onClick={() => { setSelectedLoan(loan); setShowDetailModal(true); }} style={{ fontSize: '11px', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Eye size={12} /> View
                              </button>
                            ) : (
                              <>
                                {isPending && (
                                  <>
                                    <button className="btn-primary" onClick={() => handleEditLoan(loan)} style={{ fontSize: '11px', padding: '4px 8px', background: '#1976d2', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                      <Pencil size={11} /> Edit
                                    </button>
                                    <button
                                      className="btn-primary"
                                      onClick={() => handleApproveLoan(loan.id)}
                                      style={{ fontSize: '11px', padding: '4px 8px', background: danger ? '#f44336' : isTopUp ? '#7b1fa2' : '#4caf50', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                    >
                                      {danger
                                        ? <><AlertTriangle size={11} /> Approve</>
                                        : isTopUp
                                          ? <><RefreshCw size={11} /> Approve Top-Up</>
                                          : <><Check size={11} /> Approve</>}
                                    </button>
                                    <button className="btn-danger" onClick={() => openRejectModal(loan)} style={{ fontSize: '11px', padding: '4px 8px', background: '#f44336', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                      <X size={11} /> Reject
                                    </button>
                                    <button className="btn-secondary" onClick={() => handleDeleteLoan(loan.id)} style={{ fontSize: '11px', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                      <Trash2 size={11} /> Delete
                                    </button>
                                  </>
                                )}
                                {loan.approvalStatus === 'rejected' && (
                                  <button className="btn-secondary" onClick={() => handleDeleteLoan(loan.id)} style={{ fontSize: '11px', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <Trash2 size={11} /> Delete
                                  </button>
                                )}
                                {loan.approvalStatus === 'approved' && (
                                  <>
                                    {(loan.status === 'active' || loan.status === 'arrears') && (
                                      <button className="btn-primary" onClick={() => openPaymentModal(loan)} style={{ fontSize: '11px', padding: '4px 8px', background: '#4caf50', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        <Banknote size={11} /> Payment
                                      </button>
                                    )}
                                    {loan.status === 'default'   && <span style={{ fontSize: '11px', padding: '4px 8px', background: '#f44336', color: 'white', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={11} /> Defaulted</span>}
                                    {loan.status === 'paid'      && <span style={{ fontSize: '11px', padding: '4px 8px', background: '#4caf50', color: 'white', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle size={11} /> Completed</span>}
                                    {loan.status === 'topped_up' && <span style={{ fontSize: '11px', padding: '4px 8px', background: '#7b1fa2', color: 'white', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: 4 }}><RefreshCw size={11} /> Topped Up</span>}
                                    <button className="btn-secondary" onClick={() => { setSelectedLoan(loan); setShowDetailModal(true); }} style={{ fontSize: '11px', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                      <Eye size={11} /> View
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Reject Modal ── */}
        {!isStaff && showRejectModal && selectedLoan && (
          <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h2>Reject Loan Application</h2>
              <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '6px', marginBottom: '20px' }}>
                <p><strong>Borrower:</strong> {selectedLoan.member?.firstName} {selectedLoan.member?.lastName}</p>
                <p><strong>Amount:</strong> {fmt(selectedLoan.amount)}</p>
              </div>
              <div className="form-group">
                <label>Reason for Rejection *</label>
                <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows="4" placeholder="Provide a clear reason..." required style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px' }} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
                <button type="button" className="btn-danger" onClick={handleRejectLoan} disabled={!rejectionReason.trim()}>Reject Loan</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Payment Modal ── */}
        {!isStaff && showPaymentModal && selectedLoan && (
          <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h2>Record Loan Payment</h2>
              <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '6px', marginBottom: '20px' }}>
                <p><strong>Borrower:</strong> {selectedLoan.member?.firstName} {selectedLoan.member?.lastName}</p>
                <p><strong>Remaining Balance:</strong> {fmt(selectedLoan.remainingBalance)}</p>
              </div>
              <form onSubmit={handlePaymentSubmit}>
                <div className="form-group"><label>Payment Amount *</label><input type="number" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} required min="1" /></div>
                <div className="form-group"><label>Payment Date *</label><input type="date" value={paymentForm.paymentDate} onChange={e => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} required /></div>
                <div className="form-group">
                  <label>Payment Method *</label>
                  <select value={paymentForm.paymentMethod} onChange={e => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })} required>
                    <option value="">Select Method</option>
                    <option value="cash">Cash</option>
                    <option value="mpesa">M-Pesa</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div className="form-group"><label>Notes</label><textarea value={paymentForm.notes} onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })} rows="3" /></div>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Record Payment</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Edit Modal ── */}
        {!isStaff && showEditModal && selectedLoan && (
          <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h2>Edit Loan Application</h2>
              <form onSubmit={handleEditSubmit}>
                <div className="form-group"><label>Loan Amount *</label><input type="number" value={editFormData.amount} onChange={e => setEditFormData({ ...editFormData, amount: e.target.value })} required min="1000" /></div>
                <div className="form-group"><label>Duration (months) *</label><input type="number" value={editFormData.durationMonths} onChange={e => setEditFormData({ ...editFormData, durationMonths: e.target.value })} required min="1" max="5" /></div>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Update Loan</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Detail Modal ── */}
        {showDetailModal && selectedLoan && (
          <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ margin: 0, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={20} /> Loan #{selectedLoan.id}
                    {selectedLoan.loanType === 'top_up' && (
                      <span style={{ marginLeft: '10px', padding: '3px 10px', background: '#f3e5f5', color: '#7b1fa2', borderRadius: '12px', fontSize: '13px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <RefreshCw size={12} /> Top-Up
                      </span>
                    )}
                  </h2>
                  <p style={{ margin: '4px 0 0', color: '#888', fontSize: '13px' }}>{selectedLoan.member?.firstName} {selectedLoan.member?.lastName}</p>
                </div>
                {(() => { const s = statusCfg(selectedLoan); return <span style={{ padding: '5px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>; })()}
              </div>

              {allGuarantorsRejected(selectedLoan) && (
                <div style={{ background: '#ffebee', border: '2px solid #f44336', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <AlertTriangle size={20} color="#c62828" />
                  <div>
                    <strong style={{ color: '#c62828' }}>All guarantors have rejected this loan</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#c62828' }}>If approved, full liability will be assigned to The Office (Admin).</p>
                  </div>
                </div>
              )}

              {selectedLoan.loanType === 'top_up' && selectedLoan.previousBalance > 0 && (
                <div style={{ background: '#f3e5f5', border: '2px solid #ce93d8', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
                  <strong style={{ color: '#7b1fa2', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <RefreshCw size={14} /> Top-Up Loan Breakdown
                  </strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#555' }}>New Loan Amount (Principal):</span><strong>{fmt(selectedLoan.amount)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e65100' }}><span>+ Interest ({selectedLoan.interestRate}%):</span><strong>+ {fmt(Number(selectedLoan.amount) * Number(selectedLoan.interestRate) / 100)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f57f17' }}><span>+ Transaction Fee:</span><strong>+ {fmt(txFee(selectedLoan))}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #7b1fa2', paddingTop: '6px', fontWeight: 700, color: '#1565c0' }}><span>= New Loan Balance (Total Repayment):</span><strong style={{ fontSize: '15px' }}>{fmt(selectedLoan.totalRepayment)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #ce93d8', paddingTop: '6px', color: '#555' }}><span>Old Balance Cleared (on approval):</span><strong style={{ color: '#c62828' }}>− {fmt(selectedLoan.previousBalance)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2e7d32', fontWeight: 700 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Banknote size={13} /> Cash Disbursed to Member:</span>
                      <strong style={{ fontSize: '15px' }}>{fmt(Math.max(0, Number(selectedLoan.amount) - Number(selectedLoan.previousBalance)))}</strong>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div style={{ background: '#e8f5e9', borderRadius: '10px', padding: '14px', border: '2px solid #a5d6a7' }}>
                  <div style={{ fontSize: '11px', color: '#555', fontWeight: 600, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Banknote size={13} /> Cash to Member
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#2e7d32', marginTop: '4px' }}>
                    {selectedLoan.loanType === 'top_up' && selectedLoan.previousBalance > 0
                      ? fmt(Math.max(0, Number(selectedLoan.amount) - Number(selectedLoan.previousBalance)))
                      : fmt(Number(selectedLoan.amount))
                    }
                  </div>
                </div>
                <div style={{ background: '#e3f2fd', borderRadius: '10px', padding: '14px', border: '2px solid #90caf9' }}>
                  <div style={{ fontSize: '11px', color: '#555', fontWeight: 600, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Wallet size={13} /> Total Repayment
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#1565c0', marginTop: '4px' }}>{fmt(selectedLoan.totalRepayment)}</div>
                </div>
              </div>

              <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '14px', marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  ['Interest Rate',    `${selectedLoan.interestRate}%`],
                  ['Duration',         `${selectedLoan.durationMonths} month(s)`],
                  ['Transaction Fee',  fmt(txFee(selectedLoan))],
                  ['Applied On',       fd(selectedLoan.createdAt)],
                  ...(selectedLoan.approvalStatus === 'approved' ? [
                    ['Disbursed On',      fd(selectedLoan.disbursementDate)],
                    ['Due Date',          fd(selectedLoan.dueDate)],
                    ['Amount Paid',       fmt(selectedLoan.amountPaid)],
                    ['Remaining Balance', fmt(selectedLoan.remainingBalance)],
                    ...(selectedLoan.penaltyInterest > 0 ? [['Penalty Interest', fmt(selectedLoan.penaltyInterest)]] : []),
                  ] : []),
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a2e', marginTop: '2px' }}>{value}</div>
                  </div>
                ))}
              </div>

              {selectedLoan.guarantors?.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#374151', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={14} /> Guarantors
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {selectedLoan.guarantors.map((g, gi) => {
                      const name = g.guarantorId === -1 ? 'The Office' : g.guarantor ? `${g.guarantor.firstName} ${g.guarantor.lastName}` : `Guarantor #${gi + 1}`;
                      const sc = { accepted: { bg: '#e8f5e9', color: '#2e7d32' }, pending: { bg: '#fff8e1', color: '#e65100' }, rejected: { bg: '#ffebee', color: '#c62828' }, admin_override: { bg: '#e3f2fd', color: '#1565c0' } }[g.approvalStatus] || { bg: '#f5f5f5', color: '#777' };
                      return (
                        <span key={gi} style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: sc.bg, color: sc.color, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          {g.guarantorId === -1 ? <Building2 size={11} /> : <Users size={11} />} {name} · {g.approvalStatus}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedLoan.payments?.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#374151', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CreditCard size={14} /> Payment History ({selectedLoan.payments.length})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ background: '#e8f5e9', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: '#555', fontWeight: 600, textTransform: 'uppercase' }}>Total Paid</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#2e7d32', marginTop: '2px' }}>{fmt(selectedLoan.payments.reduce((s, p) => s + Number(p.amount || 0), 0))}</div>
                    </div>
                    <div style={{ background: '#e3f2fd', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: '#555', fontWeight: 600, textTransform: 'uppercase' }}>Remaining</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#1565c0', marginTop: '2px' }}>{fmt(selectedLoan.remainingBalance)}</div>
                    </div>
                    <div style={{ background: '#f3e5f5', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: '#555', fontWeight: 600, textTransform: 'uppercase' }}>Payments</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#7b1fa2', marginTop: '2px' }}>{selectedLoan.payments.length}</div>
                    </div>
                  </div>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 2fr', background: '#f3f4f6', padding: '8px 14px' }}>
                      {['Date', 'Amount', 'Method', 'Notes'].map(h => (
                        <div key={h} style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#6b7280' }}>{h}</div>
                      ))}
                    </div>
                    {selectedLoan.payments
                      .slice().sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))
                      .map((p, pi) => (
                        <div key={pi} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 2fr', padding: '10px 14px', alignItems: 'center', borderTop: '1px solid #f0f0f0', background: p.paymentMethod === 'top_up_clearance' ? '#f3e5f5' : pi % 2 === 0 ? 'white' : '#fafafa' }}>
                          <div style={{ fontSize: '13px', color: '#374151', fontWeight: 600 }}>{fd(p.paymentDate)}</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: p.paymentMethod === 'top_up_clearance' ? '#7b1fa2' : '#2e7d32' }}>{fmt(p.amount)}</div>
                          <div>
                            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'capitalize', padding: '2px 8px', borderRadius: '10px', background: p.paymentMethod === 'top_up_clearance' ? '#f3e5f5' : p.paymentMethod === 'mpesa' ? '#e8f5e9' : '#e3f2fd', color: p.paymentMethod === 'top_up_clearance' ? '#7b1fa2' : p.paymentMethod === 'mpesa' ? '#2e7d32' : '#1565c0', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              {p.paymentMethod === 'top_up_clearance' ? <><RefreshCw size={10} /> Top-Up</> : (p.paymentMethod || 'Cash')}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#888', fontStyle: p.notes ? 'normal' : 'italic' }}>{p.notes || '—'}</div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {selectedLoan.approvalStatus === 'approved' && (!selectedLoan.payments || selectedLoan.payments.length === 0) && (
                <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '16px', textAlign: 'center', color: '#888', marginBottom: '20px', border: '1px dashed #e5e7eb' }}>
                  <CreditCard size={24} style={{ marginBottom: 6, color: '#bbb' }} />
                  <div style={{ fontWeight: 600, color: '#555' }}>No payments recorded yet</div>
                  <div style={{ fontSize: '13px', marginTop: '4px' }}>Payments will appear here once recorded.</div>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowDetailModal(false)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Loans;