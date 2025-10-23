/**
 * Skeleton Component - Loading Placeholders
 *
 * Frictionless UX Principles:
 * - Reduces perceived load time through progressive disclosure
 * - Maintains layout stability (prevents layout shift)
 * - Provides visual feedback during async operations
 * - Accessibility through aria-busy and aria-live
 *
 * Usage:
 * - Use during initial data loading
 * - Match skeleton shape to actual content
 * - Avoid long loading states (> 3 seconds use spinner instead)
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const skeletonVariants = cva(
  [
    'animate-pulse',
    'bg-[var(--color-bg-elevated-2)]',
    'rounded-[var(--radius-base)]',
  ].join(' '),
  {
    variants: {
      variant: {
        text: 'h-4 w-full',
        circular: 'rounded-full',
        rectangular: 'rounded-[var(--radius-base)]',
        rounded: 'rounded-[var(--radius-lg)]',
      },
    },
    defaultVariants: {
      variant: 'text',
    },
  }
);

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  /** Width of the skeleton */
  width?: string | number;

  /** Height of the skeleton */
  height?: string | number;

  /** Disable animation (for reduced motion preference) */
  noAnimation?: boolean;
}

/**
 * Skeleton Component
 *
 * Loading placeholder that matches content layout
 *
 * @example
 * // Text skeleton
 * <Skeleton variant="text" width="80%" />
 *
 * @example
 * // Avatar skeleton
 * <Skeleton variant="circular" width={40} height={40} />
 *
 * @example
 * // Card skeleton
 * <Skeleton variant="rectangular" height={200} className="w-full" />
 */
const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      className,
      variant,
      width,
      height,
      noAnimation,
      style,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label="Loading..."
        className={cn(
          skeletonVariants({ variant }),
          noAnimation && 'animate-none',
          className
        )}
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
          ...style,
        }}
        {...props}
      >
        <span className="sr-only">Loading...</span>
      </div>
    );
  }
);

Skeleton.displayName = 'Skeleton';

export { Skeleton, skeletonVariants };
