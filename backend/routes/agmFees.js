const express = require('express');
const router  = express.Router();
const { authenticateToken, requireAdmin, requireAdminOnly } = require('../middleware/auth');
const {
  getAgmFeeStats, getAllAgmFees, getMemberAgmFees, createAgmFee, deleteAgmFee,
  bulkDeductFromSavings,
} = require('../controllers/agmFeeController');

router.get('/stats',  authenticateToken, requireAdmin,     getAgmFeeStats);
router.get('/',       authenticateToken, requireAdmin,     getAllAgmFees);

// Member-safe: any logged-in user. The controller restricts members to their
// own record (admin/staff can view any), so no admin guard here.
router.get('/member/:memberId', authenticateToken, getMemberAgmFees);

router.post('/',      authenticateToken, requireAdminOnly, createAgmFee);

// December bulk action: preview (confirm:false) or run (confirm:true)
router.post('/bulk-deduct-from-savings', authenticateToken, requireAdminOnly, bulkDeductFromSavings);
router.delete('/:id', authenticateToken, requireAdminOnly, deleteAgmFee);

module.exports = router;