import React, { useState, useEffect, useCallback } from 'react';
import { loansAPI } from '../../Service/Api';
import {
  ClipboardList, Calendar, Clock, CreditCard, Banknote,
  Users, Building2, ChevronDown, ChevronUp, X,
} from 'lucide-react';

const TRANSACTION_FEE = 108;

const MyLoans = ({ memberId, year }) => {
  const [loans, setLoans]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [expandedLoan, setExpandedLoan] = useState(null);

  const fetchMyLoans = useCallback(async () => {
    try {
      setLoading(true);
      const response = await loansAPI.getAll({ memberId });
      let myLoans = (response.data.loans || [])
        .filter(l => l.approvalStatus === 'approved')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      if (year) {
        myLoans = myLoans.filter(l => {
          if (!l.disbursementDate) return false;
          return new Date(l.disbursementDate).getFullYear() === Number(year);
        });
      }

      setLoans(myLoans);
    } catch (err) {
      console.error('Error fetching loans:', err);
    } finally {
      setLoading(false);
    }
  }, [memberId, year]);

  useEffect(() => { fetchMyLoans(); }, [fetchMyLoans]);

  const fc = (v) => new Intl.NumberFormat('en-KE', {
    style: 'currency', currency: 'KES', minimumFractionDigits: 0,
  }).format(v || 0);

  const fd = (d) => d
    ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'N/A';

  const statusCfg = (s) => ({
    active:  { label: 'Active',  color: '#10b981', bg: '#ecfdf5', icon: '●' },
    arrears: { label: 'Arrears', color: '#f59e0b', bg: '#fef3c7', icon: '⚠' },
    default: { label: 'Default', color: '#ef4444', bg: '#fee2e2', icon: '✕' },
    paid:    { label: 'Paid',    color: '#3b82f6', bg: '#dbeafe', icon: '✓' },
  }[s] || { label: s, color: '#6b7280', bg: '#f3f4f6', icon: '?' });

  const progress = (paid, total) => (!total ? 0 : Math.min((paid / total) * 100, 100));

  const activeLoans  = loans.filter(l => l.status !== 'paid');
  const hasOverdue   = loans.some(l => l.status === 'arrears' || l.status === 'default');
  const totalBalance = activeLoans.reduce((s, l) => s + Number(l.remainingBalance || 0), 0);

  const renderGuarantors = (loan) => {
    const guarantors = loan.guarantors || [];
    if (guarantors.length === 0) return null;

    const statusStyle = (status) => ({
      accepted:       { bg: '#ecfdf5', color: '#10b981' },
      pending:        { bg: '#fef3c7', color: '#f59e0b' },
      rejected:       { bg: '#fee2e2', color: '#ef4444' },
      admin_override: { bg: '#dbeafe', color: '#3b82f6' },
    }[status] || { bg: '#f3f4f6', color: '#6b7280' });

    return (
      <div style={{
        padding: '10px 20px 14px',
        borderTop: '1px solid #f0f0f0',
        background: '#fafbfc',
      }}>
        <span style={{
          fontSize: '11px', fontWeight: 700,
          textTransform: 'uppercase', color: '#6b7280',
          display: 'flex', alignItems: 'center', gap: 5,
          marginBottom: '6px', letterSpacing: '0.04em',
        }}>
          <Users size={12} /> Guarantors ({guarantors.length})
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {guarantors.map((g, gi) => {
            let name;
            if (Number(g.guarantorId) === -1) {
              name = 'The Office';
            } else if (g.guarantor && (g.guarantor.firstName || g.guarantor.lastName)) {
              name = `${g.guarantor.firstName || ''} ${g.guarantor.lastName || ''}`.trim();
            } else {
              name = `Guarantor ${gi + 1}`;
            }

            const sc   = statusStyle(g.approvalStatus);
            const Icon = Number(g.guarantorId) === -1 ? Building2 : Users;

            return (
              <span
                key={g.id || gi}
                style={{
                  padding: '4px 12px', borderRadius: '20px',
                  fontSize: '12px', fontWeight: 600,
                  background: sc.bg, color: sc.color,
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                }}
              >
                <Icon size={11} /> {name}
                <span style={{ fontSize: '10px', opacity: 0.8, textTransform: 'capitalize', marginLeft: '2px' }}>
                  · {g.approvalStatus || 'pending'}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Small card ────────────────────────────────────────────────
  return (
    <>
      <div
        className="stat-card small-card"
        onClick={() => setShowModal(true)}
        style={{
          cursor: 'pointer',
          borderTopColor: hasOverdue ? '#ef9a9a' : activeLoans.length > 0 ? '#90caf9' : '#a5d6a7',
          position: 'relative',
        }}
      >
        <span className="small-icon" style={{ background: '#ede7f6', color: '#7b1fa2' }}>
          <ClipboardList size={18} />
        </span>
        <div className="small-body">
          <span className="small-label">My Loans</span>
          {loading ? (
            <span className="small-value" style={{ color: '#aaa', fontSize: '14px' }}>Loading...</span>
          ) : (
            <>
              <span className="small-value" style={{ color: hasOverdue ? '#c62828' : '#1a1a2e' }}>
                {activeLoans.length > 0 ? fc(totalBalance) : 'None'}
              </span>
              <span className="small-sub">
                {activeLoans.length > 0
                  ? `${activeLoans.length} active · tap to view`
                  : `${loans.length} total · tap to view`}
              </span>
            </>
          )}
        </div>
        {activeLoans.length > 0 && (
          <span style={{
            position: 'absolute', top: '10px', right: '10px',
            background: hasOverdue ? '#c62828' : '#1976d2',
            color: 'white', borderRadius: '50%', width: '20px', height: '20px',
            fontSize: '11px', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {activeLoans.length}
          </span>
        )}
      </div>

      {/* ── Modal ──────────────────────────────────────────────── */}
      {showModal && (
        <div
          onClick={() => { setShowModal(false); setExpandedLoan(null); }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: '16px',
              width: '100%', maxWidth: '680px',
              maxHeight: '88vh', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            }}
          >
            {/* Modal header */}
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: '20px 24px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexShrink: 0,
            }}>
              <div>
                <h2 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Banknote size={22} /> My Loans
                </h2>
                <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>
                  {loans.length} loan{loans.length !== 1 ? 's' : ''} · {activeLoans.length} active
                </p>
              </div>
              <button
                onClick={() => { setShowModal(false); setExpandedLoan(null); }}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none',
                  color: 'white', borderRadius: '8px',
                  width: '34px', height: '34px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ overflowY: 'auto', padding: '20px', flex: 1 }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>
                  Loading loans...
                </div>
              ) : loans.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#aaa' }}>
                  <ClipboardList size={48} style={{ marginBottom: '12px', color: '#bbb' }} />
                  <p style={{ fontWeight: 600, color: '#555' }}>No loans yet</p>
                  <p style={{ fontSize: '13px' }}>Apply for a loan to get started</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {loans.map(loan => {
                    const st  = statusCfg(loan.status);
                    const pct = progress(loan.amountPaid || 0, loan.totalRepayment || loan.amount);
                    const isExpanded = expandedLoan === loan.id;

                    return (
                      <div
                        key={loan.id}
                        style={{
                          border: `2px solid ${isExpanded ? '#667eea' : '#e5e7eb'}`,
                          borderRadius: '12px', overflow: 'hidden',
                          transition: 'border-color 0.2s',
                        }}
                      >
                        {/* Loan summary row */}
                        <div
                          onClick={() => setExpandedLoan(isExpanded ? null : loan.id)}
                          style={{
                            padding: '16px 20px', cursor: 'pointer',
                            background: '#fafbfc',
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between', gap: '12px',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{
                              display: 'flex', alignItems: 'center',
                              gap: '12px', flexWrap: 'wrap', marginBottom: '8px',
                            }}>
                              <span style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>
                                {fc(loan.amount)}
                              </span>
                              <span style={{
                                padding: '3px 10px', borderRadius: '20px',
                                fontSize: '12px', fontWeight: 700,
                                background: st.bg, color: st.color,
                              }}>
                                {st.icon} {st.label}
                              </span>
                            </div>
                            <div style={{
                              display: 'flex', gap: '16px',
                              fontSize: '12px', color: '#6b7280', flexWrap: 'wrap',
                            }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Calendar size={12} /> Disbursed: <strong>{fd(loan.disbursementDate)}</strong>
                              </span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={12} /> Due: <strong style={{ color: loan.isOverdue ? '#c62828' : 'inherit' }}>{fd(loan.dueDate)}</strong>
                              </span>
                            </div>

                            {/* Progress bar */}
                            <div style={{ marginTop: '10px' }}>
                              <div style={{
                                display: 'flex', justifyContent: 'space-between',
                                fontSize: '11px', color: '#888', marginBottom: '4px',
                              }}>
                                <span>Repayment progress</span>
                                <span style={{ fontWeight: 700, color: '#667eea' }}>{Math.round(pct)}%</span>
                              </div>
                              <div style={{
                                background: '#e5e7eb', borderRadius: '20px',
                                height: '8px', overflow: 'hidden',
                              }}>
                                <div style={{
                                  width: `${pct}%`, height: '100%',
                                  background: 'linear-gradient(90deg,#667eea,#764ba2)',
                                  borderRadius: '20px', transition: 'width 0.5s',
                                }} />
                              </div>
                              <div style={{
                                display: 'flex', justifyContent: 'space-between',
                                fontSize: '12px', marginTop: '4px',
                              }}>
                                <span style={{ color: '#10b981', fontWeight: 600 }}>
                                  Paid: {fc(loan.amountPaid || 0)}
                                </span>
                                <span style={{ color: '#ef4444', fontWeight: 600 }}>
                                  Remaining: {fc(loan.remainingBalance || 0)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button style={{
                            background: 'white', border: '2px solid #e5e7eb',
                            borderRadius: '8px', width: '32px', height: '32px',
                            cursor: 'pointer', color: '#667eea', fontWeight: 700,
                            flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </button>
                        </div>

                        {/* Guarantors — always visible below summary */}
                        {renderGuarantors(loan)}

                        {/* Expanded details */}
                        {isExpanded && (
                          <div style={{
                            padding: '16px 20px',
                            borderTop: '2px dashed #e5e7eb',
                            background: 'white',
                          }}>
                            {/* Detail chips */}
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                              gap: '10px', marginBottom: '16px',
                            }}>
                              {[
                                { label: 'Duration',        value: `${loan.durationMonths} months` },
                                { label: 'Interest Rate',   value: `${loan.interestRate}%` },
                                { label: 'Transaction Fee', value: fc(Number(loan.transactionFee ?? TRANSACTION_FEE)), highlight: true },
                                { label: 'Total Repayable', value: fc(loan.totalRepayment || 0) },
                                ...(loan.penaltyInterest > 0
                                  ? [{ label: 'Penalty', value: fc(loan.penaltyInterest), warn: true }]
                                  : []),
                              ].map(d => (
                                <div key={d.label} style={{
                                  background:   d.warn ? '#fef3c7' : d.highlight ? '#fff8e1' : '#f9fafb',
                                  border:       `1px solid ${d.warn ? '#f59e0b' : d.highlight ? '#ffe082' : '#e5e7eb'}`,
                                  borderRadius: '8px', padding: '12px',
                                  display: 'flex', flexDirection: 'column', gap: '4px',
                                }}>
                                  <span style={{
                                    fontSize: '10px', textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: d.highlight ? '#f57f17' : '#6b7280',
                                    fontWeight: 600,
                                  }}>
                                    {d.label}
                                  </span>
                                  <span style={{
                                    fontSize: '16px', fontWeight: 700,
                                    color: d.highlight ? '#e65100' : '#111827',
                                  }}>
                                    {d.value}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Payment history */}
                            {loan.payments?.length > 0 && (
                              <div>
                                <p style={{
                                  fontSize: '12px', fontWeight: 700,
                                  textTransform: 'uppercase', color: '#374151',
                                  marginBottom: '8px',
                                  borderBottom: '1px solid #e5e7eb', paddingBottom: '6px',
                                  display: 'flex', alignItems: 'center', gap: 6,
                                }}>
                                  <CreditCard size={13} /> Payment History ({loan.payments.length})
                                </p>
                                <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                                  {loan.payments.slice(0, 5).map((p, pi) => (
                                    <div key={pi} style={{
                                      display: 'flex', justifyContent: 'space-between',
                                      alignItems: 'center', padding: '10px 14px',
                                      borderBottom: pi < Math.min(loan.payments.length, 5) - 1
                                        ? '1px solid #f0f0f0' : 'none',
                                      background: pi % 2 === 0 ? 'white' : '#fafafa',
                                    }}>
                                      <div>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#111' }}>
                                          {fd(p.paymentDate)}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>
                                          {p.paymentMethod || 'Cash'}
                                        </div>
                                      </div>
                                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#10b981' }}>
                                        {fc(p.amount)}
                                      </span>
                                    </div>
                                  ))}
                                  {loan.payments.length > 5 && (
                                    <div style={{
                                      textAlign: 'center', padding: '8px',
                                      fontSize: '12px', color: '#667eea',
                                      fontWeight: 600, background: '#f9fafb',
                                    }}>
                                      +{loan.payments.length - 5} more payments
                                    </div>
                                  )}
                                </div>
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
          </div>
        </div>
      )}
    </>
  );
};

export default MyLoans;