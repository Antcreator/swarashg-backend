require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  dialectOptions: {
    ssl: {
      require:            true,
      rejectUnauthorized: false, // required for Railway
    },
  },
  pool: {
    max:     20,
    min:     0,
    acquire: 30000,
    idle:    10000,
  },
});

console.log('[DB] Using PostgreSQL via Railway DATABASE_URL');

module.exports = sequelize;