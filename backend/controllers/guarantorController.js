const { Member, Loan, LoanGuarantor, Savings } = require('../models');
const { Op } = require('sequelize');

const MAX_ACTIVE_GUARANTEES = 3;

// ─── Helpers ──────────────────────────────────────────────────────
// IMPORTANT: Must mirror loanController.js exactly.
// Loans < 80,000  → 3 required guarantors
// Loans >= 80,000 → 5 required guarantors
// Liability per guarantor = loanAmount / requiredGuarantors  (NOT always /2)
const getRequiredGuarantors    = (amount) => Number(amount) < 80000 ? 3 : 5;
const getLiabilityPerGuarantor = (amount) => Number(amount) / getRequiredGuarantors(amount);

// ─── GET /guarantors/eligible ────────────────────────────────────
const getEligibleGuarantors = async (req, res) => {
  const { loanAmount, excludeMemberId } = req.query;

  if (!loanAmount || isNaN(Number(loanAmount))) {
    return res.status(400).json({ message: 'loanAmount query param is required and must be a number' });
  }

  // FIX: was always dividing by 2 regardless of how many guarantors are required.
  // A KES 10,000 loan needs 3 guarantors → liability = 10,000 / 3 ≈ 3,333 each.
  const liabilityPerGuarantor = getLiabilityPerGuarantor(loanAmount);
  const requiredGuarantors    = getRequiredGuarantors(loanAmount);

  try {
    const where = {};
    if (excludeMemberId) where.id = { [Op.ne]: Number(excludeMemberId) };

    const members = await Member.findAll({
      where,
      attributes: ['id', 'firstName', 'lastName', 'isActive'],
      include: [{ model: Savings, as: 'savings', where: { isPaid: true }, attributes: ['amount'], required: false }],
    });

    const guarantorData = await Promise.all(
      members.filter(m => m.isActive).map(async (member) => {
        const totalSavings = member.savings?.reduce(
          (sum, s) => sum + Number(s.amount || 0), 0
        ) || 0;

        // Count pending + accepted guarantees across active/arrears/pending loans
        const activeGuaranteeCount = await LoanGuarantor.count({
          where: {
            guarantorId:    member.id,
            approvalStatus: { [Op.in]: ['pending', 'accepted'] },
          },
          include: [{
            model:    Loan,
            as:       'loan',
            where:    { status: { [Op.in]: ['active', 'arrears', 'pending'] } },
            required: true,
          }],
        });

        // FIX: use each guaranteed loan's own amount to calculate the correct
        // liability share instead of always using remainingBalance / 2.
        let activeGuarantees = [];
        try {
          activeGuarantees = await LoanGuarantor.findAll({
            where: {
              guarantorId:    member.id,
              approvalStatus: 'accepted',
            },
            include: [{
              model:    Loan,
              as:       'loan',
              where:    { status: { [Op.in]: ['active', 'arrears'] } },
              attributes: ['amount', 'remainingBalance'],
              required: true,
            }],
          });
        } catch (_) {}

        const currentLiabilities = activeGuarantees.reduce((sum, g) => {
          const share = getLiabilityPerGuarantor(g.loan?.amount || 0);
          return sum + share;
        }, 0);

        const availableSavings     = totalSavings - currentLiabilities;
        const hasSufficientSavings = availableSavings >= liabilityPerGuarantor;
        const hasGuaranteeCapacity = activeGuaranteeCount < MAX_ACTIVE_GUARANTEES;
        const isEligible           = hasSufficientSavings && hasGuaranteeCapacity;
        const shortfall            = Math.max(0, liabilityPerGuarantor - availableSavings);

        return {
          id:                      member.id,
          firstName:               member.firstName,
          lastName:                member.lastName,
          totalSavings:            Math.round(totalSavings),
          currentLiabilities:      Math.round(currentLiabilities),
          availableSavings:        Math.round(availableSavings),
          activeGuaranteeCount,
          maxGuarantees:           MAX_ACTIVE_GUARANTEES,
          remainingGuaranteeSlots: Math.max(0, MAX_ACTIVE_GUARANTEES - activeGuaranteeCount),
          isEligible,
          shortfall:               Math.round(shortfall),
          requiredLiability:       Math.round(liabilityPerGuarantor),
          ineligibilityReason:     !isEligible
            ? (!hasSufficientSavings
                ? `Insufficient savings (shortfall: KES ${Math.round(shortfall).toLocaleString()})`
                : `Max guarantees reached (${activeGuaranteeCount}/${MAX_ACTIVE_GUARANTEES})`)
            : null,
        };
      })
    );

    const sortedGuarantors = guarantorData.sort((a, b) => {
      if (a.isEligible && !b.isEligible) return -1;
      if (!a.isEligible && b.isEligible) return 1;
      return b.availableSavings - a.availableSavings;
    });

    return res.json({
      guarantors:            sortedGuarantors,
      liabilityPerGuarantor: Math.round(liabilityPerGuarantor),
      requiredGuarantors,
      maxActiveGuarantees:   MAX_ACTIVE_GUARANTEES,
      eligibleCount:         sortedGuarantors.filter(g => g.isEligible).length,
      ineligibleCount:       sortedGuarantors.filter(g => !g.isEligible).length,
    });
  } catch (error) {
    console.error('Get eligible guarantors error:', error);
    return res.status(500).json({ message: 'Failed to fetch eligible guarantors' });
  }
};

