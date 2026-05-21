const express = require('express');
const router  = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
  getSeedCapitalStats,
  getMemberSeedCapital,
  getAllSeedCapital,
  updateSeedCapital,
  deleteSeedCapital,
  createSeedCapital,
} = require('../controllers/seedCapitalController');

// Member-accessible: own seed capital only
router.get('/member/:memberId', authenticateToken, getMemberSeedCapital);

// Admin-only routes
router.get('/stats', authenticateToken, requireAdmin, getSeedCapitalStats);
router.get('/',      authenticateToken, requireAdmin, getAllSeedCapital);
router.put('/:id',   authenticateToken, requireAdmin, updateSeedCapital);
router.delete('/:id',authenticateToken, requireAdmin, deleteSeedCapital);
router.post('/',     authenticateToken, requireAdmin, createSeedCapital);

module.exports = router;
