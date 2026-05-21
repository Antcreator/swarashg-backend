// ───────────────────────────────────────────────────────────────
// MemberDashboard.js
// ───────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  membersAPI,
  loansAPI,
  depositsAPI,
  statutoryAPI,
  savingsAPI,
  finesAPI,
  seedCapitalAPI,
} from '../../Service/Api';

import Navbar from '../Navbar/navbar';
import MyLoans from '../Member/MyLoans';
import DepositCard from './DepositCard';

import './memberDashboard.css';

import {
  Coins,
  ClipboardList,
  AlertTriangle,
  Sprout,
  Package,
  Handshake,
  FileText,
  Eye,
  EyeOff,
} from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const TRANSACTION_FEE = 108;
const ONE_SHARE_DIVISOR = 3;

const MemberDashboard = () => {
  const { id } = useParams();

  const [dashboardData, setDashboardData] = useState(null);
  const [guaranteedLoansData, setGuaranteedLoansData] = useState([]);

  const [depositSummary, setDepositSummary] = useState({
    othersTotal: 0,
    seedCapitalTotal: 0,
  });

  const [memberSeedCapital, setMemberSeedCapital] = useState(0);

  const [statutory, setStatutory] = useState({
    statutoryFee: 0,
    guarantorDeduction: 0,
    other: 0,
  });

  // ── Eye toggle states ───────────────────────────────────────
  const [savingsVisible, setSavingsVisible] = useState(true);
  const [loanVisible, setLoanVisible] = useState(true);

  // ── Year data ───────────────────────────────────────────────
  const [yearlySavings, setYearlySavings] = useState(0);
  const [yearlyFines, setYearlyFines] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
    fetchGuaranteedLoans();
    fetchDepositTotals();
    fetchStatutory();
    fetchYearlySavings();
    fetchYearlyFines();
    fetchMemberSeedCapital();
  }, [id]);

  // ────────────────────────────────────────────────────────────
  // Fetch dashboard
  // ────────────────────────────────────────────────────────────
  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const response = await membersAPI.getDashboard(id);

      setDashboardData(response.data);
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to load dashboard'
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchGuaranteedLoans = async () => {
    try {
      const response = await loansAPI.getGuaranteedLoans(id);

      setGuaranteedLoansData(
        response.data.guaranteedLoans || []
      );
    } catch {
      setGuaranteedLoansData([]);
    }
  };

  const fetchDepositTotals = async () => {
    try {
      const res = await depositsAPI.getSummary(id);

      const deposits = res.data.deposits || [];

      const distributed = deposits.filter(
        (d) => d.depositStatus === 'distributed'
      );

      const fromDeposits = distributed.reduce(
        (sum, d) => sum + Number(d.seedCapitalAmount || 0),
        0
      );

      setDepositSummary({
        othersTotal: distributed.reduce(
          (sum, d) => sum + Number(d.othersAmount || 0),
          0
        ),

        seedCapitalTotal: fromDeposits,
      });
    } catch {}
  };

  const fetchStatutory = async () => {
    try {
      const res = await statutoryAPI.getAll(CURRENT_YEAR);

      const record = (res.data.members || []).find(
        (m) => String(m.id) === String(id)
      );

      if (record) {
        setStatutory({
          statutoryFee: Number(record.statutoryFee || 0),

          guarantorDeduction: Number(
            record.guarantorDeduction || 0
          ),

          other: Number(record.other || 0),
        });
      }
    } catch {}
  };

  const fetchMemberSeedCapital = async () => {
    try {
      const res = await seedCapitalAPI.getByMember(id);

      setMemberSeedCapital(
        Number(res.data?.totalSeedCapital || 0)
      );
    } catch {}
  };

  const fetchYearlySavings = async () => {
    try {
      const res = await savingsAPI.getAll({
        memberId: id,
        year: CURRENT_YEAR,
      });

      const records = res.data.savings || [];

      const total = records
        .filter((s) => s.isPaid && Number(s.amount) > 0)
        .reduce(
          (sum, s) => sum + Number(s.amount || 0),
          0
        );

      setYearlySavings(total);
    } catch (err) {
      console.error(err);
      setYearlySavings(0);
    }
  };

  const fetchYearlyFines = async () => {
    try {
      const res = await finesAPI.getAll({
        memberId: id,
        isPaid: 'false',
        year: CURRENT_YEAR,
      });

      setYearlyFines(res.data.fines || []);
    } catch (err) {
      console.error(err);
      setYearlyFines([]);
    }
  };

  // ────────────────────────────────────────────────────────────
  // Loan calculations
  // ────────────────────────────────────────────────────────────
  const grossLoanAmount =
    yearlySavings > 0 ? yearlySavings * 3 : 0;

  const totalStatutoryDeductions =
    statutory.statutoryFee +
    statutory.guarantorDeduction +
    statutory.other;

  const maxLoanAmount = Math.max(
    0,
    grossLoanAmount - totalStatutoryDeductions
  );

  // ────────────────────────────────────────────────────────────
  // Formatters
  // ────────────────────────────────────────────────────────────
  const fc = (amount) =>
    new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount || 0);

  const fd = (d) =>
    d
      ? new Date(d).toLocaleDateString('en-GB')
      : 'N/A';

  const monthName = (m) =>
    MONTH_NAMES[m - 1] || '—';

  // ────────────────────────────────────────────────────────────
  // Loading / error states
  // ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="dashboard-container">
          <div className="loading">
            Loading dashboard...
          </div>
        </div>
      </>
    );
  }

  if (!dashboardData) {
    return (
      <>
        <Navbar />
        <div className="dashboard-container">
          <div className="error">
            Failed to load dashboard
          </div>
        </div>
      </>
    );
  }

  const { member } = dashboardData;

  const pendingFinesTotal = yearlyFines.reduce(
    (sum, f) => sum + parseFloat(f.amount || 0),
    0
  );

  // ────────────────────────────────────────────────────────────
  // Eye Toggle Component
  // ────────────────────────────────────────────────────────────
  const EyeToggle = ({ visible, onToggle }) => (
    <button
      type="button"
      onClick={onToggle}
      style={{
        background: 'rgba(255,255,255,0.2)',
        border: '1px solid rgba(255,255,255,0.4)',
        borderRadius: '8px',
        cursor: 'pointer',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        minWidth: '32px',
        minHeight: '32px',
        padding: 0,
        marginLeft: '8px',
        zIndex: 999,
      }}
    >
      {visible ? (
        <EyeOff
          color="#ffffff"
          size={18}
          strokeWidth={2.5}
        />
      ) : (
        <Eye
          color="#ffffff"
          size={18}
          strokeWidth={2.5}
        />
      )}
    </button>
  );

  const MASKED = '••••••';

  // ────────────────────────────────────────────────────────────
  // JSX
  // ────────────────────────────────────────────────────────────
  return (
    <>
      <Navbar />

      <div className="dashboard-container">

        {/* Header */}
        <div className="dashboard-header">
          <h1>
            Welcome, {member?.firstName}{' '}
            {member?.lastName}
          </h1>

          <p className="member-since">
            Member since {fd(member?.dateJoined)}
          </p>
        </div>

        {/* HERO CARDS */}
        <div className="cards-row hero-row">

          {/* Savings */}
          <div className="stat-card hero-card savings-hero">

            <div className="hero-icon">
              <Coins size={28} />
            </div>

            <div className="hero-body">

              <div className="hero-label-row">

                <span className="hero-label">
                  Total Savings
                </span>

                <EyeToggle
                  visible={savingsVisible}
                  onToggle={() =>
                    setSavingsVisible((v) => !v)
                  }
                />

              </div>

              <span
                className={`hero-value ${
                  !savingsVisible
                    ? 'hero-value--masked'
                    : ''
                }`}
              >
                {savingsVisible
                  ? fc(yearlySavings)
                  : MASKED}
              </span>

            </div>
          </div>

          {/* Loan */}
          <div className="stat-card hero-card loan-hero">

            <div className="hero-icon">
              <ClipboardList size={28} />
            </div>

            <div className="hero-body">

              <div className="hero-label-row">

                <span className="hero-label">
                  Max Loan Amount
                </span>

                <EyeToggle
                  visible={loanVisible}
                  onToggle={() =>
                    setLoanVisible((v) => !v)
                  }
                />

              </div>

              <span
                className={`hero-value ${
                  !loanVisible
                    ? 'hero-value--masked'
                    : ''
                }`}
              >
                {loanVisible
                  ? fc(maxLoanAmount)
                  : MASKED}
              </span>

            </div>
          </div>

        </div>

      </div>
    </>
  );
};

export default MemberDashboard;