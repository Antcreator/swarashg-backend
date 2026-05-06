const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AgmFee = sequelize.define('AgmFee', {
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
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: new Date().getFullYear(),
  },
  // 'statutory_override' is a system-managed adjustment row written when an admin
  // manually sets a different agmFee total on the Statutory page. It should never
  // be directly created or deleted by the user.
  source: {
    type: DataTypes.ENUM('deposit', 'manual', 'statutory_override'),
    defaultValue: 'manual',
  },
  depositId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  recordedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'agm_fees',
  freezeTableName: true,
  timestamps: true,
});

module.exports = AgmFee;