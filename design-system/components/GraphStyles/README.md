# GraphStyles

The visual encoding of the force graph, as a spec the PIXI renderer follows: node states, size by connections, fill modes, labels, link types and weights, plus the graph legend that replaces the misleading "Perfect Match / Compatible / Default" box.

**Use** as the source of truth for `GraphVisualization.tsx` (PIXI; the 3D graph is retired), and render the legend (`sn-graph-styles__legend`) beside or over the canvas. The specimen SVG is documentation, not a component to ship.

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

## Labels
Artist (600) + title (400, `fg-2`), 12px body font, `fg`, 3px `sunk` halo (`paint-order: stroke`). Shown on hover, selection, now playing and for every node once zoom > 1.5; hidden while dragging. Max 40 characters, then "…".

## Links
| Type | Stroke |
|---|---|
| adjacency (played back to back) | solid, width by weight |
| similarity | dash 6 4, width by weight |
| key_compatibility | round dots (dash 0.1 4, cap round), 2px |
| collaboration | double: two 1px lines 4px apart |
| genre | solid 0.75px |
Colour `fg-3`, opacity `opacity-edge` (0.6); strong links (weight ≥ 0.8) 0.9. Width = 0.5 + 7.5 × weight px (0.5–8). Selected node's links `brand` at full opacity; path links 3px `mod-paths`. Links are never colour-coded by type: dash pattern carries type, so it survives colour blindness and booth.

## Legend
```html
<aside class="sn-graph-styles__legend" aria-label="Graph legend">
  <h4>Colour by: genre</h4><ul class="sn-graph-styles__legend-grid"><li><span class="sn-graph-styles__swatch" style="--c: var(--chart-1)"></span>House</li>…</ul>
  <h4>Size</h4>… <h4>Rings</h4>… <h4>Links</h4><li><svg>line sample</svg>Played back to back in a set</li>…
</aside>
```
It always matches the current colour mode, uses plain words ("Similar sound", "Compatible key", "Same artists") and shows every encoding in use. Collapsible on phones behind a "Legend" button.

## Accessibility
The canvas has an accessible name and summary ("Twelve tracks around Bicep – Glue, which is playing now…"); the selected node's details and neighbours live in the side panel and a list view, which keyboard and screen-reader users use instead of the canvas. Every state has a non-colour cue (the "Now" tag, dash, badge letter, label).

## Do / don't
- Do keep links neutral; colour belongs to nodes.
- Don't glow, bloom or use a gradient texture (`generateGlowTexture` goes).
- Don't use status green/amber for "match".

## In SongNodes
Replaces the `COLORS` table in `GraphVisualization.tsx` (`selected 0xff6b35`, `hovered 0x7ed321`, `nowPlaying 0xff1744` → amber `now`, start `0x00ff00`, end `0xff0000`, 13 genre hexes) and the "Perfect Match / Compatible / Default" legend in `DJInterface/panels/PlayModePanel.tsx`, which described colours the graph didn't use.
