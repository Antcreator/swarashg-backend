const Notification = require('../models/Notification');
const Member = require('../models/Member');
const User = require('../models/User');

const getMyNotifications = async (req, res) => {
  const userId = req.user.id;

  try {
    const notifications = await Notification.findAll({
      where: { userId },
      order: [['created_at', 'DESC']],
      limit: 50,
    });

    return res.json({ notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({ message: 'Failed to fetch notifications' });
  }
};

// ─── GET /notifications/unread-count ───────────────────────────
const getUnreadCount = async (req, res) => {
  const userId = req.user.id;

  try {
    const count = await Notification.count({
      where: { userId, isRead: false }
    });

    return res.json({ unreadCount: count });
  } catch (error) {
    console.error('Get unread count error:', error);
    return res.status(500).json({ message: 'Failed to get unread count' });
  }
};

// ─── PUT /notifications/:id/read ───────────────────────────────
const markAsRead = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const notification = await Notification.findOne({
      where: { id, userId }
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    return res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    return res.status(500).json({ message: 'Failed to mark as read' });
  }
};

// ─── PUT /notifications/read-all ───────────────────────────────
const markAllAsRead = async (req, res) => {
  const userId = req.user.id;

  try {
    await Notification.update(
      { isRead: true, readAt: new Date() },
      { where: { userId, isRead: false } }
    );

    return res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    return res.status(500).json({ message: 'Failed to mark all as read' });
  }
};

// ─── DELETE /notifications/:id ─────────────────────────────────
const deleteNotification = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const notification = await Notification.findOne({
      where: { id, userId }
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    await notification.destroy();

    return res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    return res.status(500).json({ message: 'Failed to delete notification' });
  }
};

// ─── HELPER: Create Notification ───────────────────────────────
const createNotification = async (userId, data) => {
  try {
    const notification = await Notification.create({
      userId,
      memberId: data.memberId || null,
      type: data.type,
      title: data.title,
      message: data.message,
      relatedLoanId: data.relatedLoanId || null,
      relatedGuarantorId: data.relatedGuarantorId || null,
    });

    // console.log(`Notification created for user ${userId}: ${data.title}`);
    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    throw error;
  }
};

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
};