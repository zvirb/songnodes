/**
 * Modal/Dialog Component - Radix UI Dialog Primitive
 *
 * Frictionless UX Principles:
 * - Focus trap prevents navigation confusion
 * - Escape key provides consistent exit pattern
 * - Portal rendering prevents z-index conflicts
 * - Backdrop click to close (with override option)
 * - Return focus to trigger on close
 *
 * Accessibility (WCAG 2.2 AA):
 * - role="dialog" with aria-labelledby
 * - Focus management (trap + restoration)
 * - Keyboard navigation (Tab, Esc)
 * - Screen reader announcements
 */

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

/**
 * Root Modal component - Manages open state
 *
 * @example
 * <Modal open={isOpen} onOpenChange={setIsOpen}>
 *   <Modal.Trigger>Open</Modal.Trigger>
 *   <Modal.Content>...</Modal.Content>
 * </Modal>
 */
const Modal = DialogPrimitive.Root;

/**
 * Modal trigger - Button that opens the modal
 */
const ModalTrigger = DialogPrimitive.Trigger;

/**
 * Modal close button - Programmatically close modal
 */
const ModalClose = DialogPrimitive.Close;

/**
 * Portal component for rendering modal outside DOM hierarchy
 */
const ModalPortal = DialogPrimitive.Portal;

/**
 * Modal overlay/backdrop component with Progressive Blur
 * 2025 Design Trend: Progressive blur increases from edges to center
 *
 * Cognitive Load Reduction:
 * - Dark overlay focuses attention on modal content
 * - Prevents interaction with background content
 * - Click-to-close provides intuitive exit
 * - Progressive blur creates depth perception
 */
const ModalOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-[var(--z-modal-backdrop)]',
      'data-[state=open]:animate-in data-[state=open]:fade-in-0',
      'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
      className
    )}
    style={{
      background: 'radial-gradient(circle, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.9) 100%)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    }}
    {...props}
  />
));
ModalOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * Size variants for modal content
 */
type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const modalSizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-[var(--modal-width-sm)]',
  md: 'max-w-[var(--modal-width-base)]',
  lg: 'max-w-[var(--modal-width-lg)]',
  xl: 'max-w-[var(--modal-width-xl)]',
  full: 'max-w-[90vw]',
};

/**
 * Position variants for modal placement
 */
type ModalPosition = 'center' | 'top' | 'bottom';

const modalPositionClasses: Record<ModalPosition, string> = {
  center: 'items-center',
  top: 'items-start pt-[10vh]',
  bottom: 'items-end pb-[10vh]',
};

export interface ModalContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /**
   * Size of the modal
   * @default 'md'
   */
  size?: ModalSize;

  /**
   * Position of the modal
   * @default 'center'
   */
  position?: ModalPosition;

  /**
   * Whether to show the close button
   * @default true
   */
  showClose?: boolean;

  /**
   * Prevent closing on backdrop click
   * @default false
   */
  preventBackdropClose?: boolean;
}

/**
 * Modal content component
 *
 * Contains the actual modal content with proper ARIA attributes
 *
 * @example
 * <ModalContent size="lg" position="center">
 *   <ModalHeader>
 *     <ModalTitle>Edit Track</ModalTitle>
 *     <ModalDescription>Make changes to track metadata</ModalDescription>
 *   </ModalHeader>
 *   <ModalBody>{children}</ModalBody>
 *   <ModalFooter>
 *     <Button onClick={handleSave}>Save</Button>
 *   </ModalFooter>
 * </ModalContent>
 */
const ModalContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  ModalContentProps
>(
  (
    {
      className,
      children,
      size = 'md',
      position = 'center',
      showClose = true,
      preventBackdropClose = false,
      ...props
    },
    ref
  ) => (
    <ModalPortal>
      <ModalOverlay onClick={preventBackdropClose ? (e) => e.preventDefault() : undefined} />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed left-[50%] translate-x-[-50%] z-[var(--z-modal)]',
          'w-full',
          modalSizeClasses[size],
          'flex flex-col',
          'max-h-[85vh]',
          'gap-4 p-6',
          'rounded-[var(--radius-modal)]',
          'shadow-[var(--shadow-modal)]',
          'focus:outline-none',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0',
          'data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-2',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          'data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-bottom-2',
          // Glass morphism effect (2025 Design Trend)
          'relative overflow-hidden',
          className
        )}
        style={{
          background: 'linear-gradient(135deg, rgba(26, 26, 26, 0.98) 0%, rgba(26, 26, 26, 0.85) 100%)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        {...props}
      >
        {children}

        {/* Close button */}
        {showClose && (
          <DialogPrimitive.Close
            className={cn(
              'absolute right-4 top-4',
              'rounded-sm opacity-70',
              'ring-offset-background transition-opacity',
              'hover:opacity-100',
              'focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)] focus:ring-offset-2',
              'disabled:pointer-events-none'
            )}
            aria-label="Close modal"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 15 15"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
            >
              <path
                d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
                fill="currentColor"
                fillRule="evenodd"
                clipRule="evenodd"
              />
            </svg>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </ModalPortal>
  )
);
ModalContent.displayName = DialogPrimitive.Content.displayName;

/**
 * Modal header - Contains title and description
 */
const ModalHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 text-left',
      'pr-8', // Space for close button
      className
    )}
    {...props}
  />
);
ModalHeader.displayName = 'ModalHeader';

/**
 * Modal body - Scrollable content area
 */
const ModalBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex-1 overflow-y-auto',
      'custom-scrollbar', // From global.css
      className
    )}
    {...props}
  />
);
ModalBody.displayName = 'ModalBody';

/**
 * Modal footer - Action buttons area
 */
const ModalFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      'gap-2',
      className
    )}
    {...props}
  />
);
ModalFooter.displayName = 'ModalFooter';

/**
 * Modal title - Accessible heading
 */
const ModalTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-[var(--font-size-2xl)] font-semibold leading-none tracking-tight',
      'text-[var(--color-text-primary)]',
      className
    )}
    {...props}
  />
));
ModalTitle.displayName = DialogPrimitive.Title.displayName;

/**
 * Modal description - Accessible description
 */
const ModalDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn(
      'text-[var(--font-size-sm)] text-[var(--color-text-secondary)]',
      className
    )}
    {...props}
  />
));
ModalDescription.displayName = DialogPrimitive.Description.displayName;

// Export compound components
export {
  Modal,
  ModalPortal,
  ModalOverlay,
  ModalTrigger,
  ModalClose,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalTitle,
  ModalDescription,
};
