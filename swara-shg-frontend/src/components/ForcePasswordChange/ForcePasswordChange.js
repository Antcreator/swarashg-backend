import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../../Service/Api';
import {
  Lock, Eye, EyeOff, ArrowLeft, AlertCircle,
  CheckCircle, Circle, ShieldCheck,
} from 'lucide-react';

const ForcePasswordChange = ({ onSuccess }) => {
  const [form, setForm]       = useState({ newPassword: '', confirmPassword: '' });
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const validate = () => {
    const errs = {};
    if (!form.newPassword)                             errs.newPassword     = 'New password is required';
    else if (form.newPassword.length < 8)              errs.newPassword     = 'Password must be at least 8 characters';
    else if (!/[A-Z]/.test(form.newPassword))          errs.newPassword     = 'Must contain at least one uppercase letter';
    else if (!/[0-9]/.test(form.newPassword))          errs.newPassword     = 'Must contain at least one number';
    if (!form.confirmPassword)                         errs.confirmPassword = 'Please confirm your password';
    else if (form.newPassword !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authAPI.changeFirstPassword({
        newPassword:     form.newPassword,
        confirmPassword: form.confirmPassword,
      });
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      onSuccess(user, token);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to change password. Please try again.';
      setErrors({ general: msg });
    } finally {
      setLoading(false);
    }
  };

  const getStrength = (pwd) => {
    if (!pwd) return { level: 0, label: '', color: '#ddd' };
    let score = 0;
    if (pwd.length >= 8)           score++;
    if (pwd.length >= 12)          score++;
    if (/[A-Z]/.test(pwd))         score++;
    if (/[0-9]/.test(pwd))         score++;
    if (/[^A-Za-z0-9]/.test(pwd))  score++;
    if (score <= 1) return { level: score, label: 'Weak',   color: '#f44336' };
    if (score <= 3) return { level: score, label: 'Fair',   color: '#ff9800' };
    if (score === 4) return { level: score, label: 'Good',  color: '#2196f3' };
    return               { level: score, label: 'Strong', color: '#4caf50' };
  };

  const strength = getStrength(form.newPassword);

  const requirements = [
    { label: 'At least 8 characters',        met: form.newPassword.length >= 8 },
    { label: 'At least one uppercase letter', met: /[A-Z]/.test(form.newPassword) },
    { label: 'At least one number',           met: /[0-9]/.test(form.newPassword) },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #2c5f2d 0%, #2c5f2d 50%, #2c5f2d 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{
        background: 'white', borderRadius: '16px',
        padding: '40px', width: '100%', maxWidth: '440px',
        boxShadow: '0 20px 60px rgba(44,95,45,0.4)',
      }}>

        {/* ── Back to login ── */}
        <div style={{ marginBottom: '20px' }}>
          <Link
            to="/login"
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
            }}
            style={{
              fontSize: '13px', color: '#2c5f2d',
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              fontWeight: 600, textDecoration: 'none',
            }}
          >
            <ArrowLeft size={14} /> Back to Login
          </Link>
        </div>

        {/* ── Lock icon + title ── */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: '#e8f5e9', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: '16px',
          }}>
            <Lock size={28} color="#2c5f2d" />
          </div>
          <h2 style={{ margin: '0 0 8px', color: '#2c5f2d', fontSize: '22px', fontWeight: 700 }}>
            Set Your Password
          </h2>
          <p style={{ margin: 0, color: '#666', fontSize: '14px', lineHeight: 1.5 }}>
            Welcome, <strong>{currentUser.firstName || 'Member'}</strong>! Your account was created.
            Please set a personal password before continuing.
          </p>
        </div>

        {/* ── General error banner ── */}
        {errors.general && (
          <div style={{
            background: '#ffebee', border: '1px solid #ef9a9a',
            borderRadius: '8px', padding: '12px 16px', marginBottom: '20px',
            fontSize: '14px', color: '#c62828',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* ── New password ── */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block', fontSize: '13px', fontWeight: 600,
              color: '#333', marginBottom: '6px',
            }}>
              New Password *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNew ? 'text' : 'password'}
                name="newPassword"
                value={form.newPassword}
                onChange={handleChange}
                placeholder="Enter your new password"
                autoComplete="new-password"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '11px 44px 11px 14px',
                  border: `1px solid ${errors.newPassword ? '#f44336' : '#ddd'}`,
                  borderRadius: '8px', fontSize: '14px', outline: 'none',
                  transition: 'border-color 0.2s',
                }}
              />
              <button
                type="button"
                onClick={() => setShowNew(p => !p)}
                style={{
                  position: 'absolute', right: '12px', top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#888', padding: 0, display: 'flex', alignItems: 'center',
                }}
                aria-label={showNew ? 'Hide password' : 'Show password'}
              >
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Strength bar */}
            {form.newPassword && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} style={{
                      flex: 1, height: '4px', borderRadius: '2px',
                      background: i <= strength.level ? strength.color : '#e0e0e0',
                      transition: 'background 0.2s',
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: '12px', color: strength.color, fontWeight: 600 }}>
                  {strength.label}
                </span>
              </div>
            )}

            {errors.newPassword && (
              <p style={{
                margin: '4px 0 0', fontSize: '12px', color: '#f44336',
                display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                <AlertCircle size={12} /> {errors.newPassword}
              </p>
            )}
          </div>

          {/* ── Confirm password ── */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block', fontSize: '13px', fontWeight: 600,
              color: '#2c5f2d', marginBottom: '6px',
            }}>
              Confirm Password *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirm ? 'text' : 'password'}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter your new password"
                autoComplete="new-password"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '11px 44px 11px 14px',
                  border: `1px solid ${errors.confirmPassword ? '#f44336' : '#ddd'}`,
                  borderRadius: '8px', fontSize: '14px', outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(p => !p)}
                style={{
                  position: 'absolute', right: '12px', top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#888', padding: 0, display: 'flex', alignItems: 'center',
                }}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Match indicator */}
            {form.confirmPassword && (
              <p style={{
                margin: '4px 0 0', fontSize: '12px',
                color: form.newPassword === form.confirmPassword ? '#4caf50' : '#f44336',
                display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                {form.newPassword === form.confirmPassword
                  ? <><CheckCircle size={12} /> Passwords match</>
                  : <><AlertCircle  size={12} /> Passwords do not match</>
                }
              </p>
            )}

            {errors.confirmPassword && (
              <p style={{
                margin: '4px 0 0', fontSize: '12px', color: '#f44336',
                display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                <AlertCircle size={12} /> {errors.confirmPassword}
              </p>
            )}
          </div>

          {/* ── Requirements checklist ── */}
          <div style={{
            background: '#f8f9fa', borderRadius: '8px',
            padding: '12px 14px', marginBottom: '24px',
            fontSize: '12px', color: '#2c5f2d',
          }}>
            <strong style={{ display: 'block', marginBottom: '8px' }}>
              Password requirements:
            </strong>
            {requirements.map(({ label, met }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center',
                gap: '6px', marginTop: '4px',
              }}>
                {met
                  ? <CheckCircle size={13} color="#4caf50" />
                  : <Circle      size={13} color="#bbb" />
                }
                <span style={{ color: met ? '#2e7d32' : '#888' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* ── Submit ── */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '13px',
              background: loading ? '#ccc' : '#2c5f2d',
              color: 'white', border: 'none', borderRadius: '8px',
              fontSize: '15px', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '8px',
            }}
          >
            <ShieldCheck size={18} />
            {loading ? 'Saving...' : 'Set My Password & Continue'}
          </button>
        </form>

        <p style={{
          margin: '20px 0 0', textAlign: 'center',
          fontSize: '12px', color: '#aaa',
        }}>
          This step is mandatory. You cannot access your account until a personal password is set.
        </p>
      </div>
    </div>
  );
};

export default ForcePasswordChange;