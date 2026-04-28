import React, { useState, useEffect, useCallback } from 'react';
import { loansAPI } from '../../Service/Api';
import './LoanGuarantorStatus.css';
import { CheckCircle, XCircle, Clock, Building2, AlertCircle, Info } from 'lucide-react';

const LoanGuarantorStatus = ({ loanId }) => {
  const [status, setStatus]   = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchGuarantorStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await loansAPI.getLoanGuarantorStatus(loanId);
      setStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch guarantor status:', err);
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    if (loanId) fetchGuarantorStatus();
  }, [loanId, fetchGuarantorStatus]);

  const getStatusIcon = (approvalStatus) => {
    switch (approvalStatus) {
      case 'accepted':
      case 'admin_override': return <CheckCircle size={18} color="#4caf50" />;
      case 'rejected':       return <XCircle size={18} color="#f44336" />;
      default:               return <Clock size={18} color="#f59e0b" />;
    }
  };

  const getStatusText = (approvalStatus) => {
    switch (approvalStatus) {
      case 'accepted':       return 'Accepted';
      case 'admin_override': return 'Approved by Admin';
      case 'rejected':       return 'Declined';
      default:               return 'Waiting for response';
    }
  };

  const getStatusClass = (approvalStatus) => {
    switch (approvalStatus) {
      case 'accepted':
      case 'admin_override': return 'status-accepted';
      case 'rejected':       return 'status-rejected';
      default:               return 'status-pending';
    }
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return null;
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    if (seconds < 60)     return 'Just now';
    if (seconds < 3600)   return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400)  return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) return <div className="guarantor-status-loading">Loading guarantor status...</div>;
  if (!status || !status.guarantors || status.guarantors.length === 0) return null;

  return (
    <div className="guarantor-status-container">
      <h3>Guarantor Approval Status</h3>

      {!status.allAccepted && (
        <div className="status-summary">
          {status.anyPending && (
            <div className="summary-warning" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              Waiting for guarantor approval. Admin cannot approve loan until all guarantors accept.
            </div>
          )}
          {status.anyRejected && (
            <div className="summary-error" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              Some guarantors declined. Click the Replace button on the guarantor below to find a replacement.
            </div>
          )}
        </div>
      )}

      <div className="guarantors-list">
        {status.guarantors.map((guarantor) => (
          <div key={guarantor.id} className={`guarantor-item ${getStatusClass(guarantor.approvalStatus)}`}>
            <div className="guarantor-icon">
              {getStatusIcon(guarantor.approvalStatus)}
            </div>
            <div className="guarantor-details">
              <div className="guarantor-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {guarantor.guarantorName}
                {guarantor.guarantorId === -1 && (
                  <span className="office-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <Building2 size={11} /> Office
                  </span>
                )}
              </div>
              <div className="guarantor-status-text">
                {getStatusText(guarantor.approvalStatus)}
                {guarantor.responseDate && (
                  <span className="response-time"> · {formatTimeAgo(guarantor.responseDate)}</span>
                )}
              </div>
              {guarantor.rejectionReason && (
                <div className="rejection-reason">
                  Reason: {guarantor.rejectionReason}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {status.allAccepted && (
        <div className="status-success" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={16} /> All guarantors have accepted! Loan is ready for admin approval.
        </div>
      )}
    </div>
  );
};

export default LoanGuarantorStatus;