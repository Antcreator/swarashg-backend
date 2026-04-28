const { Member, Savings, Fine, sequelize } = require('../models');
const { Op } = require('sequelize');

// ─── GET /savings ───────────────────────────────────────────────
const getAllSavings = async (req, res) => {
  const { month, year } = req.query;
  let { memberId } = req.query;

  try {
    // Members can only see their own savings
    if (req.user.role === 'member') {
      memberId = req.user.member_id;
    }

    const where = {};
    if (month)    where.month    = month;
    if (year)     where.year     = year;
    if (memberId) where.memberId = memberId;

    const savings = await Savings.findAll({
      where,
      include: [{ model: Member, as: 'member', attributes: ['firstName', 'lastName'] }],
      order: [['year', 'DESC'], ['month', 'DESC'], ['paymentDate', 'DESC']],
    });

    return res.json({ savings });
  } catch (error) {
    console.error('Get all savings error:', error);
    return res.status(500).json({ message: 'Failed to fetch savings records' });
  }
};

// ─── GET /savings/stats ─────────────────────────────────────────
const getSavingsStats = async (req, res) => {
  const year      = req.query.year ? parseInt(req.query.year) : null;
  const yearWhere = year ? { year } : {};

  try {
    const totalSavings = await Savings.sum('amount', {
      where: { isPaid: true, ...yearWhere },
    }).catch(() => 0) || 0;

    return res.json({
      year:          year || 'all',
      totalSavings:  Number(totalSavings),
    });
  } catch (error) {
    console.error('Get savings stats error:', error);
    return res.status(500).json({ message: 'Failed to fetch savings statistics' });
  }
};

// ─── GET /savings/member/:memberId ──────────────────────────────
const getMemberSavings = async (req, res) => {
  try {
    const savings = await Savings.findAll({
      where: { memberId: req.params.memberId },
      order: [['year', 'DESC'], ['month', 'DESC'], ['paymentDate', 'DESC']],
    });

    return res.json({ savings });
  } catch (error) {
    console.error('Get member savings error:', error);
    return res.status(500).json({ message: 'Failed to fetch member savings' });
  }
};

// ─── POST /savings ──────────────────────────────────────────────
const recordSavings = async (req, res) => {
  const { memberId, amount, month, year, paymentDate, notes } = req.body;

  try {
    if (Number(amount) % 1000 !== 0) {
      return res.status(400).json({ message: 'Savings amount must be in multiples of 1,000' });
    }

    const member = await Member.findOne({ where: { id: memberId, isActive: true } });
    if (!member) {
      return res.status(404).json({ message: 'Member not found or inactive' });
    }

    const payDate  = paymentDate ? new Date(paymentDate) : new Date();
    const payDay   = payDate.getDate();
    const payMonth = payDate.getMonth() + 1;
    const payYear  = payDate.getFullYear();

    const targetMonth = Number(month);
    const targetYear  = Number(year);

    let windowStartMonth = targetMonth - 1;
    let windowStartYear  = targetYear;
    if (windowStartMonth === 0) {
      windowStartMonth = 12;
      windowStartYear  = targetYear - 1;
    }

    const windowStart = new Date(windowStartYear, windowStartMonth - 1, 11);
    const windowEnd   = new Date(targetYear, targetMonth - 1, 10);
    const payDateOnly = new Date(payYear, payMonth - 1, payDay);

    const isWithinWindow = (payDateOnly >= windowStart && payDateOnly <= windowEnd);
    const isLate         = !isWithinWindow;

    let finalMonth = targetMonth;
    let finalYear  = targetYear;
    let fineAmount = 0;

    if (isLate) {
      fineAmount = 500;
      finalMonth = targetMonth === 12 ? 1         : targetMonth + 1;
      finalYear  = targetMonth === 12 ? targetYear + 1 : targetYear;
    }

    if (isLate) {
      const existingForFinal = await Savings.findOne({
        where: { memberId, month: finalMonth, year: finalYear },
      });

      if (existingForFinal) {
        existingForFinal.amount = Number(existingForFinal.amount) + Number(amount);
        existingForFinal.notes  = [
          existingForFinal.notes,
          `Additional late deposit of KES ${amount} on ${payDate.toDateString()} for ${targetMonth}/${targetYear}. ${notes || ''}`,
        ].filter(Boolean).join(' | ');
        await existingForFinal.save();

        await Fine.create({
          memberId,
          fineType:    'savings_late',
          amount:      fineAmount,
          month:       finalMonth,
          year:        finalYear,
          referenceId: existingForFinal.id,
          notes:       `Late savings deposit for ${targetMonth}/${targetYear}, pushed to ${finalMonth}/${finalYear}`,
        });

        return res.status(200).json({
          message: `Late deposit added to existing record for ${finalMonth}/${finalYear} with KES 500 fine.`,
          savings: existingForFinal,
          warning: `Original month ${targetMonth}/${targetYear} → Recorded as ${finalMonth}/${finalYear}`,
        });
      }
    }

    const saving = await Savings.create({
      memberId,
      amount,
      month:       finalMonth,
      year:        finalYear,
      paymentDate: payDate,
      isPaid:      true,
      isLate,
      fineAmount,
      notes: isLate
        ? `Late payment for ${targetMonth}/${targetYear}, pushed to ${finalMonth}/${finalYear}. ${notes || ''}`.trim()
        : notes,
    });

    if (isLate) {
      await Fine.create({
        memberId,
        fineType:    'savings_late',
        amount:      fineAmount,
        month:       finalMonth,
        year:        finalYear,
        referenceId: saving.id,
        notes:       `Late savings payment for ${targetMonth}/${targetYear}, pushed to ${finalMonth}/${finalYear}`,
      });
    }

    return res.status(201).json({
      message: isLate
        ? `Savings recorded as LATE. Amount pushed to ${finalMonth}/${finalYear} with KES 500 fine.`
        : 'Savings recorded successfully',
      savings: saving,
      warning: isLate
        ? `Original month ${targetMonth}/${targetYear} → Recorded as ${finalMonth}/${finalYear}`
        : null,
    });
  } catch (error) {
    console.error('Record savings error:', error);
    return res.status(500).json({ message: 'Failed to record savings' });
  }
};

