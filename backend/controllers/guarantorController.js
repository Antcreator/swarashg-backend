const { Member, Loan, LoanGuarantor, Savings } = require('../models');
const { Op } = require('sequelize');

const MAX_ACTIVE_GUARANTEES = 3;

// ─── Helper: mirrors loanController logic ────────────────────────
// Loans < 80,000 require 3 guarantors; loans >= 80,000 require 5.
// Liability per guarantor is the full loan amount divided by the
// number of required guarantors — NOT always divided by 2.
const getRequiredGuarantors = (amount) => Number(amount) < 80000 ? 3 : 5;

const getLiabilityPerGuarantor = (loanAmount) => {
  const required = getRequiredGuarantors(loanAmount);
  return Number(loanAmount) / required;
};

// ─── GET eligible guarantors ─────────────────────────────────────
const getEligibleGuarantors = async (req, res) => {
  const { loanAmount, excludeMemberId } = req.query;

  // FIX: split liability across the correct number of guarantors
  // (3 for loans < 80k, 5 for loans >= 80k) instead of always dividing by 2.
  const liabilityPerGuarantor = getLiabilityPerGuarantor(loanAmount);

  try {
    const members = await Member.findAll({
      where: excludeMemberId ? { id: { [Op.ne]: excludeMemberId } } : {},
      attributes: ['id', 'firstName', 'lastName'],
      include: [{ model: Savings, as: 'savings', attributes: ['amount'], required: false }],
    });

    const guarantorData = await Promise.all(
      members.map(async (member) => {
        const totalSavings = member.savings?.reduce(
          (sum, s) => sum + Number(s.amount || 0), 0
        ) || 0;

        // Count pending + accepted guarantees across active/arrears/pending loans
        const activeGuaranteeCount = await LoanGuarantor.count({
          where: {
            guarantorId: member.id,
            approvalStatus: { [Op.in]: ['pending', 'accepted'] },
          },
          include: [{
            model: Loan, as: 'loan',
            where: { status: { [Op.in]: ['active', 'arrears', 'pending'] } },
            required: true,
          }],
        });

        // Calculate current liabilities from accepted guarantees only
        let activeGuarantees = [];
        try {
          activeGuarantees = await LoanGuarantor.findAll({
            where: {
              guarantorId: member.id,
              approvalStatus: 'accepted',
            },
            include: [{
              model: Loan, as: 'loan',
              where: { status: { [Op.in]: ['active', 'arrears'] } },
              attributes: ['amount', 'remainingBalance'],
              required: true,
            }],
          });
        } catch (err) {
          // No active guarantees for this member
        }

        // FIX: use the correct per-guarantor liability share for each
        // guaranteed loan based on its own amount, not a flat /2.
        const currentLiabilities = activeGuarantees.reduce((sum, g) => {
          const guaranteedLoanAmount = Number(g.loan?.amount || 0);
          const share = getLiabilityPerGuarantor(guaranteedLoanAmount);
          return sum + share;
        }, 0);

        const availableSavings      = totalSavings - currentLiabilities;
        const hasSufficientSavings  = availableSavings >= liabilityPerGuarantor;
        const hasGuaranteeCapacity  = activeGuaranteeCount < MAX_ACTIVE_GUARANTEES;
        const isEligible            = hasSufficientSavings && hasGuaranteeCapacity;
        const shortfall             = Math.max(0, liabilityPerGuarantor - availableSavings);

        return {
          id:                      member.id,
          firstName:               member.firstName,
          lastName:                member.lastName,
          totalSavings,
          currentLiabilities,
          availableSavings,
          activeGuaranteeCount,
          maxGuarantees:           MAX_ACTIVE_GUARANTEES,
          remainingGuaranteeSlots: Math.max(0, MAX_ACTIVE_GUARANTEES - activeGuaranteeCount),
          isEligible,
          shortfall,
          requiredLiability:       liabilityPerGuarantor,
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
      guarantors:          sortedGuarantors,
      liabilityPerGuarantor,
      requiredGuarantors:  getRequiredGuarantors(loanAmount),
      maxActiveGuarantees: MAX_ACTIVE_GUARANTEES,
      eligibleCount:       sortedGuarantors.filter(g => g.isEligible).length,
      ineligibleCount:     sortedGuarantors.filter(g => !g.isEligible).length,
    });
  } catch (error) {
    console.error('Get eligible guarantors error:', error);
    return res.status(500).json({ message: 'Failed to fetch eligible guarantors' });
  }
};

// ─── CHECK specific guarantor eligibility ────────────────────────
const checkGuarantorEligibility = async (req, res) => {
  const { guarantorId } = req.params;
  const { loanAmount }  = req.query;

  // FIX: split liability across the correct number of guarantors
  // (3 for loans < 80k, 5 for loans >= 80k) instead of always dividing by 2.
  const liabilityPerGuarantor = getLiabilityPerGuarantor(loanAmount);

  try {
    const member = await Member.findByPk(guarantorId, {
      attributes: ['id', 'firstName', 'lastName'],
      include: [{ model: Savings, as: 'savings', attributes: ['amount'], required: false }],
    });
    if (!member) return res.status(404).json({ message: 'Member not found' });

    const totalSavings = member.savings?.reduce(
      (sum, s) => sum + Number(s.amount || 0), 0
    ) || 0;

    // Count pending + accepted guarantees
    const activeGuaranteeCount = await LoanGuarantor.count({
      where: {
        guarantorId,
        approvalStatus: { [Op.in]: ['pending', 'accepted'] },
      },
      include: [{
        model: Loan, as: 'loan',
        where: { status: { [Op.in]: ['active', 'arrears', 'pending'] } },
        required: true,
      }],
    });

    let activeGuarantees = [];
    try {
      activeGuarantees = await LoanGuarantor.findAll({
        where: { guarantorId, approvalStatus: 'accepted' },
        include: [{
          model: Loan, as: 'loan',
          where: { status: { [Op.in]: ['active', 'arrears'] } },
          attributes: ['id', 'amount', 'remainingBalance'],
          required: true,
        }],
      });
    } catch (err) {
      // No active guarantees for this guarantor
    }

    // FIX: use the correct per-guarantor liability share for each
    // guaranteed loan based on its own amount, not a flat /2.
    const currentLiabilities = activeGuarantees.reduce((sum, g) => {
      const guaranteedLoanAmount = Number(g.loan?.amount || 0);
      const share = getLiabilityPerGuarantor(guaranteedLoanAmount);
      return sum + share;
    }, 0);

    const availableSavings      = totalSavings - currentLiabilities;
    const hasSufficientSavings  = availableSavings >= liabilityPerGuarantor;
    const hasGuaranteeCapacity  = activeGuaranteeCount < MAX_ACTIVE_GUARANTEES;
    const isEligible            = hasSufficientSavings && hasGuaranteeCapacity;
    const shortfall             = Math.max(0, liabilityPerGuarantor - availableSavings);

    return res.json({
      guarantor: {
        id:                      member.id,
        firstName:               member.firstName,
        lastName:                member.lastName,
        totalSavings,
        currentLiabilities,
        availableSavings,
        activeGuaranteeCount,
        maxGuarantees:           MAX_ACTIVE_GUARANTEES,
        remainingGuaranteeSlots: Math.max(0, MAX_ACTIVE_GUARANTEES - activeGuaranteeCount),
        isEligible,
        shortfall,
        requiredLiability:       liabilityPerGuarantor,
        ineligibilityReason:     !isEligible
          ? (!hasSufficientSavings
              ? `Insufficient savings (shortfall: KES ${Math.round(shortfall).toLocaleString()})`
              : `Max guarantees reached (${activeGuaranteeCount}/${MAX_ACTIVE_GUARANTEES})`)
          : null,
      },
      activeGuarantees: activeGuarantees.map(g => ({
        loanId:           g.loan.id,
        loanAmount:       g.loan.amount,
        remainingBalance: g.loan.remainingBalance,
        yourLiability:    getLiabilityPerGuarantor(g.loan.amount),
      })),
      requiredGuarantors: getRequiredGuarantors(loanAmount),
    });
  } catch (error) {
    console.error('Check guarantor eligibility error:', error);
    return res.status(500).json({ message: 'Failed to check eligibility' });
  }
};

module.exports = { getEligibleGuarantors, checkGuarantorEligibility, MAX_ACTIVE_GUARANTEES };