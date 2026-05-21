import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { membersAPI, loansAPI, depositsAPI, statutoryAPI, savingsAPI, finesAPI, seedCapitalAPI } from '../../Service/Api';
import Navbar from '../Navbar/navbar';
import MyLoans from '../Member/MyLoans';
import DepositCard from './DepositCard';
import './memberDashboard.css';
import {
  Coins, ClipboardList, AlertTriangle, Sprout, Package,
  Handshake, FileText, Eye, EyeOff,
} from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TRANSACTION_FEE = 108;
const ONE_SHARE_DIVISOR = 3;

const MemberDashboard = () => {
  const { id } = useParams();
  const [dashboardData, setDashboardData]             = useState(null);
  const [guaranteedLoansData, setGuaranteedLoansData] = useState([]);
  const [depositSummary, setDepositSummary]           = useState({ othersTotal: 0, seedCapitalTotal: 0 });
  const [memberSeedCapital, setMemberSeedCapital]       = useState(0);
  const [statutory, setStatutory]                     = useState({ statutoryFee: 0, guarantorDeduction: 0, other: 0 });

  // ── Eye toggle — hides hero card values ───────────────────────
  const [valuesHidden, setValuesHidden] = useState(false);

  // ── Year-scoped values (reset each January) ───────────────────
  const [yearlySavings, setYearlySavings]   = useState(0);
  const [yearlyFines, setYearlyFines]       = useState([]);

  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    fetchDashboardData();
    fetchGuaranteedLoans();
    fetchDepositTotals();
    fetchStatutory();
    fetchYearlySavings();
    fetchYearlyFines();
    fetchMemberSeedCapital();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Fallback: if yearly savings API returned 0 but dashboard has
  //    savings data, derive the yearly total from dashboard savings ─
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
      const fromDeposits = distributed.reduce((sum, d) => sum + Number(d.seedCapitalAmount || 0), 0);
      setDepositSummary({
        othersTotal:      distributed.reduce((sum, d) => sum + Number(d.othersAmount || 0), 0),
        seedCapitalTotal: fromDeposits,
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

  // ── Fetch seed capital via getDashboard (member-accessible) ────
  // seedCapitalAPI.getAll() is admin-only; instead we try to get
  // the member's seed capital from the dashboard response which
  // Uses the new member-accessible /seed-capital/member/:id endpoint
  const fetchMemberSeedCapital = async () => {
    try {
      const res = await seedCapitalAPI.getByMember(id);
      setMemberSeedCapital(Number(res.data?.totalSeedCapital || 0));
    } catch { /* silent — card falls back to depositSummary.seedCapitalTotal */ }
  };

  // ── Fetch savings for the CURRENT YEAR only ───────────────────
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

  // ── Fetch unpaid fines for the CURRENT YEAR only ──────────────
  const fetchYearlyFines = async () => {
    try {
      const res = await finesAPI.getAll({ memberId: id, isPaid: 'false', year: CURRENT_YEAR });
      setYearlyFines(res.data.fines || []);
    } catch (err) {
      console.error('Failed to fetch yearly fines:', err);
      setYearlyFines([]);
    }
  };

  // ── Max loan: 3× yearly savings minus all statutory deductions ──
  const grossLoanAmount          = yearlySavings > 0 ? yearlySavings * 3 : 0;
  const totalStatutoryDeductions = statutory.statutoryFee + statutory.guarantorDeduction + statutory.other;
  const maxLoanAmount            = Math.max(0, grossLoanAmount - totalStatutoryDeductions);

  const fc = (amount) => new Intl.NumberFormat('en-KE', {
    style: 'currency', currency: 'KES', minimumFractionDigits: 0,
  }).format(amount || 0);

  // ── Masked display helper ─────────────────────────────────────
  const mv = (amount) => valuesHidden ? '••••••' : fc(amount);

  const fd = (d) => d ? new Date(d).toLocaleDateString('en-GB') : 'N/A';
  const monthName = (m) => MONTH_NAMES[(m - 1)] || '—';

  // ── Guaranteed loan balance calculation ───────────────────────
  const calcBalance = (loan) => {
    if (loan.remainingBalance != null) return loan.remainingBalance;
    const p = Number(loan.amount) || 0;
    return p + (p * (Number(loan.interestRate) || 0) / 100) + Number(loan.penaltyInterest || 0) - Number(loan.amountPaid || 0);
  };

  const calcGuarantorLiability = (loan) => {
    const principal          = Number(loan.amount) || 0;
    const interestRate       = Number(loan.interestRate) || 0;
    const requiredGuarantors = principal < 80000 ? 3 : 5;

    const totalRepayment = principal + (principal * interestRate / 100) + TRANSACTION_FEE;
    const oneShare       = principal / ONE_SHARE_DIVISOR;
    const reduced        = totalRepayment - oneShare;
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

  if (loading) return <><Navbar /><div className="dashboard-container"><div className="loading">Loading dashboard...</div></div></>;
  if (!id || id === 'null' || id === 'undefined') return (
    <><Navbar /><div className="dashboard-container"><div className="error"><h2>No Member Profile Found</h2><p>Contact an administrator.</p></div></div></>
  );
  if (error) return <><Navbar /><div className="dashboard-container"><div className="error">{error}</div></div></>;

  const { member, savings, loans, chamaa } = dashboardData;

  // Year-scoped fines summary
  const pendingFinesTotal = yearlyFines.reduce((sum, f) => sum + parseFloat(f.amount || 0), 0);

  // Small year badge shown on cards that reset annually
  const YearBadge = () => (
    <span style={{
      fontSize: '10px', fontWeight: 700,
      background: 'rgba(255,255,255,0.25)', color: 'inherit',
      border: '1px solid rgba(255,255,255,0.4)',
      borderRadius: '10px', padding: '1px 7px',
      verticalAlign: 'middle', marginLeft: '6px',
      letterSpacing: '0.02em',
    }}>
      {CURRENT_YEAR}
    </span>
  );

  // ── Eye toggle button (shared, placed on savings card) ────────
  const EyeToggle = () => (
    <button
      onClick={() => setValuesHidden(v => !v)}
      title={valuesHidden ? 'Show values' : 'Hide values'}
      aria-label={valuesHidden ? 'Show values' : 'Hide values'}
      style={{
        position: 'absolute', top: 14, right: 14,
        background: 'rgba(255,255,255,0.18)',
        border: '1px solid rgba(255,255,255,0.35)',
        borderRadius: '50%',
        width: 34, height: 34,
        cursor: 'pointer',
        color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
    >
      {valuesHidden ? <Eye size={16} /> : <EyeOff size={16} />}
    </button>
  );

  // ── Build a tidy scheduled-months list from chamaa slots ───────
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
          <h1>Welcome, {member?.firstName} {member?.lastName}</h1>
          <p className="member-since">Member since {fd(member?.dateJoined)}</p>
        </div>

        {/* ── ROW 1: Hero cards — Savings & Max Loan ──────────── */}
        <div className="cards-row hero-row">

          {/* Total Savings — resets Jan 1 each year */}
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
            <EyeToggle />
          </div>

          {/* Max Loan Amount — 3× yearly savings minus all statutory deductions */}
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
                <span className="hero-sub" style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px', display: 'block' }}>
                  {fc(grossLoanAmount)} − {fc(totalStatutoryDeductions)} statutory
                </span>
              )}
            </div>
            <EyeToggle />
          </div>

        </div>

        {/* ── ROW 2: Small cards — all secondary info ───────────── */}
        <div className="cards-row small-row">

          <MyLoans memberId={id} year={CURRENT_YEAR} />

          {/* Pending Fines — resets Jan 1 each year */}
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

          {/* Seed Capital — from seedCapitalAPI, not deposits */}
          <div className="stat-card small-card">
            <span className="small-icon" style={{ background: '#e8f5e9', color: '#2e7d32' }}>
              <Sprout size={18} />
            </span>
            <div className="small-body">
              <span className="small-label">Seed Capital</span>
              <span className="small-value" style={{ color: '#2e7d32' }}>
                {fc(memberSeedCapital)}
              </span>
              <span style={{ fontSize: '10px', color: '#999', display: 'block' }}>
                api: {memberSeedCapital} | dep: {depositSummary.seedCapitalTotal}
              </span>
            </div>
          </div>

          <div className="stat-card small-card">
            <span className="small-icon" style={{ background: '#f3e5f5', color: '#6a1b9a' }}>
              <Package size={18} />
            </span>
            <div className="small-body">
              <span className="small-label">Others</span>
              <span className="small-value" style={{ color: '#6a1b9a' }}>{fc(depositSummary.othersTotal)}</span>
            </div>
          </div>

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

        {/* ── Sections ──────────────────────────────────────────── */}
        <div className="dashboard-sections">

          <section className="section">
            <h2>Recent Savings <span style={{ fontSize: '13px', fontWeight: 400, color: '#888' }}>({CURRENT_YEAR})</span></h2>
            {savings?.filter(s => s.year === CURRENT_YEAR).length > 0 ? (
              <div className="table-container">
                <table>
                  <thead><tr><th>Month</th><th>Year</th><th>Amount</th><th>Payment Date</th><th>Status</th></tr></thead>
                  <tbody>
                    {savings.filter(s => s.year === CURRENT_YEAR).map(s => (
                      <tr key={s.id}>
                        <td>{monthName(s.month)}</td>
                        <td>{s.year}</td>
                        <td>{fc(s.amount)}</td>
                        <td>{fd(s.paymentDate)}</td>
                        <td><span className={`status ${s.isLate ? 'late' : 'ontime'}`}>{s.isLate ? 'Late' : 'On Time'}</span></td>
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
                  <thead><tr><th>Amount</th><th>Disbursed</th><th>Due Date</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
                  <tbody>
                    {loans.map(loan => (
                      <tr key={loan.id}>
                        <td>{fc(loan.amount)}</td>
                        <td>{fd(loan.disbursementDate)}</td>
                        <td>{resolveDueDate(loan)}</td>
                        <td>{fc(loan.total_paid)}</td>
                        <td>{fc(loan.remainingBalance)}</td>
                        <td><span className={`status ${loan.isOverdue ? 'overdue' : 'active'}`}>{loan.isOverdue ? 'Overdue' : 'Active'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="no-data">No active loans</p>}
          </section>

          {/* ── Loans I Guaranteed ── */}
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
                            <span style={{
                              display: 'inline-block',
                              background: '#fff3e0',
                              color: '#e65100',
                              border: '1px solid #ffcc80',
                              borderRadius: '10px',
                              padding: '2px 8px',
                              fontSize: '12px',
                              fontWeight: 700,
                            }}>
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

          {/* ── Chamaa Participation ── */}
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
                            <span style={{
                              display: 'inline-block',
                              background: p.hasReceived ? '#e8f5e9' : '#fff3e0',
                              color:      p.hasReceived ? '#2e7d32' : '#e65100',
                              border:     `1px solid ${p.hasReceived ? '#a5d6a7' : '#ffcc80'}`,
                              borderRadius: '12px',
                              padding: '3px 10px',
                              fontWeight: 700,
                              fontSize: '13px',
                            }}>
                              📅 {p.scheduledLabel}
                            </span>
                          ) : (
                            <span style={{ color: '#bbb', fontStyle: 'italic', fontSize: '13px' }}>Not scheduled yet</span>
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
              <h2>Pending Fines <span style={{ fontSize: '13px', fontWeight: 400, color: '#888' }}>({CURRENT_YEAR})</span></h2>
              <div className="table-container">
                <table>
                  <thead><tr><th>Type</th><th>Month/Year</th><th>Amount</th><th>Notes</th></tr></thead>
                  <tbody>
                    {yearlyFines.map(f => (
                      <tr key={f.id}>
                        <td>{f.fineType ? f.fineType.replace('_', ' ') : 'N/A'}</td>
                        <td>{monthName(f.month)} {f.year}</td>
                        <td>{fc(f.amount)}</td>
                        <td>{f.notes || '—'}</td>
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