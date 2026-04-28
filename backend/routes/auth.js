const express = require('express');
const router  = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const authController = require('../controllers/authController');

router.post('/register',               authController.register);
router.post('/login',                  authController.login);
router.get ('/me',                     authenticateToken, authController.getCurrentUser);
router.post('/change-password',        authenticateToken, authController.changePassword);
router.post('/change-first-password',  authenticateToken, authController.changeFirstPassword); // ← NEW
router.post('/forgot-password',        authController.forgotPassword);
router.post('/reset-password',         authController.resetPassword);
router.post('/admin-reset-password',   authenticateToken, requireAdmin, authController.adminResetMemberPassword);

module.exports = router;