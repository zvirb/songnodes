/**
 * SongNodes Design System - TypeScript Token Constants
 * Version: 1.0.0
 * Last Updated: 2025-10-23
 *
 * This file provides TypeScript access to design tokens for use in
 * JavaScript/TypeScript code (e.g., PIXI.js, D3.js, canvas rendering).
 *
 * Usage:
 *   import { tokens, getColor, getSpace } from '@/lib/tokens';
 *   const primaryColor = getColor('brand-primary');
 *   const spacing = getSpace(4);
 */

/* ============================================
   TYPE DEFINITIONS
   ============================================ */

export interface ColorTokens {
  // Background
  'bg-base': string;
  'bg-elevated-1': string;
  'bg-elevated-2': string;
  'bg-elevated-3': string;
  'bg-elevated-4': string;
  'bg-elevated-5': string;

  // Brand
  'brand-primary': string;
  'brand-primary-hover': string;
  'brand-primary-active': string;
  'brand-primary-muted': string;
  'brand-secondary': string;
  'brand-secondary-hover': string;
  'brand-secondary-active': string;
  'brand-secondary-muted': string;
  'brand-tertiary': string;
  'brand-tertiary-hover': string;
  'brand-tertiary-active': string;
  'brand-tertiary-muted': string;

  // Text
  'text-primary': string;
  'text-secondary': string;
  'text-tertiary': string;
  'text-disabled': string;
  'text-inverse': string;
  'text-link': string;
  'text-link-hover': string;

  // Semantic
  success: string;
  warning: string;
  error: string;
  info: string;

  // Borders
  'border-default': string;
  'border-subtle': string;
  'border-strong': string;
  'border-focus': string;

  // Graph
  'node-default': string;
  'node-selected': string;
  'node-hover': string;
  'node-muted': string;
  'edge-default': string;
  'edge-active': string;
  'edge-path': string;
}

export interface SpaceTokens {
  0: number;
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
  6: number;
  8: number;
  10: number;
  12: number;
  16: number;
  20: number;
  24: number;
}

export interface FontSizeTokens {
  xs: string;
  sm: string;
  base: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  '4xl': string;
}

export interface RadiusTokens {
  none: string;
  sm: string;
  base: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  full: string;
}

export interface ShadowTokens {
  none: string;
  xs: string;
  sm: string;
  base: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  'glow-sm': string;
  'glow-md': string;
  'glow-lg': string;
}

export interface DurationTokens {
  instant: number;
  fast: number;
  base: number;
  slow: number;
  slower: number;
}

export interface ZIndexTokens {
  background: number;
  base: number;
  graph: number;
  panels: number;
  toolbar: number;
  header: number;
  modal: number;
  dropdown: number;
  tooltip: number;
  loading: number;
  notification: number;
  max: number;
}

export interface DesignTokens {
  colors: ColorTokens;
  space: SpaceTokens;
  fontSize: FontSizeTokens;
  radius: RadiusTokens;
  shadow: ShadowTokens;
  duration: DurationTokens;
  zIndex: ZIndexTokens;
}

/* ============================================
   TOKEN VALUES (synced with tokens.css)
   ============================================ */

/**
 * Color tokens
 * These values match the CSS custom properties in tokens.css
 */
export const colors: ColorTokens = {
  // Background
  'bg-base': '#0a0a0a',
  'bg-elevated-1': '#1a1a1a',
  'bg-elevated-2': '#2a2a2a',
  'bg-elevated-3': '#3a3a3a',
  'bg-elevated-4': '#4a4a4a',
  'bg-elevated-5': '#5a5a5a',

  // Brand
  'brand-primary': '#00ff41',
  'brand-primary-hover': '#00dd37',
  'brand-primary-active': '#00bb2f',
  'brand-primary-muted': 'rgba(0, 255, 65, 0.2)',
  'brand-secondary': '#44aaff',
  'brand-secondary-hover': '#66ccff',
  'brand-secondary-active': '#2288dd',
  'brand-secondary-muted': 'rgba(68, 170, 255, 0.2)',
  'brand-tertiary': '#ff4444',
  'brand-tertiary-hover': '#ff6666',
  'brand-tertiary-active': '#dd2222',
  'brand-tertiary-muted': 'rgba(255, 68, 68, 0.2)',

  // Text
  'text-primary': '#ffffff',
  'text-secondary': '#e0e0e0',
  'text-tertiary': '#b0b0b0',
  'text-disabled': '#808080',
  'text-inverse': '#0a0a0a',
  'text-link': '#00ff41',
  'text-link-hover': '#00dd37',

  // Semantic
  success: '#00ff41',
  warning: '#ffaa44',
  error: '#ff4444',
  info: '#44aaff',

  // Borders
  'border-default': '#4a4a4a',
  'border-subtle': '#333333',
  'border-strong': '#666666',
  'border-focus': '#00ff41',

  // Graph
  'node-default': '#44aaff',
  'node-selected': '#00ff41',
  'node-hover': '#66ccff',
  'node-muted': '#666666',
  'edge-default': '#333333',
  'edge-active': '#666666',
  'edge-path': '#00ff41',
};

