const express = require('express');
const router  = express.Router();
const { authenticateToken, requireAdmin, requireAdminOnly } = require('../middleware/auth');
const { getAllFines, getFinesStats, createFine, markFinePaid, deleteFine } = require('../controllers/finesController');


router.get('/stats',    authenticateToken, requireAdmin,     getFinesStats);
router.get('/',         authenticateToken,                   getAllFines);
router.post('/',        authenticateToken, requireAdminOnly, createFine);
router.put('/:id/pay',  authenticateToken, requireAdminOnly, markFinePaid);
router.delete('/:id',   authenticateToken, requireAdminOnly, deleteFine);

module.exports = router;