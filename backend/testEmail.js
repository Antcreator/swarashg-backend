require('dotenv').config();
const { sendEmail } = require('./services/emailService');

const testTo = process.argv[2] || process.env.EMAIL_USER;

if (!testTo) {
  console.error('Usage: node testEmail.js <recipient@email.com>');
  process.exit(1);
}

console.log('Testing Truehost SMTP...');
console.log('  HOST:', process.env.EMAIL_HOST);
console.log('  PORT:', process.env.EMAIL_PORT);
console.log('  USER:', process.env.EMAIL_USER);
console.log('  TO:  ', testTo);

sendEmail({
  to:      testTo,
  subject: '✅ Swara SHG — Email Test',
  html: `
    <div style="font-family:Arial,sans-serif;padding:24px;max-width:500px">
      <h2 style="color:#1a1a2e">✅ Email is working!</h2>
      <p>Truehost SMTP is configured correctly for <strong>Swara SHG</strong>.</p>
      <p style="color:#888;font-size:13px">Sent at: ${new Date().toLocaleString()}</p>
    </div>
  `,
}).then(() => {
  console.log('✅ Done — check your inbox');
  process.exit(0);
});