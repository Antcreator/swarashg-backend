const express = require('express');
const router  = express.Router();
const { authenticateToken, requireAdmin, requireAdminOnly, requireOwnerOrAdmin } = require('../middleware/auth');
const memberController = require('../controllers/memberController');

router.use(authenticateToken);

router.get ('/',                         requireAdmin,        memberController.getAllMembers);
router.get ('/:id',           requireOwnerOrAdmin,            memberController.getMemberById);
router.get ('/:id/dashboard', requireOwnerOrAdmin,            memberController.getMemberDashboard);
router.post('/',              requireAdminOnly,               memberController.createMember);
router.put ('/:id',           requireAdminOnly,               memberController.updateMember);
router.delete('/:id',         requireAdminOnly,               memberController.deactivateMember);
router.delete('/:id/permanent', requireAdminOnly,             memberController.deleteMember);

module.exports = router;