const fmt = (v) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(v || 0);

// ✅ Date only — Nairobi timezone
const fd = (d) => d
  ? new Date(d).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      timeZone: 'Africa/Nairobi',
    })
  : '—';

// ✅ Date + time — Nairobi timezone
const fdt = (d) => d
  ? new Date(d).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Africa/Nairobi',
    })
  : '—';

// ─────────────────────────────────────────────
//  DESIGN TOKENS
// ─────────────────────────────────────────────
const T = {
  // Core palette
  ink:       '#0f0f13',
  inkMid:    '#4a4a5a',
  inkLight:  '#9898aa',
  surface:   '#ffffff',
  canvas:    '#f5f4f0',
  border:    '#e8e7e2',

  // Brand
  brand:     '#1a1a2e',
  brandAccent:'#4f46e5',

  // Semantic
  green:     '#059669',
  greenBg:   '#ecfdf5',
  greenBorder:'#6ee7b7',

  blue:      '#1d4ed8',
  blueBg:    '#eff6ff',
  blueBorder:'#93c5fd',

  amber:     '#d97706',
  amberBg:   '#fffbeb',
  amberBorder:'#fcd34d',

  red:       '#dc2626',
  redBg:     '#fef2f2',
  redBorder: '#fca5a5',

  purple:    '#7c3aed',
  purpleBg:  '#f5f3ff',
  purpleBorder:'#c4b5fd',

  // Typography
  fontBase: `'Georgia', 'Times New Roman', serif`,
  fontMono: `'Courier New', Courier, monospace`,
};

