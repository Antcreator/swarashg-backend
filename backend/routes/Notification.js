const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

router.use(authenticateToken);

router.get('/',              notificationController.getMyNotifications);
router.get('/unread-count',  notificationController.getUnreadCount);
router.put('/:id/read',      notificationController.markAsRead);
router.put('/read-all',      notificationController.markAllAsRead);
router.delete('/:id',        notificationController.deleteNotification);

module.exports = router;