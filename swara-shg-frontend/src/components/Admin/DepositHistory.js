import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { depositsAPI } from '../../Service/Api';
import Navbar from '../Navbar/navbar';
import {
  History, CheckCircle, XCircle, Clock, Search, Smartphone,
  ChevronDown, ChevronUp, Calendar, UserCheck, X,
} from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmt = (v) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(v || 0);

const personName = (u) => {
  if (!u) return null;
  const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return full || u.email || null;
};

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

// YYYY-MM-DD in the viewer's local time (used for grouping and the date-range filter)
const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

const dayLabel = (d) =>
  new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

// One line per category the member allocated this deposit to
const distributionOf = (d) => {
  const rows = [];
  const add = (label, amount, extra) => {
    if (Number(amount) > 0) rows.push({ label, amount: Number(amount), extra: extra || '' });
  };
  const slots = Array.isArray(d.chamaaSlotIds) ? d.chamaaSlotIds.length : 0;
  add('Savings', d.savingsAmount, d.savingsMonth ? `for ${MONTHS[d.savingsMonth - 1]} ${d.savingsYear}` : '');
  add('Loan payment', d.loanPaymentAmount, d.loanId ? `Loan #${d.loanId}` : '');
  add('Chamaa', d.chamaaPaymentAmount, [
    d.chamaaMonth ? `for ${MONTHS[d.chamaaMonth - 1]} ${d.chamaaYear}` : '',
    slots > 0 ? `${slots} slot${slots > 1 ? 's' : ''}` : '',
  ].filter(Boolean).join(' · '));
  add('Seed capital', d.seedCapitalAmount);
  add('Savings fine', d.savingsFineAmount);
  add('Chamaa fine', d.chamaaFineAmount);
  add('AGM fee', d.agmFeeAmount);
  add('Others', d.othersAmount);
  return rows;
};

const statusOf = (d) => {
  if (d.depositStatus === 'distributed')
    return { key: 'approved', label: 'Approved', bg: '#e8f5e9', color: '#2e7d32', Icon: CheckCircle };
  if (d.depositStatus === 'rejected')
    return { key: 'rejected', label: 'Rejected', bg: '#ffebee', color: '#c62828', Icon: XCircle };
  return { key: 'pending', label: d.depositStatus === 'confirmed' ? 'Confirmed' : 'Pending', bg: '#fff3e0', color: '#e65100', Icon: Clock };
};

