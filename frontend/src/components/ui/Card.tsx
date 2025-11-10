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
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
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
    VariantProps<typeof cardVariants> {
  /**
   * Enable 3D hover effect (2025 Design Trend)
   * @default false
   */
  enable3D?: boolean;
}

/**
 * 3D Card Component with Tilt Effect
 * 2025 Design Trend: 3D Interactive Elements
 */
const Card3D = React.forwardRef<HTMLDivElement, Omit<CardProps, 'enable3D'>>(
  ({ className, variant, interactive, selected, onMouseMove, onMouseLeave, style, ...props }, ref) => {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
    const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ['5deg', '-5deg']);
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ['-5deg', '5deg']);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const xPct = mouseX / width - 0.5;
      const yPct = mouseY / height - 0.5;

      x.set(xPct);
      y.set(yPct);

      onMouseMove?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      x.set(0);
      y.set(0);
      onMouseLeave?.(e);
    };

    return (
      <motion.div
        ref={ref}
        className={cn(
          cardVariants({ variant, interactive, selected }),
          className
        )}
        style={{
          ...style,
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        whileHover={{
          scale: 1.05,
          boxShadow: 'var(--shadow-xl)',
          transition: { duration: 0.2 },
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
        }}
        {...props}
      />
    );
  }
);
Card3D.displayName = 'Card3D';

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
 *
 * @example
 * // 3D Card with tilt effect
 * <Card enable3D interactive>
 *   <CardContent>Hover me for 3D effect!</CardContent>
 * </Card>
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, interactive, selected, enable3D = false, ...props }, ref) => {
    // Check if user prefers reduced motion
    const prefersReducedMotion = typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

    // Use 3D card if enabled and user doesn't prefer reduced motion
    if (enable3D && !prefersReducedMotion) {
      return (
        <Card3D
          ref={ref}
          className={className}
          variant={variant}
          interactive={interactive}
          selected={selected}
          {...props}
        />
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          cardVariants({ variant, interactive, selected }),
          className
        )}
        {...props}
      />
    );
  }
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