/**
 * Spacing tokens (8pt grid system)
 * Values in pixels
 */
export const space: SpaceTokens = {
  0: 0,
  1: 4,    // 0.25rem
  2: 8,    // 0.5rem
  3: 12,   // 0.75rem
  4: 16,   // 1rem
  5: 20,   // 1.25rem
  6: 24,   // 1.5rem
  8: 32,   // 2rem
  10: 40,  // 2.5rem
  12: 48,  // 3rem
  16: 64,  // 4rem
  20: 80,  // 5rem
  24: 96,  // 6rem
};

/**
 * Font size tokens (Major Third scale: 1.250)
 */
export const fontSize: FontSizeTokens = {
  xs: '0.694rem',   // 11.1px
  sm: '0.833rem',   // 13.3px
  base: '1rem',     // 16px
  lg: '1.2rem',     // 19.2px
  xl: '1.44rem',    // 23px
  '2xl': '1.728rem', // 27.6px
  '3xl': '2.074rem', // 33.2px
  '4xl': '2.488rem', // 39.8px
};

/**
 * Border radius tokens
 */
export const radius: RadiusTokens = {
  none: '0',
  sm: '0.25rem',   // 4px
  base: '0.375rem', // 6px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
  '2xl': '1.25rem', // 20px
  '3xl': '1.5rem',  // 24px
  full: '9999px',
};

/**
 * Shadow tokens
 */
export const shadow: ShadowTokens = {
  none: 'none',
  xs: '0 1px 2px rgba(0, 0, 0, 0.4)',
  sm: '0 1px 3px rgba(0, 0, 0, 0.5)',
  base: '0 2px 4px rgba(0, 0, 0, 0.6)',
  md: '0 4px 6px rgba(0, 0, 0, 0.6)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.7)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.8)',
  '2xl': '0 25px 50px rgba(0, 0, 0, 0.9)',
  'glow-sm': '0 0 10px rgba(0, 255, 65, 0.5)',
  'glow-md': '0 0 20px rgba(0, 255, 65, 0.6)',
  'glow-lg': '0 0 30px rgba(0, 255, 65, 0.7)',
};

/**
 * Duration tokens (in milliseconds)
 */
export const duration: DurationTokens = {
  instant: 0,
  fast: 150,
  base: 250,
  slow: 400,
  slower: 600,
};

/**
 * Z-index tokens
 */
export const zIndex: ZIndexTokens = {
  background: 0,
  base: 1,
  graph: 10,
  panels: 20,
  toolbar: 30,
  header: 40,
  modal: 50,
  dropdown: 60,
  tooltip: 70,
  loading: 80,
  notification: 90,
  max: 100,
};

/**
 * Complete design token object
 */
export const tokens: DesignTokens = {
  colors,
  space,
  fontSize,
  radius,
  shadow,
  duration,
  zIndex,
};

/* ============================================
   UTILITY FUNCTIONS
   ============================================ */

/**
 * Get a color value from the color tokens
 * @param colorKey - The color token key
 * @returns The color value as a string
 */
export function getColor(colorKey: keyof ColorTokens): string {
  return colors[colorKey];
}

/**
 * Get a spacing value in pixels
 * @param spaceKey - The spacing token key
 * @returns The spacing value in pixels
 */
export function getSpace(spaceKey: keyof SpaceTokens): number {
  return space[spaceKey];
}

/**
 * Get a font size value
 * @param sizeKey - The font size token key
 * @returns The font size value as a string
 */
export function getFontSize(sizeKey: keyof FontSizeTokens): string {
  return fontSize[sizeKey];
}

/**
 * Get a border radius value
 * @param radiusKey - The radius token key
 * @returns The radius value as a string
 */
export function getRadius(radiusKey: keyof RadiusTokens): string {
  return radius[radiusKey];
}

/**
 * Get a shadow value
 * @param shadowKey - The shadow token key
 * @returns The shadow value as a string
 */
