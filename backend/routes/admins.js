const express = require('express');
const router  = express.Router();
const { authenticateToken, requireAdmin, requireAdminOnly } = require('../middleware/auth');
const {
  getAllAdmins,
  createAdmin,
  resetAdminPassword,
  toggleAdminActive,
  deleteAdmin,
} = require('../controllers/adminController');

// All routes require authentication
router.use(authenticateToken);

router.get   ('/',                   requireAdmin,     getAllAdmins);      
router.post  ('/',                   requireAdminOnly, createAdmin);        
router.put   ('/:id/reset-password', requireAdminOnly, resetAdminPassword);  
router.put   ('/:id/toggle-active',  requireAdminOnly, toggleAdminActive);   
router.delete('/:id',                requireAdminOnly, deleteAdmin);         

module.exports = router;