import React, { useState, useEffect } from 'react';
import { loansAPI, membersAPI } from '../../Service/Api';
import Navbar from '../Navbar/navbar';
import './GuarantorRequests.css';
import { ClipboardList, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';

const GuarantorRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
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
      const enrichedRequests = await Promise.all(
        res.data.requests.map(async (req) => {
          const liability = await calculateLiability(req);
          return { ...req, liability };
        })
      );
      setRequests(enrichedRequests);
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to load guarantor requests');
    } finally {
      setLoading(false);
    }
  };

  const calculateLiability = async (request) => {
    try {
      const applicantResponse = await membersAPI.getById(request.applicantId);
      const applicantSavings = Number(applicantResponse.data.member.totalSavings || 0);
      const loanAmount = Number(request.loanAmount);
      const remainingAfterSavings = Math.max(0, loanAmount - applicantSavings);
      const guarantorCount = request.guarantorCount || 1;
      return Math.round(remainingAfterSavings / guarantorCount);
    } catch (err) {
      console.error('Calculate liability error:', err);
      return Math.round(Number(request.loanAmount) / (request.guarantorCount || 1));
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-KE', {
      style: 'currency', currency: 'KES', minimumFractionDigits: 0,
    }).format(Math.round(amount || 0));

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
                    <span className="gr-stat-value">{request.durationMonths} Month</span>
                  </div>
                </div>

                {/* Total Repayment */}
                <div className="gr-repayment-row">
                  <span className="gr-repayment-label">Total Repayment</span>
                  <span className="gr-repayment-value">{formatCurrency(request.totalRepayment)}</span>
                </div>

                {/* Liability */}
                <div className="gr-liability">
                  <div className="gr-liability-icon">
                    <AlertTriangle size={16} strokeWidth={2} />
                  </div>
                  <div className="gr-liability-body">
                    <p className="gr-liability-label">Your Liability if Defaulted</p>
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