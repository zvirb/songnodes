# SongNodes Design Tokens - Quick Reference Card

**Version:** 1.0.0 | **Last Updated:** 2025-10-23

---

## Colors

### Backgrounds
```
bg-base           #0a0a0a    bg-elevated-1     #1a1a1a
bg-elevated-2     #2a2a2a    bg-elevated-3     #3a3a3a
bg-elevated-4     #4a4a4a    bg-elevated-5     #5a5a5a
```

### Brand
```
brand-primary          #00ff41    (Matrix green)
brand-secondary        #44aaff    (Blue)
brand-tertiary         #ff4444    (Red)
```

### Text (WCAG AA)
```
text-primary      #ffffff    (21:1 contrast)
text-secondary    #e0e0e0    (6.2:1 contrast)
text-tertiary     #b0b0b0    (4.6:1 contrast)
text-disabled     #808080    (3.1:1 contrast)
```

### Semantic
```
success    #00ff41    warning    #ffaa44
error      #ff4444    info       #44aaff
```

### Borders
```
border-default    #4a4a4a    (3.2:1 contrast)
border-subtle     #333333    border-strong     #666666
border-focus      #00ff41
```

---

## Spacing (8pt Grid)

```
0:   0px      1:   4px      2:   8px      3:  12px
4:  16px ⭐    5:  20px      6:  24px      8:  32px
10: 40px     12:  48px ⭐   16:  64px     20:  80px
24: 96px
```

**Semantic:**
```
space-inline      4px     (icon-text gap)
space-element    16px     (between elements)
space-component  24px     (between components)
space-section    48px     (between sections)
```

---

## Typography

### Font Sizes (Major Third: 1.250)
```
xs     11.1px     sm     13.3px     base   16px ⭐
lg     19.2px     xl     23px       2xl    27.6px
3xl    33.2px     4xl    39.8px
```

### Font Weights
```
normal: 400    medium: 500    semibold: 600    bold: 700
```

### Line Heights
```
tight: 1.25    normal: 1.5 ⭐    relaxed: 1.75
```

---

## Border Radius

```
sm:   4px     base:  6px ⭐    md:    8px     lg:   12px
xl:  16px     2xl:  20px       3xl:  24px     full: 9999px
```

---

## Shadows

```
xs:    0 1px 2px rgba(0,0,0,0.4)
sm:    0 1px 3px rgba(0,0,0,0.5)
base:  0 2px 4px rgba(0,0,0,0.6)
md:    0 4px 6px rgba(0,0,0,0.6)
lg:    0 10px 15px rgba(0,0,0,0.7) ⭐
xl:    0 20px 25px rgba(0,0,0,0.8)
2xl:   0 25px 50px rgba(0,0,0,0.9)
```

**Glow:**
```
glow-sm:  0 0 10px rgba(0,255,65,0.5)
glow-md:  0 0 20px rgba(0,255,65,0.6) ⭐
glow-lg:  0 0 30px rgba(0,255,65,0.7)
```

---

## Motion

### Duration
```
instant: 0ms     fast: 150ms ⭐    base: 250ms ⭐
slow: 400ms      slower: 600ms
```

### Easing
```
linear       linear
in           cubic-bezier(0.4, 0, 1, 1)
out          cubic-bezier(0, 0, 0.2, 1) ⭐
in-out       cubic-bezier(0.4, 0, 0.2, 1)
spring       cubic-bezier(0.34, 1.56, 0.64, 1)
```

---

## Z-Index

```
background: 0      base: 1         graph: 10      panels: 20
toolbar: 30        header: 40      modal: 50 ⭐    dropdown: 60
tooltip: 70        loading: 80     notification: 90    max: 100
```

---

## Component Sizing

### Buttons (WCAG: 44px min)
```
height-xs:   28px     height-sm:   32px
height-base: 44px ⭐   height-lg:   52px
```

### Inputs
```
height-sm:   32px     height-base: 44px ⭐    height-lg: 52px
```

### Panels
```
width-sm:   240px     width-base: 320px ⭐    width-lg: 400px
header-height: 48px
```

### Modals
```
width-sm:   400px     width-base: 600px ⭐
width-lg:   800px     width-xl: 1200px
```

---

## Common Patterns

### Primary Button
```tsx
className="btn-base h-button-base px-4 bg-brand-primary
hover:bg-brand-primary-hover text-text-inverse rounded-base
shadow-sm hover:shadow-md transition-button focus-ring"
```

