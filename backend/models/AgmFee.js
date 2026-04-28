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
 
  source: {
    type: DataTypes.ENUM('deposit', 'manual'),
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