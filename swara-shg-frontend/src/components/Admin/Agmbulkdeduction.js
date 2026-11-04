import React, { useState } from 'react';
import { agmFeeAPI } from '../../Service/Api';
import { Landmark, AlertTriangle, CheckCircle, X } from 'lucide-react';

const fmt = (v) => new Intl.NumberFormat('en-KE', {
  style: 'currency', currency: 'KES', minimumFractionDigits: 0,
}).format(v || 0);

/**
 * December AGM deduction.
 * Step 1: "Preview" — shows who would be deducted, nothing changes.
 * Step 2: "Confirm" — deducts the outstanding AGM fee from each listed member's savings.
 * Drop <AgmBulkDeduction year={year} onDone={refetch} /> into the admin AGM Fees page.
 */
const AgmBulkDeduction = ({ year = new Date().getFullYear(), onDone }) => {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState('');

  const close = () => { setOpen(false); setPreview(null); setResult(null); setError(''); };

  const runPreview = async () => {
    setOpen(true); setLoading(true); setError(''); setResult(null);
    try {
      const res = await agmFeeAPI.bulkDeductFromSavings(year, false);
      setPreview(res.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load preview');
    } finally { setLoading(false); }
  };

  const runDeduction = async () => {
    setLoading(true); setError('');
    try {
      const res = await agmFeeAPI.bulkDeductFromSavings(year, true);
      setResult(res.data); setPreview(null);
      if (onDone) onDone();
    } catch (e) {
      setError(e.response?.data?.message || 'Deduction failed');
    } finally { setLoading(false); }
  };

  const Row = ({ r, showBalance }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
      <span>{r.name}</span>
      <span>
        <strong>{fmt(r.outstanding)}</strong>
        {showBalance && <span style={{ color: '#888', marginLeft: 8, fontSize: 11 }}>savings {fmt(r.savingsBalance)}</span>}
      </span>
    </div>
  );

  return (
    <>
      <button onClick={runPreview}
        style={{ padding: '9px 16px', background: '#7b1fa2', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Landmark size={14} /> Deduct AGM fee from savings
      </button>

      {open && (
        <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>AGM fee deduction — {year}</h2>
              <button onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            {loading && <p style={{ color: '#888' }}>Working…</p>}
            {error && <p style={{ color: '#c62828', display: 'flex', gap: 6, alignItems: 'center' }}><AlertTriangle size={14} />{error}</p>}

            {preview && !loading && (
              <>
                <p style={{ fontSize: 13, color: '#555', marginTop: 0 }}>
                  Annual fee is <strong>{fmt(preview.annualFee)}</strong> per member. Only the amount each member
                  still owes is deducted. Nothing has changed yet.
                </p>

                <h4 style={{ margin: '14px 0 4px' }}>Will be deducted ({preview.toDeduct.length}) — total {fmt(preview.totalToDeduct)}</h4>
                {preview.toDeduct.length === 0
                  ? <p style={{ color: '#888', fontSize: 13 }}>No one to deduct.</p>
                  : preview.toDeduct.map(r => <Row key={r.memberId} r={r} showBalance />)}

                {preview.insufficient.length > 0 && (
                  <>
                    <h4 style={{ margin: '16px 0 4px', color: '#e65100' }}>Savings too low — skipped ({preview.insufficient.length})</h4>
                    <p style={{ fontSize: 12, color: '#888', margin: '0 0 4px' }}>These members should pay the AGM fee themselves.</p>
                    {preview.insufficient.map(r => <Row key={r.memberId} r={r} showBalance />)}
                  </>
                )}

                <p style={{ fontSize: 12, color: '#888' }}>{preview.alreadySettled} member(s) already settled.</p>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button onClick={close} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #ddd', background: '#f5f5f5', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                  <button onClick={runDeduction} disabled={preview.toDeduct.length === 0}
                    style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: preview.toDeduct.length ? '#c62828' : '#bdbdbd', color: 'white', cursor: preview.toDeduct.length ? 'pointer' : 'not-allowed', fontWeight: 700 }}>
                    Confirm &amp; deduct {fmt(preview.totalToDeduct)}
                  </button>
                </div>
              </>
            )}

            {result && !loading && (
              <>
                <p style={{ color: '#2e7d32', display: 'flex', gap: 6, alignItems: 'center', fontWeight: 700 }}>
                  <CheckCircle size={16} /> {result.message} — {fmt(result.totalDeducted)}
                </p>
                {result.failed.length > 0 && (
                  <>
                    <h4 style={{ color: '#c62828', margin: '12px 0 4px' }}>Failed ({result.failed.length})</h4>
                    {result.failed.map(r => (
                      <div key={r.memberId} style={{ fontSize: 12, color: '#c62828', padding: '3px 0' }}>{r.name}: {r.error}</div>
                    ))}
                  </>
                )}
                <div style={{ textAlign: 'right', marginTop: 14 }}>
                  <button onClick={close} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#1565c0', color: 'white', cursor: 'pointer', fontWeight: 700 }}>Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default AgmBulkDeduction;