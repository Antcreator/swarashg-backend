const express = require('express');
const router  = express.Router();
const { authenticateToken, requireAdmin, requireAdminOnly } = require('../middleware/auth');
const savingsController = require('../controllers/savingsController');

router.use(authenticateToken);

router.get('/stats',               requireAdmin,     savingsController.getSavingsStats);
router.get('/',                                      savingsController.getAllSavings);
router.get('/member/:memberId',    requireAdmin,     savingsController.getMemberSavings);
router.get('/report/:month/:year', requireAdmin,     savingsController.getMonthlySavingsReport);
router.post('/',                   requireAdminOnly, savingsController.recordSavings);
router.put('/:id',                 requireAdminOnly, savingsController.updateSavings);
router.delete('/:id',              requireAdminOnly, savingsController.deleteSavings);

module.exports = router;