// ─────────────────────────────────────────────
//  BASE LAYOUT
// ─────────────────────────────────────────────
const layout = (content, opts = {}) => {
  const { accentColor = T.brandAccent, badgeLabel = 'Member Notification' } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${T.canvas};-webkit-text-size-adjust:100%;font-family:${T.fontBase}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:${T.canvas};padding:40px 16px">
    <tr><td align="center">
      <!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
        style="max-width:600px;width:100%;background:${T.surface};border-radius:16px;
               overflow:hidden;box-shadow:0 4px 24px rgba(15,15,19,0.10),0 1px 4px rgba(15,15,19,0.06)">

        <!-- HEADER STRIPE -->
        <tr>
          <td style="height:5px;background:linear-gradient(90deg,${T.brand} 0%,${accentColor} 100%)"></td>
        </tr>

        <!-- HEADER -->
        <tr>
          <td style="background:${T.brand};padding:32px 40px 28px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <p style="margin:0;font-family:${T.fontBase};font-size:11px;font-weight:600;
                             letter-spacing:0.12em;text-transform:uppercase;color:${accentColor};
                             opacity:0.9">Swara Self Help Group</p>
                  <h1 style="margin:8px 0 0;font-family:${T.fontBase};font-size:26px;font-weight:700;
                              color:#ffffff;letter-spacing:-0.01em;line-height:1.2">
                    ${badgeLabel}
                  </h1>
                </td>
                <td align="right" style="vertical-align:top">
                  <div style="display:inline-block;background:rgba(255,255,255,0.08);
                               border:1px solid rgba(255,255,255,0.12);border-radius:50px;
                               padding:6px 14px;font-family:${T.fontBase};font-size:11px;
                               color:rgba(255,255,255,0.5);letter-spacing:0.04em">
                    ${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric', timeZone:'Africa/Nairobi' })}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:36px 40px 28px">
            ${content}
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:${T.canvas};border-top:1px solid ${T.border};padding:20px 40px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <p style="margin:0;font-family:${T.fontBase};font-size:11px;color:${T.inkLight};line-height:1.6">
                    This is an automated notification from Swara SHG. Please do not reply to this email.<br>
                    <span style="color:${T.border}">─────</span>
                    &nbsp;© ${new Date().getFullYear()} Swara Self Help Group &nbsp;
                    <span style="color:${T.border}">─────</span>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
};

// ─────────────────────────────────────────────
//  COMPONENTS
// ─────────────────────────────────────────────

/** Opening salutation */
const greeting = (name) =>
  `<p style="margin:0 0 20px;font-family:${T.fontBase};font-size:16px;color:${T.inkMid};line-height:1.6">
    Dear <strong style="color:${T.ink}">${name}</strong>,
  </p>`;

/** Body paragraph */
const para = (html, style = '') =>
  `<p style="margin:0 0 16px;font-family:${T.fontBase};font-size:15px;color:${T.inkMid};line-height:1.7;${style}">${html}</p>`;

/** Key-value data table */
const dataTable = (rows, opts = {}) => {
  const { accentColor = T.blue, bgColor = T.blueBg, borderColor = T.blueBorder } = opts;
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="border-radius:10px;overflow:hidden;border:1px solid ${borderColor};margin:20px 0">
    ${rows.map(([label, value], i) => `
    <tr style="background:${i % 2 === 0 ? bgColor : T.surface}">
      <td style="padding:11px 18px;font-family:${T.fontBase};font-size:12px;
                 font-weight:600;letter-spacing:0.04em;text-transform:uppercase;
                 color:${T.inkLight};width:42%;border-right:1px solid ${borderColor}">${label}</td>
      <td style="padding:11px 18px;font-family:${T.fontBase};font-size:14px;
                 font-weight:600;color:${T.ink}">${value}</td>
    </tr>`).join('')}
  </table>`;
};

/** Hero stat block */
const heroStat = (label, value, opts = {}) => {
  const { color = T.green, bg = T.greenBg, border = T.greenBorder } = opts;
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background:${bg};border:1px solid ${border};border-radius:12px;margin:20px 0">
    <tr>
      <td style="padding:24px 28px;text-align:center">
        <p style="margin:0;font-family:${T.fontBase};font-size:11px;font-weight:600;
                   letter-spacing:0.1em;text-transform:uppercase;color:${color};opacity:0.7">${label}</p>
        <p style="margin:10px 0 0;font-family:${T.fontBase};font-size:36px;font-weight:700;
                   color:${color};letter-spacing:-0.02em;line-height:1">${value}</p>
      </td>
    </tr>
  </table>`;
};

/** Two-column split stat */
const splitStat = (left, right) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0">
    <tr>
      <td width="48%" style="background:${T.greenBg};border:1px solid ${T.greenBorder};
                               border-radius:10px;padding:20px;text-align:center;vertical-align:top">
        <p style="margin:0;font-family:${T.fontBase};font-size:11px;font-weight:600;
                   letter-spacing:0.08em;text-transform:uppercase;color:${T.green};opacity:0.8">${left.label}</p>
        <p style="margin:10px 0 4px;font-family:${T.fontBase};font-size:26px;font-weight:700;
                   color:${T.green};letter-spacing:-0.02em">${left.value}</p>
        ${left.sub ? `<p style="margin:0;font-family:${T.fontBase};font-size:11px;color:${T.inkLight}">${left.sub}</p>` : ''}
      </td>
      <td width="4%"></td>
      <td width="48%" style="background:${T.blueBg};border:1px solid ${T.blueBorder};
                               border-radius:10px;padding:20px;text-align:center;vertical-align:top">
        <p style="margin:0;font-family:${T.fontBase};font-size:11px;font-weight:600;
                   letter-spacing:0.08em;text-transform:uppercase;color:${T.blue};opacity:0.8">${right.label}</p>
        <p style="margin:10px 0 4px;font-family:${T.fontBase};font-size:26px;font-weight:700;
                   color:${T.blue};letter-spacing:-0.02em">${right.value}</p>
        ${right.sub ? `<p style="margin:0;font-family:${T.fontBase};font-size:11px;color:${T.inkLight}">${right.sub}</p>` : ''}
      </td>
    </tr>
  </table>`;

/** Alert / notice block */
const alert = (title, body, opts = {}) => {
  const { color = T.amber, bg = T.amberBg, border = T.amberBorder, icon = '⚠️' } = opts;
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background:${bg};border:1px solid ${border};border-left:4px solid ${color};
           border-radius:10px;margin:20px 0">
    <tr>
      <td style="padding:16px 20px">
        <p style="margin:0 0 6px;font-family:${T.fontBase};font-size:13px;font-weight:700;
                   color:${color}">${icon}&nbsp;&nbsp;${title}</p>
        <p style="margin:0;font-family:${T.fontBase};font-size:13px;color:${T.inkMid};line-height:1.6">${body}</p>
      </td>
    </tr>
  </table>`;
};