// ─── GET /guarantors/:guarantorId/check-eligibility ──────────────
const checkGuarantorEligibility = async (req, res) => {
  const { guarantorId } = req.params;
  const { loanAmount }  = req.query;

  if (!loanAmount || isNaN(Number(loanAmount))) {
    return res.status(400).json({ message: 'loanAmount query param is required and must be a number' });
  }

  // FIX: same as above — was always dividing by 2.
  const liabilityPerGuarantor = getLiabilityPerGuarantor(loanAmount);
  const requiredGuarantors    = getRequiredGuarantors(loanAmount);

  try {
    const member = await Member.findByPk(guarantorId, {
      attributes: ['id', 'firstName', 'lastName', 'isActive'],
      include: [{ model: Savings, as: 'savings', where: { isPaid: true }, attributes: ['amount'], required: false }],
    });
    if (!member) return res.status(404).json({ message: 'Member not found' });

    const totalSavings = member.savings?.reduce(
      (sum, s) => sum + Number(s.amount || 0), 0
    ) || 0;

    // Count pending + accepted guarantees across active/arrears/pending loans
    const activeGuaranteeCount = await LoanGuarantor.count({
      where: {
        guarantorId:    Number(guarantorId),
        approvalStatus: { [Op.in]: ['pending', 'accepted'] },
      },
      include: [{
        model:    Loan,
        as:       'loan',
        where:    { status: { [Op.in]: ['active', 'arrears', 'pending'] } },
        required: true,
      }],
    });

    let activeGuarantees = [];
    try {
      activeGuarantees = await LoanGuarantor.findAll({
        where: { guarantorId: Number(guarantorId), approvalStatus: 'accepted' },
        include: [{
          model:    Loan,
          as:       'loan',
          where:    { status: { [Op.in]: ['active', 'arrears'] } },
          attributes: ['id', 'amount', 'remainingBalance'],
          required: true,
        }],
      });
    } catch (_) {}

    // FIX: correct per-loan liability share based on each loan's own amount.
    const currentLiabilities = activeGuarantees.reduce((sum, g) => {
      const share = getLiabilityPerGuarantor(g.loan?.amount || 0);
      return sum + share;
    }, 0);

    const availableSavings     = totalSavings - currentLiabilities;
    const hasSufficientSavings = availableSavings >= liabilityPerGuarantor;
    const hasGuaranteeCapacity = activeGuaranteeCount < MAX_ACTIVE_GUARANTEES;
    const isEligible           = hasSufficientSavings && hasGuaranteeCapacity;
    const shortfall            = Math.max(0, liabilityPerGuarantor - availableSavings);

    return res.json({
      guarantor: {
        id:                      member.id,
        firstName:               member.firstName,
        lastName:                member.lastName,
        totalSavings:            Math.round(totalSavings),
        currentLiabilities:      Math.round(currentLiabilities),
        availableSavings:        Math.round(availableSavings),
        activeGuaranteeCount,
        maxGuarantees:           MAX_ACTIVE_GUARANTEES,
        remainingGuaranteeSlots: Math.max(0, MAX_ACTIVE_GUARANTEES - activeGuaranteeCount),
        isEligible,
        shortfall:               Math.round(shortfall),
        requiredLiability:       Math.round(liabilityPerGuarantor),
        ineligibilityReason:     !isEligible
          ? (!hasSufficientSavings
              ? `Insufficient savings (shortfall: KES ${Math.round(shortfall).toLocaleString()})`
              : `Max guarantees reached (${activeGuaranteeCount}/${MAX_ACTIVE_GUARANTEES})`)
          : null,
      },
      activeGuarantees: activeGuarantees.map(g => ({
        loanId:           g.loan.id,
        loanAmount:       Number(g.loan.amount),
        remainingBalance: Number(g.loan.remainingBalance),
        yourLiability:    Math.round(getLiabilityPerGuarantor(g.loan.amount)),
      })),
      requiredGuarantors,
      liabilityPerGuarantor: Math.round(liabilityPerGuarantor),
    });
  } catch (error) {
    console.error('Check guarantor eligibility error:', error);
    return res.status(500).json({ message: 'Failed to check eligibility' });
  }
};

module.exports = { getEligibleGuarantors, checkGuarantorEligibility, MAX_ACTIVE_GUARANTEES };