/**
 * Input Component - Form Input with Validation
 *
 * Frictionless UX Principles:
 * - Clear error states reduce form completion friction
 * - Helper text provides context without cognitive overload
 * - Icon support enhances scannability
 * - Character counter prevents submission errors
 * - Full ARIA support for accessibility
 *
 * WCAG 2.2 AA Compliance:
 * - Proper label association
 * - Error announcements via aria-describedby
 * - High contrast error states
 * - Touch target minimum 44x44px (with padding)
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const inputVariants = cva(
  [
    'flex w-full rounded-[var(--radius-input)]',
    'bg-[var(--color-input-bg)]',
    'px-3 py-2',
    'text-[var(--font-size-sm)]',
    'transition-colors',
    'file:border-0 file:bg-transparent file:text-sm file:font-medium',
    'placeholder:text-[var(--color-text-disabled)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        default: [
          'border border-[var(--color-input-border)]',
          'focus-visible:ring-[var(--color-input-focus)]',
        ].join(' '),
        error: [
          'border-2 border-[var(--color-border-error)]',
          'focus-visible:ring-[var(--color-error)]',
        ].join(' '),
        success: [
          'border-2 border-[var(--color-border-success)]',
          'focus-visible:ring-[var(--color-success)]',
        ].join(' '),
      },
      inputSize: {
        sm: 'h-[var(--input-height-sm)] text-xs',
        md: 'h-[var(--input-height-base)] text-sm',
        lg: 'h-[var(--input-height-lg)] text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      inputSize: 'md',
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  /** Label text for the input */
  label?: string;

  /** Helper text displayed below input */
  helperText?: string;

  /** Error message (overrides helperText when present) */
  error?: string;

  /** Icon to display before input value */
  leftIcon?: React.ReactNode;

  /** Icon to display after input value */
  rightIcon?: React.ReactNode;

  /** Show character counter */
  showCounter?: boolean;

  /** Whether the field is required */
  required?: boolean;
}

/**
 * Input Component
 *
 * A fully accessible form input with validation states and helper text.
 *
 * @example
 * // Basic input with label
 * <Input
 *   label="Artist Name"
 *   placeholder="Enter artist name"
 *   value={artist}
 *   onChange={(e) => setArtist(e.target.value)}
 * />
 *
 * @example
 * // Input with error state
 * <Input
 *   label="Email"
 *   type="email"
 *   error="Please enter a valid email address"
 *   value={email}
 *   onChange={(e) => setEmail(e.target.value)}
 * />
 *
 * @example
 * // Input with character counter
 * <Input
 *   label="Track Title"
 *   maxLength={100}
 *   showCounter
 *   value={title}
 *   onChange={(e) => setTitle(e.target.value)}
 * />
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      inputSize,
      type = 'text',
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      showCounter,
      required,
      id,
      maxLength,
      value,
      ...props
    },
    ref
  ) => {
    const inputId = id || React.useId();
    const descriptionId = `${inputId}-description`;
    const errorId = `${inputId}-error`;

    // Determine variant based on error prop
    const effectiveVariant = error ? 'error' : variant;

    // Character count
    const currentLength = typeof value === 'string' ? value.length : 0;

    return (
      <div className="w-full space-y-2">
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'text-sm font-medium leading-none',
              'text-[var(--color-text-primary)]',
              'peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
            )}
          >
            {label}
            {required && (
              <span className="ml-1 text-[var(--color-error)]" aria-label="required">
                *
              </span>
            )}
          </label>
        )}

        {/* Input wrapper */}
        <div className="relative">
          {/* Left icon */}
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <span className="text-[var(--color-text-disabled)]" aria-hidden="true">
                {leftIcon}
              </span>
            </div>
          )}

          {/* Input field */}
          <input
            type={type}
            className={cn(
              inputVariants({ variant: effectiveVariant, inputSize }),
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )}
            ref={ref}
            id={inputId}
            required={required}
            maxLength={maxLength}
            value={value}
            aria-invalid={!!error}
            aria-describedby={
              error ? errorId : helperText ? descriptionId : undefined
            }
            {...props}
          />

          {/* Right icon */}
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <span className="text-[var(--color-text-disabled)]" aria-hidden="true">
                {rightIcon}
              </span>
            </div>
          )}
        </div>

        {/* Helper text, error message, and character counter */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {/* Error message */}
            {error && (
              <p
                id={errorId}
                className="text-xs text-[var(--color-error)]"
                role="alert"
                aria-live="assertive"
              >
                {error}
              </p>
            )}

            {/* Helper text */}
            {!error && helperText && (
              <p
                id={descriptionId}
                className="text-xs text-[var(--color-text-secondary)]"
              >
                {helperText}
              </p>
            )}
          </div>

          {/* Character counter */}
          {showCounter && maxLength && (
            <span
              className={cn(
                'text-xs shrink-0',
                currentLength > maxLength * 0.9
                  ? 'text-[var(--color-warning)]'
                  : 'text-[var(--color-text-disabled)]'
              )}
              aria-label={`${currentLength} of ${maxLength} characters used`}
            >
              {currentLength}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input, inputVariants };
