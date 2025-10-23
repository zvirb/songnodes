/**
 * Toast Component - Notification System using Sonner
 *
 * Frictionless UX Principles:
 * - Non-intrusive notifications (bottom-right placement)
 * - Auto-dismiss prevents notification buildup
 * - Action buttons enable quick responses
 * - Promise API provides elegant async feedback
 * - Accessibility through ARIA live regions
 *
 * Usage Patterns:
 * - Success: Confirm completed actions
 * - Error: Alert users to problems
 * - Warning: Highlight important information
 * - Info: Provide contextual information
 * - Promise: Track async operation progress
 */

import * as React from 'react';
import { Toaster as Sonner, toast as sonnerToast } from 'sonner';

/**
 * Toast configuration for consistent theming
 */
export interface ToastConfig {
  /** Unique ID for the toast (optional) */
  id?: string | number;

  /** Toast title */
  title?: string;

  /** Toast description/message */
  description?: string;

  /** Duration in milliseconds (default: 4000) */
  duration?: number;

  /** Action button configuration */
  action?: {
    label: string;
    onClick: () => void;
  };

  /** Cancel button configuration */
  cancel?: {
    label: string;
    onClick?: () => void;
  };

  /** Callback when toast is dismissed */
  onDismiss?: () => void;

  /** Callback when toast auto-closes */
  onAutoClose?: () => void;

  /** Important toasts won't auto-dismiss */
  important?: boolean;

  /** Close button */
  closeButton?: boolean;
}

/**
 * Toaster Component
 *
 * Must be rendered once in your app root (e.g., App.tsx or _app.tsx)
 *
 * @example
 * // In App.tsx
 * import { Toaster } from './components/ui/Toast';
 *
 * function App() {
 *   return (
 *     <>
 *       <YourApp />
 *       <Toaster />
 *     </>
 *   );
 * }
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: [
            'group toast',
            'group-[.toaster]:bg-[var(--color-modal-bg)]',
            'group-[.toaster]:text-[var(--color-text-primary)]',
            'group-[.toaster]:border-[var(--color-border-default)]',
            'group-[.toaster]:shadow-[var(--shadow-lg)]',
            'group-[.toaster]:rounded-[var(--radius-lg)]',
          ].join(' '),
          description: 'group-[.toast]:text-[var(--color-text-secondary)]',
          actionButton: [
            'group-[.toast]:bg-[var(--color-brand-primary)]',
            'group-[.toast]:text-[var(--color-text-inverse)]',
          ].join(' '),
          cancelButton: [
            'group-[.toast]:bg-[var(--color-bg-elevated-3)]',
            'group-[.toast]:text-[var(--color-text-primary)]',
          ].join(' '),
          closeButton: [
            'group-[.toast]:bg-[var(--color-bg-elevated-2)]',
            'group-[.toast]:text-[var(--color-text-secondary)]',
            'group-[.toast]:border-[var(--color-border-default)]',
          ].join(' '),
        },
      }}
      expand={false}
      richColors
      closeButton
      duration={4000}
      visibleToasts={3}
      pauseWhenPageIsHidden
    />
  );
}

/**
 * Toast API - Wrapper around Sonner for type safety and consistency
 *
 * @example
 * // Success toast
 * toast.success('Track saved successfully!');
 *
 * @example
 * // Error toast
 * toast.error('Failed to delete track', {
 *   description: 'Please try again later',
 * });
 *
 * @example
 * // Toast with action
 * toast('Track deleted', {
 *   action: {
 *     label: 'Undo',
 *     onClick: () => restoreTrack(),
 *   },
 * });
 *
 * @example
 * // Promise toast (tracks async operations)
 * toast.promise(
 *   saveTrackMetadata(trackId, data),
 *   {
 *     loading: 'Saving track...',
 *     success: 'Track saved!',
 *     error: (err) => `Error: ${err.message}`,
 *   }
 * );
 */
export const toast = {
  /**
   * Default toast
   */
  default: (message: string, config?: ToastConfig) => {
    return sonnerToast(message, {
      ...config,
      duration: config?.important ? Infinity : config?.duration,
    });
  },

  /**
   * Success toast - Green theme
   */
  success: (message: string, config?: ToastConfig) => {
    return sonnerToast.success(message, {
      ...config,
      duration: config?.important ? Infinity : config?.duration,
    });
  },

  /**
   * Error toast - Red theme
   */
  error: (message: string, config?: ToastConfig) => {
    return sonnerToast.error(message, {
      ...config,
      duration: config?.important ? Infinity : config?.duration,
    });
  },

  /**
   * Warning toast - Yellow theme
   */
  warning: (message: string, config?: ToastConfig) => {
    return sonnerToast.warning(message, {
      ...config,
      duration: config?.important ? Infinity : config?.duration,
    });
  },

  /**
   * Info toast - Blue theme
   */
  info: (message: string, config?: ToastConfig) => {
    return sonnerToast.info(message, {
      ...config,
      duration: config?.important ? Infinity : config?.duration,
    });
  },

  /**
   * Loading toast - Shows spinner
   */
  loading: (message: string, config?: ToastConfig) => {
    return sonnerToast.loading(message, config);
  },

  /**
   * Promise toast - Tracks async operation state
   *
   * Automatically updates toast from loading → success/error
   *
   * @example
   * toast.promise(
   *   fetchData(),
   *   {
   *     loading: 'Loading data...',
   *     success: (data) => `Loaded ${data.length} items`,
   *     error: (err) => `Failed: ${err.message}`,
   *   }
   * );
   */
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    }
  ) => {
    return sonnerToast.promise(promise, messages);
  },

  /**
   * Dismiss a specific toast by ID
   */
  dismiss: (id?: string | number) => {
    sonnerToast.dismiss(id);
  },

  /**
   * Dismiss all toasts
   */
  dismissAll: () => {
    sonnerToast.dismiss();
  },
};

/**
 * Custom hook for toast notifications
 *
 * @example
 * const { showSuccess, showError } = useToast();
 *
 * const handleSave = async () => {
 *   try {
 *     await saveData();
 *     showSuccess('Data saved successfully!');
 *   } catch (err) {
 *     showError('Failed to save data');
 *   }
 * };
 */
export function useToast() {
  return {
    toast: toast.default,
    success: toast.success,
    error: toast.error,
    warning: toast.warning,
    info: toast.info,
    loading: toast.loading,
    promise: toast.promise,
    dismiss: toast.dismiss,
    dismissAll: toast.dismissAll,
  };
}
