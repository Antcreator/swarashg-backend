import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, AlertCircle, Clock } from 'lucide-react';
import { depositsAPI } from '../../Service/Api';
import DepositModal from './DepositModal';
import './DepositCard.css';

const DepositCard = ({ memberId }) => {
  const [summary, setSummary] = useState({
    pendingAmount:    0,
    pendingApproval:  0,
    pendingDeposit:   null,
    rejectedDeposits: [],
    deposits:         []
  });
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Prevent modal from opening until user explicitly clicks the card
  const handleCardClick = (e) => {
    e.stopPropagation();
    setIsModalOpen(true);
  };
  const [loading, setLoading] = useState(true);

  const DISMISSED_KEY = `dismissed_rejections_${memberId}`;

  const getDismissedIds = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
    } catch { return []; }
  }, [DISMISSED_KEY]);

  const [dismissedIds, setDismissedIds] = useState(() => getDismissedIds());

  // Visible (non-dismissed) rejections derived from summary + dismissedIds
  const visibleRejections = summary.rejectedDeposits.filter(
    d => !dismissedIds.includes(d.id)
  );

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      const res = await depositsAPI.getSummary(memberId);
      const deposits = res.data.deposits || [];

      const pendingDeposits = deposits.filter(
        d => d.depositStatus === 'pending_confirmation'
      );

      setSummary({
        pendingAmount:    pendingDeposits.reduce((sum, d) => sum + Number(d.totalAmount || 0), 0),
        pendingApproval:  pendingDeposits.length,
        pendingDeposit:   pendingDeposits[0] || null,
        rejectedDeposits: res.data.rejectedDeposits || [],
        deposits,
      });
    } catch (err) {
      console.error('Error fetching deposit summary:', err);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // Called by DepositModal when a rejection is dismissed — sync state here too
  const handleDismiss = useCallback(() => {
    setDismissedIds(getDismissedIds());
  }, [getDismissedIds]);

  const handleSuccess = () => {
    fetchSummary();
    setIsModalOpen(false);
  };

  const fmt = (v) => new Intl.NumberFormat('en-KE', {
    style: 'currency', currency: 'KES', minimumFractionDigits: 0
  }).format(v || 0);

  const subtitleText = () => {
    if (visibleRejections.length > 0) return `${visibleRejections.length} deposit(s) rejected — click to view`;
    if (summary.pendingApproval > 0)  return `${summary.pendingApproval} awaiting admin approval`;
    return 'Click to make a deposit';
  };

  // Pick the icon based on card state
  const CardIcon = () => {
    if (visibleRejections.length > 0)
      return <AlertCircle size={22} />;
    if (summary.pendingApproval > 0)
      return <Clock size={22} />;
    return <CreditCard size={22} />;
  };

  return (
    <>
      <div
        className="stat-card deposit-card"
        onClick={handleCardClick}
        style={{
          cursor: 'pointer',
          borderColor: visibleRejections.length > 0 ? '#f44336' : undefined
        }}
      >
        <span
          className="small-icon deposit"
          style={{
            background: visibleRejections.length > 0 ? '#ffebee'
              : summary.pendingApproval > 0 ? '#fff8e1' : '#e3f2fd',
            color: visibleRejections.length > 0 ? '#c62828'
              : summary.pendingApproval > 0 ? '#f57f17' : '#1565c0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <CardIcon />
        </span>

        <div className="stat-content">
          <h3>Deposit</h3>
          {loading ? (
            <p className="stat-value">Loading...</p>
          ) : (
            <>
              <p className="stat-value">{fmt(summary.pendingAmount)}</p>
              <span
                className="stat-subtitle"
                style={{ color: visibleRejections.length > 0 ? '#f44336' : undefined }}
              >
                {subtitleText()}
              </span>
            </>
          )}
        </div>

        {summary.pendingApproval > 0 && (
          <div className="pending-badge">{summary.pendingApproval}</div>
        )}
        {/* Only show red badge for non-dismissed rejections */}
        {visibleRejections.length > 0 && (
          <div className="pending-badge" style={{ background: '#f44336' }}>
            {visibleRejections.length}
          </div>
        )}
      </div>

      {isModalOpen && (
        <DepositModal
          memberId={memberId}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleSuccess}
          pendingDeposit={summary.pendingDeposit}
          rejectedDeposits={summary.rejectedDeposits}
          onDismiss={handleDismiss}
        />
      )}
    </>
  );
};

export default DepositCard;