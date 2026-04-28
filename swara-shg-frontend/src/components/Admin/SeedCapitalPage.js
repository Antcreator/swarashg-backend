import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../Navbar/navbar';
import { seedCapitalAPI } from '../../Service/Api';
import '../MembersManagementAdmin/Members.css';
import { Sprout } from 'lucide-react';

const SeedCapitalPage = () => {
  const [data, setData]       = useState([]);
  const [summary, setSummary] = useState({ total: 0, members: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await seedCapitalAPI.getAll();
      setData(res.data.members || []);
      setSummary({
        total:   res.data.totalSeedCapital   || 0,
        members: res.data.membersContributed || 0,
      });
    } catch (err) {
      console.error('Failed to fetch seed capital:', err);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n || 0);

  const filtered = data.filter(m =>
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Navbar />
      <div className="admin-container">
        <Link to="/admin/dashboard" style={{ color: '#1976d2', textDecoration: 'none', fontSize: '14px' }}>← Dashboard</Link>
        <div className="page-header">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sprout size={24} color="#2e7d32" /> Seed Capital
          </h1>
          <input
            type="text"
            placeholder="Search member..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', width: '220px' }}
          />
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: '#e8f5e9', border: '2px solid #4caf50', borderRadius: '10px', padding: '20px' }}>
            <p style={{ margin: '0 0 6px', color: '#555', fontSize: '13px' }}>Total Seed Capital</p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#2e7d32' }}>{fmt(summary.total)}</p>
          </div>
          <div style={{ background: '#e3f2fd', border: '2px solid #1976d2', borderRadius: '10px', padding: '20px' }}>
            <p style={{ margin: '0 0 6px', color: '#555', fontSize: '13px' }}>Members Contributed</p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#1565c0' }}>{summary.members}</p>
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading seed capital data...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Member Name</th>
                  <th>Phone</th>
                  <th>Total Seed Capital</th>
                  <th>Contributions</th>
                  <th>Last Contribution</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>No records found</td></tr>
                ) : filtered.map((m, i) => (
                  <tr key={m.id}>
                    <td>{i + 1}</td>
                    <td><strong>{m.firstName} {m.lastName}</strong></td>
                    <td>{m.phone || '—'}</td>
                    <td style={{ fontWeight: 'bold', color: '#2e7d32' }}>{fmt(m.totalSeedCapital)}</td>
                    <td>{m.contributionCount || 0}</td>
                    <td>{m.lastContribution ? new Date(m.lastContribution).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#f5f5f5', fontWeight: 'bold' }}>
                    <td colSpan="3">Total</td>
                    <td style={{ color: '#2e7d32' }}>{fmt(filtered.reduce((s, m) => s + Number(m.totalSeedCapital || 0), 0))}</td>
                    <td>{filtered.reduce((s, m) => s + Number(m.contributionCount || 0), 0)}</td>
                    <td></td>
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

export default SeedCapitalPage;