const express = require('express');
const router  = express.Router();
const { authenticateToken, requireAdmin, requireAdminOnly } = require('../middleware/auth');
const chamaaController = require('../controllers/chamaaController');

router.use(authenticateToken);

router.get ('/',                             requireAdmin,     chamaaController.getAllCycles);
router.get ('/report/:cycleId/:month/:year', requireAdmin,     chamaaController.getMonthlyChamaaReport);
router.get ('/:id',                          requireAdmin,     chamaaController.getCycleById);
router.post('/',                             requireAdminOnly, chamaaController.createCycle);
router.post('/participant',                  requireAdminOnly, chamaaController.addParticipant);
router.put ('/participant/:id/position',     requireAdminOnly, chamaaController.updateParticipantPosition); // ← fixed
router.post('/contribution',                 requireAdminOnly, chamaaController.recordContribution);
router.post('/received',                     requireAdminOnly, chamaaController.markAsReceived);
router.put ('/:id/end',                      requireAdminOnly, chamaaController.endCycle);

module.exports = router;