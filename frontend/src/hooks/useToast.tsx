import React, { useState, useCallback } from 'react';
import { SnIcon } from '../lib/songnodes';

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
  if (toasts.length === 0) return null;

  return (
    <div className="sn-toast__region" role="status" aria-live="polite" aria-label="Notifications" id="toasts">
      {toasts.map(toast => {
        const iconName = toast.type === 'success' ? 'circle-check' : toast.type === 'error' ? 'x-circle' : toast.type === 'warning' ? 'triangle-alert' : 'info';
        return (
          <div key={toast.id} className="sn-toast" onClick={() => onClose && onClose(toast.id)}>
            <span className="sn-toast__icon">
               <SnIcon name={iconName} />
            </span>
            <span className="sn-toast__text">{toast.message}</span>
            <button className="sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet sn-toast__close" aria-label="Dismiss notification">
               <SnIcon name="x" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