### Input Field
```tsx
className="input-base h-input-base bg-input-bg border-input-border
focus:border-input-focus focus:shadow-focus rounded-base"
```

### Glass Panel
```tsx
className="glass w-panel-base h-full shadow-panel rounded-md"
```

### Card
```tsx
className="bg-card-bg border-card-border rounded-lg p-6
shadow-card hover:shadow-card-hover transition-all"
```

### Modal
```tsx
className="w-modal-base bg-modal-bg rounded-xl shadow-modal
border border-border-subtle"
```

---

## TypeScript Usage

```typescript
import { getColor, getSpace, hexToPixi } from '@/lib/tokens';

// Colors
const color = getColor('brand-primary');          // '#00ff41'
const pixiColor = hexToPixi(getColor('node-default')); // 0x44aaff

// Spacing
const padding = getSpace(4);                      // 16
const margin = getSpace(6);                       // 24

// Other
const radius = getRadius('base');                 // '6px'
const shadow = getShadow('lg');                   // '0 10px 15px...'
const duration = getDuration('fast');             // 150
const zIndex = getZIndex('modal');                // 50

// Utilities
const rgb = hexToRgb('#00ff41');                  // {r:0, g:255, b:65}
const rgba = hexToRgba('#00ff41', 0.5);           // 'rgba(0,255,65,0.5)'
const alphaBg = withAlpha('brand-primary', 0.2);  // 'rgba(0,255,65,0.2)'

// Preferences
const reduced = prefersReducedMotion();           // boolean
const dark = prefersDarkMode();                   // boolean
const highContrast = prefersHighContrast();       // boolean
```

---

## CSS Variables

### In Styles
```css
.my-component {
  background: var(--color-bg-elevated-2);
  padding: var(--space-4);
  border-radius: var(--radius-base);
  box-shadow: var(--shadow-lg);
  transition: var(--transition-button);
  z-index: var(--z-modal);
}
```

### In Inline Styles
```tsx
<div style={{
  backgroundColor: 'var(--color-bg-elevated-2)',
  padding: 'var(--space-4)',
  borderRadius: 'var(--radius-base)',
}}>
```

---

## Accessibility Checklist

✅ **Contrast Ratios:**
- Normal text: ≥4.5:1 → Use `text-primary`, `text-secondary`, `text-tertiary`
- Large text (18pt+): ≥3:1 → Use `text-tertiary` minimum
- UI components: ≥3:1 → Use `border-default` minimum

✅ **Touch Targets:**
- Minimum 44x44px → Use `h-button-base`, `h-input-base`

✅ **Focus Indicators:**
- Always use `focus-ring` class on interactive elements
- 2px outline + glow effect

✅ **Reduced Motion:**
- System automatically disables animations when user preference set
- No manual checks needed

✅ **Screen Readers:**
- Use `.sr-only` for hidden content
- Add `aria-label` to icon-only buttons

---

## Quick Migration

### Before → After

**Hardcoded Colors:**
```tsx
// Before
style={{ color: '#00ff41' }}

// After
className="text-brand-primary"
// OR
style={{ color: 'var(--color-brand-primary)' }}
```

**Hardcoded Spacing:**
```tsx
// Before
style={{ padding: '16px' }}

// After
className="p-4"
// OR
style={{ padding: 'var(--space-4)' }}
```

**Hardcoded Transitions:**
```tsx
// Before
style={{ transition: 'all 0.2s ease-out' }}

// After
className="transition-all"
// OR
style={{ transition: 'var(--transition-all)' }}
```

---

## File Locations

```
frontend/src/styles/
├── tokens.css          ← Design tokens (CSS variables)
├── globals.css         ← Global styles, utilities, animations
├── index.css           ← Main entry point
└── README.md           ← Full documentation

frontend/src/lib/
└── tokens.ts           ← TypeScript constants & utilities

tailwind.config.js      ← Tailwind integration

docs/
├── DESIGN_SYSTEM.md    ← System architecture
└── UI_UX_BEST_PRACTICES_2025.md ← Research
```

---

## Resources

- **Developer Guide:** `frontend/src/styles/README.md`
- **System Docs:** `docs/DESIGN_SYSTEM.md`
- **Delivery Summary:** `DESIGN_SYSTEM_DELIVERY.md`

---

**⭐ = Most commonly used**
**Print this page for quick reference!**
