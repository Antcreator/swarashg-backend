const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TRANSACTION_FEE = 108;

const Loan = sequelize.define('Loan', {
  id: {
    type: DataTypes.STRING(20),
    primaryKey: true,
  },
  memberId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    // No field override — DB column is "memberId"
  },
  amount: {
    type: DataTypes.DECIMAL(12, 0),
    allowNull: false,
    validate: { min: 1 },
  },
  interestRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 10.00,
    // No field override — DB column is "interestRate"
  },
  durationMonths: {
    type: DataTypes.INTEGER,
    allowNull: false,
    // No field override — DB column is "durationMonths"
  },
  disbursementDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    // No field override — DB column is "disbursementDate"
  },
  dueDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    // No field override — DB column is "dueDate"
  },
  status: {
    type: DataTypes.ENUM(
      'pending', 'approved', 'active', 'arrears',
      'default', 'paid', 'rejected', 'topped_up'
    ),
    defaultValue: 'pending',
  },
  approvalStatus: {
    type: DataTypes.STRING(50),
    defaultValue: 'pending',
    // No field override — DB column is "approvalStatus"
  },
  approvedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    // No field override — DB column is "approvedBy"
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    // No field override — DB column is "approvedAt"
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    // No field override — DB column is "rejectionReason"
  },
  amountPaid: {
    type: DataTypes.DECIMAL(12, 0),
    defaultValue: 0,
    // No field override — DB column is "amountPaid"
  },
  remainingBalance: {
    type: DataTypes.DECIMAL(12, 0),
    allowNull: false,
    // No field override — DB column is "remainingBalance"
  },
  isOverdue: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    // No field override — DB column is "isOverdue"
  },
  overdueSince: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    // No field override — DB column is "overdueSince"
  },
  penaltyInterest: {
    type: DataTypes.DECIMAL(10, 0),
    defaultValue: 0,
    // No field override — DB column is "penaltyInterest"
  },
  transactionFee: {
    type: DataTypes.DECIMAL(10, 0),
    defaultValue: TRANSACTION_FEE,
    allowNull: false,
    // No field override — DB column is "transactionFee"
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  // ── Arrears tracking ──────────────────────────────────────────
  arrearsStartDate: {
    type: DataTypes.DATE,
    allowNull: true,
    // No field override — DB column is "arrearsStartDate"
  },
  arrearsEndDate: {
    type: DataTypes.DATE,
    allowNull: true,
    // No field override — DB column is "arrearsEndDate"
  },
  arrearsMonths: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    // No field override — DB column is "arrearsMonths"
  },

  // ── Default tracking ──────────────────────────────────────────
  savingsDeducted: {
    type: DataTypes.DECIMAL(10, 0),
    defaultValue: 0,
    // No field override — DB column is "savingsDeducted"
  },
  defaultDate: {
    type: DataTypes.DATE,
    allowNull: true,
    // No field override — DB column is "defaultDate"
  },
  previousStatus: {
    type: DataTypes.STRING(50),
    allowNull: true,
    // No field override — DB column is "previousStatus" 
    // NOTE: check your DB — if this column doesn't exist yet, add it via migration
  },

  // ── Top-up fields ─────────────────────────────────────────────
  loanType: {
    type: DataTypes.ENUM('standard', 'top_up'),
    defaultValue: 'standard',
    allowNull: false,
    field: 'loan_type',           // DB column IS snake_case: "loan_type"
  },
  originalLoanId: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'original_loan_id',    // DB column IS snake_case: "original_loan_id"
  },
  toppedUpBy: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'topped_up_by',        // DB column IS snake_case: "topped_up_by"
  },
  previousBalance: {
    type: DataTypes.DECIMAL(12, 0),
    allowNull: true,
    field: 'previous_balance',    // DB column IS snake_case: "previous_balance"
  },
  amountDisbursed: {
    type: DataTypes.DECIMAL(12, 0),
    allowNull: true,
    field: 'amount_disbursed',    // DB column IS snake_case: "amount_disbursed"
  },
  topUpAmount: {
    type: DataTypes.DECIMAL(12, 0),
    allowNull: true,
    field: 'top_up_amount',       // DB column IS snake_case: "top_up_amount"
  },
  totalRepayment: {
    type: DataTypes.DECIMAL(12, 0),
    allowNull: true,
    // No field override — check your DB for this column name
  },
}, {
  tableName: 'loans',
  freezeTableName: true,
  timestamps: true,
  hooks: {
    beforeCreate: async (loan) => {
      const lastLoan = await loan.constructor.findOne({
        order: [['createdAt', 'DESC']],
        paranoid: false,
      });

      let nextNumber = 1;
      if (lastLoan && lastLoan.id) {
        const match = lastLoan.id.match(/^LN(\d+)$/);
        if (match) nextNumber = parseInt(match[1], 10) + 1;
      }

      loan.id = `LN${String(nextNumber).padStart(3, '0')}`;
    },
  },
});

Loan.TRANSACTION_FEE = TRANSACTION_FEE;

module.exports = Loan;