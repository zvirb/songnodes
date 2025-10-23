/**
 * Button Component - Frictionless UI Foundation
 *
 * Design Principles:
 * - WCAG 2.2 AA Compliant (44x44px minimum touch target)
 * - Clear visual hierarchy through variants
 * - Loading states prevent duplicate submissions
 * - Keyboard shortcuts improve efficiency
 * - Icon support enhances scannability
 *
 * Cognitive Load Reduction:
 * - Consistent styling reduces decision fatigue
 * - Loading feedback prevents user confusion
 * - Disabled states are visually obvious
 * - Icon positioning follows F-pattern reading
 */

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

/**
 * Button variant configuration using class-variance-authority
 *
 * Variants based on Mental Model principles:
 * - primary: High-emphasis actions (save, submit, create)
 * - secondary: Medium-emphasis actions (cancel, back)
 * - ghost: Low-emphasis actions (close, dismiss)
 * - outline: Alternative to ghost for more definition
 * - link: Navigation actions that look like links
 */
const buttonVariants = cva(
  // Base styles - Applied to all variants
  [
    'inline-flex items-center justify-center gap-2',
    'font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    'select-none', // Prevent text selection on double-click
  ].join(' '),
  {
    variants: {
      variant: {
        primary: [
          'bg-[rgb(var(--color-brand-primary))] text-[rgb(var(--color-text-inverse))]',
          'hover:bg-[rgb(var(--color-brand-primary-hover))]',
          'active:bg-[rgb(var(--color-brand-primary-active))]',
          'shadow-[var(--shadow-button)] hover:shadow-[var(--shadow-button-hover)]',
          'focus-visible:ring-[rgb(var(--color-brand-primary))]',
        ].join(' '),
        secondary: [
          'bg-[rgb(var(--color-bg-elevated-2))] text-[rgb(var(--color-text-primary))]',
          'border border-[rgb(var(--color-border-default))]',
          'hover:bg-[rgb(var(--color-bg-elevated-3))]',
          'active:bg-[rgb(var(--color-bg-elevated-4))]',
          'focus-visible:ring-[rgb(var(--color-brand-primary))]',
        ].join(' '),
        ghost: [
          'text-[rgb(var(--color-text-primary))]',
          'hover:bg-[rgba(255,255,255,0.1)]',
          'active:bg-[rgba(255,255,255,0.15)]',
          'focus-visible:ring-[rgb(var(--color-brand-primary))]',
        ].join(' '),
        outline: [
          'border border-[rgb(var(--color-border-default))]',
          'text-[rgb(var(--color-text-primary))]',
          'hover:bg-[rgb(var(--color-bg-elevated-1))]',
          'hover:border-[rgb(var(--color-brand-primary))]',
          'focus-visible:ring-[rgb(var(--color-brand-primary))]',
        ].join(' '),
        link: [
          'text-[rgb(var(--color-brand-primary))]',
          'underline-offset-4',
          'hover:underline',
          'hover:text-[rgb(var(--color-brand-primary-hover))]',
          'focus-visible:ring-[rgb(var(--color-brand-primary))]',
        ].join(' '),
      },
      size: {
        xs: 'h-[var(--button-height-xs)] px-[var(--space-2)] text-xs rounded-[var(--radius-sm)]',
        sm: 'h-[var(--button-height-sm)] px-[var(--space-3)] text-sm rounded-[var(--radius-base)]',
        md: 'h-[var(--button-height-base)] px-[var(--space-4)] text-sm rounded-[var(--radius-base)]', // WCAG compliant
        lg: 'h-[var(--button-height-lg)] px-[var(--space-6)] text-base rounded-[var(--radius-md)]',
        xl: 'h-12 px-8 text-lg rounded-[var(--radius-lg)]',
        icon: 'h-[var(--button-height-base)] w-[var(--button-height-base)] rounded-[var(--radius-base)]', // Square icon button
      },
      fullWidth: {
        true: 'w-full',
        false: 'w-auto',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * Render as child component (Radix Slot pattern)
   * Useful for rendering as Link or other interactive elements
   */
  asChild?: boolean;

  /**
   * Show loading spinner and disable interactions
   * Prevents duplicate submissions and provides feedback
   */
  loading?: boolean;

  /**
   * Icon to display before the button text
   * Enhances scannability and visual hierarchy
   */
  leftIcon?: React.ReactNode;

  /**
   * Icon to display after the button text
   * Useful for dropdown indicators, arrows, etc.
   */
  rightIcon?: React.ReactNode;

  /**
   * Keyboard shortcut hint to display
   * Improves efficiency for power users
   * Example: "⌘S" or "Ctrl+S"
   */
  shortcut?: string;
}

/**
 * Loading spinner component
 * Provides visual feedback during async operations
 */
const Spinner = ({ className }: { className?: string }) => (
  <svg
    className={cn('animate-spin', className)}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

/**
 * Button Component
 *
 * A fully accessible, feature-rich button component that reduces
 * cognitive friction through clear states and consistent behavior.
 *
 * @example
 * // Primary action
 * <Button onClick={handleSave}>Save Changes</Button>
 *
 * @example
 * // Loading state
 * <Button loading onClick={handleSubmit}>Submit</Button>
 *
 * @example
 * // With icons
 * <Button leftIcon={<PlusIcon />} onClick={handleAdd}>
 *   Add Track
 * </Button>
 *
 * @example
 * // With keyboard shortcut
 * <Button shortcut="⌘S" onClick={handleSave}>
 *   Save
 * </Button>
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      asChild = false,
      loading = false,
      leftIcon,
      rightIcon,
      shortcut,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';

    // Disable button when loading or explicitly disabled
    const isDisabled = disabled || loading;

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading}
        aria-disabled={isDisabled}
        {...props}
      >
        {/* Loading spinner (replaces leftIcon when loading) */}
        {loading && <Spinner className="h-4 w-4" />}

        {/* Left icon (hidden during loading) */}
        {!loading && leftIcon && (
          <span className="shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        )}

        {/* Button text */}
        {children && <span className="truncate">{children}</span>}

        {/* Right icon */}
        {rightIcon && (
          <span className="shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}

        {/* Keyboard shortcut hint */}
        {shortcut && (
          <kbd
            className={cn(
              'ml-auto hidden text-xs opacity-60 sm:inline-flex',
              'rounded border border-current px-1 py-0.5',
              'font-mono'
            )}
            aria-label={`Keyboard shortcut: ${shortcut}`}
          >
            {shortcut}
          </kbd>
        )}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
