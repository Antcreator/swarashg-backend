const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InvestmentColumnName = sequelize.define('InvestmentColumnName', {
  id:   { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  year: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  col1:  { type: DataTypes.STRING(100), allowNull: true, defaultValue: '' },
  col2:  { type: DataTypes.STRING(100), allowNull: true, defaultValue: '' },
  col3:  { type: DataTypes.STRING(100), allowNull: true, defaultValue: '' },
  col4:  { type: DataTypes.STRING(100), allowNull: true, defaultValue: '' },
  col5:  { type: DataTypes.STRING(100), allowNull: true, defaultValue: '' },
  col6:  { type: DataTypes.STRING(100), allowNull: true, defaultValue: '' },
  col7:  { type: DataTypes.STRING(100), allowNull: true, defaultValue: '' },
  col8:  { type: DataTypes.STRING(100), allowNull: true, defaultValue: '' },
  col9:  { type: DataTypes.STRING(100), allowNull: true, defaultValue: '' },
  col10: { type: DataTypes.STRING(100), allowNull: true, defaultValue: '' },
}, {
  tableName: 'investment_column_names',
  freezeTableName: true,
  timestamps: true,
});

module.exports = InvestmentColumnName;