const DepositHistory = () => {
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [status, setStatus]     = useState('all');
  const [from, setFrom]         = useState('');
  const [to, setTo]             = useState('');
  const [open, setOpen]         = useState({});

  useEffect(() => {
    (async () => {
      try {
        const res = await depositsAPI.getAll({});
        setDeposits(res.data.deposits || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load deposits');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deposits.filter(d => {
      const st = statusOf(d);
      if (status !== 'all' && st.key !== status) return false;
      const k = dayKey(d.createdAt);
      if (from && k < from) return false;
      if (to && k > to) return false;
      if (q) {
        const name = `${d.member?.firstName || ''} ${d.member?.lastName || ''}`.toLowerCase();
        if (!name.includes(q) && !(d.mpesaCode || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [deposits, search, status, from, to]);

  // Group by the day the deposit was made (the API already returns newest first)
  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach(d => {
      const k = dayKey(d.createdAt);
      if (!map.has(k)) map.set(k, { key: k, label: dayLabel(d.createdAt), items: [], total: 0 });
      const g = map.get(k);
      g.items.push(d);
      g.total += Number(d.totalAmount || 0);
    });
    return Array.from(map.values());
  }, [filtered]);

  const sum = (arr) => arr.reduce((s, d) => s + Number(d.totalAmount || 0), 0);
  const approved = filtered.filter(d => statusOf(d).key === 'approved');
  const rejected = filtered.filter(d => statusOf(d).key === 'rejected');
  const pending  = filtered.filter(d => statusOf(d).key === 'pending');

  const hasFilters = search || status !== 'all' || from || to;
  const clearFilters = () => { setSearch(''); setStatus('all'); setFrom(''); setTo(''); };

  const s = {
    page:      { minHeight: '100vh', background: '#f8f9fa' },
    container: { maxWidth: '1100px', margin: '0 auto', padding: '24px 20px' },
    input:     { padding: '9px 12px', border: '1.5px solid #ddd', borderRadius: '8px', fontSize: '14px', background: 'white' },
    card:      { background: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  };

  const summary = [
    { label: 'All deposits', count: filtered.length, amount: sum(filtered), color: '#1565c0' },
    { label: 'Approved',     count: approved.length, amount: sum(approved), color: '#2e7d32' },
    { label: 'Rejected',     count: rejected.length, amount: sum(rejected), color: '#c62828' },
    { label: 'Pending',      count: pending.length,  amount: sum(pending),  color: '#e65100' },
  ];

  return (
    <div style={s.page}>
      <Navbar />
      <div style={s.container}>
        <Link to="/admin/dashboard" style={{ color: '#1976d2', textDecoration: 'none', fontSize: '14px' }}>← Dashboard</Link>
        <h1 style={{ margin: '6px 0 4px', fontSize: '26px', color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 8 }}>
          <History size={24} /> Deposit History
        </h1>
        <p style={{ margin: '0 0 22px', color: '#777', fontSize: '14px' }}>
          Every deposit by date, how it was distributed, and who approved it.
        </p>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
          {summary.map(c => (
            <div key={c.label} style={{ ...s.card, padding: '14px 16px', borderTop: `3px solid ${c.color}` }}>
              <div style={{ fontSize: 12, color: '#777' }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.count}</div>
              <div style={{ fontSize: 12, color: '#555' }}>{fmt(c.amount)}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ ...s.card, padding: 14, marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ ...s.input, display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 220px' }}>
            <Search size={14} color="#888" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search member or M-PESA code…"
              style={{ border: 'none', outline: 'none', fontSize: 14, flex: 1, minWidth: 0, background: 'transparent' }}
            />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)} style={s.input}>
            <option value="all">All statuses</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
          <label style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 6 }}>
            From <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={s.input} />
          </label>
          <label style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 6 }}>
            To <input type="date" value={to} onChange={e => setTo(e.target.value)} style={s.input} />
          </label>
          {hasFilters && (
            <button onClick={clearFilters}
              style={{ padding: '8px 12px', border: '1px solid #ddd', background: '#f5f5f5', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <X size={12} /> Clear
            </button>
          )}
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Loading deposits…</div>}
        {error && <div style={{ ...s.card, padding: 16, color: '#c62828' }}>{error}</div>}

        {!loading && !error && filtered.length === 0 && (
          <div style={{ ...s.card, padding: 48, textAlign: 'center', color: '#888' }}>
            {deposits.length === 0 ? 'No deposits have been made yet.' : 'No deposits match your filters.'}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <p style={{ fontSize: 12, color: '#888', margin: '0 0 10px' }}>
            Showing {filtered.length} of {deposits.length} deposits
          </p>
        )}

        {/* Deposits grouped by day */}
        {groups.map(g => (
          <div key={g.key} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '0 0 8px', color: '#1a1a2e' }}>
              <Calendar size={15} color="#1565c0" />
              <strong style={{ fontSize: 15 }}>{g.label}</strong>
              <span style={{ fontSize: 12, color: '#777' }}>
                · {g.items.length} deposit{g.items.length !== 1 ? 's' : ''} · {fmt(g.total)}
              </span>
            </div>

            {g.items.map(d => {
              const st    = statusOf(d);
              const dist  = distributionOf(d);
              const given = dist.reduce((a, r) => a + r.amount, 0);
              const unallocated = Number(d.totalAmount || 0) - given;
              const isOpen = !!open[d.id];
              const approver = personName(d.depositApprover) || personName(d.confirmer);
              const rejecter = personName(d.confirmer);

              return (
                <div key={d.id} style={{ ...s.card, padding: 14, marginBottom: 10, borderLeft: `4px solid ${st.color}` }}>
                  {/* Top row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}>
                        {d.member ? `${d.member.firstName} ${d.member.lastName}` : 'Unknown member'}
                      </div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span>{fmtTime(d.createdAt)}</span>
                        <span style={{ fontFamily: 'monospace', background: '#f0f4ff', color: '#1a3a8f', padding: '1px 6px', borderRadius: 5, border: '1px solid #c7d4f7' }}>
                          {d.mpesaCode}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e' }}>{fmt(d.totalAmount)}</div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: st.bg, color: st.color }}>
                        <st.Icon size={12} /> {st.label}
                      </span>
                    </div>
                  </div>

                  {/* Who approved / rejected */}
                  <div style={{ marginTop: 10, fontSize: 13, color: st.color, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {st.key === 'approved' && (
                      <><UserCheck size={14} /> Approved by <strong>{approver || 'an admin'}</strong>
                        {(d.approvedAt || d.confirmedAt) && <span style={{ color: '#888' }}>· {fmtDateTime(d.approvedAt || d.confirmedAt)}</span>}</>
                    )}
                    {st.key === 'rejected' && (
                      <><XCircle size={14} /> Rejected by <strong>{rejecter || 'an admin'}</strong>
                        {d.confirmedAt && <span style={{ color: '#888' }}>· {fmtDateTime(d.confirmedAt)}</span>}
                        {d.rejectionReason && <span style={{ color: '#555' }}>— {d.rejectionReason}</span>}</>
                    )}
                    {st.key === 'pending' && (<><Clock size={14} /> Awaiting approval</>)}
                  </div>

                  {/* Distribution */}
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {dist.length === 0 ? (
                      <span style={{ fontSize: 12, color: '#aaa' }}>No distribution recorded</span>
                    ) : dist.map(r => (
                      <span key={r.label} style={{ fontSize: 12, background: '#f5f7fa', border: '1px solid #e3e8ef', borderRadius: 8, padding: '4px 9px', color: '#333' }}>
                        <strong>{r.label}</strong> {fmt(r.amount)}
                        {r.extra && <span style={{ color: '#888' }}> · {r.extra}</span>}
                      </span>
                    ))}
                    {unallocated > 0 && (
                      <span style={{ fontSize: 12, background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, padding: '4px 9px', color: '#e65100' }}>
                        <strong>Unallocated</strong> {fmt(unallocated)}
                      </span>
                    )}
                  </div>

                  {/* Details toggle */}
                  <button
                    onClick={() => setOpen(o => ({ ...o, [d.id]: !o[d.id] }))}
                    style={{ marginTop: 10, background: 'none', border: 'none', color: '#1976d2', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {isOpen ? 'Hide details' : 'Details'}
                  </button>

                  {isOpen && (
                    <div style={{ marginTop: 10, padding: 12, background: '#fafafa', borderRadius: 8, fontSize: 12, color: '#555' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 6, color: '#e65100' }}>
                        <Smartphone size={13} /> M-PESA message
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 8 }}>
                        {d.mpesaMessage || 'No message provided.'}
                      </div>
                      <div>Submitted: {fmtDateTime(d.createdAt)}</div>
                      {d.notes && <div style={{ marginTop: 4 }}>Member note: <em>{d.notes}</em></div>}
                      {d.confirmationNotes && <div style={{ marginTop: 4 }}>Admin note: <em>{d.confirmationNotes}</em></div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DepositHistory;