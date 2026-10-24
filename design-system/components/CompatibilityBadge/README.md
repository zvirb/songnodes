# CompatibilityBadge
A traffic-light verdict on a move between two tracks (perfect, compatible, possible, clash), as a pill with a mandatory glyph and words.

## When to use
- Key, BPM and energy verdicts: Pathfinder suggestions, Intelligent browser recommendations, transition details, Key & mood.
- Don't use for system health (StatusPill). In running orders use the lighter TransitionNote.

## Anatomy and markup
Core `sn-pill` with `data-compat`, plus `sn-compatibility-badge` (glyph hidden from screen readers; adds the unknown level).
```html
<span class="sn-pill sn-compatibility-badge" data-compat="compatible">+1 key</span>
<span class="sn-pill sn-pill--outline sn-compatibility-badge" data-compat="clash">key clash</span>
```
Levels and labels come from `SongNodes.compat(a, b)`, `bpmStep(a, b)` and `energyStep(prev, next, before)`.

## Levels
| level | glyph | colour token |
|---|---|---|
| perfect | ● | `compat-perfect` |
| compatible | ◐ | `compat-compatible` |
| possible | ○ | `compat-possible` |
| clash | ✕ | `compat-clash` |
| unknown | ? | `fg-3` outline |

## Rules
Key (Camelot): same key → perfect; ±1 on the wheel, same letter → compatible; relative major/minor (8A↔8B) → perfect; +2, same letter → possible ("energy boost"); +7, same letter → possible ("lift"); anything else → clash.
BPM: within 2 perfect, within 4 compatible, within 8 possible, more is a clash.
Energy: +1 or hold perfect; −1 compatible; a second −1 in a row possible; +2 or more clash; a drop of 2 or more (after a peak) perfect.

## Accessibility
The glyph and the words carry the verdict; the hue is the same traffic light in dark, light and booth, so the badge never relies on colour alone. Where space allows, the label names the move ("+1 key"), not only "Compatible".

## Do / don't
- Don't use these colours for anything but compatibility and status.
- In compact layouts drop the fill (`--outline`), never the glyph.

## In SongNodes
Replaces `HarmonicCompatibility.tsx` (✓✓/✓/✗ icons), the energy-flow icons in `EnergyMeter.tsx` and the match badges in `IntelligentBrowser`.
