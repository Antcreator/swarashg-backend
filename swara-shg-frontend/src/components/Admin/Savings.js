import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { savingsAPI, membersAPI } from '../../Service/Api';
import { useIsStaff } from '../Protected Route/Protectedroute';
import Navbar from '../Navbar/navbar';
import '../MembersManagementAdmin/Members.css';
import {
  CheckCircle, AlertTriangle, CalendarDays, Lightbulb,
} from 'lucide-react';

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const getMonthName = (n) => MONTHS[n] || '';

const getSavingWindow = (targetMonth, targetYear) => {
  let prevMonth = targetMonth - 1;
  let prevYear  = targetYear;
  if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }
  const windowStart = new Date(prevYear, prevMonth - 1, 11);
  const windowEnd   = new Date(targetYear, targetMonth - 1, 10);
  return { windowStart, windowEnd, prevMonth, prevYear };
};

const evaluatePayment = (targetMonth, targetYear, paymentDateStr) => {
  const payDate  = paymentDateStr ? new Date(paymentDateStr) : new Date();
  const payDay   = payDate.getDate();
  const payMonth = payDate.getMonth() + 1;
  const payYear  = payDate.getFullYear();
  const payOnly  = new Date(payYear, payMonth - 1, payDay);

  const { windowStart, windowEnd, prevMonth, prevYear } = getSavingWindow(targetMonth, targetYear);
  const isWithinWindow = payOnly >= windowStart && payOnly <= windowEnd;

  if (isWithinWindow) {
    return { isLate: false, finalMonth: targetMonth, finalYear: targetYear, windowStart, windowEnd, prevMonth, prevYear };
  }

  const finalMonth = targetMonth === 12 ? 1 : targetMonth + 1;
  const finalYear  = targetMonth === 12 ? targetYear + 1 : targetYear;
  return { isLate: true, finalMonth, finalYear, windowStart, windowEnd, prevMonth, prevYear };
};

