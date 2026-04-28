const express = require('express');
const router  = express.Router();
const { authenticateToken, requireAdmin, requireAdminOnly } = require('../middleware/auth');
const { getAgmFeeStats, getAllAgmFees, createAgmFee, deleteAgmFee } = require('../controllers/agmFeeController');

router.get('/stats',  authenticateToken, requireAdmin,     getAgmFeeStats);
router.get('/',       authenticateToken, requireAdmin,     getAllAgmFees);
router.post('/',      authenticateToken, requireAdminOnly, createAgmFee);
router.delete('/:id', authenticateToken, requireAdminOnly, deleteAgmFee);

module.exports = router;