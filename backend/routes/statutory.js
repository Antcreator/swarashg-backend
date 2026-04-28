const express = require('express');
const router  = express.Router();
const { authenticateToken, requireAdmin, requireAdminOnly } = require('../middleware/auth');
const { getAllStatutory, upsertStatutory, submitStatutory } = require('../controllers/statutoryController');


router.get('/',                  authenticateToken, getAllStatutory);
router.put('/:memberId',         authenticateToken, requireAdminOnly, upsertStatutory);
router.post('/:memberId/submit', authenticateToken, requireAdminOnly, submitStatutory);

module.exports = router;