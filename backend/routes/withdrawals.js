const express    = require('express');
const router     = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
  getWithdrawals,
  saveWithdrawals,
  clearWithdrawals,
} = require('../controllers/withdrawalController');

router.get('/',        authenticateToken, requireAdmin, getWithdrawals);
router.post('/save',   authenticateToken, requireAdmin, saveWithdrawals);
router.delete('/clear',authenticateToken, requireAdmin, clearWithdrawals);

module.exports = router;