/** Credentials block (styled distinctly) */
const credentialBox = (email, password) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background:${T.ink};border-radius:12px;margin:20px 0;overflow:hidden">
    <tr>
      <td style="padding:10px 20px;background:rgba(255,255,255,0.05)">
        <p style="margin:0;font-family:${T.fontMono};font-size:10px;font-weight:600;
                   letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.4)">
          Your Login Credentials
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 20px 8px">
        <p style="margin:0 0 4px;font-family:${T.fontMono};font-size:10px;
                   letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.4)">Email</p>
        <p style="margin:0 0 20px;font-family:${T.fontMono};font-size:15px;
                   color:#ffffff;letter-spacing:0.02em">${email}</p>
        <p style="margin:0 0 4px;font-family:${T.fontMono};font-size:10px;
                   letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.4)">Temporary Password</p>
        <p style="margin:0 0 20px;font-family:${T.fontMono};font-size:20px;font-weight:700;
                   color:#fbbf24;letter-spacing:0.1em">${password}</p>
      </td>
    </tr>
  </table>`;

/** Divider */
const divider = () =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0">
    <tr><td style="height:1px;background:${T.border}"></td></tr>
  </table>`;

/** Footer CTA text */
const cta = (text) => `
  ${divider()}
  <p style="margin:0;font-family:${T.fontBase};font-size:13px;color:${T.inkLight};line-height:1.6;
             font-style:italic">${text}</p>`;

