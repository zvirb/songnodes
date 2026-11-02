# GraphControls

The overlay controls on the graph canvas: zoom in and out, fit, reset, pause or resume the layout, link layers, the View choice (the anchor's neighbourhood or the whole library), the "Colour by" choice with its legend, a minimap and the node and link count. A vertical dock bottom-right on desktop; a bottom bar on phones.

**Use** on every full graph canvas (Play mode, Graph module, Pathfinder map). The graph inside is laid out on rings and its links drawn in strength bands, per `GraphStyles`. **Don't** put filters or search here; those live in the graph filter panel and quick search.

## Anatomy
```html
<div class="sn-graph-controls">                       <!-- container-type: inline-size -->
  <svg class="sn-graph-controls__canvas" role="img" aria-label="Track graph, 1,284 nodes and 5,210 links">…</svg>
  <div class="sn-graph-controls__count">1,284 nodes · 5,210 links</div>
  <div class="sn-graph-controls__status" hidden><span class="sn-pill" data-status="idle">Layout paused</span></div>
  <div class="sn-graph-controls__colour" role="group" aria-labelledby="cb">
    <span class="sn-graph-controls__colour-label" id="vw">View</span>
    <div class="sn-seg" role="group" aria-labelledby="vw"><button aria-pressed="true">Neighbourhood</button><button aria-pressed="false">Whole library</button></div>
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
Groups: `surface-1`, 1px `line-strong`, `radius-control`, `shadow-2` (they float). 40px icon buttons (Lucide, 2px stroke), 1px `line` dividers, active/expanded = `surface-3`. Zoom steps ×1.25 between 25% and 400%; the out/in button disables at the limits. In the Whole library view Fit may go below 25% (View, below); zoom out then stops at the fitted zoom. Minimap 168×112 bottom-left: dots `fg-3`, viewport box 1.5px `brand` over a 14% brand wash. Count top-left in data font 12px on `surface-1`. Layers popover 250px, `shadow-2`, opens to the left of the dock (above the bar on phones).

## View (decision: selectable, default Neighbourhood; DR-057)
A `SegmentedControl` (`.sn-seg`, `aria-pressed`) labelled "View", first in the top-right panel above Colour by: **Neighbourhood** / **Whole library**, remembered per device. Both lay tracks out on rings around the same anchor (GraphStyles → Layout); they differ in which tracks are drawn and in Fit.
| View | Tracks drawn | Fit | Count |
|---|---|---|---|
| Neighbourhood (default) | The anchor and the tracks reached from it in at most `graph-hood-steps` (3) links, at most `graph-hood-max` (200), strongest link first (`SongNodes.neighbourhood`). A new anchor gives a new neighbourhood | Fits the neighbourhood within 25–400%. 200 tracks fit at 30% or more even in the Plan canvas | "200 of 1,284 nodes · 312 links"; when the cap cut it, an `InfoTip` says "The 200 tracks with the strongest links to the anchor. Switch the view to Whole library to see every track." |
| Whole library | Every track | Fits every track, below 25% when needed (the library grows; 4,000 tracks need about 2%). The fitted zoom becomes the zoom-out limit | "1,284 nodes · 5,210 links" |
Below 25% labels stay hidden except hover, selection and now playing, and a node is drawn at least 1.5px in radius on screen so the shape of the library still reads. The minimap shows the whole library in both views; in Neighbourhood it also marks where the neighbourhood sits. The graph API serves the neighbourhood view without sending the whole library (follow-up).

## Colour by (decision: selectable, default Neutral)
A `SegmentedControl` (`.sn-seg`, `aria-pressed`) top-right of the canvas: Neutral / Energy / Key / Genre, remembered per device. The legend under it changes with the mode and always ends with the two state rings:
| Mode | Node fill | Legend |
|---|---|---|
| Neutral (default) | `fg-2`, all alike | "All tracks alike; only states carry colour" |
| Energy | `energy-1…10`; unknown hollow | 1–10 ramp with gaps after 4 and 7, "Low 1–4 · Building 5–7 · High 8–10" |
| Key | `key-*` Camelot colours; unknown hollow | key-wheel dots with codes ("● 8A") |
| Genre | `chart-1…8` fixed order (House, Techno, UK garage, Electro, Breaks, Drum and bass, Ambient, Other) | dot + genre name |
Selected = 3px lavender `brand` ring; now playing = 3px amber `now` ring + "Now" tag, in every mode. The legend ends with one strength sample: four lines rising from Weak to Very strong, "Thicker link, stronger". Full encoding in `GraphStyles`.

## States
Paused: icon swaps to play, label "Resume layout", "Layout paused" idle pill at the top. With the ring layout, pausing holds every seat: links and colours still update, new tracks wait until Resume (GraphStyles → Layout). Loading graph: count reads "Loading…" and buttons stay enabled except fit.

## Accessibility
Every icon button has an `aria-label` naming the action and a matching `title`. Labels change with state ("Pause layout" ↔ "Resume layout") rather than using `aria-pressed`. Layers: `aria-expanded`, focus moves into the popover, Escape closes and returns focus, outside click closes. Zoom, layout, view and colour changes are announced in the live line ("Zoom 125%", "Layout paused", "View: whole library, 1,284 tracks", "Colour by energy"). The View and Colour by groups are named by their visible labels. Keyboard shortcuts on the canvas: + and − zoom, 0 fits, Space pauses.

## Responsive
Container query at 640px: the dock becomes a full-width bottom bar (row groups, 44px targets), the zoom percent and minimap hide, the View and Colour by panel spans the top under the count (38px segments) and the status pill sits above the bar. Wall: same dock, larger root size.

## Do / don't
- Do keep the controls inside the canvas edge with 12px inset.
- Don't use emoji or text-only symbols ("+", "⟲") as icons.
- Don't hide the count; it tells you what the filters left.

## In SongNodes
Replaces the zoom/fit buttons and `console.log('📐 Fit to content')` path in `GraphVisualization.tsx` and `GraphMiniMap.tsx`; adds the missing pause, link-layer, View and Colour by controls. There is no 2D/3D toggle: the 3D graph (`Graph3D`, `GraphModeToggle`, `GraphVisualizationWrapper`) and the Camelot helix are retired (see SongNodes migration).
