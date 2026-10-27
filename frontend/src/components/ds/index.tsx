/**
 * Centralized React design-system component bridge for SongNodes.
 *
 * Provides standard, accessible primitives (buttons, badges/pills, inputs,
 * dialogs, cards, typography, tabs, overflow menus, toast notifications,
 * empty/error/loading panels).
 *
 * Markup follows design-system/components specs and classes (`sn-*`).
 * Styling binds strictly to tokens.css and bundle.css without inline style overrides.
 */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal, CircleCheck, X, Trash2, AlertTriangle, Search, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EnergyBar, SN } from '../../lib/songnodes';
import { displayEnergy } from '../../utils/trackMetadata';

const ICON = { size: 16, strokeWidth: 2, 'aria-hidden': true } as const;

export type ModuleKey = 'graph' | 'library' | 'sets' | 'paths' | 'harmony' | 'sources' | 'pipeline' | 'services';

/* ------------------------------------------------------------------ */
/* Button                                                             */
/* ------------------------------------------------------------------ */

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  kind?: 'primary' | 'secondary' | 'quiet' | 'module' | 'danger' | 'danger-quiet';
  module?: ModuleKey;
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon | string;
  iconOnly?: boolean;
  busy?: boolean;
  busyLabel?: string;
  disabledReason?: string;
  pressed?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  kind = 'secondary',
  module,
  size = 'md',
  icon: Icon,
  iconOnly = false,
  busy = false,
  busyLabel,
  disabledReason,
  pressed,
  disabled,
  type = 'button',
  children,
  className = '',
  title,
  ...props
}, ref) => {
  const classes = [
    'sn-btn',
    kind === 'primary' && 'sn-btn--primary',
    kind === 'quiet' && 'sn-btn--quiet',
    kind === 'module' && 'sn-btn--mod',
    kind === 'danger' && 'sn-btn--danger',
    kind === 'danger-quiet' && 'sn-btn--danger-quiet',
    module && `sn-m-${module}`,
    size === 'sm' && 'sn-btn--sm',
    size === 'lg' && 'sn-btn--lg',
    iconOnly && 'sn-btn--icon',
    className,
  ].filter(Boolean).join(' ');

  const isDisabled = disabled || !!disabledReason;
  const computedTitle = disabledReason || title;

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={isDisabled}
      aria-disabled={isDisabled || undefined}
      aria-busy={busy || undefined}
      aria-pressed={pressed}
      title={computedTitle}
      {...props}
    >
      {busy ? (
        <span className="sn-spinner" aria-hidden="true" />
      ) : Icon ? (
        typeof Icon === 'string' ? null : <Icon {...ICON} />
      ) : null}
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
});
Button.displayName = 'Button';

export interface TextLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  module?: ModuleKey;
  external?: boolean;
  onTonal?: boolean;
  path?: boolean;
  breakAnywhere?: boolean;
  current?: boolean;
  children: React.ReactNode;
}

export const TextLink = React.forwardRef<HTMLAnchorElement, TextLinkProps>(({
  href,
  module,
  external,
  onTonal,
  path,
  breakAnywhere,
  current,
  className = '',
  target,
  rel,
  children,
  ...props
}, ref) => {
  const classes = [
    'sn-link',
    module && `sn-m-${module}`,
    external && 'sn-link--ext',
    onTonal && 'sn-text-link--on-tonal',
    path && 'sn-text-link--path',
    breakAnywhere && 'sn-text-link--break',
    className,
  ].filter(Boolean).join(' ');

  return (
    <a
      ref={ref}
      href={href}
      className={classes}
      target={external ? '_blank' : target}
      rel={external ? 'noopener noreferrer' : rel}
      aria-current={current ? 'page' : undefined}
      {...props}
    >
      {children}
      {external ? (
        <span className="sn-sr">, opens in a new tab</span>
      ) : null}
    </a>
  );
});
TextLink.displayName = 'TextLink';

/* ------------------------------------------------------------------ */
/* Badges & Status Pills                                              */
/* ------------------------------------------------------------------ */

export type CompatLevelDS = 'perfect' | 'compatible' | 'possible' | 'clash' | 'unknown';

export interface CompatibilityBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  level: CompatLevelDS;
  label?: string;
  outline?: boolean;
}

/** Glyph (● ◐ ○ ✕ ?) comes from CSS via data-compat; words carry verdict. */
export const CompatibilityBadge = React.forwardRef<HTMLSpanElement, CompatibilityBadgeProps>(({
  level,
  label,
  outline,
  className = '',
  ...props
}, ref) => {
  const cls = ['sn-pill', outline && 'sn-pill--outline', 'sn-compatibility-badge', className]
    .filter(Boolean)
    .join(' ');
  return (
    <span ref={ref} className={cls} data-compat={level} {...props}>
      {label ?? (level === 'unknown' ? 'not known' : level)}
    </span>
  );
});
CompatibilityBadge.displayName = 'CompatibilityBadge';

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: 'ok' | 'fair' | 'warn' | 'bad' | 'info' | 'running' | 'idle';
  raw?: string;
  label?: string;
  outline?: boolean;
  size?: 'md' | 'lg';
}

export const StatusPill = React.forwardRef<HTMLSpanElement, StatusPillProps>(({
  status,
  raw,
  label,
  outline,
  size,
  className = '',
  ...props
}, ref) => {
  const resolvedStatus = status || (raw ? (SN?.status ? SN.status(raw).status : raw) : undefined);
  const resolvedLabel = label || (raw && SN?.status ? SN.status(raw).label : undefined);
  const cls = [
    'sn-pill',
    'sn-status-pill',
    outline && 'sn-pill--outline',
    size === 'lg' && 'sn-status-pill--lg',
    className,
  ].filter(Boolean).join(' ');

  return (
    <span ref={ref} className={cls} data-status={resolvedStatus} {...props}>
      {resolvedLabel}
    </span>
  );
});
StatusPill.displayName = 'StatusPill';

