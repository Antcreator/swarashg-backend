import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { savingsAPI, membersAPI } from '../../Service/Api';
import Navbar from '../Navbar/navbar';
import './MonthlySavingsReport.css';

const MonthlySavingsReport = () => {
  const [savingsData, setSavingsData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Set current month as default
    const now = new Date();
    setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  }, []);

  useEffect(() => {
    if (selectedMonth) {
      fetchMonthlySavings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  const fetchMonthlySavings = async () => {
    try {
      setLoading(true);
      
      // Get all members
      const membersRes = await membersAPI.getAll();
      const members = membersRes.data.members || [];

      // Get ALL savings
      const savingsRes = await savingsAPI.getAll();
      const allSavings = savingsRes.data.savings || [];

      // Parse selected month
      const [yearStr, monthStr] = selectedMonth.split('-');
      const targetYear = parseInt(yearStr);
      const targetMonth = parseInt(monthStr);

      console.log('Selected month:', targetMonth, 'year:', targetYear);
      console.log('Total savings fetched:', allSavings.length);

      // Filter savings by month and year
      const monthSavings = allSavings.filter(saving => {
        const savingMonth = parseInt(saving.month);
        const savingYear = parseInt(saving.year);
        return savingMonth === targetMonth && savingYear === targetYear;
      });

      console.log('Filtered savings for month:', monthSavings.length);

      // Aggregate savings by member for the month
      const memberSavingsMap = {};
      
      monthSavings.forEach(saving => {
        const memberId = saving.memberId;
        if (!memberSavingsMap[memberId]) {
          memberSavingsMap[memberId] = 0;
        }
        memberSavingsMap[memberId] += Number(saving.amount);
      });

      console.log('Member savings map:', memberSavingsMap);

      // Combine with member info
      const result = members.map(member => ({
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        totalSavings: member.totalSavings || 0,
        monthlySavings: memberSavingsMap[member.id] || 0,
        phone: member.phone,
        isActive: member.isActive
      }));

      // Sort by monthly savings (highest first)
      result.sort((a, b) => b.monthlySavings - a.monthlySavings);

      console.log('Final result:', result.length, 'members');
      setSavingsData(result);
    } catch (err) {
      console.error('Failed to fetch savings:', err);
      alert('Failed to load monthly savings report');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getTotalMonthlySavings = () => {
    return savingsData.reduce((sum, member) => sum + member.monthlySavings, 0);
  };

  const getTotalAllSavings = () => {
    return savingsData.reduce((sum, member) => sum + member.totalSavings, 0);
  };

  const exportToCSV = () => {
    const headers = ['Member Name', 'Monthly Savings', 'Total Savings', 'Phone'];
    const rows = savingsData.map(m => [
      m.name,
      m.monthlySavings,
      m.totalSavings,
      m.phone
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `savings-report-${selectedMonth}.csv`;
    a.click();
  };

  return (
    <>
      <Navbar />
      <div className="monthly-savings-container">
         <Link to="/admin/dashboard" style={{ color: '#1976d2', textDecoration: 'none', fontSize: '14px' }}>← Dashboard</Link>
        <div className="page-header">
          <h1>Monthly Savings Report</h1>
          <p>View member savings contributions by month</p>
        </div>

        <div className="controls">
          <div className="month-selector">
            <label>Select Month:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>
          <button className="btn-export" onClick={exportToCSV} disabled={loading || savingsData.length === 0}>
            📥 Export to CSV
          </button>
        </div>

        {loading ? (
          <div className="loading">📊 Loading report...</div>
        ) : savingsData.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📭</div>
            <h3>No Savings Data</h3>
            <p>No savings recorded for the selected month.</p>
          </div>
        ) : (
          <>
            <div className="summary-cards">
              <div className="summary-card">
                <h3>Total Monthly Contributions</h3>
                <p className="amount">{formatCurrency(getTotalMonthlySavings())}</p>
              </div>
              <div className="summary-card">
                <h3>Total Member Savings</h3>
                <p className="amount">{formatCurrency(getTotalAllSavings())}</p>
              </div>
              <div className="summary-card">
                <h3>Active Members</h3>
                <p className="amount">{savingsData.filter(m => m.isActive).length}</p>
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Member Name</th>
                    <th>Monthly Savings</th>
                    <th>Total Savings</th>
                    <th>Phone</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {savingsData.map((member, index) => (
                    <tr key={member.id}>
                      <td>{index + 1}</td>
                      <td>{member.name}</td>
                      <td className="amount">{formatCurrency(member.monthlySavings)}</td>
                      <td className="amount">{formatCurrency(member.totalSavings)}</td>
                      <td>{member.phone}</td>
                      <td>
                        <span className={`status-badge ${member.isActive ? 'active' : 'inactive'}`}>
                          {member.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="2"><strong>TOTAL</strong></td>
                    <td className="amount"><strong>{formatCurrency(getTotalMonthlySavings())}</strong></td>
                    <td className="amount"><strong>{formatCurrency(getTotalAllSavings())}</strong></td>
                    <td colSpan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default MonthlySavingsReport;