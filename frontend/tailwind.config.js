/**
 * SongNodes Tailwind Configuration
 * Version: 1.0.0
 * Last Updated: 2025-10-23
 *
 * This configuration integrates design tokens from tokens.css
 * with Tailwind utilities for a unified design system.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      /* ============================================
         COLORS - Map to CSS Variables
         ============================================ */
      colors: {
        // Background colors
        bg: {
          base: 'var(--color-bg-base)',
          elevated1: 'var(--color-bg-elevated-1)',
          elevated2: 'var(--color-bg-elevated-2)',
          elevated3: 'var(--color-bg-elevated-3)',
          elevated4: 'var(--color-bg-elevated-4)',
          elevated5: 'var(--color-bg-elevated-5)',
        },

        // Brand colors
        brand: {
          primary: 'var(--color-brand-primary)',
          'primary-hover': 'var(--color-brand-primary-hover)',
          'primary-active': 'var(--color-brand-primary-active)',
          'primary-muted': 'var(--color-brand-primary-muted)',
          secondary: 'var(--color-brand-secondary)',
          'secondary-hover': 'var(--color-brand-secondary-hover)',
          'secondary-active': 'var(--color-brand-secondary-active)',
          'secondary-muted': 'var(--color-brand-secondary-muted)',
          tertiary: 'var(--color-brand-tertiary)',
          'tertiary-hover': 'var(--color-brand-tertiary-hover)',
          'tertiary-active': 'var(--color-brand-tertiary-active)',
          'tertiary-muted': 'var(--color-brand-tertiary-muted)',
        },

        // Text colors
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          disabled: 'var(--color-text-disabled)',
          inverse: 'var(--color-text-inverse)',
          link: 'var(--color-text-link)',
          'link-hover': 'var(--color-text-link-hover)',
          'link-active': 'var(--color-text-link-active)',
        },

        // Semantic colors
        success: 'var(--color-success)',
        'success-bg': 'var(--color-success-bg)',
        'success-border': 'var(--color-success-border)',
        warning: 'var(--color-warning)',
        'warning-bg': 'var(--color-warning-bg)',
        'warning-border': 'var(--color-warning-border)',
        error: 'var(--color-error)',
        'error-bg': 'var(--color-error-bg)',
        'error-border': 'var(--color-error-border)',
        info: 'var(--color-info)',
        'info-bg': 'var(--color-info-bg)',
        'info-border': 'var(--color-info-border)',

        // Border colors
        border: {
          DEFAULT: 'var(--color-border-default)',
          subtle: 'var(--color-border-subtle)',
          strong: 'var(--color-border-strong)',
          focus: 'var(--color-border-focus)',
          error: 'var(--color-border-error)',
          success: 'var(--color-border-success)',
          warning: 'var(--color-border-warning)',
        },

        // Component-specific colors
        button: {
          bg: 'var(--color-button-bg)',
          hover: 'var(--color-button-hover)',
          active: 'var(--color-button-active)',
          disabled: 'var(--color-button-disabled)',
        },
        input: {
          bg: 'var(--color-input-bg)',
          border: 'var(--color-input-border)',
          focus: 'var(--color-input-focus)',
        },
        panel: {
          bg: 'var(--color-panel-bg)',
          border: 'var(--color-panel-border)',
        },
        modal: {
          bg: 'var(--color-modal-bg)',
          overlay: 'var(--color-modal-overlay)',
        },
        card: {
          bg: 'var(--color-card-bg)',
          border: 'var(--color-card-border)',
          hover: 'var(--color-card-hover)',
        },

        // Graph colors
        node: {
          default: 'var(--color-node-default)',
          selected: 'var(--color-node-selected)',
          hover: 'var(--color-node-hover)',
          muted: 'var(--color-node-muted)',
          disabled: 'var(--color-node-disabled)',
        },
        edge: {
          default: 'var(--color-edge-default)',
          active: 'var(--color-edge-active)',
          path: 'var(--color-edge-path)',
          hover: 'var(--color-edge-hover)',
        },

        // Legacy color mappings (for backward compatibility)
        'dj-black': 'var(--color-bg-base)',
        'dj-dark': 'var(--color-bg-elevated-1)',
        'dj-gray': 'var(--color-bg-elevated-2)',
        'dj-light-gray': 'var(--color-bg-elevated-3)',
        'dj-accent': 'var(--color-brand-primary)',
        'dj-danger': 'var(--color-error)',
        'dj-warning': 'var(--color-warning)',
        'dj-info': 'var(--color-info)',
      },

      /* ============================================
         SPACING - 8pt Grid System
         ============================================ */
      spacing: {
        0: 'var(--space-0)',
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        5: 'var(--space-5)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
        10: 'var(--space-10)',
        12: 'var(--space-12)',
        16: 'var(--space-16)',
        20: 'var(--space-20)',
        24: 'var(--space-24)',
      },

      /* ============================================
         TYPOGRAPHY
         ============================================ */
      fontFamily: {
        sans: 'var(--font-family-base)',
        mono: 'var(--font-family-mono)',
        display: 'var(--font-family-display)',
      },

      fontSize: {
        xs: 'var(--font-size-xs)',
        sm: 'var(--font-size-sm)',
        base: 'var(--font-size-base)',
        lg: 'var(--font-size-lg)',
        xl: 'var(--font-size-xl)',
        '2xl': 'var(--font-size-2xl)',
        '3xl': 'var(--font-size-3xl)',
        '4xl': 'var(--font-size-4xl)',
      },

      lineHeight: {
        tight: 'var(--line-height-tight)',
        normal: 'var(--line-height-normal)',
        relaxed: 'var(--line-height-relaxed)',
      },

      fontWeight: {
        normal: 'var(--font-weight-normal)',
        medium: 'var(--font-weight-medium)',
        semibold: 'var(--font-weight-semibold)',
        bold: 'var(--font-weight-bold)',
        black: 'var(--font-weight-black)',
      },

      letterSpacing: {
        tight: 'var(--letter-spacing-tight)',
        normal: 'var(--letter-spacing-normal)',
        wide: 'var(--letter-spacing-wide)',
        wider: 'var(--letter-spacing-wider)',
        widest: 'var(--letter-spacing-widest)',
      },

      /* ============================================
         BORDER RADIUS
         ============================================ */
      borderRadius: {
        none: 'var(--radius-none)',
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-base)',
        base: 'var(--radius-base)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        full: 'var(--radius-full)',
      },

      /* ============================================
         SHADOWS
         ============================================ */
      boxShadow: {
        none: 'var(--shadow-none)',
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-base)',
        base: 'var(--shadow-base)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)',
        // Glow effects
        'glow-sm': 'var(--glow-accent-sm)',
        'glow-md': 'var(--glow-accent-md)',
        'glow-lg': 'var(--glow-accent-lg)',
        glow: 'var(--glow-accent-md)',
        focus: 'var(--glow-focus)',
      },

      /* ============================================
         TRANSITIONS
         ============================================ */
      transitionDuration: {
        instant: 'var(--duration-instant)',
        fast: 'var(--duration-fast)',
        DEFAULT: 'var(--duration-base)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
        slower: 'var(--duration-slower)',
      },

      transitionTimingFunction: {
        linear: 'var(--ease-linear)',
        in: 'var(--ease-in)',
        out: 'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
        spring: 'var(--ease-spring)',
        smooth: 'var(--ease-smooth)',
      },

      /* ============================================
         Z-INDEX
         ============================================ */
      zIndex: {
        background: 'var(--z-background)',
        base: 'var(--z-base)',
        graph: 'var(--z-graph)',
        panels: 'var(--z-panels)',
        toolbar: 'var(--z-toolbar)',
        header: 'var(--z-header)',
        modal: 'var(--z-modal)',
        dropdown: 'var(--z-dropdown)',
        tooltip: 'var(--z-tooltip)',
        loading: 'var(--z-loading)',
        notification: 'var(--z-notification)',
        max: 'var(--z-max)',
      },

      /* ============================================
         ANIMATIONS
         ============================================ */
      animation: {
        // Existing animations
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        glow: 'glow 2s ease-in-out infinite alternate',

        // New animations from globals.css
        'fade-in': 'fadeIn var(--duration-base) var(--ease-out)',
        'fade-out': 'fadeOut var(--duration-base) var(--ease-out)',
        'slide-in-up': 'slideInUp var(--duration-base) var(--ease-out)',
        'slide-in-down': 'slideInDown var(--duration-base) var(--ease-out)',
        'slide-in-left': 'slideInLeft var(--duration-base) var(--ease-out)',
        'slide-in-right': 'slideInRight var(--duration-base) var(--ease-out)',
        'scale-in': 'scaleIn var(--duration-base) var(--ease-out)',
        spin: 'spin 0.8s linear infinite',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
        'connection-pulse': 'connectionPulse 2s ease-in-out infinite',
        'node-select': 'nodeSelect 0.3s var(--ease-spring)',
      },

      keyframes: {
        // Keep existing glow keyframe
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 255, 65, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 255, 65, 0.8)' },
        },
        // Additional keyframes are defined in globals.css
      },

      /* ============================================
         COMPONENT-SPECIFIC SIZING
         ============================================ */
      height: {
        'button-xs': 'var(--button-height-xs)',
        'button-sm': 'var(--button-height-sm)',
        'button-base': 'var(--button-height-base)',
        'button-lg': 'var(--button-height-lg)',
        'input-sm': 'var(--input-height-sm)',
        'input-base': 'var(--input-height-base)',
        'input-lg': 'var(--input-height-lg)',
        'header': 'var(--layout-header-height)',
        'toolbar': 'var(--layout-toolbar-height)',
        'panel-header': 'var(--panel-header-height)',
      },

      width: {
        'panel-sm': 'var(--panel-width-sm)',
        'panel-base': 'var(--panel-width-base)',
        'panel-lg': 'var(--panel-width-lg)',
        'modal-sm': 'var(--modal-width-sm)',
        'modal-base': 'var(--modal-width-base)',
        'modal-lg': 'var(--modal-width-lg)',
        'modal-xl': 'var(--modal-width-xl)',
        'sidebar': 'var(--layout-sidebar-width)',
      },

      /* ============================================
         BACKDROP BLUR
         ============================================ */
      backdropBlur: {
        glass: '10px',
        'glass-strong': '20px',
      },
    },
  },

  /* ============================================
     PLUGINS
     ============================================ */
  plugins: [
    // Custom utility plugin for design system
    function({ addUtilities, addComponents }) {
      // Add glassmorphism utilities
      addUtilities({
        '.glass': {
          'background': 'var(--color-panel-bg)',
          'backdrop-filter': 'blur(10px)',
          '-webkit-backdrop-filter': 'blur(10px)',
          'border': '1px solid var(--color-border-subtle)',
        },
        '.glass-strong': {
          'background': 'rgba(26, 26, 26, 0.98)',
          'backdrop-filter': 'blur(20px)',
          '-webkit-backdrop-filter': 'blur(20px)',
          'border': '1px solid var(--color-border-default)',
        },
      });

      // Add text utilities
      addUtilities({
        '.text-balance': {
          'text-wrap': 'balance',
        },
        '.text-pretty': {
          'text-wrap': 'pretty',
        },
      });

      // Add component classes
      addComponents({
        '.btn-base': {
          'display': 'inline-flex',
          'align-items': 'center',
          'justify-content': 'center',
          'border-radius': 'var(--radius-button)',
          'font-weight': 'var(--font-weight-medium)',
          'transition': 'var(--transition-button)',
          'cursor': 'pointer',
          'user-select': 'none',
          '&:disabled': {
            'cursor': 'not-allowed',
            'opacity': '0.5',
          },
        },
        '.input-base': {
          'width': '100%',
          'border-radius': 'var(--radius-input)',
          'border': '1px solid var(--color-input-border)',
          'background-color': 'var(--color-input-bg)',
          'padding-left': 'var(--input-padding-x)',
          'padding-right': 'var(--input-padding-x)',
          'padding-top': 'var(--input-padding-y)',
          'padding-bottom': 'var(--input-padding-y)',
          'transition': 'var(--transition-all)',
          '&:focus': {
            'outline': 'none',
            'border-color': 'var(--color-input-focus)',
            'box-shadow': 'var(--glow-focus)',
          },
        },
      });
    },
  ],
};
