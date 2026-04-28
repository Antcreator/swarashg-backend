const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const GuarantorPayment = sequelize.define('GuarantorPayment', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    loanId: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: {
        model: 'loans',
        key: 'id'
      }
    },
    guarantorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'members',
        key: 'id'
      }
    },
    liabilityAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    amountPaid: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    paymentDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'pending',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    }
  }, {
    tableName: 'guarantor_payments',
    freezeTableName: true,
    timestamps: true,
  });

  GuarantorPayment.associate = (models) => {
    GuarantorPayment.belongsTo(models.Loan, {
      foreignKey: 'loanId',
      as: 'loan'
    });
    GuarantorPayment.belongsTo(models.Member, {
      foreignKey: 'guarantorId',
      as: 'guarantor'
    });
  };

  return GuarantorPayment;
};