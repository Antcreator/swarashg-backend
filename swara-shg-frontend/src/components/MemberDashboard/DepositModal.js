import React, { useState, useEffect, useCallback } from 'react';
import {
  X, CreditCard, Clock, CheckCircle, AlertTriangle, Wallet,
  Sprout, Users, AlertCircle, FileText, Package, ChevronRight,
  ChevronLeft, Send, XCircle, Info, Landmark, CalendarDays,
  RefreshCw,
} from 'lucide-react';
import { depositsAPI, loansAPI, chamaaAPI } from '../../Service/Api';
import { useToast, ToastContainer } from '../../useToast';
import './DepositModal.css';

const CHAMAA_AMOUNT = 2030; // Fixed contribution per slot per month

// ─── Month helpers ────────────────────────────────────────────
const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_NAMES_SHORT = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
];
const getMonthName = (n) => MONTHS[n] || '';

// ─── Payment window evaluation ────────────────────────────────
const getSavingWindow = (targetMonth, targetYear) => {
  let prevMonth = targetMonth - 1;
  let prevYear  = targetYear;
  if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }
  return {
    windowStart: new Date(prevYear, prevMonth - 1, 11),
    windowEnd:   new Date(targetYear, targetMonth - 1, 10),
  };
};

const evaluatePayment = (targetMonth, targetYear) => {
  const today   = new Date();
  const payOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const { windowStart, windowEnd } = getSavingWindow(targetMonth, targetYear);
  const isWithinWindow = payOnly >= windowStart && payOnly <= windowEnd;
  if (isWithinWindow) {
    return { isLate: false, finalMonth: targetMonth, finalYear: targetYear, windowStart, windowEnd };
  }
  return {
    isLate:     true,
    finalMonth: targetMonth === 12 ? 1            : targetMonth + 1,
    finalYear:  targetMonth === 12 ? targetYear + 1 : targetYear,
    windowStart, windowEnd,
  };
};

// ─── Default target month ─────────────────────────────────────
const getDefaultTargetMonth = () => {
  const today = new Date();
  const day   = today.getDate();
  const month = today.getMonth() + 1;
  const year  = today.getFullYear();
  return {
    month: day >= 11 ? (month === 12 ? 1 : month + 1) : month,
    year:  day >= 11 && month === 12 ? year + 1 : year,
  };
};

// ─── Payment Status Banner ────────────────────────────────────
const PaymentStatusBanner = ({ month, year, label = 'Saving' }) => {
  if (!month || !year) return null;
  const fmtDate = (d) =>
    d.toLocaleDateString('en-KE', { day:'numeric', month:'short', year:'numeric' });
  const { isLate, finalMonth, finalYear, windowStart, windowEnd } =
    evaluatePayment(Number(month), Number(year));

  if (!isLate) {
    return (
      <div style={{ background:'#e8f5e9', padding:'12px 14px', borderRadius:'8px', marginTop:'10px', border:'1.5px solid #43a047' }}>
        <p style={{ margin:0, color:'#2e7d32', fontWeight:'bold', fontSize:'13px', display:'flex', alignItems:'center', gap:6 }}>
          <CheckCircle size={14} />
          ON TIME — {label} for <strong style={{ marginLeft:4 }}>{getMonthName(Number(month))} {year}</strong>
        </p>
        <p style={{ margin:'5px 0 0', color:'#388e3c', fontSize:'12px' }}>
          Window: {fmtDate(windowStart)} → {fmtDate(windowEnd)}
        </p>
      </div>
    );
  }
  return (
    <div style={{ background:'#ffebee', padding:'12px 14px', borderRadius:'8px', marginTop:'10px', border:'1.5px solid #e53935' }}>
      <p style={{ margin:0, color:'#c62828', fontWeight:'bold', fontSize:'13px', display:'flex', alignItems:'center', gap:6 }}>
        <AlertTriangle size={14} />
        LATE — Window for {getMonthName(Number(month))} {year} has closed.
      </p>
      <p style={{ margin:'4px 0 0', color:'#b71c1c', fontSize:'12px' }}>
        Window was: {fmtDate(windowStart)} → {fmtDate(windowEnd)}
      </p>
      <p style={{ margin:'4px 0 0', color:'#c62828', fontSize:'12px', fontWeight:600 }}>
        Will be pushed to <strong>{getMonthName(finalMonth)} {finalYear}</strong> + KES 500 fine per slot.
      </p>
    </div>
  );
};

