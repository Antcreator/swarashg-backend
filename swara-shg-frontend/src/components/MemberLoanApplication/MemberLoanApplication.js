import React, { useState, useEffect } from 'react';
import { loansAPI, membersAPI } from '../../Service/Api';
import { useToast, useConfirm, ToastContainer } from '../../useToast';
import {
  FileText, Banknote, RefreshCw, AlertTriangle, CheckCircle,
  ChevronDown, ChevronUp, Users, Building2, Lock,
  UserCheck, Search, X, CreditCard, TrendingUp, Calculator,
} from 'lucide-react';

const TRANSACTION_FEE = 108;
const LOAN_TIERS = [
  { minAmount: 0,      maxAmount: 19999,    name: 'Tier 1', durations: [{ months: 1, interestRate: 7 }] },
  { minAmount: 20000,  maxAmount: 49999,    name: 'Tier 2', durations: [{ months: 1, interestRate: 7 }, { months: 2, interestRate: 8.5 }] },
  { minAmount: 50000,  maxAmount: 79999,    name: 'Tier 3', durations: [{ months: 1, interestRate: 7 }, { months: 2, interestRate: 8.5 }, { months: 3, interestRate: 10 }] },
  { minAmount: 80000,  maxAmount: 99999,    name: 'Tier 4', durations: [{ months: 1, interestRate: 7 }, { months: 2, interestRate: 8.5 }, { months: 3, interestRate: 10 }, { months: 4, interestRate: 11.5 }] },
  { minAmount: 100000, maxAmount: Infinity, name: 'Tier 5', durations: [{ months: 1, interestRate: 7 }, { months: 2, interestRate: 8.5 }, { months: 3, interestRate: 10 }, { months: 4, interestRate: 11.5 }, { months: 5, interestRate: 13 }] },
];

const getLoanTier = (amount) =>
  LOAN_TIERS.find(t => Number(amount) >= t.minAmount && Number(amount) <= t.maxAmount);

