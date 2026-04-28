import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { loansAPI } from '../../Service/Api';
import Navbar from '../Navbar/navbar';
import './Defaulters.css';

const Defaulters = () => {
  const [defaulters, setDefaulters] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [sortBy, setSortBy]         = useState('balance');

  useEffect(() => { fetchDefaulters(); }, []);

  const fetchDefaulters = async () => {
    try {
      setLoading(true);
      const res      = await loansAPI.getAll();
      const allLoans = res.data.loans || [];

      const defaultedLoans = allLoans.filter(loan =>
        loan.status === 'default' || loan.status === 'arrears'
      );

      const enriched = defaultedLoans.map(loan => {
        const dueDate     = loan.dueDate ? new Date(loan.dueDate) : null;
        const overdueDays = dueDate
          ? Math.max(0, Math.floor((new Date() - dueDate) / (1000 * 60 * 60 * 24)))
          : 0;

        // ── Months overdue (ceiling so day 1–30 = 1 month) ──
        const overdueMonths = Math.ceil(overdueDays / 30);

        const principal       = Number(loan.amount        || 0);
        const interestRate    = Number(loan.interestRate   || 0);
        const txFee           = Number(loan.transactionFee ?? 108);
        const amountPaid      = Number(loan.amountPaid     || 0);

        const totalRepayment  = principal + (principal * interestRate / 100) + txFee;
        const baseLoanBalance = Math.max(0, totalRepayment - amountPaid);

        // ── Flat 5% per month on base balance ──────────────
        const cappedMonths    = Math.min(overdueMonths, 3); // cap at 3 for default
        const penaltyInterest = Math.round(baseLoanBalance * 0.05 * cappedMonths * 100) / 100;
        const totalDue        = baseLoanBalance + penaltyInterest;

        return {
          ...loan,
          memberName: loan.member
            ? `${loan.member.firstName} ${loan.member.lastName}`
            : 'Unknown',
          overdueDays,
          overdueMonths,
          cappedMonths,
          principal,
          totalRepayment,
          amountPaid,
          baseLoanBalance,
          penaltyInterest,
          totalDue,
        };
      });

      setDefaulters(enriched);
    } catch (err) {
      console.error('Failed to fetch defaulters:', err);
      alert('Failed to load defaulters list');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (amount) =>
    new Intl.NumberFormat('en-KE', {
      style: 'currency', currency: 'KES', minimumFractionDigits: 0,
    }).format(amount || 0);

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-KE', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  const getSortedDefaulters = () => {
    const sorted = [...defaulters];
    if (sortBy === 'balance')      sorted.sort((a, b) => b.totalDue      - a.totalDue);
    if (sortBy === 'overdueMonths') sorted.sort((a, b) => b.overdueMonths - a.overdueMonths);
    return sorted;
  };

  const totalOutstanding = defaulters.reduce((sum, l) => sum + l.totalDue,        0);
  const totalPenalties   = defaulters.reduce((sum, l) => sum + l.penaltyInterest, 0);
  const totalBaseLoan    = defaulters.reduce((sum, l) => sum + l.baseLoanBalance,  0);

  const exportToCSV = () => {
    const headers = [
      'Member', 'Loan Amount', 'Total Repayable',
      'Amount Paid', 'Loan Balance', 'Months Overdue',
      'Penalty (5%/month)', 'Total Due', 'Due Date', 'Status',
    ];
    const rows = defaulters.map(d => [
      d.memberName,
      d.principal,
      d.totalRepayment,
      d.amountPaid,
      d.baseLoanBalance,
      d.cappedMonths,
      d.penaltyInterest,
      d.totalDue,
      formatDate(d.dueDate),
      d.status,
    ]);
    const csv  = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = window.URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `defaulters-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sortedDefaulters = getSortedDefaulters();

  if (loading) return (
    <><Navbar /><div className="defaulters-container"><div className="loading">Loading defaulters...</div></div></>
  );

  return (
    <>
      <Navbar />
      <div className="defaulters-container">
        <Link to="/admin/dashboard" style={{ color: '#1976d2', textDecoration: 'none', fontSize: '14px' }}>
          ← Dashboard
        </Link>

        <div className="page-header">
          <h1>Loan Defaulters</h1>
          <p>Members with loans in arrears or default status</p>
        </div>

        <div className="controls">
          <div className="sort-selector">
            <label>Sort By:</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="balance">Outstanding Amount</option>
              <option value="overdueMonths">Months Overdue</option>
            </select>
          </div>
          <button className="btn-export" onClick={exportToCSV} disabled={defaulters.length === 0}>
            📥 Export to CSV
          </button>
        </div>

        {/* Summary cards */}
        <div className="summary-cards">
          <div className="summary-card danger">
            <h3>Total Defaulters</h3>
            <p className="count">{defaulters.length}</p>
          </div>
          <div className="summary-card danger">
            <h3>Total Outstanding</h3>
            <p className="amount">{fmt(totalOutstanding)}</p>
            <small style={{ color: '#999', fontSize: '11px' }}>Loan balance + penalties</small>
          </div>
          <div className="summary-card warning">
            <h3>In Arrears</h3>
            <p className="count">{defaulters.filter(d => d.status === 'arrears').length}</p>
          </div>
          <div className="summary-card danger">
            <h3>In Default</h3>
            <p className="count">{defaulters.filter(d => d.status === 'default').length}</p>
          </div>
        </div>

        {defaulters.length === 0 ? (
          <div className="no-defaulters">
            <div className="success-icon">✓</div>
            <h3>No Defaulters</h3>
            <p>All loans are being repaid on time!</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Member</th>
                  <th>
                    Loan Balance
                    <div style={{ fontWeight: 400, fontSize: '11px', color: '#aaa' }}>
                      (principal + interest + fee − paid)
                    </div>
                  </th>
                  <th>
                    Months Overdue
                    <div style={{ fontWeight: 400, fontSize: '11px', color: '#aaa' }}>
                      (max 3 months)
                    </div>
                  </th>
                  <th>
                    Penalty Interest
                    <div style={{ fontWeight: 400, fontSize: '11px', color: '#aaa' }}>
                      (5% × months overdue)
                    </div>
                  </th>
                  <th>
                    Total Due
                    <div style={{ fontWeight: 400, fontSize: '11px', color: '#aaa' }}>
                      (balance + penalty)
                    </div>
                  </th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedDefaulters.map((loan, index) => (
                  <tr key={loan.id}>
                    <td>{index + 1}</td>

                    <td>
                      <strong>{loan.memberName}</strong><br />
                      <small style={{ color: '#888' }}>
                        Loan #{loan.id} · Original: {fmt(loan.principal)}
                      </small>
                    </td>

                    {/* Loan balance */}
                    <td className="amount">
                      {fmt(loan.baseLoanBalance)}
                      <div style={{ fontSize: '11px', color: '#888' }}>
                        Paid: {fmt(loan.amountPaid)}
                      </div>
                    </td>

                    {/* Months overdue */}
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        background:   loan.cappedMonths >= 3 ? '#ffebee' : '#fff8e1',
                        color:        loan.cappedMonths >= 3 ? '#c62828' : '#e65100',
                        padding:      '3px 12px',
                        borderRadius: '12px',
                        fontWeight:   700,
                        fontSize:     '13px',
                        display:      'inline-block',
                      }}>
                        {loan.cappedMonths} month{loan.cappedMonths !== 1 ? 's' : ''}
                      </span>
                      {loan.overdueMonths > 3 && (
                        <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>
                          ({loan.overdueDays} days total)
                        </div>
                      )}
                    </td>

                    {/* Penalty */}
                    <td className="amount" style={{ color: loan.penaltyInterest > 0 ? '#e65100' : 'inherit' }}>
                      {loan.penaltyInterest > 0 ? (
                        <>
                          {fmt(loan.penaltyInterest)}
                          <div style={{ fontSize: '11px', color: '#888' }}>
                            5% × {loan.cappedMonths} mo
                          </div>
                        </>
                      ) : '—'}
                    </td>

                    {/* Total Due */}
                    <td className="amount danger">
                      <strong>{fmt(loan.totalDue)}</strong>
                      <div style={{ fontSize: '11px', color: '#888' }}>
                        {fmt(loan.baseLoanBalance)} + {fmt(loan.penaltyInterest)}
                      </div>
                    </td>

                    <td>{formatDate(loan.dueDate)}</td>

                    <td>
                      <span className={`status-badge ${loan.status}`}>
                        {loan.status === 'arrears' ? '⚠️ Arrears' : '🚨 Default'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr>
                  <td colSpan="2"><strong>TOTALS</strong></td>
                  <td className="amount"><strong>{fmt(totalBaseLoan)}</strong></td>
                  <td></td>
                  <td className="amount" style={{ color: '#e65100' }}>
                    <strong>{fmt(totalPenalties)}</strong>
                  </td>
                  <td className="amount danger">
                    <strong>{fmt(totalOutstanding)}</strong>
                  </td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default Defaulters;