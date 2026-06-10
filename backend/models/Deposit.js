// backend/models/Deposit.js
const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Deposit extends Model {}

Deposit.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  memberId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'members', key: 'id' },
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  mpesaCode: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  mpesa_message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  // ── Stage 1: Deposit Confirmation ───────────────────────────
  depositStatus: {
    type: DataTypes.ENUM('pending_confirmation', 'confirmed', 'distributed', 'rejected'),
    defaultValue: 'pending_confirmation',
  },
  availableBalance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  confirmedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
  confirmedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  confirmationNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  // ── Stage 2: Distribution Approval ──────────────────────────
  distributionStatus: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    allowNull: true,
  },
  distributionRequestedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  // ── Savings ──────────────────────────────────────────────────
  savingsAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  savingsMonth: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Month the member is saving FOR (1-12)',
  },
  savingsYear: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Year the member is saving FOR',
  },

  // ── Loan Payment ─────────────────────────────────────────────
  loanPaymentAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  loanId: {
    type: DataTypes.STRING(20),
    allowNull: true,
    references: { model: 'loans', key: 'id' },
  },

  // ── Chamaa Payment ────────────────────────────────────────────
  // Works exactly like savings — member specifies which month/year
  // they are paying chamaa for. Fixed amount KES 2030 per payment.
  // On approval the system checks the payment window and applies a
  // KES 500 fine + pushes to the next month if the payment is late,
  // mirroring the savings late-payment logic exactly.
  chamaaPaymentAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  chamaaMonth: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Month the member is paying chamaa FOR (1-12)',
  },
  chamaaYear: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Year the member is paying chamaa FOR',
  },

  // ── Other categories ──────────────────────────────────────────
  seedCapitalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  savingsFineAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  chamaaFineAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  agmFeeAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  othersAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  approvedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  sequelize,
  modelName: 'Deposit',
  tableName:  'deposits',
  timestamps: true,
});

module.exports = Deposit;