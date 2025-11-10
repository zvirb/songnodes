/**
 * BentoGrid Layout Component
 * 2025 Design Trend: Modern, asymmetric dashboard cards
 *
 * Features:
 * - Responsive grid layout (mobile → tablet → desktop)
 * - Named grid areas for semantic layouts
 * - Flexible card sizing (span columns/rows)
 * - Glass morphism integration
 * - Framer Motion layout animations
 *
 * @example
 * <BentoGrid>
 *   <BentoCard gridArea="hero" rowSpan={2} colSpan={2}>
 *     <h1>Hero Content</h1>
 *   </BentoCard>
 *   <BentoCard>Quick Stats</BentoCard>
 *   <BentoCard>Chart</BentoCard>
 * </BentoGrid>
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Card } from '../ui/Card';

/**
 * BentoGrid Props
 */
export interface BentoGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Number of columns for desktop layout
   * @default 3
   */
  columns?: 2 | 3 | 4;

  /**
   * Gap between grid items
   * @default 'md'
   */
  gap?: 'sm' | 'md' | 'lg';

  /**
   * Enable layout animations
   * @default true
   */
  animate?: boolean;
}

const gapClasses = {
  sm: 'gap-2 md:gap-3',
  md: 'gap-4 md:gap-6',
  lg: 'gap-6 md:gap-8',
};

const columnClasses = {
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
};

/**
 * BentoGrid Container
 *
 * Main grid container with responsive columns
 */
export const BentoGrid = React.forwardRef<HTMLDivElement, BentoGridProps>(
  (
    {
      className,
      children,
      columns = 3,
      gap = 'md',
      animate = true,
      ...props
    },
    ref
  ) => {
    const Comp = animate ? motion.div : 'div';

    const containerVariants = animate
      ? {
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.1,
            },
          },
        }
      : undefined;

    return (
      <Comp
        ref={ref}
        className={cn(
          'grid',
          columnClasses[columns],
          gapClasses[gap],
          'auto-rows-[minmax(120px,auto)]',
          className
        )}
        variants={containerVariants}
        initial={animate ? 'hidden' : undefined}
        animate={animate ? 'visible' : undefined}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);
BentoGrid.displayName = 'BentoGrid';

/**
 * BentoCard Props
 */
export interface BentoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Number of columns to span
   * @default 1
   */
  colSpan?: 1 | 2 | 3 | 4 | 'full';

  /**
   * Number of rows to span
   * @default 1
   */
  rowSpan?: 1 | 2 | 3 | 4;

  /**
   * Named grid area (for advanced layouts)
   */
  gridArea?: string;

  /**
   * Enable glass morphism effect
   * @default false
   */
  glass?: boolean;

  /**
   * Enable 3D hover effect
   * @default false
   */
  enable3D?: boolean;

  /**
   * Card variant
   */
  variant?: 'default' | 'elevated' | 'outlined';

  /**
   * Enable card animations
   * @default true
   */
  animate?: boolean;
}

const colSpanClasses = {
  1: 'col-span-1',
  2: 'col-span-1 md:col-span-2',
  3: 'col-span-1 md:col-span-2 lg:col-span-3',
  4: 'col-span-1 md:col-span-2 lg:col-span-4',
  full: 'col-span-full',
};

const rowSpanClasses = {
  1: 'row-span-1',
  2: 'row-span-2',
  3: 'row-span-3',
  4: 'row-span-4',
};

/**
 * BentoCard Component
 *
 * Individual card within BentoGrid with flexible sizing
 *
 * @example
 * <BentoCard colSpan={2} rowSpan={2} glass>
 *   <h2>Large Card</h2>
 *   <p>Spans 2 columns and 2 rows</p>
 * </BentoCard>
 */
export const BentoCard = React.forwardRef<HTMLDivElement, BentoCardProps>(
  (
    {
      className,
      children,
      colSpan = 1,
      rowSpan = 1,
      gridArea,
      glass = false,
      enable3D = false,
      variant = 'default',
      animate = true,
      style,
      ...props
    },
    ref
  ) => {
    const itemVariants = animate
      ? {
          hidden: { opacity: 0, y: 20 },
          visible: {
            opacity: 1,
            y: 0,
            transition: {
              type: 'spring',
              stiffness: 300,
              damping: 30,
            },
          },
        }
      : undefined;

    const glassStyles = glass
      ? {
          background:
            'linear-gradient(135deg, rgba(26, 26, 26, 0.95) 0%, rgba(26, 26, 26, 0.8) 100%)',
          backdropFilter: 'blur(10px) saturate(180%)',
          WebkitBackdropFilter: 'blur(10px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }
      : {};

    return (
      <motion.div
        ref={ref}
        className={cn(
          colSpanClasses[colSpan],
          rowSpanClasses[rowSpan],
          className
        )}
        style={{
          gridArea: gridArea,
          ...style,
        }}
        variants={itemVariants}
        {...props}
      >
        <Card
          variant={variant}
          enable3D={enable3D}
          className="h-full w-full p-6"
          style={glassStyles}
        >
          {children}
        </Card>
      </motion.div>
    );
  }
);
BentoCard.displayName = 'BentoCard';

/**
 * BentoSection Component
 *
 * Semantic wrapper for related BentoCards
 *
 * @example
 * <BentoSection title="Analytics">
 *   <BentoCard>Chart 1</BentoCard>
 *   <BentoCard>Chart 2</BentoCard>
 * </BentoSection>
 */
export interface BentoSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Section title
   */
  title?: string;

  /**
   * Section description
   */
  description?: string;
}

export const BentoSection = React.forwardRef<HTMLDivElement, BentoSectionProps>(
  ({ className, title, description, children, ...props }, ref) => (
    <div ref={ref} className={cn('space-y-4', className)} {...props}>
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-sm text-[var(--color-text-secondary)]">
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  )
);
BentoSection.displayName = 'BentoSection';

/**
 * Pre-configured BentoGrid layouts
 */
export const BentoLayouts = {
  /**
   * Dashboard layout with hero card
   */
  Dashboard: ({ children }: { children: React.ReactNode }) => (
    <BentoGrid columns={3} gap="lg">
      {children}
    </BentoGrid>
  ),

  /**
   * Analytics layout with charts
   */
  Analytics: ({ children }: { children: React.ReactNode }) => (
    <BentoGrid columns={4} gap="md">
      {children}
    </BentoGrid>
  ),

  /**
   * Simple 2-column layout
   */
  TwoColumn: ({ children }: { children: React.ReactNode }) => (
    <BentoGrid columns={2} gap="lg">
      {children}
    </BentoGrid>
  ),
};
