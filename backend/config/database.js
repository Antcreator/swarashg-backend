require('dotenv').config();
const { Sequelize } = require('sequelize');
const path = require('path');

let sequelize;

const usePostgres =
  process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER;

if (usePostgres) {
  // ─── PostgreSQL (production / when env vars are set) ───────────
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD || '',          // password can be empty
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: 20,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    }
  );
  console.log('[DB] Using PostgreSQL');
} else {
  // ─── SQLite (zero-config local fallback) ───────────────────────
  const dbPath = path.resolve(__dirname, '..', 'swara_shg.sqlite');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
  });
  console.log('[DB] Using SQLite →', dbPath);
}

module.exports = sequelize;