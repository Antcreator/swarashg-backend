const sequelize = require('../config/database');

const User              = require('./User');
const Member            = require('./Member');
const Savings           = require('./Savings');
const Loan              = require('./Loan');
const LoanGuarantor     = require('./LoanGuarantor');
const LoanPayment       = require('./LoanPayment');
const ChamaaCycle       = require('./ChamaaCycle');
const ChamaaParticipant = require('./ChamaaParticipant');
const ChamaaContribution= require('./ChamaaContribution');
const Fine              = require('./Fine');
const Deposit           = require('./Deposit');
const SeedCapital       = require('./SeedCapital');
const Statutory         = require('./Statutory');
const AgmFee            = require('./AgmFee');
const Investment           = require('./Investment');
const InvestmentColumnName = require('./InvestmentColumnName');
const RegistrationFee = require('./RegistrationFee');

// ─── User ↔ Member ──────────────────────────────────────────────
User.hasOne(Member,   { foreignKey: 'userId',  as: 'member' });
Member.belongsTo(User,{ foreignKey: 'userId',  as: 'user'   });

// ─── Member ↔ Savings ───────────────────────────────────────────
Member.hasMany(Savings, { foreignKey: 'memberId', as: 'savings' });
Savings.belongsTo(Member, { foreignKey: 'memberId', as: 'member' });

// ─── Member ↔ Loan ──────────────────────────────────────────────
Member.hasMany(Loan,  { foreignKey: 'memberId', as: 'loans' });
Loan.belongsTo(Member,{ foreignKey: 'memberId', as: 'member' });

// ─── Loan ↔ User (approver) ─────────────────────────────────────
Loan.belongsTo(User, { foreignKey: 'approvedBy', as: 'approver' });
User.hasMany(Loan,   { foreignKey: 'approvedBy', as: 'approvedLoans' });

// ─── Loan ↔ LoanGuarantor ───────────────────────────────────────
Loan.hasMany(LoanGuarantor,     { foreignKey: 'loanId',      as: 'guarantors' });
LoanGuarantor.belongsTo(Loan,   { foreignKey: 'loanId',      as: 'loan'       });
LoanGuarantor.belongsTo(Member, { foreignKey: 'guarantorId', as: 'guarantor'  });
Member.hasMany(LoanGuarantor,   { foreignKey: 'guarantorId', as: 'guarantees' });

// ─── Loan ↔ LoanPayment ─────────────────────────────────────────
Loan.hasMany(LoanPayment,     { foreignKey: 'loanId', as: 'payments' });
LoanPayment.belongsTo(Loan,   { foreignKey: 'loanId', as: 'loan'    });

// ─── Member ↔ Fine ──────────────────────────────────────────────
Member.hasMany(Fine,  { foreignKey: 'memberId', as: 'fines' });
Fine.belongsTo(Member,{ foreignKey: 'memberId', as: 'member' });

// ─── ChamaaCycle ↔ ChamaaParticipant ────────────────────────────
ChamaaCycle.hasMany(ChamaaParticipant,     { foreignKey: 'cycleId',  as: 'participants' });
ChamaaParticipant.belongsTo(ChamaaCycle,   { foreignKey: 'cycleId',  as: 'cycle'        });
ChamaaParticipant.belongsTo(Member,        { foreignKey: 'memberId', as: 'member'       });
Member.hasMany(ChamaaParticipant,          { foreignKey: 'memberId', as: 'chamaaParticipations' });

// ─── ChamaaParticipant ↔ ChamaaContribution ─────────────────────
ChamaaParticipant.hasMany(ChamaaContribution,   { foreignKey: 'participantId', as: 'contributions' });
ChamaaContribution.belongsTo(ChamaaParticipant, { foreignKey: 'participantId', as: 'participant'   });

// ─── Member ↔ Deposit ───────────────────────────────────────────
Member.hasMany(Deposit,  { foreignKey: 'memberId', as: 'deposits' });
Deposit.belongsTo(Member,{ foreignKey: 'memberId', as: 'member'   });

// ─── Deposit ↔ Loan ─────────────────────────────────────────────
Deposit.belongsTo(Loan,  { foreignKey: 'loanId', as: 'loan'     });
Loan.hasMany(Deposit,    { foreignKey: 'loanId', as: 'deposits' });

// ─── Deposit ↔ User (confirmer and approver) ────────────────────
Deposit.belongsTo(User, { foreignKey: 'confirmedBy', as: 'confirmer' });
User.hasMany(Deposit,   { foreignKey: 'confirmedBy', as: 'confirmedDeposits' });

Deposit.belongsTo(User, { foreignKey: 'approvedBy', as: 'depositApprover' });
User.hasMany(Deposit,   { foreignKey: 'approvedBy', as: 'approvedDeposits' });

// ─── Member ↔ SeedCapital ───────────────────────────────────────
Member.hasMany(SeedCapital,  { foreignKey: 'memberId', as: 'seedCapitalContributions' });
SeedCapital.belongsTo(Member,{ foreignKey: 'memberId', as: 'member' });

// ─── SeedCapital ↔ Deposit ──────────────────────────────────────
SeedCapital.belongsTo(Deposit, { foreignKey: 'depositId', as: 'deposit' });
Deposit.hasMany(SeedCapital,   { foreignKey: 'depositId', as: 'seedCapitalEntries' });

// ─── Member ↔ AgmFee ────────────────────────────────────────────
Member.hasMany(AgmFee,  { foreignKey: 'memberId',   as: 'agmFees'   });
AgmFee.belongsTo(Member,{ foreignKey: 'memberId',   as: 'member'    });
AgmFee.belongsTo(User,  { foreignKey: 'recordedBy', as: 'recorder'  });
AgmFee.belongsTo(Deposit,{ foreignKey: 'depositId', as: 'deposit'   });

// ─── Member ↔ Statutory ─────────────────────────────────────────
Member.hasMany(Statutory,  { foreignKey: 'memberId', as: 'statutory' });
Statutory.belongsTo(Member,{ foreignKey: 'memberId', as: 'member'   });

// ─── Statutory ↔ User (editor & submitter) ───────────────────────
Statutory.belongsTo(User, { foreignKey: 'editedBy',    as: 'editor'    });
Statutory.belongsTo(User, { foreignKey: 'submittedBy', as: 'submitter' });
User.hasMany(Statutory,   { foreignKey: 'editedBy',    as: 'editedStatutory'    });
User.hasMany(Statutory,   { foreignKey: 'submittedBy', as: 'submittedStatutory' });

Member.hasOne(RegistrationFee, { foreignKey: 'memberId', as: 'registrationFee' });
RegistrationFee.belongsTo(Member, { foreignKey: 'memberId', as: 'member' });

module.exports = {
  User,
  Member,
  Savings,
  Loan,
  LoanGuarantor,
  LoanPayment,
  ChamaaCycle,
  ChamaaParticipant,
  ChamaaContribution,
  Fine,
  Deposit,
  SeedCapital,
  Statutory,
  AgmFee,
  Investment,
  InvestmentColumnName,
  RegistrationFee,
  sequelize,
};