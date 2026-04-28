import React, { useState, useEffect, useCallback } from 'react';
import { loansAPI, guarantorsAPI } from '../../Service/Api';
import Navbar from '../Navbar/navbar';
import LoanGuarantorStatus from './../Shared/LoanGuarantorStatus';
import './MyLoanApplications.css';

const MyLoanApplications = () => {
  console.log('MyLoanApplications rendered');
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
    console.log('Toggle expand for loan:', loanId);
    console.log('Current expandedLoan:', expandedLoan);
    if (expandedLoan === loanId) {
      setExpandedLoan(null);
    } else {
      setExpandedLoan(loanId);
      const loan = loans.find(l => l.id === loanId);
      console.log('Found loan:', loan);
      console.log('Loan guarantors:', loan?.guarantors);
      if (loan && loan.guarantors) {
        loan.guarantors.forEach(guarantor => {
          fetchGuarantorEligibility(loanId, guarantor.guarantorId, loan.amount);
        });
      }
    }
  };

  // ── Open replace modal & fetch eligible guarantors ────────────
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
        g => !existingIds.includes(g.id) || g.id === oldGuarantorMemberId // ✅ compare member ids
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
    console.log('Guarantors:', JSON.stringify(loan.guarantors, null, 2));
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
                  <div className="guarantor-status" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {guarantor.approvalStatus === 'pending'  && <span className="status-badge pending">Pending</span>}
                    {guarantor.approvalStatus === 'accepted' && <span className="status-badge accepted">Accepted</span>}
                    {(isRejected && !isOffice) && (
                      <>
                        <span className="status-badge declined" style={{ background: '#ffebee', color: '#c62828', border: '1px solid #f44336' }}>Declined</span>
                        <button
                          onClick={() => openReplaceModal(loan.id, guarantor.guarantorId, loan.amount, guarantor.id)}
                          style={{
                            padding: '4px 10px', fontSize: '12px', fontWeight: 600,
                            background: '#1976d2', color: 'white', border: 'none',
                            borderRadius: '6px', cursor: 'pointer',
                          }}
                        >
                          🔄 Replace
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {eligibility && !isOffice && (
                  <div className="guarantor-savings-info">
                  </div>
                )}

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
           {loans.map((loan) => {
  console.log('Loan:', loan.id, '| approvalStatus:', loan.approvalStatus, '| status:', loan.status);
  return (
    <div key={loan.id} className="loan-card">
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

      <div className="loan-details">
        <div className="detail-grid">
          <div className="detail-item">
            <span className="label">Amount:</span>
            <span className="value">{formatCurrency(loan.amount)}</span>
          </div>
          <div className="detail-item">
            <span className="label">Interest Rate:</span>
            <span className="value">{loan.interestRate}%</span>
          </div>
          <div className="detail-item">
            <span className="label">Duration:</span>
            <span className="value">{loan.durationMonths} months</span>
          </div>
          <div className="detail-item">
            <span className="label">Total Repayment:</span>
            <span className="value highlight">{formatCurrency(loan.totalRepayment)}</span>
          </div>
        </div>

        {loan.approvalStatus === 'approved' && (
          <div className="detail-grid">
            <div className="detail-item">
              <span className="label">Disbursed:</span>
              <span className="value">{formatDate(loan.disbursementDate)}</span>
            </div>
            <div className="detail-item">
              <span className="label">Due Date:</span>
              <span className="value">{formatDate(loan.dueDate)}</span>
            </div>
            <div className="detail-item">
              <span className="label">Amount Paid:</span>
              <span className="value">{formatCurrency(loan.amountPaid)}</span>
            </div>
            <div className="detail-item">
              <span className="label">Balance:</span>
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

      {/* ── Always show guarantor status + replace for pending loans ── */}
      {loan.approvalStatus === 'pending' && (
        <>
          <LoanGuarantorStatus loanId={loan.id} />

          {/* ── Guarantor replace buttons — always visible, no expand needed ── */}
          {loan.guarantors && loan.guarantors.length > 0 && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0' }}>
              {loan.guarantors.map((guarantor) => {
                const isRejected = guarantor.approvalStatus === 'rejected' || guarantor.approvalStatus === 'declined';
                const isOffice   = Number(guarantor.guarantorId) === -1;
                if (!isRejected || isOffice) return null;
                return (
                  <div
                    key={guarantor.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', marginBottom: '8px',
                      background: '#fff5f5', border: '1px solid #f44336', borderRadius: '8px',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, color: '#c62828', fontSize: '14px' }}>
                        ❌ {guarantor.guarantor?.firstName} {guarantor.guarantor?.lastName}
                      </span>
                      <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>
                        declined to guarantee this loan
                      </span>
                    </div>
                    <button
                      onClick={() => openReplaceModal(loan.id, guarantor.guarantorId, loan.amount, guarantor.id)}
                      style={{
                        padding: '6px 14px', fontSize: '13px', fontWeight: 600,
                        background: '#1976d2', color: 'white', border: 'none',
                        borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      🔄 Replace
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Expanded eligibility details ── */}
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
  );
})}
          </div>
        )}

        {/* ── Replace Guarantor Modal ──────────────────────────── */}
        {replaceModal && (
          <div className="modal-overlay" onClick={closeReplaceModal}>
            <div
              className="modal-content"
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '560px', maxHeight: '85vh', overflowY: 'auto' }}
            >
              <h2>🔄 Replace Guarantor</h2>
              <p style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>
                Select a new guarantor for your <strong>{formatCurrency(replaceModal.loanAmount)}</strong> loan.
                Only members who are eligible for this loan amount are shown.
              </p>

              {loadingEligible ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#666' }}>
                  Loading eligible guarantors...
                </div>
              ) : eligibleForReplace.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', background: '#fff8e1', borderRadius: '8px', color: '#e65100' }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>No eligible guarantors available</p>
                  <p style={{ margin: '8px 0 0', fontSize: '13px' }}>No other members currently qualify to guarantee this loan amount.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                  {eligibleForReplace.filter(g => g.isEligible).map(g => (
                    <div
                      key={g.id}
                      onClick={() => setSelectedNewGuarantor(g)}
                      style={{
                        padding: '14px', borderRadius: '8px', cursor: 'pointer',
                        border: selectedNewGuarantor?.id === g.id ? '2px solid #1976d2' : '2px solid #86efac',
                        background: selectedNewGuarantor?.id === g.id ? '#e3f2fd' : '#f0fdf4',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '15px' }}>{g.firstName} {g.lastName}</strong>
                          <span style={{ marginLeft: '10px', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, background: '#d1fae5', color: '#065f46', border: '1px solid #10b981' }}>
                            ✓ Eligible
                          </span>
                        </div>
                        {selectedNewGuarantor?.id === g.id && (
                          <span style={{ color: '#1976d2', fontWeight: 700, fontSize: '18px' }}>✓</span>
                        )}
                      </div>
                      <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', fontSize: '12px', color: '#555' }}>
                        {/* <div><span style={{ color: '#888' }}>Savings:</span> <strong>{formatCurrency(g.totalSavings)}</strong></div>
                        <div><span style={{ color: '#888' }}>Available:</span> <strong style={{ color: '#2e7d32' }}>{formatCurrency(g.availableSavings)}</strong></div> */}
                        <div><span style={{ color: '#888' }}>Guarantees:</span> <strong style={{ color: g.activeGuaranteeCount >= 3 ? '#f44336' : '#333' }}>{g.activeGuaranteeCount}/3</strong></div>
                      </div>
                    </div>
                  ))}

                  {eligibleForReplace.filter(g => !g.isEligible).length > 0 && (
                    <>
                      <div style={{ fontSize: '12px', color: '#999', fontWeight: 600, textTransform: 'uppercase', marginTop: '8px' }}>
                        Ineligible Members
                      </div>
                      {eligibleForReplace.filter(g => !g.isEligible).map(g => (
                        <div
                          key={g.id}
                          style={{
                            padding: '12px', borderRadius: '8px', opacity: 0.6,
                            border: '2px solid #fca5a5', background: '#fef2f2',
                            cursor: 'not-allowed',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong style={{ fontSize: '14px' }}>{g.firstName} {g.lastName}</strong>
                              <span style={{ marginLeft: '10px', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, background: '#fee2e2', color: '#991b1b', border: '1px solid #ef4444' }}>
                                ✗ Ineligible
                              </span>
                            </div>
                          </div>
                          {/* <div style={{ marginTop: '6px', fontSize: '12px', color: '#c62828' }}>
                            {g.ineligibilityReason}
                          </div> */}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={closeReplaceModal}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!selectedNewGuarantor || replacingId !== null}
                  onClick={handleReplaceGuarantor}
                  style={{ opacity: !selectedNewGuarantor ? 0.5 : 1 }}
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