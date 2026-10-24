# GraphControls

The overlay controls on the graph canvas: zoom in and out, fit, reset, pause or resume the layout, link layers, the "Colour by" choice with its legend, a minimap and the node and link count. A vertical dock bottom-right on desktop; a bottom bar on phones.

**Use** on every full graph canvas (Play mode, Graph module, Pathfinder map). **Don't** put filters or search here; those live in the graph filter panel and quick search.

## Anatomy
```html
<div class="sn-graph-controls">                       <!-- container-type: inline-size -->
  <svg class="sn-graph-controls__canvas" role="img" aria-label="Track graph, 1,284 nodes and 5,210 links">…</svg>
  <div class="sn-graph-controls__count">1,284 nodes · 5,210 links</div>
  <div class="sn-graph-controls__status" hidden><span class="sn-pill" data-status="idle">Layout paused</span></div>
  <div class="sn-graph-controls__colour" role="group" aria-labelledby="cb">
    <span class="sn-graph-controls__colour-label" id="cb">Colour by</span>
    <div class="sn-seg" role="group" aria-labelledby="cb"><button aria-pressed="true">Neutral</button><button aria-pressed="false">Energy</button><button aria-pressed="false">Key</button><button aria-pressed="false">Genre</button></div>
    <ul class="sn-graph-controls__legend" aria-label="Legend">…per mode, then Selected and Now playing rings…</ul>
  </div>
  <div class="sn-graph-controls__mini" role="img" aria-label="Minimap…"><svg>…<rect class="sn-graph-controls__mini-view"/></svg></div>
  <div class="sn-graph-controls__dock" role="group" aria-label="Graph controls">
    <div class="sn-graph-controls__group">
      <button class="sn-btn sn-btn--icon" aria-label="Zoom in">zoom-in</button>
      <div class="sn-graph-controls__zoom" aria-hidden="true">100%</div>
      <button … aria-label="Zoom out">zoom-out</button><button … aria-label="Fit graph to screen">maximize-2</button><button … aria-label="Reset view">rotate-ccw</button>
    </div>
    <div class="sn-graph-controls__group">
      <button … aria-label="Pause layout">pause</button>
      <div class="sn-graph-controls__layers-wrap"><button … aria-label="Link layers" aria-expanded="false" aria-controls="layers">layers</button>
        <div class="sn-graph-controls__layers" id="layers" hidden role="group">…sn-check per link type…</div></div>
    </div>
  </div>
  <p class="sn-sr" aria-live="polite"></p>
</div>
```

## Spec
Groups: `surface-1`, 1px `line-strong`, `radius-control`, `shadow-2` (they float). 40px icon buttons (Lucide, 2px stroke), 1px `line` dividers, active/expanded = `surface-3`. Zoom steps ×1.25 between 25% and 400%; the out/in button disables at the limits. Minimap 168×112 bottom-left: dots `fg-3`, viewport box 1.5px `brand` over a 14% brand wash. Count top-left in data font 12px on `surface-1`. Layers popover 250px, `shadow-2`, opens to the left of the dock (above the bar on phones).

## Colour by (decision: selectable, default Neutral)
A `SegmentedControl` (`.sn-seg`, `aria-pressed`) top-right of the canvas: Neutral / Energy / Key / Genre, remembered per device. The legend under it changes with the mode and always ends with the two state rings:
| Mode | Node fill | Legend |
|---|---|---|
| Neutral (default) | `fg-2`, all alike | "All tracks alike; only states carry colour" |
| Energy | `energy-1…10`; unknown hollow | 1–10 ramp with gaps after 4 and 7, "Low 1–4 · Building 5–7 · High 8–10" |
| Key | `key-*` Camelot colours; unknown hollow | key-wheel dots with codes ("● 8A") |
| Genre | `chart-1…8` fixed order (House, Techno, UK garage, Electro, Breaks, Drum and bass, Ambient, Other) | dot + genre name |
Selected = 3px lavender `brand` ring; now playing = 3px amber `now` ring + "Now" tag, in every mode. Full encoding in `GraphStyles`.

## States
Paused: icon swaps to play, label "Resume layout", "Layout paused" idle pill at the top. Loading graph: count reads "Loading…" and buttons stay enabled except fit.

## Accessibility
Every icon button has an `aria-label` naming the action and a matching `title`. Labels change with state ("Pause layout" ↔ "Resume layout") rather than using `aria-pressed`. Layers: `aria-expanded`, focus moves into the popover, Escape closes and returns focus, outside click closes. Zoom, layout and colour changes are announced in the live line ("Zoom 125%", "Layout paused", "Colour by energy"). The Colour by group is named by its visible label. Keyboard shortcuts on the canvas: + and − zoom, 0 fits, Space pauses.

## Responsive
Container query at 640px: the dock becomes a full-width bottom bar (row groups, 44px targets), the zoom percent and minimap hide, the Colour by panel spans the top under the count (38px segments) and the status pill sits above the bar. Wall: same dock, larger root size.

## Do / don't
- Do keep the controls inside the canvas edge with 12px inset.
- Don't use emoji or text-only symbols ("+", "⟲") as icons.
- Don't hide the count; it tells you what the filters left.

## In SongNodes
Replaces the zoom/fit buttons and `console.log('📐 Fit to content')` path in `GraphVisualization.tsx` and `GraphMiniMap.tsx`; adds the missing pause, link-layer and Colour by controls. There is no 2D/3D toggle: the 3D graph (`Graph3D`, `GraphModeToggle`, `GraphVisualizationWrapper`) and the Camelot helix are retired (see SongNodes migration).
