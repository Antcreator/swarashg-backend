import React, { useState, useEffect, useCallback } from 'react';
import { loansAPI, guarantorsAPI } from '../../Service/Api';
import Navbar from '../Navbar/navbar';
import LoanGuarantorStatus from './../Shared/LoanGuarantorStatus';
import './MyLoanApplications.css';

const MyLoanApplications = () => {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedLoan, setExpandedLoan] = useState(null);
  const [guarantorDetails, setGuarantorDetails] = useState({});

  const [replaceModal, setReplaceModal]             = useState(null);
  const [eligibleForReplace, setEligibleForReplace] = useState([]);
  const [loadingEligible, setLoadingEligible]       = useState(false);
  const [selectedNewGuarantor, setSelectedNewGuarantor] = useState(null);
  const [replacingId, setReplacingId]               = useState(null);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchMyLoans = useCallback(async () => {
    try {
      setLoading(true);
      const res = await loansAPI.getAll({ memberId: user.memberId });
      setLoans(res.data.loans || []);
    } catch (err) {
      console.error('Failed to fetch loans:', err);
      alert('Failed to load your loan applications');
    } finally {
      setLoading(false);
    }
  }, [user.memberId]);

  useEffect(() => { fetchMyLoans(); }, [fetchMyLoans]);

  const fetchGuarantorEligibility = async (loanId, guarantorId, loanAmount) => {
    try {
      const response = await guarantorsAPI.checkEligibility(guarantorId, { loanAmount });
      setGuarantorDetails(prev => ({
        ...prev,
        [`${loanId}-${guarantorId}`]: response.data.guarantor,
      }));
    } catch (error) {
      console.error('Error fetching guarantor eligibility:', error);
    }
  };

  const toggleLoanExpand = (loanId) => {
    if (expandedLoan === loanId) {
      setExpandedLoan(null);
    } else {
      setExpandedLoan(loanId);
      const loan = loans.find(l => l.id === loanId);
      if (loan && loan.guarantors) {
        loan.guarantors.forEach(guarantor => {
          fetchGuarantorEligibility(loanId, guarantor.guarantorId, loan.amount);
        });
      }
    }
  };

  const openReplaceModal = async (loanId, oldGuarantorMemberId, loanAmount, oldGuarantorRecordId) => {
    setReplaceModal({ loanId, oldGuarantorId: oldGuarantorRecordId, loanAmount });
    setSelectedNewGuarantor(null);
    setLoadingEligible(true);
    try {
      const res = await guarantorsAPI.getEligible({
        loanAmount,
        excludeMemberId: user.memberId,
      });
      const loan = loans.find(l => l.id === loanId);
      const existingIds = (loan?.guarantors || []).map(g => g.guarantorId);
      const filtered = (res.data.guarantors || []).filter(
        g => !existingIds.includes(g.id) || g.id === oldGuarantorMemberId
      );
      setEligibleForReplace(filtered);
    } catch (err) {
      console.error('Failed to fetch eligible guarantors:', err);
      setEligibleForReplace([]);
    } finally {
      setLoadingEligible(false);
    }
  };

  const closeReplaceModal = () => {
    setReplaceModal(null);
    setSelectedNewGuarantor(null);
    setEligibleForReplace([]);
  };

  const handleReplaceGuarantor = async () => {
    if (!selectedNewGuarantor || !replaceModal) return;
    setReplacingId(replaceModal.oldGuarantorId);
    try {
      const res = await loansAPI.replaceGuarantor(replaceModal.loanId, {
        oldGuarantorId: replaceModal.oldGuarantorId,
        newGuarantorId: selectedNewGuarantor.id,
      });
      alert(`✅ Guarantor replaced with ${res.data.newGuarantorName}`);
      closeReplaceModal();
      fetchMyLoans();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to replace guarantor');
    } finally {
      setReplacingId(null);
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount || 0);

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getStatusBadge = (loan) => {
    if (loan.approvalStatus === 'pending')  return <span className="badge badge-warning">Pending Approval</span>;
    if (loan.approvalStatus === 'rejected') return <span className="badge badge-danger">Rejected</span>;
    if (loan.status === 'active')  return <span className="badge badge-success">Active</span>;
    if (loan.status === 'arrears') return <span className="badge badge-warning">Arrears</span>;
    if (loan.status === 'default') return <span className="badge badge-danger">Default</span>;
    if (loan.status === 'paid')    return <span className="badge badge-info">Paid</span>;
    return <span className="badge badge-secondary">{loan.status}</span>;
  };

  const renderGuarantorEligibility = (loan) => {
    if (!loan.guarantors || loan.guarantors.length === 0) return null;

    return (
      <div className="guarantors-eligibility-section">
        <h4>Guarantor Status</h4>
        <div className="guarantors-list">
          {loan.guarantors.map((guarantor) => {
            const guarantorKey = `${loan.id}-${guarantor.guarantorId}`;
            const eligibility  = guarantorDetails[guarantorKey];
            const isRejected   = guarantor.approvalStatus === 'rejected' || guarantor.approvalStatus === 'declined';
            const isOffice     = guarantor.guarantorId === -1;

            return (
              <div
                key={guarantor.id}
                className={`guarantor-eligibility-card ${eligibility?.isEligible ? 'eligible' : eligibility ? 'ineligible' : ''}`}
                style={isRejected ? { border: '2px solid #f44336', background: '#fff5f5' } : {}}
              >
                <div className="guarantor-header">
                  <div className="guarantor-name">
                    {isOffice ? 'The Office' : `${guarantor.guarantor?.firstName} ${guarantor.guarantor?.lastName}`}
                    {eligibility && !isOffice && (
                      eligibility.isEligible
                        ? <span className="eligibility-badge eligible">✓ Eligible</span>
                        : <span className="eligibility-badge ineligible">✗ Ineligible</span>
                    )}
                  </div>
                  <div className="guarantor-status">
                    {guarantor.approvalStatus === 'pending'  && <span className="status-badge pending">Pending</span>}
                    {guarantor.approvalStatus === 'accepted' && <span className="status-badge accepted">Accepted</span>}
                    {(isRejected && !isOffice) && (
                      <>
                        <span className="status-badge declined">Declined</span>
                        <button
                          className="btn-replace"
                          onClick={() => openReplaceModal(loan.id, guarantor.guarantorId, loan.amount, guarantor.id)}
                        >
                          🔄 Replace
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isRejected && guarantor.declineReason && (
                  <div className="decline-reason">
                    <strong>Decline Reason:</strong> {guarantor.declineReason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="my-loans-container">
          <div className="loading">Loading your loan applications...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="my-loans-container">
        <div className="page-header">
          <h1>My Loan Applications</h1>
          <p>Track your loan applications and guarantor eligibility</p>
        </div>

        {loans.length === 0 ? (
          <div className="no-loans">
            <div className="empty-icon">📋</div>
            <h3>No Loan Applications</h3>
            <p>You haven't applied for any loans yet.</p>
            <button className="btn-primary" onClick={() => window.location.href = '/member/loans'}>
              Apply for Loan
            </button>
          </div>
        ) : (
          <div className="loans-list">
            {loans.map((loan) => (
              <div key={loan.id} className="loan-card">
                {/* ── Card Header ── */}
                <div className="loan-card-header">
                  <div className="loan-info">
                    <h3>Loan #{loan.id}</h3>
                    <p className="loan-date">Applied on {formatDate(loan.createdAt)}</p>
                  </div>
                  <div className="header-actions">
                    {getStatusBadge(loan)}
                    {loan.approvalStatus === 'pending' && (
                      <button className="btn-expand" onClick={() => toggleLoanExpand(loan.id)}>
                        {expandedLoan === loan.id ? '−' : '+'}
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Core Details ── */}
                <div className="loan-details">
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="label">Amount</span>
                      <span className="value">{formatCurrency(loan.amount)}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Interest Rate</span>
                      <span className="value">{loan.interestRate}%</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Duration</span>
                      <span className="value">{loan.durationMonths} months</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Total Repayment</span>
                      <span className="value highlight">{formatCurrency(loan.totalRepayment)}</span>
                    </div>
                  </div>

                  {loan.approvalStatus === 'approved' && (
                    <div className="detail-grid detail-grid-approved">
                      <div className="detail-item">
                        <span className="label">Disbursed</span>
                        <span className="value">{formatDate(loan.disbursementDate)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Due Date</span>
                        <span className="value">{formatDate(loan.dueDate)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Amount Paid</span>
                        <span className="value">{formatCurrency(loan.amountPaid)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Balance</span>
                        <span className="value">{formatCurrency(loan.remainingBalance)}</span>
                      </div>
                    </div>
                  )}

                  {loan.approvalStatus === 'rejected' && loan.rejectionReason && (
                    <div className="rejection-notice">
                      <strong>Rejection Reason:</strong> {loan.rejectionReason}
                    </div>
                  )}
                </div>

                {/* ── Pending: guarantor status + replace buttons ── */}
                {loan.approvalStatus === 'pending' && (
                  <>
                    <LoanGuarantorStatus loanId={loan.id} />

                    {/* Declined guarantor replace strip */}
                    {loan.guarantors && loan.guarantors.some(g =>
                      (g.approvalStatus === 'rejected' || g.approvalStatus === 'declined') &&
                      Number(g.guarantorId) !== -1
                    ) && (
                      <div className="declined-guarantors-strip">
                        {loan.guarantors.map((guarantor) => {
                          const isRejected = guarantor.approvalStatus === 'rejected' || guarantor.approvalStatus === 'declined';
                          const isOffice   = Number(guarantor.guarantorId) === -1;
                          if (!isRejected || isOffice) return null;
                          return (
                            <div key={guarantor.id} className="declined-guarantor-row">
                              <div className="declined-guarantor-info">
                                <span className="declined-x">❌</span>
                                <div>
                                  <span className="declined-name">
                                    {guarantor.guarantor?.firstName} {guarantor.guarantor?.lastName}
                                  </span>
                                  <span className="declined-label">declined to guarantee this loan</span>
                                </div>
                              </div>
                              <button
                                className="btn-replace"
                                onClick={() => openReplaceModal(loan.id, guarantor.guarantorId, loan.amount, guarantor.id)}
                              >
                                🔄 Replace
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Expanded eligibility details */}
                    {expandedLoan === loan.id && renderGuarantorEligibility(loan)}
                  </>
                )}

                {loan.approvalStatus === 'pending' && (
                  <div className="loan-actions">
                    <button className="btn-secondary" onClick={() => window.location.href = '/member/loans'}>
                      Apply for Another Loan
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Replace Guarantor Modal ── */}
        {replaceModal && (
          <div className="modal-overlay" onClick={closeReplaceModal}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🔄 Replace Guarantor</h2>
                <button className="modal-close" onClick={closeReplaceModal}>✕</button>
              </div>
              <p className="modal-subtitle">
                Select a new guarantor for your <strong>{formatCurrency(replaceModal.loanAmount)}</strong> loan.
                Only eligible members are shown.
              </p>

              {loadingEligible ? (
                <div className="modal-loading">Loading eligible guarantors...</div>
              ) : eligibleForReplace.length === 0 ? (
                <div className="modal-empty">
                  <p className="modal-empty-title">No eligible guarantors available</p>
                  <p className="modal-empty-sub">No other members currently qualify to guarantee this loan amount.</p>
                </div>
              ) : (
                <div className="guarantor-select-list">
                  {/* Eligible */}
                  {eligibleForReplace.filter(g => g.isEligible).map(g => (
                    <div
                      key={g.id}
                      className={`guarantor-option eligible-option ${selectedNewGuarantor?.id === g.id ? 'selected' : ''}`}
                      onClick={() => setSelectedNewGuarantor(g)}
                    >
                      <div className="guarantor-option-header">
                        <div className="guarantor-option-name">
                          <strong>{g.firstName} {g.lastName}</strong>
                          <span className="tag tag-eligible">✓ Eligible</span>
                        </div>
                        {selectedNewGuarantor?.id === g.id && (
                          <span className="selected-check">✓</span>
                        )}
                      </div>
                      <div className="guarantor-option-meta">
                        <span>
                          Guarantees: <strong style={{ color: g.activeGuaranteeCount >= 3 ? '#f44336' : '#333' }}>
                            {g.activeGuaranteeCount}/3
                          </strong>
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Ineligible */}
                  {eligibleForReplace.filter(g => !g.isEligible).length > 0 && (
                    <>
                      <div className="section-divider-label">Ineligible Members</div>
                      {eligibleForReplace.filter(g => !g.isEligible).map(g => (
                        <div key={g.id} className="guarantor-option ineligible-option">
                          <div className="guarantor-option-header">
                            <div className="guarantor-option-name">
                              <strong>{g.firstName} {g.lastName}</strong>
                              <span className="tag tag-ineligible">✗ Ineligible</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeReplaceModal}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!selectedNewGuarantor || replacingId !== null}
                  onClick={handleReplaceGuarantor}
                >
                  {replacingId ? 'Replacing...' : 'Confirm Replacement'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default MyLoanApplications;