export interface CategoryTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  emphasis?: 'default' | 'high' | 'vault';
  icon?: LucideIcon;
}

export const CategoryTag = React.forwardRef<HTMLSpanElement, CategoryTagProps>(({
  emphasis = 'default',
  icon: Icon,
  className = '',
  children,
  ...props
}, ref) => {
  const cls = [
    'sn-tag',
    'sn-category-tag',
    emphasis === 'high' && 'sn-category-tag--high',
    emphasis === 'vault' && 'sn-category-tag--vault',
    className,
  ].filter(Boolean).join(' ');

  return (
    <span ref={ref} className={cls} {...props}>
      {Icon ? <Icon {...ICON} size={12} /> : null}
      {children}
    </span>
  );
});
CategoryTag.displayName = 'CategoryTag';

export interface KeyBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  value?: string | null;
  withName?: boolean;
  size?: 'row' | 'lg';
}

export const KeyBadge = React.forwardRef<HTMLSpanElement, KeyBadgeProps>(({
  value,
  withName,
  size,
  className = '',
  ...props
}, ref) => {
  const code = value ? (SN?.camelot ? SN.camelot(value) : value) : null;
  const name = code && withName && SN?.keyName ? SN.keyName(code) : null;
  const cls = ['sn-key', size === 'lg' && 'sn-key-badge--lg', className].filter(Boolean).join(' ');

  if (!code) {
    return <span ref={ref} className="sn-none" title="Key not set" {...props}>–</span>;
  }

  return (
    <span ref={ref} className={cls} data-key={code} {...props}>
      <span className="sn-key__code">{code}</span>
      {name ? <span className="sn-key__name">{name}</span> : null}
    </span>
  );
});
KeyBadge.displayName = 'KeyBadge';

/* ------------------------------------------------------------------ */
/* SegmentedControl (WAI-ARIA radio group)                            */
/* ------------------------------------------------------------------ */

export interface SegOption<V extends string> {
  value: V;
  label: string;
  icon?: LucideIcon;
  ariaLabel?: string;
  disabledReason?: string;
}

export interface SegmentedControlProps<V extends string> extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  label?: string;
  labelledBy?: string;
  options: SegOption<V>[];
  value: V;
  onChange: (v: V) => void;
  size?: 'sm' | 'md';
  caps?: boolean;
  block?: boolean;
}

