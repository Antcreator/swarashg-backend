import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import NotificationBell from './../Shared/NotificationBell';
import './navbar.css';

const Navbar = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const user      = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin   = user.role === 'admin';
  const isStaff   = user.role === 'staff';
  const isAdminOrStaff = isAdmin || isStaff;

  const [menuOpen,     setMenuOpen]     = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const isActive = (path) => location.pathname.includes(path) ? 'active' : '';

  const handleLinkClick = () => {
    setMenuOpen(false);
    setOpenDropdown(null);
  };

  const toggleDropdown = (dropdown) => {
    setOpenDropdown(prev => prev === dropdown ? null : dropdown);
  };

  const getUserInitials = () => {
    const f = user.firstName?.charAt(0)?.toUpperCase() || '';
    const l = user.lastName?.charAt(0)?.toUpperCase()  || '';
    return f + l || 'U';
  };

  const getRoleLabel = () => {
    if (isAdmin) return 'Admin';
    if (isStaff) return 'Staff';
    return 'Member';
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">

        {/* Brand */}
        <div className="navbar-brand">
          <img src="/logo.png" alt="Swara SHG" className="navbar-logo" />
          <div className="navbar-brand-text">
            <h2>Swara SHG</h2>
            <span className="role-badge">
              {isAdminOrStaff ? `${user.firstName} ${user.lastName}` : 'Member'}
            </span>
          </div>
        </div>

        {/* Hamburger */}
        <button
          className={`hamburger ${menuOpen ? 'active' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        {/* Nav links */}
        <div className={`navbar-menu ${menuOpen ? 'mobile-active' : ''}`}>
          {isAdminOrStaff ? (
            <>
              <Link to="/admin/dashboard" className={isActive('dashboard')} onClick={handleLinkClick}>
                Dashboard
              </Link>

              <div className="nav-dropdown">
                <button
                  className={`dropdown-toggle ${isActive('members') || isActive('member-transactions')}`}
                  onClick={() => toggleDropdown('members')}
                >
                  Members <span className="arrow">{openDropdown === 'members' ? '▲' : '▼'}</span>
                </button>
                {openDropdown === 'members' && (
                  <div className="dropdown-content">
                    <Link to="/admin/members"             onClick={handleLinkClick}>All Members</Link>
                    <Link to="/admin/member-transactions" onClick={handleLinkClick}>Transactions</Link>
                  </div>
                )}
              </div>

              <div className="nav-dropdown">
                <button
                  className={`dropdown-toggle ${isActive('savings') || isActive('monthly-savings')}`}
                  onClick={() => toggleDropdown('savings')}
                >
                  Savings <span className="arrow">{openDropdown === 'savings' ? '▲' : '▼'}</span>
                </button>
                {openDropdown === 'savings' && (
                  <div className="dropdown-content">
                    <Link to="/admin/savings"         onClick={handleLinkClick}>All Savings</Link>
                    <Link to="/admin/monthly-savings" onClick={handleLinkClick}>Monthly Report</Link>
                  </div>
                )}
              </div>

              <div className="nav-dropdown">
                <button
                  className={`dropdown-toggle ${isActive('loans') || isActive('office-guarantor') || isActive('defaulters')}`}
                  onClick={() => toggleDropdown('loans')}
                >
                  Loans <span className="arrow">{openDropdown === 'loans' ? '▲' : '▼'}</span>
                </button>
                {openDropdown === 'loans' && (
                  <div className="dropdown-content">
                    <Link to="/admin/loans"                     onClick={handleLinkClick}>All Loans</Link>
                    <Link to="/admin/office-guarantor-requests" onClick={handleLinkClick}>Office Guarantor</Link>
                    <Link to="/admin/defaulters"                onClick={handleLinkClick}>Defaulters</Link>
                  </div>
                )}
              </div>

              <Link to="/admin/chamaa"  className={isActive('chamaa')}  onClick={handleLinkClick}>Chamaa</Link>
              <Link to="/admin/reports" className={isActive('reports')} onClick={handleLinkClick}>Reports</Link>
            </>
          ) : (
            <>
              <Link to={`/member/dashboard/${user.memberId}`} className={isActive('dashboard')}           onClick={handleLinkClick}>Dashboard</Link>
              <Link to="/member/loans"                        className={isActive('loans')}                onClick={handleLinkClick}>Apply for Loan</Link>
              <Link to="/member/my-loans"                     className={isActive('my-loans')}             onClick={handleLinkClick}>My Loans</Link>
              <Link to="/member/guarantor-requests"           className={isActive('guarantor-requests')}   onClick={handleLinkClick}>Guarantor Requests</Link>
            </>
          )}
        </div>

        {/* User info */}
        <div className="navbar-user">
          <NotificationBell />
          <div className="user-info-card">
            <div className="user-avatar">{getUserInitials()}</div>
            <div className="user-details">
              <div className="user-name">{user.firstName} {user.lastName}</div>
              <div className="user-role" style={{ color: isStaff ? '#e65100' : undefined }}>
                {getRoleLabel()}
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>

      </div>
    </nav>
  );
};

export default Navbar;