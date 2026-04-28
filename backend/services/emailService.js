const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST   || 'mail.yourdomain.co.ke',
  port:   Number(process.env.EMAIL_PORT) || 465,
  secure: process.env.EMAIL_SECURE === 'true', // true for port 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: { rejectUnauthorized: false },
});

// Test connection on startup
// transporter.verify((err) => {
//   if (err) console.error('[EMAIL] Connection failed:', err.message);
//   else     console.log('[EMAIL] Truehost SMTP ready →', process.env.EMAIL_USER);
// });

const sendEmail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Swara SHG'}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    // console.log(`[EMAIL] Sent → ${to} | ${subject}`);
  } catch (err) {
    // Never throw — email failure must NOT break the main API response
    console.error(`[EMAIL] Failed → ${to}:`, err.message);
  }
};

module.exports = { sendEmail };