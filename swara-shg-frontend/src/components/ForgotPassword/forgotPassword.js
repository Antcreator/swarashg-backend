import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../../Service/Api';
import '../Login/loginComponent';


const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = verify identity, 2 = set new password
  const [formData, setFormData] = useState({
    email: '',
    phoneNumber: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  // Step 1: Verify identity
  const handleVerifyIdentity = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await authAPI.forgotPassword({
        email: formData.email,
        phoneNumber: formData.phoneNumber,
      });

      setSuccess('Identity verified! Please set your new password.');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please check your email and phone number.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Set new password directly
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      await authAPI.resetPassword({
        email: formData.email,
        newPassword: formData.newPassword,
      });

      setSuccess('Password reset successful! You can now login with your new password.');

      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src="/logo2.png" alt="Swara SHG Logo" className="login-logo" />
          <h1>Swara SHG</h1>
          <p>Password Reset</p>
        </div>

        {step === 1 ? (
          // Step 1: Verify identity
          <form onSubmit={handleVerifyIdentity} className="login-form">
            <div className="step-indicator">
              <span className="step active">1</span>
              <span className="step-line"></span>
              <span className="step">2</span>
            </div>
            <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px', fontSize: '14px' }}>
              Step 1: Verify your identity
            </p>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="form-group">
              <label htmlFor="email">Email Address *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="Enter your registered email"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="phoneNumber">Phone Number *</label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                required
                placeholder="Enter your registered phone number"
                disabled={loading}
              />
              <small style={{ color: '#999', fontSize: '12px' }}>
                This must match the phone number registered in your member profile
              </small>
            </div>

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify Identity'}
            </button>

            <div className="login-footer">
              <Link to="/login" className="back-link">← Back to Login</Link>
            </div>
          </form>
        ) : (
          // Step 2: Set new password
          <form onSubmit={handleResetPassword} className="login-form">
            <div className="step-indicator">
              <span className="step completed">✓</span>
              <span className="step-line completed"></span>
              <span className="step active">2</span>
            </div>
            <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px', fontSize: '14px' }}>
              Step 2: Create your new password
            </p>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="form-group">
              <label htmlFor="newPassword">New Password *</label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                required
                placeholder="Enter your new password"
                disabled={loading}
                minLength="6"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password *</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                placeholder="Re-enter your new password"
                disabled={loading}
                minLength="6"
              />
            </div>

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </button>

            <div className="login-footer">
              <Link to="/login" className="back-link">← Back to Login</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
