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

  const derivedCode    = formData.mpesaMessage.replace(/\s/g, '').substring(0, 10).toUpperCase();
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

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

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
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <div className="dm-overlay" onClick={onClose}>
        <div className="dm-content" onClick={e => e.stopPropagation()}>

          {/* ── Header ── */}
          <div className="dm-header">
            <h2 className="dm-header__title">
              <CreditCard size={18} />
              {isViewMode ? 'Deposit Status' : 'Make a Deposit'}
            </h2>
            <button className="dm-header__close" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {/* ── Scrollable body ── */}
          <div className="dm-body">

            {/* ── Rejected deposits ── */}
            {hasRejections && visibleRejections.length > 0 && (
              <div className="dm-section">
                <div className="dm-rejections__head">
                  <h4 className="dm-rejections__title">
                    <XCircle size={15} /> Rejected Deposits
                  </h4>
                  {visibleRejections.length > 1 && (
                    <button className="dm-btn-dismiss-all" onClick={dismissAll}>
                      Dismiss All
                    </button>
                  )}
                </div>

                {visibleRejections.map(d => (
                  <div key={d.id} className="dm-rejection-card">
                    <button
                      className="dm-rejection-card__close"
                      onClick={() => dismissRejection(d.id)}
                      aria-label="Dismiss"
                    >
                      <X size={11} />
                    </button>

                    <div className="dm-rejection-card__top">
                      <div>
                        <strong className="dm-rejection-card__amount">{fmt(d.totalAmount)}</strong>
                        <span className="dm-rejection-card__code">Code: {d.mpesaCode}</span>
                      </div>
                      <span className="dm-rejection-card__date">
                        {d.rejectedAt
                          ? new Date(d.rejectedAt).toLocaleDateString('en-GB', {
                              day: '2-digit', month: 'short', year: 'numeric',
                            })
                          : ''}
                      </span>
                    </div>

                    <div className="dm-rejection-card__reason">
                      <AlertTriangle size={13} className="dm-rejection-card__reason-icon" />
                      <span>
                        <strong>Rejection Reason: </strong>{d.rejectionReason}
                      </span>
                    </div>

                    <p className="dm-rejection-card__dist-label">Original Distribution:</p>
                    <div className="dm-rejection-card__dist-grid">
                      {summaryRows.filter(r => Number(d[r.key]) > 0).map(r => (
                        <div key={r.label} className="dm-dist-row">
                          <span className="dm-dist-row__label">
                            <CategoryIcon name={r.icon} />{r.label}
                          </span>
                          <strong>{fmt(d[r.key])}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {!isViewMode && (
                  <p className="dm-info-note">
                    <Info size={12} /> You can submit a new deposit below.
                  </p>
                )}
              </div>
            )}

            {/* ── View Mode ── */}
            {isViewMode && (
              <div className="dm-section">
                <div className="dm-pending-banner">
                  <strong className="dm-pending-banner__title">
                    <Clock size={15} /> Awaiting Admin Approval
                  </strong>
                  <p className="dm-pending-banner__body">
                    Your deposit of <strong>{fmt(pendingDeposit.totalAmount)}</strong>{' '}
                    (Code: {pendingDeposit.mpesaCode}) has been submitted and is pending admin approval.
                  </p>
                </div>

                <h4 className="dm-sub-heading">Distribution Breakdown</h4>
                {summaryRows.filter(r => Number(pendingDeposit[r.key]) > 0).map(r => (
                  <div key={r.label} className="dm-summary-line">
                    <span className="dm-summary-line__label">
                      <CategoryIcon name={r.icon} />{r.label}
                    </span>
                    <strong>{fmt(pendingDeposit[r.key])}</strong>
                  </div>
                ))}
                <div className="dm-summary-total">
                  <span>Total</span>
                  <span>{fmt(pendingDeposit.totalAmount)}</span>
                </div>

                <button className="dm-btn dm-btn--secondary dm-btn--full" onClick={onClose}>
                  Close
                </button>
              </div>
            )}

            {/* ── Step forms ── */}
            {!isViewMode && (
              <>
                {/* Step indicator */}
                <div className="dm-steps">
                  {['Deposit Info', 'Distribute Funds'].map((label, i) => (
                    <div key={i} className="dm-step">
                      <div className={`dm-step__bar ${step > i ? 'done' : step === i + 1 ? 'active' : ''}`} />
                      <span className={`dm-step__label ${step === i + 1 ? 'active' : step > i ? 'done' : ''}`}>
                        {step > i ? <CheckCircle size={11} /> : <span>{i + 1}.</span>}
                        {label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* ── Step 1 ── */}
                {step === 1 && (
                  <form onSubmit={handleNext} className="dm-form">
                    <div className="dm-section">
                      <h3 className="dm-section__heading">Deposit Information</h3>
                      <p className="dm-section__note">Enter your M-PESA deposit details</p>

                      <div className="dm-field">
                        <label className="dm-label">Total Amount Deposited *</label>
                        <input
                          className={`dm-input ${errors.totalAmount ? 'dm-input--error' : ''}`}
                          type="number"
                          name="totalAmount"
                          value={formData.totalAmount}
                          onChange={handleChange}
                          placeholder="Enter total amount"
                          min="1"
                          inputMode="numeric"
                          required
                        />
                        {errors.totalAmount && (
                          <span className="dm-error"><AlertCircle size={12} />{errors.totalAmount}</span>
                        )}
                      </div>

                      <div className="dm-field">
                        <label className="dm-label">M-PESA Message *</label>
                        <textarea
                          className={`dm-textarea ${errors.mpesaMessage ? 'dm-input--error' : ''}`}
                          name="mpesaMessage"
                          value={formData.mpesaMessage}
                          onChange={handleChange}
                          placeholder="Paste the full M-PESA confirmation message e.g. QF7XHKJ9L2 Confirmed. KES 5,000 sent to..."
                          rows="4"
                        />
                        {formData.mpesaMessage.trim() && (
                          <div className={`dm-code-preview ${
                            isDuplicateCode       ? 'dm-code-preview--error'
                            : derivedCode.length >= 10 ? 'dm-code-preview--success'
                            : 'dm-code-preview--warn'
                          }`}>
                            {isDuplicateCode ? (
                              <><XCircle size={13} /><span>Already submitted — code <strong>{derivedCode}</strong> exists in your history.</span></>
                            ) : derivedCode.length >= 10 ? (
                              <><CheckCircle size={13} /><span>Code extracted: <strong className="dm-mono">{derivedCode}</strong></span></>
                            ) : (
                              <><AlertCircle size={13} /><span>Keep typing — need at least 10 characters for the code</span></>
                            )}
                          </div>
                        )}
                        {errors.mpesaMessage && (
                          <span className="dm-error"><AlertCircle size={12} />{errors.mpesaMessage}</span>
                        )}
                        <p className="dm-hint"><Info size={11} /> Paste the complete SMS you received from M-PESA.</p>
                      </div>

                      <div className="dm-field">
                        <label className="dm-label">Notes (Optional)</label>
                        <textarea
                          className="dm-textarea"
                          name="notes"
                          value={formData.notes}
                          onChange={handleChange}
                          placeholder="Any additional notes..."
                          rows="2"
                        />
                      </div>
                    </div>

                    <div className="dm-actions">
                      <button type="button" className="dm-btn dm-btn--secondary" onClick={onClose}>
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="dm-btn dm-btn--primary"
                        disabled={isDuplicateCode}
                      >
                        Next <ChevronRight size={15} />
                      </button>
                    </div>
                  </form>
                )}

                {/* ── Step 2 ── */}
                {step === 2 && (
                  <form onSubmit={handleSubmit} className="dm-form">

                    {/* Sticky allocation tracker */}
                    <div className={`dm-tracker ${
                      unallocated < 0  ? 'dm-tracker--over'
                      : unallocated === 0 ? 'dm-tracker--done'
                      : 'dm-tracker--ok'
                    }`}>
                      <div className="dm-tracker__cell">
                        <span className="dm-tracker__cell-label">Deposit</span>
                        <span className="dm-tracker__cell-value">{fmt(totalAmount)}</span>
                      </div>
                      <div className="dm-tracker__cell dm-tracker__cell--center">
                        <span className="dm-tracker__cell-label">Allocated</span>
                        <span className={`dm-tracker__cell-value ${unallocated < 0 ? 'dm-tracker__cell-value--over' : ''}`}>
                          {fmt(distributed)}
                        </span>
                      </div>
                      <div className="dm-tracker__cell dm-tracker__cell--right">
                        <span className="dm-tracker__cell-label">Remaining</span>
                        <span className={`dm-tracker__cell-value dm-tracker__cell-value--lg ${
                          unallocated < 0  ? 'dm-tracker__cell-value--over'
                          : unallocated === 0 ? 'dm-tracker__cell-value--done'
                          : ''
                        }`}>{fmt(unallocated)}</span>
                      </div>
                    </div>

                    <div className="dm-section">
                      <h3 className="dm-section__heading">Distribute {fmt(totalAmount)}</h3>
                      <p className="dm-section__note">Allocate across categories — total must not exceed deposit</p>

                      {errors.distribution && (
                        <div className="dm-error-banner">
                          <AlertCircle size={13} /> {errors.distribution}
                        </div>
                      )}

                      <div className="dm-dist-grid--form">
                        {distributionRows.map(({ name, label, icon }) => (
                          <div className="dm-field" key={name}>
                            <label className="dm-label dm-label--icon">
                              <CategoryIcon name={icon} size={13} /> {label}
                            </label>
                            <input
                              className="dm-input"
                              type="number"
                              name={name}
                              value={formData[name]}
                              onChange={handleChange}
                              placeholder="0"
                              min="0"
                              inputMode="numeric"
                            />
                          </div>
                        ))}

                        {/* Loan payment — full width on mobile */}
                        <div className="dm-field dm-field--full">
                          <label className="dm-label dm-label--icon">
                            <FileText size={13} /> Loan Payment
                          </label>
                          <input
                            className="dm-input"
                            type="number"
                            name="loanPayment"
                            value={formData.loanPayment}
                            onChange={handleChange}
                            placeholder="0"
                            min="0"
                            inputMode="numeric"
                          />
                          {Number(formData.loanPayment) > 0 && (
                            <select
                              className="dm-select"
                              name="selectedLoanId"
                              value={formData.selectedLoanId}
                              onChange={handleChange}
                              required
                            >
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
                            <span className="dm-error"><AlertCircle size={12} />{errors.selectedLoanId}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="dm-actions">
                      <button
                        type="button"
                        className="dm-btn dm-btn--secondary"
                        onClick={() => setStep(1)}
                      >
                        <ChevronLeft size={15} /> Back
                      </button>
                      <button
                        type="submit"
                        className="dm-btn dm-btn--primary"
                        disabled={submitting || unallocated < 0 || distributed === 0}
                      >
                        <Send size={14} />
                        {submitting ? 'Submitting…' : 'Submit'}
                      </button>
                    </div>

                    <p className="dm-info-note dm-info-note--center">
                      <Info size={12} /> Your deposit will be reviewed by an admin before processing.
                    </p>
                  </form>
                )}
              </>
            )}
          </div>{/* end dm-body */}
        </div>
      </div>
    </>
  );
};

export default DepositModal;