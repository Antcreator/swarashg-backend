const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ChamaaParticipant = sequelize.define('ChamaaParticipant', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  cycleId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  memberId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  position: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  // Month (1–12) when this slot is scheduled to receive the pot.
  // Multiple participants can share the same scheduledMonth (e.g. two members
  // both receive in March). NULL means not yet scheduled.
  scheduledMonth: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'scheduledmonth',
    validate: { min: 1, max: 12 },
  },
  // Year in which the slot receives the pot (e.g. 2025).
  scheduledYear: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'scheduledyear',
  },
  hasReceived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  receivedDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
}, {
  tableName: 'chamaa_participants',
  freezeTableName: true,
  timestamps: true,
  indexes: [
    { unique: true, fields: ['cycleId', 'position'] },
  ],
});

module.exports = ChamaaParticipant;