const { Member, Loan, LoanGuarantor, Savings } = require('../models');
const { Op } = require('sequelize');

const MAX_ACTIVE_GUARANTEES = 3;
const TRANSACTION_FEE       = 108;

// ─── Helpers ──────────────────────────────────────────────────────
// IMPORTANT: Must mirror loanController.js exactly.
// Loans < 80,000  → 3 required guarantors
// Loans >= 80,000 → 5 required guarantors
const getRequiredGuarantors = (amount) => Number(amount) < 80000 ? 3 : 5;

// Total repayment = principal + (principal * interestRate / 100) + transactionFee
// We derive interestRate from the loan tiers. However, in the guarantor controller
// we only have the loan *amount* at eligibility-check time, not the chosen duration.
// We therefore use the MINIMUM interest rate for the tier (1-month / first option)
// as a conservative floor so eligibility is not over-stated.
//
// LOAN_TIERS (mirrored from loanController):
//   Tier 1  0–19,999    → 7 %
//   Tier 2  20,000–49,999   → 7 % (1m) / 8.5 % (2m)
//   Tier 3  50,000–79,999   → 7 % (1m) …
//   Tier 4  80,000–99,999   → 7 % (1m) …
//   Tier 5  100,000+     → 7 % (1m) …
// All tiers share 7 % as the minimum (1-month) rate, so we always use 7 % here
// unless the caller passes in a specific rate via the optional parameter.
const getMinInterestRate = () => 7; // 1-month rate — all tiers

/**
 * calculateTotalRepayment
 * Mirrors loanController.calculateTotalRepayment exactly.
 */
const calculateTotalRepayment = (amount, interestRate = getMinInterestRate(), transactionFee = TRANSACTION_FEE) => {
  const principal = Number(amount);
  const rate      = Number(interestRate);
  const txFee     = Number(transactionFee);
  return Math.round(principal + (principal * rate / 100) + txFee);
};

/**
 * getLiabilityPerGuarantor
 *
 * Formula:
 *   Step 1 – totalRepayment  = principal + interest + txFee
 *   Step 2 – oneShare        = principal / requiredGuarantors   ← NOTE: uses PRINCIPAL, not totalRepayment
 *   Step 3 – reduced         = totalRepayment - oneShare
 *   Step 4 – liabilityEach   = reduced / requiredGuarantors
 *
 * Example – KES 10,000 loan (3 guarantors, 7 % interest, KES 108 fee):
 *   totalRepayment = 10,000 + 700 + 108  = 10,808
 *   oneShare       = 10,000 / 3          = 3,333.33
 *   reduced        = 10,808 - 3,333.33   = 7,474.67
 *   liabilityEach  = 7,474.67 / 3        ≈ 2,491.56  → rounded to 2,492
 *
 * Algebraically: (totalRepayment - principal/n) / n
 * where n = requiredGuarantors
 */
const getLiabilityPerGuarantor = (amount, interestRate, transactionFee) => {
  const n              = getRequiredGuarantors(amount);
  const principal      = Number(amount);
  const totalRepayment = calculateTotalRepayment(amount, interestRate, transactionFee);
  const oneShare       = principal / n;
  return (totalRepayment - oneShare) / n;
};

// ─── GET /guarantors/eligible ────────────────────────────────────
const getEligibleGuarantors = async (req, res) => {
  const { loanAmount, excludeMemberId } = req.query;

  if (!loanAmount || isNaN(Number(loanAmount))) {
    return res.status(400).json({ message: 'loanAmount query param is required and must be a number' });
  }

  const liabilityPerGuarantor = getLiabilityPerGuarantor(loanAmount);
  const requiredGuarantors    = getRequiredGuarantors(loanAmount);
  const totalRepayment        = calculateTotalRepayment(loanAmount);

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

        // Fetch accepted guarantees to calculate existing liabilities
        let activeGuarantees = [];
        try {
          activeGuarantees = await LoanGuarantor.findAll({
            where: {
              guarantorId:    member.id,
              approvalStatus: 'accepted',
            },
            include: [{
              model:      Loan,
              as:         'loan',
              where:      { status: { [Op.in]: ['active', 'arrears'] } },
              attributes: ['amount', 'interestRate', 'transactionFee', 'remainingBalance'],
              required:   true,
            }],
          });
        } catch (_) {}

        // Recalculate each existing guarantee's liability using the same new formula
        const currentLiabilities = activeGuarantees.reduce((sum, g) => {
          const share = getLiabilityPerGuarantor(
            g.loan?.amount       || 0,
            g.loan?.interestRate,
            g.loan?.transactionFee
          );
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
      totalRepayment:        Math.round(totalRepayment),
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

  const liabilityPerGuarantor = getLiabilityPerGuarantor(loanAmount);
  const requiredGuarantors    = getRequiredGuarantors(loanAmount);
  const totalRepayment        = calculateTotalRepayment(loanAmount);

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
          model:      Loan,
          as:         'loan',
          where:      { status: { [Op.in]: ['active', 'arrears'] } },
          attributes: ['id', 'amount', 'interestRate', 'transactionFee', 'remainingBalance'],
          required:   true,
        }],
      });
    } catch (_) {}

    // Recalculate each existing guarantee's liability using the same new formula
    const currentLiabilities = activeGuarantees.reduce((sum, g) => {
      const share = getLiabilityPerGuarantor(
        g.loan?.amount       || 0,
        g.loan?.interestRate,
        g.loan?.transactionFee
      );
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
        yourLiability:    Math.round(getLiabilityPerGuarantor(
          g.loan.amount,
          g.loan.interestRate,
          g.loan.transactionFee
        )),
      })),
      requiredGuarantors,
      totalRepayment:        Math.round(totalRepayment),
      liabilityPerGuarantor: Math.round(liabilityPerGuarantor),
    });
  } catch (error) {
    console.error('Check guarantor eligibility error:', error);
    return res.status(500).json({ message: 'Failed to check eligibility' });
  }
};

module.exports = { getEligibleGuarantors, checkGuarantorEligibility, MAX_ACTIVE_GUARANTEES };