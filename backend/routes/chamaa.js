const express    = require('express');
const router     = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
  getAllCycles,
  getCycleById,
  createCycle,
  addParticipant,
  updateParticipantPosition,
  updateParticipantSchedule,
  recordContribution,
  markAsReceived,
  endCycle,
  getMonthlyChamaaReport,
  getChamaaPaymentsReport,   // ← make sure this is exported from chamaaController
} = require('../controllers/chamaaController');

// ── Static routes MUST come before /:id to avoid being matched as an ID ──────
router.get('/',                              authenticateToken,             getAllCycles);
router.post('/',                             authenticateToken, requireAdmin, createCycle);

// ── NEW: payments report — must be before /:id ────────────────────────────────
router.get('/payments-report',               authenticateToken, requireAdmin, getChamaaPaymentsReport);

router.post('/participant',                  authenticateToken, requireAdmin, addParticipant);
router.post('/contribution',                 authenticateToken, requireAdmin, recordContribution);
router.post('/received',                     authenticateToken, requireAdmin, markAsReceived);

// ── Dynamic /:id routes LAST ──────────────────────────────────────────────────
router.get('/:id',                           authenticateToken,             getCycleById);
router.put('/:id/end',                       authenticateToken, requireAdmin, endCycle);
router.get('/report/:cycleId/:month/:year',  authenticateToken, requireAdmin, getMonthlyChamaaReport);
router.put('/participant/:id/position',      authenticateToken, requireAdmin, updateParticipantPosition);
router.put('/participant/:id/schedule',      authenticateToken, requireAdmin, updateParticipantSchedule);

module.exports = router;