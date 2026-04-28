// backend/models/SeedCapital.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SeedCapital = sequelize.define('SeedCapital', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  memberId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'members',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  depositId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'deposits',
      key: 'id'
    }
  },
  paymentDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'seed_capital',
  timestamps: true
});

module.exports = SeedCapital;