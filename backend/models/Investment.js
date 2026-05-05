const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Investment = sequelize.define('Investment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  year:  { type: DataTypes.INTEGER, allowNull: false },
  // month 0 = "Principal" (all-time) row; 1–12 = calendar months
  month: { type: DataTypes.INTEGER, allowNull: false },

  investment1Amount:  { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
  investment2Amount:  { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
  investment3Amount:  { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
  investment4Amount:  { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
  investment5Amount:  { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
  investment6Amount:  { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
  investment7Amount:  { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
  investment8Amount:  { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
  investment9Amount:  { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
  investment10Amount: { type: DataTypes.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },

  // Stores the display name of the person who last edited this row
  editedBy: { type: DataTypes.STRING(150), allowNull: true, defaultValue: null },
  // Keep recordedBy (FK to users) for audit purposes alongside the name
  recordedBy: { type: DataTypes.INTEGER, allowNull: true },
  editedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  notes:    { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'investments',
  freezeTableName: true,
  timestamps: true,
  indexes: [{ unique: true, fields: ['year', 'month'] }],
});

module.exports = Investment;