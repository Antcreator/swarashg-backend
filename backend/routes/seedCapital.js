const express = require('express');
const router  = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { getSeedCapitalStats, getAllSeedCapital } = require('../controllers/seedCapitalController');

router.get('/stats', authenticateToken, requireAdmin, getSeedCapitalStats);
router.get('/',      authenticateToken, requireAdmin, getAllSeedCapital);

module.exports = router;