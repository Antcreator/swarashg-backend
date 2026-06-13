require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const bcrypt    = require('bcrypt');
const path      = require('path');
const sequelize = require('./config/database');
const models    = require('./models');

const authRoutes            = require('./routes/auth');
const memberRoutes          = require('./routes/members');
const savingsRoutes         = require('./routes/savings');
const loanRoutes            = require('./routes/loans');
const chamaaRoutes          = require('./routes/chamaa');
const notificationRoutes    = require('./routes/Notification');
const depositRoutes         = require('./routes/depositRoutes');
const guarantorRoutes       = require('./routes/guarantors');
const finesRoutes           = require('./routes/fines');
const seedCapitalRoutes     = require('./routes/seedCapital');
const statutoryRoutes       = require('./routes/statutory');
const agmFeeRoutes          = require('./routes/agmFees');
const investmentRoutes      = require('./routes/investments');
const registrationFeeRoutes = require('./routes/registrationFees');
const adminRoutes           = require('./routes/admins');
const withdrawalRoutes      = require('./routes/withdrawals');   // ← NEW

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ──────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── API Routes (must come BEFORE the static/catch-all) ─────────
app.get('/health', (_req, res) =>
  res.json({ status: 'OK', message: 'Swara SHG API is running' })
);

app.use('/api/auth',              authRoutes);
app.use('/api/members',           memberRoutes);
app.use('/api/savings',           savingsRoutes);
app.use('/api/loans',             loanRoutes);
app.use('/api/chamaa',            chamaaRoutes);
app.use('/api/notifications',     notificationRoutes);
app.use('/api/deposits',          depositRoutes);
app.use('/api/guarantors',        guarantorRoutes);
app.use('/api/fines',             finesRoutes);
app.use('/api/seed-capital',      seedCapitalRoutes);
app.use('/api/statutory',         statutoryRoutes);
app.use('/api/agm-fees',          agmFeeRoutes);
app.use('/api/investments',       investmentRoutes);
app.use('/api/registration-fees', registrationFeeRoutes);
app.use('/api/admins',            adminRoutes);
app.use('/api/withdrawals',       withdrawalRoutes);            // ← NEW

// ─── Serve React frontend (production) ──────────────────────────
const buildPath = path.join(__dirname, '..', 'frontend', 'build');

app.use(express.static(buildPath));

app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(buildPath, 'index.html'));
});


async function seedAdmin() {
  const { User } = models;

  const adminCount = await User.count({ where: { role: 'admin' } });
  if (adminCount > 0) return;

  const email     = process.env.ADMIN_EMAIL      || 'admin@swara.co.ke';
  const password  = process.env.ADMIN_PASSWORD   || 'ChangeMe@2025!';
  const firstName = process.env.ADMIN_FIRST_NAME || 'System';
  const lastName  = process.env.ADMIN_LAST_NAME  || 'Admin';

  const hashed = await bcrypt.hash(password, 10);
  await User.create({
    email,
    password:  hashed,
    firstName,
    lastName,
    role:      'admin',
    isActive:  true,
  });
}

// ─── Boot ───────────────────────────────────────────────────────
(async () => {
  try {
    await sequelize.sync({ force: false });

    await seedAdmin();

    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════╗
║   Swara SHG Management System API                ║
║   Server running on port ${PORT}                   ║
║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(28)}║
╚══════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('[BOOT] Failed to start server:', error);
    process.exit(1);
  }
})();