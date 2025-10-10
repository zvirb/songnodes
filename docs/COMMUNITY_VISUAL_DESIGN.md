# Community Detection Visual Design Guide

## Color Palette

Communities are automatically assigned colors using a hash-based color generation algorithm that ensures:
- Sufficient saturation (60-100%)
- Optimal lightness (40-60%)
- Visual distinction between communities
- Accessibility compliance

### Generated Colors
Each community gets a unique color based on its ID:
```javascript
Community 0: #3498db (Blue)
Community 1: #e74c3c (Red)
Community 2: #2ecc71 (Green)
Community 3: #f39c12 (Orange)
Community 4: #9b59b6 (Purple)
```

## Component Styling

### Community Card (Collapsed)
```
┌──────────────────────────────────────┐
│ ▶ 👥  Community 0           [128 BPM] │
│       128 tracks • house    [128]     │
└──────────────────────────────────────┘
   ↑                           ↑     ↑
  Icon                       Pills  Count
```

### Community Card (Expanded)
```
┌──────────────────────────────────────┐
│ ▼ 👥  Community 0           [128 BPM] │
│       128 tracks • house    [128]     │
├──────────────────────────────────────┤
│ 📊 BPM Range: 120-135 BPM            │
│ 🎵 Top Keys: A Minor (25), C Major.. │
│ 🎸 Genre: house                       │
├──────────────────────────────────────┤
│ TRACKS IN THIS COMMUNITY              │
│ ┌────────────────────────────────┐   │
│ │ ▶ Track 1                      │   │
│ │   Artist A          128 BPM 8A │   │
│ ├────────────────────────────────┤   │
│ │ ▶ Track 2                      │   │
│ │   Artist B          130 BPM 9A │   │
│ ├────────────────────────────────┤   │
│ │ ...                            │   │
│ └────────────────────────────────┘   │
└──────────────────────────────────────┘
```

## Graph Visualization States

### 1. Normal State (No Highlighting)
```
○ ─── ○        All nodes full opacity
│     │        All edges visible
○ ─── ○        Normal colors
```

### 2. Neighborhood Highlighting (1-hop)
```
● ═══ ●        Selected + neighbors: full opacity
║              Other nodes: 0.2 opacity
◌ ─── ◌        Connected edges: highlighted
      │        Other edges: dimmed
      ◌
```

### 3. Extended Neighborhood (2-hop)
```
● ═══ ● ─── ●  Selected: full opacity
║     │      Neighbors: full opacity
◌ ─── ◌ ─── ◌  2-hop neighbors: 0.6 opacity
              Other nodes: 0.2 opacity
```

### 4. Community Coloring
```
Nodes colored by community:
Community 0: Blue nodes
Community 1: Red nodes
Community 2: Green nodes
```

## Transition Panel (Future Enhancement)

When a node is clicked and neighbors are highlighted, show a transition panel:

```
┌─────────────────────────────────────┐
│ NEIGHBORS OF: Track Name            │
├─────────────────────────────────────┤
│                                     │
│ ▶ Track A        [Key: 8A → 9A] ✓  │
│   128 → 130 BPM  Compatible         │
│                                     │
│ ▶ Track B        [Key: 8A → 7A] ✓  │
│   128 → 126 BPM  Compatible         │
│                                     │
│ ▶ Track C        [Key: 8A → 1B] ✗  │
│   128 → 140 BPM  Jump               │
│                                     │
└─────────────────────────────────────┘
```

## Super-Node Design Options

### Option A: Bubble Clusters
```
     ○ ○
   ○     ○
  ○  Community 0 (128)
   ○     ○
     ○ ○

- Nodes clustered in circular arrangement
- Size proportional to member count
- Click to expand into individual nodes
```

### Option B: Force-Bundled Edges
```
○ ─┐
○ ─┤
○ ─┼─── Other Community
○ ─┤
○ ─┘

- Edges bundled within community
- Reduces visual clutter
- Clear inter-community connections
```

### Option C: Colored Hulls (Recommended)
```
    ┌─────────────┐
    │ ○   ○   ○   │
    │   ○   ○     │  Community 0
    │ ○       ○   │
    └─────────────┘

- Translucent hull around community
- Preserves node positions
- Easy to see overlaps
```

## Interaction States

### Hover States
```css
.community-cluster:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  transform: translateY(-2px);
  transition: all 200ms ease;
}
```

