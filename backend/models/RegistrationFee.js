const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RegistrationFee = sequelize.define('RegistrationFee', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  memberId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true, 
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  paidAt: {
    type: DataTypes.DATE,
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
  tableName: 'registration_fees',
  freezeTableName: true,
  timestamps: true,
});

module.exports = RegistrationFee;