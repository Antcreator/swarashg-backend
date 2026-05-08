import React, { useState, useEffect } from 'react';
import { loansAPI } from '../../Service/Api';
import Navbar from '../Navbar/navbar';
import './GuarantorRequests.css';
import { ClipboardList, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';

// ── Must match MemberLoanApplication constants exactly ────────────
const TRANSACTION_FEE    = 108;
const ONE_SHARE_DIVISOR  = 3;   // oneShare always divides principal by 3

// ── Liability formula (mirrors MemberLoanApplication / LoanSummaryBox):
//    Step 1: totalRepayment = principal + (principal × interestRate/100) + TRANSACTION_FEE
//    Step 2: oneShare       = principal / ONE_SHARE_DIVISOR            (always ÷ 3)
//    Step 3: reduced        = totalRepayment − oneShare
//    Step 4: liabilityEach  = ceil(reduced / requiredGuarantors)
//
//    requiredGuarantors = loanAmount < 80,000 → 3, else → 5
//
// Example (99k, 5 guarantors, 10% interest):
//   totalRepayment = 99,000 + 9,900 + 108 = 109,008
//   oneShare       = 99,000 / 3 = 33,000
//   reduced        = 109,008 − 33,000 = 76,008
//   liabilityEach  = ceil(76,008 / 5) = 15,202
const computeLiability = (loanAmount, interestRate) => {
  const principal          = Number(loanAmount)    || 0;
  const rate               = Number(interestRate)  || 0;
  const requiredGuarantors = principal < 80000 ? 3 : 5;

  const totalRepayment = principal + (principal * rate / 100) + TRANSACTION_FEE;
  const oneShare       = principal / ONE_SHARE_DIVISOR;
  const reduced        = totalRepayment - oneShare;
  return {
    liability:           Math.ceil(reduced / requiredGuarantors),
    totalRepayment:      Math.ceil(totalRepayment),
    oneShare:            Math.ceil(oneShare),
    requiredGuarantors,
  };
};

const GuarantorRequests = () => {
  const [requests, setRequests]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [respondingTo, setRespondingTo] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await loansAPI.getMyGuarantorRequests();

      // Compute liability locally using the same formula as MemberLoanApplication
      // No extra API call needed — all required fields come from the request itself
      const enrichedRequests = (res.data.requests || []).map((req) => {
        const { liability, totalRepayment, oneShare, requiredGuarantors } =
          computeLiability(req.loanAmount, req.interestRate);
        return { ...req, liability, totalRepayment, oneShare, requiredGuarantors };
      });

      setRequests(enrichedRequests);
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to load guarantor requests');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-KE', {
      style: 'currency', currency: 'KES', minimumFractionDigits: 0,
    }).format(Math.ceil(amount || 0));

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric', month: 'short', day: 'numeric',
    });

  const handleAccept = async (guarantorId) => {
    if (!window.confirm('Are you sure you want to accept this guarantor request?')) return;
    try {
      await loansAPI.respondToGuarantorRequest(guarantorId, 'accept');
      alert('Guarantor request accepted successfully!');
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to accept request');
    }
  };

  const handleReject = async (guarantorId) => {
    if (!rejectReason.trim()) { alert('Please provide a reason for declining'); return; }
    try {
      await loansAPI.respondToGuarantorRequest(guarantorId, 'reject', rejectReason);
      alert('Guarantor request declined');
      setRespondingTo(null);
      setRejectReason('');
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to decline request');
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="gr-container">
          <div className="gr-loading">
            <div className="gr-spinner" />
            <p>Loading guarantor requests…</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="gr-container">
        {/* Page Header */}
        <div className="gr-header">
          <div className="gr-header-icon">
            <ClipboardList size={20} strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="gr-title">Guarantor Requests</h1>
            <p className="gr-subtitle">Loans where you are requested to stand as guarantor</p>
          </div>
          {requests.length > 0 && (
            <span className="gr-count-badge">{requests.length} pending</span>
          )}
        </div>

        {requests.length === 0 ? (
          <div className="gr-empty">
            <div className="gr-empty-icon">
              <CheckCircle size={40} strokeWidth={1.5} />
            </div>
            <h3>All clear</h3>
            <p>You have no pending guarantor requests right now.</p>
          </div>
        ) : (
          <div className="gr-grid">
            {requests.map((request, idx) => (
              <div
                key={request.id}
                className="gr-card"
                style={{ animationDelay: `${idx * 0.07}s` }}
              >
                {/* Card top bar */}
                <div className="gr-card-bar" />

                {/* Card Header */}
                <div className="gr-card-head">
                  <div>
                    <h3 className="gr-applicant-name">{request.applicantName}</h3>
                    <span className="gr-req-date">
                      <Clock size={11} strokeWidth={2} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      Requested {formatDate(request.createdAt)}
                    </span>
                  </div>
                  <span className="gr-status-pill">Pending</span>
                </div>

                {/* Loan Stats */}
                <div className="gr-stats">
                  <div className="gr-stat">
                    <span className="gr-stat-label">Loan Amount</span>
                    <span className="gr-stat-value">{formatCurrency(request.loanAmount)}</span>
                  </div>
                  <div className="gr-stat">
                    <span className="gr-stat-label">Interest</span>
                    <span className="gr-stat-value">{request.interestRate}%</span>
                  </div>
                  <div className="gr-stat">
                    <span className="gr-stat-label">Duration</span>
                    <span className="gr-stat-value">{request.durationMonths} Month{request.durationMonths !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                {/* Total Repayment */}
                <div className="gr-repayment-row">
                  <span className="gr-repayment-label">Total Repayment</span>
                  <span className="gr-repayment-value">{formatCurrency(request.totalRepayment)}</span>
                </div>

                {/* Liability — computed with the same formula as MemberLoanApplication */}
                <div className="gr-liability">
                  <div className="gr-liability-icon">
                    <AlertTriangle size={16} strokeWidth={2} />
                  </div>
                  <div className="gr-liability-body">
                    <p className="gr-liability-label">
                      Your Liability if Defaulted
                      <span style={{
                        marginLeft: 6, fontSize: '10px', color: '#888',
                        fontWeight: 400, display: 'block', marginTop: 2,
                      }}>
                        ({formatCurrency(request.totalRepayment)} − {formatCurrency(request.oneShare)}) ÷ {request.requiredGuarantors}
                      </span>
                    </p>
                    <p className="gr-liability-value">
                      {request.liability != null
                        ? formatCurrency(request.liability)
                        : 'Calculating…'}
                    </p>
                  </div>
                </div>

                {/* Actions / Reject Form */}
                {respondingTo === request.id ? (
                  <div className="gr-reject-form">
                    <p className="gr-reject-title">Reason for declining</p>
                    <textarea
                      className="gr-textarea"
                      placeholder="Please explain why you are declining this request…"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                    />
                    <div className="gr-form-actions">
                      <button
                        className="gr-btn gr-btn-confirm-reject"
                        onClick={() => handleReject(request.id)}
                        disabled={!rejectReason.trim()}
                      >
                        <XCircle size={14} strokeWidth={2} />
                        Confirm Decline
                      </button>
                      <button
                        className="gr-btn gr-btn-cancel"
                        onClick={() => { setRespondingTo(null); setRejectReason(''); }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="gr-actions">
                    <button
                      className="gr-btn gr-btn-accept"
                      onClick={() => handleAccept(request.id)}
                    >
                      <CheckCircle size={14} strokeWidth={2} />
                      Accept
                    </button>
                    <button
                      className="gr-btn gr-btn-decline"
                      onClick={() => setRespondingTo(request.id)}
                    >
                      <XCircle size={14} strokeWidth={2} />
                      Decline
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default GuarantorRequests;