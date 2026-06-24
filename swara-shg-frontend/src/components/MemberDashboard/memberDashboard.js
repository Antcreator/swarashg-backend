import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { membersAPI, loansAPI, depositsAPI, statutoryAPI, savingsAPI, finesAPI, seedCapitalAPI } from '../../Service/Api';
import Navbar from '../Navbar/navbar';
import MyLoans from '../Member/MyLoans';
import DepositCard from './DepositCard';
import './memberDashboard.css';
import {
  Coins, ClipboardList, AlertTriangle, Sprout, Package,
  Handshake, FileText, Eye, EyeOff, Banknote,
} from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TRANSACTION_FEE = 108;
const ONE_SHARE_DIVISOR = 3;

// ── Eye toggle button ─────────────────────────────────────────────
const EyeToggleButton = ({ valuesHidden, onToggle }) => (
  <button
    onClick={onToggle}
    title={valuesHidden ? 'Show values' : 'Hide values'}
    aria-label={valuesHidden ? 'Show values' : 'Hide values'}
    className="eye-toggle-btn"
  >
    {valuesHidden ? <Eye size={16} /> : <EyeOff size={16} />}
    <span className="eye-toggle-label">{valuesHidden ? 'Show' : 'Hide'}</span>
  </button>
);

// ── Year badge ────────────────────────────────────────────────────
const YearBadge = () => (
  <span className="year-badge">{CURRENT_YEAR}</span>
);

// ── Arrears / Default Fine Banner ─────────────────────────────────
// Shown when the member has a loan in arrears or default.
// Uses pre-calculated values from fetchActiveLoan (real-time,
// same formula as loanController.js: 5% × principal × months).
const ArrearsBanner = ({ activeLoan }) => {
  if (!activeLoan) return null;
  if (activeLoan.status !== 'arrears' && activeLoan.status !== 'default') return null;

  // These are all pre-calculated in fetchActiveLoan
  const {
    baseLoanBalance = 0,
    overdueDays     = 0,
    overdueMonths   = 0,
    cappedMonths    = 0,
    monthlyPenalty  = 0,
    penaltyInterest = 0,
    totalDue        = 0,
  } = activeLoan;

  const amountPaid = Number(activeLoan.amountPaid || 0);

  const principal = Number(activeLoan.amount || 0);
  const isDefault = activeLoan.status === 'default';

  const fc = (v) => new Intl.NumberFormat('en-KE', {
    style: 'currency', currency: 'KES', minimumFractionDigits: 0,
  }).format(v || 0);

  return (
    <div style={{
      background:    isDefault ? '#ffebee' : '#fff8e1',
      border:        `2px solid ${isDefault ? '#f44336' : '#ff9800'}`,
      borderRadius:  '12px',
      padding:       '16px 20px',
      marginBottom:  '20px',
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px' }}>
        <span style={{ fontSize:'22px' }}>{isDefault ? '🚨' : '⚠️'}</span>
        <div>
          <strong style={{ fontSize:'15px', color: isDefault ? '#b71c1c' : '#e65100' }}>
            {isDefault ? 'Loan in Default' : 'Loan in Arrears'}
          </strong>
          <div style={{ fontSize:'12px', color:'#888', marginTop:'2px' }}>
            {overdueDays} day{overdueDays !== 1 ? 's' : ''} overdue
            {overdueMonths > 0 && ` · ${cappedMonths} month${cappedMonths !== 1 ? 's' : ''} penalty applied`}
          </div>
        </div>
      </div>

      {/* Breakdown grid */}
      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))',
        gap:'10px',
        marginBottom:'14px',
      }}>
        {/* Loan Balance */}
        <div style={{ background:'white', borderRadius:'8px', padding:'10px 12px', border:'1px solid #e0e0e0' }}>
          <div style={{ fontSize:'10px', color:'#888', fontWeight:600, textTransform:'uppercase', marginBottom:'4px' }}>
            Loan Balance
          </div>
          <div style={{ fontSize:'16px', fontWeight:800, color:'#1a1a2e' }}>
            {fc(baseLoanBalance)}
          </div>
          <div style={{ fontSize:'10px', color:'#aaa', marginTop:'2px' }}>
            Paid: {fc(amountPaid)}
          </div>
        </div>

        {/* Monthly Penalty */}
        <div style={{
          background:'white', borderRadius:'8px', padding:'10px 12px',
          border:`1px solid ${isDefault ? '#f44336' : '#ff9800'}`,
        }}>
          <div style={{ fontSize:'10px', color:'#888', fontWeight:600, textTransform:'uppercase', marginBottom:'4px' }}>
            Monthly Penalty
          </div>
          <div style={{ fontSize:'16px', fontWeight:800, color: isDefault ? '#b71c1c' : '#e65100' }}>
            {fc(monthlyPenalty)}
          </div>
          <div style={{ fontSize:'10px', color:'#aaa', marginTop:'2px' }}>
            5% of {fc(principal)}
          </div>
        </div>

        {/* Total Penalty */}
        <div style={{
          background:'white', borderRadius:'8px', padding:'10px 12px',
          border:`1px solid ${isDefault ? '#f44336' : '#ff9800'}`,
        }}>
          <div style={{ fontSize:'10px', color:'#888', fontWeight:600, textTransform:'uppercase', marginBottom:'4px' }}>
            Total Penalty
          </div>
          <div style={{ fontSize:'16px', fontWeight:800, color: isDefault ? '#b71c1c' : '#e65100' }}>
            {fc(penaltyInterest)}
          </div>
          <div style={{ fontSize:'10px', color:'#aaa', marginTop:'2px' }}>
            {fc(monthlyPenalty)} × {cappedMonths} month{cappedMonths !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Total Due */}
        <div style={{
          background: isDefault ? '#ffebee' : '#fff8e1',
          borderRadius:'8px', padding:'10px 12px',
          border:`2px solid ${isDefault ? '#f44336' : '#ff9800'}`,
        }}>
          <div style={{ fontSize:'10px', color:'#888', fontWeight:600, textTransform:'uppercase', marginBottom:'4px' }}>
            Total Amount Due
          </div>
          <div style={{ fontSize:'20px', fontWeight:900, color: isDefault ? '#b71c1c' : '#e65100' }}>
            {fc(totalDue)}
          </div>
          <div style={{ fontSize:'10px', color:'#aaa', marginTop:'2px' }}>
            {fc(baseLoanBalance)} + {fc(penaltyInterest)} penalty
          </div>
        </div>
      </div>

      {/* Warning message */}
      <p style={{
        margin:0, fontSize:'12px', fontWeight:600,
        color: isDefault ? '#b71c1c' : '#e65100',
        display:'flex', alignItems:'center', gap:'6px',
      }}>
        <AlertTriangle size={13} />
        {isDefault
          ? 'Your loan has defaulted. Please contact the admin immediately to resolve this.'
          : `Please clear your outstanding balance of ${fc(totalDue)} as soon as possible to avoid further penalties.`}
      </p>
    </div>
  );
};