export function getShadow(shadowKey: keyof ShadowTokens): string {
  return shadow[shadowKey];
}

/**
 * Get a duration value in milliseconds
 * @param durationKey - The duration token key
 * @returns The duration value in milliseconds
 */
export function getDuration(durationKey: keyof DurationTokens): number {
  return duration[durationKey];
}

/**
 * Get a z-index value
 * @param zIndexKey - The z-index token key
 * @returns The z-index value
 */
export function getZIndex(zIndexKey: keyof ZIndexTokens): number {
  return zIndex[zIndexKey];
}

/**
 * Convert a hex color to RGB components
 * @param hex - Hex color string (e.g., '#00ff41')
 * @returns RGB object { r, g, b }
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Convert a hex color to RGBA string
 * @param hex - Hex color string (e.g., '#00ff41')
 * @param alpha - Alpha value (0-1)
 * @returns RGBA color string
 */
export function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(0, 0, 0, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Convert hex color to PIXI.js compatible number
 * @param hex - Hex color string (e.g., '#00ff41')
 * @returns Number representation of the color
 */
export function hexToPixi(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/**
 * Get a CSS variable value from the DOM
 * Useful for runtime token access
 * @param varName - CSS variable name (with or without --)
 * @returns The computed value
 */
export function getCssVar(varName: string): string {
  const name = varName.startsWith('--') ? varName : `--${varName}`;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Set a CSS variable value on the DOM
 * @param varName - CSS variable name (with or without --)
 * @param value - The value to set
 */
export function setCssVar(varName: string, value: string): void {
  const name = varName.startsWith('--') ? varName : `--${varName}`;
  document.documentElement.style.setProperty(name, value);
}

/**
 * Check if user prefers reduced motion
 * @returns True if reduced motion is preferred
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if user prefers dark mode
 * @returns True if dark mode is preferred
 */
export function prefersDarkMode(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Check if user prefers high contrast
 * @returns True if high contrast is preferred
 */
export function prefersHighContrast(): boolean {
  return window.matchMedia('(prefers-contrast: high)').matches;
}

/**
 * Create an alpha variant of a color
 * @param colorKey - The color token key
 * @param alpha - Alpha value (0-1)
 * @returns RGBA color string
 */
export function withAlpha(colorKey: keyof ColorTokens, alpha: number): string {
  const color = getColor(colorKey);
  if (color.startsWith('rgba')) {
    // Already has alpha, replace it
    return color.replace(/[\d.]+\)$/g, `${alpha})`);
  }
  return hexToRgba(color, alpha);
}

/* ============================================
   THEME UTILITIES
   ============================================ */

export interface Theme {
  name: string;
  tokens: DesignTokens;
}

/**
 * Default dark theme (current theme)
 */
export const darkTheme: Theme = {
  name: 'dark',
  tokens,
};

/**
 * Apply a theme to the document
 * @param theme - The theme to apply
 */
export function applyTheme(theme: Theme): void {
  // Set data attribute for CSS hooks
  document.documentElement.setAttribute('data-theme', theme.name);

  // Update CSS variables (if needed in future)
  // For now, our CSS variables are static in tokens.css
}

/**
 * Get the current theme
 * @returns The current theme
 */
export function getCurrentTheme(): Theme {
  const themeName = document.documentElement.getAttribute('data-theme') || 'dark';
  return themeName === 'dark' ? darkTheme : darkTheme; // Only dark theme for now
}

/* ============================================
   RESPONSIVE UTILITIES
   ============================================ */

/**
 * Breakpoint values (in pixels)
 */
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

/**
 * Check if current viewport matches a breakpoint
 * @param breakpoint - The breakpoint to check
 * @returns True if viewport is at or above the breakpoint
 */
export function isBreakpoint(breakpoint: keyof typeof breakpoints): boolean {
  return window.innerWidth >= breakpoints[breakpoint];
}

/**
 * Get the current breakpoint
 * @returns The current breakpoint name
 */
export function getCurrentBreakpoint(): keyof typeof breakpoints | 'xs' {
  const width = window.innerWidth;
  if (width >= breakpoints['2xl']) return '2xl';
  if (width >= breakpoints.xl) return 'xl';
  if (width >= breakpoints.lg) return 'lg';
  if (width >= breakpoints.md) return 'md';
  if (width >= breakpoints.sm) return 'sm';
  return 'xs';
}

/* ============================================
   EXPORTS
   ============================================ */

export default tokens;
