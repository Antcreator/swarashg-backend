import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { membersAPI, loansAPI, depositsAPI, finesAPI, seedCapitalAPI, agmFeeAPI, registrationFeeAPI, savingsAPI, investmentAPI } from '../../Service/Api';
import { useIsStaff } from '../Protected Route/Protectedroute';
import Navbar from '../Navbar/navbar';
import './adminDashboard.css';
import {
  Calendar, Eye, Users, Sprout, PiggyBank, FileText,
  Banknote, CreditCard, AlertTriangle, Bell, ClipboardList,
  ScrollText, FilePen, TrendingUp, KeyRound, UserPlus,
  Wallet, FileBarChart, RefreshCw, TrendingDown, Clock,
} from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

// ── Matches InvestmentPage.jsx and Loans.jsx outstanding card exactly ─────────
// Penalty = 5% × remaining principal × months overdue (capped at 3)
// Payments clear interest first, then principal.
const calcArrearsPenalty = (loan) => {
  if (loan.status !== 'arrears' && loan.status !== 'default') return 0;
  if (!loan.dueDate) return 0;
  const principal    = Number(loan.amount || 0);
  const interestRate = Number(loan.interestRate || 0);
  const txFee        = Number(loan.transactionFee ?? 108);
  const amountPaid   = Number(loan.amountPaid || 0);
  const totalInterest      = Math.round(principal * interestRate / 100) + txFee;
  const principalPaid      = Math.max(0, amountPaid - totalInterest);
  const remainingPrincipal = Math.max(0, principal - principalPaid);
  const now     = new Date();
  const dueDate = new Date(loan.dueDate);
  const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const dueMs   = Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const days    = Math.max(0, Math.floor((todayMs - dueMs) / 86400000));
  const months  = days > 0 ? Math.min(Math.ceil(days / 30), 3) : 0;
  return Math.round(remainingPrincipal * 0.05 * months);
};

// Outstanding = totalRepayment + live arrears penalty
// Matches the "Total Outstanding" card on the loan detail modal.
const calcLoanOutstanding = (loan) => {
  return Number(loan.totalRepayment || 0) + calcArrearsPenalty(loan);
};

