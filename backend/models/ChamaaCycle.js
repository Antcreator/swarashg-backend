const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ChamaaCycle = sequelize.define('ChamaaCycle', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  contributionAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'chamaa_cycles',
  freezeTableName: true,
  timestamps: true,
});

module.exports = ChamaaCycle;