const MemberDashboard = () => {
  const { id } = useParams();
  const [dashboardData, setDashboardData]             = useState(null);
  const [guaranteedLoansData, setGuaranteedLoansData] = useState([]);
  const [depositSummary, setDepositSummary]           = useState({ othersTotal: 0, seedCapitalTotal: 0 });
  const [memberSeedCapital, setMemberSeedCapital]     = useState(0);
  const [statutory, setStatutory]                     = useState({ statutoryFee: 0, guarantorDeduction: 0, other: 0 });

  // ── Active loan in arrears/default for the banner ─────────────
  const [activeLoan, setActiveLoan] = useState(null);

  // ── Eye toggle — persisted per member in localStorage ─────────
  const STORAGE_KEY = `valuesHidden_${id}`;
  const [valuesHidden, setValuesHidden] = useState(
    () => localStorage.getItem(STORAGE_KEY) === 'true'
  );

  const toggleValuesHidden = () => {
    setValuesHidden(prev => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  // ── Year-scoped values ────────────────────────────────────────
  const [yearlySavings, setYearlySavings] = useState(0);
  const [yearlyFines, setYearlyFines]     = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    fetchDashboardData();
    fetchGuaranteedLoans();
    fetchDepositTotals();
    fetchStatutory();
    fetchYearlySavings();
    fetchYearlyFines();
    fetchMemberSeedCapital();
    fetchActiveLoan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Fallback: derive yearly savings from dashboard data ────────
  useEffect(() => {
    if (yearlySavings === 0 && dashboardData?.savings?.length > 0) {
      const derived = dashboardData.savings
        .filter(s => s.year === CURRENT_YEAR && s.isPaid && Number(s.amount) > 0)
        .reduce((sum, s) => sum + Number(s.amount || 0), 0);
      if (derived > 0) setYearlySavings(derived);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardData]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await membersAPI.getDashboard(id);
      setDashboardData(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchGuaranteedLoans = async () => {
    try {
      const response = await loansAPI.getGuaranteedLoans(id);
      setGuaranteedLoansData(response.data.guaranteedLoans || []);
    } catch { setGuaranteedLoansData([]); }
  };

  const fetchDepositTotals = async () => {
    try {
      const res = await depositsAPI.getSummary(id);
      const deposits = res.data.deposits || [];
      const distributed = deposits.filter(d => d.depositStatus === 'distributed');
      setDepositSummary({
        othersTotal:      distributed.reduce((sum, d) => sum + Number(d.othersAmount    || 0), 0),
        seedCapitalTotal: distributed.reduce((sum, d) => sum + Number(d.seedCapitalAmount || 0), 0),
      });
    } catch { /* silent */ }
  };

  const fetchStatutory = async () => {
    try {
      const res    = await statutoryAPI.getAll(CURRENT_YEAR);
      const record = (res.data.members || []).find(m => String(m.id) === String(id));
      if (record) {
        setStatutory({
          statutoryFee:       Number(record.statutoryFee       || 0),
          guarantorDeduction: Number(record.guarantorDeduction || 0),
          other:              Number(record.other              || 0),
        });
      }
    } catch { /* silent */ }
  };

  const fetchMemberSeedCapital = async () => {
    try {
      const res = await seedCapitalAPI.getByMember(id);
      setMemberSeedCapital(Number(res.data?.totalSeedCapital || 0));
    } catch { /* silent */ }
  };

  const fetchYearlySavings = async () => {
    try {
      const res     = await savingsAPI.getAll({ memberId: id, year: CURRENT_YEAR });
      const records = res.data.savings || [];
      const total   = records
        .filter(s => s.isPaid && Number(s.amount) > 0)
        .reduce((sum, s) => sum + Number(s.amount || 0), 0);
      setYearlySavings(total);
    } catch (err) {
      console.error('Failed to fetch yearly savings:', err);
      setYearlySavings(0);
    }
  };

  const fetchYearlyFines = async () => {
    try {
      const res = await finesAPI.getAll({ memberId: id, isPaid: 'false', year: CURRENT_YEAR });
      setYearlyFines(res.data.fines || []);
    } catch (err) {
      console.error('Failed to fetch yearly fines:', err);
      setYearlyFines([]);
    }
  };

  // ── Fetch the member's active/arrears/default loan ─────────────
  // The loan data already includes dueDate, amount, amountPaid etc.
  // so we can calculate the real-time penalty here without a
  // separate API call — same formula as loanController.js and
  // Defaulters.jsx: 5% × principal × months overdue (capped at 3).
  const fetchActiveLoan = async () => {
    try {
      const res   = await loansAPI.getAll({ memberId: id });
      const loans = res.data.loans || [];

      // Find loan in arrears or default
      const overdueLoan = loans.find(l =>
        l.approvalStatus === 'approved' &&
        (l.status === 'arrears' || l.status === 'default')
      );

      if (overdueLoan) {
        // Enrich with real-time penalty calculation
        const principal    = Number(overdueLoan.amount || 0);
        const interestRate = Number(overdueLoan.interestRate || 0);
        const txFee        = Number(overdueLoan.transactionFee ?? TRANSACTION_FEE);
        const amountPaid   = Number(overdueLoan.amountPaid || 0);
        const totalRepayment  = Math.round(principal + (principal * interestRate / 100) + txFee);
        const baseLoanBalance = Math.max(0, totalRepayment - amountPaid);

        let overdueDays   = 0;
        let overdueMonths = 0;
        if (overdueLoan.dueDate) {
          const now     = new Date();
          const dueDate = new Date(overdueLoan.dueDate);
          const todayMs = Date.UTC(now.getFullYear(),     now.getMonth(),     now.getDate());
          const dueMs   = Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
          overdueDays   = Math.max(0, Math.floor((todayMs - dueMs) / 86400000));
          overdueMonths = overdueDays > 0 ? Math.ceil(overdueDays / 30) : 0;
        }

        const cappedMonths    = Math.min(overdueMonths, 3);
        const monthlyPenalty  = Math.round(principal * 0.05);
        const penaltyInterest = Math.round(principal * 0.05 * cappedMonths);

        setActiveLoan({
          ...overdueLoan,
          baseLoanBalance,
          overdueDays,
          overdueMonths,
          cappedMonths,
          monthlyPenalty,
          penaltyInterest,
          totalDue: baseLoanBalance + penaltyInterest,
        });
      } else {
        setActiveLoan(null);
      }
    } catch (err) {
      console.error('Failed to fetch active loan:', err);
      setActiveLoan(null);
    }
  };

  // ── Max loan: 3× yearly savings minus statutory deductions ─────
  const grossLoanAmount          = yearlySavings > 0 ? yearlySavings * 3 : 0;
  const totalStatutoryDeductions = statutory.statutoryFee + statutory.guarantorDeduction + statutory.other;
  const maxLoanAmount            = Math.max(0, grossLoanAmount - totalStatutoryDeductions);

  const fc = (amount) => new Intl.NumberFormat('en-KE', {
    style: 'currency', currency: 'KES', minimumFractionDigits: 0,
  }).format(amount || 0);

  const mv = (amount) => valuesHidden ? '••••••' : fc(amount);

  const fd = (d) => d ? new Date(d).toLocaleDateString('en-GB') : 'N/A';
  const monthName = (m) => MONTH_NAMES[(m - 1)] || '—';

  const calcBalance = (loan) => {
    if (loan.remainingBalance != null) return loan.remainingBalance;
    const p = Number(loan.amount) || 0;
    return p + (p * (Number(loan.interestRate) || 0) / 100) + Number(loan.penaltyInterest || 0) - Number(loan.amountPaid || 0);
  };

  const calcGuarantorLiability = (loan) => {
    const principal          = Number(loan.amount) || 0;
    const interestRate       = Number(loan.interestRate) || 0;
    const requiredGuarantors = principal < 80000 ? 3 : 5;
    const totalRepayment     = principal + (principal * interestRate / 100) + TRANSACTION_FEE;
    const oneShare           = principal / ONE_SHARE_DIVISOR;
    const reduced            = totalRepayment - oneShare;
    return Math.ceil(reduced / requiredGuarantors);
  };

  const resolveDueDate = (loan) => {
    if (loan.disbursementDate && loan.durationMonths) {
      const d = new Date(loan.disbursementDate);
      d.setMonth(d.getMonth() + Number(loan.durationMonths));
      return fd(d);
    }
    if (loan.dueDate) return fd(loan.dueDate);
    return 'N/A';
  };

  const guaranteedLoanStatusClass = (status) => {
    switch (status) {
      case 'paid':    return 'ontime';
      case 'active':  return 'active';
      case 'arrears': return 'late';
      case 'pending': return 'pending';
      default:        return 'overdue';
    }
  };

  const guaranteedLoanStatusLabel = (status) => {
    switch (status) {
      case 'paid':    return 'Paid';
      case 'active':  return 'Active';
      case 'arrears': return 'Arrears';
      case 'pending': return 'Pending';
      default:        return 'Default';
    }
  };

  if (loading) return (
    <><Navbar /><div className="dashboard-container"><div className="loading">Loading dashboard...</div></div></>
  );
  if (!id || id === 'null' || id === 'undefined') return (
    <><Navbar /><div className="dashboard-container"><div className="error"><h2>No Member Profile Found</h2><p>Contact an administrator.</p></div></div></>
  );
  if (error) return (
    <><Navbar /><div className="dashboard-container"><div className="error">{error}</div></div></>
  );

  const { member, savings, loans, chamaa } = dashboardData;

  const pendingFinesTotal = yearlyFines.reduce((sum, f) => sum + parseFloat(f.amount || 0), 0);

  const buildChamaaSchedule = (chamaaSlots) => {
    if (!chamaaSlots || chamaaSlots.length === 0) return [];
    return chamaaSlots.map((p) => {
      const scheduledLabel = p.scheduledMonth
        ? `${monthName(p.scheduledMonth)}${p.scheduledYear ? ' ' + p.scheduledYear : ''}`
        : null;
      return { ...p, scheduledLabel };
    });
  };

  const chamaaSchedule = buildChamaaSchedule(chamaa);

  return (
    <>
      <Navbar />
      <div className="dashboard-container">

        <div className="dashboard-header">
          <div className="dashboard-header-row">
            <div>
              <h1>Welcome, {member?.firstName} {member?.lastName}</h1>
              <p className="member-since">Member since {fd(member?.dateJoined)}</p>
            </div>
            <EyeToggleButton
              valuesHidden={valuesHidden}
              onToggle={toggleValuesHidden}
            />
          </div>
        </div>

        {/* ── Arrears / Default Banner ── */}
        {/* Shows when the member has a loan in arrears or default.
            Displays the penalty breakdown: 5% per month on principal. */}
        <ArrearsBanner activeLoan={activeLoan} />

        {/* ── ROW 1: Hero cards ── */}
        <div className="cards-row hero-row">

          <div className="stat-card hero-card savings-hero">
            <div className="hero-icon"><Coins size={28} /></div>
            <div className="hero-body">
              <span className="hero-label">
                Total Savings <YearBadge />
              </span>
              <span className={`hero-value${valuesHidden ? ' hero-value--masked' : ''}`}>
                {mv(yearlySavings)}
              </span>
            </div>
          </div>

          <div className="stat-card hero-card loan-hero">
            <div className="hero-icon"><ClipboardList size={28} /></div>
            <div className="hero-body">
              <span className="hero-label">
                Max Loan Amount <YearBadge />
              </span>
              <span className={`hero-value${valuesHidden ? ' hero-value--masked' : ''}`}>
                {mv(maxLoanAmount)}
              </span>
              {!valuesHidden && totalStatutoryDeductions > 0 && (
                <span className="hero-sub">
                  {fc(grossLoanAmount)} − {fc(totalStatutoryDeductions)} statutory
                </span>
              )}
            </div>
          </div>

        </div>

        {/* ── ROW 2: Small cards ── */}
        <div className="cards-row small-row">

          <MyLoans memberId={id} year={CURRENT_YEAR} />

          <div
            className="stat-card small-card"
            style={{ borderTopColor: pendingFinesTotal > 0 ? '#ef9a9a' : '#e0e0e0' }}
          >
            <span className="small-icon" style={{ background: '#ffebee', color: '#c62828' }}>
              <AlertTriangle size={18} />
            </span>
            <div className="small-body">
              <span className="small-label">
                Pending Fines <YearBadge />
              </span>
              <span className="small-value" style={{ color: pendingFinesTotal > 0 ? '#c62828' : '#2e7d32' }}>
                {fc(pendingFinesTotal)}
              </span>
              <span className="small-sub">{yearlyFines.length} unpaid in {CURRENT_YEAR}</span>
            </div>
          </div>

          <DepositCard memberId={id} small />

          {/* Seed Capital */}
          <div className="stat-card small-card">
            <span className="small-icon" style={{ background: '#e8f5e9', color: '#2e7d32' }}>
              <Sprout size={18} />
            </span>
            <div className="small-body">
              <span className="small-label">Seed Capital</span>
              <span className="small-value" style={{ color: '#2e7d32' }}>
                {fc(memberSeedCapital)}
              </span>
            </div>
          </div>

          {/* Others */}
          <div className="stat-card small-card">
            <span className="small-icon" style={{ background: '#f3e5f5', color: '#6a1b9a' }}>
              <Package size={18} />
            </span>
            <div className="small-body">
              <span className="small-label">Others</span>
              <span className="small-value" style={{ color: '#6a1b9a' }}>{fc(depositSummary.othersTotal)}</span>
            </div>
          </div>

          {/* Arrears fine small card — only shown when in arrears/default */}
          {activeLoan && (activeLoan.status === 'arrears' || activeLoan.status === 'default') && (() => {
            const principal      = Number(activeLoan.amount || 0);
            const cappedMonths   = Math.min(
              (() => {
                if (!activeLoan.dueDate) return 0;
                const now     = new Date();
                const dueDate = new Date(activeLoan.dueDate);
                const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
                const dueMs   = Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                const days    = Math.max(0, Math.floor((todayMs - dueMs) / 86400000));
                return days > 0 ? Math.ceil(days / 30) : 0;
              })(), 3
            );
            const penaltyInterest = Math.round(principal * 0.05 * cappedMonths);
            return penaltyInterest > 0 ? (
              <div
                className="stat-card small-card"
                style={{ borderTopColor: activeLoan.status === 'default' ? '#f44336' : '#ff9800' }}
              >
                <span className="small-icon" style={{
                  background: activeLoan.status === 'default' ? '#ffebee' : '#fff8e1',
                  color:      activeLoan.status === 'default' ? '#b71c1c' : '#e65100',
                }}>
                  <Banknote size={18} />
                </span>
                <div className="small-body">
                  <span className="small-label">
                    Arrears Penalty
                  </span>
                  <span className="small-value" style={{
                    color: activeLoan.status === 'default' ? '#b71c1c' : '#e65100',
                  }}>
                    {fc(penaltyInterest)}
                  </span>
                  <span className="small-sub">
                    5% × {cappedMonths} month{cappedMonths !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            ) : null;
          })()}

          {statutory.guarantorDeduction > 0 && (
            <div className="stat-card small-card">
              <span className="small-icon" style={{ background: '#e0f2f1', color: '#00695c' }}>
                <Handshake size={18} />
              </span>
              <div className="small-body">
                <span className="small-label">Guarantor Deduction</span>
                <span className="small-value" style={{ color: '#00695c' }}>{fc(statutory.guarantorDeduction)}</span>
              </div>
            </div>
          )}

          {statutory.other > 0 && (
            <div className="stat-card small-card">
              <span className="small-icon" style={{ background: '#eceff1', color: '#455a64' }}>
                <FileText size={18} />
              </span>
              <div className="small-body">
                <span className="small-label">Other (Statutory)</span>
                <span className="small-value" style={{ color: '#455a64' }}>{fc(statutory.other)}</span>
              </div>
            </div>
          )}

        </div>

        {/* ── Sections ── */}
        <div className="dashboard-sections">

          <section className="section">
            <h2>
              Recent Savings{' '}
              <span style={{ fontSize: '13px', fontWeight: 400, color: '#888' }}>({CURRENT_YEAR})</span>
            </h2>
            {savings?.filter(s => s.year === CURRENT_YEAR).length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Month</th><th>Year</th><th>Amount</th><th>Payment Date</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savings.filter(s => s.year === CURRENT_YEAR).map(s => (
                      <tr key={s.id}>
                        <td>{monthName(s.month)}</td>
                        <td>{s.year}</td>
                        <td>{fc(s.amount)}</td>
                        <td>{fd(s.paymentDate)}</td>
                        <td>
                          <span className={`status ${s.isLate ? 'late' : 'ontime'}`}>
                            {s.isLate ? 'Late' : 'On Time'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="no-data">No savings recorded for {CURRENT_YEAR}</p>}
          </section>

          <section className="section">
            <h2>My Active Loans</h2>
            {loans?.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Amount</th><th>Disbursed</th><th>Due Date</th><th>Paid</th><th>Balance</th><th>Penalty</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loans.map(loan => {
                      const isOverdue = loan.status === 'arrears' || loan.status === 'default';
                      const principal = Number(loan.amount || 0);
                      let penalty = 0;
                      if (isOverdue && loan.dueDate) {
                        const now     = new Date();
                        const dueDate = new Date(loan.dueDate);
                        const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
                        const dueMs   = Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                        const days    = Math.max(0, Math.floor((todayMs - dueMs) / 86400000));
                        const months  = days > 0 ? Math.min(Math.ceil(days / 30), 3) : 0;
                        penalty       = Math.round(principal * 0.05 * months);
                      }
                      return (
                        <tr key={loan.id}>
                          <td>{fc(loan.amount)}</td>
                          <td>{fd(loan.disbursementDate)}</td>
                          <td>{resolveDueDate(loan)}</td>
                          <td>{fc(loan.total_paid)}</td>
                          <td>{fc(loan.remainingBalance)}</td>
                          <td style={{ color: penalty > 0 ? '#e65100' : '#aaa', fontWeight: penalty > 0 ? 700 : 400 }}>
                            {penalty > 0 ? fc(penalty) : '—'}
                          </td>
                          <td>
                            <span className={`status ${
                              loan.status === 'arrears' ? 'late'
                              : loan.status === 'default' ? 'overdue'
                              : loan.isOverdue ? 'overdue'
                              : 'active'
                            }`}>
                              {loan.status === 'arrears' ? 'Arrears'
                               : loan.status === 'default' ? 'Default'
                               : loan.isOverdue ? 'Overdue'
                               : 'Active'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="no-data">No active loans</p>}
          </section>

          <section className="section">
            <h2>Loans I Guaranteed</h2>
            {guaranteedLoansData?.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Borrower</th>
                      <th>Loan Amount</th>
                      <th>Balance</th>
                      <th>Disbursed</th>
                      <th>Due Date</th>
                      <th>My Liability</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guaranteedLoansData.map(loan => {
                      const balance   = calcBalance(loan);
                      const dueDate   = resolveDueDate(loan);
                      const liability = calcGuarantorLiability(loan);
                      return (
                        <tr key={loan.loanId}>
                          <td>{loan.borrowerName}</td>
                          <td>{fc(loan.amount)}</td>
                          <td style={{ fontWeight: 'bold', color: balance > 0 ? '#c62828' : '#2e7d32' }}>
                            {fc(balance)}
                          </td>
                          <td>{fd(loan.disbursementDate)}</td>
                          <td>{dueDate}</td>
                          <td>
                            <span className="liability-badge">
                              {fc(liability)}
                            </span>
                          </td>
                          <td>
                            <span className={`status ${guaranteedLoanStatusClass(loan.status)}`}>
                              {guaranteedLoanStatusLabel(loan.status)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="no-data">Not guaranteeing any loans</p>}
          </section>

          <section className="section">
            <h2>Chamaa Participation</h2>
            {chamaaSchedule.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Cycle Name</th>
                      <th>Contribution</th>
                      <th>My Position</th>
                      <th>My Payout Month</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chamaaSchedule.map(p => (
                      <tr key={p.id}>
                        <td>{p.cycle?.name}</td>
                        <td>{fc(p.cycle?.contributionAmount)}</td>
                        <td>#{p.position}</td>
                        <td>
                          {p.scheduledLabel ? (
                            <span className={`payout-badge ${p.hasReceived ? 'payout-received' : 'payout-pending'}`}>
                              📅 {p.scheduledLabel}
                            </span>
                          ) : (
                            <span className="payout-unscheduled">Not scheduled yet</span>
                          )}
                        </td>
                        <td>
                          <span className={`status ${p.hasReceived ? 'received' : 'pending'}`}>
                            {p.hasReceived ? `Received ${fd(p.receivedDate)}` : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="no-data">Not participating in any chamaa cycle</p>}
          </section>

          {yearlyFines.length > 0 && (
            <section className="section">
              <h2>
                Pending Fines{' '}
                <span style={{ fontSize: '13px', fontWeight: 400, color: '#888' }}>({CURRENT_YEAR})</span>
              </h2>
              <div className="table-container">
                <table>
                  <thead>
                    <tr><th>Type</th><th>Month/Year</th><th>Amount</th><th>Notes</th></tr>
                  </thead>
                  <tbody>
                    {yearlyFines.map(f => (
                      <tr key={f.id}>
                        <td>
                          <span style={{
                            padding:'2px 8px', borderRadius:'10px', fontSize:'12px', fontWeight:600,
                            background: f.fineType === 'savings_late' ? '#fff3e0'
                              : f.fineType === 'chamaa_late' ? '#fce4ec'
                              : f.fineType === 'loan_arrears' ? '#fff8e1'
                              : '#f5f5f5',
                            color: f.fineType === 'savings_late' ? '#e65100'
                              : f.fineType === 'chamaa_late' ? '#880e4f'
                              : f.fineType === 'loan_arrears' ? '#e65100'
                              : '#555',
                          }}>
                            {f.fineType === 'savings_late' ? 'Savings Fine'
                              : f.fineType === 'chamaa_late' ? 'Chamaa Fine'
                              : f.fineType === 'loan_arrears' ? 'Arrears Penalty'
                              : f.fineType?.replace('_', ' ') || 'Fine'}
                          </span>
                        </td>
                        <td>{monthName(f.month)} {f.year}</td>
                        <td style={{ fontWeight:700, color:'#c62828' }}>{fc(f.amount)}</td>
                        <td style={{ fontSize:'12px', color:'#666' }}>{f.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

        </div>
      </div>
    </>
  );
};

export default MemberDashboard;