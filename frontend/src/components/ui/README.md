# SongNodes Component Library

**Version:** 1.0.0
**Design System:** Frictionless UX Architecture
**Compliance:** WCAG 2.2 AA
**Framework:** React 18.3.1 + TypeScript 5.5.4

## Overview

This component library provides a foundational set of accessible, performant, and friction-free UI components built on modern best practices for 2025. All components are designed to **reduce cognitive load**, **align with user mental models**, and **eliminate interaction friction**.

## Core Principles

### 1. Frictionless Design
- **Cognitive Load Reduction**: Minimize mental effort through consistent patterns
- **Progressive Disclosure**: Show only what's needed when it's needed
- **Clear Affordances**: UI elements clearly indicate their purpose
- **Predictable Behavior**: Interactions work as users expect

### 2. Accessibility (WCAG 2.2 AA)
- ✅ **Keyboard Navigation**: All components fully keyboard accessible
- ✅ **Screen Readers**: Proper ARIA attributes and announcements
- ✅ **Focus Management**: Visible focus indicators and logical tab order
- ✅ **Touch Targets**: Minimum 44x44px for interactive elements
- ✅ **Contrast Ratios**: 4.5:1 for text, 3:1 for UI components
- ✅ **Motion Sensitivity**: Respects `prefers-reduced-motion`

### 3. Performance
- Bundle size: < 20KB gzipped (core components)
- Tree-shakeable: Import only what you use
- Lazy-loadable: Code-split for large applications
- Optimized re-renders: React.memo and careful prop design

## Component Catalog

### Interactive Components

#### Button
5 variants, 5 sizes, loading states, keyboard shortcuts

```tsx
import { Button } from '@/components/ui';

// Primary action
<Button onClick={handleSave}>Save Changes</Button>

// Loading state
<Button loading onClick={handleSubmit}>Submit</Button>

// With icons
<Button leftIcon={<PlusIcon />}>Add Track</Button>

// Keyboard shortcut hint
<Button shortcut="⌘S" onClick={handleSave}>Save</Button>
```

**Variants:** `primary` | `secondary` | `ghost` | `outline` | `link`
**Sizes:** `xs` | `sm` | `md` | `lg` | `xl` | `icon`

#### Modal/Dialog
Radix Dialog primitive with compound components

```tsx
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui';

<Modal open={isOpen} onOpenChange={setIsOpen}>
  <ModalContent size="lg" position="center">
    <ModalHeader>
      <ModalTitle>Edit Track</ModalTitle>
      <ModalDescription>Make changes to track metadata</ModalDescription>
    </ModalHeader>
    <ModalBody>
      {/* Content */}
    </ModalBody>
    <ModalFooter>
      <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
      <Button onClick={handleSave}>Save</Button>
    </ModalFooter>
  </ModalContent>
</Modal>
```

**Sizes:** `sm` | `md` | `lg` | `xl` | `full`
**Positions:** `center` | `top` | `bottom`

### Form Components

#### Input
Form input with validation, error states, helper text

```tsx
import { Input } from '@/components/ui';

// Basic input
<Input
  label="Artist Name"
  placeholder="Enter artist name"
  value={artist}
  onChange={(e) => setArtist(e.target.value)}
/>

// With error state
<Input
  label="Email"
  type="email"
  error="Please enter a valid email address"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>

// Character counter
<Input
  label="Track Title"
  maxLength={100}
  showCounter
  value={title}
  onChange={(e) => setTitle(e.target.value)}
/>

// With icons
<Input
  leftIcon={<SearchIcon />}
  placeholder="Search tracks..."
/>
```

**Variants:** `default` | `error` | `success`
**Sizes:** `sm` | `md` | `lg`

#### Select
Accessible dropdown with Radix Select primitive

```tsx
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui';

<Select value={key} onValueChange={setKey}>
  <SelectTrigger>
    <SelectValue placeholder="Select key..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="Am">A Minor</SelectItem>
    <SelectItem value="C">C Major</SelectItem>
    <SelectItem value="Em">E Minor</SelectItem>
    <SelectItem value="G">G Major</SelectItem>
  </SelectContent>
</Select>
```

### Feedback Components

#### Toast
Sonner-based notification system

```tsx
import { toast } from '@/components/ui';

// Success notification
toast.success('Track saved successfully!');

// Error notification
toast.error('Failed to delete track');

// With action button
toast('Track deleted', {
  action: {
    label: 'Undo',
    onClick: () => restoreTrack(),
  },
});

// Promise tracking
toast.promise(
  saveTrack(data),
  {
    loading: 'Saving track...',
    success: 'Track saved!',
    error: (err) => `Error: ${err.message}`,
  }
);
```

**Add Toaster to your app root:**
```tsx
import { Toaster } from '@/components/ui';

function App() {
  return (
    <>
      <YourApp />
      <Toaster />
    </>
  );
}
```

#### Skeleton
Loading placeholders

