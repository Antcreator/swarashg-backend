import React, { useState, useEffect, useCallback } from 'react';
import { loansAPI } from '../../Service/Api';
import { useIsStaff } from '../Protected Route/Protectedroute';
import Navbar from '../Navbar/navbar';
import { Link } from 'react-router-dom';
import './OfficeGuarantorRequests.css';
import { Building2, CheckCircle, XCircle, ChevronLeft, AlertTriangle, Eye } from 'lucide-react';

const OfficeGuarantorRequests = () => {
  const isStaff = useIsStaff();
  const [requests, setRequests]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [respondingTo, setRespondingTo] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchOfficeRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await loansAPI.getAll({ approvalStatus: 'pending' });
      const officeRequests = [];
      res.data.loans.forEach((loan) => {
        if (loan.guarantors && loan.guarantors.length > 0) {
          loan.guarantors.forEach((g) => {
            if (g.guarantorId === -1 && g.approvalStatus === 'pending') {
              officeRequests.push({
                id:             g.id,
                loanId:         loan.id,
                loanAmount:     loan.amount,
                interestRate:   loan.interestRate,
                durationMonths: loan.durationMonths,
                totalRepayment: loan.totalRepayment || calculateTotal(loan.amount, loan.interestRate),
                applicantName:  loan.member ? `${loan.member.firstName} ${loan.member.lastName}` : 'Unknown',
                applicantId:    loan.memberId,
                createdAt:      loan.createdAt,
                approvalStatus: g.approvalStatus,
              });
            }
          });
        }
      });
      setRequests(officeRequests);
    } catch (err) {
      console.error('Failed to fetch office requests:', err);
      alert('Failed to load office guarantor requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOfficeRequests(); }, [fetchOfficeRequests]);

  const calculateTotal = (amount, rate) => {
    const principal = Number(amount);
    return principal + (principal * Number(rate)) / 100;
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-KE', {
      style: 'currency', currency: 'KES', minimumFractionDigits: 0,
    }).format(Math.round(amount || 0));

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const handleApprove = async (guarantorId) => {
    if (!window.confirm('Approve The Office as guarantor for this loan?')) return;
    try {
      await loansAPI.respondToGuarantorRequest(guarantorId, 'accept');
      alert('Office guarantee approved!');
      fetchOfficeRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve request');
    }
  };

  const handleReject = async (guarantorId) => {
    if (!rejectReason.trim()) { alert('Please provide a reason for rejection'); return; }
    try {
      await loansAPI.respondToGuarantorRequest(guarantorId, 'reject', rejectReason);
      alert('Office guarantee declined');
      setRespondingTo(null);
      setRejectReason('');
      fetchOfficeRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject request');
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="ogr-container">
          <div className="ogr-loading">
            <div className="ogr-spinner" />
            <p>Loading office guarantor requests…</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="ogr-container">
        {/* Breadcrumb */}
        <Link to="/admin/dashboard" className="ogr-back">
          <ChevronLeft size={14} strokeWidth={2.5} />
          Dashboard
        </Link>

        {/* Page Header */}
        <div className="ogr-header">
          <div className="ogr-header-left">
            <div className="ogr-header-icon">
              <Building2 size={22} strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="ogr-title">Office Guarantor Requests</h1>
              <p className="ogr-subtitle">Manage The Office (Super Guarantor) approval requests</p>
            </div>
          </div>
          {requests.length > 0 && (
            <span className="ogr-count-badge">{requests.length} pending</span>
          )}
        </div>

        {requests.length === 0 ? (
          <div className="ogr-empty">
            <div className="ogr-empty-icon">
              <CheckCircle size={40} strokeWidth={1.5} />
            </div>
            <h3>No Pending Requests</h3>
            <p>There are no pending office guarantor requests at this time.</p>
          </div>
        ) : (
          <div className="ogr-grid">
            {requests.map((request, idx) => (
              <div
                key={request.id}
                className="ogr-card"
                style={{ animationDelay: `${idx * 0.07}s` }}
              >
                {/* accent stripe */}
                <div className="ogr-card-bar" />

                {/* Card Header */}
                <div className="ogr-card-head">
                  <div>
                    <h3 className="ogr-applicant-name">{request.applicantName}</h3>
                    <span className="ogr-req-date">Requested on {formatDate(request.createdAt)}</span>
                  </div>
                  <span className="ogr-office-pill">
                    <Building2 size={11} strokeWidth={2} />
                    The Office
                  </span>
                </div>

                {/* Loan Stats */}
                <div className="ogr-stats">
                  <div className="ogr-stat">
                    <span className="ogr-stat-label">Loan Amount</span>
                    <span className="ogr-stat-value">{formatCurrency(request.loanAmount)}</span>
                  </div>
                  <div className="ogr-stat">
                    <span className="ogr-stat-label">Interest</span>
                    <span className="ogr-stat-value">{request.interestRate}%</span>
                  </div>
                  <div className="ogr-stat">
                    <span className="ogr-stat-label">Duration</span>
                    <span className="ogr-stat-value">{request.durationMonths} mo.</span>
                  </div>
                </div>

                {/* Total Repayment */}
                <div className="ogr-repayment-row">
                  <span className="ogr-repayment-label">Total Repayment</span>
                  <span className="ogr-repayment-value">{formatCurrency(request.totalRepayment)}</span>
                </div>

                {/* Actions */}
                {isStaff ? (
                  <div className="ogr-staff-notice">
                    <Eye size={14} strokeWidth={2} />
                    View only — actions disabled for staff
                  </div>
                ) : respondingTo === request.id ? (
                  <div className="ogr-reject-form">
                    <p className="ogr-reject-title">
                      <AlertTriangle size={12} strokeWidth={2.5} />
                      Reason for declining
                    </p>
                    <textarea
                      className="ogr-textarea"
                      placeholder="Provide a reason for declining this office guarantee…"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                    />
                    <div className="ogr-form-actions">
                      <button
                        className="ogr-btn ogr-btn-confirm-reject"
                        onClick={() => handleReject(request.id)}
                        disabled={!rejectReason.trim()}
                      >
                        <XCircle size={13} strokeWidth={2} />
                        Confirm Decline
                      </button>
                      <button
                        className="ogr-btn ogr-btn-cancel"
                        onClick={() => { setRespondingTo(null); setRejectReason(''); }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ogr-actions">
                    <button
                      className="ogr-btn ogr-btn-approve"
                      onClick={() => handleApprove(request.id)}
                    >
                      <CheckCircle size={14} strokeWidth={2} />
                      Approve Guarantee
                    </button>
                    <button
                      className="ogr-btn ogr-btn-decline"
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

export default OfficeGuarantorRequests;