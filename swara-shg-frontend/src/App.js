import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login/loginComponent';
import ForgotPassword from './components/ForgotPassword/forgotPassword';
import AdminManagement from './components/Admin/AdminManagement';
import ProtectedRoute from './components/Protected Route/Protectedroute';
import AdminDashboard from './components/AdminDashboard/adminDashboard';
import Members from './components/MembersManagementAdmin/Members';
import Reports from './components/Report/report';
import Savings from './components/Admin/Savings';
import Loans from './components/Admin/Loans';
import Chamaa from './components/Admin/Chamaa';
import MemberTransactions from './components/Admin/MemberTransactions';
import MonthlySavingsReport from './components/Admin/MonthlySavingsReport';
import Defaulters from './components/Admin/Defaulters';
import OfficeGuarantorRequests from './components/Admin/OfficeGuarantorRequests';
import PendingDeposits from './components/Admin/PendingDeposits';
import SeedCapitalPage from './components/Admin/SeedCapitalPage';
import FinesPage from './components/Admin/FinesPage';
import StatutoryPage from './components/Admin/StatutoryPage';
import AgmFeePage from './components/Admin/AgmFeePage';
import MemberDashboard from './components/MemberDashboard/memberDashboard';
import MemberLoanApplication from './components/MemberLoanApplication/MemberLoanApplication';
import GuarantorRequests from './components/Member/GuarantorRequests';
import MyLoanApplications from './components/Member/MyLoanApplications';
import InvestmentPage from './components/Admin/InvestmentPage';
import RegistrationFeePage from './components/Admin/RegistrationFeePage';
import WithdrawalsPage from './components/Admin/WithdrawalsPage';

import './App.css';

// ── Error Boundary — surfaces JS crashes instead of blank page ───
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('App crashed:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px',
          fontFamily: 'monospace',
          maxWidth: '100vw',
          overflowX: 'auto',
          boxSizing: 'border-box',
        }}>
          <h2 style={{ color: '#c62828', fontSize: '18px' }}>
            Something went wrong
          </h2>
          <p style={{ color: '#555', fontSize: '13px', marginBottom: '12px' }}>
            Please screenshot this and send to your developer.
          </p>
          <div style={{
            background: '#ffebee',
            border: '1px solid #ef9a9a',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '12px',
          }}>
            <strong style={{ color: '#b71c1c', fontSize: '13px' }}>Error:</strong>
            <pre style={{ color: '#c62828', fontSize: '11px', whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>
              {this.state.error && this.state.error.toString()}
            </pre>
          </div>
          {this.state.errorInfo && (
            <div style={{
              background: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '6px',
              padding: '12px',
            }}>
              <strong style={{ color: '#333', fontSize: '13px' }}>Stack trace:</strong>
              <pre style={{ color: '#555', fontSize: '10px', whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </div>
          )}
          <button
            onClick={() => window.location.href = '/login'}
            style={{
              marginTop: '16px',
              padding: '10px 20px',
              background: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Go to Login
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/"                element={<Login />} />
          <Route path="/login"           element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Admin + Staff Routes */}
          <Route path="/admin/dashboard"                 element={<ProtectedRoute requireAdmin={true}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/members"                   element={<ProtectedRoute requireAdmin={true}><Members /></ProtectedRoute>} />
          <Route path="/admin/savings"                   element={<ProtectedRoute requireAdmin={true}><Savings /></ProtectedRoute>} />
          <Route path="/admin/office-guarantor-requests" element={<ProtectedRoute requireAdmin={true}><OfficeGuarantorRequests /></ProtectedRoute>} />
          <Route path="/admin/loans"                     element={<ProtectedRoute requireAdmin={true}><Loans /></ProtectedRoute>} />
          <Route path="/admin/chamaa"                    element={<ProtectedRoute requireAdmin={true}><Chamaa /></ProtectedRoute>} />
          <Route path="/admin/deposits"                  element={<ProtectedRoute requireAdmin={true}><PendingDeposits /></ProtectedRoute>} />
          <Route path="/admin/reports"                   element={<ProtectedRoute requireAdmin={true}><Reports /></ProtectedRoute>} />
          <Route path="/admin/monthly-savings"           element={<ProtectedRoute requireAdmin={true}><MonthlySavingsReport /></ProtectedRoute>} />
          <Route path="/admin/defaulters"                element={<ProtectedRoute requireAdmin={true}><Defaulters /></ProtectedRoute>} />
          <Route path="/admin/member-transactions"       element={<ProtectedRoute requireAdmin={true}><MemberTransactions /></ProtectedRoute>} />
          <Route path="/admin/seed-capital"              element={<ProtectedRoute requireAdmin={true}><SeedCapitalPage /></ProtectedRoute>} />
          <Route path="/admin/fines"                     element={<ProtectedRoute requireAdmin={true}><FinesPage /></ProtectedRoute>} />
          <Route path="/admin/statutory"                 element={<ProtectedRoute requireAdmin={true}><StatutoryPage /></ProtectedRoute>} />
          <Route path="/admin/agm-fees"                  element={<ProtectedRoute requireAdmin={true}><AgmFeePage /></ProtectedRoute>} />
          <Route path="/admin/investments"               element={<ProtectedRoute requireAdmin={true}><InvestmentPage /></ProtectedRoute>} />
          <Route path="/admin/registration-fees"         element={<ProtectedRoute requireAdmin={true}><RegistrationFeePage /></ProtectedRoute>} />
          <Route path="/admin/admins"                    element={<ProtectedRoute requireAdmin={true}><AdminManagement /></ProtectedRoute>} />
          <Route path="/admin/withdrawals"               element={<ProtectedRoute requireAdmin={true}><WithdrawalsPage /></ProtectedRoute>} />

          {/* Member Routes */}
          <Route path="/member/dashboard/:id"      element={<ProtectedRoute><MemberDashboard /></ProtectedRoute>} />
          <Route path="/member/loans"              element={<ProtectedRoute><MemberLoanApplication /></ProtectedRoute>} />
          <Route path="/member/my-loans"           element={<ProtectedRoute><MyLoanApplications /></ProtectedRoute>} />
          <Route path="/member/guarantor-requests" element={<ProtectedRoute><GuarantorRequests /></ProtectedRoute>} />

          {/* Catch-all — redirect any unknown path to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;