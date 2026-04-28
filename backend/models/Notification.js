const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
  },
  memberId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'member_id',
  },
  type: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  // ── Changed from INTEGER to STRING(36) to support UUID loan ids ──
  relatedLoanId: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'related_loan_id',
  },
  relatedGuarantorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'related_guarantor_id',
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_read',
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'read_at',
  },
}, {
  tableName: 'notifications',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = Notification;