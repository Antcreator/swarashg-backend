import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsAPI } from '../../Service/Api';
import { useToast, useConfirm, ToastContainer } from '../../useToast';
import './NotificationBell.css';
import {
  Bell, User, CheckCircle, Building2, XCircle, Mail,
  CheckCheck, Trash2, BellOff, Loader,
} from 'lucide-react';

// ── Route map: notification type → path ──────────────────────────
const NOTIFICATION_ROUTES = {
  guarantor_request:        '/member/guarantor-requests',
  guarantor_response:       '/member/my-loans',
  office_guarantor_request: '/admin/office-guarantor-requests',
  loan_approved:            '/member/my-loans',
  loan_rejected:            '/member/my-loans',
};

const DEFAULT_ROUTE = '/member/my-loans';

// Detect if the device is touch/mobile
const isMobile = () => window.innerWidth <= 480;

const NotificationBell = () => {
  const navigate    = useNavigate();
  const { toasts, toast, dismiss } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [showDropdown, setShowDropdown]   = useState(false);
  const [loading, setLoading]             = useState(false);
  const [deletingId, setDeletingId]       = useState(null);
  const [mobile, setMobile]               = useState(isMobile());

  const dropdownRef = useRef(null);

  // Track viewport changes
  useEffect(() => {
    const onResize = () => setMobile(isMobile());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Poll unread count every 30s ──
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Close on outside click (desktop only) ──
  useEffect(() => {
    if (mobile) return; // mobile uses backdrop overlay instead
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDropdown, mobile]);

  // ── Prevent body scroll when dropdown open on mobile ──
  useEffect(() => {
    if (mobile && showDropdown) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobile, showDropdown]);

  const fetchUnreadCount = async () => {
    try {
      const res = await notificationsAPI.getUnreadCount();
      setUnreadCount(res.data.unreadCount);
    } catch { /* silent */ }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationsAPI.getAll();
      setNotifications(res.data.notifications);
    } catch {
      toast.error('Failed to load', 'Could not fetch your notifications.');
    } finally {
      setLoading(false);
    }
  };

  const handleBellClick = () => {
    const next = !showDropdown;
    setShowDropdown(next);
    if (next) fetchNotifications();
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      try {
        await notificationsAPI.markAsRead(notification.id);
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
        );
        setUnreadCount(c => Math.max(0, c - 1));
      } catch { /* silent */ }
    }
    setShowDropdown(false);
    const route = NOTIFICATION_ROUTES[notification.type] ?? DEFAULT_ROUTE;
    navigate(route);
  };

  const handleDeleteNotification = async (e, notification) => {
    e.stopPropagation();

    const ok = await confirm({
      title:        'Delete Notification',
      message:      'Remove this notification? This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel:  'Keep',
      variant:      'danger',
    });
    if (!ok) return;

    setDeletingId(notification.id);
    try {
      await notificationsAPI.deleteNotification(notification.id);
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
      if (!notification.isRead) setUnreadCount(c => Math.max(0, c - 1));
      toast.success('Removed', 'Notification deleted.');
    } catch {
      toast.error('Error', 'Failed to delete notification.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All caught up', 'All notifications marked as read.');
    } catch {
      toast.error('Error', 'Failed to mark notifications as read.');
    }
  };

  const handleClearAll = async () => {
    if (!notifications.length) return;

    const ok = await confirm({
      title:        'Clear All Notifications',
      message:      `This will permanently delete all ${notifications.length} notification${notifications.length !== 1 ? 's' : ''}. Continue?`,
      confirmLabel: 'Clear All',
      cancelLabel:  'Cancel',
      variant:      'danger',
    });
    if (!ok) return;

    try {
      await Promise.all(notifications.map(n => notificationsAPI.deleteNotification(n.id)));
      setNotifications([]);
      setUnreadCount(0);
      toast.success('Cleared', 'All notifications have been removed.');
    } catch {
      toast.error('Error', 'Could not clear all notifications.');
    }
  };

  // ── Icon per notification type ──
  const getIcon = (type) => {
    const map = {
      guarantor_request:        { el: <User size={15} />,          bg: '#eff6ff', color: '#2563eb' },
      guarantor_response:       { el: <CheckCircle size={15} />,   bg: '#ecfdf5', color: '#059669' },
      office_guarantor_request: { el: <Building2 size={15} />,     bg: '#f5f3ff', color: '#7c3aed' },
      loan_approved:            { el: <CheckCircle size={15} />,   bg: '#ecfdf5', color: '#059669' },
      loan_rejected:            { el: <XCircle size={15} />,       bg: '#fef2f2', color: '#dc2626' },
    };
    const def = { el: <Mail size={15} />, bg: '#f8fafc', color: '#64748b' };
    return map[type] || def;
  };

  const formatTimeAgo = (dateString) => {
    const seconds = Math.floor((Date.now() - new Date(dateString)) / 1000);
    if (seconds < 60)     return 'Just now';
    if (seconds < 3600)   return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400)  return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  const unread = notifications.filter(n => !n.isRead);
  const read   = notifications.filter(n => n.isRead);

  return (
    <>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <ConfirmDialog />

      {/* Mobile backdrop */}
      {mobile && showDropdown && (
        <div
          onClick={() => setShowDropdown(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 9998,
            animation: 'nb-fade-in 0.2s ease',
          }}
        />
      )}

      <div className="nb-root" ref={dropdownRef}>
        {/* ── Bell button ── */}
        <button
          className={`nb-bell ${showDropdown ? 'nb-bell--active' : ''}`}
          onClick={handleBellClick}
          aria-label="Notifications"
          aria-expanded={showDropdown}
        >
          <Bell size={20} strokeWidth={1.8} />
          {unreadCount > 0 && (
            <span className="nb-badge" aria-label={`${unreadCount} unread`}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* ── Dropdown ── */}
        {showDropdown && (
          <div className="nb-dropdown" role="dialog" aria-label="Notifications panel">

            {/* Header */}
            <div className="nb-head">
              <div className="nb-head-left">
                <span className="nb-head-title">Notifications</span>
                {unreadCount > 0 && (
                  <span className="nb-head-count">{unreadCount} new</span>
                )}
              </div>
              <div className="nb-head-actions">
                {unreadCount > 0 && (
                  <button className="nb-action-btn" onClick={handleMarkAllAsRead} title="Mark all as read">
                    <CheckCheck size={14} strokeWidth={2} />
                    <span>Mark all read</span>
                  </button>
                )}
                {notifications.length > 0 && (
                  <button className="nb-action-btn nb-action-btn--danger" onClick={handleClearAll} title="Clear all">
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                )}
                {/* Mobile close button in header */}
                {mobile && (
                  <button
                    className="nb-action-btn"
                    onClick={() => setShowDropdown(false)}
                    title="Close"
                    style={{ marginLeft: 2 }}
                  >
                    <XCircle size={14} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="nb-body">
              {loading ? (
                <div className="nb-state">
                  <Loader size={22} className="nb-spin" strokeWidth={1.5} />
                  <p>Loading notifications…</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="nb-state">
                  <BellOff size={30} strokeWidth={1.3} />
                  <p>You're all caught up</p>
                  <span>No notifications right now</span>
                </div>
              ) : (
                <>
                  {/* Unread group */}
                  {unread.length > 0 && (
                    <div className="nb-group">
                      <div className="nb-group-label">New</div>
                      {unread.map((n, i) => (
                        <NotificationItem
                          key={n.id}
                          notification={n}
                          icon={getIcon(n.type)}
                          timeAgo={formatTimeAgo(n.created_at)}
                          isDeleting={deletingId === n.id}
                          onClick={() => handleNotificationClick(n)}
                          onDelete={(e) => handleDeleteNotification(e, n)}
                          animDelay={i * 0.04}
                        />
                      ))}
                    </div>
                  )}

                  {/* Read group */}
                  {read.length > 0 && (
                    <div className="nb-group">
                      {unread.length > 0 && <div className="nb-group-label">Earlier</div>}
                      {read.map((n, i) => (
                        <NotificationItem
                          key={n.id}
                          notification={n}
                          icon={getIcon(n.type)}
                          timeAgo={formatTimeAgo(n.created_at)}
                          isDeleting={deletingId === n.id}
                          onClick={() => handleNotificationClick(n)}
                          onDelete={(e) => handleDeleteNotification(e, n)}
                          animDelay={(unread.length + i) * 0.04}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="nb-foot">
                <span>{notifications.length} notification{notifications.length !== 1 ? 's' : ''}</span>
                <button className="nb-close-btn" onClick={() => setShowDropdown(false)}>Close</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fade-in keyframe for backdrop */}
      <style>{`@keyframes nb-fade-in { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </>
  );
};

// ─────────────────────────────────────────────
//  Single notification row
// ─────────────────────────────────────────────
const NotificationItem = ({ notification, icon, timeAgo, isDeleting, onClick, onDelete, animDelay }) => (
  <div
    className={`nb-item ${notification.isRead ? 'nb-item--read' : 'nb-item--unread'} ${isDeleting ? 'nb-item--deleting' : ''}`}
    style={{ animationDelay: `${animDelay}s` }}
    onClick={onClick}
    role="button"
    tabIndex={0}
    onKeyDown={e => e.key === 'Enter' && onClick()}
  >
    {/* Unread dot */}
    {!notification.isRead && <div className="nb-dot" aria-label="Unread" />}

    {/* Icon */}
    <div
      className="nb-item-icon"
      style={{ background: icon.bg, color: icon.color }}
    >
      {icon.el}
    </div>

    {/* Content */}
    <div className="nb-item-body">
      <p className="nb-item-title">{notification.title}</p>
      <p className="nb-item-msg">{notification.message}</p>
      <span className="nb-item-time">{timeAgo}</span>
    </div>

    {/* Delete button */}
    <button
      className="nb-delete-btn"
      onClick={onDelete}
      title="Delete"
      aria-label="Delete notification"
      disabled={isDeleting}
    >
      {isDeleting
        ? <Loader size={13} className="nb-spin" strokeWidth={2} />
        : <Trash2 size={13} strokeWidth={2} />
      }
    </button>
  </div>
);

export default NotificationBell;