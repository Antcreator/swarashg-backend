const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LoanPayment = sequelize.define('LoanPayment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  loanId: {
  type: DataTypes.STRING(20),
  allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    validate: { min: 1 },
  },
  paymentDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  paymentMethod: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'loan_payments',
  freezeTableName: true,
  timestamps: true,
});

module.exports = LoanPayment;