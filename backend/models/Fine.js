const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Fine = sequelize.define('Fine', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  memberId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  fineType: {
    type: DataTypes.ENUM('savings_late', 'chamaa_late'),
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  month: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  isPaid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  paymentDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  referenceId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'fines',
  freezeTableName: true,
  timestamps: true,
});

module.exports = Fine;