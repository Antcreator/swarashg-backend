const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('admin', 'member', 'staff'),
    allowNull: false,
    defaultValue: 'member',
  },
  firstName: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  lastName: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  mustChangePassword: {  
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  tableName: 'users',
  freezeTableName: true,
  timestamps: true,
});

module.exports = User;