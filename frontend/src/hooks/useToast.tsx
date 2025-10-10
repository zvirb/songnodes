import React, { useState, useCallback } from 'react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((
    message: string,
    type: Toast['type'] = 'success',
    duration: number = 3000
  ) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const toast: Toast = { id, message, type, duration };

    setToasts(prev => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    showToast,
    hideToast,
    clearAllToasts
  };
};

interface ToastContainerProps {
  toasts: Toast[];
  onClose?: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onClose,
  position = 'bottom-right'
}) => {
  const getPositionStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'fixed',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      pointerEvents: 'none'
    };

    switch (position) {
      case 'top-right':
        return { ...base, top: '20px', right: '20px' };
      case 'top-left':
        return { ...base, top: '20px', left: '20px' };
      case 'bottom-right':
        return { ...base, bottom: '20px', right: '20px' };
      case 'bottom-left':
        return { ...base, bottom: '20px', left: '20px' };
      case 'top-center':
        return { ...base, top: '20px', left: '50%', transform: 'translateX(-50%)' };
      case 'bottom-center':
        return { ...base, bottom: '20px', left: '50%', transform: 'translateX(-50%)' };
      default:
        return { ...base, bottom: '20px', right: '20px' };
    }
  };

  const getToastStyles = (type: Toast['type']): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      padding: '12px 16px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      fontSize: '14px',
      fontWeight: '500',
      minWidth: '280px',
      maxWidth: '400px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      pointerEvents: 'auto',
      cursor: 'pointer',
      animation: 'slideIn 0.2s ease-out',
      backdropFilter: 'blur(10px)'
    };

    switch (type) {
      case 'success':
        return {
          ...baseStyles,
          backgroundColor: 'rgba(16, 185, 129, 0.95)',
          color: 'white',
          border: '1px solid rgba(16, 185, 129, 1)'
        };
      case 'error':
        return {
          ...baseStyles,
          backgroundColor: 'rgba(239, 68, 68, 0.95)',
          color: 'white',
          border: '1px solid rgba(239, 68, 68, 1)'
        };
      case 'warning':
        return {
          ...baseStyles,
          backgroundColor: 'rgba(245, 158, 11, 0.95)',
          color: 'white',
          border: '1px solid rgba(245, 158, 11, 1)'
        };
      case 'info':
        return {
          ...baseStyles,
          backgroundColor: 'rgba(59, 130, 246, 0.95)',
          color: 'white',
          border: '1px solid rgba(59, 130, 246, 1)'
        };
      default:
        return baseStyles;
    }
  };

  const getIcon = (type: Toast['type']): string => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '';
    }
  };

  if (toasts.length === 0) return null;

  return (
    <>
      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}
      </style>
      <div style={getPositionStyles()}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={getToastStyles(toast.type)}
            onClick={() => onClose && onClose(toast.id)}
          >
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
              {getIcon(toast.type)}
            </span>
            <span style={{ flex: 1 }}>{toast.message}</span>
          </div>
        ))}
      </div>
    </>
  );
};
