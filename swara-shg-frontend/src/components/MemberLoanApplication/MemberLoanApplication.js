import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw,
  CreditCard, TrendingUp, DollarSign, Users, ShieldCheck,
  ShieldOff, FileText, ArrowUpCircle, PlusCircle, Loader,
  Wallet, ReceiptText, Star, Info,
} from 'lucide-react';
import { loansAPI, membersAPI, guarantorsAPI } from '../../Service/Api';
import Navbar from '../Navbar/navbar';
import '../MembersManagementAdmin/Members.css';
import { useToast, useConfirm, ToastContainer } from '../../useToast';

const TRANSACTION_FEE = 108;

const Ico = ({ icon: Icon, size = 14, style = {} }) => (
  <Icon size={size} style={{ verticalAlign: 'middle', flexShrink: 0, ...style }} />
);

const MemberLoanApplication = () => {
  const user     = JSON.parse(localStorage.getItem('user') || '{}');
  const memberId = user.memberId;

  const { toasts, toast, dismiss } = useToast();
  const {  ConfirmDialog  } = useConfirm();

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
    hasPendingLoanInList ||
    (eligibility != null && eligibility.pendingLoan != null);
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

  // ── FIX: update requiredGuarantors immediately when amount changes ──
  useEffect(() => {
    const amt = effectiveAmount();
    if (amt >= 1000) {
      fetchDurationOptionsForAmount(amt);
      fetchEligibleGuarantors(amt);
      // Update guarantor count right away based on amount, before duration is chosen
      setLoanInfo(prev => ({
        ...prev,
        requiredGuarantors: amt < 80000 ? 3 : 5,
      }));
    } else {
      setAvailableDurations([]);
      setAllGuarantors([]);
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

  const fetchEligibleGuarantors = async (loanAmount) => {
    setLoadingEligibility(true);
    try {
      const res = await guarantorsAPI.getEligible({ loanAmount, excludeMemberId: memberId });
      setAllGuarantors(res.data.guarantors || []);
      setEligibleCount(res.data.eligibleCount || 0);
    } catch { setAllGuarantors([]); setEligibleCount(0); }
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
        myLoans.some(l => l.approvalStatus === 'pending') ||
        res.data.pendingLoan != null;
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
        guarantor.activeGuaranteeCount >= 3
          ? 'This member has reached the maximum of 3 active guarantees.'
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

  const handleSubmitNew = async (e) => {
    e.preventDefault();
    if (formData.guarantorIds.length < loanInfo.requiredGuarantors) {
      toast.warning(
        'Insufficient Guarantors',
        `You need ${loanInfo.requiredGuarantors} guarantors. You've selected ${formData.guarantorIds.length}.`
      );
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
      toast.warning(
        'Insufficient Guarantors',
        `You need ${loanInfo.requiredGuarantors} guarantors. You've selected ${formData.guarantorIds.length}.`
      );
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

  const fmt = (amount) => new Intl.NumberFormat('en-KE', {
    style: 'currency', currency: 'KES', minimumFractionDigits: 0,
  }).format(amount || 0);

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

  const GuarantorPicker = () => (
    <div className="form-group">
      <label>
        Select Guarantors *
        {loanInfo.requiredGuarantors > 0 &&
          ` (${formData.guarantorIds.length}/${loanInfo.requiredGuarantors} selected)`}
      </label>
      {allGuarantors.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', background: '#f5f5f5', padding: '10px', borderRadius: '8px', marginBottom: '12px' }}>
          {[
            { key: 'all',        label: `All (${allGuarantors.length})`,                        color: '#1976d2', Icon: Users       },
            { key: 'eligible',   label: `Eligible (${eligibleCount})`,                          color: '#4caf50', Icon: ShieldCheck },
            { key: 'ineligible', label: `Ineligible (${allGuarantors.length - eligibleCount})`, color: '#f44336', Icon: ShieldOff   },
          ].map(({ key, label, color, Icon }) => (
            <button key={key} type="button" onClick={() => setGuarantorFilter(key)} style={{
              flex: 1, padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              border: guarantorFilter === key ? `2px solid ${color}` : '1px solid #ddd',
              background: guarantorFilter === key ? color : 'white',
              color: guarantorFilter === key ? 'white' : '#333',
            }}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>
      )}
      {loadingEligibility && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Loader size={16} /> Loading guarantor eligibility...
        </div>
      )}
      {!loadingEligibility && effectiveAmount() >= 1000 && (
        <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid #ddd', padding: '12px', borderRadius: '6px', background: '#fafafa' }}>
          {officeGuarantor && (
            <label style={{ display: 'block', marginBottom: '12px', cursor: 'pointer', padding: '12px', background: formData.guarantorIds.includes(officeGuarantor.id) ? '#fff3e0' : '#fff9c4', borderRadius: '6px', border: formData.guarantorIds.includes(officeGuarantor.id) ? '3px solid #ff9800' : '2px solid #fbc02d' }}>
              <input type="checkbox" checked={formData.guarantorIds.includes(officeGuarantor.id)} onChange={() => toggleGuarantor({ id: officeGuarantor.id, isEligible: true })} style={{ marginRight: '8px' }} />
              <strong>{officeGuarantor.name}</strong>
              <span style={{ marginLeft: '8px', padding: '3px 10px', background: '#ff9800', color: 'white', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Star size={11} /> ADMIN – UNLIMITED
              </span>
            </label>
          )}
          {filteredGuarantors.map(g => (
            <div key={g.id} style={{ marginBottom: '10px', padding: '12px', borderRadius: '8px', border: g.isEligible ? '2px solid #86efac' : '2px solid #fca5a5', background: g.isEligible ? (formData.guarantorIds.includes(g.id) ? '#dcfce7' : '#f0fdf4') : '#fef2f2', opacity: g.isEligible ? 1 : 0.7 }}>
              <label style={{ cursor: g.isEligible ? 'pointer' : 'not-allowed', display: 'block' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input type="checkbox" checked={formData.guarantorIds.includes(g.id)} onChange={() => toggleGuarantor(g)} disabled={!g.isEligible} />
                  <strong>{g.firstName} {g.lastName}</strong>
                  <span style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: 4, background: g.isEligible ? '#d1fae5' : '#fee2e2', color: g.isEligible ? '#065f46' : '#991b1b', border: `1px solid ${g.isEligible ? '#10b981' : '#ef4444'}` }}>
                    {g.isEligible ? <><CheckCircle size={11} /> Eligible</> : <><XCircle size={11} /> Ineligible</>}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: '12px', color: g.activeGuaranteeCount >= 3 ? '#f44336' : '#666', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Users size={11} />{g.activeGuaranteeCount}/3 guarantees
                  </span>
                </div>
                {!g.isEligible && (
                  <div style={{ marginTop: '8px', marginLeft: '28px', padding: '6px 10px', background: '#fee2e2', borderRadius: '4px', border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={12} color="#991b1b" />
                    <span style={{ color: '#991b1b', fontSize: '11px', fontWeight: 'bold' }}>
                      {g.activeGuaranteeCount >= 3 ? 'Max guarantees reached (3/3)' : 'Insufficient savings to guarantee this loan'}
                    </span>
                  </div>
                )}
              </label>
            </div>
          ))}
          {filteredGuarantors.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Users size={16} /> No {guarantorFilter === 'all' ? '' : guarantorFilter} guarantors found
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Navbar />
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <ConfirmDialog />

      <div className="admin-container">
        <div className="page-header">
          <h1>My Loan Applications</h1>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <button
              className="btn-primary"
              onClick={handleOpenModal}
              disabled={isButtonDisabled}
              title={hasPendingApplication ? 'You have a pending application. Wait for the admin to approve or reject it.' : ''}
              style={{
                padding: '10px 16px', fontSize: '13px',
                opacity:    isButtonDisabled ? 0.55 : 1,
                cursor:     isButtonDisabled ? 'not-allowed' : 'pointer',
                background: hasPendingApplication ? '#9e9e9e' : undefined,
                display: 'inline-flex', alignItems: 'center',
              }}
            >
              <ButtonIcon />
              {buttonLabel()}
            </button>
            {hasPendingApplication && (
              <span style={{ fontSize: '11px', color: '#e65100', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={11} /> Awaiting admin decision
              </span>
            )}
          </div>
        </div>

        {/* Status banners */}
        {eligibility && (hasPendingApplication || (!eligibility.canApply && eligibility.canTopUp)) && (
          <div style={{ padding: '16px 20px', borderRadius: '8px', marginBottom: '20px', background: hasPendingApplication ? '#fff8e1' : '#fff3e0', border: `2px solid ${hasPendingApplication ? '#ffc107' : '#ff9800'}` }}>
            {hasPendingApplication ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <Clock size={28} color="#e65100" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong style={{ color: '#e65100', fontSize: '15px' }}>
                    {eligibility.pendingLoan?.loanType === 'top_up' ? 'Top-Up Request Pending Review' : 'Loan Application Pending Review'}
                  </strong>
                  <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#5d4037' }}>{eligibility.message}</p>
                  <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#8d6e63' }}>
                    {eligibility.pendingLoan?.loanType === 'top_up'
                      ? 'You cannot request another top-up until an admin approves or rejects the current one.'
                      : 'You cannot apply for a new loan or request a top-up until an admin approves or rejects this application.'}
                  </p>
                  {eligibility.pendingLoan && (
                    <div style={{ marginTop: '10px', display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: '#5d4037', background: '#ffecb3', padding: '8px 12px', borderRadius: '6px', alignItems: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><FileText size={13} /> Loan #{eligibility.pendingLoan.id}</span>
                      <span>Amount: <strong>{fmt(eligibility.pendingLoan.amount)}</strong></span>
                      <span>{eligibility.pendingLoan.loanType === 'top_up' ? 'Top-Up Requested' : 'Applied'}: <strong>{new Date(eligibility.pendingLoan.appliedOn).toLocaleDateString()}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            ) : eligibility.canTopUp ? (
              <>
                <strong style={{ color: '#e65100', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CreditCard size={16} /> Active Loan Detected
                </strong>
                <p style={{ margin: '8px 0 0', fontSize: '14px' }}>
                  You have an active loan of <strong>{fmt(eligibility.activeLoan?.amount)}</strong> with a remaining balance of <strong>{fmt(eligibility.activeLoan?.remainingBalance)}</strong>. You can request a <strong>top-up</strong>.
                </p>
              </>
            ) : null}
          </div>
        )}

        {/* Eligibility card */}
        <div style={{ background: '#e8f5e9', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '2px solid #4caf50' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, color: '#2e7d32', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wallet size={20} /> Your Loan Eligibility
            </h3>
            <button type="button" onClick={fetchMemberSavings} style={{ background: 'none', border: '1px solid #4caf50', color: '#2e7d32', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <p style={{ margin: '4px 0', fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center', gap: 5 }}><DollarSign size={13} /> Total Savings</p>
              <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#2e7d32' }}>{fmt(loanInfo.memberSavings)}</p>
            </div>
            <div>
              <p style={{ margin: '4px 0', fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center', gap: 5 }}><TrendingUp size={13} /> Maximum Eligible Loan</p>
              <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#1976d2' }}>{fmt(loanInfo.maxLoan)}</p>
            </div>
            <div>
              <p style={{ margin: '4px 0', fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center', gap: 5 }}><ReceiptText size={13} /> Statutory Deduction</p>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: loanInfo.statutoryFee > 0 ? '#c62828' : '#aaa' }}>
                {loanInfo.statutoryFee > 0 ? `− ${fmt(loanInfo.statutoryFee)}` : 'None this year'}
              </p>
            </div>
            <div>
              <p style={{ margin: '4px 0', fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center', gap: 5 }}><ReceiptText size={13} /> Transaction Fee</p>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#f57f17' }}>
                {fmt(TRANSACTION_FEE)} <span style={{ fontSize: '12px', color: '#888', fontWeight: 400 }}>added to repayment</span>
              </p>
            </div>
            <div>
              <p style={{ margin: '4px 0', fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center', gap: 5 }}><Info size={13} /> Formula</p>
              <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>(Savings × 3) − Statutory Fee</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Loader size={16} /> Loading your loans...
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Loan Amount</th><th>Tx Fee</th><th>Cash to You</th><th>Interest</th>
                  <th>Duration</th><th>Total Repayment</th><th>Applied On</th>
                  <th>Approval Status</th><th>Loan Status</th><th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {myLoans.length === 0 ? (
                  <tr><td colSpan="10" style={{ textAlign: 'center', padding: '40px' }}>
                    No loan applications yet. Click "Apply for Loan" to get started!
                  </td></tr>
                ) : myLoans.map(loan => {
                  const txFee          = Number(loan.transactionFee ?? TRANSACTION_FEE);
                  const totalRepayment = Number(loan.totalRepayment);
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
                      <td>{fmt(totalRepayment)}</td>
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
        )}

        {/* ── NEW LOAN MODAL ── */}
        {modalMode === 'new' && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2>Apply for New Loan</h2>
              <form onSubmit={handleSubmitNew}>
                <div className="form-group">
                  <label>Loan Amount *</label>
                  <input type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required min="1000" max={loanInfo.maxLoan} placeholder={`Max: ${fmt(loanInfo.maxLoan)}`} />
                </div>
                {/* {loanInfo.tierInfo && formData.amount && (
                  <div style={{ background: '#fff3e0', padding: '14px', borderRadius: '8px', marginBottom: '16px', border: '2px solid #ff9800' }}>
                    <h4 style={{ margin: '0 0 8px', color: '#e65100' }}>{loanInfo.tierInfo.name}</h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>Range: {fmt(loanInfo.tierInfo.minAmount)} – {loanInfo.tierInfo.maxAmount === Infinity ? '∞' : fmt(loanInfo.tierInfo.maxAmount)}</p>
                  </div>
                )} */}
                <div className="form-group">
                  <label>Loan Duration *</label>
                  <select value={formData.durationMonths} onChange={e => setFormData({ ...formData, durationMonths: e.target.value })} required disabled={!formData.amount || availableDurations.length === 0}>
                    <option value="">{!formData.amount ? 'Enter amount first' : availableDurations.length === 0 ? 'Loading...' : 'Select Duration'}</option>
                    {availableDurations.map(d => <option key={d.months} value={d.months}>{d.months} month{d.months > 1 ? 's' : ''} @ {d.interestRate}%</option>)}
                  </select>
                </div>
                <LoanSummaryBox amt={Number(formData.amount)} />
                <GuarantorPicker />
                <ModalActions onClose={closeModal} disabled={!formData.amount || !formData.durationMonths || formData.guarantorIds.length < loanInfo.requiredGuarantors} />
              </form>
            </div>
          </div>
        )}

        {/* ── TOP-UP MODAL ── */}
        {modalMode === 'topup' && eligibility?.activeLoan && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2>Request Loan Top-Up</h2>
              <div style={{ background: '#e3f2fd', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '2px solid #1976d2' }}>
                <h4 style={{ margin: '0 0 10px', color: '#1565c0', display: 'flex', alignItems: 'center', gap: 6 }}><CreditCard size={16} /> Your Current Loan</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' }}>
                  <div><span style={{ color: '#666' }}>Original Amount:</span> <strong>{fmt(eligibility.activeLoan.amount)}</strong></div>
                  <div><span style={{ color: '#666' }}>Remaining Balance:</span> <strong style={{ color: '#f44336' }}>{fmt(eligibility.activeLoan.remainingBalance)}</strong></div>
                  <div><span style={{ color: '#666' }}>Amount Paid:</span> <strong style={{ color: '#4caf50' }}>{fmt(eligibility.activeLoan.amountPaid)}</strong></div>
                  <div><span style={{ color: '#666' }}>Due Date:</span> <strong>{eligibility.activeLoan.dueDate ? new Date(eligibility.activeLoan.dueDate).toLocaleDateString() : '—'}</strong></div>
                </div>
              </div>
              <form onSubmit={handleSubmitTopUp}>
                <div className="form-group">
                  <label>New Top-Up Loan Amount * (must exceed current balance of {fmt(eligibility.activeLoan.remainingBalance)})</label>
                  <input type="number" value={formData.topUpAmount} onChange={e => setFormData({ ...formData, topUpAmount: e.target.value })} required min={Math.ceil(Number(eligibility.activeLoan.remainingBalance)) + 1} placeholder={`Min: ${fmt(Number(eligibility.activeLoan.remainingBalance) + 1000)}`} />
                  {formData.topUpAmount && Number(formData.topUpAmount) > Number(eligibility.activeLoan.remainingBalance) && (
                    <div style={{ marginTop: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                      <div style={{ background: '#f9fafb', padding: '8px 14px', fontSize: '12px', fontWeight: 700, color: '#374151', textTransform: 'uppercase' }}>Breakdown</div>
                      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#666' }}>New Loan Amount (Principal):</span><strong>{fmt(formData.topUpAmount)}</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e65100' }}><span>+ Interest ({loanInfo.interestRate}%):</span><strong>+ {fmt(Number(formData.topUpAmount) * loanInfo.interestRate / 100)}</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f57f17' }}><span>+ Transaction Fee:</span><strong>+ {fmt(TRANSACTION_FEE)}</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #1976d2', paddingTop: '6px', fontWeight: 700, color: '#1565c0' }}><span>= New Loan Balance (Total Repayment):</span><strong style={{ fontSize: '15px' }}>{fmt(Number(formData.topUpAmount) + (Number(formData.topUpAmount) * loanInfo.interestRate / 100) + TRANSACTION_FEE)}</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e5e7eb', paddingTop: '6px', color: '#888' }}><span>Old Balance Cleared (on approval):</span><strong style={{ color: '#c62828' }}>− {fmt(eligibility.activeLoan.remainingBalance)}</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2e7d32', fontWeight: 700 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><DollarSign size={13} /> Cash You Receive:</span>
                          <strong style={{ fontSize: '15px' }}>{fmt(Math.max(0, Number(formData.topUpAmount) - Number(eligibility.activeLoan.remainingBalance)))}</strong>
                        </div>
                      </div>
                    </div>
                  )}
                  {formData.topUpAmount && Number(formData.topUpAmount) <= Number(eligibility.activeLoan.remainingBalance) && (
                    <div style={{ marginTop: '8px', padding: '10px', background: '#ffebee', borderRadius: '6px', fontSize: '13px', color: '#c62828', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={14} /> Amount must be greater than your current balance of {fmt(eligibility.activeLoan.remainingBalance)}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>New Loan Duration *</label>
                  <select value={formData.durationMonths} onChange={e => setFormData({ ...formData, durationMonths: e.target.value })} required disabled={!formData.topUpAmount || Number(formData.topUpAmount) <= Number(eligibility.activeLoan.remainingBalance) || availableDurations.length === 0}>
                    <option value="">{!formData.topUpAmount ? 'Enter amount first' : availableDurations.length === 0 ? 'Loading...' : 'Select Duration'}</option>
                    {availableDurations.map(d => <option key={d.months} value={d.months}>{d.months} month{d.months > 1 ? 's' : ''} @ {d.interestRate}%</option>)}
                  </select>
                </div>
                <LoanSummaryBox amt={effectiveAmount()} label="New Loan Amount" />
                <GuarantorPicker />
                <ModalActions onClose={closeModal} disabled={!formData.topUpAmount || Number(formData.topUpAmount) <= Number(eligibility.activeLoan.remainingBalance) || !formData.durationMonths || formData.guarantorIds.length < loanInfo.requiredGuarantors} submitLabel="Submit Top-Up Request" />
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );

  function LoanSummaryBox({ amt, label = 'Loan Amount' }) {
    if (!amt || !formData.durationMonths) return null;
    const fullRepayment = amt + (amt * loanInfo.interestRate / 100) + TRANSACTION_FEE;
    return (
      <div style={{ background: '#e3f2fd', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '2px solid #1976d2' }}>
        <h3 style={{ margin: '0 0 12px', color: '#1565c0', display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={18} /> Loan Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
          <div><p style={{ margin: '4px 0', color: '#666' }}>{label}:</p><p style={{ margin: '4px 0', fontWeight: 'bold' }}>{fmt(amt)}</p></div>
          <div><p style={{ margin: '4px 0', color: '#666' }}>Interest Rate:</p><p style={{ margin: '4px 0', fontWeight: 'bold' }}>{loanInfo.interestRate}%</p></div>
          <div><p style={{ margin: '4px 0', color: '#666' }}>Interest Amount:</p><p style={{ margin: '4px 0', fontWeight: 'bold' }}>{fmt(amt * loanInfo.interestRate / 100)}</p></div>
          <div><p style={{ margin: '4px 0', color: '#666' }}>Transaction Fee:</p><p style={{ margin: '4px 0', fontWeight: 'bold', color: '#f57f17' }}>+ {fmt(TRANSACTION_FEE)}</p></div>
        </div>
        {modalMode === 'topup' && eligibility?.activeLoan ? (
          <div style={{ marginTop: '14px' }}>
            <div style={{ background: '#e3f2fd', borderRadius: '8px', padding: '12px 14px', marginBottom: '8px', border: '2px solid #1976d2' }}>
              <div style={{ fontSize: '12px', color: '#1565c0', fontWeight: 600, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}><ReceiptText size={13} /> YOUR NEW LOAN BALANCE</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#1565c0', marginTop: '2px' }}>{fmt(fullRepayment)}</div>
              <div style={{ fontSize: '11px', color: '#777', marginTop: '2px' }}>Principal + {loanInfo.interestRate}% interest + {fmt(TRANSACTION_FEE)} fee</div>
            </div>
            <div style={{ background: '#e8f5e9', borderRadius: '8px', padding: '12px 14px', border: '2px solid #4caf50' }}>
              <div style={{ fontSize: '12px', color: '#2e7d32', fontWeight: 600, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}><DollarSign size={13} /> CASH YOU RECEIVE</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#2e7d32', marginTop: '2px' }}>{fmt(Math.max(0, amt - Number(eligibility.activeLoan.remainingBalance)))}</div>
              <div style={{ fontSize: '11px', color: '#777', marginTop: '2px' }}>After clearing old balance of {fmt(eligibility.activeLoan.remainingBalance)}</div>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: '14px', padding: '14px', background: '#e8f5e9', borderRadius: '8px', border: '2px solid #4caf50', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: '12px', color: '#555', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}><DollarSign size={13} /> YOU WILL RECEIVE</p>
              <p style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: 800, color: '#2e7d32' }}>{fmt(amt)}</p>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#777' }}>Full loan amount disbursed to you</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#555', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}><ReceiptText size={13} /> LOAN BALANCE</p>
              <p style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 700, color: '#1565c0' }}>{fmt(fullRepayment)}</p>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#777' }}>Principal + {loanInfo.interestRate}% interest + {fmt(TRANSACTION_FEE)} fee</p>
            </div>
          </div>
        )}
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Users size={13} color="#888" />
          <p style={{ margin: 0, fontSize: '12px', color: '#888' }}><strong>Guarantors Required:</strong> {loanInfo.requiredGuarantors}</p>
        </div>
      </div>
    );
  }

  function ModalActions({ onClose, disabled, submitLabel = 'Submit Application' }) {
    return (
      <>
        {loanInfo.requiredGuarantors > 0 && formData.guarantorIds.length < loanInfo.requiredGuarantors && (
          <p style={{ color: '#c62828', fontSize: '14px', background: '#ffebee', padding: '12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} /> You need {loanInfo.requiredGuarantors - formData.guarantorIds.length} more guarantor(s)
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={disabled}>{submitLabel}</button>
        </div>
      </>
    );
  }
};

export default MemberLoanApplication;