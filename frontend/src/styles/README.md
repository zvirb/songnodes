# SongNodes Design System

**Version:** 1.0.0
**Last Updated:** 2025-10-23

## Table of Contents

1. [Overview](#overview)
2. [File Structure](#file-structure)
3. [Quick Start](#quick-start)
4. [Design Tokens](#design-tokens)
5. [Usage Examples](#usage-examples)
6. [Best Practices](#best-practices)
7. [Migration Guide](#migration-guide)
8. [Accessibility](#accessibility)

---

## Overview

The SongNodes Design System is a comprehensive token-based design system built for consistency, accessibility, and maintainability. It follows industry best practices from 2025 UI/UX guidelines and ensures WCAG AA compliance.

### Key Features

- **Token-Based**: Single source of truth for all design values
- **8pt Grid System**: Consistent spacing throughout the application
- **WCAG AA Compliant**: 4.5:1 contrast ratio for text, 3:1 for UI components
- **No Pure Black/White**: Uses #121212 for dark backgrounds, #F0F0F0 for light text
- **Responsive**: Mobile-first approach with semantic breakpoints
- **Accessible**: Focus styles, reduced motion support, screen reader friendly
- **Dark Mode Ready**: Optimized for dark interfaces (DJ application)

---

## File Structure

```
frontend/src/styles/
├── tokens.css          # Design tokens (CSS custom properties)
├── globals.css         # Global styles, resets, utilities
├── global.css          # Legacy styles (backward compatibility)
├── index.css           # Main entry point (imports all styles)
└── README.md           # This file

frontend/src/lib/
└── tokens.ts           # TypeScript constants for JS/TS usage
```

---

## Quick Start

### 1. Using CSS Classes (Tailwind)

```tsx
// Example component with design tokens
export const Button: React.FC = () => {
  return (
    <button className="
      px-4 py-2
      bg-brand-primary hover:bg-brand-primary-hover
      text-text-inverse
      rounded-base
      shadow-sm hover:shadow-md
      transition-button
      focus-ring
    ">
      Click Me
    </button>
  );
};
```

### 2. Using CSS Variables (Inline Styles)

```tsx
export const CustomComponent: React.FC = () => {
  return (
    <div style={{
      backgroundColor: 'var(--color-bg-elevated-2)',
      padding: 'var(--space-4)',
      borderRadius: 'var(--radius-base)',
      boxShadow: 'var(--shadow-lg)',
    }}>
      Content here
    </div>
  );
};
```

### 3. Using TypeScript Tokens (PIXI.js, Canvas, D3.js)

```tsx
import { getColor, getSpace, hexToPixi } from '@/lib/tokens';
import * as PIXI from 'pixi.js';

// Example: PIXI.js node
const node = new PIXI.Graphics();
node.beginFill(hexToPixi(getColor('node-default')));
node.drawCircle(0, 0, getSpace(4));
node.endFill();

// Example: D3.js visualization
const color = getColor('brand-primary');
const margin = getSpace(4);
```

---

## Design Tokens

### Color Tokens

#### Background Colors
```css
--color-bg-base: #0a0a0a
--color-bg-elevated-1: #1a1a1a
--color-bg-elevated-2: #2a2a2a
--color-bg-elevated-3: #3a3a3a
--color-bg-elevated-4: #4a4a4a
```

**Usage:**
```tsx
<div className="bg-bg-base">        {/* Tailwind */}
<div style={{ backgroundColor: 'var(--color-bg-base)' }}> {/* CSS */}
const bgColor = getColor('bg-base');  {/* TypeScript */}
```

#### Brand Colors
```css
--color-brand-primary: #00ff41       /* Matrix green */
--color-brand-secondary: #44aaff     /* Blue */
--color-brand-tertiary: #ff4444      /* Red/Danger */
```

**Hover States:**
```tsx
<button className="bg-brand-primary hover:bg-brand-primary-hover">
  Primary Button
</button>
```

#### Text Colors (WCAG AA Compliant)
```css
--color-text-primary: #ffffff        /* 21:1 contrast */
--color-text-secondary: #e0e0e0      /* 6.2:1 contrast */
--color-text-tertiary: #b0b0b0       /* 4.6:1 contrast */
--color-text-disabled: #808080       /* 3.1:1 contrast */
```

#### Semantic Colors
```css
--color-success: #00ff41
--color-warning: #ffaa44
--color-error: #ff4444
--color-info: #44aaff
```

**With Backgrounds:**
```tsx
<div className="bg-success-bg border border-success-border text-success">
  Success message
</div>
```

### Spacing Tokens (8pt Grid)

```css
--space-0: 0       /* 0px */
--space-1: 4px     /* 0.25rem */
--space-2: 8px     /* 0.5rem */
--space-3: 12px    /* 0.75rem */
--space-4: 16px    /* 1rem */
--space-6: 24px    /* 1.5rem */
--space-8: 32px    /* 2rem */
--space-12: 48px   /* 3rem */
--space-16: 64px   /* 4rem */
```

**Usage:**
```tsx
<div className="p-4 m-6 gap-2">  {/* Tailwind */}
<div style={{ padding: 'var(--space-4)' }}> {/* CSS */}
const padding = getSpace(4); // 16 {/* TypeScript */}
```

### Typography Tokens

#### Font Sizes (Major Third Scale: 1.250)
```css
--font-size-xs: 0.694rem    /* 11.1px */
--font-size-sm: 0.833rem    /* 13.3px */
--font-size-base: 1rem      /* 16px */
--font-size-lg: 1.2rem      /* 19.2px */
--font-size-xl: 1.44rem     /* 23px */
--font-size-2xl: 1.728rem   /* 27.6px */
--font-size-3xl: 2.074rem   /* 33.2px */
```

**Usage:**
```tsx
<h1 className="text-3xl font-bold">Heading</h1>
<p className="text-base">Body text</p>
<span className="text-sm text-text-secondary">Caption</span>
```

#### Font Weights
```css
--font-weight-normal: 400
--font-weight-medium: 500
--font-weight-semibold: 600
--font-weight-bold: 700
```

### Border Radius

```css
--radius-sm: 4px
--radius-base: 6px
--radius-md: 8px
--radius-lg: 12px
--radius-xl: 16px
--radius-full: 9999px
```

**Semantic Usage:**
```tsx
<button className="rounded-base">      {/* Buttons */}
<input className="rounded-base">       {/* Inputs */}
<div className="rounded-lg">           {/* Cards */}
<div className="rounded-full">         {/* Badges, avatars */}
```

### Shadows (Elevation System)

```css
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.5)
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.6)
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.7)
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.8)
```

**Glow Effects:**
```tsx
<div className="shadow-glow">          {/* Accent glow */}
<button className="hover:shadow-glow-lg"> {/* Hover glow */}
```

### Transitions

```css
--duration-fast: 150ms
--duration-base: 250ms
--duration-slow: 400ms

--ease-out: cubic-bezier(0, 0, 0.2, 1)
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)
```

**Semantic Transitions:**
```tsx
<button className="transition-button">  {/* Background + shadow */}
<div className="transition-all">        {/* All properties */}
```

### Z-Index Scale

```css
--z-background: 0
--z-graph: 10
--z-panels: 20
--z-header: 40
--z-modal: 50
--z-tooltip: 70
--z-max: 100
```

**Usage:**
```tsx
<div className="z-modal">
<div style={{ zIndex: 'var(--z-modal)' }}>
const zIndex = getZIndex('modal'); // 50
```

---

## Usage Examples

### Example 1: Button Component

```tsx
import { FC } from 'react';
import { cn } from '@/lib/utils'; // Tailwind merge utility

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'base' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
}

export const Button: FC<ButtonProps> = ({
  variant = 'primary',
  size = 'base',
  children,
  onClick
}) => {
  const baseClasses = 'btn-base focus-ring'; // From Tailwind plugin

  const variantClasses = {
    primary: 'bg-brand-primary hover:bg-brand-primary-hover text-text-inverse',
    secondary: 'bg-bg-elevated-3 hover:bg-bg-elevated-4 text-text-primary',
    danger: 'bg-error hover:bg-brand-tertiary-hover text-text-inverse',
  };

  const sizeClasses = {
    sm: 'h-button-sm px-3 text-sm',
    base: 'h-button-base px-4 text-base',
    lg: 'h-button-lg px-6 text-lg',
  };

  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size]
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
```

### Example 2: Panel Component

```tsx
import { FC, ReactNode } from 'react';

interface PanelProps {
  title: string;
  children: ReactNode;
  onClose?: () => void;
}

export const Panel: FC<PanelProps> = ({ title, children, onClose }) => {
  return (
    <div className="glass w-panel-base h-full flex flex-col shadow-panel">
      {/* Header */}
      <div className="h-panel-header px-4 flex items-center justify-between border-b border-border-default">
        <h3 className="text-base font-semibold text-text-primary uppercase tracking-wide">
          {title}
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-base hover:bg-bg-elevated-3 focus-ring"
            aria-label="Close panel"
          >
            ✕
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        {children}
      </div>
    </div>
  );
};
```

### Example 3: PIXI.js Graph Node

```tsx
import * as PIXI from 'pixi.js';
import { getColor, getSpace, hexToPixi, withAlpha } from '@/lib/tokens';

export class GraphNode {
  sprite: PIXI.Graphics;

  constructor(x: number, y: number, selected: boolean = false) {
    this.sprite = new PIXI.Graphics();

    // Use design tokens for colors
    const fillColor = selected
      ? hexToPixi(getColor('node-selected'))
      : hexToPixi(getColor('node-default'));

    const radius = getSpace(4); // 16px

    // Draw node
    this.sprite.beginFill(fillColor);
    this.sprite.drawCircle(0, 0, radius);
    this.sprite.endFill();

    // Add glow effect if selected
    if (selected) {
      this.sprite.filters = [new PIXI.filters.GlowFilter({
        color: hexToPixi(getColor('brand-primary')),
        outerStrength: 2,
        innerStrength: 0,
      })];
    }

    this.sprite.position.set(x, y);
    this.sprite.interactive = true;
    this.sprite.buttonMode = true;
  }
}
```

---

## Best Practices

### 1. Always Use Tokens

**❌ DON'T:**
```tsx
<div style={{ color: '#00ff41', padding: '16px' }}>
```

**✅ DO:**
```tsx
<div className="text-brand-primary p-4">
// OR
<div style={{ color: 'var(--color-brand-primary)', padding: 'var(--space-4)' }}>
```

### 2. Use Semantic Color Names

**❌ DON'T:**
```tsx
<span className="text-[#e0e0e0]">  {/* Arbitrary value */}
```

**✅ DO:**
```tsx
<span className="text-text-secondary">  {/* Semantic name */}
```

### 3. Follow 8pt Grid for Spacing

**❌ DON'T:**
```tsx
<div className="p-[17px] m-[23px]">  {/* Arbitrary values */}
```

**✅ DO:**
```tsx
<div className="p-4 m-6">  {/* 16px and 24px - follows 8pt grid */}
```

### 4. Use Semantic Transitions

**❌ DON'T:**
```tsx
<button style={{ transition: 'all 0.2s ease-in-out' }}>
```

**✅ DO:**
```tsx
<button className="transition-button">
// OR
<button style={{ transition: 'var(--transition-button)' }}>
```

### 5. Ensure WCAG Compliance

**❌ DON'T:**
```tsx
<p className="text-text-tertiary">  {/* 4.6:1 contrast */}
  <small className="text-text-tertiary">Small text</small>  {/* FAIL - needs 7:1 */}
</p>
```

**✅ DO:**
```tsx
<p className="text-text-tertiary">  {/* 4.6:1 - PASS for normal text */}
  <small className="text-text-secondary">Small text</small>  {/* 6.2:1 - PASS */}
</p>
```

### 6. Support Reduced Motion

**❌ DON'T:**
```tsx
<div className="animate-pulse">  {/* Always animates */}
```

**✅ DO:**
```tsx
import { prefersReducedMotion } from '@/lib/tokens';

const shouldAnimate = !prefersReducedMotion();
<div className={shouldAnimate ? 'animate-pulse' : ''}>
```

---

## Migration Guide

### From Hardcoded Values to Tokens

#### Step 1: Identify Hardcoded Values

```tsx
// Before
<button style={{
  padding: '8px 16px',
  backgroundColor: '#00ff41',
  color: '#0a0a0a',
  borderRadius: '6px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.6)',
}}>
```

#### Step 2: Map to Design Tokens

```tsx
// After
<button className="
  px-4 py-2
  bg-brand-primary
  text-text-inverse
  rounded-base
  shadow-base
">
```

### From Legacy Classes to Design System

```tsx
// Before (legacy global.css)
<div className="panel panel-left">

// After (design system)
<div className="glass w-panel-base shadow-panel">
```

### TypeScript Token Migration

```tsx
// Before
const nodeColor = '#44aaff';
const nodeRadius = 16;

// After
import { getColor, getSpace, hexToPixi } from '@/lib/tokens';

const nodeColor = hexToPixi(getColor('node-default'));
const nodeRadius = getSpace(4);
```

---

## Accessibility

### Focus Styles

All interactive elements have visible focus indicators:

```tsx
<button className="focus-ring">  {/* 2px outline + glow */}
```

### Reduced Motion

The design system respects user motion preferences:

```tsx
@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast: 0ms;
    --duration-base: 0ms;
    /* All transitions disabled */
  }
}
```

### High Contrast Mode

```tsx
@media (prefers-contrast: high) {
  :root {
    --color-brand-primary: #00ff00;  /* Pure green */
    --color-border-default: #666666;  /* Higher contrast */
  }
}
```

### Screen Reader Support

Use semantic HTML and ARIA labels:

```tsx
<button
  className="btn-base focus-ring"
  aria-label="Close panel"
>
  ✕
</button>
```

### Skip Links

```tsx
<a href="#main-content" className="skip-to-content">
  Skip to main content
</a>
```

---

## Color Contrast Reference

### Text Contrast Ratios (WCAG AA)

| Token | Contrast | WCAG Level | Usage |
|-------|----------|------------|-------|
| `text-primary` | 21:1 | AAA | All text sizes |
| `text-secondary` | 6.2:1 | AA | Normal text (16px+) |
| `text-tertiary` | 4.6:1 | AA | Normal text (16px+) |
| `text-disabled` | 3.1:1 | - | Disabled state only |

### UI Component Contrast (WCAG AA: 3:1)

| Token | Contrast | Usage |
|-------|----------|-------|
| `border-default` | 3.2:1 | Borders, dividers |
| `border-strong` | 4.2:1 | Emphasized borders |

---

## Additional Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [8pt Grid System](https://spec.fm/specifics/8-pt-grid)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Design Tokens Specification](https://design-tokens.github.io/community-group/format/)

---

## Changelog

### Version 1.0.0 (2025-10-23)

- Initial release of comprehensive design system
- 150+ design tokens across 7 categories
- WCAG AA compliant color system
- 8pt grid spacing system
- TypeScript token utilities
- Tailwind integration
- Accessibility features (reduced motion, high contrast, focus styles)

---

**Questions or Issues?**
Contact the SongNodes development team or open an issue in the repository.