```tsx
import { Skeleton } from '@/components/ui';

// Text skeleton
<Skeleton variant="text" width="80%" />

// Avatar skeleton
<Skeleton variant="circular" width={40} height={40} />

// Card skeleton
<Skeleton variant="rectangular" height={200} className="w-full" />
```

**Variants:** `text` | `circular` | `rectangular` | `rounded`

### Layout Components

#### Card
Content container with compound components

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui';

<Card>
  <CardHeader>
    <CardTitle>Track Details</CardTitle>
    <CardDescription>Metadata and analysis</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Content here</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>

// Interactive card
<Card interactive onClick={handleClick}>
  <CardContent>Clickable content</CardContent>
</Card>
```

**Variants:** `default` | `elevated` | `outlined`

### Status Components

#### Badge
Status indicators and labels

```tsx
import { Badge } from '@/components/ui';

// Status badge
<Badge variant="success">Active</Badge>

// Count badge
<Badge variant="error">3</Badge>

// With icon
<Badge variant="warning" icon={<AlertIcon />}>
  Warning
</Badge>

// With dot indicator
<Badge showDot variant="success">
  Online
</Badge>
```

**Variants:** `default` | `secondary` | `success` | `warning` | `error` | `outline`
**Sizes:** `sm` | `md` | `lg`

## Design Tokens

All components use CSS variables from `tokens.css` for consistent theming:

```css
/* Colors */
--color-brand-primary: #00ff41;       /* Matrix green */
--color-bg-base: #0a0a0a;             /* Background */
--color-text-primary: #ffffff;        /* Primary text */

/* Spacing (8pt grid) */
--space-2: 0.5rem;  /* 8px */
--space-4: 1rem;    /* 16px */
--space-6: 1.5rem;  /* 24px */

/* Typography */
--font-size-sm: 0.833rem;   /* 13.3px */
--font-size-base: 1rem;     /* 16px */
--font-size-lg: 1.2rem;     /* 19.2px */

/* Transitions */
--duration-fast: 150ms;
--duration-base: 250ms;
--ease-out: cubic-bezier(0, 0, 0.2, 1);
```

## Utility Functions

```tsx
import { cn, debounce, announceToScreenReader, copyToClipboard } from '@/components/ui';

// Merge Tailwind classes
const buttonClass = cn('px-4 py-2', isActive && 'bg-primary', className);

// Debounce function execution
const debouncedSearch = debounce(handleSearch, 300);

// Announce to screen readers
announceToScreenReader('Track saved successfully', 'polite');

// Copy to clipboard
await copyToClipboard('Track URL');
```

## Best Practices

### 1. Import Pattern
```tsx
// ✅ Named imports for tree-shaking
import { Button, Modal, Input } from '@/components/ui';

// ❌ Avoid default imports
import UI from '@/components/ui';
```

### 2. Accessibility
```tsx
// ✅ Always provide labels
<Input label="Artist Name" />

// ✅ Use semantic HTML
<Modal>
  <ModalTitle>Dialog Title</ModalTitle>
  <ModalDescription>Dialog description</ModalDescription>
</Modal>

// ✅ Provide keyboard shortcuts
<Button shortcut="⌘S" onClick={handleSave}>Save</Button>
```

### 3. Loading States
```tsx
// ✅ Show loading feedback
<Button loading onClick={handleAsync}>Submit</Button>

// ✅ Use skeletons during data loading
{isLoading ? (
  <Skeleton variant="rectangular" height={200} />
) : (
  <DataCard data={data} />
)}

// ✅ Track promise state
toast.promise(fetchData(), {
  loading: 'Loading...',
  success: 'Data loaded!',
  error: 'Failed to load',
});
```

### 4. Error Handling
```tsx
// ✅ Show clear error messages
<Input
  error="Email is required"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>

// ✅ Provide recovery actions
toast.error('Failed to save', {
  action: {
    label: 'Retry',
    onClick: () => handleRetry(),
  },
});
```

## Performance Tips

1. **Code Splitting**: Lazy load heavy components
   ```tsx
   const Modal = lazy(() => import('@/components/ui/Modal'));
   ```

2. **Memoization**: Use React.memo for expensive components
   ```tsx
   const ExpensiveCard = React.memo(CardComponent);
   ```

3. **Debouncing**: Debounce search inputs
   ```tsx
   const handleSearch = debounce((query) => search(query), 300);
   ```

4. **Virtual Scrolling**: For large lists, use react-window
   ```tsx
   import { FixedSizeList } from 'react-window';
   ```

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile Safari: iOS 14+
- Chrome Android: Latest version

## Contributing

When adding new components:

1. Follow WCAG 2.2 AA guidelines
2. Use design tokens from `tokens.css`
3. Write JSDoc comments
4. Add examples to this README
5. Ensure bundle size < 10KB per component
6. Test with keyboard and screen reader
7. Support `prefers-reduced-motion`

## Migration from Legacy Components

See `docs/research/frontend/COMPONENT_LIBRARY_MIGRATION.md` for migration guides.

## License

MIT

---

**Built with ❤️ for SongNodes**
For issues or feature requests, contact the frontend team.