// ─── Chamaa Slot Panel ────────────────────────────────────────
// Shows ALL active slots for this member with individual checkboxes.
// Amount auto-calculates as selected slots × KES 2030.
const ChamaaSlotPanel = ({ slots, loading, error, onRetry, checkedSlotIds, onToggle }) => {

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 14px', background:'#f3e5f5', borderRadius:'8px', marginBottom:'10px', fontSize:'12px', color:'#9c27b0' }}>
        <RefreshCw size={13} style={{ animation:'spin 1s linear infinite' }} />
        Loading your chamaa slots…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 14px', background:'#fff8e1', borderRadius:'8px', marginBottom:'10px', fontSize:'12px', color:'#e65100', border:'1px solid #ffe082' }}>
        <AlertCircle size={13} />
        Could not load chamaa details.
        <button onClick={onRetry} style={{ marginLeft:'auto', background:'none', border:'none', color:'#e65100', cursor:'pointer', fontSize:'12px', fontWeight:700, textDecoration:'underline' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!slots || slots.length === 0) {
    return (
      <div style={{ padding:'10px 14px', background:'#f5f5f5', borderRadius:'8px', marginBottom:'10px', fontSize:'12px', color:'#9e9e9e', border:'1px solid #e0e0e0' }}>
        <Info size={13} style={{ verticalAlign:'middle', marginRight:'6px' }} />
        You are not currently in an active chamaa cycle.
      </div>
    );
  }

  const selectedCount = checkedSlotIds.length;
  const totalDue      = selectedCount * CHAMAA_AMOUNT;

  return (
    <div style={{ marginBottom:'4px' }}>

      <div style={{ fontSize:'11px', fontWeight:700, color:'#7b1fa2', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px', display:'flex', alignItems:'center', gap:'6px' }}>
        <Users size={12} />
        {slots.length === 1 ? 'Your Active Chamaa Slot' : `Your Active Chamaa Slots (${slots.length})`}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
        {slots.map((slot) => {
          const isSelected     = checkedSlotIds.includes(slot.participantId);
          const scheduledLabel = slot.scheduledMonth
            ? `${MONTH_NAMES_SHORT[slot.scheduledMonth - 1]} ${slot.scheduledYear || ''}`
            : 'Not scheduled';

          return (
            <label
              key={slot.participantId}
              style={{
                display:'flex', alignItems:'center', gap:'12px',
                padding:'12px 14px', borderRadius:'10px', cursor:'pointer',
                background: isSelected
                  ? 'linear-gradient(135deg, #f3e5f5 0%, #ede7f6 100%)'
                  : '#fafafa',
                border: `2px solid ${isSelected ? '#7b1fa2' : '#e0e0e0'}`,
                transition:'all 0.15s', userSelect:'none',
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(slot.participantId)}
                style={{ width:'16px', height:'16px', accentColor:'#7b1fa2', cursor:'pointer', flexShrink:0 }}
              />

              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:'13px', color:'#4a148c', marginBottom:'3px', display:'flex', alignItems:'center', gap:'8px' }}>
                  {slot.cycleName}
                  <span style={{
                    display:'inline-flex', alignItems:'center', justifyContent:'center',
                    width:'24px', height:'24px', borderRadius:'50%',
                    background: isSelected ? '#7b1fa2' : '#e0e0e0',
                    color: isSelected ? 'white' : '#666',
                    fontSize:'11px', fontWeight:800, flexShrink:0,
                  }}>
                    {slot.position}
                  </span>
                </div>
                <div style={{ fontSize:'11px', color:'#888', display:'flex', gap:'12px', flexWrap:'wrap' }}>
                  <span>📅 Receives pot: <strong style={{ color: slot.scheduledMonth ? '#1565c0' : '#bbb' }}>{scheduledLabel}</strong></span>
                  <span>💰 <strong style={{ color:'#4a148c' }}>KES {CHAMAA_AMOUNT.toLocaleString()}</strong></span>
                </div>
              </div>

              {isSelected && <CheckCircle size={18} color="#7b1fa2" style={{ flexShrink:0 }} />}
            </label>
          );
        })}
      </div>

      {/* Running total */}
      {selectedCount > 0 && (
        <div style={{
          marginTop:'10px', padding:'10px 14px', borderRadius:'8px',
          background:'#4a148c', color:'white',
          display:'flex', justifyContent:'space-between', alignItems:'center',
        }}>
          <span style={{ fontSize:'13px', fontWeight:600 }}>
            {selectedCount} slot{selectedCount > 1 ? 's' : ''} × KES {CHAMAA_AMOUNT.toLocaleString()}
          </span>
          <span style={{ fontSize:'16px', fontWeight:800 }}>
            KES {totalDue.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
};

// ─── Icon map ─────────────────────────────────────────────────
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

// ─── Main Modal ───────────────────────────────────────────────
const DepositModal = ({
  memberId, onClose, onSuccess,
  pendingDeposit = null, rejectedDeposits = [], onDismiss,
}) => {
  const isViewMode    = pendingDeposit !== null;
  const hasRejections = rejectedDeposits.length > 0;

  const { toasts, toast, dismiss } = useToast();

  const [step, setStep]               = useState(1);
  const [activeLoans, setActiveLoans] = useState([]);
  const [errors, setErrors]           = useState({});
  const [submitting, setSubmitting]   = useState(false);
  const [memberCodes, setMemberCodes] = useState(new Set());

  // ── Chamaa slots ──────────────────────────────────────────
  const [activeSlots, setActiveSlots]             = useState([]);
  const [checkedSlotIds, setCheckedSlotIds]       = useState([]);
  const [slotsLoading, setSlotsLoading]           = useState(false);
  const [slotsError, setSlotsError]               = useState(false);

  const [dismissedIds, setDismissedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`dismissed_rejections_${memberId}`) || '[]'); }
    catch { return []; }
  });

  const visibleRejections = rejectedDeposits.filter(d => !dismissedIds.includes(d.id));

  const dismissRejection = (depositId) => {
    const updated = [...dismissedIds, depositId];
    setDismissedIds(updated);
    localStorage.setItem(`dismissed_rejections_${memberId}`, JSON.stringify(updated));
    if (onDismiss) onDismiss();
  };
  const dismissAll = () => {
    const updated = rejectedDeposits.map(d => d.id);
    setDismissedIds(updated);
    localStorage.setItem(`dismissed_rejections_${memberId}`, JSON.stringify(updated));
    if (onDismiss) onDismiss();
  };

  const defaults = getDefaultTargetMonth();

  const [formData, setFormData] = useState({
    totalAmount:    '',
    mpesaMessage:   '',
    notes:          '',
    savings:        '',
    savingsMonth:   defaults.month,
    savingsYear:    defaults.year,
    loanPayment:    '',
    selectedLoanId: '',
    chamaaPayment:  '',   // auto-calculated from checked slots
    chamaaMonth:    defaults.month,
    chamaaYear:     defaults.year,
    seedCapital:    '',
    savingsFine:    '',
    chamaaFine:     '',
    agmFee:         '',
    others:         '',
  });

  const derivedCode     = formData.mpesaMessage.replace(/\s/g, '').substring(0, 10).toUpperCase();
  const isDuplicateCode = derivedCode.length === 10 && memberCodes.has(derivedCode);

  // ── Fetch ALL active slots for this member ────────────────
  const fetchActiveSlots = useCallback(async () => {
    setSlotsLoading(true);
    setSlotsError(false);
    try {
      // Fetch all cycles and filter active ones client-side
      // (getAllCycles may not support query params in all setups)
      const cyclesRes = await chamaaAPI.getAllCycles();
      const cycles    = (cyclesRes.data.cycles || []).filter(c => c.isActive);
      const found     = [];

      for (const cycle of cycles) {
        try {
          const cycleRes     = await chamaaAPI.getCycleById(cycle.id);
          const participants = cycleRes.data.participants || [];
          participants
            .filter(p => Number(p.memberId) === Number(memberId))
            .forEach(p => {
              found.push({
                participantId:  p.id,
                position:       p.position,
                scheduledMonth: p.scheduledMonth,
                scheduledYear:  p.scheduledYear,
                cycleName:      cycle.name,
                cycleId:        cycle.id,
                hasReceived:    p.hasReceived,
              });
            });
        } catch { /* skip on error */ }
      }

      found.sort((a, b) => {
        if (a.cycleName !== b.cycleName) return a.cycleName.localeCompare(b.cycleName);
        return a.position - b.position;
      });

      setActiveSlots(found);
    } catch (err) {
      console.error('Failed to fetch active chamaa slots:', err);
      setSlotsError(true);
    } finally {
      setSlotsLoading(false);
    }
  }, [memberId]);

  // ── Toggle slot + auto-recalculate chamaa amount ──────────
  const handleToggleSlot = useCallback((participantId) => {
    setCheckedSlotIds(prev => {
      const next = prev.includes(participantId)
        ? prev.filter(id => id !== participantId)
        : [...prev, participantId];

      const total = next.length * CHAMAA_AMOUNT;
      setFormData(f => ({ ...f, chamaaPayment: total > 0 ? String(total) : '' }));
      return next;
    });
    setErrors(e => ({ ...e, chamaaPayment:'', chamaaMonth:'', chamaaYear:'' }));
  }, []);

  const fetchActiveLoans = useCallback(async () => {
    try {
      const res = await loansAPI.getAll({ memberId });
      setActiveLoans(res.data.loans.filter(
        l => l.approvalStatus === 'approved' &&
             (l.status === 'active' || l.status === 'arrears')
      ));
    } catch (err) { console.error('Error fetching loans:', err); }
  }, [memberId]);

  const fetchMemberCodes = useCallback(async () => {
    try {
      const res = await depositsAPI.getSummary(memberId);
      setMemberCodes(new Set((res.data?.deposits || []).map(d => d.mpesaCode).filter(Boolean)));
    } catch (err) { console.warn('Could not prefetch codes:', err.message); }
  }, [memberId]);

  useEffect(() => {
    fetchActiveLoans();
    fetchMemberCodes();
    fetchActiveSlots();
  }, [fetchActiveLoans, fetchMemberCodes, fetchActiveSlots]);

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
    Number(formData.savings       || 0) +
    Number(formData.loanPayment   || 0) +
    Number(formData.chamaaPayment || 0) +
    Number(formData.seedCapital   || 0) +
    Number(formData.savingsFine   || 0) +
    Number(formData.chamaaFine    || 0) +
    Number(formData.agmFee        || 0) +
    Number(formData.others        || 0);

  const totalAmount = Number(formData.totalAmount || 0);
  const distributed = totalDistributed();
  const unallocated = totalAmount - distributed;

  const validateStep1 = () => {
    const errs = {};
    if (!totalAmount || totalAmount <= 0) errs.totalAmount  = 'Amount is required';
    if (!formData.mpesaMessage.trim())    errs.mpesaMessage = 'M-PESA message is required';
    else if (derivedCode.length < 10)     errs.mpesaMessage = 'Must contain at least 10 characters';
    else if (isDuplicateCode)             errs.mpesaMessage = 'Already submitted this M-PESA transaction code.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs = {};
    if (distributed === 0)         errs.distribution = 'Please allocate funds to at least one category';
    if (distributed > totalAmount) errs.distribution = `Distributed ${fmt(distributed)} exceeds deposit ${fmt(totalAmount)}`;
    if (Number(formData.loanPayment) > 0 && !formData.selectedLoanId)
      errs.selectedLoanId = 'Please select a loan to pay';
    if (Number(formData.savings) > 0) {
      if (!formData.savingsMonth) errs.savingsMonth = 'Select a month for savings';
      if (!formData.savingsYear)  errs.savingsYear  = 'Enter a year for savings';
    }
    if (Number(formData.chamaaPayment) > 0) {
      if (checkedSlotIds.length === 0)
        errs.chamaaPayment = 'Please select at least one chamaa slot above';
      if (!formData.chamaaMonth) errs.chamaaMonth = 'Select a month for chamaa';
      if (!formData.chamaaYear)  errs.chamaaYear  = 'Enter a year for chamaa';
      const expected = checkedSlotIds.length * CHAMAA_AMOUNT;
      if (Number(formData.chamaaPayment) !== expected)
        errs.chamaaPayment = `Amount must be KES ${expected.toLocaleString()} (${checkedSlotIds.length} slot${checkedSlotIds.length > 1 ? 's' : ''} × KES ${CHAMAA_AMOUNT.toLocaleString()})`;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext   = (e) => { e.preventDefault(); if (validateStep1()) setStep(2); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep2()) return;
    setSubmitting(true);
    try {
      await depositsAPI.createWithDistribution({
        memberId,
        totalAmount,
        mpesaMessage: formData.mpesaMessage,
        notes:        formData.notes,
        distribution: {
          savings:        Number(formData.savings       || 0),
          savingsMonth:   Number(formData.savingsMonth),
          savingsYear:    Number(formData.savingsYear),
          loanPayment:    Number(formData.loanPayment   || 0),
          loanId:         formData.selectedLoanId || null,
          chamaaPayment:  Number(formData.chamaaPayment || 0),
          chamaaMonth:    Number(formData.chamaaMonth),
          chamaaYear:     Number(formData.chamaaYear),
          chamaaSlotIds:  checkedSlotIds,   // ← slot IDs sent to backend
          seedCapital:    Number(formData.seedCapital   || 0),
          savingsFine:    Number(formData.savingsFine   || 0),
          chamaaFine:     Number(formData.chamaaFine    || 0),
          agmFee:         Number(formData.agmFee        || 0),
          others:         Number(formData.others        || 0),
        },
      });
      toast.success('Deposit Submitted', "Your deposit is pending admin approval.", { duration: 5000 });
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
    style:'currency', currency:'KES', minimumFractionDigits:0,
  }).format(v || 0);

  const summaryRows = [
    { label:'Savings',       key:'savingsAmount',       icon:'savings'       },
    { label:'Loan Payment',  key:'loanPaymentAmount',   icon:'loanPayment'   },
    { label:'Chamaa',        key:'chamaaPaymentAmount', icon:'chamaaPayment' },
    { label:'Seed Capital',  key:'seedCapitalAmount',   icon:'seedCapital'   },
    { label:'Savings Fine',  key:'savingsFineAmount',   icon:'savingsFine'   },
    { label:'Chamaa Fine',   key:'chamaaFineAmount',    icon:'chamaaFine'    },
    { label:'AGM Fee',       key:'agmFeeAmount',        icon:'agmFee'        },
    { label:'Others',        key:'othersAmount',        icon:'others'        },
  ];

  const hasChamaaPayment = Number(formData.chamaaPayment) > 0;

  return (
    <>
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <div className="dm-overlay" onClick={onClose}>
        <div className="dm-content" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="dm-header">
            <h2 className="dm-header__title">
              <CreditCard size={18} />
              {isViewMode ? 'Deposit Status' : 'Make a Deposit'}
            </h2>
            <button className="dm-header__close" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className="dm-body">

            {/* Rejected deposits */}
            {hasRejections && visibleRejections.length > 0 && (
              <div className="dm-section">
                <div className="dm-rejections__head">
                  <h4 className="dm-rejections__title"><XCircle size={15} /> Rejected Deposits</h4>
                  {visibleRejections.length > 1 && (
                    <button className="dm-btn-dismiss-all" onClick={dismissAll}>Dismiss All</button>
                  )}
                </div>
                {visibleRejections.map(d => (
                  <div key={d.id} className="dm-rejection-card">
                    <button className="dm-rejection-card__close" onClick={() => dismissRejection(d.id)} aria-label="Dismiss">
                      <X size={11} />
                    </button>
                    <div className="dm-rejection-card__top">
                      <div>
                        <strong className="dm-rejection-card__amount">{fmt(d.totalAmount)}</strong>
                        <span className="dm-rejection-card__code">Code: {d.mpesaCode}</span>
                      </div>
                      <span className="dm-rejection-card__date">
                        {d.rejectedAt ? new Date(d.rejectedAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : ''}
                      </span>
                    </div>
                    <div className="dm-rejection-card__reason">
                      <AlertTriangle size={13} className="dm-rejection-card__reason-icon" />
                      <span><strong>Rejection Reason: </strong>{d.rejectionReason}</span>
                    </div>
                    <p className="dm-rejection-card__dist-label">Original Distribution:</p>
                    <div className="dm-rejection-card__dist-grid">
                      {summaryRows.filter(r => Number(d[r.key]) > 0).map(r => (
                        <div key={r.label} className="dm-dist-row">
                          <span className="dm-dist-row__label"><CategoryIcon name={r.icon} />{r.label}</span>
                          <strong>{fmt(d[r.key])}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {!isViewMode && <p className="dm-info-note"><Info size={12} /> You can submit a new deposit below.</p>}
              </div>
            )}

            {/* View Mode */}
            {isViewMode && (
              <div className="dm-section">
                <div className="dm-pending-banner">
                  <strong className="dm-pending-banner__title"><Clock size={15} /> Awaiting Admin Approval</strong>
                  <p className="dm-pending-banner__body">
                    Your deposit of <strong>{fmt(pendingDeposit.totalAmount)}</strong>{' '}
                    (Code: {pendingDeposit.mpesaCode}) is pending admin approval.
                  </p>
                </div>
                <h4 className="dm-sub-heading">Distribution Breakdown</h4>
                {summaryRows.filter(r => Number(pendingDeposit[r.key]) > 0).map(r => (
                  <div key={r.label} className="dm-summary-line">
                    <span className="dm-summary-line__label"><CategoryIcon name={r.icon} />{r.label}</span>
                    <strong>{fmt(pendingDeposit[r.key])}</strong>
                  </div>
                ))}
                {pendingDeposit.chamaaMonth && (
                  <div style={{ marginTop:'6px', fontSize:'12px', color:'#7b1fa2', padding:'6px 10px', background:'#f3e5f5', borderRadius:'6px' }}>
                    Chamaa for: <strong>{getMonthName(pendingDeposit.chamaaMonth)} {pendingDeposit.chamaaYear}</strong>
                    {pendingDeposit.chamaaSlotIds?.length > 0 && (
                      <span style={{ marginLeft:'8px', color:'#9c27b0' }}>
                        · {pendingDeposit.chamaaSlotIds.length} slot{pendingDeposit.chamaaSlotIds.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                )}
                <div className="dm-summary-total">
                  <span>Total</span><span>{fmt(pendingDeposit.totalAmount)}</span>
                </div>
                <button className="dm-btn dm-btn--secondary dm-btn--full" onClick={onClose}>Close</button>
              </div>
            )}

            {/* Step forms */}
            {!isViewMode && (
              <>
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

                {/* Step 1 */}
                {step === 1 && (
                  <form onSubmit={handleNext} className="dm-form">
                    <div className="dm-section">
                      <h3 className="dm-section__heading">Deposit Information</h3>
                      <p className="dm-section__note">Enter your M-PESA deposit details</p>
                      <div className="dm-field">
                        <label className="dm-label">Total Amount Deposited *</label>
                        <input className={`dm-input ${errors.totalAmount ? 'dm-input--error' : ''}`}
                          type="number" name="totalAmount" value={formData.totalAmount}
                          onChange={handleChange} placeholder="Enter total amount" min="1" inputMode="numeric" required />
                        {errors.totalAmount && <span className="dm-error"><AlertCircle size={12} />{errors.totalAmount}</span>}
                      </div>
                      <div className="dm-field">
                        <label className="dm-label">M-PESA Message *</label>
                        <textarea className={`dm-textarea ${errors.mpesaMessage ? 'dm-input--error' : ''}`}
                          name="mpesaMessage" value={formData.mpesaMessage} onChange={handleChange}
                          placeholder="Paste the full M-PESA confirmation message..." rows="4" />
                        {formData.mpesaMessage.trim() && (
                          <div className={`dm-code-preview ${isDuplicateCode ? 'dm-code-preview--error' : derivedCode.length >= 10 ? 'dm-code-preview--success' : 'dm-code-preview--warn'}`}>
                            {isDuplicateCode
                              ? <><XCircle size={13} /><span>Already submitted — code <strong>{derivedCode}</strong> exists.</span></>
                              : derivedCode.length >= 10
                                ? <><CheckCircle size={13} /><span>Code extracted: <strong className="dm-mono">{derivedCode}</strong></span></>
                                : <><AlertCircle size={13} /><span>Keep typing — need at least 10 characters</span></>}
                          </div>
                        )}
                        {errors.mpesaMessage && <span className="dm-error"><AlertCircle size={12} />{errors.mpesaMessage}</span>}
                        <p className="dm-hint"><Info size={11} /> Paste the complete SMS you received from M-PESA.</p>
                      </div>
                      <div className="dm-field">
                        <label className="dm-label">Notes (Optional)</label>
                        <textarea className="dm-textarea" name="notes" value={formData.notes}
                          onChange={handleChange} placeholder="Any additional notes..." rows="2" />
                      </div>
                    </div>
                    <div className="dm-actions">
                      <button type="button" className="dm-btn dm-btn--secondary" onClick={onClose}>Cancel</button>
                      <button type="submit" className="dm-btn dm-btn--primary" disabled={isDuplicateCode}>
                        Next <ChevronRight size={15} />
                      </button>
                    </div>
                  </form>
                )}

                {/* Step 2 */}
                {step === 2 && (
                  <form onSubmit={handleSubmit} className="dm-form">

                    {/* Allocation tracker */}
                    <div className={`dm-tracker ${unallocated < 0 ? 'dm-tracker--over' : unallocated === 0 ? 'dm-tracker--done' : 'dm-tracker--ok'}`}>
                      <div className="dm-tracker__cell">
                        <span className="dm-tracker__cell-label">Deposit</span>
                        <span className="dm-tracker__cell-value">{fmt(totalAmount)}</span>
                      </div>
                      <div className="dm-tracker__cell dm-tracker__cell--center">
                        <span className="dm-tracker__cell-label">Allocated</span>
                        <span className={`dm-tracker__cell-value ${unallocated < 0 ? 'dm-tracker__cell-value--over' : ''}`}>{fmt(distributed)}</span>
                      </div>
                      <div className="dm-tracker__cell dm-tracker__cell--right">
                        <span className="dm-tracker__cell-label">Remaining</span>
                        <span className={`dm-tracker__cell-value dm-tracker__cell-value--lg ${unallocated < 0 ? 'dm-tracker__cell-value--over' : unallocated === 0 ? 'dm-tracker__cell-value--done' : ''}`}>{fmt(unallocated)}</span>
                      </div>
                    </div>

                    <div className="dm-section">
                      <h3 className="dm-section__heading">Distribute {fmt(totalAmount)}</h3>
                      <p className="dm-section__note">Allocate across categories — total must not exceed deposit</p>
                      {errors.distribution && <div className="dm-error-banner"><AlertCircle size={13} /> {errors.distribution}</div>}

                      <div className="dm-dist-grid--form">

                        {/* Savings */}
                        <div className="dm-field dm-field--full">
                          <label className="dm-label dm-label--icon"><Wallet size={13} /> Savings</label>
                          <input className="dm-input" type="number" name="savings" value={formData.savings}
                            onChange={handleChange} placeholder="0" min="0" step="1000" inputMode="numeric" />
                          {Number(formData.savings) > 0 && (
                            <div style={{ marginTop:'10px' }}>
                              <p style={{ fontSize:'12px', color:'#555', marginBottom:'8px', display:'flex', alignItems:'center', gap:5 }}>
                                <CalendarDays size={13} /> Which month are you saving <strong style={{ marginLeft:2 }}>for</strong>?
                              </p>
                              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                                <div style={{ flex:'1 1 140px' }}>
                                  <label className="dm-label">Month *</label>
                                  <select className={`dm-select ${errors.savingsMonth ? 'dm-input--error' : ''}`}
                                    name="savingsMonth" value={formData.savingsMonth} onChange={handleChange} required>
                                    {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{getMonthName(i+1)}</option>)}
                                  </select>
                                  {errors.savingsMonth && <span className="dm-error"><AlertCircle size={12} />{errors.savingsMonth}</span>}
                                </div>
                                <div style={{ flex:'1 1 90px' }}>
                                  <label className="dm-label">Year *</label>
                                  <input className={`dm-input ${errors.savingsYear ? 'dm-input--error' : ''}`}
                                    type="number" name="savingsYear" value={formData.savingsYear}
                                    onChange={handleChange} min="2000" max="2100" required />
                                  {errors.savingsYear && <span className="dm-error"><AlertCircle size={12} />{errors.savingsYear}</span>}
                                </div>
                              </div>
                              <PaymentStatusBanner month={formData.savingsMonth} year={formData.savingsYear} label="Saving" />
                            </div>
                          )}
                        </div>

                        {/* Chamaa — multi-slot with checkboxes */}
                        <div className="dm-field dm-field--full">
                          <label className="dm-label dm-label--icon"><Users size={13} /> Chamaa Payment</label>

                          <ChamaaSlotPanel
                            slots={activeSlots}
                            loading={slotsLoading}
                            error={slotsError}
                            onRetry={fetchActiveSlots}
                            checkedSlotIds={checkedSlotIds}
                            onToggle={handleToggleSlot}
                          />

                          {errors.chamaaPayment && (
                            <span className="dm-error" style={{ marginTop:'4px' }}>
                              <AlertCircle size={12} />{errors.chamaaPayment}
                            </span>
                          )}

                          {/* Month/year picker — shown when slots are ticked */}
                          {hasChamaaPayment && (
                            <div style={{ marginTop:'12px' }}>
                              <p style={{ fontSize:'12px', color:'#555', marginBottom:'8px', display:'flex', alignItems:'center', gap:5 }}>
                                <CalendarDays size={13} /> Which month are you paying chamaa <strong style={{ marginLeft:2 }}>for</strong>?
                              </p>
                              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                                <div style={{ flex:'1 1 140px' }}>
                                  <label className="dm-label">Month *</label>
                                  <select className={`dm-select ${errors.chamaaMonth ? 'dm-input--error' : ''}`}
                                    name="chamaaMonth" value={formData.chamaaMonth} onChange={handleChange} required>
                                    {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{getMonthName(i+1)}</option>)}
                                  </select>
                                  {errors.chamaaMonth && <span className="dm-error"><AlertCircle size={12} />{errors.chamaaMonth}</span>}
                                </div>
                                <div style={{ flex:'1 1 90px' }}>
                                  <label className="dm-label">Year *</label>
                                  <input className={`dm-input ${errors.chamaaYear ? 'dm-input--error' : ''}`}
                                    type="number" name="chamaaYear" value={formData.chamaaYear}
                                    onChange={handleChange} min="2000" max="2100" required />
                                  {errors.chamaaYear && <span className="dm-error"><AlertCircle size={12} />{errors.chamaaYear}</span>}
                                </div>
                              </div>
                              <PaymentStatusBanner month={formData.chamaaMonth} year={formData.chamaaYear} label="Paying chamaa" />
                            </div>
                          )}
                        </div>

                        {/* Seed Capital */}
                        <div className="dm-field">
                          <label className="dm-label dm-label--icon"><Sprout size={13} /> Seed Capital</label>
                          <input className="dm-input" type="number" name="seedCapital" value={formData.seedCapital}
                            onChange={handleChange} placeholder="0" min="0" inputMode="numeric" />
                        </div>

                        {/* Savings Fine */}
                        <div className="dm-field">
                          <label className="dm-label dm-label--icon"><AlertCircle size={13} /> Savings Fine</label>
                          <input className="dm-input" type="number" name="savingsFine" value={formData.savingsFine}
                            onChange={handleChange} placeholder="0" min="0" inputMode="numeric" />
                        </div>

                        {/* Chamaa Fine */}
                        <div className="dm-field">
                          <label className="dm-label dm-label--icon"><AlertTriangle size={13} /> Chamaa Fine</label>
                          <input className="dm-input" type="number" name="chamaaFine" value={formData.chamaaFine}
                            onChange={handleChange} placeholder="0" min="0" inputMode="numeric" />
                        </div>

                        {/* AGM Fee */}
                        <div className="dm-field">
                          <label className="dm-label dm-label--icon"><Landmark size={13} /> AGM Fee</label>
                          <input className="dm-input" type="number" name="agmFee" value={formData.agmFee}
                            onChange={handleChange} placeholder="0" min="0" inputMode="numeric" />
                        </div>

                        {/* Others */}
                        <div className="dm-field">
                          <label className="dm-label dm-label--icon"><Package size={13} /> Others</label>
                          <input className="dm-input" type="number" name="others" value={formData.others}
                            onChange={handleChange} placeholder="0" min="0" inputMode="numeric" />
                        </div>

                        {/* Loan Payment */}
                        <div className="dm-field dm-field--full">
                          <label className="dm-label dm-label--icon"><FileText size={13} /> Loan Payment</label>
                          <input className="dm-input" type="number" name="loanPayment" value={formData.loanPayment}
                            onChange={handleChange} placeholder="0" min="0" inputMode="numeric" />
                          {Number(formData.loanPayment) > 0 && (
                            <select className="dm-select" name="selectedLoanId" value={formData.selectedLoanId}
                              onChange={handleChange} required style={{ marginTop:'8px' }}>
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
                          {errors.selectedLoanId && <span className="dm-error"><AlertCircle size={12} />{errors.selectedLoanId}</span>}
                        </div>

                      </div>
                    </div>

                    <div className="dm-actions">
                      <button type="button" className="dm-btn dm-btn--secondary" onClick={() => setStep(1)}>
                        <ChevronLeft size={15} /> Back
                      </button>
                      <button type="submit" className="dm-btn dm-btn--primary"
                        disabled={submitting || unallocated < 0 || distributed === 0}>
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
          </div>
        </div>
      </div>
    </>
  );
};

export default DepositModal;