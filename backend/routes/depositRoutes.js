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
} = require('../controllers/depositController');

router.post('/',                 authenticateToken,                createDeposit);
router.get('/summary/:memberId', authenticateToken,                getDepositSummary);
router.get('/',                  authenticateToken, requireAdmin,     getDeposits);
router.post('/:id/approve',      authenticateToken, requireAdminOnly, approveDeposit);
router.post('/:id/reject',       authenticateToken, requireAdminOnly, rejectDeposit);
router.put('/:id',               authenticateToken, requireAdminOnly, updateDeposit);

module.exports = router;