/** Success celebration row */
const successBanner = (text) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background:${T.greenBg};border:1px solid ${T.greenBorder};border-radius:10px;margin:20px 0">
    <tr>
      <td style="padding:16px 20px;text-align:center;font-family:${T.fontBase};
                 font-size:15px;font-weight:700;color:${T.green}">${text}</td>
    </tr>
  </table>`;


// ═══════════════════════════════════════════════════════════════
//  MEMBER WELCOME
// ═══════════════════════════════════════════════════════════════
const memberWelcome = (member, credentials) => ({
  subject: `Welcome to Swara SHG — Your Login Details`,
  html: layout(`
    ${greeting(member.firstName)}
    ${para(`Welcome to <strong style="color:${T.ink}">Swara Self Help Group</strong>. Your member account has been created and you are now part of our community.`)}
    ${para(`Use the credentials below to access your member dashboard.`)}
    ${credentialBox(credentials.email, credentials.password)}
    ${alert(
      'Change Your Password on First Login',
      'You will be prompted to set a new password the first time you sign in. Please choose a strong, unique password.',
      { color: T.amber, bg: T.amberBg, border: T.amberBorder, icon: '🔑' }
    )}
    ${para(`Once logged in you can view your savings balance, check loan eligibility, and manage your account from the member dashboard.`)}
    ${cta('If you did not expect this email or believe it was sent in error, please contact the group administrator immediately.')}
  `, { accentColor: T.brandAccent, badgeLabel: 'Welcome' }),
});

// ═══════════════════════════════════════════════════════════════
//  DEPOSIT TEMPLATES
// ═══════════════════════════════════════════════════════════════
const depositSubmitted = (member, deposit) => ({
  subject: `Deposit Received — Awaiting Approval`,
  html: layout(`
    ${greeting(member.firstName)}
    ${para(`Your deposit has been received and is <strong style="color:${T.amber}">awaiting admin approval</strong>. You will be notified once it has been reviewed.`)}
    ${heroStat('Amount Deposited', fmt(deposit.totalAmount), { color: T.amber, bg: T.amberBg, border: T.amberBorder })}
    ${dataTable([
      ['M-PESA Code',  deposit.mpesaCode],
      ['Submitted On', fdt(new Date())],
      ['Status',       'Pending Approval'],
    ], { accentColor: T.amber, bgColor: T.amberBg, borderColor: T.amberBorder })}
    ${cta('You will receive a follow-up email once your deposit has been reviewed by an administrator.')}
  `, { accentColor: T.amber, badgeLabel: 'Deposit Received' }),
});

const depositApproved = (member, deposit) => ({
  subject: `Deposit Approved`,
  html: layout(`
    ${greeting(member.firstName)}
    ${para(`Your deposit has been <strong style="color:${T.green}">approved and distributed</strong> to your account.`)}
    ${heroStat('Total Distributed', fmt(deposit.totalAmount), { color: T.green, bg: T.greenBg, border: T.greenBorder })}
    ${dataTable([
      ['M-PESA Code',   deposit.mpesaCode],
      ['Approved On',   fdt(new Date())],
      ...(Number(deposit.savingsAmount)       > 0 ? [['Savings',         fmt(deposit.savingsAmount)]]       : []),
      ...(Number(deposit.loanPaymentAmount)   > 0 ? [['Loan Payment',    fmt(deposit.loanPaymentAmount)]]   : []),
      ...(Number(deposit.seedCapitalAmount)   > 0 ? [['Seed Capital',    fmt(deposit.seedCapitalAmount)]]   : []),
      ...(Number(deposit.agmFeeAmount)        > 0 ? [['AGM Fee',         fmt(deposit.agmFeeAmount)]]        : []),
      ...(Number(deposit.savingsFineAmount)   > 0 ? [['Savings Fine',    fmt(deposit.savingsFineAmount)]]   : []),
      ...(Number(deposit.chamaaFineAmount)    > 0 ? [['Chamaa Fine',     fmt(deposit.chamaaFineAmount)]]    : []),
      ...(Number(deposit.othersAmount)        > 0 ? [['Others',          fmt(deposit.othersAmount)]]        : []),
    ], { accentColor: T.green, bgColor: T.greenBg, borderColor: T.greenBorder })}
    ${cta('Log in to your account to view your updated balances.')}
  `, { accentColor: T.green, badgeLabel: 'Deposit Approved' }),
});

const depositRejected = (member, deposit) => ({
  subject: `Deposit Rejected`,
  html: layout(`
    ${greeting(member.firstName)}
    ${para(`Unfortunately, your deposit has been <strong style="color:${T.red}">rejected</strong>. Please review the details below.`)}
    ${dataTable([
      ['Amount',      fmt(deposit.totalAmount)],
      ['M-PESA Code', deposit.mpesaCode],
      ['Reason',      deposit.rejectionReason || 'Not specified'],
    ], { accentColor: T.red, bgColor: T.redBg, borderColor: T.redBorder })}
    ${cta('Please contact the administrator or resubmit with a valid M-PESA transaction.')}
  `, { accentColor: T.red, badgeLabel: 'Deposit Rejected' }),
});

// ═══════════════════════════════════════════════════════════════
//  LOAN TEMPLATES
// ═══════════════════════════════════════════════════════════════
const loanApplied = (member, loan) => ({
  subject: `Loan Application Received`,
  html: layout(`
    ${greeting(member.firstName)}
    ${para(`Your loan application has been received and is <strong style="color:${T.blue}">awaiting guarantor approvals and admin review</strong>.`)}
    ${heroStat('Loan Amount Applied For', fmt(loan.amount), { color: T.blue, bg: T.blueBg, border: T.blueBorder })}
    ${dataTable([
      ['Duration',    `${loan.durationMonths} month(s)`],
      ['Interest',    `${loan.interestRate}%`],
      ['Applied On',  fdt(new Date())],
      ['Status',      'Pending Approval'],
    ], { accentColor: T.blue, bgColor: T.blueBg, borderColor: T.blueBorder })}
    ${cta('You will be notified once all guarantors have responded and the loan has been reviewed by an administrator.')}
  `, { accentColor: T.blue, badgeLabel: 'Loan Application' }),
});

const loanApproved = (member, loan) => {
  const txFee     = Number(loan.transactionFee ?? 108);
  const principal = Number(loan.amount);
  const interest  = principal * Number(loan.interestRate) / 100;
  const repayment = loan.totalRepayment || (principal + interest + txFee);
  const disbursed = loan.disbursedAmount || principal;
  return {
    subject: `Loan Approved`,
    html: layout(`
      ${greeting(member.firstName)}
      ${para(`Congratulations! Your loan has been <strong style="color:${T.green}">approved and disbursed</strong>.`)}
      ${splitStat(
        { label: 'You Will Receive', value: fmt(disbursed), sub: 'Principal disbursed to you' },
        { label: 'You Will Repay',   value: fmt(repayment), sub: `Principal + ${loan.interestRate}% interest + fee` }
      )}
      ${dataTable([
        ['Principal',        fmt(principal)],
        ['Interest',         `${loan.interestRate}% = ${fmt(interest)}`],
        ['Transaction Fee',  `${fmt(txFee)} (included in repayment)`],
        ['Total Repayment',  fmt(repayment)],
        ['Duration',         `${loan.durationMonths} month(s)`],
        ['Disbursed On',     fdt(loan.disbursementDate)],
        ['Due Date',         fd(loan.dueDate)],
      ], { accentColor: T.green, bgColor: T.greenBg, borderColor: T.greenBorder })}
      ${cta('Please ensure timely repayment to maintain a good credit record and avoid penalties.')}
    `, { accentColor: T.green, badgeLabel: 'Loan Approved' }),
  };
};

const loanRejected = (member, loan) => ({
  subject: `Loan Application Rejected`,
  html: layout(`
    ${greeting(member.firstName)}
    ${para(`Your loan application of <strong style="color:${T.ink}">${fmt(loan.amount)}</strong> has been <strong style="color:${T.red}">rejected</strong>.`)}
    ${dataTable([
      ['Amount',   fmt(loan.amount)],
      ['Reason',   loan.rejectionReason || 'Not specified'],
    ], { accentColor: T.red, bgColor: T.redBg, borderColor: T.redBorder })}
    ${cta('Please contact the administrator for more information or to discuss your eligibility.')}
  `, { accentColor: T.red, badgeLabel: 'Loan Rejected' }),
});

const loanPaymentRecorded = (member, payment, loan) => {
  const fullyPaid = loan.remainingBalance <= 0;
  return {
    subject: `Loan Payment Recorded`,
    html: layout(`
      ${greeting(member.firstName)}
      ${para(`A loan payment has been recorded on your account.`)}
      ${heroStat('Payment Amount', fmt(payment.amount), { color: T.green, bg: T.greenBg, border: T.greenBorder })}
      ${dataTable([
        ['Payment Date',      fdt(payment.paymentDate || new Date())],
        ['Payment Method',    payment.paymentMethod || 'Cash'],
        ['Remaining Balance', fmt(loan.remainingBalance)],
        ...(fullyPaid ? [['Loan Status', '✓ FULLY PAID']] : []),
      ], { accentColor: fullyPaid ? T.green : T.blue, bgColor: fullyPaid ? T.greenBg : T.blueBg, borderColor: fullyPaid ? T.greenBorder : T.blueBorder })}
      ${fullyPaid ? successBanner('🎉 Congratulations — your loan is now fully paid!') : cta('Keep up your payments to maintain a good credit record.')}
    `, { accentColor: fullyPaid ? T.green : T.blue, badgeLabel: 'Payment Recorded' }),
  };
};

const loanArrears = (member, loan) => ({
  subject: `Loan Overdue — Immediate Action Required`,
  html: layout(`
    ${greeting(member.firstName)}
    ${alert(
      'Your Loan Is Overdue',
      'Your loan has entered arrears. Immediate action is required to avoid further penalties.',
      { color: T.red, bg: T.redBg, border: T.redBorder, icon: '🚨' }
    )}
    ${dataTable([
      ['Original Amount',    fmt(loan.amount)],
      ['Remaining Balance',  fmt(loan.remainingBalance)],
      ['Penalty Rate',       '5% per month'],
      ['Due Date',           fd(loan.dueDate)],
    ], { accentColor: T.red, bgColor: T.redBg, borderColor: T.redBorder })}
    ${para(`You have <strong>3 months</strong> to clear the outstanding balance before the loan enters default. In default, your savings may be deducted and your guarantors will be held liable.`)}
    ${cta('Please make payment immediately or contact the administrator to arrange a repayment plan.')}
  `, { accentColor: T.red, badgeLabel: 'Loan Overdue' }),
});

const loanDefault = (member, loan, savingsDeducted) => ({
  subject: `Loan Defaulted — Action Taken`,
  html: layout(`
    ${greeting(member.firstName)}
    ${alert(
      'Loan Default',
      'Your loan has entered default status. Please contact the administrator urgently.',
      { color: T.red, bg: T.redBg, border: T.redBorder, icon: '🚫' }
    )}
    ${dataTable([
      ['Loan Amount',       fmt(loan.amount)],
      ['Remaining Balance', fmt(loan.remainingBalance)],
      ...(savingsDeducted > 0 ? [['Savings Deducted', fmt(savingsDeducted)]] : []),
    ], { accentColor: T.red, bgColor: T.redBg, borderColor: T.redBorder })}
    ${savingsDeducted > 0
      ? para(`Your savings of <strong>${fmt(savingsDeducted)}</strong> have been applied toward your outstanding balance.`)
      : ''
    }
    ${para(`Your guarantors have been notified of their liability for the remaining balance.`)}
    ${cta('Please contact the administrator urgently to resolve this matter.')}
  `, { accentColor: T.red, badgeLabel: 'Loan Default' }),
});

// ═══════════════════════════════════════════════════════════════
//  GUARANTOR TEMPLATES
// ═══════════════════════════════════════════════════════════════
const guarantorRequest = (guarantor, borrower, loan) => ({
  subject: `Guarantor Request from ${borrower.firstName} ${borrower.lastName}`,
  html: layout(`
    ${greeting(guarantor.firstName)}
    ${para(`<strong style="color:${T.ink}">${borrower.firstName} ${borrower.lastName}</strong> has requested you to serve as a <strong>loan guarantor</strong>.`)}
    ${dataTable([
      ['Borrower',        `${borrower.firstName} ${borrower.lastName}`],
      ['Loan Amount',     fmt(loan.amount)],
      ['Duration',        `${loan.durationMonths} month(s) @ ${loan.interestRate}%`],
      ['Total Repayment', fmt(Number(loan.amount) + Number(loan.amount) * Number(loan.interestRate) / 100)],
      ['Requested On',    fdt(new Date())],
    ], { accentColor: T.purple, bgColor: T.purpleBg, borderColor: T.purpleBorder })}
    ${alert(
      'Guarantor Liability',
      'As a guarantor, you are liable for repayment if the borrower defaults on this loan. Please consider carefully before accepting.',
      { color: T.amber, bg: T.amberBg, border: T.amberBorder, icon: '⚠️' }
    )}
    ${para(`Please log in to your account to <strong>accept or decline</strong> this request.`)}
    ${cta('This request will expire if not responded to promptly. Please log in as soon as possible.')}
  `, { accentColor: T.purple, badgeLabel: 'Guarantor Request' }),
});

const guarantorAccepted = (borrower, guarantor) => ({
  subject: `Guarantor Accepted — ${guarantor.firstName} ${guarantor.lastName}`,
  html: layout(`
    ${greeting(borrower.firstName)}
    ${para(`<strong style="color:${T.green}">${guarantor.firstName} ${guarantor.lastName}</strong> has accepted to guarantee your loan.`)}
    ${cta('Once all guarantors have accepted, your loan will proceed to admin review.')}
  `, { accentColor: T.green, badgeLabel: 'Guarantor Accepted' }),
});

const guarantorDeclined = (borrower, guarantor, reason) => ({
  subject: `Guarantor Declined — ${guarantor.firstName} ${guarantor.lastName}`,
  html: layout(`
    ${greeting(borrower.firstName)}
    ${para(`<strong style="color:${T.red}">${guarantor.firstName} ${guarantor.lastName}</strong> has declined to guarantee your loan.`)}
    ${reason ? dataTable([['Reason', reason]], { accentColor: T.red, bgColor: T.redBg, borderColor: T.redBorder }) : ''}
    ${cta('Please log in to select a replacement guarantor to continue your loan application.')}
  `, { accentColor: T.red, badgeLabel: 'Guarantor Declined' }),
});

const guarantorLiability = (guarantor, borrower, loanId, amount) => ({
  subject: `Guarantor Liability Notice`,
  html: layout(`
    ${greeting(guarantor.firstName)}
    ${alert(
      'Guaranteed Loan Has Defaulted',
      `A loan you guaranteed for ${borrower.firstName} ${borrower.lastName} (Loan #${loanId}) has defaulted.`,
      { color: T.red, bg: T.redBg, border: T.redBorder, icon: '🚨' }
    )}
    ${heroStat('Your Liability', fmt(amount), { color: T.red, bg: T.redBg, border: T.redBorder })}
    ${cta('Please contact the administrator immediately to arrange payment of your guarantor liability.')}
  `, { accentColor: T.red, badgeLabel: 'Liability Notice' }),
});

const guarantorLoanApproved = (guarantor, borrower, loan) => {
  const txFee     = Number(loan.transactionFee ?? 108);
  const principal = Number(loan.amount);
  const interest  = principal * Number(loan.interestRate) / 100;
  const repayment = loan.totalRepayment || (principal + interest + txFee);
  return {
    subject: `Loan Approved — ${borrower.firstName} ${borrower.lastName}'s Loan`,
    html: layout(`
      ${greeting(guarantor.firstName)}
      ${para(`The loan you agreed to guarantee for <strong style="color:${T.ink}">${borrower.firstName} ${borrower.lastName}</strong> has been <strong style="color:${T.green}">approved and disbursed</strong>.`)}
      ${dataTable([
        ['Borrower',         `${borrower.firstName} ${borrower.lastName}`],
        ['Amount Disbursed', fmt(loan.disbursedAmount || principal)],
        ['Total Repayment',  fmt(repayment)],
        ['Duration',         `${loan.durationMonths} month(s) @ ${loan.interestRate}%`],
        ['Disbursed On',     fdt(loan.disbursementDate)],
        ['Due Date',         fd(loan.dueDate)],
      ], { accentColor: T.green, bgColor: T.greenBg, borderColor: T.greenBorder })}
      ${alert(
        'Your Liability Remains Active',
        'As a guarantor, you remain liable if the borrower fails to repay. You will be notified if the loan enters arrears or default.',
        { color: T.amber, bg: T.amberBg, border: T.amberBorder, icon: 'ℹ️' }
      )}
      ${cta('No action is required from you at this time.')}
    `, { accentColor: T.green, badgeLabel: 'Loan Approved' }),
  };
};

