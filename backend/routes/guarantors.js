const express = require('express');
const router = express.Router();
const { getEligibleGuarantors, checkGuarantorEligibility } = require('../controllers/guarantorController');
const { authenticateToken } = require('../middleware/auth');

router.get('/eligible',                       authenticateToken, getEligibleGuarantors);
router.get('/:guarantorId/check-eligibility', authenticateToken, checkGuarantorEligibility);

module.exports = router;