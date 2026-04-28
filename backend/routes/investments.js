const express = require('express');
const router  = express.Router();
const { authenticateToken, requireAdmin, requireAdminOnly } = require('../middleware/auth');
const { getAllInvestments, saveInvestments, getInvestmentStats } = require('../controllers/investmentController');

router.get('/stats', authenticateToken, requireAdmin,     getInvestmentStats);
router.get('/',      authenticateToken, requireAdmin,     getAllInvestments);
router.post('/save', authenticateToken, requireAdminOnly, saveInvestments);

module.exports = router;