// ═══════════════════════════════════════════════════════════════
//  ADMIN NOTIFICATION TEMPLATES
// ═══════════════════════════════════════════════════════════════
const adminDepositPending = (member, deposit) => ({
  subject: `New Deposit Pending — ${member.firstName} ${member.lastName}`,
  html: layout(`
    ${para(`A new deposit from <strong style="color:${T.ink}">${member.firstName} ${member.lastName}</strong> requires your approval.`)}
    ${heroStat('Deposit Amount', fmt(deposit.totalAmount), { color: T.blue, bg: T.blueBg, border: T.blueBorder })}
    ${dataTable([
      ['Member',      `${member.firstName} ${member.lastName}`],
      ['M-PESA Code', deposit.mpesaCode],
      ['Submitted',   fdt(new Date())],
      ...(deposit.mpesaMessage ? [['M-PESA Message', deposit.mpesaMessage]] : []),
    ], { accentColor: T.blue, bgColor: T.blueBg, borderColor: T.blueBorder })}
    ${cta('Please log in to the admin dashboard to review and approve this deposit.')}
  `, { accentColor: T.blue, badgeLabel: 'Deposit Pending' }),
});

const adminLoanPending = (member, loan) => ({
  subject: `New Loan Application — ${member.firstName} ${member.lastName}`,
  html: layout(`
    ${para(`A new loan application from <strong style="color:${T.ink}">${member.firstName} ${member.lastName}</strong> requires your attention.`)}
    ${heroStat('Loan Amount', fmt(loan.amount), { color: T.purple, bg: T.purpleBg, border: T.purpleBorder })}
    ${dataTable([
      ['Member',     `${member.firstName} ${member.lastName}`],
      ['Duration',   `${loan.durationMonths} month(s) @ ${loan.interestRate}%`],
      ['Applied On', fdt(new Date())],
    ], { accentColor: T.purple, bgColor: T.purpleBg, borderColor: T.purpleBorder })}
    ${cta('Please log in to the admin dashboard to review and process this loan application.')}
  `, { accentColor: T.purple, badgeLabel: 'Loan Application' }),
});