export function SegmentedControl<V extends string>({
  label,
  labelledBy,
  options,
  value,
  onChange,
  size = 'md',
  caps = false,
  block = false,
  className = '',
  ...props
}: SegmentedControlProps<V>) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = (i + 1) % options.length;
      while (next !== i && options[next].disabledReason) {
        next = (next + 1) % options.length;
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = (i - 1 + options.length) % options.length;
      while (next !== i && options[next].disabledReason) {
        next = (next - 1 + options.length) % options.length;
      }
    } else if (e.key === 'Home') {
      next = 0;
      while (next < options.length && options[next].disabledReason) next++;
    } else if (e.key === 'End') {
      next = options.length - 1;
      while (next >= 0 && options[next].disabledReason) next--;
    }

    if (next >= 0 && next < options.length && !options[next].disabledReason) {
      e.preventDefault();
      onChange(options[next].value);
      buttonRefs.current[next]?.focus();
    }
  };

  const cls = [
    'sn-seg',
    'sn-segmented-control',
    size === 'sm' && 'sn-segmented-control--sm',
    block && 'sn-segmented-control--block',
    caps && 'sn-segmented-control--caps',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      {...props}
    >
      {options.map((o, i) => {
        const checked = o.value === value;
        const Icon = o.icon;
        const isDisabled = !!o.disabledReason;
        return (
          <button
            key={o.value}
            ref={(el) => { buttonRefs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-disabled={isDisabled || undefined}
            aria-label={o.ariaLabel}
            tabIndex={checked ? 0 : -1}
            data-value={o.value}
            title={o.disabledReason || o.ariaLabel}
            onClick={() => {
              if (!isDisabled) onChange(o.value);
            }}
            onKeyDown={(e) => onKey(e, i)}
          >
            {Icon ? <Icon {...ICON} size={14} /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs (TextField, SearchField, SelectField, Checkbox)             */
/* ------------------------------------------------------------------ */

export interface TextFieldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  placeholder?: string;
  help?: React.ReactNode;
  error?: string;
  optional?: boolean;
  data?: boolean;
  maxLength?: number;
  rows?: number;
  readOnly?: boolean;
  disabledReason?: string;
}

export const TextField = React.forwardRef<HTMLDivElement, TextFieldProps>(({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  help,
  error,
  optional,
  data,
  maxLength,
  rows,
  readOnly,
  disabledReason,
  className = '',
  ...props
}, ref) => {
  const uid = useId().replace(/:/g, '');
  const helpId = help ? `${uid}-help` : undefined;
  const errorId = error ? `${uid}-error` : undefined;
  const isTextArea = rows && rows > 1;

  const inputClasses = [
    isTextArea ? 'sn-textarea' : 'sn-input',
    data && 'sn-input--data',
  ].filter(Boolean).join(' ');

  return (
    <div ref={ref} className={['sn-field', 'sn-text-field', className].filter(Boolean).join(' ')} {...props}>
      <div className="sn-text-field__label">
        <label htmlFor={uid}>
          {label}
          {optional ? <span className="sn-text-field__optional"> (optional)</span> : null}
        </label>
        {maxLength ? (
          <span className="sn-text-field__count" data-over={value.length > maxLength || undefined}>
            {value.length} / {maxLength}
          </span>
        ) : null}
      </div>

      {isTextArea ? (
        <textarea
          id={uid}
          className={inputClasses}
          value={value}
          placeholder={placeholder}
          rows={rows}
          readOnly={readOnly}
          disabled={!!disabledReason}
          aria-invalid={error ? true : undefined}
          aria-describedby={[helpId, errorId].filter(Boolean).join(' ') || undefined}
          onChange={(e) => onChange?.(e.target.value)}
        />
      ) : (
        <input
          id={uid}
          type={type}
          className={inputClasses}
          value={value}
          placeholder={placeholder}
          readOnly={readOnly}
          disabled={!!disabledReason}
          aria-invalid={error ? true : undefined}
          aria-describedby={[helpId, errorId].filter(Boolean).join(' ') || undefined}
          onChange={(e) => onChange?.(e.target.value)}
        />
      )}

      {error ? <div className="sn-field__error" id={errorId}>{error}</div> : null}
      {help ? <div className="sn-field__help" id={helpId}>{help}</div> : null}
      {disabledReason ? <div className="sn-text-field__reason">{disabledReason}</div> : null}
    </div>
  );
});
TextField.displayName = 'TextField';

export interface SearchFieldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  shortcut?: boolean;
}

export const SearchField = React.forwardRef<HTMLDivElement, SearchFieldProps>(({
  value,
  onChange,
  label = 'Search',
  placeholder = 'Search…',
  shortcut = false,
  className = '',
  ...props
}, ref) => {
  const uid = useId().replace(/:/g, '');
  return (
    <div ref={ref} className={['sn-search-field', className].filter(Boolean).join(' ')} {...props}>
      <div className="sn-search-field__box">
        <span className="sn-search-field__icon" aria-hidden="true">
          <Search size={16} strokeWidth={2} />
        </span>
        <input
          id={uid}
          type="search"
          className="sn-input sn-search-field__input"
          aria-label={label}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {value ? (
          <div className="sn-search-field__end">
            <button
              type="button"
              className="sn-search-field__clear"
              aria-label="Clear search"
              onClick={() => onChange('')}
            >
              <X size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        ) : shortcut ? (
          <div className="sn-search-field__end">
            <kbd className="sn-search-field__kbd">/</kbd>
          </div>
        ) : null}
      </div>
    </div>
  );
});
SearchField.displayName = 'SearchField';

export interface SelectFieldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  help?: string;
  error?: string;
  inline?: boolean;
  disabledReason?: string;
}

export const SelectField = React.forwardRef<HTMLDivElement, SelectFieldProps>(({
  label,
  options,
  value,
  onChange,
  help,
  error,
  inline,
  disabledReason,
  className = '',
  ...props
}, ref) => {
  const uid = useId().replace(/:/g, '');
  const helpId = help ? `${uid}-help` : undefined;
  const errorId = error ? `${uid}-error` : undefined;

  const cls = [
    'sn-field',
    'sn-select-field',
    inline && 'sn-select-field--inline',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div ref={ref} className={cls} {...props}>
      <label htmlFor={uid}>{label}</label>
      <select
        id={uid}
        className="sn-select"
        value={value}
        disabled={!!disabledReason}
        aria-invalid={error ? true : undefined}
        aria-describedby={[helpId, errorId].filter(Boolean).join(' ') || undefined}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? <div className="sn-field__error" id={errorId}>{error}</div> : null}
      {help ? <div className="sn-field__help" id={helpId}>{help}</div> : null}
    </div>
  );
});
SelectField.displayName = 'SelectField';

export interface CheckboxProps extends Omit<React.LabelHTMLAttributes<HTMLLabelElement>, 'onChange'> {
  label?: React.ReactNode;
  checked: boolean;
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  hint?: string;
  count?: number;
  disabledReason?: string;
  bare?: boolean;
  ariaLabel?: string;
}

export const Checkbox = React.forwardRef<HTMLLabelElement, CheckboxProps>(({
  label,
  checked,
  indeterminate,
  onChange,
  hint,
  count,
  disabledReason,
  bare,
  ariaLabel,
  className = '',
  ...props
}, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = !!indeterminate;
    }
  }, [indeterminate]);

  const isDisabled = !!disabledReason;
  const cls = [
    'sn-checkbox',
    bare && 'sn-checkbox--bare',
    isDisabled && 'sn-checkbox--disabled',
    className,
  ].filter(Boolean).join(' ');

  return (
    <label ref={ref} className={cls} data-disabled={isDisabled || undefined} {...props}>
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        disabled={isDisabled}
        aria-label={bare ? ariaLabel : undefined}
        title={disabledReason}
        onChange={(e) => !isDisabled && onChange?.(e.target.checked)}
      />
      {!bare ? (
        <span className="sn-checkbox__text">
          <span>
            {label}
            {count !== undefined ? <span className="sn-checkbox__count">({count})</span> : null}
          </span>
          {hint ? <span className="sn-checkbox__hint">{hint}</span> : null}
        </span>
      ) : null}
    </label>
  );
});
Checkbox.displayName = 'Checkbox';

export interface RadioProps extends Omit<React.LabelHTMLAttributes<HTMLLabelElement>, 'onChange'> {
  label?: React.ReactNode;
  name?: string;
  value?: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  hint?: string;
  disabledReason?: string;
  bare?: boolean;
  ariaLabel?: string;
}

export const Radio = React.forwardRef<HTMLLabelElement, RadioProps>(({
  label,
  name,
  value,
  checked,
  onChange,
  hint,
  disabledReason,
  bare,
  ariaLabel,
  className = '',
  ...props
}, ref) => {
  const isDisabled = !!disabledReason;
  const cls = [
    'sn-checkbox',
    bare && 'sn-checkbox--bare',
    isDisabled && 'sn-checkbox--disabled',
    className,
  ].filter(Boolean).join(' ');

  return (
    <label ref={ref} className={cls} data-disabled={isDisabled || undefined} {...props}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={isDisabled}
        aria-label={bare ? ariaLabel : undefined}
        title={disabledReason}
        onChange={(e) => !isDisabled && onChange?.(e.target.checked)}
      />
      {!bare ? (
        <span className="sn-checkbox__text">
          <span>{label}</span>
          {hint ? <span className="sn-checkbox__hint">{hint}</span> : null}
        </span>
      ) : null}
    </label>
  );
});
Radio.displayName = 'Radio';

export interface SwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void | Promise<void>;
  disabledReason?: string;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(({
  label,
  description,
  checked,
  onChange,
  disabledReason,
}, ref) => {
  const uid = useId().replace(/:/g, '');
  const labelId = `sw-${uid}-l`;
  const descriptionId = description ? `sw-${uid}-d` : undefined;
  const reasonId = disabledReason ? `sw-${uid}-r` : undefined;
  const describedBy = [descriptionId, reasonId].filter(Boolean).join(' ') || undefined;
  const isDisabled = !!disabledReason;

  const toggle = () => {
    if (!isDisabled) onChange(!checked);
  };

  return (
    <div className="sn-switch">
      <div className="sn-switch__text" onClick={toggle}>
        <span className="sn-switch__label" id={labelId}>{label}</span>
        {description ? (
          <span className="sn-switch__desc" id={descriptionId}>{description}</span>
        ) : null}
        {disabledReason ? (
          <span className="sn-switch__desc" id={reasonId}>
            <Lock {...ICON} size={14} />
            {disabledReason}
          </span>
        ) : null}
      </div>
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-disabled={isDisabled || undefined}
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        className="sn-switch__control"
        onClick={toggle}
      >
        <span className="sn-switch__state" aria-hidden="true">{checked ? 'On' : 'Off'}</span>
        <span className="sn-switch__track" aria-hidden="true">
          <span className="sn-switch__thumb" />
        </span>
      </button>
    </div>
  );
});
Switch.displayName = 'Switch';

/* ------------------------------------------------------------------ */
/* Typography & Section Headings                                      */
/* ------------------------------------------------------------------ */

export interface TitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  lead?: string;
  size?: 'display-xl' | 'title-l' | 'title-m' | 'title-s' | 'title-lead';
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export const Title = React.forwardRef<HTMLHeadingElement, TitleProps>(({
  lead,
  size = 'title-l',
  as = 'h1',
  children,
  className = '',
  ...props
}, ref) => {
  const Tag = as;
  const cls = ['sn-title', size, className].filter(Boolean).join(' ');
  return (
    <Tag ref={ref} className={cls} {...props}>
      {lead ? <span className="sn-lead">{lead}: </span> : null}
      {children}
    </Tag>
  );
});
Title.displayName = 'Title';

export interface SectionHeadingProps extends React.HTMLAttributes<HTMLDivElement> {
  lead?: string;
  title: string;
  size?: 'title-m' | 'title-s';
  count?: string;
  end?: React.ReactNode;
  caveat?: React.ReactNode;
  rule?: boolean;
}

export const SectionHeading = React.forwardRef<HTMLDivElement, SectionHeadingProps>(({
  lead,
  title,
  size = 'title-m',
  count,
  end,
  caveat,
  rule,
  className = '',
  ...props
}, ref) => {
  const cls = [
    'sn-section-heading',
    rule && 'sn-section-heading--rule',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div ref={ref} className={cls} {...props}>
      <Title lead={lead} size={size} as="h2">{title}</Title>
      {count ? <span className="sn-section-heading__count">{count}</span> : null}
      {end ? <div className="sn-section-heading__end">{end}</div> : null}
      {caveat ? <div className="sn-section-heading__caveat">{caveat}</div> : null}
    </div>
  );
});
SectionHeading.displayName = 'SectionHeading';

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'body-l' | 'body' | 'body-strong' | 'body-s' | 'caption' | 'label' | 'data' | 'data-strong' | 'data-s' | 'eyebrow' | 'muted' | 'dim';
  as?: 'p' | 'span' | 'div' | 'label' | 'small';
}