const Savings = () => {
  const isStaff = useIsStaff();
  const [savings,   setSavings]   = useState([]);
  const [members,   setMembers]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);

  const today = new Date();

  const [formData, setFormData] = useState({
    memberId: '', amount: '',
    month: today.getMonth() + 1,
    year:  today.getFullYear(),
    paymentDate: today.toISOString().split('T')[0],
    notes: '',
  });

  const [paymentStatus, setPaymentStatus] = useState(null);

  useEffect(() => { fetchSavings(); fetchMembers(); }, []);

  const fetchMembers = async () => {
    try { const res = await membersAPI.getAll(); setMembers(res.data.members); }
    catch (err) { console.error('Failed to fetch members:', err); }
  };

  const fetchSavings = async () => {
    try { const res = await savingsAPI.getAll(); setSavings(res.data.savings); }
    catch (err) { console.error('Failed to fetch savings:', err); }
    finally { setLoading(false); }
  };

  const evaluateStatus = useCallback(() => {
    if (!formData.paymentDate || !formData.month || !formData.year) { setPaymentStatus(null); return; }
    setPaymentStatus(evaluatePayment(Number(formData.month), Number(formData.year), formData.paymentDate));
  }, [formData.paymentDate, formData.month, formData.year]);

  useEffect(() => { evaluateStatus(); }, [evaluateStatus]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await savingsAPI.create({
        memberId:    Number(formData.memberId),
        amount:      Number(formData.amount),
        month:       Number(formData.month),
        year:        Number(formData.year),
        paymentDate: formData.paymentDate,
        notes:       formData.notes,
      });
      alert(response.data.message);
      if (response.data.warning) alert(`WARNING: ${response.data.warning}`);
      setShowModal(false);
      setFormData({ memberId: '', amount: '', month: today.getMonth() + 1, year: today.getFullYear(), paymentDate: today.toISOString().split('T')[0], notes: '' });
      setPaymentStatus(null);
      fetchSavings();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record savings');
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount || 0);

  const formatDate = (d) => new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });

  const getStatusBadge = (saving) => {
    if (!saving.isPaid) return <span className="status overdue">Not Paid</span>;
    if (saving.isLate)  return <span className="status late">Late</span>;
    return <span className="status ontime">On Time</span>;
  };

  const renderPaymentBanner = () => {
    if (!paymentStatus) return null;
    const { isLate, finalMonth, finalYear, windowStart, windowEnd } = paymentStatus;
    const fmtDate = (d) => d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });

    if (!isLate) {
      return (
        <div style={{ background: '#e8f5e9', padding: '14px 16px', borderRadius: '8px', marginBottom: '16px', border: '2px solid #43a047' }}>
          <p style={{ margin: 0, color: '#2e7d32', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle size={15} /> ON TIME — Saving for <strong>{getMonthName(Number(formData.month))} {formData.year}</strong>
          </p>
          <p style={{ margin: '6px 0 0', color: '#388e3c', fontSize: '13px' }}>
            Window: {fmtDate(windowStart)} → {fmtDate(windowEnd)} &nbsp;|&nbsp; Multiple payments allowed within this window.
          </p>
        </div>
      );
    }

    return (
      <div style={{ background: '#ffebee', padding: '14px 16px', borderRadius: '8px', marginBottom: '16px', border: '2px solid #e53935' }}>
        <p style={{ margin: 0, color: '#c62828', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={15} /> LATE PAYMENT — Window for {getMonthName(Number(formData.month))} {formData.year} has closed.
        </p>
        <p style={{ margin: '6px 0 0', color: '#b71c1c', fontSize: '13px' }}>
          Window was: {fmtDate(windowStart)} → {fmtDate(windowEnd)}
        </p>
        <p style={{ margin: '6px 0 0', color: '#c62828', fontSize: '13px', fontWeight: 600 }}>
          Amount will be pushed to <strong>{getMonthName(finalMonth)} {finalYear}</strong> + KES 500 fine.
        </p>
      </div>
    );
  };

  const todayDay   = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const todayYear  = today.getFullYear();
  const currentTargetMonth = todayDay >= 11 ? (todayMonth === 12 ? 1 : todayMonth + 1) : todayMonth;
  const currentTargetYear  = todayDay >= 11 && todayMonth === 12 ? todayYear + 1 : todayYear;
  const { windowStart: cws, windowEnd: cwe } = getSavingWindow(currentTargetMonth, currentTargetYear);
  const fmtShort = (d) => d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });

  return (
    <>
      <Navbar />
      <div className="admin-container">
        <Link to="/admin/dashboard" style={{ color: '#1976d2', textDecoration: 'none', fontSize: '14px' }}>← Dashboard</Link>

        <div className="page-header">
          <h1>Savings Management</h1>
          {!isStaff && (
            <button className="btn-primary" onClick={() => setShowModal(true)}>Record Savings</button>
          )}
        </div>

        {/* Info Banner */}
        <div style={{ background: '#e3f2fd', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '2px solid #1976d2' }}>
          
          <div style={{ marginTop: '12px', padding: '10px 14px', background: '#bbdefb', borderRadius: '6px', fontSize: '13px', color: '#0d47a1', display: 'flex', alignItems: 'center', gap: 7 }}>
            <CalendarDays size={14} /> <strong>Currently open:</strong> Saving for{' '}
            <strong>{getMonthName(currentTargetMonth)} {currentTargetYear}</strong>
            {' '}({fmtShort(cws)} – {fmtShort(cwe)})
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="loading">Loading savings...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Member</th><th>Amount</th><th>Month / Year</th><th>Payment Date</th><th>Status</th><th>Fine</th><th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {savings.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: '#999' }}>No savings records yet.</td></tr>
                ) : savings.map((saving) => (
                  <tr key={saving.id}>
                    <td>{saving.member?.firstName} {saving.member?.lastName}</td>
                    <td>{formatCurrency(saving.amount)}</td>
                    <td>{getMonthName(saving.month)} {saving.year}</td>
                    <td>{formatDate(saving.paymentDate)}</td>
                    <td>{getStatusBadge(saving)}</td>
                    <td>
                      {saving.fineAmount > 0
                        ? <span style={{ color: '#c62828', fontWeight: 'bold' }}>{formatCurrency(saving.fineAmount)}</span>
                        : '—'}
                    </td>
                    <td style={{ fontSize: '13px', maxWidth: '300px' }}>{saving.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Record Savings Modal */}
        {showModal && !isStaff && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Record Savings</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Member *</label>
                  <select value={formData.memberId} onChange={(e) => setFormData({ ...formData, memberId: e.target.value })} required>
                    <option value="">Select Member</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{m.firstName} {m.lastName} (Savings: {formatCurrency(m.total_savings)})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Amount (multiples of 1,000) *</label>
                  <input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required min="1000" step="1000" placeholder="e.g. 1000, 2000, 5000" />
                  {formData.amount && Number(formData.amount) % 1000 !== 0 && (
                    <p style={{ color: '#c62828', fontSize: '13px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <AlertTriangle size={13} /> Amount must be a multiple of 1,000
                    </p>
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Saving For — Month *</label>
                    <select value={formData.month} onChange={(e) => setFormData({ ...formData, month: Number(e.target.value) })} required>
                      {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>{getMonthName(i + 1)}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Year *</label>
                    <input type="number" value={formData.year} onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })} required min="2000" max="2100" />
                  </div>
                </div>

                <div className="form-group">
                  <label>Payment Date *</label>
                  <input type="date" value={formData.paymentDate} onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })} required />
                  <p style={{ fontSize: '12px', color: '#666', marginTop: '4px', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Lightbulb size={12} /> Window to save for a month: 11th of previous month → 10th of that month
                  </p>
                </div>

                {renderPaymentBanner()}

                <div className="form-group">
                  <label>Notes</label>
                  <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows="3" placeholder="Optional notes" />
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Record Savings</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Savings;