### Selected State
```css
.community-cluster.selected {
  border-width: 2px;
  box-shadow: 0 0 0 3px rgba(community-color, 0.2);
}
```

### Loading State
```
┌──────────────────────────────────────┐
│ ⚡ Detecting Communities...          │
│ ████████░░░░░░░░░░░░ 40%             │
└──────────────────────────────────────┘
```

## Responsive Design

### Desktop (> 1024px)
- Communities in sidebar (320px width)
- Graph takes remaining width
- Expanded communities show full metadata

### Tablet (768px - 1024px)
- Sidebar collapsible
- Compact community cards
- Metadata on hover/tap

### Mobile (< 768px)
- Bottom drawer for communities
- Swipe to expand
- Simplified metadata view

## Accessibility

### Color Contrast
- All text meets WCAG AA standards
- Community colors have 4.5:1 contrast ratio
- Alternative color modes for colorblind users

### Keyboard Navigation
```
Tab       → Navigate between communities
Enter     → Expand/collapse community
Space     → Toggle selection
Arrows    → Navigate tracks within community
Escape    → Close all expansions
```

### Screen Reader Support
```html
<button
  aria-expanded="true"
  aria-label="Community 0, 128 tracks, house genre, average BPM 128"
>
  ...
</button>
```

## Animation Guidelines

### Expand/Collapse
```
Duration: 200ms
Easing: cubic-bezier(0.4, 0, 0.2, 1)
Properties: height, opacity, transform
```

### Neighborhood Highlight
```
Duration: 300ms
Easing: ease-out
Properties: opacity, stroke-width
Stagger: 50ms between neighbor nodes
```

### Community Detection Progress
```
Duration: 100ms per step
Easing: linear
Visual: Progress bar + count increment
```

## Example CSS

```css
/* Community Card */
.community-cluster {
  border-radius: 0.5rem;
  border: 1px solid var(--community-color);
  background: linear-gradient(
    135deg,
    var(--community-color-alpha-10),
    transparent
  );
  transition: all 200ms ease;
}

/* Neighborhood Highlighting */
.node-highlighted {
  opacity: 1;
  transform: scale(1.1);
  filter: drop-shadow(0 0 8px var(--node-color));
  z-index: 100;
}

.node-dimmed {
  opacity: 0.2;
  filter: grayscale(0.5);
  transition: opacity 300ms ease, filter 300ms ease;
}

/* Edge Highlighting */
.edge-highlighted {
  stroke-width: 3px;
  stroke: var(--highlight-color);
  opacity: 1;
  filter: drop-shadow(0 0 4px var(--highlight-color));
}

.edge-dimmed {
  opacity: 0.1;
  transition: opacity 300ms ease;
}
```

## Dark Mode Considerations

### Light Mode
- Background: white (#ffffff)
- Border: gray-300 (#d1d5db)
- Text: gray-900 (#111827)
- Community tint: 10% opacity

### Dark Mode
- Background: gray-800 (#1f2937)
- Border: gray-700 (#374151)
- Text: gray-100 (#f3f4f6)
- Community tint: 20% opacity (higher for visibility)

## Performance Optimization

### Rendering
- Use CSS transforms for animations (GPU-accelerated)
- Virtualize community list (react-window) if > 100 communities
- Lazy load track lists on expand
- Debounce highlight updates (150ms)

### Memory
- Release PIXI textures for hidden nodes
- Clear event listeners on component unmount
- Use WeakMap for node-to-community lookups
- Limit visible tracks in expanded view (max 100, paginate)

## Future Enhancements

### 1. Community Mini-Map
```
┌─────────────────┐
│ Graph Overview  │
│                 │
│  ●blue ●red     │
│ ●green  ●orange │
│   ●purple       │
│                 │
└─────────────────┘
```

### 2. Community Timeline
```
Track 1 ──▶ Track 2 ──▶ Track 3
 8A          9A          10A
128 BPM    130 BPM     132 BPM
```

### 3. Community Heatmap
```
     BPM →
Key  120  125  130  135
↓
8A   ███  ██   █    ░
9A   ██   ███  ██   █
10A  █    ██   ███  ██
```

Density shows where tracks cluster within community.

---

All visual designs follow Material Design 3 principles with custom adaptations for music-specific use cases.