const AdminDashboard = () => {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isStaff = useIsStaff();

  const [stats, setStats] = useState({
    totalMembers:       0,
    totalSeedCapital:   0,
    totalSavings:       0,
    activeLoans:        0,
    pendingLoans:       0,
    totalDisbursed:     0,
    pendingDeposits:    0,
    savingsFineTotal:   0,
    chamaaFineTotal:    0,
    agmFeeTotal:        0,
    registrationTotal:  0,
    investmentTotal:    0,
    withdrawalsExpense: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDashboardStats(); }, []);

  const fetchDashboardStats = async () => {
    try {
      const [membersRes, loansRes, savingsRes] = await Promise.all([
        membersAPI.getAll().catch(() => ({ data: { members: [] } })),
        loansAPI.getStatistics({ year: CURRENT_YEAR }).catch(() => ({ data: { statistics: {} } })),
        savingsAPI.getStats({ year: CURRENT_YEAR }).catch(() => ({ data: { totalSavings: 0 } })),
      ]);

      const members      = membersRes.data?.members  || [];
      const loanStats    = loansRes.data?.statistics || {};
      const totalSavings = savingsRes.data?.totalSavings || 0;

      let pendingDepositsCount = 0;
      let totalSeedCapital     = 0;
      let savingsFineTotal     = 0;
      let chamaaFineTotal      = 0;
      let agmFeeTotal          = 0;
      let registrationTotal    = 0;
      let investmentTotal      = 0;
      let pendingLoans         = 0;

      await Promise.allSettled([
        depositsAPI.getPending({ year: CURRENT_YEAR })
          .then(r => { pendingDepositsCount = r.data.deposits?.length || 0; })
          .catch(() => {}),

        seedCapitalAPI.getStats()
          .then(r => { totalSeedCapital = r.data.totalSeedCapital || 0; })
          .catch(() => {}),

        finesAPI.getStats({ year: CURRENT_YEAR })
          .then(r => {
            savingsFineTotal = r.data.savingsFineTotal || 0;
            chamaaFineTotal  = r.data.chamaaFineTotal  || 0;
          })
          .catch(() => {}),

        agmFeeAPI.getStats({ year: CURRENT_YEAR })
          .then(r => { agmFeeTotal = r.data.totalThisYear || r.data.total || 0; })
          .catch(() => {}),

        registrationFeeAPI.getStats({ year: CURRENT_YEAR })
          .then(r => { registrationTotal = r.data.registrationTotal || r.data.total || 0; })
          .catch(() => {}),

        loansAPI.getAll({ approvalStatus: 'pending' })
          .then(r => { pendingLoans = (r.data.loans || []).length; })
          .catch(() => {}),
      ]);

      // ── Investment total (All-time Principal row) ─────────────────
      // Must match InvestmentPage.jsx Principal row exactly:
      //   Loans col    = sum of calcLoanOutstanding(loan) for all approved loans
      //                = totalRepayment + arrears penalty per loan
      //   Savings fines = all-time savings_late fines
      //   Chamaa fines  = all-time chamaa_late fines
      //   Edit cols     = whatever admin typed in the Principal row (cols 4–10)
      try {
        const [invRes, allLoansRes, allFinesRes] = await Promise.all([
          investmentAPI.getAll(CURRENT_YEAR),
          loansAPI.getAll({ _nocache: Date.now() }).catch(() => ({ data: { loans: [] } })),
          finesAPI.getAll({}).catch(() => ({ data: { fines: [] } })),
        ]);

        // Edit cols from the saved Principal row (cols 4–10)
        const invRows      = invRes.data.rows || [];
        const principalRow = invRows.find(r => Number(r.month) === 0);
        const editSum      = principalRow
          ? [4, 5, 6, 7, 8, 9, 10].reduce((sum, i) => {
              return sum + (Number(principalRow[`investment${i}Amount`]) || 0);
            }, 0)
          : 0;

        // Loans col: sum of outstanding amount per approved loan
        // = totalRepayment + live arrears penalty (same as investment page)
        const allLoans = (allLoansRes.data.loans || []).filter(l => l.approvalStatus === 'approved');
        const principalLoansTotal = allLoans.reduce((sum, l) => {
          return sum + calcLoanOutstanding(l);
        }, 0);

        // Fines: all-time totals (not year-filtered) for Principal row
        const allFines = allFinesRes.data.fines || [];
        const principalSavingsFines = allFines
          .filter(f => f.fineType === 'savings_late')
          .reduce((s, f) => s + Number(f.amount || 0), 0);
        const principalChamaaFines = allFines
          .filter(f => f.fineType === 'chamaa_late')
          .reduce((s, f) => s + Number(f.amount || 0), 0);

        investmentTotal = principalLoansTotal + principalSavingsFines + principalChamaaFines + editSum;
      } catch (e) {
        investmentTotal = 0;
      }

      // ── Withdrawals expense ───────────────────────────────────────
      let withdrawalsExpense = 0;
      try {
        const saved = localStorage.getItem('swara_withdrawals');
        if (saved) {
          const rows = JSON.parse(saved);
          withdrawalsExpense = rows.reduce((sum, r) => {
            if (r.type === 'expense') {
              const n = parseFloat(String(r.amount || '').replace(/[^0-9.]/g, ''));
              return sum + (isNaN(n) ? 0 : n);
            }
            return sum;
          }, 0);
        }
      } catch { /* ignore */ }

      setStats({
        totalMembers:      members.length,
        totalSeedCapital,
        totalSavings,
        activeLoans:       loanStats.active_loans || 0,
        pendingLoans,
        totalDisbursed:    parseFloat(loanStats.total_disbursed || 0),
        pendingDeposits:   pendingDepositsCount,
        savingsFineTotal,
        chamaaFineTotal,
        agmFeeTotal,
        registrationTotal,
        investmentTotal,
        withdrawalsExpense,
      });
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (amount) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount || 0);

  if (loading) return (
    <>
      <Navbar />
      <div className="admin-container"><div className="loading">Loading dashboard...</div></div>
    </>
  );

  return (
    <>
      <Navbar />
      <div className="admin-container">

        {/* Header */}
        <div className="admin-header">
          <div>
            <h1>Admin Dashboard</h1>
            <p>Swara Self Help Group Management</p>
          </div>
          <div style={{ fontSize: '13px', color: '#666', textAlign: 'right' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              marginBottom: '6px',
              background: '#e8f5e9', color: '#2e7d32',
              border: '1px solid #a5d6a7', borderRadius: '20px',
              padding: '3px 12px', fontSize: '12px', fontWeight: 700,
            }}>
              <Calendar size={12} /> Showing {CURRENT_YEAR} data
            </div>
            {isStaff && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                marginBottom: '6px', marginLeft: '8px',
                background: '#fff8e1', color: '#e65100',
                border: '1px solid #ffe082', borderRadius: '20px',
                padding: '3px 12px', fontSize: '12px', fontWeight: 700,
              }}>
                <Eye size={12} /> Staff View
              </div>
            )}
            <div>Logged in as</div>
            <div style={{ fontWeight: 700, color: '#1a1a2e' }}>
              {currentUser.firstName} {currentUser.lastName}
            </div>
            <div style={{ color: '#888' }}>{currentUser.email}</div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="stats-grid">

          {/* Total Members */}
          <div className="stat-card">
            <div className="stat-icon members" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={28} />
            </div>
            <div className="stat-content">
              <h3>Total Members</h3>
              <p className="stat-value">{stats.totalMembers}</p>
              <Link to="/admin/members" className="stat-link">
                {isStaff ? 'View Members →' : 'Manage Members →'}
              </Link>
            </div>
          </div>

          {/* Seed Capital */}
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sprout size={28} color="#2e7d32" />
            </div>
            <div className="stat-content">
              <h3>Total Seed Capital</h3>
              <p className="stat-value">{fmt(stats.totalSeedCapital)}</p>
              <Link to="/admin/seed-capital" className="stat-link">View Details →</Link>
            </div>
          </div>

          {/* Savings */}
          <div className="stat-card">
            <div className="stat-icon savings" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PiggyBank size={28} />
            </div>
            <div className="stat-content">
              <h3>Total Savings <YearBadge /></h3>
              <p className="stat-value">{fmt(stats.totalSavings)}</p>
              <Link to="/admin/savings" className="stat-link">View Savings →</Link>
            </div>
          </div>

          {/* Active Loans + pending badge */}
          <Link
            to={stats.pendingLoans > 0 ? '/admin/loans?tab=pending' : '/admin/loans?tab=approved'}
            className="stat-card clickable"
            style={{ textDecoration: 'none', color: 'inherit', position: 'relative' }}
          >
            <div className="stat-icon loans" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={28} />
            </div>
            <div className="stat-content">
              <h3>Active Loans <YearBadge /></h3>
              <p className="stat-value">{stats.activeLoans}</p>
              {stats.pendingLoans > 0 ? (
                <span className="stat-link" style={{ display:'inline-flex', alignItems:'center', gap:'5px', color:'#e65100', fontWeight:700 }}>
                  <Clock size={12} />
                  {stats.pendingLoans} loan{stats.pendingLoans > 1 ? 's' : ''} pending approval →
                </span>
              ) : (
                <span className="stat-link">View Approved Loans →</span>
              )}
            </div>
            {stats.pendingLoans > 0 && (
              <div style={{
                position:'absolute', top:'-8px', right:'-8px',
                background:'#e53935', color:'white', borderRadius:'50%',
                minWidth:'24px', height:'24px',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'12px', fontWeight:800,
                boxShadow:'0 2px 6px rgba(229,57,53,0.5)',
                padding:'0 4px', zIndex:1,
              }}>
                {stats.pendingLoans}
              </div>
            )}
          </Link>

          {/* Total Disbursed */}
          <div className="stat-card">
            <div className="stat-icon disbursed" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Banknote size={28} />
            </div>
            <div className="stat-content">
              <h3>Total Disbursed <YearBadge /></h3>
              <p className="stat-value">{fmt(stats.totalDisbursed)}</p>
              <Link to="/admin/loans" className="stat-link">View Details →</Link>
            </div>
          </div>

          {/* Pending Deposits */}
          <Link to="/admin/deposits" className="stat-card deposits-card clickable">
            <div className="stat-icon deposits" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={28} />
            </div>
            <div className="stat-content">
              <h3>Pending Deposits <YearBadge /></h3>
              <p className="stat-value">{stats.pendingDeposits}</p>
              <span className="stat-link">
                {stats.pendingDeposits > 0 ? 'Review & Approve →' : 'View All →'}
              </span>
            </div>
            {stats.pendingDeposits > 0 && <div className="notification-badge">{stats.pendingDeposits}</div>}
          </Link>

          {/* Savings Fines */}
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fff3e0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={28} color="#e65100" />
            </div>
            <div className="stat-content">
              <h3>Savings Fines <YearBadge /></h3>
              <p className="stat-value">{fmt(stats.savingsFineTotal)}</p>
              <Link to="/admin/fines?type=savings_late" className="stat-link">View Fines →</Link>
            </div>
          </div>

          {/* Chamaa Fines */}
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fce4ec', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={28} color="#c62828" />
            </div>
            <div className="stat-content">
              <h3>Chamaa Fines <YearBadge /></h3>
              <p className="stat-value">{fmt(stats.chamaaFineTotal)}</p>
              <Link to="/admin/fines?type=chamaa_late" className="stat-link">View Fines →</Link>
            </div>
          </div>

          {/* AGM Fees */}
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#ede7f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList size={28} color="#7b1fa2" />
            </div>
            <div className="stat-content">
              <h3>AGM Fees <YearBadge /></h3>
              <p className="stat-value">{fmt(stats.agmFeeTotal)}</p>
              <Link to="/admin/agm-fees" className="stat-link">View Details →</Link>
            </div>
          </div>

          {/* Statutory */}
          <Link to="/admin/statutory" className="stat-card clickable" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="stat-icon" style={{ background: '#ede7f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ScrollText size={28} color="#7b1fa2" />
            </div>
            <div className="stat-content">
              <h3>Statutory</h3>
              <p className="stat-value" style={{ fontSize: '16px', color: '#7b1fa2' }}>Fees & Deductions</p>
              <span className="stat-link" style={{ color: '#7b1fa2' }}>
                {isStaff ? 'View Fees →' : 'Manage Fees →'}
              </span>
            </div>
          </Link>

          {/* Registration Fees */}
          <Link to="/admin/registration-fees" className="stat-card clickable" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="stat-icon" style={{ background: '#e3f2fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FilePen size={28} color="#1976d2" />
            </div>
            <div className="stat-content">
              <h3>Registration Fees <YearBadge /></h3>
              <p className="stat-value">{fmt(stats.registrationTotal)}</p>
              <span className="stat-link" style={{ color: '#1976d2' }}>View Details →</span>
            </div>
          </Link>

          {/* Investment */}
          <Link to="/admin/investments" className="stat-card clickable" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="stat-icon" style={{ background: '#f3e5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={28} color="#7b1fa2" />
            </div>
            <div className="stat-content">
              <h3>
                Investment
                <span style={{
                  display: 'inline-block', fontSize: '10px', fontWeight: 700,
                  background: '#f3e5f5', color: '#7b1fa2', border: '1px solid #ce93d8',
                  borderRadius: '10px', padding: '1px 7px', verticalAlign: 'middle',
                  marginLeft: '4px', letterSpacing: '0.02em',
                }}>
                  All-time
                </span>
              </h3>
              <p className="stat-value" style={{ color: '#7b1fa2' }}>
                {stats.investmentTotal > 0 ? fmt(stats.investmentTotal) : 'KES 0'}
              </p>
              <span className="stat-link" style={{ color: '#7b1fa2' }}>
                {isStaff ? 'View →' : 'View & Manage →'}
              </span>
            </div>
          </Link>

          {/* Withdrawals */}
          <Link to="/admin/withdrawals" className="stat-card clickable" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="stat-icon" style={{ background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingDown size={28} color="#be123c" />
            </div>
            <div className="stat-content">
              <h3>Withdrawals</h3>
              <p className="stat-value" style={{ color: '#be123c' }}>
                {stats.withdrawalsExpense > 0 ? fmt(stats.withdrawalsExpense) : 'Expenses'}
              </p>
              <span className="stat-link" style={{ color: '#be123c' }}>
                {stats.withdrawalsExpense > 0 ? 'Expenses recorded →' : 'Manage →'}
              </span>
            </div>
          </Link>

          {/* Admin Accounts */}
          {!isStaff && (
            <Link to="/admin/admins" className="stat-card clickable" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="stat-icon" style={{ background: '#e8eaf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <KeyRound size={28} color="#3949ab" />
              </div>
              <div className="stat-content">
                <h3>Admin Accounts</h3>
                <p className="stat-value" style={{ fontSize: '16px', color: '#3949ab' }}>Manage Admins</p>
                <span className="stat-link" style={{ color: '#3949ab' }}>Add / Manage →</span>
              </div>
            </Link>
          )}

        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          <h2>Quick Actions</h2>
          <div className="actions-grid">

            <Link to="/admin/members" className="action-card">
              <span className="action-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserPlus size={28} />
              </span>
              <h3>{isStaff ? 'View Members' : 'Add New Member'}</h3>
              <p>{isStaff ? 'View all group members' : 'Register a new member to the group'}</p>
            </Link>

            <Link to="/admin/savings" className="action-card">
              <span className="action-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wallet size={28} />
              </span>
              <h3>{isStaff ? 'View Savings' : 'Record Savings'}</h3>
              <p>{isStaff ? 'View savings contributions' : 'Record monthly savings contributions'}</p>
            </Link>

            <Link to="/admin/loans" className="action-card" style={{ position: 'relative' }}>
              <span className="action-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={28} />
              </span>
              <h3>{isStaff ? 'View Loans' : 'Process Loan'}</h3>
              <p>{isStaff ? 'View member loans' : 'Approve and disburse member loans'}</p>
              {stats.pendingLoans > 0 && (
                <span className="action-badge" style={{ background: '#e53935' }}>
                  {stats.pendingLoans} pending
                </span>
              )}
            </Link>

            <Link to="/admin/chamaa" className="action-card">
              <span className="action-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RefreshCw size={28} />
              </span>
              <h3>{isStaff ? 'View Chamaa' : 'Manage Chamaa'}</h3>
              <p>{isStaff ? 'View merry-go-round cycles' : 'Handle merry-go-round cycles'}</p>
            </Link>

            <Link to="/admin/deposits" className="action-card">
              <span className="action-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={28} />
              </span>
              <h3>{isStaff ? 'View Deposits' : 'Review Deposits'}</h3>
              <p>{isStaff ? 'View member deposit distributions' : 'Approve member deposit distributions'}</p>
              {stats.pendingDeposits > 0 && <span className="action-badge">{stats.pendingDeposits} pending</span>}
            </Link>

            <Link to="/admin/fines" className="action-card" style={{ position: 'relative' }}>
              <span className="action-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={28} />
              </span>
              <h3>{isStaff ? 'View Fines' : 'Manage Fines'}</h3>
              <p>{isStaff ? 'View member fines' : 'View and manage member fines'}</p>
            </Link>

            <Link to="/admin/agm-fees" className="action-card">
              <span className="action-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ClipboardList size={28} />
              </span>
              <h3>AGM Fees</h3>
              <p>{isStaff ? 'View AGM fee contributions' : 'View and manage AGM fee contributions'}</p>
            </Link>

            <Link to="/admin/statutory" className="action-card">
              <span className="action-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ScrollText size={28} />
              </span>
              <h3>Statutory Fees</h3>
              <p>{isStaff ? 'View statutory fees' : 'Manage AGM, cautionary & statutory fees'}</p>
            </Link>

            <Link to="/admin/reports" className="action-card">
              <span className="action-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileBarChart size={28} />
              </span>
              <h3>View Reports</h3>
              <p>Generate and download analytics</p>
            </Link>

            <Link to="/admin/withdrawals" className="action-card">
              <span className="action-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingDown size={28} />
              </span>
              <h3>Withdrawals</h3>
              <p>Record and track group withdrawals and expenses</p>
            </Link>

            {!isStaff && (
              <Link to="/admin/admins" className="action-card">
                <span className="action-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <KeyRound size={28} />
                </span>
                <h3>Manage Admins</h3>
                <p>Add or manage administrator accounts</p>
              </Link>
            )}

          </div>
        </div>

      </div>
    </>
  );
};

const YearBadge = () => (
  <span style={{
    display: 'inline-block', fontSize: '10px', fontWeight: 700,
    background: '#e3f2fd', color: '#1565c0', border: '1px solid #90caf9',
    borderRadius: '10px', padding: '1px 7px', verticalAlign: 'middle',
    marginLeft: '4px', letterSpacing: '0.02em',
  }}>
    {CURRENT_YEAR}
  </span>
);

export default AdminDashboard;