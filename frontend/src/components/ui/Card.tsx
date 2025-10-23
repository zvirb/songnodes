/**
 * Card Component - Content Container
 *
 * Frictionless UX Principles:
 * - Clear visual hierarchy through compound components
 * - Hover states for interactive cards
 * - Elevation system for depth perception
 * - Responsive spacing and layout
 *
 * Compound Components Pattern:
 * - Card (root)
 * - CardHeader
 * - CardContent
 * - CardFooter
 *
 * Mental Model Alignment:
 * Users understand cards as contained, actionable units of information
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const cardVariants = cva(
  [
    'rounded-[var(--radius-card)]',
    'bg-[var(--color-card-bg)]',
    'text-[var(--color-text-primary)]',
    'shadow-[var(--shadow-card)]',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'border border-[var(--color-card-border)]',
        elevated: 'shadow-[var(--shadow-md)]',
        outlined: 'border-2 border-[var(--color-border-strong)]',
      },
      interactive: {
        true: [
          'cursor-pointer transition-all',
          'hover:bg-[var(--color-card-hover)]',
          'hover:shadow-[var(--shadow-card-hover)]',
          'active:scale-[0.98]',
        ].join(' '),
        false: '',
      },
      selected: {
        true: 'ring-2 ring-[var(--color-brand-primary)] ring-offset-2',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      interactive: false,
      selected: false,
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

/**
 * Card Component
 *
 * Container for related content with optional interactivity
 *
 * @example
 * // Basic card
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Track Details</CardTitle>
 *     <CardDescription>Metadata and analysis</CardDescription>
 *   </CardHeader>
 *   <CardContent>
 *     <p>Content here</p>
 *   </CardContent>
 *   <CardFooter>
 *     <Button>Action</Button>
 *   </CardFooter>
 * </Card>
 *
 * @example
 * // Interactive card
 * <Card interactive onClick={handleClick}>
 *   <CardContent>Clickable content</CardContent>
 * </Card>
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, interactive, selected, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        cardVariants({ variant, interactive, selected }),
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

/**
 * Card Header - Top section with title and description
 */
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

/**
 * Card Title - Primary heading
 */
const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-[var(--font-size-xl)] font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

/**
 * Card Description - Secondary text
 */
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      'text-[var(--font-size-sm)] text-[var(--color-text-secondary)]',
      className
    )}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

/**
 * Card Content - Main content area
 */
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('p-6 pt-0', className)}
    {...props}
  />
));
CardContent.displayName = 'CardContent';

/**
 * Card Footer - Bottom section with actions
 */
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  cardVariants,
};
