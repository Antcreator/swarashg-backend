const { Member, Loan, LoanGuarantor, Savings } = require('../models');
const { Op } = require('sequelize');

const MAX_ACTIVE_GUARANTEES = 3;

// ─── GET eligible guarantors ─────────────────────────────────────
const getEligibleGuarantors = async (req, res) => {
  const { loanAmount, excludeMemberId } = req.query;
  const liabilityPerGuarantor = Number(loanAmount) / 2;

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

        // ✅ Count pending + accepted guarantees across active/arrears/pending loans
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
              attributes: ['remainingBalance'],
              required: true,
            }],
          });
        } catch (err) {
          // console.log(`No active guarantees for member ${member.id}`);
        }

        const currentLiabilities = activeGuarantees.reduce(
          (sum, g) => sum + (Number(g.loan?.remainingBalance) || 0) / 2, 0
        );

        const availableSavings      = totalSavings - currentLiabilities;
        const hasSufficientSavings  = availableSavings >= liabilityPerGuarantor;
        const hasGuaranteeCapacity  = activeGuaranteeCount < MAX_ACTIVE_GUARANTEES;
        const isEligible            = hasSufficientSavings && hasGuaranteeCapacity;
        const shortfall             = Math.max(0, liabilityPerGuarantor - availableSavings);

        return {
          id:                     member.id,
          firstName:              member.firstName,
          lastName:               member.lastName,
          totalSavings,
          currentLiabilities,
          availableSavings,
          activeGuaranteeCount,
          maxGuarantees:          MAX_ACTIVE_GUARANTEES,
          remainingGuaranteeSlots: Math.max(0, MAX_ACTIVE_GUARANTEES - activeGuaranteeCount),
          isEligible,
          shortfall,
          requiredLiability:      liabilityPerGuarantor,
          ineligibilityReason:    !isEligible
            ? (!hasSufficientSavings
                ? `Insufficient savings (shortfall: KES ${shortfall.toLocaleString()})`
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
      guarantors:         sortedGuarantors,
      liabilityPerGuarantor,
      maxActiveGuarantees: MAX_ACTIVE_GUARANTEES,
      eligibleCount:      sortedGuarantors.filter(g => g.isEligible).length,
      ineligibleCount:    sortedGuarantors.filter(g => !g.isEligible).length,
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
  const liabilityPerGuarantor = Number(loanAmount) / 2;

  try {
    const member = await Member.findByPk(guarantorId, {
      attributes: ['id', 'firstName', 'lastName'],
      include: [{ model: Savings, as: 'savings', attributes: ['amount'], required: false }],
    });
    if (!member) return res.status(404).json({ message: 'Member not found' });

    const totalSavings = member.savings?.reduce(
      (sum, s) => sum + Number(s.amount || 0), 0
    ) || 0;

    // ✅ Count pending + accepted guarantees
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
      // console.log(`No active guarantees for guarantor ${guarantorId}`);
    }

    const currentLiabilities   = activeGuarantees.reduce(
      (sum, g) => sum + (Number(g.loan?.remainingBalance) || 0) / 2, 0
    );
    const availableSavings      = totalSavings - currentLiabilities;
    const hasSufficientSavings  = availableSavings >= liabilityPerGuarantor;
    const hasGuaranteeCapacity  = activeGuaranteeCount < MAX_ACTIVE_GUARANTEES;
    const isEligible            = hasSufficientSavings && hasGuaranteeCapacity;
    const shortfall             = Math.max(0, liabilityPerGuarantor - availableSavings);

    return res.json({
      guarantor: {
        id:                     member.id,
        firstName:              member.firstName,
        lastName:               member.lastName,
        totalSavings,
        currentLiabilities,
        availableSavings,
        activeGuaranteeCount,
        maxGuarantees:          MAX_ACTIVE_GUARANTEES,
        remainingGuaranteeSlots: Math.max(0, MAX_ACTIVE_GUARANTEES - activeGuaranteeCount),
        isEligible,
        shortfall,
        requiredLiability:      liabilityPerGuarantor,
        ineligibilityReason:    !isEligible
          ? (!hasSufficientSavings
              ? `Insufficient savings (shortfall: KES ${shortfall.toLocaleString()})`
              : `Max guarantees reached (${activeGuaranteeCount}/${MAX_ACTIVE_GUARANTEES})`)
          : null,
      },
      activeGuarantees: activeGuarantees.map(g => ({
        loanId:          g.loan.id,
        loanAmount:      g.loan.amount,
        remainingBalance: g.loan.remainingBalance,
        yourLiability:   Number(g.loan.remainingBalance) / 2,
      })),
    });
  } catch (error) {
    console.error('Check guarantor eligibility error:', error);
    return res.status(500).json({ message: 'Failed to check eligibility' });
  }
};

module.exports = { getEligibleGuarantors, checkGuarantorEligibility, MAX_ACTIVE_GUARANTEES };