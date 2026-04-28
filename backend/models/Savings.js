const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Savings = sequelize.define('Savings', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  memberId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    validate: {
      min: 0,
      isMultipleOf1000(value) {
        if (Number(value) % 1000 !== 0) {
          throw new Error('Savings amount must be in multiples of 1,000');
        }
      },
    },
  },
  month: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 12 },
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 2000 },
  },
  paymentDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  isPaid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isLate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  fineAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'savings',
  freezeTableName: true,
  timestamps: true,
  
});

module.exports = Savings;