const MyLoans = ({ memberId, year }) => {
  const { toasts, toast, dismiss } = useToast();
  const { ConfirmDialog } = useConfirm();

  const [loans, setLoans]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [expanded, setExpanded]         = useState(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [eligibility, setEligibility]   = useState(null);
  const [maxLoan, setMaxLoan]           = useState(0);

  // ── Apply form ──────────────────────────────────────────────────
  const [applyStep, setApplyStep]             = useState(1);
  const [applyAmount, setApplyAmount]         = useState('');
  const [applyDuration, setApplyDuration]     = useState('');
  const [applyGuarantors, setApplyGuarantors] = useState([]);
  const [applySearch, setApplySearch]         = useState('');
  const [applySubmitting, setApplySubmitting] = useState(false);

  // ── Top-up form ─────────────────────────────────────────────────
  const [topUpAmount, setTopUpAmount]         = useState('');
  const [topUpDuration, setTopUpDuration]     = useState('');
  const [topUpGuarantors, setTopUpGuarantors] = useState([]);
  const [topUpSearch, setTopUpSearch]         = useState('');
  const [topUpSubmitting, setTopUpSubmitting] = useState(false);

  // ── Members + mutual conflict ────────────────────────────────────
  const [allMembers, setAllMembers]     = useState([]);
  const [conflictedIds, setConflictedIds] = useState([]); // IDs blocked due to mutual guarantee
  const [conflictMap, setConflictMap]   = useState({});   // id → reason string

  const fmt = (v) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(v || 0);
  const fd  = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  useEffect(() => {
    fetchLoans();
    fetchEligibility();
    fetchMembersAndConflicts();
  }, [memberId]); // eslint-disable-line

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const res = await loansAPI.getAll({ memberId });
      setLoans(res.data.loans || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const fetchEligibility = async () => {
    try {
      const [eligRes, maxRes] = await Promise.all([
        loansAPI.checkEligibility(memberId),
        loansAPI.getMaxLoan(memberId),
      ]);
      setEligibility(eligRes.data);
      setMaxLoan(maxRes.data.maxLoan || 0);
    } catch { /* silent */ }
  };

  // Fetch members list + which members this applicant CANNOT select as guarantors
  // (because they are already being guaranteed by this member — mutual conflict)
  const fetchMembersAndConflicts = async () => {
    try {
      const [membersRes, conflictRes] = await Promise.all([
        membersAPI.getAll(),
        loansAPI.getMutualGuarantorConflicts(memberId),
      ]);
      const members = (membersRes.data.members || [])
        .filter(m => m.id !== parseInt(memberId) && m.isActive);
      setAllMembers(members);

      const conflicts = conflictRes.data.conflicts || [];
      const ids       = (conflictRes.data.conflictedMemberIds || []).map(Number);
      setConflictedIds(ids);
      const map = {};
      conflicts.forEach(c => { map[Number(c.memberId)] = c.reason; });
      setConflictMap(map);
    } catch { /* silent */ }
  };

  // ── Guarantor helpers ────────────────────────────────────────────
  const isConflicted = (id) => conflictedIds.includes(Number(id));

  const toggleGuarantor = (list, setList, id, required) => {
    // Block mutual guarantee: if this member is already being guaranteed by the applicant
    if (isConflicted(id)) {
      toast.warning(
        'Mutual Guarantee Not Allowed',
        conflictMap[id] || 'You are already guaranteeing this member\'s loan. They cannot guarantee yours.'
      );
      return;
    }
    if (list.includes(id)) {
      setList(list.filter(g => g !== id));
    } else {
      if (list.length >= required) {
        toast.warning('Limit Reached', `You can only select ${required} guarantors for this loan.`);
        return;
      }
      setList([...list, id]);
    }
  };

  const toggleOffice = (list, setList, required) => {
    const OFFICE = -1;
    if (list.includes(OFFICE)) {
      setList(list.filter(g => g !== OFFICE));
    } else {
      if (list.length >= required) {
        toast.warning('Limit Reached', `Max ${required} guarantors.`);
        return;
      }
      setList([...list, OFFICE]);
    }
  };

  // ── Apply computed values ────────────────────────────────────────
  const applyTier              = getLoanTier(applyAmount);
  const applyRequiredGuarantors = Number(applyAmount) < 80000 ? 3 : 5;
  const applySelectedDuration  = applyTier?.durations.find(d => d.months === Number(applyDuration));
  const applyInterest          = Math.round(Number(applyAmount) * (applySelectedDuration?.interestRate || 0) / 100);
  const applyRepayment         = Number(applyAmount) + applyInterest + (applySelectedDuration ? TRANSACTION_FEE : 0);

  const handleApplySubmit = async () => {
    try {
      setApplySubmitting(true);
      const res = await loansAPI.apply({
        memberId,
        amount:         Number(applyAmount),
        durationMonths: Number(applyDuration),
        guarantorIds:   applyGuarantors,
      });
      toast.success('Applied!', res.data.message || 'Loan application submitted.');
      setShowApplyModal(false);
      setApplyStep(1); setApplyAmount(''); setApplyDuration('');
      setApplyGuarantors([]); setApplySearch('');
      fetchLoans(); fetchEligibility();
    } catch (err) {
      toast.error('Failed', err.response?.data?.message || 'Failed to submit application.');
    } finally { setApplySubmitting(false); }
  };

  // ── Top-up computed values ───────────────────────────────────────
  const activeLoan            = loans.find(l => l.approvalStatus === 'approved' && (l.status === 'active' || l.status === 'arrears'));
  const topUpTier             = getLoanTier(topUpAmount);
  const topUpRequired         = Number(topUpAmount) < 80000 ? 3 : 5;
  const topUpSelectedDuration = topUpTier?.durations.find(d => d.months === Number(topUpDuration));
  const topUpInterest         = Math.round(Number(topUpAmount) * (topUpSelectedDuration?.interestRate || 0) / 100);
  const topUpRepayment        = Number(topUpAmount) + topUpInterest + (topUpSelectedDuration ? TRANSACTION_FEE : 0);
  const topUpDisburse         = Math.max(0, Number(topUpAmount) - Number(activeLoan?.remainingBalance || 0));

  const handleTopUpSubmit = async () => {
    try {
      setTopUpSubmitting(true);
      const res = await loansAPI.requestTopUp({
        memberId,
        topUpAmount:    Number(topUpAmount),
        durationMonths: Number(topUpDuration),
        guarantorIds:   topUpGuarantors,
      });
      toast.success('Top-Up Requested!', res.data.message || 'Top-up submitted successfully.');
      setShowTopUpModal(false);
      setTopUpAmount(''); setTopUpDuration(''); setTopUpGuarantors([]); setTopUpSearch('');
      fetchLoans();
    } catch (err) {
      toast.error('Failed', err.response?.data?.message || 'Failed to submit top-up.');
    } finally { setTopUpSubmitting(false); }
  };

  // ── Loan status style ────────────────────────────────────────────
  const loanStatusCfg = (loan) => {
    if (loan.approvalStatus === 'rejected') return { bg: '#ffebee', color: '#c62828', label: 'Rejected'  };
    if (loan.approvalStatus === 'pending')  return { bg: '#fff3e0', color: '#e65100', label: 'Pending'   };
    const map = {
      active:    { bg: '#e3f2fd', color: '#1565c0', label: 'Active'    },
      arrears:   { bg: '#fff8e1', color: '#e65100', label: 'Arrears'   },
      default:   { bg: '#ffebee', color: '#c62828', label: 'Default'   },
      paid:      { bg: '#e8f5e9', color: '#2e7d32', label: 'Paid'      },
      topped_up: { bg: '#f3e5f5', color: '#7b1fa2', label: 'Topped Up' },
    };
    return map[loan.status] || { bg: '#f5f5f5', color: '#777', label: loan.status };
  };

  // ── Shared GuarantorList ─────────────────────────────────────────
  const GuarantorList = ({ list, setList, required, search, setSearch }) => {
    const filtered  = allMembers.filter(m =>
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(search.toLowerCase())
    );
    const remaining = required - list.length;

    return (
      <div>
        {/* Count pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a2e' }}>
            {list.length}/{required} selected
          </span>
          {remaining > 0
            ? <span style={{ fontSize: '12px', color: '#e65100', fontWeight: 600 }}>· {remaining} more needed</span>
            : <span style={{ fontSize: '12px', color: '#2e7d32', fontWeight: 700 }}>· ✓ Ready</span>}
        </div>

        {/* Mutual conflict notice */}
        {conflictedIds.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#fff8e1', border: '1px solid #ffc107',
            borderRadius: '8px', padding: '8px 12px',
            marginBottom: '10px', fontSize: '12px', color: '#e65100',
          }}>
            <Lock size={12} />
            <span>
              <strong>{conflictedIds.length} member{conflictedIds.length > 1 ? 's' : ''}</strong>
              {' '}unavailable — you are already guaranteeing their loan{conflictedIds.length > 1 ? 's' : ''}.
            </span>
          </div>
        )}

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f5f5f5', borderRadius: '8px', padding: '8px 12px', marginBottom: '10px' }}>
          <Search size={13} color="#888" />
          <input
            style={{ border: 'none', background: 'transparent', fontSize: '13px', outline: 'none', flex: 1 }}
            placeholder="Search members…" value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <X size={12} color="#888" />
            </button>
          )}
        </div>

        {/* Office guarantor */}
        <div
          onClick={() => toggleOffice(list, setList, required)}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 12px', borderRadius: '8px', marginBottom: '6px',
            cursor: 'pointer',
            background: list.includes(-1) ? '#e3f2fd' : '#f5f5f5',
            border: `1px solid ${list.includes(-1) ? '#1565c0' : '#e0e0e0'}`,
          }}
        >
          <span style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#1565c0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Building2 size={16} color="white" />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a2e' }}>The Office (Admin)</div>
            <div style={{ fontSize: '11px', color: '#888' }}>Unlimited capacity · Admin approval required</div>
          </div>
          {list.includes(-1) && <UserCheck size={16} color="#2e7d32" />}
        </div>

        {/* Member list */}
        <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
          {filtered.map(m => {
            const selected   = list.includes(m.id);
            const conflicted = isConflicted(m.id);
            const maxed      = !selected && list.length >= required;

            return (
              <div
                key={m.id}
                onClick={() => toggleGuarantor(list, setList, m.id, required)}
                title={conflicted ? (conflictMap[m.id] || 'Mutual guarantee conflict — cannot select') : ''}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 12px', borderRadius: '8px', marginBottom: '5px',
                  cursor: conflicted ? 'not-allowed' : maxed ? 'default' : 'pointer',
                  background: conflicted
                    ? '#fff5f5'
                    : selected
                      ? '#e8f5e9'
                      : maxed ? '#fafafa' : '#f9f9f9',
                  border: `1px solid ${
                    conflicted ? '#ffcdd2'
                    : selected ? '#a5d6a7'
                    : '#e0e0e0'
                  }`,
                  opacity: conflicted ? 0.6 : maxed ? 0.5 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {/* Avatar */}
                <span style={{
                  width: '34px', height: '34px', borderRadius: '50%',
                  background: conflicted ? '#ffcdd2' : selected ? '#2e7d32' : '#1565c0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 700, color: 'white', flexShrink: 0,
                }}>
                  {m.firstName?.[0]}{m.lastName?.[0]}
                </span>

                {/* Name + phone */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '13px', fontWeight: 700,
                    color: conflicted ? '#c62828' : '#1a1a2e',
                    textDecoration: conflicted ? 'line-through' : 'none',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {m.firstName} {m.lastName}
                  </div>
                  <div style={{ fontSize: '11px', color: '#888' }}>{m.phone || ''}</div>
                </div>

                {/* Right badge */}
                {conflicted ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                    fontSize: '10px', fontWeight: 700, color: '#c62828',
                    background: '#ffebee', border: '1px solid #ef9a9a',
                    borderRadius: '10px', padding: '2px 7px', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    <Lock size={9} /> You guarantee them
                  </span>
                ) : selected ? (
                  <UserCheck size={16} color="#2e7d32" style={{ flexShrink: 0 }} />
                ) : maxed ? (
                  <span style={{ fontSize: '10px', color: '#aaa', flexShrink: 0 }}>Limit</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Modal shared styles ─────────────────────────────────────────
  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' };
  const modal   = { background: 'white', borderRadius: '16px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' };
  const mHead   = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 0' };
  const mBody   = { padding: '16px 20px 20px' };
  const mTitle  = { margin: 0, fontSize: '18px', fontWeight: 800, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' };
  const fmtGrp  = { marginBottom: '14px' };
  const fmtLbl  = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' };
  const fmtInp  = { width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' };
  const actRow  = { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #f0f0f0' };
  const btnSec  = { padding: '9px 18px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' };
  const btnPri  = { padding: '9px 18px', background: '#1565c0', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '13px' };

  const SummaryBox = ({ rows }) => (
    <div style={{ background: '#f8f9fa', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px' }}>
      {rows.map(([l, v, bold]) => (
        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #eee', fontSize: '13px' }}>
          <span style={{ color: '#555' }}>{l}</span>
          <strong style={{ color: bold || '#1a1a2e' }}>{v}</strong>
        </div>
      ))}
    </div>
  );

  const StepIndicator = ({ current, labels }) => (
    <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', padding: '0 20px' }}>
      {labels.map((l, i) => (
        <div key={i} style={{ flex: 1, textAlign: 'center' }}>
          <div style={{
            width: '26px', height: '26px', borderRadius: '50%', margin: '0 auto 4px',
            background: current > i + 1 ? '#2e7d32' : current === i + 1 ? '#1565c0' : '#e0e0e0',
            color: current >= i + 1 ? 'white' : '#999',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 700,
          }}>
            {current > i + 1 ? <CheckCircle size={13} /> : i + 1}
          </div>
          <div style={{ fontSize: '10px', color: current === i + 1 ? '#1565c0' : '#aaa', fontWeight: current === i + 1 ? 700 : 400 }}>{l}</div>
        </div>
      ))}
    </div>
  );

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '30px', color: '#888', fontSize: '14px' }}>
      Loading loans…
    </div>
  );

  return (
    <>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <ConfirmDialog />

      <div style={{ width: '100%' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={16} /> My Loans
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            {eligibility?.canApply && (
              <button onClick={() => { setShowApplyModal(true); setApplyStep(1); }}
                style={{ padding: '7px 14px', background: '#1565c0', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Banknote size={13} /> Apply
              </button>
            )}
            {eligibility?.hasActiveLoan && eligibility?.canTopUp && (
              <button onClick={() => setShowTopUpModal(true)}
                style={{ padding: '7px 14px', background: '#7b1fa2', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <TrendingUp size={13} /> Top-Up
              </button>
            )}
          </div>
        </div>

        {/* Loans */}
        {loans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px', color: '#bbb', background: '#f9f9f9', borderRadius: '10px' }}>
            <FileText size={28} style={{ marginBottom: '8px' }} />
            <div style={{ fontSize: '13px' }}>No loans yet</div>
          </div>
        ) : loans.map(loan => {
          const st   = loanStatusCfg(loan);
          const open = expanded === loan.id;
          return (
            <div key={loan.id} style={{ border: '1px solid #e0e0e0', borderRadius: '10px', marginBottom: '10px', overflow: 'hidden' }}>

              {/* Card header */}
              <div
                onClick={() => setExpanded(open ? null : loan.id)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', cursor: 'pointer', background: open ? '#f8f9fa' : 'white' }}
              >
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#1a1a2e' }}>{fmt(loan.amount)}</div>
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                    {loan.durationMonths} mo · {loan.interestRate}% · #{loan.id}
                    {loan.loanType === 'top_up' && <span style={{ marginLeft: '6px', background: '#f3e5f5', color: '#7b1fa2', padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 700 }}>Top-Up</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                  {open ? <ChevronUp size={15} color="#888" /> : <ChevronDown size={15} color="#888" />}
                </div>
              </div>

              {/* Card body */}
              {open && (
                <div style={{ padding: '14px', borderTop: '1px solid #f0f0f0' }}>

                  {loan.approvalStatus === 'rejected' && loan.rejectionReason && (
                    <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '12px', color: '#c62828', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: '1px' }} />
                      <span><strong>Rejected:</strong> {loan.rejectionReason}</span>
                    </div>
                  )}

                  {/* Details grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                    {[
                      ['Principal',    fmt(loan.amount)],
                      ['Interest',     `${loan.interestRate}%`],
                      ['Tx Fee',       fmt(TRANSACTION_FEE)],
                      ['Total',        fmt(loan.totalRepayment)],
                      ...(loan.approvalStatus === 'approved' ? [
                        ['Disbursed',  fd(loan.disbursementDate)],
                        ['Due Date',   fd(loan.dueDate)],
                        ['Paid',       fmt(loan.amountPaid)],
                        ['Balance',    fmt(loan.remainingBalance)],
                        ...(loan.penaltyInterest > 0 ? [['Penalty', fmt(loan.penaltyInterest)]] : []),
                      ] : [
                        ['Applied', fd(loan.createdAt)],
                      ]),
                    ].map(([l, v]) => (
                      <div key={l} style={{ background: '#f9f9f9', borderRadius: '8px', padding: '8px 10px' }}>
                        <div style={{ fontSize: '10px', color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>{l}</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a2e' }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Guarantors */}
                  {loan.guarantors?.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '11px', color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={11} /> Guarantors
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {loan.guarantors.map((g, i) => {
                          const name = g.guarantorId === -1 ? 'The Office' : g.guarantor ? `${g.guarantor.firstName} ${g.guarantor.lastName}` : `#${i+1}`;
                          const colors = { accepted: '#2e7d32', rejected: '#c62828', pending: '#e65100', admin_override: '#1565c0' };
                          const c = colors[g.approvalStatus] || '#777';
                          return (
                            <span key={i} style={{ padding: '3px 9px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: `${c}15`, color: c, border: `1px solid ${c}40` }}>
                              {name} · {g.approvalStatus}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Payments */}
                  {loan.payments?.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CreditCard size={11} /> Payments ({loan.payments.length})
                      </div>
                      {loan.payments.slice(0, 3).map((p, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f0f0f0', fontSize: '12px' }}>
                          <span style={{ color: '#555' }}>{fd(p.paymentDate)}</span>
                          <span style={{ color: '#888', textTransform: 'capitalize' }}>{p.paymentMethod || 'Cash'}</span>
                          <strong style={{ color: '#2e7d32' }}>{fmt(p.amount)}</strong>
                        </div>
                      ))}
                      {loan.payments.length > 3 && (
                        <div style={{ fontSize: '11px', color: '#888', marginTop: '4px', textAlign: 'center' }}>+{loan.payments.length - 3} more payments</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* APPLY MODAL                                                 */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {showApplyModal && (
        <div style={overlay} onClick={() => setShowApplyModal(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={mHead}>
              <h2 style={mTitle}><Calculator size={18} /> Apply for Loan</h2>
              <button onClick={() => setShowApplyModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><X size={20} color="#888" /></button>
            </div>

            <StepIndicator current={applyStep} labels={['Amount', 'Guarantors', 'Review']} />

            <div style={mBody}>
              {/* Step 1 */}
              {applyStep === 1 && (
                <>
                  <div style={fmtGrp}>
                    <label style={fmtLbl}>Loan Amount (KES)</label>
                    <input style={fmtInp} type="number" value={applyAmount} onChange={e => setApplyAmount(e.target.value)} placeholder={`Max: ${fmt(maxLoan)}`} />
                    {Number(applyAmount) > maxLoan && maxLoan > 0 && (
                      <div style={{ fontSize: '11px', color: '#c62828', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={11} /> Exceeds your max loan of {fmt(maxLoan)}
                      </div>
                    )}
                  </div>

                  {applyTier && (
                    <>
                      <div style={{ fontSize: '12px', color: '#7b1fa2', fontWeight: 700, background: '#f3e5f5', padding: '6px 10px', borderRadius: '6px', marginBottom: '12px' }}>
                        {applyTier.name} · {applyRequiredGuarantors} guarantors required
                      </div>
                      <div style={fmtGrp}>
                        <label style={fmtLbl}>Duration</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {applyTier.durations.map(d => (
                            <button key={d.months}
                              onClick={() => setApplyDuration(String(d.months))}
                              style={{ padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', border: `2px solid ${Number(applyDuration) === d.months ? '#1565c0' : '#ddd'}`, background: Number(applyDuration) === d.months ? '#e3f2fd' : 'white', color: Number(applyDuration) === d.months ? '#1565c0' : '#555' }}>
                              {d.months} mo · {d.interestRate}%
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {applySelectedDuration && (
                    <SummaryBox rows={[
                      ['Principal',       fmt(Number(applyAmount))],
                      ['Interest',        fmt(applyInterest)],
                      ['Transaction Fee', fmt(TRANSACTION_FEE)],
                      ['Total Repayment', fmt(applyRepayment), '#1565c0'],
                    ]} />
                  )}

                  <div style={actRow}>
                    <button style={btnSec} onClick={() => setShowApplyModal(false)}>Cancel</button>
                    <button style={{ ...btnPri, opacity: (!applySelectedDuration || Number(applyAmount) > maxLoan) ? 0.5 : 1 }}
                      disabled={!applySelectedDuration || Number(applyAmount) > maxLoan || Number(applyAmount) < 1}
                      onClick={() => setApplyStep(2)}>
                      Next: Guarantors →
                    </button>
                  </div>
                </>
              )}

              {/* Step 2 */}
              {applyStep === 2 && (
                <>
                  <GuarantorList
                    list={applyGuarantors} setList={setApplyGuarantors}
                    required={applyRequiredGuarantors}
                    search={applySearch} setSearch={setApplySearch}
                  />
                  <div style={actRow}>
                    <button style={btnSec} onClick={() => setApplyStep(1)}>← Back</button>
                    <button style={{ ...btnPri, opacity: applyGuarantors.length !== applyRequiredGuarantors ? 0.5 : 1 }}
                      disabled={applyGuarantors.length !== applyRequiredGuarantors}
                      onClick={() => setApplyStep(3)}>
                      Review →
                    </button>
                  </div>
                </>
              )}

              {/* Step 3 */}
              {applyStep === 3 && (
                <>
                  <SummaryBox rows={[
                    ['Principal',       fmt(Number(applyAmount))],
                    ['Interest Rate',   `${applySelectedDuration?.interestRate}%`],
                    ['Duration',        `${applyDuration} month(s)`],
                    ['Transaction Fee', fmt(TRANSACTION_FEE)],
                    ['Total Repayment', fmt(applyRepayment), '#1565c0'],
                  ]} />
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#555', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Users size={12} /> Guarantors
                    </div>
                    {applyGuarantors.map(gId => {
                      const m = gId === -1 ? { firstName: 'The', lastName: 'Office' } : allMembers.find(m => m.id === gId);
                      return (
                        <div key={gId} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f0f0f0', fontSize: '13px' }}>
                          <span>{m?.firstName} {m?.lastName}</span>
                          <span style={{ color: '#e65100', fontWeight: 600 }}>Awaiting response</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={actRow}>
                    <button style={btnSec} onClick={() => setApplyStep(2)}>← Back</button>
                    <button style={{ ...btnPri, background: '#2e7d32', opacity: applySubmitting ? 0.7 : 1 }}
                      disabled={applySubmitting} onClick={handleApplySubmit}>
                      {applySubmitting ? 'Submitting…' : 'Submit Application'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TOP-UP MODAL                                                */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {showTopUpModal && activeLoan && (
        <div style={overlay} onClick={() => setShowTopUpModal(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={mHead}>
              <h2 style={mTitle}><RefreshCw size={18} /> Top-Up Loan</h2>
              <button onClick={() => setShowTopUpModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><X size={20} color="#888" /></button>
            </div>

            <div style={{ ...mBody, paddingTop: '16px' }}>
              <div style={{ background: '#fff3e0', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#555' }}>Current balance:</span>
                <strong style={{ color: '#c62828' }}>{fmt(activeLoan.remainingBalance)}</strong>
              </div>

              <div style={fmtGrp}>
                <label style={fmtLbl}>New Total Amount (KES)</label>
                <input style={fmtInp} type="number" value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)} placeholder={`Min: more than ${fmt(activeLoan.remainingBalance)}`} />
                {Number(topUpAmount) > 0 && Number(topUpAmount) <= Number(activeLoan.remainingBalance) && (
                  <div style={{ fontSize: '11px', color: '#c62828', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={11} /> Must exceed current balance of {fmt(activeLoan.remainingBalance)}
                  </div>
                )}
              </div>

              {topUpTier && (
                <>
                  <div style={{ fontSize: '12px', color: '#7b1fa2', fontWeight: 700, background: '#f3e5f5', padding: '6px 10px', borderRadius: '6px', marginBottom: '12px' }}>
                    {topUpTier.name} · {topUpRequired} guarantors required
                  </div>
                  <div style={fmtGrp}>
                    <label style={fmtLbl}>Duration</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {topUpTier.durations.map(d => (
                        <button key={d.months}
                          onClick={() => setTopUpDuration(String(d.months))}
                          style={{ padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', border: `2px solid ${Number(topUpDuration) === d.months ? '#7b1fa2' : '#ddd'}`, background: Number(topUpDuration) === d.months ? '#f3e5f5' : 'white', color: Number(topUpDuration) === d.months ? '#7b1fa2' : '#555' }}>
                          {d.months} mo · {d.interestRate}%
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {topUpSelectedDuration && (
                <>
                  <SummaryBox rows={[
                    ['New Loan Amount',    fmt(Number(topUpAmount))],
                    ['Old Balance Cleared', `−${fmt(activeLoan.remainingBalance)}`, '#c62828'],
                    ['Cash to You',        fmt(topUpDisburse), '#2e7d32'],
                    ['Interest',           fmt(topUpInterest)],
                    ['Transaction Fee',    fmt(TRANSACTION_FEE)],
                    ['New Total Repayment', fmt(topUpRepayment), '#7b1fa2'],
                  ]} />

                  <GuarantorList
                    list={topUpGuarantors} setList={setTopUpGuarantors}
                    required={topUpRequired}
                    search={topUpSearch} setSearch={setTopUpSearch}
                  />

                  <div style={actRow}>
                    <button style={btnSec} onClick={() => setShowTopUpModal(false)}>Cancel</button>
                    <button
                      style={{ ...btnPri, background: '#7b1fa2', opacity: (topUpGuarantors.length !== topUpRequired || topUpSubmitting || Number(topUpAmount) <= Number(activeLoan.remainingBalance)) ? 0.5 : 1 }}
                      disabled={topUpGuarantors.length !== topUpRequired || topUpSubmitting || Number(topUpAmount) <= Number(activeLoan.remainingBalance)}
                      onClick={handleTopUpSubmit}>
                      {topUpSubmitting ? 'Submitting…' : 'Submit Top-Up'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MyLoans;