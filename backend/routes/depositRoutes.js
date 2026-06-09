const express = require('express');
const router  = express.Router();
const { authenticateToken, requireAdmin, requireAdminOnly } = require('../middleware/auth');
const {
  createDeposit,
  approveDeposit,
  rejectDeposit,
  updateDeposit,
  getDeposits,
  getDepositSummary,
  getMemberChamaaSlots,   // ← NEW
} = require('../controllers/depositController');

router.post('/',                 authenticateToken,                createDeposit);
router.get('/summary/:memberId', authenticateToken,                getDepositSummary);

// ── NEW: fetch active chamaa slots for the deposit modal slot selector ──
// Must be placed BEFORE /:id routes to avoid being matched as an ID
router.get('/chamaa-slots/:memberId', authenticateToken,           getMemberChamaaSlots);

router.get('/',                  authenticateToken, requireAdmin,     getDeposits);
router.post('/:id/approve',      authenticateToken, requireAdminOnly, approveDeposit);
router.post('/:id/reject',       authenticateToken, requireAdminOnly, rejectDeposit);
router.put('/:id',               authenticateToken, requireAdminOnly, updateDeposit);

module.exports = router;