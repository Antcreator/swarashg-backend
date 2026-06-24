import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import Navbar from '../Navbar/navbar';
import { finesAPI, loansAPI } from '../../Service/Api';
import { useIsStaff } from '../Protected Route/Protectedroute';
import '../MembersManagementAdmin/Members.css';
import {
  AlertTriangle, PiggyBank, RefreshCw, Check, X, Trash2,
  CheckCircle, ArrowLeft, Banknote, ChevronDown, ChevronUp,
} from 'lucide-react';

const POLL_INTERVAL_MS = 15_000;

const FinesPage = () => {
  const isStaff  = useIsStaff();
  const location = useLocation();
  const params   = new URLSearchParams(location.search);
  const defaultType = params.get('type') || 'all';

  const [fines, setFines]         = useState([]);
  const [activeTab, setActiveTab] = useState(defaultType);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [stats, setStats]         = useState({
    savingsFineTotal: 0, chamaaFineTotal: 0,
    arrearsTotal: 0, unpaidFinesCount: 0,
  });

  // Real-time arrears from loansAPI.getArrearsStats()
  const [arrearsDetails, setArrearsDetails]         = useState([]);
  const [arrearsRealTotal, setArrearsRealTotal]     = useState(0);
  const [showArrearsBreakdown, setShowArrearsBreakdown] = useState(false);

  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing]   = useState(false);

  const pollRef = useRef(null);

  const fetchFines = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      const res = await finesAPI.getAll();
      setFines(res.data.fines || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch fines:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await finesAPI.getStats();
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch fines stats:', err);
    }
  };

  // Fetch real-time arrears from loans endpoint
  const fetchArrearsStats = async () => {
    try {
      const res = await loansAPI.getArrearsStats();
      setArrearsDetails(res.data.details || []);
      setArrearsRealTotal(res.data.totalPenalty || 0);
    } catch (err) {
      console.error('Failed to fetch arrears stats:', err);
    }
  };

  const refreshAll = async (silent = false) => {
    await Promise.all([fetchFines(silent), fetchStats(), fetchArrearsStats()]);
  };

  useEffect(() => {
    refreshAll(false);
    pollRef.current = setInterval(() => { refreshAll(true); }, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMarkPaid = async (id) => {
    if (!window.confirm('Mark this fine as paid?')) return;
    try {
      await finesAPI.markPaid(id);
      refreshAll(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to mark fine as paid');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this fine record?')) return;
    try {
      await finesAPI.delete(id);
      refreshAll(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete fine');
    }
  };

  const fmt = (n) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n || 0);

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const filtered = fines.filter(f => {
    const matchesTab = activeTab === 'all' || f.fineType === activeTab;
    const name = `${f.member?.firstName} ${f.member?.lastName}`.toLowerCase();
    return matchesTab && name.includes(search.toLowerCase());
  });

  const tabTotal = filtered.reduce((s, f) => s + Number(f.amount || 0), 0);

  const FineTypeBadge = ({ fineType }) => {
    const cfg = {
      savings_late: { bg:'#fff3e0', color:'#e65100', border:'#ff9800', icon:<PiggyBank size={11} />, label:'Savings'  },
      chamaa_late:  { bg:'#fce4ec', color:'#880e4f', border:'#e91e63', icon:<RefreshCw size={11} />, label:'Chamaa'   },
      loan_arrears: { bg:'#fff8e1', color:'#e65100', border:'#ffc107', icon:<Banknote size={11} />,  label:'Arrears'  },
      loan_default: { bg:'#ffebee', color:'#b71c1c', border:'#f44336', icon:<AlertTriangle size={11} />, label:'Default' },
    }[fineType] || { bg:'#f5f5f5', color:'#555', border:'#ccc', icon:null, label: fineType };

    return (
      <span style={{
        padding:'3px 10px', borderRadius:'12px', fontSize:'12px', fontWeight:'600',
        background: cfg.bg, color: cfg.color, border:`1px solid ${cfg.border}`,
        display:'inline-flex', alignItems:'center', gap:5,
      }}>
        {cfg.icon} {cfg.label}
      </span>
    );
  };

  return (
    <>
      <Navbar />
      <div className="admin-container">

        {/* Page Header */}
        <div className="page-header">
          <div>
            <Link to="/admin/dashboard" style={{ display:'inline-flex', alignItems:'center', gap:'4px', color:'#1976d2', textDecoration:'none', fontSize:'14px' }}>
              <ArrowLeft size={14} /> Dashboard
            </Link>
            <h1 style={{ display:'flex', alignItems:'center', gap:8, margin:'6px 0 0' }}>
              <AlertTriangle size={24} /> Member Fines
            </h1>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            {lastUpdated && (
              <span style={{ fontSize:'12px', color:'#888' }}>
                {refreshing ? (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                    <RefreshCw size={12} style={{ animation:'spin 1s linear infinite' }} /> Updating…
                  </span>
                ) : `Updated ${lastUpdated.toLocaleTimeString()}`}
              </span>
            )}
            <button onClick={() => refreshAll(true)} disabled={refreshing}
              style={{ padding:'6px 12px', borderRadius:'6px', border:'1px solid #ddd', background:'#fff', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5, fontSize:'13px', color:'#555' }}>
              <RefreshCw size={14} style={refreshing ? { animation:'spin 1s linear infinite' } : {}} /> Refresh
            </button>
            <input type="text" placeholder="Search member…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ padding:'8px 14px', borderRadius:'6px', border:'1px solid #ddd', fontSize:'14px', width:'220px' }} />
          </div>
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

        {/* Stats cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:'16px', marginBottom:'24px' }}>

          {/* Savings Fines */}
          <div style={{ background:'#fff3e0', border:'2px solid #ff9800', borderRadius:'10px', padding:'18px' }}>
            <p style={{ margin:'0 0 4px', color:'#555', fontSize:'13px' }}>Savings Fines</p>
            <p style={{ margin:0, fontSize:'22px', fontWeight:'bold', color:'#e65100' }}>{fmt(stats.savingsFineTotal)}</p>
          </div>

          {/* Chamaa Fines */}
          <div style={{ background:'#fce4ec', border:'2px solid #e91e63', borderRadius:'10px', padding:'18px' }}>
            <p style={{ margin:'0 0 4px', color:'#555', fontSize:'13px' }}>Chamaa Fines</p>
            <p style={{ margin:0, fontSize:'22px', fontWeight:'bold', color:'#880e4f' }}>{fmt(stats.chamaaFineTotal)}</p>
          </div>

          {/* Arrears Penalties — real-time with member breakdown */}
          <div style={{
            background:'#fff8e1', border:'2px solid #ffc107', borderRadius:'10px', padding:'18px',
            gridColumn: arrearsDetails.length > 0 ? 'span 2' : 'span 1',
          }}>
            {/* Header row */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
              <p style={{ margin:0, color:'#555', fontSize:'13px' }}>
                Arrears Penalties
                <span style={{
                  marginLeft:'8px', fontSize:'11px', fontWeight:600,
                  background:'#ffe082', color:'#e65100', borderRadius:'10px', padding:'1px 7px',
                }}>
                  Real-time · 5% / month
                </span>
              </p>
              {arrearsDetails.length > 0 && (
                <button
                  onClick={() => setShowArrearsBreakdown(p => !p)}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'#e65100', display:'inline-flex', alignItems:'center', gap:3, fontSize:'12px', fontWeight:600, padding:'2px 6px' }}
                >
                  {showArrearsBreakdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {showArrearsBreakdown ? 'Hide' : 'Show'} breakdown
                </button>
              )}
            </div>

            {/* Total */}
            <p style={{ margin:'0 0 0', fontSize:'26px', fontWeight:'900', color:'#e65100' }}>
              {fmt(arrearsRealTotal)}
            </p>
            <p style={{ margin:'2px 0 0', fontSize:'12px', color:'#888' }}>
              {arrearsDetails.length} loan{arrearsDetails.length !== 1 ? 's' : ''} in arrears/default
            </p>

            {/* Member breakdown — shown when toggled */}
            {showArrearsBreakdown && arrearsDetails.length > 0 && (
              <div style={{ marginTop:'14px', borderTop:'1px solid #ffe082', paddingTop:'12px' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                  <thead>
                    <tr style={{ background:'#fff8e1' }}>
                      <th style={{ textAlign:'left', padding:'6px 8px', color:'#888', fontWeight:600 }}>Member</th>
                      <th style={{ textAlign:'right', padding:'6px 8px', color:'#888', fontWeight:600 }}>Orig. Principal</th>
                      <th style={{ textAlign:'right', padding:'6px 8px', color:'#888', fontWeight:600 }}>Rem. Principal</th>
                      <th style={{ textAlign:'center', padding:'6px 8px', color:'#888', fontWeight:600 }}>Months</th>
                      <th style={{ textAlign:'right', padding:'6px 8px', color:'#888', fontWeight:600 }}>Monthly Fine</th>
                      <th style={{ textAlign:'right', padding:'6px 8px', color:'#888', fontWeight:600 }}>Total Penalty</th>
                      <th style={{ textAlign:'right', padding:'6px 8px', color:'#888', fontWeight:600 }}>Total Due</th>
                      <th style={{ textAlign:'center', padding:'6px 8px', color:'#888', fontWeight:600 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arrearsDetails.map((d, i) => (
                      <tr key={d.loanId} style={{ borderTop:'1px solid #fff3cd', background: i % 2 === 0 ? 'white' : '#fffef5' }}>
                        {/* Member name */}
                        <td style={{ padding:'8px 8px', fontWeight:700 }}>
                          {d.memberName}
                          <div style={{ fontSize:'11px', color:'#aaa', fontWeight:400 }}>Loan #{d.loanId}</div>
                        </td>

                        {/* Original principal */}
                        <td style={{ padding:'8px 8px', textAlign:'right', color:'#888', textDecoration:'line-through', fontSize:'12px' }}>
                          {fmt(d.originalPrincipal)}
                        </td>

                        {/* Remaining principal */}
                        <td style={{ padding:'8px 8px', textAlign:'right', fontWeight:700, color: d.remainingPrincipal < d.originalPrincipal ? '#2e7d32' : '#1a1a2e' }}>
                          {fmt(d.remainingPrincipal)}
                          {d.remainingPrincipal < d.originalPrincipal && (
                            <div style={{ fontSize:'10px', color:'#2e7d32', fontWeight:400 }}>
                              {fmt(d.originalPrincipal - d.remainingPrincipal)} paid off
                            </div>
                          )}
                        </td>

                        {/* Months overdue */}
                        <td style={{ padding:'8px 8px', textAlign:'center' }}>
                          <span style={{
                            background: d.cappedMonths >= 3 ? '#ffebee' : '#fff8e1',
                            color:      d.cappedMonths >= 3 ? '#c62828' : '#e65100',
                            padding:'2px 10px', borderRadius:'10px', fontWeight:700, fontSize:'12px',
                          }}>
                            {d.cappedMonths}mo
                          </span>
                          <div style={{ fontSize:'10px', color:'#aaa', marginTop:2 }}>{d.overdueDays}d</div>
                        </td>

                        {/* Monthly fine */}
                        <td style={{ padding:'8px 8px', textAlign:'right', color:'#e65100', fontWeight:600 }}>
                          {fmt(d.monthlyPenalty)}
                          <div style={{ fontSize:'10px', color:'#aaa' }}>5% × {fmt(d.remainingPrincipal)}</div>
                        </td>

                        {/* Total penalty */}
                        <td style={{ padding:'8px 8px', textAlign:'right', color:'#c62828', fontWeight:700 }}>
                          {fmt(d.penaltyInterest)}
                          <div style={{ fontSize:'10px', color:'#aaa' }}>{fmt(d.monthlyPenalty)} × {d.cappedMonths}</div>
                        </td>

                        {/* Total due */}
                        <td style={{ padding:'8px 8px', textAlign:'right', fontWeight:900, color:'#b71c1c', fontSize:'14px' }}>
                          {fmt(d.totalDue)}
                          <div style={{ fontSize:'10px', color:'#aaa', fontWeight:400 }}>
                            {fmt(d.baseLoanBalance)} + {fmt(d.penaltyInterest)}
                          </div>
                        </td>

                        {/* Status badge */}
                        <td style={{ padding:'8px 8px', textAlign:'center' }}>
                          <span style={{
                            padding:'3px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:700,
                            background: d.status === 'default' ? '#ffebee' : '#fff8e1',
                            color:      d.status === 'default' ? '#b71c1c' : '#e65100',
                            border:     `1px solid ${d.status === 'default' ? '#f44336' : '#ffc107'}`,
                          }}>
                            {d.status === 'default' ? '🚨 Default' : '⚠️ Arrears'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals footer */}
                  <tfoot>
                    <tr style={{ borderTop:'2px solid #ffc107', background:'#fff8e1', fontWeight:700 }}>
                      <td style={{ padding:'8px 8px', color:'#555' }}>
                        TOTAL ({arrearsDetails.length} loans)
                      </td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td style={{ padding:'8px 8px', textAlign:'right', color:'#c62828', fontSize:'14px' }}>
                        {fmt(arrearsDetails.reduce((s, d) => s + d.penaltyInterest, 0))}
                      </td>
                      <td style={{ padding:'8px 8px', textAlign:'right', color:'#b71c1c', fontSize:'15px' }}>
                        {fmt(arrearsDetails.reduce((s, d) => s + d.totalDue, 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>

                <p style={{ margin:'10px 0 0', fontSize:'11px', color:'#aaa', fontStyle:'italic' }}>
                  Penalty = 5% × remaining principal per month · payments clear interest first, then principal
                </p>
              </div>
            )}
          </div>

          {/* Unpaid Fines */}
          <div style={{ background:'#ffebee', border:'2px solid #f44336', borderRadius:'10px', padding:'18px' }}>
            <p style={{ margin:'0 0 4px', color:'#555', fontSize:'13px' }}>Unpaid Fines</p>
            <p style={{ margin:0, fontSize:'22px', fontWeight:'bold', color:'#b71c1c' }}>{stats.unpaidFinesCount}</p>
          </div>

        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap' }}>
          {[
            { key:'all',          label:`All (${fines.length})` },
            { key:'savings_late', label:`Savings (${fines.filter(f => f.fineType === 'savings_late').length})` },
            { key:'chamaa_late',  label:`Chamaa (${fines.filter(f => f.fineType === 'chamaa_late').length})` },
            { key:'loan_arrears', label:`Arrears (${fines.filter(f => f.fineType === 'loan_arrears').length})` },
            { key:'loan_default', label:`Default (${fines.filter(f => f.fineType === 'loan_default').length})` },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`btn-${activeTab === key ? 'primary' : 'secondary'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? <div className="loading">Loading fines…</div> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Member Name</th>
                  <th>Fine Type</th>
                  <th>Amount</th>
                  <th>Month / Year</th>
                  <th>Status</th>
                  <th>Notes</th>
                  {!isStaff && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={isStaff ? 7 : 8} style={{ textAlign:'center', padding:'40px' }}>
                      No fines found
                    </td>
                  </tr>
                ) : filtered.map((f, i) => (
                  <tr key={f.id} style={{ background: f.isPaid ? 'rgba(76,175,80,0.06)' : undefined, transition:'background 0.4s ease' }}>
                    <td>{i + 1}</td>
                    <td><strong>{f.member?.firstName} {f.member?.lastName}</strong></td>
                    <td><FineTypeBadge fineType={f.fineType} /></td>
                    <td style={{ fontWeight:'bold', color:'#c62828' }}>{fmt(f.amount)}</td>
                    <td>{MONTHS[(f.month || 1) - 1]} {f.year}</td>
                    <td>
                      {f.isPaid ? (
                        <span style={{ background:'#e8f5e9', color:'#2e7d32', padding:'3px 10px', borderRadius:'12px', fontSize:'12px', fontWeight:'600', display:'inline-flex', alignItems:'center', gap:4 }}>
                          <Check size={11} /> Paid
                        </span>
                      ) : (
                        <span style={{ background:'#ffebee', color:'#c62828', padding:'3px 10px', borderRadius:'12px', fontSize:'12px', fontWeight:'600', display:'inline-flex', alignItems:'center', gap:4 }}>
                          <X size={11} /> Unpaid
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize:'13px', color:'#666', maxWidth:'200px' }}>{f.notes || '—'}</td>
                    {!isStaff && (
                      <td>
                        <div style={{ display:'flex', gap:'6px' }}>
                          {!f.isPaid && (
                            <button className="btn-primary" onClick={() => handleMarkPaid(f.id)}
                              style={{ fontSize:'11px', padding:'4px 8px', background:'#4caf50', display:'inline-flex', alignItems:'center', gap:4 }}>
                              <CheckCircle size={11} /> Mark Paid
                            </button>
                          )}
                          <button className="btn-secondary" onClick={() => handleDelete(f.id)}
                            style={{ fontSize:'11px', padding:'4px 8px', display:'inline-flex', alignItems:'center', gap:4 }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr style={{ background:'#f5f5f5', fontWeight:'bold' }}>
                    <td colSpan="3">Total ({filtered.length} records)</td>
                    <td style={{ color:'#c62828' }}>{fmt(tabTotal)}</td>
                    <td colSpan={isStaff ? 3 : 4}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default FinesPage;