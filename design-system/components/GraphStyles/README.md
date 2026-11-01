# GraphStyles

The visual encoding of the track graph, as a spec the PIXI renderer follows: the ring layout, node states, size by connections, fill modes, labels, link types and strength bands, plus the graph legend that replaces the misleading "Perfect Match / Compatible / Default" box.

**Use** as the source of truth for `GraphVisualization.tsx` (PIXI; the 3D graph is retired), and render the legend (`sn-graph-styles__legend`) beside or over the canvas. The specimen SVG is documentation, not a component to ship.

## Layout: rings around one track (DR-034)
Link strength is drawn, not measured: line weight carries it (Links, below), and distance only says *in what order* tracks were seated. Tracks sit a regular distance apart so names can be read and links followed. This replaces the force layout, where link length came from strength and names collided.

| Rule | Spec |
|---|---|
| Anchor | Now playing. With nothing playing, the selected track; with neither (whole-library view), the track with the most links |
| Rings | Ellipses around the anchor. Ring 1 vertical radius `graph-ring-first` (58px), each next ring `graph-ring-step` (40px) further out; horizontal radius × `graph-ring-aspect` (1.7) so left-to-right labels fit |
| Seats | Every `graph-seat-gap` (30px) of arc, at least 8 per ring, starting at 12 o'clock |
| Seat box | Each track keeps clear its node, its state ring (r + 4) and its label as drawn at `graph-label-zoom` (1.5): label width ÷ 1.5. Now playing is always labelled, so it keeps its label clear at 100% and also the "Now" tag above it. A seat is free only if its box overlaps no other box (`SongNodes.seatBox`) |
| Order | Seat the anchor, then repeatedly the unseated track with the strongest link to any seated track (ties: more links first) |
| Which ring | The anchor's own links start at ring 1; any other track starts at the ring of its strongest seated link. It takes the first ring, from there outward, that has a free seat. So the strongest links get the closest seats, and weaker ones move out when the close seats are taken |
| Which seat | The free seat nearest the angle of its strongest seated link. The anchor's own links go round from 12 o'clock in golden-angle steps (137.5°), strongest first |
| Unlinked tracks | Tracks with no link to anything seated go to the ring after the outermost one in use |
| Refresh | Seats are kept: a live update re-seats nobody; new tracks take free seats by the same rules. Changing the anchor ("Set as now playing") re-seats everything, moving over `duration-slow` (320ms); with reduced motion they jump |
| Pause layout | Holds every seat: links and colours still update, but new tracks wait until Resume |
| Drag | A dropped track takes the free seat nearest the drop point and keeps it until the anchor changes |
| Reading it | Ring = how many strong steps from the anchor, never a score. The renderer draws no ring guides (the specimen's dotted ellipses are documentation) |

Same input gives the same seats. `SongNodes.ringLayout(nodes, links, {anchor, prev})` in the bundle is the reference implementation the renderer ports.

## Canvas
Background `sunk`. Nodes and links are neutral by default; node colour is a selectable mode, chosen with the "Colour by" control in `GraphControls`: Neutral (default) / Energy / Key / Genre. The legend always matches the mode.

## Nodes
| State | Spec |
|---|---|
| Default | fill `fg-2` (`--g-node`), 1.5px `sunk` outline so overlapping nodes separate |
| Hovered | + 2px `fg` ring at r + 3; label shown |
| Selected | + 3px `brand` ring at r + 4; label shown |
| Now playing | + 3px amber `--now` ring at r + 4 and a "Now" tag above the node (30×14, `now` fill, `on-brand` 700 text); pulse: ring scales 1 → 1.9 and fades over 1.8s, removed under `prefers-reduced-motion`. Now and selected differ by hue (amber vs lavender) and the "Now" word, so no extra ring is needed |
| Path start / waypoint / finish | 3px `mod-paths` ring (waypoint dashed `4 3`, finish doubled at r + 8) + badge r 7 in `mod-paths` with `on-mod-paths` "S", "1"…, "F" |
| Hidden by filter | whole node and its links at `opacity-faded` (0.15); not hit-testable |
| Size | radius = clamp(4, 4 + 20 × √(links ÷ most links), 24) px. Square root so area, not radius, tracks connections |

## Colour modes
| Mode | Node fill | Legend |
|---|---|---|
| Neutral (default) | `fg-2` for every node; only states carry colour | "All tracks alike; only the rings carry colour" + the state rings |
| Energy | `energy-1…10`; unknown energy hollow | 1–10 ramp with gaps after 4 and 7, "Low 1–4 · Building 5–7 · High 8–10" |
| Key | `key-<n><a|b>` (same as CamelotWheel); unknown key hollow | key-wheel dots with codes ("● 8A") |
| Genre | `chart-1…8` (Okabe-Ito based) in fixed order: House, Techno, UK garage, Electro, Breaks, Drum and bass, Ambient, Other. A 9th genre folds into Other | dot + genre name |

The selected (lavender) and now (amber + "Now") rings sit on top in every mode. The choice is remembered per device.

Read token values with `getComputedStyle(document.documentElement).getPropertyValue("--fg-2")` and convert to PIXI numbers on theme change; never hard-code `0x4a90e2`.

## Labels (unchanged, DR-037)
Artist (600) + title (400, `fg-2`), 12px body font, `fg`, 3px `sunk` halo (`paint-order: stroke`), 10px right of the node. Shown on hover, selection, now playing and for every node once zoom > 1.5 (`graph-label-zoom`); hidden while dragging. Max 40 characters, then "…". Because every seat keeps its label clear at that zoom, labels never overlap once they all show. Below it, a hovered or selected label is drawn above everything else.

## Links: strength by line weight (DR-035, DR-036)
Strength is shown in four bands. Width carries it; opacity backs it up but never carries it alone, because faded lines that overlap darken into lines that look strong. People reliably tell apart about four line weights on a busy canvas, not a continuous range, so the old 0.5–8px scale is gone.

| Band | Weight | Width | Opacity | Class |
|---|---|---|---|---|
| Very strong | ≥ cut 3 | `graph-edge-w-4` 6px | `graph-edge-op-4` 1 | `--b4` |
| Strong | cut 2 – cut 3 | `graph-edge-w-3` 3.5px | `graph-edge-op-3` 0.8 | `--b3` |
| Fair | cut 1 – cut 2 | `graph-edge-w-2` 2px | `graph-edge-op-2` 0.55 | `--b2` |
| Weak | < cut 1 | `graph-edge-w-1` 1px | `graph-edge-op-1` 0.35 | `--b1` |

**Cut points are fitted to the library, not fixed.** The weekly run takes the quartiles (25th, 50th, 75th percentile) of every link weight in the library and uses them as cut 1–3, so each band holds about a quarter of the links. As a cross-check it also computes 4-class natural breaks (Jenks). If any cut differs by more than 0.10 it still uses the quartiles, and flags the mismatch on the Monitoring page. With fewer than 200 links, or before the first run, the cuts are 0.25 / 0.50 / 0.75. The graph reads the cuts the latest run used (`SongNodes.fitEdgeCuts`, `SongNodes.edgeBand`), and the legend's "How strength is banded" note prints them. Never hard-code them.

**Weak links are shown only where they help.** A Weak link is drawn only when it is one of either track's two strongest links, touches now playing, or touches the hovered or selected track. That way no track is left without a line, and the canvas stays traceable (`SongNodes.edgeVisibility`). Fair, Strong and Very strong links are always drawn.

| Type | Stroke (width from the band) |
|---|---|
| adjacency (played back to back) | solid |
| similarity | dash 6 4, butt caps |
| key_compatibility | round dots: dash 0.1 (width + 3px) |
| collaboration | double: two lines 4px apart, each half the band width (at least 1px) |
| genre | solid |

Colour `fg-3`. Draw weakest first so strong lines sit on top. While a track is hovered or selected, its links turn `brand` at full opacity, and every other link drops to `graph-edge-dim` (×0.25) of its band opacity. Path links are `mod-paths`, at least 3px. Links are never colour-coded by type or strength: dash carries type, width carries strength, so both survive colour blindness and the booth theme.

## Legend
```html
<aside class="sn-graph-styles__legend" aria-label="Graph legend">
  <h4>Colour by: genre</h4><ul class="sn-graph-styles__legend-grid"><li><span class="sn-graph-styles__swatch" style="--c: var(--chart-1)"></span>House</li>…</ul>
  <h4>Size</h4>… <h4>Rings</h4>… <h4>Links</h4><li><svg>line sample</svg>Played back to back in a set</li>…
  <h4>Strength</h4><li><svg><line class="sn-graph-styles__edge sn-graph-styles__edge--b4"/></svg>Very strong</li>… Strong, Fair, Weak
  <p class="caption">Thicker means stronger. Closer rings mean a stronger route from now playing, not a score. Weak links appear when you point at a track.</p>
</aside>
```
It always matches the current colour mode, uses plain words ("Similar sound", "Compatible key", "Same artists"; "Very strong", "Strong", "Fair", "Weak") and shows every encoding in use. Link-type samples are drawn without a band (2px, `opacity-edge`). Collapsible on phones behind a "Legend" button.

## Accessibility
The canvas has an accessible name and summary ("Twelve tracks around Bicep – Glue, which is playing now…"); the selected node's details and neighbours live in the side panel and a list view, which keyboard and screen-reader users use instead of the canvas. Every state has a non-colour cue (the "Now" tag, dash, badge letter, label).

## Do / don't
- Do keep links neutral; colour belongs to nodes.
- Do let distance order tracks only; never stretch a link to show it is weak.
- Don't glow, bloom or use a gradient texture (`generateGlowTexture` goes).
- Don't use status green/amber for "match".

## In SongNodes
Replaces the d3-force / PIXI force simulation in `GraphVisualization.tsx` (link distance from weight) with the ring layout; the layout runs once per anchor change and on new tracks, not every frame. Replaces the `COLORS` table in `GraphVisualization.tsx` (`selected 0xff6b35`, `hovered 0x7ed321`, `nowPlaying 0xff1744` → amber `now`, start `0x00ff00`, end `0xff0000`, 13 genre hexes) and the "Perfect Match / Compatible / Default" legend in `DJInterface/panels/PlayModePanel.tsx`, which described colours the graph didn't use.
