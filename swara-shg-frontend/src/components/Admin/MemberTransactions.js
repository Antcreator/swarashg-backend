import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { membersAPI, savingsAPI, loansAPI, depositsAPI, agmFeeAPI, statutoryAPI, seedCapitalAPI } from '../../Service/Api';
import Navbar from '../Navbar/navbar';
import './MemberTransactions.css';
import { Download, Printer, PiggyBank, FileText, X } from 'lucide-react';

const MemberTransactions = () => {
  const [members, setMembers]               = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [transactions, setTransactions]     = useState([]);
  const [memberLoans, setMemberLoans]       = useState([]);
  const [memberStats, setMemberStats]       = useState(null);
  const [loading, setLoading]               = useState(false);
  const [filter, setFilter]                 = useState('all');

  useEffect(() => { fetchMembers(); }, []);

  const fetchMembers = async () => {
    try {
      const res = await membersAPI.getAll();
      setMembers(res.data.members || []);
    } catch (err) {
      console.error('Failed to fetch members:', err);
    }
  };

  const fetchMemberTransactions = async (memberId) => {
    if (!memberId) return;
    try {
      setLoading(true);
      setTransactions([]);
      setMemberLoans([]);
      setMemberStats(null);

      const year = new Date().getFullYear();

      const [memberRes, savingsRes, loansRes, depositRes, agmRes, statRes, seedRes] = await Promise.allSettled([
        membersAPI.getAll(),
        savingsAPI.getAll({ memberId }),
        loansAPI.getAll({ memberId }),
        depositsAPI.getSummary(memberId),
        agmFeeAPI.getAll(year),
        statutoryAPI.getAll(year),
        seedCapitalAPI.getByMember(memberId),
      ]);

      const member = memberRes.status === 'fulfilled'
        ? memberRes.value.data.members.find(m => m.id === parseInt(memberId))
        : null;
      setSelectedMember(member);

      const savings = (savingsRes.status === 'fulfilled' ? savingsRes.value.data.savings || [] : []).map(s => ({
        ...s, type: 'savings',
        date: s.savingDate || s.paymentDate || s.createdAt,
        description: `Savings deposit - ${s.notes || 'Regular savings'}`,
        amount: Number(s.amount), isCredit: true,
      }));

      const loansData = loansRes.status === 'fulfilled' ? loansRes.value.data.loans || [] : [];
      setMemberLoans(loansData);

      const loans = loansData.map(loan => ({
        ...loan, type: 'loan',
        date: loan.disbursementDate || loan.createdAt,
        description: `Loan ${loan.approvalStatus === 'rejected' ? '(Rejected)' : 'disbursement'} - ${loan.durationMonths} months @ ${loan.interestRate}%`,
        amount: Number(loan.amount), isCredit: false,
      }));

      let payments = [];
      for (const loan of loansData) {
        if (loan.payments?.length > 0) {
          payments = [...payments, ...loan.payments.map(p => ({
            ...p, type: 'payment',
            date: p.paymentDate || p.createdAt,
            description: `Loan payment for Loan #${loan.id} - ${p.notes || p.paymentMethod}`,
            amount: Number(p.amount), isCredit: true,
          }))];
        }
      }

      const allTransactions = [...savings, ...loans, ...payments];
      allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(allTransactions);

      const distributed = depositRes.status === 'fulfilled'
        ? (depositRes.value.data.deposits || []).filter(d => d.depositStatus === 'distributed')
        : [];
      const depositOther = distributed.reduce((s, d) => s + Number(d.othersAmount || 0), 0);

      const liveSeedCapital = seedRes.status === 'fulfilled'
        ? Number(seedRes.value.data?.totalSeedCapital || 0)
        : 0;
      const depositSeedCapital = distributed.reduce((s, d) => s + Number(d.seedCapitalAmount || 0), 0);
      const seedCapital = liveSeedCapital > 0 ? liveSeedCapital : depositSeedCapital;

      const agmMembers = agmRes.status === 'fulfilled' ? agmRes.value.data.members || [] : [];
      const agmRecord  = agmMembers.find(m => String(m.id) === String(memberId));
      const agmFee     = agmRecord ? Number(agmRecord.totalThisYear || 0) : 0;

      const statMembers = statRes.status === 'fulfilled' ? statRes.value.data.members || [] : [];
      const statRecord  = statMembers.find(m => String(m.id) === String(memberId));

      setMemberStats({
        totalSavings:       Number(member?.total_savings || member?.totalSavings || 0),
        seedCapital,
        agmFee,
        savingsFine:        Number(statRecord?.savingsFine        || 0),
        chamaaFine:         Number(statRecord?.chamaaFine         || 0),
        cautionaryFee:      Number(statRecord?.cautionaryFee      || 0),
        guarantorDeduction: Number(statRecord?.guarantorDeduction || 0),
        other:              Number(statRecord?.other || 0) || depositOther,
      });

    } catch (err) {
      console.error('Failed to fetch transactions:', err);
      alert('Failed to load member transactions');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredTransactions = () =>
    filter === 'all' ? transactions : transactions.filter(t => t.type === filter);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount || 0);

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const exportToCSV = () => {
    if (!selectedMember) return;
    const headers = ['Date', 'Type', 'Description', 'Debit', 'Credit'];
    const rows = getFilteredTransactions().map(t => [
      formatDate(t.date), t.type,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.isCredit ? '' : t.amount,
      t.isCredit ? t.amount : '',
    ]);
    const csv = [
      [`Member: ${selectedMember.firstName} ${selectedMember.lastName}`],
      [`Phone: ${selectedMember.phone}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [], [headers.join(',')],
      ...rows.map(r => r.join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = window.URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `transactions-${selectedMember.firstName}-${selectedMember.lastName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    if (!selectedMember) return;
    const win    = window.open('', '_blank');
    const fmtNum = (v) => new Intl.NumberFormat('en-KE', { minimumFractionDigits: 0 }).format(v || 0);
    const typeColor = { savings: '#1976d2', loan: '#c62828', payment: '#2e7d32' };
    const filtered  = getFilteredTransactions();

    const tbodyRows = filtered.map((t, i) => `
      <tr style="background:${i % 2 === 0 ? 'white' : '#f9f9f9'}">
        <td>${formatDate(t.date)}</td>
        <td><span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:${typeColor[t.type]}22;color:${typeColor[t.type]}">${t.type}</span></td>
        <td style="text-align:left">${t.description}</td>
        <td style="color:#c62828;font-weight:600">${!t.isCredit ? fmtNum(t.amount) : ''}</td>
        <td style="color:#2e7d32;font-weight:600">${t.isCredit ? fmtNum(t.amount) : ''}</td>
      </tr>`).join('');

    win.document.write(`<!DOCTYPE html><html><head>
      <title>Transactions - ${selectedMember.firstName} ${selectedMember.lastName}</title>
      <style>
        body { font-family:Arial,sans-serif; font-size:11px; margin:20px; color:#1a1a2e; }
        h1   { font-size:17px; margin-bottom:2px; }
        table { width:100%; border-collapse:collapse; }
        th   { background:#1a1a2e; color:white; padding:7px 8px; text-align:center; font-size:10px; }
        td   { padding:6px 8px; border-bottom:1px solid #e0e0e0; text-align:center; }
        @media print { @page { size:landscape; } }
      </style>
    </head><body>
      <h1>Transaction History — ${selectedMember.firstName} ${selectedMember.lastName}</h1>
      <p style="color:#666;margin:0 0 16px">Phone: ${selectedMember.phone} &nbsp;·&nbsp; ${filtered.length} records &nbsp;·&nbsp; Generated: ${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</p>
      <table>
        <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Debit</th><th>Credit</th></tr></thead>
        <tbody>${tbodyRows}</tbody>
      </table>
      <script>window.onload=()=>{window.print();}<script>
    </body></html>`);
    win.document.close();
  };

  const filteredTransactions = getFilteredTransactions();

  // ── Loan status style — includes rejected ─────────────────────
  const loanStatusStyle = (loan) => {
    // Check approvalStatus first — rejected overrides everything
    if (loan.approvalStatus === 'rejected') return { bg: '#ffebee', color: '#c62828', label: 'Rejected' };
    if (loan.approvalStatus === 'pending')  return { bg: '#fff3e0', color: '#e65100', label: 'Pending'  };
    // Then check loan status
    if (loan.status === 'paid')      return { bg: '#e8f5e9', color: '#2e7d32', label: 'Paid'    };
    if (loan.status === 'active')    return { bg: '#e3f2fd', color: '#1565c0', label: 'Active'  };
    if (loan.status === 'arrears')   return { bg: '#fff8e1', color: '#e65100', label: 'Arrears' };
    if (loan.status === 'default')   return { bg: '#ffebee', color: '#c62828', label: 'Default' };
    if (loan.status === 'topped_up') return { bg: '#f3e5f5', color: '#7b1fa2', label: 'Topped Up' };
    return { bg: '#f5f5f5', color: '#777', label: loan.status || 'Pending' };
  };

  return (
    <>
      <Navbar />
      <div className="member-transactions-container">
        <div className="page-header">
          <Link to="/admin/dashboard" style={{ color: '#1976d2', textDecoration: 'none', fontSize: '14px' }}>← Dashboard</Link>
          <h1>Member Transactions</h1>
          <p>View complete transaction history for any member</p>
        </div>

        <div className="member-selector">
          <label>Select Member:</label>
          <select onChange={(e) => fetchMemberTransactions(e.target.value)} value={selectedMember?.id || ''}>
            <option value="">-- Select a Member --</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.firstName} {m.lastName} - {m.phone}</option>
            ))}
          </select>
        </div>

        {selectedMember && (
          <>
            <div className="member-info-card">
              <h3>{selectedMember.firstName} {selectedMember.lastName}</h3>
              <p>Phone: {selectedMember.phone}</p>
              <p>Member Since: {formatDate(selectedMember.dateJoined)}</p>
            </div>

            {memberStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', margin: '20px 0' }}>

                {/* Card 1 — Financial Summary */}
                <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderTop: '4px solid #1976d2' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1976d2', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <PiggyBank size={15} /> Financial Summary
                  </div>
                  {[
                    { label: 'Total Savings',       value: memberStats.totalSavings,       color: '#1976d2' },
                    { label: 'Seed Capital',         value: memberStats.seedCapital,        color: '#388e3c' },
                    { label: 'AGM Fee',              value: memberStats.agmFee,             color: '#7b1fa2' },
                    { label: 'Savings Fines',        value: memberStats.savingsFine,        color: '#e65100' },
                    { label: 'Chamaa Fines',         value: memberStats.chamaaFine,         color: '#ad1457' },
                    { label: 'Cautionary Fee',       value: memberStats.cautionaryFee,      color: '#f57c00' },
                    { label: 'Guarantor Deduction',  value: memberStats.guarantorDeduction, color: '#00695c' },
                    { label: 'Other',                value: memberStats.other,              color: '#455a64' },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
                      <span style={{ fontSize: '12px', color: '#666' }}>{row.label}</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: row.color }}>{formatCurrency(row.value)}</span>
                    </div>
                  ))}
                </div>

                {/* Loan cards */}
                {memberLoans.length === 0 ? (
                  <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderTop: '4px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: '13px' }}>
                    No loans found
                  </div>
                ) : memberLoans.map((loan) => {
                  const st      = loanStatusStyle(loan);
                  const isRejected = loan.approvalStatus === 'rejected';
                  const balance = Number(loan.remainingBalance ?? (
                    Number(loan.amount) + (Number(loan.amount) * Number(loan.interestRate || 0) / 100)
                    + Number(loan.penaltyInterest || 0) - Number(loan.total_paid || loan.amountPaid || 0)
                  ));
                  const progress = loan.amount > 0
                    ? Math.min(100, Math.round(((Number(loan.total_paid || loan.amountPaid || 0)) / (Number(loan.amount) * (1 + Number(loan.interestRate || 0) / 100))) * 100))
                    : 0;

                  return (
                    <div key={loan.id} style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderTop: `4px solid ${st.color}`, opacity: isRejected ? 0.85 : 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <FileText size={14} /> Loan #{loan.id}
                          {loan.loanType === 'top_up' && (
                            <span style={{ fontSize: '10px', fontWeight: 700, background: '#f3e5f5', color: '#7b1fa2', padding: '1px 6px', borderRadius: '8px', marginLeft: '4px' }}>
                              Top-Up
                            </span>
                          )}
                        </span>
                        <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, background: st.bg, color: st.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {isRejected && <X size={10} />}
                          {st.label}
                        </span>
                      </div>

                      {/* Rejection reason banner */}
                      {isRejected && loan.rejectionReason && (
                        <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '12px', color: '#c62828', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <X size={13} style={{ marginTop: '1px', flexShrink: 0 }} />
                          <span><strong>Rejection reason:</strong> {loan.rejectionReason}</span>
                        </div>
                      )}

                      {[
                        { label: 'Principal',      value: formatCurrency(loan.amount),                                    color: '#1a1a2e' },
                        { label: 'Interest Rate',  value: `${loan.interestRate || 0}%`,                                   color: '#555',   raw: true },
                        { label: 'Duration',       value: `${loan.durationMonths || '—'} months`,                        color: '#555',   raw: true },
                        { label: 'Applied On',     value: formatDate(loan.createdAt),                                     color: '#555',   raw: true },
                        ...(!isRejected ? [
                          { label: 'Disbursed',    value: formatDate(loan.disbursementDate),                              color: '#555',   raw: true },
                          { label: 'Due Date',     value: formatDate(loan.dueDate),                                       color: loan.isOverdue ? '#c62828' : '#555', raw: true },
                          { label: 'Amount Paid',  value: formatCurrency(loan.total_paid || loan.amountPaid || 0),        color: '#2e7d32' },
                          { label: 'Balance',      value: formatCurrency(balance),                                        color: balance > 0 ? '#c62828' : '#2e7d32' },
                        ] : []),
                      ].map(row => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
                          <span style={{ fontSize: '12px', color: '#666' }}>{row.label}</span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: row.color }}>{row.value}</span>
                        </div>
                      ))}

                      {loan.guarantors && loan.guarantors.length > 0 && (
                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f0f0f0' }}>
                          <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px', fontWeight: 600 }}>GUARANTORS</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {loan.guarantors.map((g, gi) => {
                              const name = g.guarantorId === -1
                                ? 'The Office'
                                : g.guarantor
                                  ? `${g.guarantor.firstName} ${g.guarantor.lastName}`
                                  : `Guarantor #${gi + 1}`;
                              const statusColors = {
                                accepted:       { bg: '#e8f5e9', color: '#2e7d32' },
                                pending:        { bg: '#fff8e1', color: '#e65100' },
                                rejected:       { bg: '#ffebee', color: '#c62828' },
                                admin_override: { bg: '#e3f2fd', color: '#1565c0' },
                              };
                              const sc = statusColors[g.approvalStatus] || { bg: '#f5f5f5', color: '#777' };
                              return (
                                <span key={g.id || gi} style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: sc.bg, color: sc.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  {g.approvalStatus === 'rejected' && <X size={9} />}
                                  {name}
                                  <span style={{ opacity: 0.7, fontSize: '10px' }}>· {g.approvalStatus === 'admin_override' ? 'override' : g.approvalStatus}</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Progress bar — only for non-rejected loans */}
                      {!isRejected && (
                        <div style={{ marginTop: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                            <span>Repayment progress</span>
                            <span>{progress}%</span>
                          </div>
                          <div style={{ background: '#f0f0f0', borderRadius: '6px', height: '7px', overflow: 'hidden' }}>
                            <div style={{ width: `${progress}%`, height: '100%', background: progress >= 100 ? '#2e7d32' : '#1976d2', borderRadius: '6px', transition: 'width 0.4s' }} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Controls */}
            <div className="controls">
              <div className="filter-buttons">
                <button className={filter === 'all'     ? 'active' : ''} onClick={() => setFilter('all')}>All ({transactions.length})</button>
                <button className={filter === 'savings' ? 'active' : ''} onClick={() => setFilter('savings')}>Savings ({transactions.filter(t => t.type === 'savings').length})</button>
                <button className={filter === 'loan'    ? 'active' : ''} onClick={() => setFilter('loan')}>Loans ({transactions.filter(t => t.type === 'loan').length})</button>
                <button className={filter === 'payment' ? 'active' : ''} onClick={() => setFilter('payment')}>Payments ({transactions.filter(t => t.type === 'payment').length})</button>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-export" onClick={exportToCSV} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Download size={14} /> CSV
                </button>
                <button className="btn-export" onClick={exportToPDF} style={{ background: '#c62828', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Printer size={14} /> PDF
                </button>
              </div>
            </div>

            {loading ? (
              <div className="loading">Loading transactions...</div>
            ) : filteredTransactions.length === 0 ? (
              <div className="no-transactions"><p>No transactions found</p></div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th><th>Type</th><th>Description</th><th>Debit</th><th>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((t, index) => {
                      const isRejectedLoan = t.type === 'loan' && t.approvalStatus === 'rejected';
                      return (
                        <tr key={`${t.type}-${t.id}-${index}`} style={isRejectedLoan ? { opacity: 0.65, background: '#fff5f5' } : {}}>
                          <td>{formatDate(t.date)}</td>
                          <td>
                            <span className={`type-badge ${t.type}`} style={isRejectedLoan ? { textDecoration: 'line-through' } : {}}>
                              {t.type}
                            </span>
                            {isRejectedLoan && (
                              <span style={{ marginLeft: '4px', fontSize: '10px', fontWeight: 700, background: '#ffebee', color: '#c62828', padding: '1px 6px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <X size={9} /> Rejected
                              </span>
                            )}
                          </td>
                          <td style={isRejectedLoan ? { color: '#999' } : {}}>{t.description}</td>
                          <td className="amount debit" style={isRejectedLoan ? { textDecoration: 'line-through', color: '#ccc' } : {}}>{!t.isCredit && formatCurrency(t.amount)}</td>
                          <td className="amount credit">{t.isCredit && formatCurrency(t.amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default MemberTransactions;