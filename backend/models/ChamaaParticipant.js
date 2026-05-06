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
    // ── REMOVED: { unique: true, fields: ['cycleId', 'memberId'] }
    // A member can now hold multiple positions in the same cycle
    // (e.g. Mary at positions 1, 5, and 7).
    { unique: true, fields: ['cycleId', 'position'] },
  ],
});

module.exports = ChamaaParticipant;