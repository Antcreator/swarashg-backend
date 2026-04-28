import React, { useState, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X, HelpCircle } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────
// useToast — lightweight toast notification hook
// ─────────────────────────────────────────────────────────────────
export const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }, 300);
  }, []);

  const toast = useCallback(({ type = 'info', title, message, duration = 4000 }) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, type, title, message, duration }]);
    timers.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  toast.success = (title, message, opts) => toast({ type: 'success', title, message, ...opts });
  toast.error   = (title, message, opts) => toast({ type: 'error',   title, message, ...opts });
  toast.warning = (title, message, opts) => toast({ type: 'warning', title, message, ...opts });
  toast.info    = (title, message, opts) => toast({ type: 'info',    title, message, ...opts });

  return { toasts, toast, dismiss };
};

// ─────────────────────────────────────────────────────────────────
// useConfirm — replaces window.confirm() with a styled dialog
// Usage:
//   const { confirmDialog, confirm } = useConfirm();
//   // render <ConfirmDialog /> somewhere in the tree
//   const ok = await confirm({ title, message, confirmLabel, variant })
// ─────────────────────────────────────────────────────────────────
export const useConfirm = () => {
  const [dialog, setDialog] = useState(null); // { title, message, confirmLabel, variant, resolve }

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setDialog({ ...options, resolve });
    });
  }, []);

  const handleClose = useCallback((result) => {
    setDialog(prev => {
      if (prev?.resolve) prev.resolve(result);
      return null;
    });
  }, []);

  const ConfirmDialog = useCallback(() => {
    if (!dialog) return null;
    const { title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'default' } = dialog;

    const variantStyles = {
      danger:   { accent: '#ef4444', iconBg: 'rgba(239,68,68,0.12)',   Icon: AlertTriangle },
      warning:  { accent: '#f59e0b', iconBg: 'rgba(245,158,11,0.12)',  Icon: AlertTriangle },
      default:  { accent: '#6366f1', iconBg: 'rgba(99,102,241,0.12)',  Icon: HelpCircle    },
    };
    const { accent, iconBg, Icon } = variantStyles[variant] || variantStyles.default;

    return (
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px', animation: 'overlayIn 0.18s ease',
        }}
        onClick={() => handleClose(false)}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
            maxWidth: '420px', width: '100%',
            padding: '28px 28px 24px',
            animation: 'modalUp 0.28s cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          {/* Icon + Title */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
            <div style={{
              flexShrink: 0, width: '40px', height: '40px', borderRadius: '10px',
              background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={20} color={accent} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {title && (
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '6px', lineHeight: 1.3 }}>
                  {title}
                </div>
              )}
              {message && (
                <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                  {message}
                </div>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              onClick={() => handleClose(false)}
              style={{
                padding: '9px 18px', borderRadius: '8px', fontSize: '14px',
                fontWeight: 600, cursor: 'pointer', border: '1.5px solid #e5e7eb',
                background: 'white', color: '#374151',
                transition: 'all 0.15s ease',
              }}
              onMouseOver={e => e.currentTarget.style.background = '#f9fafb'}
              onMouseOut={e  => e.currentTarget.style.background = 'white'}
            >
              {cancelLabel}
            </button>
            <button
              onClick={() => handleClose(true)}
              style={{
                padding: '9px 20px', borderRadius: '8px', fontSize: '14px',
                fontWeight: 700, cursor: 'pointer', border: 'none',
                background: accent, color: 'white',
                boxShadow: `0 2px 8px ${accent}55`,
                transition: 'all 0.15s ease',
              }}
              onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseOut={e  => { e.currentTarget.style.filter = 'none';            e.currentTarget.style.transform = 'none'; }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }, [dialog, handleClose]);

  return { confirm, ConfirmDialog };
};

// ─────────────────────────────────────────────────────────────────
// Icons per toast type
// ─────────────────────────────────────────────────────────────────
const TYPE_ICON = {
  success: <CheckCircle   size={16} />,
  error:   <XCircle       size={16} />,
  warning: <AlertTriangle size={16} />,
  info:    <Info          size={16} />,
};

// ─────────────────────────────────────────────────────────────────
// ToastContainer — render this once near the top of your component
// ─────────────────────────────────────────────────────────────────
export const ToastContainer = ({ toasts, dismiss }) => {
  if (!toasts.length) return null;
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast toast-${t.type}${t.exiting ? ' toast-exit' : ''}`}
          style={{ '--toast-duration': `${t.duration}ms` }}
          role="alert"
          aria-live="polite"
        >
          <div className="toast-icon-wrap">{TYPE_ICON[t.type]}</div>
          <div className="toast-body">
            {t.title   && <div className="toast-title">{t.title}</div>}
            {t.message && <div className="toast-message">{t.message}</div>}
          </div>
          <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <X size={14} />
          </button>
          <div className="toast-progress" />
        </div>
      ))}
    </div>
  );
};