const express = require('express');
const router  = express.Router();
const { authenticateToken, requireAdmin, requireAdminOnly } = require('../middleware/auth');
const { getAllRegistrationFees, getRegistrationFeeStats, saveRegistrationFee, deleteRegistrationFee } = require('../controllers/registrationFeeController');

router.get('/stats',        authenticateToken, requireAdmin,     getRegistrationFeeStats);
router.get('/',             authenticateToken, requireAdmin,     getAllRegistrationFees);
router.post('/',            authenticateToken, requireAdminOnly, saveRegistrationFee);
router.delete('/:memberId', authenticateToken, requireAdminOnly, deleteRegistrationFee);

module.exports = router;