import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw,
  CreditCard, TrendingUp, DollarSign, Users, ShieldCheck,
  ShieldOff, FileText, ArrowUpCircle, PlusCircle, Loader,
  Wallet, ReceiptText, Star, Info, X,
} from 'lucide-react';
import { loansAPI, membersAPI, guarantorsAPI } from '../../Service/Api';
import Navbar from '../Navbar/navbar';
import '../MembersManagementAdmin/Members.css';
import { useToast, useConfirm, ToastContainer } from '../../useToast';

const TRANSACTION_FEE = 108;
const MAX_ACTIVE_GUARANTEES = 5;
const ONE_SHARE_DIVISOR = 3; // oneShare always divides principal by 3

const Ico = ({ icon: Icon, size = 14, style = {} }) => (
  <Icon size={size} style={{ verticalAlign: 'middle', flexShrink: 0, ...style }} />
);

const MemberLoanApplication = () => {
  const user     = JSON.parse(localStorage.getItem('user') || '{}');
  const memberId = user.memberId;

  const { toasts, toast, dismiss } = useToast();
  const { ConfirmDialog } = useConfirm();

  const [officeGuarantor, setOfficeGuarantor]       = useState(null);
  const [availableDurations, setAvailableDurations] = useState([]);
  const [myLoans, setMyLoans]                       = useState([]);
  const [loading, setLoading]                       = useState(true);

  const [modalMode, setModalMode]                   = useState(null);
  const [eligibility, setEligibility]               = useState(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);

  const [allGuarantors, setAllGuarantors]           = useState([]);
  const [guarantorFilter, setGuarantorFilter]       = useState('all');
  const [eligibleCount, setEligibleCount]           = useState(0);
  const [loadingEligibility, setLoadingEligibility] = useState(false);

  // Stores the full guarantors API response so we can read
  // liabilityPerGuarantor, totalRepayment and requiredGuarantors from the server.
  const [guarantorsMeta, setGuarantorsMeta] = useState({
    liabilityPerGuarantor: 0,
    totalRepayment:        0,
    requiredGuarantors:    0,
  });

  const [formData, setFormData] = useState({
    memberId, amount: '', durationMonths: '', guarantorIds: [], topUpAmount: '',
  });

  const [loanInfo, setLoanInfo] = useState({
    maxLoan: 0, memberSavings: 0, statutoryFee: 0,
    interestRate: 0, totalRepayment: 0, requiredGuarantors: 0,
    tierInfo: null, transactionFee: TRANSACTION_FEE,
  });

  useEffect(() => {
    fetchMyLoans();
    fetchOfficeGuarantor();
    fetchMemberSavings();
    checkEligibility();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkEligibility = async () => {
    setEligibilityLoading(true);
    try {
      const res = await loansAPI.checkEligibility(memberId);
      setEligibility(res.data);
    } catch (err) { console.error('Eligibility check failed:', err); }
    finally { setEligibilityLoading(false); }
  };

  const fetchMemberSavings = async () => {
    try {
      const res = await loansAPI.getMaxLoan(memberId);
      const { totalSavings, maxLoan, statutoryFee } = res.data;
      setLoanInfo(prev => ({ ...prev, memberSavings: totalSavings, maxLoan, statutoryFee: statutoryFee || 0 }));
    } catch {
      try {
        const res = await membersAPI.getById(memberId);
        const m   = res.data.member || res.data;
        if (m) {
          const savings = Number(m.total_savings || 0);
          setLoanInfo(prev => ({ ...prev, memberSavings: savings, maxLoan: savings * 3, statutoryFee: 0 }));
        }
      } catch (e) { console.error('Failed to fetch member savings:', e); }
    }
  };

  const fetchOfficeGuarantor = async () => {
    try {
      const res = await loansAPI.getOfficeGuarantor();
      setOfficeGuarantor(res.data);
    } catch {}
  };

  const fetchMyLoans = async () => {
    try {
      const res = await loansAPI.getAll({ memberId });
      setMyLoans(res.data.loans);
    } catch {}
    finally { setLoading(false); }
  };

  const hasPendingLoanInList  = myLoans.some(l => l.approvalStatus === 'pending');
  const hasPendingApplication =
    hasPendingLoanInList || (eligibility != null && eligibility.pendingLoan != null);
  const isButtonDisabled = eligibilityLoading || hasPendingApplication;

  const ButtonIcon = () => {
    if (eligibilityLoading)    return <Ico icon={Loader}        size={15} style={{ marginRight: 6 }} />;
    if (hasPendingApplication) return <Ico icon={Clock}         size={15} style={{ marginRight: 6 }} />;
    if (eligibility?.canApply) return <Ico icon={PlusCircle}    size={15} style={{ marginRight: 6 }} />;
    if (eligibility?.canTopUp) return <Ico icon={ArrowUpCircle} size={15} style={{ marginRight: 6 }} />;
    return <Ico icon={PlusCircle} size={15} style={{ marginRight: 6 }} />;
  };

  const buttonLabel = () => {
    if (eligibilityLoading)    return 'Checking...';
    if (!eligibility)          return 'Apply for Loan';
    if (hasPendingApplication) {
      return eligibility.pendingLoan?.loanType === 'top_up'
        ? 'Top-Up Pending'
        : 'Application Pending';
    }
    if (eligibility.canApply)  return 'Apply for Loan';
    if (eligibility.canTopUp)  return 'Request Top-Up';
    return 'Apply for Loan';
  };

  const effectiveAmount = useCallback(() => {
    if (modalMode === 'topup' && eligibility?.activeLoan) {
      return Number(formData.topUpAmount || 0);
    }
    return Number(formData.amount || 0);
  }, [modalMode, eligibility, formData.topUpAmount, formData.amount]);

  useEffect(() => {
    const amt = effectiveAmount();
    if (amt >= 1000) {
      fetchDurationOptionsForAmount(amt);
      fetchEligibleGuarantors(amt);
      // Set required guarantors locally too so UI responds immediately
      const req = amt < 80000 ? 3 : 5;
      setLoanInfo(prev => ({ ...prev, requiredGuarantors: req }));
    } else {
      setAvailableDurations([]);
      setAllGuarantors([]);
      setGuarantorsMeta({ liabilityPerGuarantor: 0, totalRepayment: 0, requiredGuarantors: 0 });
      setLoanInfo(prev => ({ ...prev, requiredGuarantors: 0 }));
      setFormData(prev => ({ ...prev, durationMonths: '', guarantorIds: [] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.amount, formData.topUpAmount, modalMode]);

  useEffect(() => {
    const amt = effectiveAmount();
    if (amt && formData.durationMonths) calculateLoanDetails(amt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.amount, formData.topUpAmount, formData.durationMonths]);

  const fetchDurationOptionsForAmount = async (amount) => {
    try {
      const res = await loansAPI.getDurationOptions(amount);
      setAvailableDurations(res.data.durationOptions || []);
      setLoanInfo(prev => ({ ...prev, tierInfo: { name: res.data.tier, minAmount: res.data.minAmount, maxAmount: res.data.maxAmount } }));
      if (formData.durationMonths) {
        const valid = res.data.durationOptions?.some(d => d.months === Number(formData.durationMonths));
        if (!valid) setFormData(prev => ({ ...prev, durationMonths: '' }));
      }
    } catch { setAvailableDurations([]); }
  };

  // Guarantor liability formula:
  //   Step 1: totalRepayment = principal + interest + txFee
  //   Step 2: oneShare       = principal / ONE_SHARE_DIVISOR (always 3)
  //   Step 3: reduced        = totalRepayment - oneShare
  //   Step 4: liabilityEach  = reduced / n   (n = requiredGuarantors for the loan amount)
  //
  // Example (99k, 5 guarantors, 10% interest):
  //   totalRepayment = 99,000 + 9,900 + 108 = 109,008
  //   oneShare       = 99,000 / 3 = 33,000
  //   reduced        = 109,008 - 33,000 = 76,008
  //   liabilityEach  = 76,008 / 5 = 15,201.60
  const fetchEligibleGuarantors = async (loanAmount) => {
    setLoadingEligibility(true);
    try {
      const res  = await guarantorsAPI.getEligible({ loanAmount, excludeMemberId: memberId });
      const data = res.data;
      setAllGuarantors(data.guarantors || []);
      setEligibleCount(data.eligibleCount || 0);

      setGuarantorsMeta({
        liabilityPerGuarantor: data.liabilityPerGuarantor || 0,
        totalRepayment:        data.totalRepayment        || 0,
        requiredGuarantors:    data.requiredGuarantors    || (loanAmount < 80000 ? 3 : 5),
      });

      setLoanInfo(prev => ({
        ...prev,
        requiredGuarantors: data.requiredGuarantors || (loanAmount < 80000 ? 3 : 5),
      }));
    } catch {
      setAllGuarantors([]);
      setEligibleCount(0);
      setGuarantorsMeta({ liabilityPerGuarantor: 0, totalRepayment: 0, requiredGuarantors: 0 });
    }
    finally { setLoadingEligibility(false); }
  };

  const calculateLoanDetails = (amount) => {
    const amt  = Number(amount);
    const dur  = Number(formData.durationMonths);
    const opt  = availableDurations.find(d => d.months === dur);
    const rate = opt ? opt.interestRate : 0;
    setLoanInfo(prev => ({
      ...prev,
      interestRate:       rate,
      totalRepayment:     amt + (amt * rate / 100),
      requiredGuarantors: amt < 80000 ? 3 : 5,
    }));
  };

  const handleOpenModal = async () => {
    if (isButtonDisabled) return;
    setEligibilityLoading(true);
    try {
      await Promise.all([fetchMemberSavings(), fetchMyLoans()]);
      const res = await loansAPI.checkEligibility(memberId);
      setEligibility(res.data);
      const freshPending =
        myLoans.some(l => l.approvalStatus === 'pending') || res.data.pendingLoan != null;
      if (freshPending) return;
      if (res.data.canApply)      { resetForm(); setModalMode('new');   }
      else if (res.data.canTopUp) { resetForm(); setModalMode('topup'); }
    } catch {
      toast.error('Eligibility Check Failed', 'Could not verify loan eligibility. Please try again.');
    }
    finally { setEligibilityLoading(false); }
  };

  const resetForm = () => {
    setFormData({ memberId, amount: '', durationMonths: '', guarantorIds: [], topUpAmount: '' });
    setAvailableDurations([]);
    setAllGuarantors([]);
    setGuarantorFilter('all');
    setGuarantorsMeta({ liabilityPerGuarantor: 0, totalRepayment: 0, requiredGuarantors: 0 });
  };

  const closeModal = () => { setModalMode(null); resetForm(); };

  const toggleGuarantor = (guarantor) => {
    if (guarantor.id === officeGuarantor?.id) {
      setFormData(prev => ({
        ...prev,
        guarantorIds: prev.guarantorIds.includes(guarantor.id)
          ? prev.guarantorIds.filter(g => g !== guarantor.id)
          : [...prev.guarantorIds, guarantor.id],
      }));
      return;
    }
    if (!guarantor.isEligible) {
      toast.warning(
        `${guarantor.firstName} ${guarantor.lastName} is ineligible`,
        guarantor.activeGuaranteeCount >= MAX_ACTIVE_GUARANTEES
          ? `This member has reached the maximum of ${MAX_ACTIVE_GUARANTEES} active guarantees.`
          : 'This member does not have sufficient savings to guarantee this loan.'
      );
      return;
    }
    setFormData(prev => ({
      ...prev,
      guarantorIds: prev.guarantorIds.includes(guarantor.id)
        ? prev.guarantorIds.filter(g => g !== guarantor.id)
        : [...prev.guarantorIds, guarantor.id],
    }));
  };

  const filteredGuarantors = allGuarantors.filter(g => {
    if (guarantorFilter === 'eligible')   return g.isEligible;
    if (guarantorFilter === 'ineligible') return !g.isEligible;
    return true;
  });

  const fmt = (amount) => new Intl.NumberFormat('en-KE', {
    style: 'currency', currency: 'KES', minimumFractionDigits: 0,
  }).format(amount || 0);

  const handleSubmitNew = async (e) => {
    e.preventDefault();
    if (formData.guarantorIds.length < loanInfo.requiredGuarantors) {
      toast.warning('Insufficient Guarantors', `You need ${loanInfo.requiredGuarantors} guarantors. You've selected ${formData.guarantorIds.length}.`);
      return;
    }
    if (Number(formData.amount) > loanInfo.maxLoan) {
      toast.warning('Amount Exceeds Limit', `Amount exceeds your maximum eligible loan of ${fmt(loanInfo.maxLoan)}.`);
      return;
    }
    try {
      const res = await loansAPI.apply({
        memberId: formData.memberId,
        amount: Number(formData.amount),
        durationMonths: Number(formData.durationMonths),
        guarantorIds: formData.guarantorIds,
      });
      toast.success('Application Submitted', res.data.message || 'Your loan application has been submitted for review.');
      closeModal(); fetchMyLoans(); checkEligibility();
    } catch (err) {
      toast.error('Submission Failed', err.response?.data?.message || 'Failed to submit loan application.');
    }
  };

  const handleSubmitTopUp = async (e) => {
    e.preventDefault();
    const currentBalance = Number(eligibility?.activeLoan?.remainingBalance || 0);
    if (!formData.topUpAmount || Number(formData.topUpAmount) <= currentBalance) {
      toast.warning('Invalid Amount', `Top-up amount must be greater than your current balance of ${fmt(currentBalance)}.`);
      return;
    }
    if (formData.guarantorIds.length < loanInfo.requiredGuarantors) {
      toast.warning('Insufficient Guarantors', `You need ${loanInfo.requiredGuarantors} guarantors. You've selected ${formData.guarantorIds.length}.`);
      return;
    }
    try {
      const res = await loansAPI.requestTopUp({
        memberId,
        topUpAmount:    Number(formData.topUpAmount),
        durationMonths: Number(formData.durationMonths),
        guarantorIds:   formData.guarantorIds,
      });
      toast.success('Top-Up Requested', res.data.message || 'Your top-up request has been submitted for admin review.');
      closeModal(); fetchMyLoans(); checkEligibility();
    } catch (err) {
      toast.error('Submission Failed', err.response?.data?.message || 'Failed to submit top-up request.');
    }
  };

  const getStatusBadge = (loan) => {
    if (loan.approvalStatus === 'pending')
      return (
        <span className="status" style={{ background: '#ff9800', color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} /> Pending Approval
        </span>
      );
    if (loan.approvalStatus === 'rejected')
      return (
        <span className="status overdue" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <XCircle size={11} /> Rejected
        </span>
      );
    const map = {
      active:    { text: 'Active',    cls: 'status active',  Icon: CheckCircle   },
      arrears:   { text: 'Arrears',   cls: 'status late',    Icon: AlertTriangle },
      default:   { text: 'Default',   cls: 'status overdue', Icon: XCircle       },
      paid:      { text: 'Paid',      cls: 'status ontime',  Icon: CheckCircle   },
      topped_up: { text: 'Topped Up', cls: 'status',         Icon: ArrowUpCircle },
    };
    const b = map[loan.status] || { text: loan.status, cls: 'status', Icon: Info };
    return (
      <span className={b.cls} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <b.Icon size={11} /> {b.text}
      </span>
    );
  };

  // ── Guarantor Picker ─────────────────────────────────────────
  const GuarantorPicker = () => {
    const selectedCount   = formData.guarantorIds.length;
    const requiredCount   = loanInfo.requiredGuarantors;
    const progressPercent = requiredCount > 0 ? Math.min(100, (selectedCount / requiredCount) * 100) : 0;
    const progressColor   = selectedCount >= requiredCount ? '#4caf50' : selectedCount > 0 ? '#ff9800' : '#e0e0e0';

    const n             = guarantorsMeta.requiredGuarantors || requiredCount;
    const totalRep      = guarantorsMeta.totalRepayment;
    const liabilityPerG = guarantorsMeta.liabilityPerGuarantor;

    // oneShare = principal / ONE_SHARE_DIVISOR (always 3)
    // liabilityEach = (totalRepayment - oneShare) / n
    const principalAmt = effectiveAmount();
    const oneShareAmt  = principalAmt / ONE_SHARE_DIVISOR;  // always ÷ 3

    // Formula display: e.g. "(109,008 − 33,000) ÷ 5 = 15,201"
    const liabilityFormulaLabel = liabilityPerG > 0 && totalRep > 0 && n > 0
      ? `(${fmt(totalRep)} − ${fmt(oneShareAmt)}) ÷ ${n} = ${fmt(liabilityPerG)}`
      : null;

    const liabilityBannerLabel = liabilityPerG > 0
      ? `Minimum savings required per guarantor: ${fmt(liabilityPerG)}`
      : null;

    return (
      <div className="form-group guarantor-picker-wrapper">
        {/* Header row */}
        <div className="guarantor-picker-header">
          <label className="guarantor-picker-label">
            Select Guarantors
            {requiredCount > 0 && (
              <span className={`guarantor-count-badge ${selectedCount >= requiredCount ? 'complete' : ''}`}>
                {selectedCount}/{requiredCount}
              </span>
            )}
          </label>
          {requiredCount > 0 && (
            <span className="guarantor-picker-hint">
              {selectedCount >= requiredCount
                ? <><CheckCircle size={12} color="#4caf50" /> All selected</>
                : <>{requiredCount - selectedCount} more needed</>}
            </span>
          )}
        </div>

        {/* Liability info banner — shows server value with formula breakdown */}
        {liabilityBannerLabel && (
          <div className="guarantor-liability-info">
            <Users size={12} />
            <div className="guarantor-liability-info-inner">
              <span className="guarantor-liability-main">{liabilityBannerLabel}</span>
              {liabilityFormulaLabel && (
                <span className="guarantor-liability-formula">
                  Formula: {liabilityFormulaLabel}
                </span>
              )}
              {n > 0 && totalRep > 0 && (
                <span className="guarantor-liability-split">
                  Total repayment {fmt(totalRep)} · one share ({fmt(principalAmt)} ÷ {ONE_SHARE_DIVISOR} = {fmt(oneShareAmt)}) distributed across {n} guarantors
                  using the reduced-liability method
                </span>
              )}
            </div>
          </div>
        )}

        {/* Progress bar */}
        {requiredCount > 0 && (
          <div className="guarantor-progress-track">
            <div
              className="guarantor-progress-fill"
              style={{ width: `${progressPercent}%`, background: progressColor }}
            />
          </div>
        )}

        {/* Filter tabs */}
        {allGuarantors.length > 0 && (
          <div className="guarantor-filter-bar">
            {[
              { key: 'all',        label: 'All',        count: allGuarantors.length,                  color: '#1976d2', Icon: Users       },
              { key: 'eligible',   label: 'Eligible',   count: eligibleCount,                          color: '#4caf50', Icon: ShieldCheck },
              { key: 'ineligible', label: 'Ineligible', count: allGuarantors.length - eligibleCount,  color: '#f44336', Icon: ShieldOff   },
            ].map(({ key, label, count, color, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setGuarantorFilter(key)}
                className={`guarantor-filter-btn ${guarantorFilter === key ? 'active' : ''}`}
                style={{
                  borderColor: guarantorFilter === key ? color : '#ddd',
                  background:  guarantorFilter === key ? color : 'white',
                  color:       guarantorFilter === key ? 'white' : '#555',
                }}
              >
                <Icon size={13} />
                <span className="filter-label-text">{label}</span>
                <span className="filter-count-pill" style={{
                  background: guarantorFilter === key ? 'rgba(255,255,255,0.3)' : '#f0f0f0',
                  color:      guarantorFilter === key ? 'white' : '#555',
                }}>{count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Loading state */}
        {loadingEligibility && (
          <div className="guarantor-loading">
            <Loader size={16} /> Loading guarantors…
          </div>
        )}

        {/* Guarantor list */}
        {!loadingEligibility && effectiveAmount() >= 1000 && (
          <div className="guarantor-list-scroll">

            {/* Office guarantor (sticky at top) */}
            {officeGuarantor && (
              <label
                className={`guarantor-item office-guarantor ${formData.guarantorIds.includes(officeGuarantor.id) ? 'selected' : ''}`}
              >
                <div className="guarantor-checkbox-wrap">
                  <input
                    type="checkbox"
                    checked={formData.guarantorIds.includes(officeGuarantor.id)}
                    onChange={() => toggleGuarantor({ id: officeGuarantor.id, isEligible: true })}
                  />
                </div>
                <div className="guarantor-item-info">
                  <div className="guarantor-item-top">
                    <span className="guarantor-item-name">{officeGuarantor.name}</span>
                    <span className="tag-office">
                      <Star size={11} /> ADMIN
                    </span>
                  </div>
                  <span className="guarantor-item-sub">Unlimited guarantee capacity</span>
                </div>
                {formData.guarantorIds.includes(officeGuarantor.id) && (
                  <CheckCircle size={16} color="#4caf50" style={{ flexShrink: 0 }} />
                )}
              </label>
            )}

            {/* Regular guarantors */}
            {filteredGuarantors.map(g => {
              const isSelected = formData.guarantorIds.includes(g.id);
              return (
                <div
                  key={g.id}
                  className={`guarantor-item ${g.isEligible ? 'eligible' : 'ineligible'} ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleGuarantor(g)}
                  role="checkbox"
                  aria-checked={isSelected}
                  tabIndex={g.isEligible ? 0 : -1}
                  onKeyDown={e => e.key === ' ' && g.isEligible && toggleGuarantor(g)}
                >
                  {/* Checkbox */}
                  <div className="guarantor-checkbox-wrap">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      disabled={!g.isEligible}
                      tabIndex={-1}
                      onClick={e => e.stopPropagation()}
                    />
                  </div>

                  {/* Avatar */}
                  <div className={`guarantor-avatar ${g.isEligible ? 'elig' : 'inelig'}`}>
                    {g.firstName?.[0]}{g.lastName?.[0]}
                  </div>

                  {/* Info */}
                  <div className="guarantor-item-info">
                    <div className="guarantor-item-top">
                      <span className="guarantor-item-name">{g.firstName} {g.lastName}</span>
                      <span className={`tag-elig ${g.isEligible ? 'tag-yes' : 'tag-no'}`}>
                        {g.isEligible
                          ? <><CheckCircle size={10} /> Eligible</>
                          : <><XCircle size={10} /> Ineligible</>}
                      </span>
                    </div>
                    <div className="guarantor-item-meta">
                      {/* Guarantee usage bar */}
                      <div className="guarantee-usage-bar">
                        {Array.from({ length: MAX_ACTIVE_GUARANTEES }).map((_, i) => (
                          <div
                            key={i}
                            className={`guarantee-usage-pip ${i < g.activeGuaranteeCount ? 'filled' : ''} ${g.activeGuaranteeCount >= MAX_ACTIVE_GUARANTEES ? 'maxed' : ''}`}
                          />
                        ))}
                      </div>
                      <span style={{ color: g.activeGuaranteeCount >= MAX_ACTIVE_GUARANTEES ? '#f44336' : '#777', fontSize: '11px' }}>
                        {g.activeGuaranteeCount}/{MAX_ACTIVE_GUARANTEES} active guarantees
                      </span>
                    </div>

                    {/* Ineligibility reason */}
                    {!g.isEligible && g.ineligibilityReason ? (
                      <div className="guarantor-ineligible-reason">
                        <AlertTriangle size={11} color="#991b1b" />
                        {g.ineligibilityReason}
                      </div>
                    ) : !g.isEligible && (
                      <div className="guarantor-ineligible-reason">
                        <AlertTriangle size={11} color="#991b1b" />
                        {g.activeGuaranteeCount >= MAX_ACTIVE_GUARANTEES ? 'Max guarantees reached' : 'Insufficient savings'}
                      </div>
                    )}

                    {/* Show available savings vs required liability for eligible guarantors */}
                    {g.isEligible && g.availableSavings !== undefined && (
                      <div className="guarantor-savings-info">
                        <span>Available savings: <strong>{fmt(g.availableSavings)}</strong></span>
                        {liabilityPerG > 0 && (
                          <span style={{ color: '#555' }}>
                            {' '}· Required: <strong>{fmt(liabilityPerG)}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Selected check */}
                  {isSelected && g.isEligible && (
                    <CheckCircle size={16} color="#4caf50" style={{ flexShrink: 0 }} />
                  )}
                </div>
              );
            })}

            {filteredGuarantors.length === 0 && !officeGuarantor && (
              <div className="guarantor-loading">
                <Users size={16} /> No {guarantorFilter === 'all' ? '' : guarantorFilter} guarantors found
              </div>
            )}
          </div>
        )}

        {/* Selected summary chips */}
        {formData.guarantorIds.length > 0 && (
          <div className="guarantor-selected-summary">
            <span className="guarantor-selected-label">Selected:</span>
            {formData.guarantorIds.map(id => {
              const g        = allGuarantors.find(g => g.id === id);
              const isOffice = officeGuarantor && id === officeGuarantor.id;
              const name     = isOffice
                ? officeGuarantor.name
                : g ? `${g.firstName} ${g.lastName}` : `#${id}`;
              return (
                <span key={id} className="guarantor-chip">
                  {name}
                  <button
                    type="button"
                    className="guarantor-chip-remove"
                    onClick={() => setFormData(prev => ({ ...prev, guarantorIds: prev.guarantorIds.filter(i => i !== id) }))}
                    aria-label={`Remove ${name}`}
                  >
                    <X size={10} />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ── Loan Summary Box ─────────────────────────────────────────
  // Liability formula:
  //   oneShare    = principal / ONE_SHARE_DIVISOR   (always ÷ 3)
  //   liabilityEach = (totalRepayment - oneShare) / n
  //
  // Example: principal=99,000 | n=5 | rate=10% | fee=108
  //   totalRepayment = 99,000 + 9,900 + 108 = 109,008
  //   oneShare       = 99,000 / 3 = 33,000
  //   reduced        = 109,008 - 33,000 = 76,008
  //   liabilityEach  = 76,008 / 5 = 15,201.60
  function LoanSummaryBox({ amt, label = 'Loan Amount' }) {
    if (!amt || !formData.durationMonths) return null;
    const fullRepayment = amt + (amt * loanInfo.interestRate / 100) + TRANSACTION_FEE;

    const n             = loanInfo.requiredGuarantors || (amt < 80000 ? 3 : 5);
    const oneShare      = amt / ONE_SHARE_DIVISOR;         // always principal ÷ 3
    const reduced       = fullRepayment - oneShare;        // totalRepayment - oneShare
    const liabilityEach = reduced / n;                     // reduced ÷ n

    return (
      <div className="loan-summary-box">
        <h3 className="loan-summary-title">
          <FileText size={16} /> Loan Summary
        </h3>
        <div className="loan-summary-grid">
          <div><p className="sum-label">{label}:</p><p className="sum-value">{fmt(amt)}</p></div>
          <div><p className="sum-label">Interest Rate:</p><p className="sum-value">{loanInfo.interestRate}%</p></div>
          <div><p className="sum-label">Interest Amount:</p><p className="sum-value">{fmt(amt * loanInfo.interestRate / 100)}</p></div>
          <div><p className="sum-label">Transaction Fee:</p><p className="sum-value" style={{ color: '#f57f17' }}>+ {fmt(TRANSACTION_FEE)}</p></div>
        </div>
        {modalMode === 'topup' && eligibility?.activeLoan ? (
          <div className="loan-summary-amounts">
            <div className="amount-box blue">
              <div className="amount-box-label"><ReceiptText size={13} /> NEW LOAN BALANCE</div>
              <div className="amount-box-value">{fmt(fullRepayment)}</div>
              <div className="amount-box-sub">Principal + {loanInfo.interestRate}% interest + {fmt(TRANSACTION_FEE)} fee</div>
            </div>
            <div className="amount-box green">
              <div className="amount-box-label"><DollarSign size={13} /> CASH YOU RECEIVE</div>
              <div className="amount-box-value">{fmt(Math.max(0, amt - Number(eligibility.activeLoan.remainingBalance)))}</div>
              <div className="amount-box-sub">After clearing old balance of {fmt(eligibility.activeLoan.remainingBalance)}</div>
            </div>
          </div>
        ) : (
          <div className="loan-summary-disburse">
            <div>
              <p className="amount-box-label" style={{ margin: 0 }}><DollarSign size={13} /> YOU WILL RECEIVE</p>
              <p className="amount-disburse-value">{fmt(amt)}</p>
              <p className="amount-box-sub" style={{ margin: '2px 0 0' }}>Full loan amount disbursed to you</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className="amount-box-label" style={{ margin: 0, justifyContent: 'flex-end', display: 'flex', alignItems: 'center', gap: 5 }}><ReceiptText size={13} /> LOAN BALANCE</p>
              <p className="amount-balance-value">{fmt(fullRepayment)}</p>
              <p className="amount-box-sub" style={{ margin: '2px 0 0' }}>Principal + {loanInfo.interestRate}% interest + {fmt(TRANSACTION_FEE)} fee</p>
            </div>
          </div>
        )}

        {/* Guarantor requirement with per-guarantor liability breakdown */}
        <div className="loan-summary-guarantors">
          <Users size={13} color="#888" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span>
              <strong>Guarantors Required:</strong> {n}
              <span style={{ color: '#888', marginLeft: 6 }}>
                · Min. savings per guarantor: <strong style={{ color: '#1565c0' }}>{fmt(liabilityEach)}</strong>
              </span>
            </span>
            <span style={{ fontSize: '11px', color: '#888' }}>
              Formula: ({fmt(fullRepayment)} − {fmt(amt)} ÷ {ONE_SHARE_DIVISOR}) ÷ {n} = ({fmt(fullRepayment)} − {fmt(oneShare)}) ÷ {n}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Modal Actions ────────────────────────────────────────────
  function ModalActions({ onClose, disabled, submitLabel = 'Submit Application' }) {
    return (
      <>
        {loanInfo.requiredGuarantors > 0 && formData.guarantorIds.length < loanInfo.requiredGuarantors && (
          <p className="guarantor-warning">
            <AlertTriangle size={14} />
            You need {loanInfo.requiredGuarantors - formData.guarantorIds.length} more guarantor(s)
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={disabled}>{submitLabel}</button>
        </div>
      </>
    );
  }

  // ── Loan cards for mobile ──
  const LoanCards = () => (
    <div className="loan-cards-mobile">
      {myLoans.map(loan => {
        const txFee        = Number(loan.transactionFee ?? TRANSACTION_FEE);
        const isTopUp      = loan.loanType === 'top_up';
        const cashToMember = isTopUp
          ? Number(loan.amount) - Number(loan.previousBalance || 0)
          : Number(loan.amount);

        return (
          <div key={loan.id} className="loan-card-mobile">
            <div className="loan-card-mobile-header">
              <div>
                <span className="loan-card-mobile-id">Loan #{loan.id}</span>
                {isTopUp && (
                  <span className="tag-topup">
                    <ArrowUpCircle size={10} /> Top-Up
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {loan.approvalStatus === 'pending'  && <span className="mob-badge orange"><Clock size={10} /> Pending</span>}
                {loan.approvalStatus === 'approved' && <span className="mob-badge green"><CheckCircle size={10} /> Approved</span>}
                {loan.approvalStatus === 'rejected' && <span className="mob-badge red"><XCircle size={10} /> Rejected</span>}
                {getStatusBadge(loan)}
              </div>
            </div>

            <div className="loan-card-mobile-grid">
              <div className="loan-card-mobile-field">
                <span className="lcm-label">Amount</span>
                <span className="lcm-value">{fmt(loan.amount)}</span>
              </div>
              <div className="loan-card-mobile-field">
                <span className="lcm-label">Tx Fee</span>
                <span className="lcm-value" style={{ color: '#f57f17' }}>{fmt(txFee)}</span>
              </div>
              <div className="loan-card-mobile-field">
                <span className="lcm-label">Cash to You</span>
                <span className="lcm-value" style={{ color: '#2e7d32', fontWeight: 700 }}>{fmt(cashToMember)}</span>
              </div>
              <div className="loan-card-mobile-field">
                <span className="lcm-label">Interest</span>
                <span className="lcm-value">{loan.interestRate}%</span>
              </div>
              <div className="loan-card-mobile-field">
                <span className="lcm-label">Duration</span>
                <span className="lcm-value">{loan.durationMonths}m</span>
              </div>
              <div className="loan-card-mobile-field">
                <span className="lcm-label">Total Repayment</span>
                <span className="lcm-value" style={{ color: '#1976d2' }}>{fmt(loan.totalRepayment)}</span>
              </div>
              <div className="loan-card-mobile-field">
                <span className="lcm-label">Applied On</span>
                <span className="lcm-value">{new Date(loan.createdAt).toLocaleDateString()}</span>
              </div>
              {loan.approvalStatus === 'approved' && (
                <div className="loan-card-mobile-field">
                  <span className="lcm-label">Balance</span>
                  <span className="lcm-value">{fmt(loan.remainingBalance)}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <Navbar />
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <ConfirmDialog />

      <div className="admin-container mla-container">

        {/* ── Page Header ── */}
        <div className="mla-page-header">
          <div>
            <h1>My Loan Applications</h1>
          </div>
          <div className="mla-header-actions">
            <button
              className="btn-primary"
              onClick={handleOpenModal}
              disabled={isButtonDisabled}
              title={hasPendingApplication ? 'You have a pending application.' : ''}
              style={{
                opacity:    isButtonDisabled ? 0.55 : 1,
                cursor:     isButtonDisabled ? 'not-allowed' : 'pointer',
                background: hasPendingApplication ? '#9e9e9e' : undefined,
                display:    'inline-flex', alignItems: 'center',
                padding:    '10px 16px', fontSize: '13px',
              }}
            >
              <ButtonIcon />
              {buttonLabel()}
            </button>
            {hasPendingApplication && (
              <span className="mla-pending-hint">
                <Clock size={11} /> Awaiting admin decision
              </span>
            )}
          </div>
        </div>

        {/* ── Status Banner ── */}
        {eligibility && (hasPendingApplication || (!eligibility.canApply && eligibility.canTopUp)) && (
          <div className={`mla-status-banner ${hasPendingApplication ? 'banner-warning' : 'banner-info'}`}>
            {hasPendingApplication ? (
              <div className="banner-inner">
                <Clock size={24} color="#e65100" style={{ flexShrink: 0 }} />
                <div>
                  <strong className="banner-title">
                    {eligibility.pendingLoan?.loanType === 'top_up'
                      ? 'Top-Up Request Pending Review'
                      : 'Loan Application Pending Review'}
                  </strong>
                  <p className="banner-msg">{eligibility.message}</p>
                  <p className="banner-sub">
                    {eligibility.pendingLoan?.loanType === 'top_up'
                      ? 'You cannot request another top-up until an admin approves or rejects the current one.'
                      : 'You cannot apply for a new loan or request a top-up until an admin approves or rejects this application.'}
                  </p>
                  {eligibility.pendingLoan && (
                    <div className="banner-meta">
                      <span><FileText size={13} /> Loan #{eligibility.pendingLoan.id}</span>
                      <span>Amount: <strong>{fmt(eligibility.pendingLoan.amount)}</strong></span>
                      <span>
                        {eligibility.pendingLoan.loanType === 'top_up' ? 'Top-Up Requested' : 'Applied'}:{' '}
                        <strong>{new Date(eligibility.pendingLoan.appliedOn).toLocaleDateString()}</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : eligibility.canTopUp ? (
              <>
                <strong className="banner-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CreditCard size={15} /> Active Loan Detected
                </strong>
                <p className="banner-msg">
                  You have an active loan of <strong>{fmt(eligibility.activeLoan?.amount)}</strong> with a remaining balance of{' '}
                  <strong>{fmt(eligibility.activeLoan?.remainingBalance)}</strong>. You can request a <strong>top-up</strong>.
                </p>
              </>
            ) : null}
          </div>
        )}

        {/* ── Eligibility Card ── */}
        <div className="mla-eligibility-card">
          <div className="mla-eligibility-header">
            <h3><Wallet size={18} /> Your Loan Eligibility</h3>
            <button type="button" onClick={fetchMemberSavings} className="mla-refresh-btn">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          <div className="mla-eligibility-grid">
            <div className="elig-item">
              <p className="elig-label"><DollarSign size={12} /> Total Savings</p>
              <p className="elig-value green">{fmt(loanInfo.memberSavings)}</p>
            </div>
            <div className="elig-item">
              <p className="elig-label"><TrendingUp size={12} /> Maximum Eligible Loan</p>
              <p className="elig-value blue">{fmt(loanInfo.maxLoan)}</p>
            </div>
            <div className="elig-item">
              <p className="elig-label"><ReceiptText size={12} /> Statutory Deduction</p>
              <p className="elig-value" style={{ color: loanInfo.statutoryFee > 0 ? '#c62828' : '#aaa', fontSize: '14px', fontWeight: 700 }}>
                {loanInfo.statutoryFee > 0 ? `− ${fmt(loanInfo.statutoryFee)}` : 'None this year'}
              </p>
            </div>
            <div className="elig-item">
              <p className="elig-label"><ReceiptText size={12} /> Transaction Fee</p>
              <p className="elig-value" style={{ color: '#f57f17', fontSize: '14px', fontWeight: 700 }}>
                {fmt(TRANSACTION_FEE)} <span style={{ fontSize: '11px', color: '#888', fontWeight: 400 }}>added to repayment</span>
              </p>
            </div>
            <div className="elig-item">
              <p className="elig-label"><Info size={12} /> Formula</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>(Savings × 3) − Statutory Fee</p>
            </div>
          </div>
        </div>

        {/* ── Loans Table / Cards ── */}
        {loading ? (
          <div className="loading" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Loader size={16} /> Loading your loans...
          </div>
        ) : myLoans.length === 0 ? (
          <div className="mla-empty">
            No loan applications yet. Click "<strong>{buttonLabel()}</strong>" to get started!
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="table-container mla-table-desktop">
              <table>
                <thead>
                  <tr>
                    <th>Loan Amount</th><th>Tx Fee</th><th>Cash to You</th><th>Interest</th>
                    <th>Duration</th><th>Total Repayment</th><th>Applied On</th>
                    <th>Approval Status</th><th>Loan Status</th><th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {myLoans.map(loan => {
                    const txFee          = Number(loan.transactionFee ?? TRANSACTION_FEE);
                    const isTopUp        = loan.loanType === 'top_up';
                    const cashToMember   = isTopUp
                      ? Number(loan.amount) - Number(loan.previousBalance || 0)
                      : Number(loan.amount);

                    return (
                      <tr key={loan.id}>
                        <td>
                          {fmt(loan.amount)}
                          {isTopUp && (
                            <span style={{ marginLeft: '6px', padding: '2px 7px', background: '#f3e5f5', color: '#7b1fa2', borderRadius: '10px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <ArrowUpCircle size={10} /> Top-Up
                            </span>
                          )}
                        </td>
                        <td><span style={{ background: '#fff8e1', color: '#f57f17', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 600 }}>{fmt(txFee)}</span></td>
                        <td>
                          <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '3px 10px', borderRadius: '10px', fontSize: '13px', fontWeight: 700 }}>{fmt(cashToMember)}</span>
                          {isTopUp && loan.previousBalance > 0 && (
                            <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>After clearing {fmt(loan.previousBalance)}</div>
                          )}
                        </td>
                        <td>{loan.interestRate}%</td>
                        <td>{loan.durationMonths} months</td>
                        <td>{fmt(loan.totalRepayment)}</td>
                        <td>{new Date(loan.createdAt).toLocaleDateString()}</td>
                        <td>
                          {loan.approvalStatus === 'pending'  && <span style={{ background: '#ff9800', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> Pending</span>}
                          {loan.approvalStatus === 'approved' && <span style={{ background: '#4caf50', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle size={11} /> Approved</span>}
                          {loan.approvalStatus === 'rejected' && <span style={{ background: '#f44336', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: 4 }}><XCircle size={11} /> Rejected</span>}
                        </td>
                        <td>{getStatusBadge(loan)}</td>
                        <td>{loan.approvalStatus === 'approved' ? fmt(loan.remainingBalance) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <LoanCards />
          </>
        )}

        {/* ── NEW LOAN MODAL ── */}
        {modalMode === 'new' && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content mla-modal" onClick={e => e.stopPropagation()}>
              <div className="mla-modal-header">
                <h2>Apply for New Loan</h2>
                <button className="mla-modal-close" onClick={closeModal}><X size={18} /></button>
              </div>
              <div className="mla-modal-body">
                <form onSubmit={handleSubmitNew}>
                  <div className="form-group">
                    <label>Loan Amount *</label>
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={e => setFormData({ ...formData, amount: e.target.value })}
                      required
                      min="1000"
                      max={loanInfo.maxLoan}
                      placeholder={`Max: ${fmt(loanInfo.maxLoan)}`}
                    />
                  </div>
                  <div className="form-group">
                    <label>Loan Duration *</label>
                    <select
                      value={formData.durationMonths}
                      onChange={e => setFormData({ ...formData, durationMonths: e.target.value })}
                      required
                      disabled={!formData.amount || availableDurations.length === 0}
                    >
                      <option value="">{!formData.amount ? 'Enter amount first' : availableDurations.length === 0 ? 'Loading...' : 'Select Duration'}</option>
                      {availableDurations.map(d => (
                        <option key={d.months} value={d.months}>{d.months} month{d.months > 1 ? 's' : ''} @ {d.interestRate}%</option>
                      ))}
                    </select>
                  </div>
                  <LoanSummaryBox amt={Number(formData.amount)} />
                  <GuarantorPicker />
                  <ModalActions
                    onClose={closeModal}
                    disabled={!formData.amount || !formData.durationMonths || formData.guarantorIds.length < loanInfo.requiredGuarantors}
                  />
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ── TOP-UP MODAL ── */}
        {modalMode === 'topup' && eligibility?.activeLoan && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content mla-modal" onClick={e => e.stopPropagation()}>
              <div className="mla-modal-header">
                <h2>Request Loan Top-Up</h2>
                <button className="mla-modal-close" onClick={closeModal}><X size={18} /></button>
              </div>
              <div className="mla-modal-body">
                {/* Current loan info */}
                <div className="topup-current-loan">
                  <h4><CreditCard size={15} /> Your Current Loan</h4>
                  <div className="topup-current-grid">
                    <div><span className="tcg-label">Original Amount:</span> <strong>{fmt(eligibility.activeLoan.amount)}</strong></div>
                    <div><span className="tcg-label">Remaining Balance:</span> <strong style={{ color: '#f44336' }}>{fmt(eligibility.activeLoan.remainingBalance)}</strong></div>
                    <div><span className="tcg-label">Amount Paid:</span> <strong style={{ color: '#4caf50' }}>{fmt(eligibility.activeLoan.amountPaid)}</strong></div>
                    <div><span className="tcg-label">Due Date:</span> <strong>{eligibility.activeLoan.dueDate ? new Date(eligibility.activeLoan.dueDate).toLocaleDateString() : '—'}</strong></div>
                  </div>
                </div>

                <form onSubmit={handleSubmitTopUp}>
                  <div className="form-group">
                    <label>
                      New Top-Up Loan Amount *{' '}
                      <span style={{ fontSize: '12px', color: '#888', fontWeight: 400 }}>
                        (must exceed {fmt(eligibility.activeLoan.remainingBalance)})
                      </span>
                    </label>
                    <input
                      type="number"
                      value={formData.topUpAmount}
                      onChange={e => setFormData({ ...formData, topUpAmount: e.target.value })}
                      required
                      min={Math.ceil(Number(eligibility.activeLoan.remainingBalance)) + 1}
                      placeholder={`Min: ${fmt(Number(eligibility.activeLoan.remainingBalance) + 1000)}`}
                    />
                    {formData.topUpAmount && Number(formData.topUpAmount) > Number(eligibility.activeLoan.remainingBalance) && (
                      <div className="topup-breakdown">
                        <div className="tbd-header">Breakdown</div>
                        <div className="tbd-body">
                          <div className="tbd-row"><span>New Loan Amount (Principal):</span><strong>{fmt(formData.topUpAmount)}</strong></div>
                          <div className="tbd-row orange"><span>+ Interest ({loanInfo.interestRate}%):</span><strong>+ {fmt(Number(formData.topUpAmount) * loanInfo.interestRate / 100)}</strong></div>
                          <div className="tbd-row amber"><span>+ Transaction Fee:</span><strong>+ {fmt(TRANSACTION_FEE)}</strong></div>
                          <div className="tbd-row blue total-row"><span>= New Loan Balance (Total Repayment):</span><strong>{fmt(Number(formData.topUpAmount) + (Number(formData.topUpAmount) * loanInfo.interestRate / 100) + TRANSACTION_FEE)}</strong></div>
                          <div className="tbd-row muted"><span>Old Balance Cleared (on approval):</span><strong style={{ color: '#c62828' }}>− {fmt(eligibility.activeLoan.remainingBalance)}</strong></div>
                          <div className="tbd-row green cash-row"><span><DollarSign size={12} /> Cash You Receive:</span><strong>{fmt(Math.max(0, Number(formData.topUpAmount) - Number(eligibility.activeLoan.remainingBalance)))}</strong></div>
                        </div>
                      </div>
                    )}
                    {formData.topUpAmount && Number(formData.topUpAmount) <= Number(eligibility.activeLoan.remainingBalance) && (
                      <div className="topup-error-hint">
                        <AlertTriangle size={13} /> Amount must be greater than your current balance of {fmt(eligibility.activeLoan.remainingBalance)}
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label>New Loan Duration *</label>
                    <select
                      value={formData.durationMonths}
                      onChange={e => setFormData({ ...formData, durationMonths: e.target.value })}
                      required
                      disabled={!formData.topUpAmount || Number(formData.topUpAmount) <= Number(eligibility.activeLoan.remainingBalance) || availableDurations.length === 0}
                    >
                      <option value="">{!formData.topUpAmount ? 'Enter amount first' : availableDurations.length === 0 ? 'Loading...' : 'Select Duration'}</option>
                      {availableDurations.map(d => (
                        <option key={d.months} value={d.months}>{d.months} month{d.months > 1 ? 's' : ''} @ {d.interestRate}%</option>
                      ))}
                    </select>
                  </div>
                  <LoanSummaryBox amt={effectiveAmount()} label="New Loan Amount" />
                  <GuarantorPicker />
                  <ModalActions
                    onClose={closeModal}
                    disabled={
                      !formData.topUpAmount ||
                      Number(formData.topUpAmount) <= Number(eligibility.activeLoan.remainingBalance) ||
                      !formData.durationMonths ||
                      formData.guarantorIds.length < loanInfo.requiredGuarantors
                    }
                    submitLabel="Submit Top-Up Request"
                  />
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Scoped styles ── */}
      <style>{`
        .mla-container { box-sizing: border-box; }

        .mla-page-header {
          display: flex; justify-content: space-between;
          align-items: flex-start; margin-bottom: 20px;
          gap: 12px; flex-wrap: wrap;
        }
        .mla-page-header h1 { margin: 0; font-size: 20px; }
        @media (min-width: 640px) { .mla-page-header h1 { font-size: 24px; } }

        .mla-header-actions {
          display: flex; flex-direction: column;
          align-items: flex-end; gap: 4px; flex-shrink: 0;
        }
        .mla-pending-hint {
          font-size: 11px; color: #e65100; font-weight: 600;
          display: flex; align-items: center; gap: 4px;
        }

        .mla-status-banner {
          padding: 14px 16px; border-radius: 10px;
          margin-bottom: 16px; border: 2px solid;
        }
        .banner-warning { background: #fff8e1; border-color: #ffc107; }
        .banner-info    { background: #fff3e0; border-color: #ff9800; }
        .banner-inner   { display: flex; align-items: flex-start; gap: 12px; }
        .banner-title   { color: #e65100; font-size: 14px; display: block; margin-bottom: 4px; }
        .banner-msg     { margin: 0 0 4px; font-size: 13px; color: #5d4037; }
        .banner-sub     { margin: 0 0 8px; font-size: 12px; color: #8d6e63; }
        .banner-meta    {
          display: flex; flex-wrap: wrap; gap: 8px 16px;
          font-size: 12px; color: #5d4037;
          background: #ffecb3; padding: 8px 12px;
          border-radius: 6px; align-items: center;
        }

        .mla-eligibility-card {
          background: #e8f5e9; padding: 16px;
          border-radius: 10px; margin-bottom: 20px;
          border: 2px solid #4caf50;
        }
        .mla-eligibility-header {
          display: flex; justify-content: space-between;
          align-items: center; margin-bottom: 14px;
          flex-wrap: wrap; gap: 8px;
        }
        .mla-eligibility-header h3 {
          margin: 0; color: #2e7d32; font-size: 15px;
          display: flex; align-items: center; gap: 8px;
        }
        .mla-refresh-btn {
          background: none; border: 1px solid #4caf50; color: #2e7d32;
          border-radius: 6px; padding: 5px 12px; cursor: pointer;
          font-size: 12px; font-weight: 600;
          display: inline-flex; align-items: center; gap: 5px;
        }
        .mla-eligibility-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
        }
        @media (min-width: 768px) {
          .mla-eligibility-grid { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
        }
        .elig-label {
          margin: 0 0 4px; font-size: 12px; color: #555;
          display: flex; align-items: center; gap: 4px;
        }
        .elig-value { margin: 0; font-size: 18px; font-weight: 700; }
        .elig-value.green { color: #2e7d32; }
        .elig-value.blue  { color: #1976d2; }

        .mla-empty {
          text-align: center; padding: 40px 20px;
          color: #666; font-size: 14px;
          background: white; border-radius: 10px;
          border: 1px solid #eee;
        }

        .mla-table-desktop { display: none; }
        @media (min-width: 900px) {
          .mla-table-desktop { display: block; }
          .loan-cards-mobile { display: none; }
        }

        .loan-cards-mobile { display: flex; flex-direction: column; gap: 12px; }
        .loan-card-mobile {
          background: white; border-radius: 10px;
          padding: 14px 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          border-left: 4px solid #1976d2;
        }
        .loan-card-mobile-header {
          display: flex; justify-content: space-between;
          align-items: flex-start; margin-bottom: 12px;
          gap: 8px; flex-wrap: wrap;
        }
        .loan-card-mobile-id { font-size: 15px; font-weight: 700; color: #1a1a2e; }
        .loan-card-mobile-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
        }
        @media (min-width: 480px) {
          .loan-card-mobile-grid { grid-template-columns: repeat(3, 1fr); }
        }
        .loan-card-mobile-field { display: flex; flex-direction: column; gap: 2px; }
        .lcm-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.04em; }
        .lcm-value { font-size: 13px; font-weight: 600; color: #1a1a2e; }

        .mob-badge {
          padding: 3px 8px; border-radius: 10px;
          font-size: 11px; font-weight: 700;
          display: inline-flex; align-items: center; gap: 3px;
        }
        .mob-badge.orange { background: #ff9800; color: white; }
        .mob-badge.green  { background: #4caf50; color: white; }
        .mob-badge.red    { background: #f44336; color: white; }

        .tag-topup {
          margin-left: 6px; padding: 2px 7px;
          background: #f3e5f5; color: #7b1fa2;
          border-radius: 10px; font-size: 11px; font-weight: 700;
          display: inline-flex; align-items: center; gap: 3px;
        }
        .tag-office {
          padding: 2px 8px; background: #ff9800; color: white;
          border-radius: 10px; font-size: 10px; font-weight: 700;
          display: inline-flex; align-items: center; gap: 3px;
          white-space: nowrap; flex-shrink: 0;
        }
        .tag-elig {
          padding: 2px 7px; border-radius: 8px;
          font-size: 10px; font-weight: 700;
          display: inline-flex; align-items: center; gap: 3px;
          white-space: nowrap; flex-shrink: 0;
        }
        .tag-yes { background: #d1fae5; color: #065f46; border: 1px solid #10b981; }
        .tag-no  { background: #fee2e2; color: #991b1b; border: 1px solid #ef4444; }

        /* ── Modal ── */
        .mla-modal {
          display: flex; flex-direction: column;
          max-height: 95vh; padding: 0 !important;
          border-radius: 16px 16px 0 0 !important;
          width: 100% !important; max-width: 100% !important;
          margin: 0 !important; position: fixed !important;
          bottom: 0 !important; left: 0 !important;
        }
        @media (min-width: 640px) {
          .mla-modal {
            position: relative !important; bottom: auto !important;
            left: auto !important; border-radius: 12px !important;
            max-width: 720px !important; width: 100% !important;
            max-height: 90vh;
          }
        }
        .modal-overlay { align-items: flex-end !important; }
        @media (min-width: 640px) { .modal-overlay { align-items: center !important; } }

        .mla-modal-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 18px 20px 14px; border-bottom: 1px solid #f0f0f0; flex-shrink: 0;
        }
        .mla-modal-header h2 { margin: 0; font-size: 17px; }
        .mla-modal-close {
          background: #f0f0f0; border: none; border-radius: 50%;
          width: 30px; height: 30px; display: flex; align-items: center;
          justify-content: center; cursor: pointer; flex-shrink: 0;
          color: #555;
        }
        .mla-modal-body {
          overflow-y: auto; flex: 1; padding: 16px 16px 24px;
          -webkit-overflow-scrolling: touch;
        }
        @media (min-width: 640px) { .mla-modal-body { padding: 20px 28px 28px; } }

        /* ══ GUARANTOR PICKER ══ */
        .guarantor-picker-wrapper { margin-top: 4px; }

        .guarantor-picker-header {
          display: flex; align-items: center;
          justify-content: space-between; gap: 8px;
          margin-bottom: 6px; flex-wrap: wrap;
        }
        .guarantor-picker-label {
          font-size: 13px; font-weight: 700; color: #1a1a2e;
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        }
        .guarantor-count-badge {
          display: inline-flex; align-items: center;
          padding: 2px 10px; border-radius: 12px;
          font-size: 12px; font-weight: 700;
          background: #e3f2fd; color: #1565c0;
          border: 1.5px solid #90caf9;
        }
        .guarantor-count-badge.complete {
          background: #e8f5e9; color: #2e7d32; border-color: #a5d6a7;
        }
        .guarantor-picker-hint {
          font-size: 11px; color: #888;
          display: flex; align-items: center; gap: 4px; white-space: nowrap;
        }

        /* Liability info banner */
        .guarantor-liability-info {
          display: flex; align-items: flex-start; gap: 8px;
          font-size: 12px; color: #1565c0;
          background: #e3f2fd; padding: 10px 12px;
          border-radius: 7px; margin-bottom: 8px;
          border: 1px solid #90caf9;
        }
        .guarantor-liability-info svg { flex-shrink: 0; margin-top: 2px; }
        .guarantor-liability-info-inner {
          display: flex; flex-direction: column; gap: 3px;
        }
        .guarantor-liability-main {
          font-weight: 700; color: #1565c0;
        }
        .guarantor-liability-formula {
          font-size: 11px; color: #1976d2; font-family: monospace;
          background: rgba(25,118,210,0.08); padding: 2px 6px;
          border-radius: 4px; width: fit-content;
        }
        .guarantor-liability-split {
          color: #555; font-size: 11px;
        }

        .guarantor-progress-track {
          width: 100%; height: 4px; background: #e0e0e0;
          border-radius: 4px; margin-bottom: 10px; overflow: hidden;
        }
        .guarantor-progress-fill {
          height: 100%; border-radius: 4px;
          transition: width 0.3s ease, background 0.3s ease;
        }

        .guarantor-filter-bar {
          display: grid; grid-template-columns: 1fr 1fr 1fr;
          gap: 6px; margin-bottom: 10px;
        }
        .guarantor-filter-btn {
          padding: 8px 6px; border-radius: 8px;
          font-size: 12px; font-weight: 600; cursor: pointer;
          border-width: 2px; border-style: solid;
          display: flex; align-items: center;
          justify-content: center; gap: 4px;
          transition: all 0.15s; white-space: nowrap;
          width: 100%; flex-direction: column; min-height: 52px;
        }
        @media (min-width: 400px) {
          .guarantor-filter-btn { flex-direction: row; min-height: auto; padding: 8px 10px; }
        }
        .filter-label-text { font-size: 11px; line-height: 1; }
        @media (min-width: 400px) { .filter-label-text { font-size: 12px; } }
        .filter-count-pill {
          border-radius: 10px; padding: 1px 6px;
          font-size: 10px; font-weight: 700;
          display: inline-flex; align-items: center;
          justify-content: center; line-height: 1.4;
        }

        .guarantor-loading {
          text-align: center; padding: 24px 16px; color: #888;
          display: flex; align-items: center;
          justify-content: center; gap: 8px; font-size: 13px;
        }

        .guarantor-list-scroll {
          max-height: 260px; overflow-y: auto;
          border: 1.5px solid #e0e0e0; border-radius: 10px;
          background: #fafafa; -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
        }
        @media (min-width: 640px) { .guarantor-list-scroll { max-height: 320px; } }

        .guarantor-item {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 12px; border-bottom: 1px solid #ececec;
          cursor: pointer; transition: background 0.12s;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }
        .guarantor-item:last-child { border-bottom: none; }
        .guarantor-item:active     { opacity: 0.85; }

        .guarantor-item.eligible           { background: #f0fdf4; }
        .guarantor-item.eligible:hover     { background: #dcfce7; }
        .guarantor-item.ineligible         { background: #fef2f2; opacity: 0.78; cursor: default; }
        .guarantor-item.selected.eligible  { background: #dcfce7; }

        .guarantor-item.office-guarantor          { background: #fff9c4; border-bottom: 1px solid #f0e57a; }
        .guarantor-item.office-guarantor:hover    { background: #fff3e0; }
        .guarantor-item.office-guarantor.selected { background: #ffe0b2; }

        .guarantor-checkbox-wrap { display: flex; align-items: center; flex-shrink: 0; padding-top: 1px; }
        .guarantor-checkbox-wrap input[type="checkbox"] {
          width: 18px; height: 18px; cursor: pointer; accent-color: #1976d2; flex-shrink: 0;
        }

        .guarantor-avatar {
          width: 34px; height: 34px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; flex-shrink: 0; text-transform: uppercase;
        }
        .guarantor-avatar.elig  { background: #bbf7d0; color: #065f46; }
        .guarantor-avatar.inelig { background: #fecaca; color: #7f1d1d; }

        .guarantor-item-info {
          flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px;
        }
        .guarantor-item-top {
          display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
        }
        .guarantor-item-name {
          font-weight: 700; font-size: 13px; color: #1a1a2e;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          max-width: 140px;
        }
        @media (min-width: 380px) { .guarantor-item-name { max-width: 180px; } }
        @media (min-width: 480px) { .guarantor-item-name { max-width: none; white-space: normal; } }

        .guarantor-item-sub { font-size: 11px; color: #888; }

        .guarantor-item-meta {
          display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
        }
        .guarantee-usage-bar { display: flex; gap: 3px; align-items: center; }
        .guarantee-usage-pip {
          width: 10px; height: 10px; border-radius: 50%;
          background: #e0e0e0; transition: background 0.2s;
        }
        .guarantee-usage-pip.filled       { background: #4caf50; }
        .guarantee-usage-pip.filled.maxed { background: #f44336; }

        .guarantor-ineligible-reason {
          display: flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: 600; color: #991b1b;
          background: #fee2e2; padding: 4px 8px; border-radius: 6px;
          margin-top: 2px; width: fit-content; max-width: 100%;
        }

        /* Savings info for eligible guarantors */
        .guarantor-savings-info {
          font-size: 11px; color: #666; margin-top: 2px;
        }

        .guarantor-warning {
          color: #c62828; font-size: 13px; background: #ffebee;
          padding: 10px 14px; border-radius: 6px;
          display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
        }

        .guarantor-selected-summary {
          display: flex; align-items: center; flex-wrap: wrap;
          gap: 6px; margin-top: 8px; padding: 8px 10px;
          background: #f0fdf4; border: 1.5px solid #a5d6a7; border-radius: 8px;
        }
        .guarantor-selected-label { font-size: 11px; font-weight: 700; color: #2e7d32; white-space: nowrap; }
        .guarantor-chip {
          display: inline-flex; align-items: center; gap: 4px;
          background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7;
          border-radius: 12px; padding: 3px 8px 3px 10px;
          font-size: 12px; font-weight: 600;
        }
        .guarantor-chip-remove {
          background: none; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          padding: 2px; border-radius: 50%; color: #065f46;
        }

        /* ── Loan Summary ── */
        .loan-summary-box {
          background: #e3f2fd; padding: 14px;
          border-radius: 10px; margin-bottom: 18px;
          border: 2px solid #1976d2;
        }
        .loan-summary-title {
          margin: 0 0 12px; color: #1565c0;
          font-size: 14px; display: flex; align-items: center; gap: 8px;
        }
        .loan-summary-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 10px; font-size: 13px; margin-bottom: 12px;
        }
        .sum-label { margin: 0 0 2px; color: #666; font-size: 11px; }
        .sum-value { margin: 0; font-weight: 700; font-size: 13px; }

        .loan-summary-amounts { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
        @media (min-width: 480px) { .loan-summary-amounts { flex-direction: row; } }

        .amount-box { flex: 1; border-radius: 8px; padding: 12px; border: 2px solid; }
        .amount-box.blue  { background: #e3f2fd; border-color: #1976d2; }
        .amount-box.green { background: #e8f5e9; border-color: #4caf50; }
        .amount-box-label {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.05em; display: flex; align-items: center; gap: 5px;
        }
        .amount-box.blue .amount-box-label  { color: #1565c0; }
        .amount-box.green .amount-box-label { color: #2e7d32; }
        .amount-box-value { font-size: 20px; font-weight: 800; margin-top: 2px; }
        .amount-box.blue .amount-box-value  { color: #1565c0; }
        .amount-box.green .amount-box-value { color: #2e7d32; }
        .amount-box-sub { font-size: 11px; color: #777; margin-top: 2px; }

        .loan-summary-disburse {
          margin-top: 12px; padding: 14px; background: #e8f5e9;
          border-radius: 8px; border: 2px solid #4caf50;
          display: flex; justify-content: space-between;
          align-items: center; flex-wrap: wrap; gap: 12px;
        }
        .amount-disburse-value { margin: 4px 0 0; font-size: 22px; font-weight: 800; color: #2e7d32; }
        .amount-balance-value  { margin: 4px 0 0; font-size: 18px; font-weight: 700; color: #1565c0; }

        .loan-summary-guarantors {
          margin-top: 10px; display: flex; align-items: flex-start; gap: 6px;
          font-size: 12px; color: #888; padding-top: 10px;
          border-top: 1px dashed #90caf9;
        }

        /* ── Top-up ── */
        .topup-current-loan {
          background: #e3f2fd; padding: 14px; border-radius: 8px;
          margin-bottom: 18px; border: 2px solid #1976d2;
        }
        .topup-current-loan h4 {
          margin: 0 0 10px; color: #1565c0; font-size: 14px;
          display: flex; align-items: center; gap: 6px;
        }
        .topup-current-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 8px; font-size: 13px;
        }
        .tcg-label { color: #666; }
        .topup-breakdown { margin-top: 10px; border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden; }
        .tbd-header {
          background: #f9fafb; padding: 7px 14px;
          font-size: 11px; font-weight: 700; color: #374151; text-transform: uppercase;
        }
        .tbd-body { padding: 10px 14px; display: flex; flex-direction: column; gap: 6px; font-size: 12px; }
        .tbd-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .tbd-row.orange { color: #e65100; }
        .tbd-row.amber  { color: #f57f17; }
        .tbd-row.blue   { color: #1565c0; }
        .tbd-row.green  { color: #2e7d32; font-weight: 700; }
        .tbd-row.muted  { color: #888; }
        .total-row { border-top: 2px solid #1976d2; padding-top: 6px; font-weight: 700; }
        .cash-row  { border-top: 1px dashed #e5e7eb; padding-top: 6px; }
        .topup-error-hint {
          margin-top: 8px; padding: 8px 12px; background: #ffebee;
          border-radius: 6px; font-size: 12px; color: #c62828;
          display: flex; align-items: center; gap: 6px;
        }

        /* ── Modal actions ── */
        .modal-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
        @media (min-width: 480px) { .modal-actions { flex-direction: row; justify-content: flex-end; } }
        .modal-actions .btn-primary,
        .modal-actions .btn-secondary { width: 100%; }
        @media (min-width: 480px) {
          .modal-actions .btn-primary,
          .modal-actions .btn-secondary { width: auto; }
        }
      `}</style>
    </>
  );
};

export default MemberLoanApplication;