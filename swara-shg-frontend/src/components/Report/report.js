import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { savingsAPI, loansAPI, membersAPI, chamaaAPI,
         registrationFeeAPI, seedCapitalAPI, finesAPI,
         depositsAPI } from '../../Service/Api';
import Navbar from '../Navbar/navbar';
import '../MembersManagementAdmin/Members.css';
import './report.css';
import {
  Wallet, CalendarDays, ClipboardList, Users,
  RefreshCw, Calendar, BarChart2, ScrollText,
  Download, Printer, Menu, X, Check, AlertTriangle,
} from 'lucide-react';

const MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const MONTH_FULL = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const getFiscalMonths = (year) => [
  { month: 12, year: year - 1 },
  ...Array.from({ length: 11 }, (_, i) => ({ month: i + 1, year })),
];

const sortAlpha = (arr, getNameFn) =>
  [...arr].sort((a, b) => getNameFn(a).localeCompare(getNameFn(b)));


const Reports = () => {
  const [activeReport, setActiveReport]   = useState(null);
  const [reportData, setReportData]       = useState(null);
  const [loading, setLoading]             = useState(false);
  const [sidebarOpen, setSidebarOpen]     = useState(false);

  const [pendingFilters, setPendingFilters] = useState({
    month: new Date().getMonth() + 1,
    year:  new Date().getFullYear(),
  });

  const [appliedFilters, setAppliedFilters] = useState({
    month: new Date().getMonth() + 1,
    year:  new Date().getFullYear(),
  });

  const generateReport = async (reportType, filtersOverride) => {
    const filters = filtersOverride || appliedFilters;
    setLoading(true);
    setActiveReport(reportType);
    setReportData(null);
    setSidebarOpen(false);

    try {
      let data;
      switch (reportType) {
        case 'savings-monthly':      data = await fetchMonthlySavingsReport(filters);      break;
        case 'loans-summary':        data = await fetchLoansSummaryReport();                break;
        case 'members-summary':      data = await fetchMembersSummaryReport();              break;
        case 'chamaa-monthly':       data = await fetchChamaaMonthlyReport(filters);        break;
        case 'chamaa-payments':      data = await fetchChamaaPaymentsReport(filters);       break;
        case 'financial-summary':    data = await fetchFinancialSummaryReport(filters);     break;
        case 'yearly-savings':       data = await fetchYearlySavingsReport(filters);        break;
        case 'yearly-chamaa':        data = await fetchYearlyChamaaReport(filters);         break;
        case 'summation-all':        data = await fetchSummationAllReport();                break;
        default: break;
      }
      setReportData(data);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    const newFilters = { ...pendingFilters };
    setAppliedFilters(newFilters);
    if (activeReport) generateReport(activeReport, newFilters);
  };

  // ── Fetchers ─────────────────────────────────────────────────

  const fetchMonthlySavingsReport = async (filters) => {
    const res = await savingsAPI.getMonthlyReport(filters.month, filters.year);
    const data = res.data;
    if (data.details) {
      data.details = sortAlpha(data.details, r => `${r.firstName} ${r.lastName}`);
    }
    return data;
  };

  const fetchLoansSummaryReport = async () => {
    const [loansRes, statsRes] = await Promise.all([loansAPI.getAll(), loansAPI.getStatistics()]);
    const loans = sortAlpha(
      loansRes.data.loans,
      l => l.member ? `${l.member.firstName} ${l.member.lastName}` : `#${l.memberId}`
    );
    return { loans, statistics: statsRes.data.statistics };
  };

  const fetchMembersSummaryReport = async () => {
    const res = await membersAPI.getAll();
    const members = sortAlpha(res.data.members, m => `${m.firstName} ${m.lastName}`);
    return { members };
  };

  const fetchChamaaMonthlyReport = async (filters) => {
    const cyclesRes    = await chamaaAPI.getAllCycles();
    const cycles       = cyclesRes.data.cycles || [];
    const cycleDetails = await Promise.all(
      cycles.map(async (cycle) => {
        try {
          const res          = await chamaaAPI.getCycleById(cycle.id);
          const participants = res.data.participants || [];
          const members = participants.map((p) => {
            const name          = p.member ? `${p.member.firstName} ${p.member.lastName}` : `Member #${p.memberId}`;
            const monthContribs = (p.contributions || []).filter(c => Number(c.month) === Number(filters.month) && Number(c.year) === Number(filters.year));
            const paid          = monthContribs.length > 0;
            const amount        = monthContribs.reduce((sum, c) => sum + Number(c.amount || 0), 0);
            const fine          = monthContribs.reduce((sum, c) => sum + Number(c.fineAmount || 0), 0);
            return { id: p.id, name, position: p.position, hasReceived: p.hasReceived, receivedDate: p.receivedDate, paidContributions: p.paidContributions, totalParticipants: cycle.totalParticipants, paid, amount, fine, paymentDate: monthContribs[0]?.paymentDate || null };
          });
          const sortedMembers    = sortAlpha(members, m => m.name);
          const totalCollected   = sortedMembers.reduce((sum, m) => sum + m.amount, 0);
          const paidCount        = sortedMembers.filter((m) => m.paid).length;
          const expectedPerMonth = Number(cycle.contributionAmount) * sortedMembers.length;
          return { cycleId: cycle.id, cycleName: cycle.name, contribution: cycle.contributionAmount, isActive: cycle.isActive, totalParticipants: cycle.totalParticipants, completedRounds: cycle.completedRounds, members: sortedMembers, totalCollected, paidCount, expectedPerMonth };
        } catch { return null; }
      })
    );
    return { cycles: cycleDetails.filter(Boolean), month: filters.month, year: filters.year };
  };

  // ── NEW: Chamaa Payments Report ───────────────────────────────
  // Shows all members with chamaa payment status for the selected month.
  // Checks ChamaaContribution records (from both manual recording and
  // deposit approval) so both payment paths are captured.
  const fetchChamaaPaymentsReport = async (filters) => {
    try {
      // Try the dedicated backend endpoint first
      const res = await chamaaAPI.getPaymentsReport(filters.month, filters.year);
      const data = res.data;
      if (data.details) {
        data.details = sortAlpha(data.details, r => `${r.firstName} ${r.lastName}`);
      }
      return data;
    } catch (err) {
      // Fallback: compute client-side from existing APIs
      const [membersRes, cyclesRes] = await Promise.all([
        membersAPI.getAll(),
        chamaaAPI.getAllCycles(),
      ]);

      const members = sortAlpha(membersRes.data.members || [], m => `${m.firstName} ${m.lastName}`);
      const cycles  = cyclesRes.data.cycles || [];

      // Fetch full participant + contribution data for each active cycle
      const cycleDetails = await Promise.all(
        cycles.filter(c => c.isActive).map(async cycle => {
          try {
            const res = await chamaaAPI.getCycleById(cycle.id);
            return { ...cycle, participants: res.data.participants || [] };
          } catch { return { ...cycle, participants: [] }; }
        })
      );

      // Build a map: memberId → array of slots with this month's contributions
      const memberPaymentMap = {};
      cycleDetails.forEach(cycle => {
        (cycle.participants || []).forEach(p => {
          const mid = Number(p.memberId);
          if (!memberPaymentMap[mid]) memberPaymentMap[mid] = [];
          const monthContribs = (p.contributions || []).filter(
            c => Number(c.month) === Number(filters.month) && Number(c.year) === Number(filters.year)
          );
          memberPaymentMap[mid].push({
            cycleId:        cycle.id,
            cycleName:      cycle.name,
            participantId:  p.id,
            position:       p.position,
            scheduledMonth: p.scheduledMonth,
            scheduledYear:  p.scheduledYear,
            paid:           monthContribs.length > 0,
            isLate:         monthContribs.some(c => c.isLate),
            amount:         monthContribs.reduce((s, c) => s + Number(c.amount || 0), 0),
            fine:           monthContribs.reduce((s, c) => s + Number(c.fineAmount || 0), 0),
            paymentDate:    monthContribs[0]?.paymentDate || null,
          });
        });
      });

      const details = members.map(member => {
        const mid   = Number(member.id);
        const slots = memberPaymentMap[mid] || [];
        const hasActiveChamaa = slots.length > 0;
        const paid     = slots.some(s => s.paid);
        const isLate   = slots.some(s => s.isLate);
        const amount   = slots.reduce((s, sl) => s + sl.amount, 0);
        const fine     = slots.reduce((s, sl) => s + sl.fine, 0);

        return {
          id:             mid,
          memberId:       member.memberId,
          firstName:      member.firstName,
          lastName:       member.lastName,
          phone:          member.phone || '',
          hasActiveChamaa,
          slots,
          paid,
          isLate,
          amount,
          fine,
          status: !hasActiveChamaa
            ? 'No Active Chamaa'
            : !paid
              ? 'Not Paid'
              : isLate
                ? 'Late'
                : 'On Time',
        };
      });

      const summary = {
        totalMembers:      details.length,
        membersWithChamaa: details.filter(d => d.hasActiveChamaa).length,
        paidMembers:       details.filter(d => d.paid && d.hasActiveChamaa).length,
        unpaidMembers:     details.filter(d => !d.paid && d.hasActiveChamaa).length,
        latePayments:      details.filter(d => d.isLate).length,
        totalCollected:    details.reduce((s, d) => s + d.amount, 0),
        totalFines:        details.reduce((s, d) => s + d.fine, 0),
      };

      return { month: Number(filters.month), year: Number(filters.year), summary, details };
    }
  };

  const fetchFinancialSummaryReport = async (filters) => {
    const [membersRes, loansRes, savingsRes] = await Promise.all([membersAPI.getAll(), loansAPI.getStatistics(), savingsAPI.getAll()]);
    const members   = membersRes.data.members;
    const loanStats = loansRes.data.statistics;
    const savings   = savingsRes.data.savings;
    return { totalMembers: members.length, totalSavings: members.reduce((s, m) => s + Number(m.total_savings || 0), 0), activeLoans: loanStats.active_loans || 0, totalDisbursed: Number(loanStats.total_disbursed || 0), totalCollected: Number(loanStats.total_collected || 0), outstandingBalance: Number(loanStats.outstanding_balance || 0), defaultedLoans: Number(loanStats.defaulted_loans || 0), savingsThisMonth: savings.filter(s => s.month === filters.month && s.year === filters.year).length };
  };

  const fetchYearlySavingsReport = async (filters) => {
    const fiscalMonths = getFiscalMonths(filters.year);
    const years        = [...new Set(fiscalMonths.map(fm => fm.year))];
    const [membersRes, ...savingsResults] = await Promise.all([
      membersAPI.getAll(),
      ...years.map(y => savingsAPI.getAll({ year: y })),
    ]);
    const members  = sortAlpha(membersRes.data.members, m => `${m.firstName} ${m.lastName}`);
    const allSavings = savingsResults.flatMap((res, i) =>
      (res.data.savings || []).filter(s => Number(s.year) === years[i])
    );
    const rows = members.map(member => {
      const memberSavings = allSavings.filter(s => Number(s.memberId) === Number(member.id));
      const months  = {};
      let yearTotal = 0;
      fiscalMonths.forEach(fm => {
        const key     = `${fm.year}-${fm.month}`;
        const entries = memberSavings.filter(s => Number(s.month) === fm.month && Number(s.year) === fm.year && s.isPaid);
        const sum     = entries.reduce((acc, s) => acc + Number(s.amount || 0), 0);
        months[key]   = sum;
        yearTotal    += sum;
      });
      return { id: member.id, name: `${member.firstName} ${member.lastName}`, months, yearTotal };
    });
    const colTotals = {};
    fiscalMonths.forEach(fm => {
      const key      = `${fm.year}-${fm.month}`;
      colTotals[key] = rows.reduce((sum, r) => sum + (r.months[key] || 0), 0);
    });
    const grandTotal = rows.reduce((sum, r) => sum + r.yearTotal, 0);
    return { rows, colTotals, grandTotal, year: filters.year, fiscalMonths };
  };

  const fetchYearlyChamaaReport = async (filters) => {
    const fiscalMonths = getFiscalMonths(filters.year);
    const cyclesRes    = await chamaaAPI.getAllCycles();
    const cycles       = cyclesRes.data.cycles || [];
    const cycleDetails = await Promise.all(
      cycles.map(async cycle => {
        try {
          const res          = await chamaaAPI.getCycleById(cycle.id);
          const participants = res.data.participants || [];
          const unsortedRows = participants.map(p => {
            const name     = p.member ? `${p.member.firstName} ${p.member.lastName}` : `Member #${p.memberId}`;
            const contribs = p.contributions || [];
            const months   = {};
            fiscalMonths.forEach(fm => {
              const key   = `${fm.year}-${fm.month}`;
              const mc    = contribs.filter(c => Number(c.month) === fm.month && Number(c.year) === fm.year);
              months[key] = mc.reduce((sum, c) => sum + Number(c.amount || 0), 0);
            });
            const yearTotal = Object.values(months).reduce((a, b) => a + b, 0);
            return { name, months, yearTotal, position: p.position };
          });
          const rows = sortAlpha(unsortedRows, r => r.name);
          const colTotals = {};
          fiscalMonths.forEach(fm => {
            const key      = `${fm.year}-${fm.month}`;
            colTotals[key] = rows.reduce((sum, r) => sum + (r.months[key] || 0), 0);
          });
          const grandTotal = rows.reduce((sum, r) => sum + r.yearTotal, 0);
          return { cycleId: cycle.id, cycleName: cycle.name, contribution: cycle.contributionAmount, isActive: cycle.isActive, rows, colTotals, grandTotal };
        } catch { return null; }
      })
    );
    return { cycles: cycleDetails.filter(Boolean), year: filters.year, fiscalMonths };
  };

  const fetchSummationAllReport = async () => {
    const [membersRes, regFeeRes, seedCapRes, savingsRes, finesRes, loansRes] = await Promise.all([
      membersAPI.getAll(), registrationFeeAPI.getAll(), seedCapitalAPI.getAll(),
      savingsAPI.getAll(), finesAPI.getAll(), loansAPI.getAll(),
    ]);
    const members    = sortAlpha(membersRes.data.members || [], m => `${m.firstName} ${m.lastName}`);
    const regFees    = regFeeRes.data.members    || [];
    const seedCaps   = seedCapRes.data.members   || [];
    const allSavings = savingsRes.data.savings   || [];
    const allFines   = finesRes.data.fines       || [];
    const allLoans   = loansRes.data.loans       || [];
    const cyclesRes    = await chamaaAPI.getAllCycles();
    const cycles       = cyclesRes.data.cycles || [];
    const cycleDetails = await Promise.all(
      cycles.map(async (cycle) => {
        try {
          const res = await chamaaAPI.getCycleById(cycle.id);
          return { ...cycle, participants: res.data.participants || [] };
        } catch { return { ...cycle, participants: [] }; }
      })
    );
    const regFeeMap = {};
    regFees.forEach(m => { regFeeMap[Number(m.id)] = m.hasPaid ? Number(m.amount || 0) : 0; });
    const seedCapMap = {};
    seedCaps.forEach(m => { seedCapMap[Number(m.id)] = Number(m.totalSeedCapital || 0); });
    const savingsMap = {};
    allSavings.forEach(s => {
      const mid = Number(s.memberId);
      if (!savingsMap[mid]) savingsMap[mid] = 0;
      if (s.isPaid) savingsMap[mid] += Number(s.amount || 0);
    });
    const chamaaMap = {};
    cycleDetails.forEach(cycle => {
      (cycle.participants || []).forEach(p => {
        const mid = Number(p.memberId);
        if (!chamaaMap[mid]) chamaaMap[mid] = 0;
        (p.contributions || []).forEach(c => { chamaaMap[mid] += Number(c.amount || 0); });
      });
    });
    const savingsFinesMap = {};
    allFines.filter(f => f.fineType === 'savings_late').forEach(f => {
      const mid = Number(f.member?.id || f.memberId);
      if (!savingsFinesMap[mid]) savingsFinesMap[mid] = 0;
      savingsFinesMap[mid] += Number(f.amount || 0);
    });
    const chamaaFinesMap = {};
    allFines.filter(f => f.fineType === 'chamaa_late').forEach(f => {
      const mid = Number(f.member?.id || f.memberId);
      if (!chamaaFinesMap[mid]) chamaaFinesMap[mid] = 0;
      chamaaFinesMap[mid] += Number(f.amount || 0);
    });
    const currentYear = new Date().getFullYear();
    const novStart    = new Date(currentYear, 10, 1);
    const novEnd      = new Date(currentYear, 10, 30, 23, 59, 59);
    const loanDeductionMap = {};
    allLoans.filter(l => l.approvalStatus === 'approved' && l.status === 'active' && l.dueDate && new Date(l.dueDate) >= novStart && new Date(l.dueDate) <= novEnd)
      .forEach(l => {
        const mid       = Number(l.memberId || l.member?.id);
        const remaining = Number(l.remainingBalance || 0);
        const memberSavings = savingsMap[mid] || 0;
        const shortfall = Math.max(0, remaining - memberSavings);
        if (!loanDeductionMap[mid]) loanDeductionMap[mid] = 0;
        loanDeductionMap[mid] += shortfall;
      });
    const guarantorMap = {};
    allLoans.filter(l => l.approvalStatus === 'approved' && l.status === 'default')
      .forEach(l => {
        (l.guarantors || []).forEach(g => {
          if (g.approvalStatus === 'accepted' && g.guarantorId && g.guarantorId !== -1) {
            const mid = Number(g.guarantorId);
            if (!guarantorMap[mid]) guarantorMap[mid] = 0;
            guarantorMap[mid] += Number(l.remainingBalance || 0) / 2;
          }
        });
      });
    const othersMap = {};
    await Promise.all(
      members.map(async (m) => {
        try {
          const res         = await depositsAPI.getSummary(m.id);
          const distributed = (res.data.deposits || []).filter(d => d.depositStatus === 'distributed');
          othersMap[m.id]   = distributed.reduce((sum, d) => sum + Number(d.othersAmount || 0), 0);
        } catch { othersMap[m.id] = 0; }
      })
    );
    const rows = members.map(m => {
      const mid = Number(m.id);
      return {
        id: mid, name: `${m.firstName} ${m.lastName}`, memberId: m.memberId || '', phone: m.phone || '',
        registrationFee: regFeeMap[mid] || 0, seedCapital: seedCapMap[mid] || 0,
        savings: savingsMap[mid] || 0, chamaa: chamaaMap[mid] || 0,
        savingsFines: savingsFinesMap[mid] || 0, chamaaFines: chamaaFinesMap[mid] || 0,
        loanDeduction: loanDeductionMap[mid] || 0, guarantorLiability: guarantorMap[mid] || 0,
        others: othersMap[mid] || 0,
      };
    });
    const cols = ['registrationFee','seedCapital','savings','chamaa','savingsFines','chamaaFines','loanDeduction','guarantorLiability','others'];
    const totals = {};
    cols.forEach(col => { totals[col] = rows.reduce((sum, r) => sum + r[col], 0); });
    return { rows, totals };
  };

  // ── Helpers ───────────────────────────────────────────────────
  const formatCurrency = (amt) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amt || 0);

  const getReportTitle = () => {
    const f = appliedFilters;
    const titles = {
      'savings-monthly':   `Monthly Savings — ${MONTH_FULL[f.month]} ${f.year}`,
      'loans-summary':     'Loans Summary Report',
      'members-summary':   'Members Summary Report',
      'chamaa-monthly':    `Chamaa Report — ${MONTH_FULL[f.month]} ${f.year}`,
      'chamaa-payments':   `Chamaa Payments — ${MONTH_FULL[f.month]} ${f.year}`,
      'financial-summary': `Financial Summary — ${MONTH_FULL[f.month]} ${f.year}`,
      'yearly-savings':    `Yearly Savings — Dec ${f.year - 1} to Nov ${f.year}`,
      'yearly-chamaa':     `Yearly Chamaa — Dec ${f.year - 1} to Nov ${f.year}`,
      'summation-all':     'Summation of All Members',
    };
    return titles[activeReport] || 'Report';
  };

  // ── PDF ───────────────────────────────────────────────────────
  const downloadPDF = () => {
    const content = document.getElementById('report-content');
    if (!content) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Swara SHG — ${getReportTitle()}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; font-size: 11px; }
            h1 { color: #1a1a2e; border-bottom: 3px solid #2c5f2d; padding-bottom: 10px; font-size: 18px; }
            h2 { color: #555; margin-top: 16px; font-size: 14px; }
            h3 { color: #1a1a2e; font-size: 13px; margin: 20px 0 8px; }
            table { border-collapse: collapse; margin-top: 10px; font-size: 9px; width: 100%; }
            th { background: #2c5f2d; color: #fff; padding: 8px 7px; text-align: left; font-size: 9px; }
            td { padding: 6px 7px; border-bottom: 1px solid #e0e0e0; text-align: left; font-size: 9px; }
            tr:nth-child(even) { background: #f9f9f9; }
            tfoot tr { background: #1a1a2e !important; }
            tfoot td { color: white !important; font-weight: 700; }
            .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
            .summary-item { border: 1px solid #ddd; padding: 12px; border-radius: 6px; }
            .summary-item strong { display: block; color: #555; margin-bottom: 4px; font-size: 9px; }
            .footer { margin-top: 30px; text-align: center; color: #999; font-size: 9px; border-top: 1px solid #eee; padding-top: 12px; }
            .badge-paid { background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:10px; font-weight:600; }
            .badge-late { background:#fff8e1; color:#e65100; padding:2px 8px; border-radius:10px; font-weight:600; }
            .badge-unpaid { background:#fce4ec; color:#c62828; padding:2px 8px; border-radius:10px; font-weight:600; }
            .badge-none { background:#f5f5f5; color:#9e9e9e; padding:2px 8px; border-radius:10px; font-weight:600; }
            @media print { @page { size: landscape; margin: 8mm; } body { padding: 8px; } }
          </style>
        </head>
        <body>
          <h1>Swara Self Help Group — ${getReportTitle()}</h1>
          ${content.innerHTML}
          <div class="footer">Generated on ${new Date().toLocaleString()} | Swara SHG Management System</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // ── CSV ───────────────────────────────────────────────────────
  const downloadCSV = () => {
    if (!reportData) return;
    let csv = '';
    const title = getReportTitle();
    csv += `${title}\nGenerated: ${new Date().toLocaleString()}\n\n`;

    if (activeReport === 'chamaa-payments' && reportData.details) {
      csv += 'Member ID,Member,Phone,Status,Amount Paid,Fine,Cycle(s)\n';
      reportData.details.forEach(r => {
        const cycles = r.slots.map(s => s.cycleName).filter((v, i, a) => a.indexOf(v) === i).join('; ');
        csv += `"${r.memberId}","${r.firstName} ${r.lastName}","${r.phone}","${r.status}",${r.amount},${r.fine},"${cycles}"\n`;
      });
      const s = reportData.summary;
      csv += `\nSummary\nTotal Members,${s.totalMembers}\nMembers with Chamaa,${s.membersWithChamaa}\nPaid,${s.paidMembers}\nUnpaid,${s.unpaidMembers}\nLate,${s.latePayments}\nTotal Collected,${s.totalCollected}\nTotal Fines,${s.totalFines}\n`;

    } else if (activeReport === 'summation-all' && reportData.rows) {
      const cols    = ['registrationFee','seedCapital','savings','chamaa','savingsFines','chamaaFines','loanDeduction','guarantorLiability','others'];
      const negCols = new Set(['savingsFines','chamaaFines','loanDeduction','guarantorLiability']);
      const headers = ['Member ID','Member','Phone','Reg. Fee','Seed Capital','Savings','Chamaa','Savings Fines','Chamaa Fines','Loan Deduction','Guarantor Liability','Others','Row Total'];
      csv += headers.join(',') + '\n';
      reportData.rows.forEach(r => {
        const rowTotal = cols.reduce((s, c) => s + (negCols.has(c) ? -r[c] : r[c]), 0);
        csv += `"${r.memberId}","${r.name}","${r.phone}",${cols.map(c => negCols.has(c) && r[c] > 0 ? -r[c] : r[c]).join(',')},${rowTotal}\n`;
      });
      const t = reportData.totals;
      const grandTotal = cols.reduce((s, c) => s + (negCols.has(c) ? -t[c] : t[c]), 0);
      csv += `,,TOTAL,${cols.map(c => negCols.has(c) && t[c] > 0 ? -t[c] : t[c]).join(',')},${grandTotal}\n`;

    } else if (activeReport === 'yearly-savings' && reportData.rows) {
      const fms = reportData.fiscalMonths;
      csv += `Member,${fms.map(fm => `${MONTH_FULL[fm.month]} ${fm.year}`).join(',')},Year Total\n`;
      reportData.rows.forEach(r => { csv += `"${r.name}",${fms.map(fm => r.months[`${fm.year}-${fm.month}`] || 0).join(',')},${r.yearTotal}\n`; });
      csv += `TOTAL,${fms.map(fm => reportData.colTotals[`${fm.year}-${fm.month}`] || 0).join(',')},${reportData.grandTotal}\n`;

    } else if (activeReport === 'yearly-chamaa' && reportData.cycles) {
      const fms = reportData.fiscalMonths;
      reportData.cycles.forEach(cycle => {
        csv += `\nCycle: ${cycle.cycleName} (${cycle.isActive ? 'Active' : 'Ended'})\n`;
        csv += `Member,${fms.map(fm => `${MONTH_FULL[fm.month]} ${fm.year}`).join(',')},Year Total\n`;
        cycle.rows.forEach(r => { csv += `"${r.name}",${fms.map(fm => r.months[`${fm.year}-${fm.month}`] || 0).join(',')},${r.yearTotal}\n`; });
        csv += `TOTAL,${fms.map(fm => cycle.colTotals[`${fm.year}-${fm.month}`] || 0).join(',')},${cycle.grandTotal}\n\n`;
      });

    } else if (activeReport === 'chamaa-monthly' && reportData.cycles) {
      reportData.cycles.forEach(cycle => {
        csv += `\nCycle: ${cycle.cycleName}\n`;
        csv += `Member,Status,Amount Paid,Fine,Payment Date\n`;
        cycle.members.forEach(m => { csv += `"${m.name}",${m.paid ? 'Paid' : 'Unpaid'},${m.amount},${m.fine},${m.paymentDate ? new Date(m.paymentDate).toLocaleDateString() : ''}\n`; });
        csv += `,Total Collected,${cycle.totalCollected}\n\n`;
      });

    } else if (activeReport === 'savings-monthly' && reportData.details) {
      csv += 'Member,Amount,Payment Date,Status,Fine\n';
      reportData.details.forEach(r => { csv += `"${r.firstName} ${r.lastName}",${r.amount || 0},${r.paymentDate || ''},${r.status},${r.fineAmount || 0}\n`; });

    } else if (activeReport === 'loans-summary' && reportData.loans) {
      csv += 'Borrower,Amount,Interest Rate,Duration,Disbursed,Due Date,Paid,Balance,Status\n';
      reportData.loans.forEach(l => { csv += `"${l.member ? `${l.member.firstName} ${l.member.lastName}` : `#${l.memberId}`}",${l.amount},${l.interestRate}%,${l.durationMonths},${l.disbursementDate},${l.dueDate},${l.amountPaid},${l.remainingBalance},${l.status}\n`; });

    } else if (activeReport === 'members-summary' && reportData.members) {
      csv += 'Member ID,Name,Phone,Total Savings,Active Guarantees,Date Joined\n';
      reportData.members.forEach(m => { csv += `"${m.memberId}","${m.firstName} ${m.lastName}",${m.phone},${m.total_savings || 0},${m.active_guarantees || 0},${m.dateJoined}\n`; });

    } else if (activeReport === 'financial-summary') {
      csv += 'Metric,Value\n';
      ['totalMembers','totalSavings','activeLoans','totalDisbursed','totalCollected','outstandingBalance','defaultedLoans','savingsThisMonth']
        .forEach(k => { csv += `${k},${reportData[k]}\n`; });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // ── Sub-components ────────────────────────────────────────────

  const YearlyTable = ({ rows, colTotals, grandTotal, year, fiscalMonths }) => (
    <div className="yearly-table-wrapper">
      <table className="yearly-table">
        <thead>
          <tr style={{ background: '#0f172a' }}>
            <th className="yearly-th yearly-th--member">
              <div style={{ padding:'16px', color:'#f8fafc', fontSize:'11px', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', textAlign:'left' }}>Member</div>
            </th>
            {fiscalMonths.map((fm) => {
              const key = `${fm.year}-${fm.month}`;
              return (
                <th key={key} className="yearly-th yearly-th--month">
                  <div className="month-pill">
                    <div className="month-pill__abbr">{MONTH_NAMES[fm.month]}</div>
                    <div className="month-pill__full">{fm.year !== year ? `${MONTH_FULL[fm.month]} '${String(fm.year).slice(-2)}` : MONTH_FULL[fm.month]}</div>
                  </div>
                </th>
              );
            })}
            <th className="yearly-th yearly-th--total">
              <div className="total-pill">
                <div className="total-pill__label">TOTAL</div>
                <div className="total-pill__year">Dec {year - 1} – Nov {year}</div>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const isEven = idx % 2 === 0;
            const rowBg  = isEven ? '#ffffff' : '#f8fafc';
            return (
              <tr key={idx} style={{ background: rowBg, borderBottom:'1px solid #e2e8f0' }}>
                <td className="yearly-td yearly-td--member" style={{ background: rowBg }}>
                  <div className="member-cell">
                    <div className="member-avatar" style={{ background:`hsl(${(idx*47)%360},55%,88%)`, color:`hsl(${(idx*47)%360},55%,30%)` }}>
                      {row.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="member-name">{row.name}</span>
                  </div>
                </td>
                {fiscalMonths.map((fm) => {
                  const key = `${fm.year}-${fm.month}`;
                  const val = row.months[key] || 0;
                  return (
                    <td key={key} className="yearly-td yearly-td--amount">
                      {val > 0 ? <span className="amount-badge">{formatCurrency(val)}</span> : <span className="amount-empty">—</span>}
                    </td>
                  );
                })}
                <td className="yearly-td yearly-td--rowtotal" style={{ background: row.yearTotal > 0 ? (isEven ? '#f0fdf4' : '#dcfce7') : rowBg, color: row.yearTotal > 0 ? '#15803d' : '#cbd5e1' }}>
                  {row.yearTotal > 0 ? formatCurrency(row.yearTotal) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ background:'#0f172a' }}>
            <td className="yearly-foot-label">TOTALS</td>
            {fiscalMonths.map((fm) => {
              const key = `${fm.year}-${fm.month}`;
              const val = colTotals[key] || 0;
              return (
                <td key={key} className="yearly-td yearly-td--amount">
                  {val > 0 ? <span className="amount-badge">{formatCurrency(val)}</span> : <span style={{ color:'#475569' }}>—</span>}
                </td>
              );
            })}
            <td className="yearly-foot-grand">{formatCurrency(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  const ChamaaMonthlyTable = ({ cycle }) => {
    const collectionRate = cycle.members.length > 0 ? Math.round((cycle.paidCount / cycle.members.length) * 100) : 0;
    return (
      <div className="chamaa-cycle-block">
        <div className="chamaa-cycle-header">
          <div className="chamaa-cycle-header__info">
            <div className="chamaa-cycle-header__name">{cycle.cycleName}</div>
            <div className="chamaa-cycle-header__meta">Required: <strong>{formatCurrency(cycle.contribution)}</strong>&nbsp;·&nbsp;{cycle.members.length} member{cycle.members.length !== 1 ? 's' : ''}&nbsp;·&nbsp;<span className="chamaa-paid-count">{cycle.paidCount}/{cycle.members.length} paid</span></div>
          </div>
          <div className="chamaa-cycle-header__right">
            <div className="chamaa-progress-bar"><div className="chamaa-progress-bar__fill" style={{ width:`${collectionRate}%`, background: collectionRate === 100 ? '#22c55e' : '#fbbf24' }} /></div>
            <span className="chamaa-progress-pct">{collectionRate}%</span>
            <span className={`cycle-badge ${cycle.isActive ? 'cycle-badge--active' : 'cycle-badge--ended'}`}>{cycle.isActive ? 'Active' : 'Ended'}</span>
            <div className="chamaa-collected"><div className="chamaa-collected__label">Collected</div><div className="chamaa-collected__value">{formatCurrency(cycle.totalCollected)}</div></div>
          </div>
        </div>
        <div className="chamaa-summary-strip">
          <div className="chamaa-summary-strip__item"><div className="chamaa-summary-strip__label">Expected</div><div className="chamaa-summary-strip__value">{formatCurrency(cycle.expectedPerMonth)}</div></div>
          <div className="chamaa-summary-strip__item"><div className="chamaa-summary-strip__label">Collected</div><div className="chamaa-summary-strip__value chamaa-summary-strip__value--green">{formatCurrency(cycle.totalCollected)}</div></div>
          <div className="chamaa-summary-strip__item"><div className="chamaa-summary-strip__label">Outstanding</div><div className={`chamaa-summary-strip__value ${cycle.expectedPerMonth - cycle.totalCollected > 0 ? 'chamaa-summary-strip__value--red' : 'chamaa-summary-strip__value--green'}`}>{formatCurrency(Math.max(0, cycle.expectedPerMonth - cycle.totalCollected))}</div></div>
        </div>
        {cycle.members.length === 0 ? <p className="chamaa-empty">No participants in this cycle.</p> : (
          <div className="chamaa-table-wrapper">
            <table className="chamaa-table">
              <thead>
                <tr><th>#</th><th>Member</th><th>Status</th><th>Amount Paid</th><th>Fine</th><th>Payment Date</th><th>Contributions</th><th>Pot Received</th></tr>
              </thead>
              <tbody>
                {cycle.members.map((member, idx) => (
                  <tr key={member.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    <td className="chamaa-td chamaa-td--pos">{idx + 1}</td>
                    <td className="chamaa-td"><div className="member-cell"><div className="member-avatar member-avatar--sm" style={{ background:`hsl(${(idx*53)%360},55%,88%)`, color:`hsl(${(idx*53)%360},55%,30%)` }}>{member.name.charAt(0).toUpperCase()}</div><span className="member-name">{member.name}</span></div></td>
                    <td className="chamaa-td chamaa-td--center">{member.paid ? <span className="status-badge status-badge--paid"><Check size={11} style={{ marginRight:3 }} />Paid</span> : <span className="status-badge status-badge--unpaid"><X size={11} style={{ marginRight:3 }} />Unpaid</span>}</td>
                    <td className="chamaa-td chamaa-td--right" style={{ color: member.paid ? '#15803d' : '#cbd5e1', fontWeight:700 }}>{member.paid ? formatCurrency(member.amount) : '—'}</td>
                    <td className="chamaa-td chamaa-td--right">{member.fine > 0 ? <span style={{ color:'#dc2626', fontWeight:700 }}>{formatCurrency(member.fine)}</span> : <span style={{ color:'#cbd5e1' }}>—</span>}</td>
                    <td className="chamaa-td chamaa-td--center chamaa-td--date">{member.paymentDate ? new Date(member.paymentDate).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) : '—'}</td>
                    <td className="chamaa-td chamaa-td--center"><div className="contrib-progress"><div className="contrib-progress__bar"><div className="contrib-progress__fill" style={{ width:`${Math.round((member.paidContributions / (member.totalParticipants || 1)) * 100)}%` }} /></div><span className="contrib-progress__label">{member.paidContributions}/{member.totalParticipants}</span></div></td>
                    <td className="chamaa-td chamaa-td--center">{member.hasReceived ? <span className="status-badge status-badge--received"><Check size={11} style={{ marginRight:3 }} />{member.receivedDate ? new Date(member.receivedDate).toLocaleDateString('en-KE', { day:'2-digit', month:'short' }) : 'Yes'}</span> : <span style={{ color:'#cbd5e1' }}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background:'#0f172a' }}>
                  <td colSpan={2} className="chamaa-foot-label">TOTALS</td>
                  <td className="chamaa-td chamaa-td--center" style={{ color:'#f8fafc', fontWeight:600 }}>{cycle.paidCount}/{cycle.members.length}</td>
                  <td className="chamaa-td chamaa-td--right" style={{ color:'#22c55e', fontWeight:800, fontSize:'14px' }}>{formatCurrency(cycle.totalCollected)}</td>
                  <td className="chamaa-td chamaa-td--right" style={{ color:'#f87171', fontWeight:700 }}>{formatCurrency(cycle.members.reduce((s, m) => s + m.fine, 0))}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    );
  };

  // ── NEW: Chamaa Payments Table ────────────────────────────────
  const ChamaaPaymentsTable = ({ details, summary, month, year }) => {
    const statusStyle = (status) => {
      if (status === 'On Time')          return { background:'#dcfce7', color:'#15803d', border:'1px solid #bbf7d0' };
      if (status === 'Late')             return { background:'#fff8e1', color:'#e65100', border:'1px solid #fde68a' };
      if (status === 'Not Paid')         return { background:'#fce4ec', color:'#c62828', border:'1px solid #fca5a5' };
      if (status === 'No Active Chamaa') return { background:'#f5f5f5', color:'#9e9e9e', border:'1px solid #e5e7eb' };
      return {};
    };

    const collectionRate = summary.membersWithChamaa > 0
      ? Math.round((summary.paidMembers / summary.membersWithChamaa) * 100)
      : 0;

    return (
      <div>
        {/* Summary cards */}
        <div className="summary-cards" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:'12px', marginBottom:'20px' }}>
          {[
            { label:'Members with Chamaa', value: summary.membersWithChamaa, color:'#1565c0', bg:'#e3f2fd' },
            { label:'Paid',                value: summary.paidMembers,       color:'#2e7d32', bg:'#e8f5e9' },
            { label:'Unpaid',              value: summary.unpaidMembers,     color:'#c62828', bg:'#fce4ec' },
            { label:'Late Payments',       value: summary.latePayments,      color:'#e65100', bg:'#fff8e1' },
            { label:'Total Collected',     value: formatCurrency(summary.totalCollected), color:'#4a148c', bg:'#f3e5f5' },
            { label:'Total Fines',         value: formatCurrency(summary.totalFines),     color:'#b71c1c', bg:'#ffebee' },
          ].map(card => (
            <div key={card.label} style={{ background:card.bg, borderRadius:'10px', padding:'14px 16px', border:`1px solid ${card.color}22` }}>
              <div style={{ fontSize:'11px', color:'#666', fontWeight:600, marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.04em' }}>{card.label}</div>
              <div style={{ fontSize:'20px', fontWeight:800, color:card.color }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* Collection rate bar */}
        <div style={{ marginBottom:'20px', padding:'14px 16px', background:'#f8fafc', borderRadius:'10px', border:'1px solid #e2e8f0' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
            <span style={{ fontSize:'13px', fontWeight:700, color:'#1a1a2e' }}>Collection Rate</span>
            <span style={{ fontSize:'16px', fontWeight:800, color: collectionRate === 100 ? '#15803d' : collectionRate >= 70 ? '#e65100' : '#c62828' }}>
              {collectionRate}%
            </span>
          </div>
          <div style={{ height:'8px', background:'#e2e8f0', borderRadius:'4px', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${collectionRate}%`, background: collectionRate === 100 ? '#22c55e' : collectionRate >= 70 ? '#f59e0b' : '#ef4444', borderRadius:'4px', transition:'width 0.3s' }} />
          </div>
          <div style={{ fontSize:'11px', color:'#888', marginTop:'6px' }}>
            {summary.paidMembers} of {summary.membersWithChamaa} active members paid for {MONTH_FULL[month]} {year}
          </div>
        </div>

        {/* Main table */}
        <div style={{ overflowX:'auto', borderRadius:'12px', border:'1px solid #e2e8f0', background:'white' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
            <thead>
              <tr style={{ background:'#1a1a2e' }}>
                <th style={{ padding:'12px 14px', color:'white', textAlign:'left', fontWeight:700, fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.06em', minWidth:'200px' }}>Member</th>
                <th style={{ padding:'12px 10px', color:'white', textAlign:'center', fontWeight:700, fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.06em' }}>Status</th>
                <th style={{ padding:'12px 10px', color:'white', textAlign:'right', fontWeight:700, fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.06em' }}>Amount Paid</th>
                <th style={{ padding:'12px 10px', color:'#f87171', textAlign:'right', fontWeight:700, fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.06em' }}>Fine</th>
                <th style={{ padding:'12px 10px', color:'#90caf9', textAlign:'left', fontWeight:700, fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.06em', minWidth:'120px' }}>Cycle(s)</th>
                <th style={{ padding:'12px 10px', color:'#90caf9', textAlign:'center', fontWeight:700, fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.06em' }}>Scheduled</th>
              </tr>
            </thead>
            <tbody>
              {details.map((row, idx) => {
                const isEven = idx % 2 === 0;
                const rowBg  = isEven ? '#ffffff' : '#f8fafc';
                // Unique cycle names for this member
                const cycleNames = [...new Set(row.slots.map(s => s.cycleName))];
                // Scheduled months across slots
                const scheduled = row.slots
                  .filter(s => s.scheduledMonth)
                  .map(s => `${MONTH_NAMES[s.scheduledMonth - 1]} ${s.scheduledYear || ''}`)
                  .filter((v, i, a) => a.indexOf(v) === i);

                return (
                  <tr key={row.id} style={{ background: rowBg, borderBottom:'1px solid #f0f0f0' }}>
                    {/* Member */}
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        <div style={{ width:'32px', height:'32px', borderRadius:'50%', flexShrink:0, background:`hsl(${(idx*47)%360},55%,88%)`, color:`hsl(${(idx*47)%360},55%,30%)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:800 }}>
                          {row.firstName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight:700, color:'#1a1a2e', fontSize:'13px' }}>{row.firstName} {row.lastName}</div>
                          <div style={{ display:'flex', gap:'6px', alignItems:'center', marginTop:'2px' }}>
                            <span style={{ fontFamily:'monospace', fontWeight:700, background:'#f0f4ff', color:'#1a3a8f', padding:'1px 6px', borderRadius:'5px', fontSize:'11px', border:'1px solid #c7d4f7' }}>
                              {row.memberId}
                            </span>
                            {row.phone && <span style={{ fontSize:'11px', color:'#94a3b8' }}>{row.phone}</span>}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status badge */}
                    <td style={{ padding:'10px', textAlign:'center' }}>
                      <span style={{ display:'inline-block', padding:'4px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:700, ...statusStyle(row.status) }}>
                        {row.status === 'On Time'  && <Check size={11} style={{ marginRight:4, verticalAlign:'middle' }} />}
                        {row.status === 'Late'     && <AlertTriangle size={11} style={{ marginRight:4, verticalAlign:'middle' }} />}
                        {row.status === 'Not Paid' && <X size={11} style={{ marginRight:4, verticalAlign:'middle' }} />}
                        {row.status}
                      </span>
                    </td>

                    {/* Amount */}
                    <td style={{ padding:'10px', textAlign:'right', fontWeight:700, color: row.amount > 0 ? '#15803d' : '#cbd5e1' }}>
                      {row.amount > 0 ? formatCurrency(row.amount) : '—'}
                    </td>

                    {/* Fine */}
                    <td style={{ padding:'10px', textAlign:'right', fontWeight:700, color: row.fine > 0 ? '#dc2626' : '#cbd5e1' }}>
                      {row.fine > 0 ? formatCurrency(row.fine) : '—'}
                    </td>

                    {/* Cycle names */}
                    <td style={{ padding:'10px', fontSize:'12px', color:'#555' }}>
                      {cycleNames.length > 0
                        ? cycleNames.map((name, i) => (
                          <span key={i} style={{ display:'inline-block', background:'#ede7f6', color:'#7b1fa2', borderRadius:'6px', padding:'2px 8px', fontSize:'11px', fontWeight:600, marginRight:'4px', marginBottom:'2px' }}>
                            {name}
                          </span>
                        ))
                        : <span style={{ color:'#ccc' }}>—</span>}
                    </td>

                    {/* Scheduled month */}
                    <td style={{ padding:'10px', textAlign:'center', fontSize:'12px' }}>
                      {scheduled.length > 0
                        ? scheduled.map((s, i) => (
                          <span key={i} style={{ display:'inline-block', background:'#e3f2fd', color:'#1565c0', borderRadius:'6px', padding:'2px 8px', fontSize:'11px', fontWeight:600, marginRight:'4px' }}>
                            {s}
                          </span>
                        ))
                        : <span style={{ color:'#ccc' }}>Not set</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background:'#1a1a2e', color:'white', fontWeight:700 }}>
                <td style={{ padding:'12px 14px', fontSize:'12px' }}>TOTALS ({details.filter(d => d.hasActiveChamaa).length} active)</td>
                <td style={{ padding:'12px 10px', textAlign:'center', fontSize:'12px', color:'#90caf9' }}>
                  {summary.paidMembers} paid / {summary.unpaidMembers} unpaid
                </td>
                <td style={{ padding:'12px 10px', textAlign:'right', color:'#86efac', fontSize:'13px', fontWeight:800 }}>
                  {formatCurrency(summary.totalCollected)}
                </td>
                <td style={{ padding:'12px 10px', textAlign:'right', color:'#fca5a5', fontSize:'13px', fontWeight:800 }}>
                  {summary.totalFines > 0 ? formatCurrency(summary.totalFines) : '—'}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  // ── Summation Table ───────────────────────────────────────────
  const NEGATIVE_COLS = new Set(['savingsFines', 'chamaaFines', 'loanDeduction', 'guarantorLiability']);

  const SummationTable = ({ rows, totals }) => {
    const columns = [
      { key:'registrationFee',    label:'Registration Fee',    short:'Reg. Fee',  color:'#000000', bg:'#ffffff', accent:'#000000' },
      { key:'seedCapital',        label:'Seed Capital',        short:'Seed Cap',  color:'#000000', bg:'#ffffff', accent:'#000000' },
      { key:'savings',            label:'Savings',             short:'Savings',   color:'#000000', bg:'#ffffff', accent:'#000000' },
      { key:'chamaa',             label:'Chamaa',              short:'Chamaa',    color:'#000000', bg:'#ffffff', accent:'#000000' },
      { key:'savingsFines',       label:'Savings Fines',       short:'Svgs Fine', color:'#000000', bg:'#ffffff', accent:'#000000' },
      { key:'chamaaFines',        label:'Chamaa Fines',        short:'Chma Fine', color:'#000000', bg:'#ffffff', accent:'#000000' },
      { key:'loanDeduction',      label:'Loan Deduction',      short:'Loan Ded.', color:'#000000', bg:'#ffffff', accent:'#000000' },
      { key:'guarantorLiability', label:'Guarantor Liability', short:'Guarantor', color:'#000000', bg:'#ffffff', accent:'#000000' },
      { key:'others',             label:'Others',              short:'Others',    color:'#000000', bg:'#ffffff', accent:'#000000' },
    ];
    const calcRowTotal = (row) => columns.reduce((sum, col) => NEGATIVE_COLS.has(col.key) ? sum - (row[col.key] || 0) : sum + (row[col.key] || 0), 0);
    const grandTotal   = columns.reduce((sum, col) => NEGATIVE_COLS.has(col.key) ? sum - (totals[col.key] || 0) : sum + (totals[col.key] || 0), 0);
    return (
      <div>
        <div style={{ overflowX:'auto', borderRadius:'12px', border:'1px solid #e2e8f0', boxShadow:'0 4px 20px rgba(0,0,0,0.08)' }}>
          <table style={{ borderCollapse:'collapse', width:'max-content', minWidth:'100%', fontSize:'12px' }}>
            <thead>
              <tr style={{ background:'#0f172a' }}>
                <th style={{ padding:'14px 16px', color:'#f8fafc', fontWeight:700, fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'left', position:'sticky', left:0, background:'#0f172a', zIndex:4, borderRight:'2px solid #1e293b', whiteSpace:'nowrap', minWidth:'230px' }}>Member</th>
                {columns.map(col => (
                  <th key={col.key} style={{ padding:0, verticalAlign:'middle', borderRight:'1px solid #1e293b', minWidth:'130px' }}>
                    <div style={{ margin:'7px 5px', padding:'6px 8px', background:col.bg, borderRadius:'8px', border:`1.5px solid ${col.accent}`, textAlign:'center' }}>
                      <div style={{ fontSize:'9px', fontWeight:800, color:col.accent, textTransform:'uppercase', letterSpacing:'0.04em' }}>{NEGATIVE_COLS.has(col.key) ? `(−) ${col.short}` : col.short}</div>
                      <div style={{ fontSize:'8px', color:col.color, marginTop:'2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{col.label}</div>
                    </div>
                  </th>
                ))}
                <th style={{ padding:0, verticalAlign:'middle', borderLeft:'2px solid #334155', minWidth:'140px' }}>
                  <div style={{ margin:'7px 5px', padding:'6px 6px', background:'rgba(0,0,0,0)', borderRadius:'8px', border:'1.5px solid rgba(0,0,0,0.5)', textAlign:'center' }}>
                    <div style={{ fontSize:'9px', fontWeight:800, color:'#ffffff', textTransform:'uppercase', letterSpacing:'0.06em' }}>TOTAL</div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const isEven   = idx % 2 === 0;
                const rowBg    = isEven ? '#ffffff' : '#f8fafc';
                const rowTotal = calcRowTotal(row);
                return (
                  <tr key={row.id} style={{ background:rowBg, borderBottom:'1px solid #e2e8f0' }}>
                    <td style={{ padding:'10px 14px', position:'sticky', left:0, background:rowBg, zIndex:1, borderRight:'2px solid #e2e8f0', whiteSpace:'nowrap' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <div style={{ width:'30px', height:'30px', borderRadius:'50%', flexShrink:0, background:`hsl(${(idx*47)%360},55%,88%)`, color:`hsl(${(idx*47)%360},55%,30%)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:800 }}>{row.name.charAt(0).toUpperCase()}</div>
                        <div>
                          <div style={{ fontWeight:700, color:'#0f172a', fontSize:'13px' }}>{row.name}</div>
                          <div style={{ display:'flex', gap:'6px', alignItems:'center', marginTop:'2px' }}>
                            <span style={{ fontFamily:'monospace', fontWeight:700, background:'#f0f4ff', color:'#1a3a8f', padding:'1px 6px', borderRadius:'5px', fontSize:'11px', letterSpacing:'0.04em', border:'1px solid #c7d4f7' }}>{row.memberId}</span>
                            {row.phone && <span style={{ fontSize:'11px', color:'#94a3b8' }}>{row.phone}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    {columns.map(col => {
                      const raw   = row[col.key] || 0;
                      const isNeg = NEGATIVE_COLS.has(col.key);
                      return (
                        <td key={col.key} style={{ padding:'10px', textAlign:'right', borderRight:'1px solid #e2e8f0' }}>
                          {raw > 0 ? (
                            <span style={{ display:'inline-block', padding:'3px 9px', borderRadius:'6px', background: isNeg ? '#fef2f2' : col.bg, color: isNeg ? '#dc2626' : col.accent, fontWeight:700, fontSize:'12px', whiteSpace:'nowrap', border:`1px solid ${isNeg ? '#fecaca' : col.accent + '30'}` }}>
                              {isNeg ? `−${formatCurrency(raw)}` : formatCurrency(raw)}
                            </span>
                          ) : (
                            <span style={{ color:'#d1d5db', fontSize:'14px' }}>—</span>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ padding:'10px 12px', textAlign:'right', borderLeft:'2px solid #e2e8f0', fontWeight:800, fontSize:'13px', whiteSpace:'nowrap', color: rowTotal > 0 ? '#15803d' : rowTotal < 0 ? '#dc2626' : '#d1d5db', background: rowTotal > 0 ? (isEven ? '#f0fdf4' : '#dcfce7') : rowTotal < 0 ? '#fef2f2' : rowBg }}>
                      {rowTotal !== 0 ? (rowTotal < 0 ? `−${formatCurrency(-rowTotal)}` : formatCurrency(rowTotal)) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background:'#0f172a' }}>
                <td style={{ padding:'13px 14px', color:'#f8fafc', fontWeight:700, fontSize:'11px', letterSpacing:'0.06em', textTransform:'uppercase', position:'sticky', left:0, background:'#0f172a', zIndex:2, borderRight:'2px solid #1e293b', whiteSpace:'nowrap' }}>TOTALS ({rows.length} members)</td>
                {columns.map(col => {
                  const raw   = totals[col.key] || 0;
                  const isNeg = NEGATIVE_COLS.has(col.key);
                  return (
                    <td key={col.key} style={{ padding:'12px 10px', textAlign:'right', borderRight:'1px solid #1e293b' }}>
                      {raw > 0 ? (
                        <span style={{ display:'inline-block', padding:'3px 9px', borderRadius:'6px', background: isNeg ? '#fef2f2' : col.bg, color: isNeg ? '#f87171' : col.accent, fontWeight:800, fontSize:'12px', whiteSpace:'nowrap' }}>
                          {isNeg ? `−${formatCurrency(raw)}` : formatCurrency(raw)}
                        </span>
                      ) : <span style={{ color:'#475569' }}>—</span>}
                    </td>
                  );
                })}
                <td style={{ padding:'12px 12px', textAlign:'right', borderLeft:'2px solid #334155', color: grandTotal >= 0 ? '#fbbf24' : '#f87171', fontWeight:800, fontSize:'14px', whiteSpace:'nowrap' }}>
                  {grandTotal < 0 ? `−${formatCurrency(-grandTotal)}` : formatCurrency(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  // ── Report type list ──────────────────────────────────────────
  const reportTypes = [
    { key:'savings-monthly',   icon:<Wallet size={16} />,       label:'Monthly Savings',      sub:'Contributions by month'          },
    { key:'yearly-savings',    icon:<CalendarDays size={16} />,  label:'Yearly Savings',       sub:'All members per month grid'      },
    { key:'loans-summary',     icon:<ClipboardList size={16} />, label:'Loans Summary',        sub:'All loans overview'              },
    { key:'members-summary',   icon:<Users size={16} />,         label:'Members Summary',      sub:'All members data'                },
    { key:'chamaa-monthly',    icon:<RefreshCw size={16} />,     label:'Chamaa Report',        sub:'All cycles · member status'      },
    { key:'chamaa-payments',   icon:<Users size={16} />,         label:'Chamaa Payments',      sub:'Member payments by month'        },
    { key:'yearly-chamaa',     icon:<Calendar size={16} />,      label:'Yearly Chamaa',        sub:'All cycles per month grid'       },
    { key:'financial-summary', icon:<BarChart2 size={16} />,     label:'Financial Summary',    sub:'Overall metrics'                 },
    { key:'summation-all',     icon:<ScrollText size={16} />,    label:'Summation of All',     sub:'Full member financial overview'  },
  ];

  const isYearly = activeReport === 'yearly-savings' || activeReport === 'yearly-chamaa' || activeReport === 'summation-all';
  const filtersChanged = pendingFilters.month !== appliedFilters.month || pendingFilters.year !== appliedFilters.year;

  return (
    <>
      <Navbar />
      <div className={`reports-container ${isYearly ? 'reports-container--wide' : ''}`}>
        <Link to="/admin/dashboard" className="back-link">← Dashboard</Link>
        <div className="page-header">
          <h1>Reports &amp; Analytics</h1>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>
            {sidebarOpen ? <><X size={14} style={{ marginRight:6 }} />Close</> : <><Menu size={14} style={{ marginRight:6 }} />Filters &amp; Reports</>}
          </button>
        </div>

        <div className={`reports-layout ${isYearly ? 'reports-layout--wide' : ''}`}>
          {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

          {/* Sidebar */}
          <aside className={`reports-sidebar ${sidebarOpen ? 'reports-sidebar--open' : ''}`}>
            <h3 className="sidebar-section-title">Report Types</h3>
            <div className="report-types">
              {reportTypes.map(({ key, icon, label, sub }) => (
                <button key={key} className={`report-type-btn ${activeReport === key ? 'active' : ''}`} onClick={() => generateReport(key)}>
                  <span className="icon">{icon}</span>
                  <div><strong>{label}</strong><small>{sub}</small></div>
                </button>
              ))}
            </div>

            <div className="report-filters">
              <h4 className="sidebar-section-title sidebar-section-title--sub">Filters</h4>
              <div className="filters-grid">
                <div className="form-group">
                  <label>Month</label>
                  <select value={pendingFilters.month} onChange={e => setPendingFilters(f => ({ ...f, month: Number(e.target.value) }))}>
                    {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{MONTH_FULL[i+1]}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Year</label>
                  <input type="number" value={pendingFilters.year} min="2000" max="2100" onChange={e => setPendingFilters(f => ({ ...f, year: Number(e.target.value) }))} />
                </div>
              </div>
              <button
                className={`btn-apply-filters ${filtersChanged ? 'btn-apply-filters--changed' : ''}`}
                onClick={handleApplyFilters}
                disabled={!activeReport}
                title={!activeReport ? 'Select a report type first' : ''}
              >
                {filtersChanged
                  ? <><RefreshCw size={13} style={{ marginRight:5 }} />Apply Filters</>
                  : <><Check size={13} style={{ marginRight:5 }} />Applied</>}
              </button>
              {activeReport && (
                <p className="filter-hint">Showing: <strong>{MONTH_FULL[appliedFilters.month]} {appliedFilters.year}</strong></p>
              )}
            </div>
          </aside>

          {/* Main content */}
          <div className="reports-content">
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner" />
                <p>Generating report…</p>
              </div>
            ) : !reportData ? (
              <div className="empty-state">
                <span className="empty-icon"><BarChart2 size={48} strokeWidth={1.2} /></span>
                <h3>Select a report type</h3>
                <p>Choose a report from the sidebar to view analytics and data</p>
              </div>
            ) : (
              <>
                <div className="report-header">
                  <div>
                    <h2>{getReportTitle()}</h2>
                    <p className="report-subtitle">
                      {activeReport === 'summation-all'
                        ? `All time · Generated ${new Date().toLocaleDateString('en-KE')}`
                        : activeReport === 'yearly-savings' || activeReport === 'yearly-chamaa'
                          ? `Dec ${appliedFilters.year - 1} – Nov ${appliedFilters.year} · Generated ${new Date().toLocaleDateString('en-KE')}`
                          : `${MONTH_FULL[appliedFilters.month]} ${appliedFilters.year} · Generated ${new Date().toLocaleDateString('en-KE')}`
                      }
                    </p>
                  </div>
                  <div className="report-actions">
                    <button className="btn-secondary" onClick={downloadCSV}><Download size={14} style={{ marginRight:6 }} />CSV</button>
                    <button className="btn-primary" onClick={downloadPDF}><Printer size={14} style={{ marginRight:6 }} />Print / PDF</button>
                  </div>
                </div>

                <div id="report-content">

                  {/* CHAMAA PAYMENTS — NEW */}
                  {activeReport === 'chamaa-payments' && reportData.details && (
                    <ChamaaPaymentsTable
                      details={reportData.details}
                      summary={reportData.summary}
                      month={reportData.month}
                      year={reportData.year}
                    />
                  )}

                  {/* SUMMATION OF ALL */}
                  {activeReport === 'summation-all' && reportData.rows && (
                    <SummationTable rows={reportData.rows} totals={reportData.totals} />
                  )}

                  {/* YEARLY SAVINGS */}
                  {activeReport === 'yearly-savings' && reportData.rows && (
                    <div>
                      <div className="summary-cards">
                        <div className="summary-card summary-card--green"><div className="summary-card__label">Members</div><div className="summary-card__value">{reportData.rows.length}</div></div>
                        <div className="summary-card summary-card--blue"><div className="summary-card__label">Grand Total (Dec {reportData.year - 1} – Nov {reportData.year})</div><div className="summary-card__value summary-card__value--lg">{formatCurrency(reportData.grandTotal)}</div></div>
                      </div>
                      <YearlyTable rows={reportData.rows} colTotals={reportData.colTotals} grandTotal={reportData.grandTotal} year={reportData.year} fiscalMonths={reportData.fiscalMonths} />
                    </div>
                  )}

                  {/* YEARLY CHAMAA */}
                  {activeReport === 'yearly-chamaa' && reportData.cycles && (
                    <div>
                      {reportData.cycles.length === 0 ? <p className="no-data">No chamaa cycles found.</p> : reportData.cycles.map(cycle => (
                        <div key={cycle.cycleId} className="cycle-section">
                          <div className="chamaa-cycle-header">
                            <div className="chamaa-cycle-header__info">
                              <div className="chamaa-cycle-header__name">{cycle.cycleName}</div>
                              <div className="chamaa-cycle-header__meta">Contribution: <strong>{formatCurrency(cycle.contribution)}</strong>&nbsp;·&nbsp;{cycle.rows.length} member{cycle.rows.length !== 1 ? 's' : ''}</div>
                            </div>
                            <div className="chamaa-cycle-header__right">
                              <span className={`cycle-badge ${cycle.isActive ? 'cycle-badge--active' : 'cycle-badge--ended'}`}>{cycle.isActive ? 'Active' : 'Ended'}</span>
                              <span className="chamaa-collected__value">{formatCurrency(cycle.grandTotal)}</span>
                            </div>
                          </div>
                          {cycle.rows.length === 0 ? <p className="chamaa-empty">No participant data for this cycle.</p> : (
                            <YearlyTable rows={cycle.rows} colTotals={cycle.colTotals} grandTotal={cycle.grandTotal} year={reportData.year} fiscalMonths={reportData.fiscalMonths} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CHAMAA MONTHLY */}
                  {activeReport === 'chamaa-monthly' && reportData.cycles && (
                    <div>
                      <div className="summary-cards">
                        <div className="summary-card summary-card--green"><div className="summary-card__label">Total Cycles</div><div className="summary-card__value">{reportData.cycles.length}</div></div>
                        <div className="summary-card summary-card--blue"><div className="summary-card__label">Total Collected</div><div className="summary-card__value summary-card__value--lg">{formatCurrency(reportData.cycles.reduce((s, c) => s + c.totalCollected, 0))}</div></div>
                        <div className="summary-card summary-card--yellow"><div className="summary-card__label">Total Expected</div><div className="summary-card__value summary-card__value--lg">{formatCurrency(reportData.cycles.reduce((s, c) => s + c.expectedPerMonth, 0))}</div></div>
                        <div className="summary-card summary-card--red"><div className="summary-card__label">Outstanding</div><div className="summary-card__value summary-card__value--lg">{formatCurrency(reportData.cycles.reduce((s, c) => s + Math.max(0, c.expectedPerMonth - c.totalCollected), 0))}</div></div>
                      </div>
                      {reportData.cycles.length === 0 ? <p className="no-data">No chamaa cycles found.</p> : reportData.cycles.map(cycle => <ChamaaMonthlyTable key={cycle.cycleId} cycle={cycle} />)}
                    </div>
                  )}

                  {/* FINANCIAL SUMMARY */}
                  {activeReport === 'financial-summary' && (
                    <div className="financial-summary">
                      <div className="summary-grid">
                        {[['Total Members', reportData.totalMembers, false],['Total Savings', formatCurrency(reportData.totalSavings), false],['Active Loans', reportData.activeLoans, false],['Total Disbursed', formatCurrency(reportData.totalDisbursed), false],['Total Collected', formatCurrency(reportData.totalCollected), false],['Outstanding Balance', formatCurrency(reportData.outstandingBalance), false],['Defaulted Loans', reportData.defaultedLoans, true],['Savings This Month', reportData.savingsThisMonth, false]].map(([label, value, danger]) => (
                          <div key={label} className="summary-item"><strong>{label}</strong><span className={danger ? 'text-danger' : ''}>{value}</span></div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* MONTHLY SAVINGS */}
                  {activeReport === 'savings-monthly' && reportData.details && (
                    <div>
                      <div className="table-scroll-wrapper">
                        <table className="report-table">
                          <thead><tr><th>Member</th><th>Amount</th><th>Payment Date</th><th>Status</th><th>Fine</th></tr></thead>
                          <tbody>
                            {reportData.details.map((row, i) => (
                              <tr key={i}>
                                <td>{row.firstName} {row.lastName}</td>
                                <td>{formatCurrency(row.amount)}</td>
                                <td>{row.paymentDate ? new Date(row.paymentDate).toLocaleDateString() : '—'}</td>
                                <td><span className={`status-badge ${row.status === 'paid' ? 'status-badge--paid' : 'status-badge--unpaid'}`}>{row.status}</span></td>
                                <td>{row.fineAmount > 0 ? <span style={{ color:'#dc2626', fontWeight:700 }}>{formatCurrency(row.fineAmount)}</span> : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {reportData.summary && (
                        <div className="summary-grid" style={{ marginTop:'20px' }}>
                          <div className="summary-item"><strong>Total Participants</strong><span>{reportData.summary.totalParticipants}</span></div>
                          <div className="summary-item"><strong>Paid Members</strong><span>{reportData.summary.paidMembers}</span></div>
                          <div className="summary-item"><strong>Total Collected</strong><span>{formatCurrency(reportData.summary.totalPaid)}</span></div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* LOANS SUMMARY */}
                  {activeReport === 'loans-summary' && reportData.loans && (
                    <div className="table-scroll-wrapper">
                      <table className="report-table">
                        <thead><tr><th>Borrower</th><th>Amount</th><th>Interest</th><th>Duration</th><th>Disbursed</th><th>Due Date</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
                        <tbody>
                          {reportData.loans.map(loan => (
                            <tr key={loan.id}>
                              <td>{loan.member ? `${loan.member.firstName} ${loan.member.lastName}` : `#${loan.memberId}`}</td>
                              <td>{formatCurrency(loan.amount)}</td><td>{loan.interestRate}%</td><td>{loan.durationMonths} mo</td>
                              <td>{loan.disbursementDate ? new Date(loan.disbursementDate).toLocaleDateString() : '—'}</td>
                              <td>{loan.dueDate ? new Date(loan.dueDate).toLocaleDateString() : '—'}</td>
                              <td>{formatCurrency(loan.amountPaid)}</td><td>{formatCurrency(loan.remainingBalance)}</td>
                              <td><span className={`status-badge status-badge--${loan.status}`}>{loan.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* MEMBERS SUMMARY */}
                  {activeReport === 'members-summary' && reportData.members && (
                    <div className="table-scroll-wrapper">
                      <table className="report-table">
                        <thead><tr><th>Member ID</th><th>Name</th><th>Phone</th><th>Total Savings</th><th>Guarantees</th><th>Date Joined</th></tr></thead>
                        <tbody>
                          {reportData.members.map(m => (
                            <tr key={m.id}>
                              <td><span style={{ fontFamily:'monospace', fontWeight:700, background:'#f0f4ff', color:'#1a3a8f', padding:'2px 8px', borderRadius:'6px', fontSize:'12px', letterSpacing:'0.04em', border:'1px solid #c7d4f7' }}>{m.memberId}</span></td>
                              <td><div className="member-cell"><div className="member-avatar member-avatar--sm" style={{ background:`hsl(${(m.id*47)%360},55%,88%)`, color:`hsl(${(m.id*47)%360},55%,30%)` }}>{m.firstName.charAt(0).toUpperCase()}</div>{m.firstName} {m.lastName}</div></td>
                              <td>{m.phone}</td>
                              <td style={{ color:'#15803d', fontWeight:700 }}>{formatCurrency(m.total_savings)}</td>
                              <td>{m.active_guarantees || 0}</td>
                              <td>{new Date(m.dateJoined).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Reports;