export const Text = React.forwardRef<HTMLElement, TextProps>(({
  variant = 'body',
  as = 'p',
  className = '',
  children,
  ...props
}, ref) => {
  const Tag = as as any;
  const variantClass = variant === 'muted' ? 'sn-muted' : variant === 'dim' ? 'sn-dim' : variant === 'eyebrow' ? 'sn-eyebrow' : variant;
  const cls = [variantClass, className].filter(Boolean).join(' ');
  return (
    <Tag ref={ref} className={cls} {...props}>
      {children}
    </Tag>
  );
});
Text.displayName = 'Text';

/* ------------------------------------------------------------------ */
/* Cards                                                              */
/* ------------------------------------------------------------------ */

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: 'neutral' | 'tonal' | 'media' | 'list' | 'link';
  module?: ModuleKey;
  image?: string;
  eyebrow?: string;
  title?: React.ReactNode;
  href?: string;
  footer?: React.ReactNode;
  compact?: boolean;
  flat?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({
  variant = 'neutral',
  module,
  image,
  eyebrow,
  title,
  href,
  footer,
  compact,
  flat,
  className = '',
  children,
  ...props
}, ref) => {
  const cls = [
    'sn-card',
    variant === 'tonal' && 'sn-card--tonal',
    variant === 'media' && 'sn-card--media',
    variant === 'list' && 'sn-card--list',
    variant === 'link' && 'sn-card--link',
    compact && 'sn-card--compact',
    flat && 'sn-card--flat',
    module && `sn-m-${module}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div ref={ref} className={cls} {...props}>
      {image ? (
        <div className="sn-card__media">
          <img src={image} alt="" />
        </div>
      ) : null}
      {eyebrow ? <div className="sn-card__eyebrow">{eyebrow}</div> : null}
      {title ? (
        <div className="sn-card__head">
          {href ? (
            <a href={href} className="sn-card__primary">
              <Title size="title-s" as="h3">{title}</Title>
            </a>
          ) : (
            <Title size="title-s" as="h3">{title}</Title>
          )}
        </div>
      ) : null}
      {children}
      {footer ? <div className="sn-card__foot">{footer}</div> : null}
    </div>
  );
});
Card.displayName = 'Card';

/* ------------------------------------------------------------------ */
/* Tabs (WAI-ARIA tabs, automatic activation)                          */
/* ------------------------------------------------------------------ */

export interface TabsProps<T extends string> extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  label: string;
  tabs: { id: T; label: string; count?: number; countLabel?: string; changed?: boolean }[];
  value: T;
  onChange: (id: T) => void;
  module?: ModuleKey;
  idBase?: string;
}

export function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  module,
  idBase,
  className = '',
  ...props
}: TabsProps<T>) {
  const generatedId = useId().replace(/:/g, '');
  const base = idBase || `tabs-${generatedId}`;
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const i = tabs.findIndex((t) => t.id === value);
    const el = buttonRefs.current[i];
    const strip = el?.parentElement;
    if (el && strip) {
      strip.scrollLeft = Math.max(0, el.offsetLeft - strip.clientWidth / 2 + el.offsetWidth / 2);
    }
  }, [value, tabs]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next >= 0) {
      e.preventDefault();
      onChange(tabs[next].id);
      buttonRefs.current[next]?.focus();
      buttonRefs.current[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  };

  const wrapCls = [
    'sn-tabs__wrap',
    module && `sn-m-${module}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapCls} {...props}>
      <div className="sn-tabs" role="tablist" aria-label={label}>
        {tabs.map((t, i) => {
          const sel = t.id === value;
          return (
            <button
              key={t.id}
              ref={(el) => { buttonRefs.current[i] = el; }}
              className="sn-tab"
              role="tab"
              type="button"
              id={`${base}-tab-${t.id}`}
              aria-controls={`${base}-panel-${t.id}`}
              aria-selected={sel}
              tabIndex={sel ? 0 : -1}
              onClick={() => onChange(t.id)}
              onKeyDown={(e) => onKey(e, i)}
            >
              {t.label}
              {t.count ? (
                <>
                  <span className="sn-tab__badge">{t.count}</span>
                  {t.countLabel ? <span className="sn-sr"> {t.countLabel}</span> : null}
                </>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  idBase?: string;
  id: string;
}

export const TabPanel = React.forwardRef<HTMLDivElement, TabPanelProps>(({
  idBase,
  id,
  children,
  className = '',
  ...props
}, ref) => {
  const base = idBase || 'tabpanel';
  const cls = ['sn-tabs__panel', className].filter(Boolean).join(' ');
  return (
    <div
      ref={ref}
      className={cls}
      role="tabpanel"
      id={`${base}-panel-${id}`}
      aria-labelledby={`${base}-tab-${id}`}
      tabIndex={0}
      {...props}
    >
      {children}
    </div>
  );
});
TabPanel.displayName = 'TabPanel';

/* ------------------------------------------------------------------ */
/* OverflowMenu (WAI-ARIA menu button)                                */
/* ------------------------------------------------------------------ */

export interface OverflowItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  group?: string;
  destructive?: boolean;
  disabledReason?: string;
}

export interface OverflowMenuProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  label?: string;
  items?: OverflowItem[];
  actions?: OverflowItem[];
  onSelect: (id: string) => void;
  quiet?: boolean;
  small?: boolean;
  variant?: 'page' | 'row';
  placement?: 'bottom-end' | 'bottom-start' | 'top-end' | 'top-start';
}

export const OverflowMenu = React.forwardRef<HTMLDivElement, OverflowMenuProps>(({
  label = 'More actions',
  items,
  actions,
  onSelect,
  quiet,
  small,
  variant,
  placement = 'bottom-end',
  className = '',
  ...props
}, ref) => {
  const menuItems = items || actions || [];
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, '');

  const itemEls = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
  const focusAt = (i: number) => {
    const els = itemEls();
    if (!els.length) return;
    els[(i + els.length) % els.length].focus();
  };

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) {
        close(false);
      }
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open, close]);

  const openAt = (where: 'first' | 'last') => {
    setOpen(true);
    requestAnimationFrame(() => focusAt(where === 'first' ? 0 : -1));
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    const els = itemEls();
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); focusAt(i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusAt(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusAt(0); }
    else if (e.key === 'End') { e.preventDefault(); focusAt(-1); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') { close(false); }
    else if (e.key.length === 1) {
      const k = e.key.toLowerCase();
      const start = i + 1;
      for (let n = 0; n < els.length; n++) {
        const el = els[(start + n) % els.length];
        if ((el.textContent || '').trim().toLowerCase().startsWith(k)) { el.focus(); break; }
      }
    }
  };

  const normal = menuItems.filter((it) => !it.destructive);
  const danger = menuItems.filter((it) => it.destructive);
  const groups: { name?: string; items: OverflowItem[] }[] = [];
  normal.forEach((it) => {
    const g = groups.find((x) => x.name === it.group);
    if (g) g.items.push(it);
    else groups.push({ name: it.group, items: [it] });
  });

  const renderItem = (it: OverflowItem) => {
    const Icon = it.icon;
    const reasonId = it.disabledReason ? `${uid}-r-${it.id}` : undefined;
    return (
      <button
        key={it.id}
        type="button"
        className={`sn-overflow-menu__item${it.destructive ? ' sn-overflow-menu__item--danger' : ''}`}
        role="menuitem"
        tabIndex={-1}
        aria-disabled={it.disabledReason ? true : undefined}
        aria-describedby={reasonId}
        onClick={() => {
          if (it.disabledReason) return;
          close();
          onSelect(it.id);
        }}
      >
        {Icon ? <Icon {...ICON} /> : null}
        <span className="sn-overflow-menu__label">
          <span className="sn-overflow-menu__text">{it.label}</span>
          {it.disabledReason ? <span className="sn-overflow-menu__reason" id={reasonId}>{it.disabledReason}</span> : null}
        </span>
      </button>
    );
  };

  const menuClass = [
    'sn-overflow-menu__menu',
    placement.includes('start') && 'sn-overflow-menu__menu--start',
    placement.includes('top') && 'sn-overflow-menu__menu--up',
  ].filter(Boolean).join(' ');

  const isSmall = small || variant === 'row';

  return (
    <div ref={ref} className={['sn-overflow-menu', className].filter(Boolean).join(' ')} {...props}>
      <button
        ref={btnRef}
        type="button"
        className={['sn-btn', 'sn-btn--icon', quiet && 'sn-btn--quiet', isSmall && 'sn-btn--sm'].filter(Boolean).join(' ')}
        id={`${uid}-btn`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${uid}-menu`}
        aria-label={label}
        title={label}
        onClick={() => (open ? close(false) : openAt('first'))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); openAt('first'); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); openAt('last'); }
        }}
      >
        <MoreHorizontal {...ICON} />
      </button>
      <div
        ref={menuRef}
        className={menuClass}
        role="menu"
        id={`${uid}-menu`}
        aria-labelledby={`${uid}-btn`}
        hidden={!open}
        onKeyDown={onMenuKey}
      >
        {groups.map((g, gi) =>
          g.name ? (
            <div role="group" key={g.name} aria-labelledby={`${uid}-h${gi}`}>
              <div className="sn-overflow-menu__heading" id={`${uid}-h${gi}`} role="presentation">{g.name}</div>
              {g.items.map(renderItem)}
            </div>
          ) : (
            <React.Fragment key={`g${gi}`}>{g.items.map(renderItem)}</React.Fragment>
          ),
        )}
        {danger.length ? (
          <>
            <div className="sn-overflow-menu__sep" role="separator" />
            {danger.map(renderItem)}
          </>
        ) : null}
      </div>
    </div>
  );
});
OverflowMenu.displayName = 'OverflowMenu';

/* ------------------------------------------------------------------ */
/* ConfirmDialog & Dialog (APG alertdialog / native <dialog>)         */
/* ------------------------------------------------------------------ */

export interface ConfirmDialogProps extends React.DialogHTMLAttributes<HTMLDialogElement> {
  open: boolean;
  title: string;
  children: React.ReactNode;
  facts?: React.ReactNode[];
  confirmLabel: string;
  busy?: boolean;
  busyLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  typedValue?: string;
}

export const ConfirmDialog = React.forwardRef<HTMLDialogElement, ConfirmDialogProps>(({
  open,
  title,
  children,
  facts,
  confirmLabel,
  busy,
  busyLabel,
  onConfirm,
  onCancel,
  typedValue,
  className = '',
  ...props
}, ref) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const typedRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState('');
  const opener = useRef<Element | null>(null);
  const uid = useId().replace(/:/g, '');

  React.useImperativeHandle(ref, () => dialogRef.current!);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
      setTyped('');
      if (typedValue) typedRef.current?.focus(); else cancelRef.current?.focus();
    } else if (!open && d.open) {
      d.close();
      (opener.current as HTMLElement | null)?.focus?.();
    }
  }, [open, typedValue]);

  const cls = ['sn-dialog', 'sn-dialog--s', 'sn-confirm-dialog', className].filter(Boolean).join(' ');

  return (
    <dialog
      ref={dialogRef}
      className={cls}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={`${uid}-t`}
      aria-describedby={`${uid}-d`}
      onCancel={(e) => { e.preventDefault(); onCancel(); }}
      {...props}
    >
      <div className="sn-dialog__head">
        <span className="sn-confirm-dialog__icon" aria-hidden="true"><Trash2 {...ICON} size={20} /></span>
        <Title size="title-s" as="h2" id={`${uid}-t`}>{title}</Title>
      </div>
      <div className="sn-dialog__body" id={`${uid}-d`}>
        <p className="sn-confirm-dialog__text">{children}</p>
        {facts && facts.length ? (
          <ul className="sn-confirm-dialog__facts">{facts.map((f, i) => <li key={i}>{f}</li>)}</ul>
        ) : null}
        {typedValue ? (
          <div className="sn-field sn-confirm-dialog__typed">
            <label htmlFor={`${uid}-typed`}>Type <code>{typedValue}</code> to confirm</label>
            <input id={`${uid}-typed`} ref={typedRef} className="sn-input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </div>
        ) : null}
      </div>
      <div className="sn-dialog__foot">
        <Button ref={cancelRef} autoFocus={!typedValue} onClick={onCancel}>Cancel</Button>
        <Button
          kind="danger"
          busy={busy}
          busyLabel={busyLabel}
          disabled={busy || (!!typedValue && typed !== typedValue)}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
});
ConfirmDialog.displayName = 'ConfirmDialog';

export interface DialogProps extends React.DialogHTMLAttributes<HTMLDialogElement> {
  open: boolean;
  title: string;
  lead?: string;
  sub?: string;
  size?: 's' | 'm' | 'l';
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
}

export const Dialog = React.forwardRef<HTMLDialogElement, DialogProps>(({
  open,
  title,
  lead,
  sub,
  size = 'm',
  onClose,
  children,
  footer,
  onSubmit,
  className = '',
  ...props
}, ref) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const uid = useId().replace(/:/g, '');

  React.useImperativeHandle(ref, () => dialogRef.current!);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!open && d.open) {
      d.close();
      (opener.current as HTMLElement | null)?.focus?.();
    }
  }, [open]);

  const inner = (
    <>
      <div className="sn-dialog__body">{children}</div>
      {footer ? <div className="sn-dialog__foot">{footer}</div> : null}
    </>
  );

  const cls = ['sn-dialog', `sn-dialog--${size}`, className].filter(Boolean).join(' ');

  return (
    <dialog
      ref={dialogRef}
      className={cls}
      aria-labelledby={`${uid}-t`}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
      {...props}
    >
      <div className="sn-dialog__head">
        <div className="sn-dialog__title">
          <Title lead={lead} size="title-m" as="h2" id={`${uid}-t`}>{title}</Title>
          {sub ? <p className="sn-dialog__sub">{sub}</p> : null}
        </div>
        <Button kind="quiet" iconOnly aria-label="Close" title="Close" onClick={onClose}>
          <X {...ICON} />
        </Button>
      </div>
      {open ? (onSubmit ? <form onSubmit={onSubmit} className="sn-dialog__form">{inner}</form> : inner) : null}
    </dialog>
  );
});
Dialog.displayName = 'Dialog';

/* ------------------------------------------------------------------ */
/* Toast: one region, one visible, queue of 3, 4 s (8 s with action)  */
/* ------------------------------------------------------------------ */

interface ToastMsg { id: number; text: React.ReactNode; action?: { label: string; onClick: () => void } }
const TOAST_EVENT = 'sn-toast';
let toastSeq = 0;

/** Show a short past-tense confirmation ("Queue cleared: 42 tasks"). Never for errors that need action. */
export function showToast(text: React.ReactNode, action?: ToastMsg['action']) {
  window.dispatchEvent(new CustomEvent<ToastMsg>(TOAST_EVENT, { detail: { id: ++toastSeq, text, action } }));
}

export const ToastRegion = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({
  className = '',
  ...props
}, ref) => {
  const [queue, setQueue] = useState<ToastMsg[]>([]);
  const paused = useRef(false);
  const current = queue[0];

  useEffect(() => {
    const onToast = (e: Event) => {
      const msg = (e as CustomEvent<ToastMsg>).detail;
      setQueue((q) => {
        const [head, ...rest] = q;
        const waiting = [...rest, msg].slice(-3);
        return head ? [head, ...waiting] : waiting;
      });
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  useEffect(() => {
    if (!current) return;
    let left = current.action ? 8000 : 4000;
    const tick = 250;
    const t = window.setInterval(() => {
      if (paused.current) return;
      left -= tick;
      if (left <= 0) setQueue((q) => q.slice(1));
    }, tick);
    return () => window.clearInterval(t);
  }, [current]);

  const dismiss = () => setQueue((q) => q.slice(1));

  const cls = ['sn-toast__region', className].filter(Boolean).join(' ');

  return (
    <div ref={ref} className={cls} role="status" aria-live="polite" aria-label="Notifications" {...props}>
      {current ? (
        <div
          className="sn-toast"
          key={current.id}
          onMouseEnter={() => { paused.current = true; }}
          onMouseLeave={() => { paused.current = false; }}
          onFocus={() => { paused.current = true; }}
          onBlur={() => { paused.current = false; }}
          onKeyDown={(e) => { if (e.key === 'Escape') dismiss(); }}
        >
          <span className="sn-toast__icon" aria-hidden="true"><CircleCheck {...ICON} /></span>
          <span className="sn-toast__text">{current.text}</span>
          {queue.length > 1 ? <span className="sn-toast__queue">+{queue.length - 1} more</span> : null}
          {current.action ? (
            <Button size="sm" className="sn-toast__action" onClick={() => { current.action!.onClick(); dismiss(); }}>
              {current.action.label}
            </Button>
          ) : null}
          <Button size="sm" kind="quiet" iconOnly className="sn-toast__close" aria-label="Dismiss notification" onClick={dismiss}>
            <X {...ICON} />
          </Button>
        </div>
      ) : null}
    </div>
  );
});
ToastRegion.displayName = 'ToastRegion';

/* ------------------------------------------------------------------ */
/* Empty / error / loading panels                                     */
/* ------------------------------------------------------------------ */

export interface EmptyPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon;
  title: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  compact?: boolean;
}

export const EmptyPanel = React.forwardRef<HTMLDivElement, EmptyPanelProps>(({
  icon: Icon,
  title,
  children,
  actions,
  meta,
  compact,
  className = '',
  ...props
}, ref) => {
  const cls = [
    'sn-empty-state',
    compact && 'sn-empty-state--compact',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div ref={ref} className={cls} {...props}>
      <div className="sn-empty-state__icon" aria-hidden="true"><Icon size={24} strokeWidth={2} /></div>
      <Title size={compact ? 'title-s' : 'title-m'} as="h3" className="sn-empty-state__title">{title}</Title>
      {children ? <p className="sn-empty-state__text">{children}</p> : null}
      {meta ? <div className="sn-empty-state__meta">{meta}</div> : null}
      {actions ? <div className="sn-empty-state__actions">{actions}</div> : null}
    </div>
  );
});
EmptyPanel.displayName = 'EmptyPanel';

export interface ErrorPanelProps extends React.HTMLAttributes<HTMLElement> {
  icon?: LucideIcon;
  status?: 'warn' | 'bad' | 'info';
  title: string;
  retry?: React.ReactNode;
  helps?: boolean;
  actions?: React.ReactNode;
  panel?: boolean;
}

export const ErrorPanel = React.forwardRef<HTMLElement, ErrorPanelProps>(({
  icon: Icon = AlertTriangle,
  status = 'bad',
  title,
  children,
  retry,
  helps = true,
  actions,
  panel,
  className = '',
  ...props
}, ref) => {
  const uid = useId().replace(/:/g, '');
  const cls = [
    'sn-error-state',
    panel && 'sn-error-state--panel',
    className,
  ].filter(Boolean).join(' ');

  return (
    <section ref={ref} className={cls} data-status={status} aria-labelledby={`${uid}-e`} {...props}>
      <div className="sn-error-state__icon" aria-hidden="true"><Icon size={20} strokeWidth={2} /></div>
      <Title size="title-s" as="h3" className="sn-error-state__title" id={`${uid}-e`}>{title}</Title>
      {children ? <div className="sn-error-state__text">{children}</div> : null}
      {retry ? <p className="sn-error-state__retry" data-helps={helps ? undefined : 'no'}>{retry}</p> : null}
      {actions ? <div className="sn-error-state__actions">{actions}</div> : null}
    </section>
  );
});
ErrorPanel.displayName = 'ErrorPanel';

export interface LoadingPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  message: string;
  rows?: number;
}

/** Skeleton rows plus a status line; message shows after 1 s (data-slow). */
export const LoadingPanel = React.forwardRef<HTMLDivElement, LoadingPanelProps>(({
  message,
  rows = 6,
  className = '',
  ...props
}, ref) => {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), 1000);
    return () => window.clearTimeout(t);
  }, []);

  const cls = ['sn-loading-state', className].filter(Boolean).join(' ');

  return (
    <div ref={ref} className={cls} aria-busy="true" data-slow={slow ? '' : undefined} {...props}>
      <div className="sn-loading-state__lines" aria-hidden="true">
        {Array.from({ length: rows }).map((_, i) => (
          <span
            key={i}
            className="sn-skel"
            style={{ ['--w' as string]: `${60 + ((i * 17) % 35)}%` } as React.CSSProperties}
          />
        ))}
      </div>
      <p className="sn-loading-state__msg" role="status">{message}</p>
    </div>
  );
});
LoadingPanel.displayName = 'LoadingPanel';

/* ------------------------------------------------------------------ */
/* Domain Atoms: TrackEnergy & KeyCompat                              */
/* ------------------------------------------------------------------ */

export interface TrackEnergyProps extends React.HTMLAttributes<HTMLSpanElement> {
  energy?: number | null;
  scale?: string | null;
}

export const TrackEnergy = React.forwardRef<HTMLSpanElement, TrackEnergyProps>(({
  energy,
  scale,
  className = '',
  ...props
}, ref) => {
  const e = displayEnergy(energy, scale);
  if (e.value == null) return <EnergyBar value={null} />;
  if (!e.converted) return <EnergyBar value={e.value} />;

  const cls = ['sn-energy', className].filter(Boolean).join(' ');

  return (
    <span
      ref={ref}
      className={cls}
      title={`Converted from ${e.raw} (old 0–1 scale)${e.needsCheck ? '. Needs an energy check' : ''}`}
      {...props}
    >
      <EnergyBar value={e.value} />
      {e.needsCheck ? <span className="sn-energy-bar__flag">Check</span> : null}
    </span>
  );
});
TrackEnergy.displayName = 'TrackEnergy';

export interface KeyCompatProps extends React.HTMLAttributes<HTMLSpanElement> {
  from?: string | null;
  to?: string | null;
  outline?: boolean;
}

/** Verdict for a key move: SN.compat on two Camelot codes; unknown when either is missing. */
export const KeyCompat = React.forwardRef<HTMLSpanElement, KeyCompatProps>(({
  from,
  to,
  outline,
  ...props
}, ref) => {
  const a = from ? (SN?.camelot ? SN.camelot(from) : from) : null;
  const b = to ? (SN?.camelot ? SN.camelot(to) : to) : null;
  if (!a || !b) return <CompatibilityBadge ref={ref} level="unknown" label="key ?" outline={outline} {...props} />;
  const c = (SN?.compat ? SN.compat(a, b) : { level: 'unknown', label: 'key ?' }) as unknown as { level: CompatLevelDS; label: string };
  return <CompatibilityBadge ref={ref} level={c.level} label={c.label} outline={outline} {...props} />;
});
KeyCompat.displayName = 'KeyCompat';
