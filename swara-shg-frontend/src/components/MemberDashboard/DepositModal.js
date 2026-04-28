import React, { useState, useEffect, useCallback } from 'react';
import {
  X, CreditCard, Clock, CheckCircle, AlertTriangle, Wallet,
  Sprout, Users, AlertCircle, FileText, Package, ChevronRight,
  ChevronLeft, Send, XCircle, Info, Landmark,
} from 'lucide-react';
import { depositsAPI, loansAPI } from '../../Service/Api';
import { useToast, ToastContainer } from '../../useToast';
import './DepositModal.css';

// ─── Icon map for distribution categories ────────────────────────
const CategoryIcon = ({ name, size = 15 }) => {
  const icons = {
    savings:       <Wallet size={size} />,
    loanPayment:   <FileText size={size} />,
    chamaaPayment: <Users size={size} />,
    seedCapital:   <Sprout size={size} />,
    savingsFine:   <AlertCircle size={size} />,
    chamaaFine:    <AlertTriangle size={size} />,
    agmFee:        <Landmark size={size} />,
    others:        <Package size={size} />,
  };
  return icons[name] || null;
};

const DepositModal = ({ memberId, onClose, onSuccess, pendingDeposit = null, rejectedDeposits = [] }) => {
  const isViewMode    = pendingDeposit !== null;
  const hasRejections = rejectedDeposits.length > 0;

  const { toasts, toast, dismiss } = useToast();

  const [step, setStep]               = useState(1);
  const [activeLoans, setActiveLoans] = useState([]);
  const [errors, setErrors]           = useState({});
  const [submitting, setSubmitting]   = useState(false);

  // ── Duplicate-code check state ───────────────────────────────
  const [memberCodes, setMemberCodes] = useState(new Set());

  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`dismissed_rejections_${memberId}`) || '[]');
    } catch { return []; }
  });

  const visibleRejections = rejectedDeposits.filter(d => !dismissedIds.includes(d.id));

  const dismissRejection = (depositId) => {
    const updated = [...dismissedIds, depositId];
    setDismissedIds(updated);
    localStorage.setItem(`dismissed_rejections_${memberId}`, JSON.stringify(updated));
  };

  const dismissAll = () => {
    const updated = rejectedDeposits.map(d => d.id);
    setDismissedIds(updated);
    localStorage.setItem(`dismissed_rejections_${memberId}`, JSON.stringify(updated));
  };

  const [formData, setFormData] = useState({
    totalAmount: '', mpesaMessage: '', notes: '',
    savings: '', loanPayment: '', selectedLoanId: '',
    chamaaPayment: '', seedCapital: '', savingsFine: '',
    chamaaFine: '', agmFee: '', others: '',
  });

  const derivedCode = formData.mpesaMessage.replace(/\s/g, '').substring(0, 10).toUpperCase();
  const isDuplicateCode = derivedCode.length === 10 && memberCodes.has(derivedCode);

  const fetchActiveLoans = useCallback(async () => {
    try {
      const res = await loansAPI.getAll({ memberId });
      setActiveLoans(
        res.data.loans.filter(
          l => l.approvalStatus === 'approved' &&
               (l.status === 'active' || l.status === 'arrears')
        )
      );
    } catch (err) { console.error('Error fetching loans:', err); }
  }, [memberId]);

  const fetchMemberCodes = useCallback(async () => {
    try {
      const res = await depositsAPI.getSummary(memberId);
      const deposits = res.data?.deposits || [];
      setMemberCodes(new Set(deposits.map(d => d.mpesaCode).filter(Boolean)));
    } catch (err) {
      console.warn('Could not prefetch member deposit codes:', err.message);
    }
  }, [memberId]);

  useEffect(() => {
    fetchActiveLoans();
    fetchMemberCodes();
  }, [fetchActiveLoans, fetchMemberCodes]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const totalDistributed = () =>
    Number(formData.savings       || 0) + Number(formData.loanPayment   || 0) +
    Number(formData.chamaaPayment || 0) + Number(formData.seedCapital   || 0) +
    Number(formData.savingsFine   || 0) + Number(formData.chamaaFine    || 0) +
    Number(formData.agmFee        || 0) + Number(formData.others        || 0);

  const totalAmount = Number(formData.totalAmount || 0);
  const distributed = totalDistributed();
  const unallocated = totalAmount - distributed;

  const validateStep1 = () => {
    const errs = {};
    if (!totalAmount || totalAmount <= 0) errs.totalAmount  = 'Amount is required';
    if (!formData.mpesaMessage.trim())    errs.mpesaMessage = 'M-PESA message is required';
    else if (derivedCode.length < 10)     errs.mpesaMessage = 'M-PESA message must contain at least 10 characters (the transaction code)';
    else if (isDuplicateCode)             errs.mpesaMessage = 'You have already submitted a deposit with this M-PESA transaction code.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs = {};
    if (distributed === 0)         errs.distribution = 'Please allocate funds to at least one category';
    if (distributed > totalAmount) errs.distribution = `Distributed ${fmt(distributed)} exceeds deposit ${fmt(totalAmount)}`;
    if (Number(formData.loanPayment) > 0 && !formData.selectedLoanId) errs.selectedLoanId = 'Please select a loan to pay';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = (e) => { e.preventDefault(); if (validateStep1()) setStep(2); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep2()) return;
    setSubmitting(true);
    try {
      await depositsAPI.createWithDistribution({
        memberId, totalAmount,
        mpesaMessage: formData.mpesaMessage,
        notes: formData.notes,
        distribution: {
          savings:       Number(formData.savings       || 0),
          loanPayment:   Number(formData.loanPayment   || 0),
          loanId:        formData.selectedLoanId || null,
          chamaaPayment: Number(formData.chamaaPayment || 0),
          seedCapital:   Number(formData.seedCapital   || 0),
          savingsFine:   Number(formData.savingsFine   || 0),
          chamaaFine:    Number(formData.chamaaFine     || 0),
          agmFee:        Number(formData.agmFee         || 0),
          others:        Number(formData.others         || 0),
        }
      });

      toast.success(
        'Deposit Submitted',
        "Your deposit is pending admin approval. You'll be notified once confirmed.",
        { duration: 5000 }
      );

      // Brief delay so the success toast is visible before modal closes
      setTimeout(() => { onSuccess(); }, 900);

    } catch (err) {
      const data = err.response?.data;
      const msg  = data?.message || err.message || 'Failed to submit deposit';

      if (data?.code === 'DUPLICATE_OWN' || data?.code === 'DUPLICATE_OTHER') {
        setStep(1);
        setErrors(prev => ({ ...prev, mpesaMessage: msg }));
        toast.warning('Duplicate Transaction', msg);
      } else {
        toast.error('Submission Failed', msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (v) => new Intl.NumberFormat('en-KE', {
    style: 'currency', currency: 'KES', minimumFractionDigits: 0
  }).format(v || 0);

  const distributionRows = [
    { label: 'Savings',        name: 'savings',       icon: 'savings' },
    { label: 'Seed Capital',   name: 'seedCapital',   icon: 'seedCapital' },
    { label: 'Chamaa Payment', name: 'chamaaPayment', icon: 'chamaaPayment' },
    { label: 'Savings Fine',   name: 'savingsFine',   icon: 'savingsFine' },
    { label: 'Chamaa Fine',    name: 'chamaaFine',    icon: 'chamaaFine' },
    { label: 'AGM Fee',        name: 'agmFee',        icon: 'agmFee' },
    { label: 'Others',         name: 'others',        icon: 'others' },
  ];

  const summaryRows = [
    { label: 'Savings',       key: 'savingsAmount',       icon: 'savings' },
    { label: 'Loan Payment',  key: 'loanPaymentAmount',   icon: 'loanPayment' },
    { label: 'Chamaa',        key: 'chamaaPaymentAmount', icon: 'chamaaPayment' },
    { label: 'Seed Capital',  key: 'seedCapitalAmount',   icon: 'seedCapital' },
    { label: 'Savings Fine',  key: 'savingsFineAmount',   icon: 'savingsFine' },
    { label: 'Chamaa Fine',   key: 'chamaaFineAmount',    icon: 'chamaaFine' },
    { label: 'AGM Fee',       key: 'agmFeeAmount',        icon: 'agmFee' },
    { label: 'Others',        key: 'othersAmount',        icon: 'others' },
  ];

  return (
    <>
      {/* Toast portal — sits above the modal overlay via z-index 9999 */}
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content deposit-modal" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="modal-header">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={20} />
              {isViewMode ? 'Deposit Status' : 'Make a Deposit'}
            </h2>
            <button className="close-button" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          {/* Rejected Deposits */}
          {hasRejections && visibleRejections.length > 0 && (
            <div style={{ padding: '0 20px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ color: '#c62828', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <XCircle size={16} /> Rejected Deposits
                </h4>
                {visibleRejections.length > 1 && (
                  <button onClick={dismissAll} style={{
                    background: 'none', border: '1px solid #f44336', color: '#f44336',
                    borderRadius: '6px', padding: '4px 10px', fontSize: '12px',
                    cursor: 'pointer', fontWeight: 600,
                  }}>Dismiss All</button>
                )}
              </div>
              {visibleRejections.map(d => (
                <div key={d.id} style={{
                  background: '#fff5f5', border: '2px solid #f44336',
                  borderRadius: '8px', padding: '16px', marginBottom: '12px', position: 'relative',
                }}>
                  <button onClick={() => dismissRejection(d.id)} title="Dismiss" style={{
                    position: 'absolute', top: '10px', right: '10px',
                    background: '#f44336', color: 'white', border: 'none',
                    borderRadius: '50%', width: '22px', height: '22px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <X size={12} />
                  </button>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', paddingRight: '28px' }}>
                    <div>
                      <strong style={{ fontSize: '16px' }}>{fmt(d.totalAmount)}</strong>
                      <span style={{ marginLeft: '10px', fontSize: '13px', color: '#666' }}>Code: {d.mpesaCode}</span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#999' }}>
                      {d.rejectedAt ? new Date(d.rejectedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                    </span>
                  </div>
                  <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: '6px', padding: '10px 14px', marginBottom: '12px' }}>
                    <p style={{ margin: 0, fontSize: '13px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <AlertTriangle size={14} style={{ color: '#c62828', marginTop: '1px', flexShrink: 0 }} />
                      <span><strong style={{ color: '#c62828' }}>Rejection Reason: </strong><span style={{ color: '#333' }}>{d.rejectionReason}</span></span>
                    </p>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}><strong>Original Distribution:</strong></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '13px' }}>
                    {summaryRows.filter(r => Number(d[r.key]) > 0).map(r => (
                      <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: 'white', borderRadius: '4px', gap: '6px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CategoryIcon name={r.icon} />{r.label}
                        </span>
                        <strong>{fmt(d[r.key])}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {!isViewMode && (
                <p style={{ fontSize: '13px', color: '#666', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Info size={13} /> You can submit a new deposit below.
                </p>
              )}
            </div>
          )}

          {/* View Mode */}
          {isViewMode && (
            <div style={{ padding: '20px' }}>
              <div style={{ background: '#fff3e0', border: '2px solid #ff9800', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <strong style={{ color: '#e65100', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={16} /> Awaiting Admin Approval
                </strong>
                <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#666' }}>
                  Your deposit of <strong>{fmt(pendingDeposit.totalAmount)}</strong> (Code: {pendingDeposit.mpesaCode}) has been submitted and is pending admin approval.
                </p>
              </div>
              <h4 style={{ marginBottom: '10px' }}>Distribution Breakdown</h4>
              {summaryRows.filter(r => Number(pendingDeposit[r.key]) > 0).map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee', fontSize: '14px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CategoryIcon name={r.icon} />{r.label}
                  </span>
                  <strong>{fmt(pendingDeposit[r.key])}</strong>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', fontWeight: 'bold' }}>
                <span>Total</span><span>{fmt(pendingDeposit.totalAmount)}</span>
              </div>
              <button className="btn-secondary" style={{ marginTop: '20px', width: '100%' }} onClick={onClose}>Close</button>
            </div>
          )}

          {/* Step Indicator + Forms */}
          {!isViewMode && (
            <>
              <div style={{ display: 'flex', padding: '0 20px 16px', gap: '8px' }}>
                {['Deposit Info', 'Distribute Funds'].map((label, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{
                      height: '4px', borderRadius: '2px', marginBottom: '6px',
                      background: step > i ? '#4caf50' : step === i + 1 ? '#1976d2' : '#ddd',
                    }} />
                    <span style={{ fontSize: '12px', fontWeight: step === i + 1 ? 700 : 400, color: step === i + 1 ? '#1976d2' : step > i ? '#4caf50' : '#999', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      {step > i ? <CheckCircle size={12} /> : <span>{i + 1}.</span>} {label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Step 1 */}
              {step === 1 && (
                <form onSubmit={handleNext} className="deposit-form">
                  <div className="form-section">
                    <h3>Deposit Information</h3>
                    <p className="section-note">Enter your M-PESA deposit details</p>

                    <div className="form-group">
                      <label>Total Amount Deposited *</label>
                      <input type="number" name="totalAmount" value={formData.totalAmount}
                        onChange={handleChange} placeholder="Enter total amount" min="1" required />
                      {errors.totalAmount && <span className="error-text">{errors.totalAmount}</span>}
                    </div>

                    <div className="form-group">
                      <label>M-PESA Message *</label>
                      <textarea
                        name="mpesaMessage"
                        value={formData.mpesaMessage}
                        onChange={handleChange}
                        placeholder="Paste the full M-PESA confirmation message here e.g. QF7XHKJ9L2 Confirmed. KES 5,000 sent to..."
                        rows="4"
                        style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }}
                      />
                      {formData.mpesaMessage.trim() && (
                        <div style={{
                          marginTop: '6px', padding: '8px 12px',
                          background: isDuplicateCode ? '#fff8e1'
                            : derivedCode.length >= 10 ? '#e8f5e9' : '#fff8e1',
                          border: `1px solid ${isDuplicateCode ? '#f44336'
                            : derivedCode.length >= 10 ? '#4caf50' : '#ffc107'}`,
                          borderRadius: '6px', fontSize: '13px',
                          display: 'flex', alignItems: 'center', gap: '6px',
                        }}>
                          {isDuplicateCode ? (
                            <>
                              <XCircle size={14} style={{ color: '#f44336', flexShrink: 0 }} />
                              <span style={{ color: '#c62828' }}>
                                Already submitted — code <strong style={{ fontFamily: 'monospace' }}>{derivedCode}</strong> exists in your history.
                              </span>
                            </>
                          ) : derivedCode.length >= 10 ? (
                            <>
                              <CheckCircle size={14} style={{ color: '#4caf50', flexShrink: 0 }} />
                              <span>Transaction code extracted: <strong style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>{derivedCode}</strong></span>
                            </>
                          ) : (
                            <>
                              <AlertCircle size={14} style={{ color: '#ffc107', flexShrink: 0 }} />
                              <span>Keep typing — need at least 10 characters for the code</span>
                            </>
                          )}
                        </div>
                      )}
                      {errors.mpesaMessage && (
                        <span className="error-text" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertCircle size={13} /> {errors.mpesaMessage}
                        </span>
                      )}
                      <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Info size={12} /> Paste the complete SMS you received from M-PESA.
                      </p>
                    </div>

                    <div className="form-group">
                      <label>Notes (Optional)</label>
                      <textarea name="notes" value={formData.notes} onChange={handleChange}
                        placeholder="Any additional notes..." rows="2" />
                    </div>
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button type="submit" className="btn-primary" disabled={isDuplicateCode} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Next: Distribute <ChevronRight size={16} />
                    </button>
                  </div>
                </form>
              )}

              {/* Step 2 */}
              {step === 2 && (
                <form onSubmit={handleSubmit} className="deposit-form">
                  <div style={{
                    position: 'sticky', top: 0, zIndex: 10,
                    background: unallocated < 0 ? '#ffebee' : unallocated === 0 ? '#e8f5e9' : '#e3f2fd',
                    border: `2px solid ${unallocated < 0 ? '#f44336' : unallocated === 0 ? '#4caf50' : '#1976d2'}`,
                    borderRadius: '8px', padding: '12px 16px', marginBottom: '16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#666' }}>Deposit Amount</div>
                      <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{fmt(totalAmount)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#666' }}>Allocated</div>
                      <div style={{ fontWeight: 'bold', fontSize: '16px', color: unallocated < 0 ? '#f44336' : '#333' }}>{fmt(distributed)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', color: '#666' }}>Remaining</div>
                      <div style={{ fontWeight: 'bold', fontSize: '18px', color: unallocated < 0 ? '#f44336' : unallocated === 0 ? '#4caf50' : '#1976d2' }}>
                        {fmt(unallocated)}
                      </div>
                    </div>
                  </div>

                  <div className="form-section">
                    <h3>Distribute {fmt(totalAmount)}</h3>
                    <p className="section-note">Allocate your deposit across categories (total must not exceed deposit)</p>
                    {errors.distribution && (
                      <div className="error-banner" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertCircle size={14} /> {errors.distribution}
                      </div>
                    )}
                    <div className="form-grid">
                      {distributionRows.map(({ name, label, icon }) => (
                        <div className="form-group" key={name}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <CategoryIcon name={icon} /> {label}
                          </label>
                          <input type="number" name={name} value={formData[name]}
                            onChange={handleChange} placeholder="0" min="0" />
                        </div>
                      ))}

                      <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <FileText size={15} /> Loan Payment
                        </label>
                        <input type="number" name="loanPayment" value={formData.loanPayment}
                          onChange={handleChange} placeholder="0" min="0" />
                        {Number(formData.loanPayment) > 0 && (
                          <select name="selectedLoanId" value={formData.selectedLoanId}
                            onChange={handleChange} className="loan-select" required>
                            <option value="">Select Loan</option>
                            {activeLoans.length === 0
                              ? <option disabled>No active loans</option>
                              : activeLoans.map(l => (
                                <option key={l.id} value={l.id}>
                                  Loan #{l.id} — Balance: {fmt(l.remainingBalance)}
                                </option>
                              ))}
                          </select>
                        )}
                        {errors.selectedLoanId && (
                          <span className="error-text" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={13} /> {errors.selectedLoanId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="modal-actions">
                    <button type="button" className="btn-secondary" onClick={() => setStep(1)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ChevronLeft size={16} /> Back
                    </button>
                    <button type="submit" className="btn-primary"
                      disabled={submitting || unallocated < 0 || distributed === 0}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Send size={15} />
                      {submitting ? 'Submitting...' : 'Submit for Approval'}
                    </button>
                  </div>
                  <p className="info-text" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Info size={13} /> Your deposit and distribution will be reviewed and approved by an admin.
                  </p>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default DepositModal;