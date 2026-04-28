require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const bcrypt    = require('bcrypt');
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
const adminRoutes           = require('./routes/admins');   // ← NEW

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ──────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Routes ─────────────────────────────────────────────────────
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
app.use('/api/admins',            adminRoutes);             // ← NEW

// ─── 404 ────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ message: 'Route not found' }));


async function seedAdmin() {
  const { User } = models;

  // Count existing admins — skip seed if any exist
  const adminCount = await User.count({ where: { role: 'admin' } });
  if (adminCount > 0) {
    // console.log(`[SEED] ${adminCount} admin(s) already exist — skipping seed`);
    return;
  }

  const email     = process.env.ADMIN_EMAIL     || 'admin@swara.co.ke';
  const password  = process.env.ADMIN_PASSWORD  || 'ChangeMe@2025!';
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

  // console.log(`[SEED] ✅ First admin created:`);
  // console.log(`       Email:    ${email}`);
  // console.log(`       Password: ${process.env.ADMIN_PASSWORD ? '(from .env)' : password + '  ← CHANGE THIS!'}`);
}

// ─── Boot ───────────────────────────────────────────────────────
(async () => {
  try {
    await sequelize.sync({ force: false });
    // console.log('[DB] All tables synced successfully');

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