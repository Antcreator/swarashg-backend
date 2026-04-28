import React, { createContext, useContext } from 'react';
import { Navigate } from 'react-router-dom';
import ForcePasswordChange from '../ForcePasswordChange/ForcePasswordChange';

// ── Staff context — lets any child component know if the current
//    user is a view-only staff account so it can hide action buttons.
export const StaffContext = createContext(false);
export const useIsStaff = () => useContext(StaffContext);

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const token = localStorage.getItem('token');
  const user  = JSON.parse(localStorage.getItem('user') || '{}');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Staff are allowed through admin routes — they just can't act
  if (requireAdmin && user.role !== 'admin' && user.role !== 'staff') {
    return <Navigate to={`/member/dashboard/${user.memberId}`} replace />;
  }

  // Force password change gate — members only
  if (user.role === 'member' && user.mustChangePassword) {
    const handlePasswordChanged = (updatedUser, newToken) => {
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      window.location.reload();
    };
    return <ForcePasswordChange onSuccess={handlePasswordChanged} />;
  }

  const isStaff = user.role === 'staff';

  return (
    <StaffContext.Provider value={isStaff}>
      {/* Staff banner — visible on every page */}
      {isStaff && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#e65100', color: 'white',
          textAlign: 'center', padding: '6px',
          fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px',
        }}>
          👁 STAFF VIEW — Read only. Actions are disabled.
        </div>
      )}
      {/* Push content down so it isn't hidden behind the banner */}
      <div style={isStaff ? { paddingTop: '30px' } : {}}>
        {children}
      </div>
    </StaffContext.Provider>
  );
};

export default ProtectedRoute;