const adminGuarantorRequestOffice = (member, loan) => ({
  subject: `Office Guarantor Request — ${member.firstName} ${member.lastName}`,
  html: layout(`
    ${para(`<strong style="color:${T.ink}">${member.firstName} ${member.lastName}</strong> has requested <strong>The Office</strong> to serve as a loan guarantor.`)}
    ${dataTable([
      ['Member',       `${member.firstName} ${member.lastName}`],
      ['Amount',       fmt(loan.amount)],
      ['Duration',     `${loan.durationMonths} month(s)`],
      ['Requested On', fdt(new Date())],
    ], { accentColor: T.amber, bgColor: T.amberBg, borderColor: T.amberBorder })}
    ${cta('Please log in to the admin dashboard to approve or decline this office guarantor request.')}
  `, { accentColor: T.amber, badgeLabel: 'Office Guarantor Request' }),
});

module.exports = {
  memberWelcome,
  depositSubmitted,
  depositApproved,
  depositRejected,
  loanApplied,
  loanApproved,
  loanRejected,
  loanPaymentRecorded,
  loanArrears,
  loanDefault,
  guarantorRequest,
  guarantorAccepted,
  guarantorDeclined,
  guarantorLiability,
  guarantorLoanApproved,
  adminDepositPending,
  adminLoanPending,
  adminGuarantorRequestOffice,
};