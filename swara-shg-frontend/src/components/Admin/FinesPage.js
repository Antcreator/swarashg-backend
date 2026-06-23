import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import Navbar from '../Navbar/navbar';
import { finesAPI } from '../../Service/Api';
import { useIsStaff } from '../Protected Route/Protectedroute';
import '../MembersManagementAdmin/Members.css';
import {
  AlertTriangle, PiggyBank, RefreshCw, Check, X, Trash2,
  CheckCircle, ArrowLeft, Banknote,
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

  const refreshAll = async (silent = false) => {
    await Promise.all([fetchFines(silent), fetchStats()]);
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

  // Fine type badge
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
          <div style={{ background:'#fff3e0', border:'2px solid #ff9800', borderRadius:'10px', padding:'18px' }}>
            <p style={{ margin:'0 0 4px', color:'#555', fontSize:'13px' }}>Savings Fines</p>
            <p style={{ margin:0, fontSize:'22px', fontWeight:'bold', color:'#e65100' }}>{fmt(stats.savingsFineTotal)}</p>
          </div>
          <div style={{ background:'#fce4ec', border:'2px solid #e91e63', borderRadius:'10px', padding:'18px' }}>
            <p style={{ margin:'0 0 4px', color:'#555', fontSize:'13px' }}>Chamaa Fines</p>
            <p style={{ margin:0, fontSize:'22px', fontWeight:'bold', color:'#880e4f' }}>{fmt(stats.chamaaFineTotal)}</p>
          </div>
          {/* NEW: Arrears fines card */}
          <div style={{ background:'#fff8e1', border:'2px solid #ffc107', borderRadius:'10px', padding:'18px' }}>
            <p style={{ margin:'0 0 4px', color:'#555', fontSize:'13px' }}>Arrears Penalties</p>
            <p style={{ margin:0, fontSize:'22px', fontWeight:'bold', color:'#e65100' }}>{fmt(stats.arrearsTotal)}</p>
          </div>
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