// ─── PUT /savings/:id ───────────────────────────────────────────
const updateSavings = async (req, res) => {
  const { amount, paymentDate, notes } = req.body;

  try {
    if (amount && Number(amount) % 1000 !== 0) {
      return res.status(400).json({ message: 'Savings amount must be in multiples of 1,000' });
    }

    const saving = await Savings.findByPk(req.params.id);
    if (!saving) {
      return res.status(404).json({ message: 'Savings record not found' });
    }

    if (amount)              saving.amount      = amount;
    if (paymentDate)         saving.paymentDate = paymentDate;
    if (notes !== undefined) saving.notes       = notes;
    await saving.save();

    return res.json({ message: 'Savings updated successfully', savings: saving });
  } catch (error) {
    console.error('Update savings error:', error);
    return res.status(500).json({ message: 'Failed to update savings' });
  }
};

// ─── DELETE /savings/:id ────────────────────────────────────────
const deleteSavings = async (req, res) => {
  try {
    const saving = await Savings.findByPk(req.params.id);
    if (!saving) {
      return res.status(404).json({ message: 'Savings record not found' });
    }

    await Fine.destroy({ where: { referenceId: saving.id, fineType: 'savings_late' } });
    await saving.destroy();

    return res.json({ message: 'Savings record deleted successfully' });
  } catch (error) {
    console.error('Delete savings error:', error);
    return res.status(500).json({ message: 'Failed to delete savings record' });
  }
};

// ─── GET /savings/report/:month/:year ───────────────────────────
const getMonthlySavingsReport = async (req, res) => {
  const { month, year } = req.params;

  try {
    const members = await Member.findAll({ where: { isActive: true } });

    const details = await Promise.all(
      members.map(async (m) => {
        const savings = await Savings.findAll({
          where: { memberId: m.id, month, year },
          order: [['paymentDate', 'ASC']],
        });

        const totalAmount = savings.reduce((sum, s) => sum + Number(s.amount), 0);
        const totalFines  = savings.reduce((sum, s) => sum + Number(s.fineAmount), 0);
        const hasLate = savings.some(s => s.isLate);
        const hasPaid = savings.length > 0;

        return {
          id:          m.id,
          firstName:   m.firstName,
          lastName:    m.lastName,
          amount:      totalAmount,
          isPaid:      hasPaid,
          isLate:      hasLate,
          fineAmount:  totalFines,
          paymentDate: hasPaid ? savings[0].paymentDate : null,
          status:      !hasPaid ? 'Not Paid' : hasLate ? 'Late' : 'On Time',
          savingsCount: savings.length,
        };
      })
    );

    const summary = {
      totalMembers:    details.length,
      paidMembers:     details.filter(d => d.isPaid).length,
      latePayments:    details.filter(d => d.isLate).length,
      totalPaid:       details.reduce((s, d) => s + Number(d.amount || 0), 0),
      totalExpected:   details.length * 1000,
      totalFines:      details.reduce((s, d) => s + Number(d.fineAmount || 0), 0),
      totalParticipants: details.filter(d => d.isPaid).length,
    };

    return res.json({ month, year, summary, details });
  } catch (error) {
    console.error('Monthly savings report error:', error);
    return res.status(500).json({ message: 'Failed to generate report' });
  }
};

module.exports = {
  getAllSavings,
  getSavingsStats,
  getMemberSavings,
  recordSavings,
  updateSavings,
  deleteSavings,
  getMonthlySavingsReport,
};