const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LoanGuarantor = sequelize.define('LoanGuarantor', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  loanId: {
  type: DataTypes.STRING(20),
  allowNull: false,
  },
  guarantorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    
  },
  approvalStatus: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'admin_override'),
    defaultValue: 'pending',
    field: 'approval_status',
  },
  responseDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'response_date',
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'rejection_reason',
  },
}, {
  tableName: 'loan_guarantors',
  freezeTableName: true,
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['loanId', 'guarantorId'],
    },
  ],
});

module.exports = LoanGuarantor;