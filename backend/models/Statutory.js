const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Statutory = sequelize.define('Statutory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  memberId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  cautionaryFee: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  statutoryFee: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  guarantorDeduction: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  other: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: new Date().getFullYear(),
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  submittedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  submittedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  editedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName: 'statutory',
  freezeTableName: true,
  timestamps: true,
});

module.exports = Statutory;