/**
 * Badge Component - Status Indicators
 *
 * Frictionless UX Principles:
 * - Color-coded for instant recognition (Hick's Law - reduce choice time)
 * - Small, non-intrusive design
 * - Consistent positioning and sizing
 * - Optional icon support for enhanced meaning
 *
 * Use Cases:
 * - Status indicators (active, inactive, pending)
 * - Counts and notifications
 * - Labels and categories
 * - Feature flags
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  [
    'inline-flex items-center gap-1',
    'rounded-[var(--radius-badge)]',
    'border',
    'px-2 py-0.5',
    'text-xs font-semibold',
    'transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
  ].join(' '),
  {
    variants: {
      variant: {
        default: [
          'border-transparent',
          'bg-[var(--color-brand-primary-muted)]',
          'text-[var(--color-brand-primary)]',
        ].join(' '),
        secondary: [
          'border-transparent',
          'bg-[var(--color-bg-elevated-3)]',
          'text-[var(--color-text-secondary)]',
        ].join(' '),
        success: [
          'border-transparent',
          'bg-[var(--color-success-bg)]',
          'text-[var(--color-success)]',
          'border-[var(--color-success-border)]',
        ].join(' '),
        warning: [
          'border-transparent',
          'bg-[var(--color-warning-bg)]',
          'text-[var(--color-warning)]',
          'border-[var(--color-warning-border)]',
        ].join(' '),
        error: [
          'border-transparent',
          'bg-[var(--color-error-bg)]',
          'text-[var(--color-error)]',
          'border-[var(--color-error-border)]',
        ].join(' '),
        outline: [
          'border-[var(--color-border-default)]',
          'text-[var(--color-text-primary)]',
        ].join(' '),
      },
      size: {
        sm: 'text-[10px] px-1.5 py-0.5',
        md: 'text-xs px-2 py-0.5',
        lg: 'text-sm px-2.5 py-1',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** Icon to display before the badge text */
  icon?: React.ReactNode;

  /** Show a dot indicator before text */
  showDot?: boolean;
}

/**
 * Badge Component
 *
 * Status indicator with color variants
 *
 * @example
 * // Status badge
 * <Badge variant="success">Active</Badge>
 *
 * @example
 * // Count badge
 * <Badge variant="error">3</Badge>
 *
 * @example
 * // Badge with icon
 * <Badge variant="warning" icon={<AlertIcon />}>
 *   Warning
 * </Badge>
 *
 * @example
 * // Badge with dot indicator
 * <Badge showDot variant="success">
 *   Online
 * </Badge>
 */
const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  (
    {
      className,
      variant,
      size,
      icon,
      showDot,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant, size }), className)}
        {...props}
      >
        {/* Dot indicator */}
        {showDot && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-current"
            aria-hidden="true"
          />
        )}

        {/* Icon */}
        {icon && (
          <span className="shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}

        {/* Text content */}
        {children}
      </div>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge, badgeVariants };
