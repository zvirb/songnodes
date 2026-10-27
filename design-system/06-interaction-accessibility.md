# Interaction and accessibility

Target: WCAG 2.2 AA everywhere, AAA contrast (7:1) in the booth theme. These rules say how every control looks in every state and how it works by keyboard, pointer, touch and screen reader.

## States

| State | Treatment | Markup |
|---|---|---|
| Hover | `hover-bg` wash on rows, menu items, quiet buttons; `surface-2` on secondary buttons; `brand-strong` on primary; links thicken underline to 2px. Transition `duration-fast` | `:hover` (pointer devices only, `@media (hover: hover)`) |
| Focus | 2px solid `focus` ring, 2px offset (3px in booth). Never removed | `:focus-visible` |
| Pressed | `surface-3` fill on secondary; `brand-strong` on primary | `:active`, `aria-pressed="true"` for toggles |
| Selected | `brand-soft` fill, `fg` text; chips invert to `fg` fill with ✓ | `aria-selected="true"` (rows, tabs, options), `aria-pressed` (chips), `aria-checked` (segments) |
| Current | Page in drawer: `brand-soft` row + bold label; current link: dotted underline; now-playing / current slot: amber `now` 3px inset bar (its own token, never `brand`) | `aria-current="page"` / `"step"` / `"true"` |
| Disabled | `opacity-disabled` (0.45), `fg-disabled` label, `cursor: not-allowed`, no hover change; a reason is shown nearby or in `aria-describedby` | `aria-disabled="true"` (keeps focus) or `disabled` for form fields |
| Busy | Label changes to the ongoing verb ("Saving…"), `.sn-spinner` replaces the icon, width does not change, further clicks ignored | `aria-busy="true"` on the button or region |
| Invalid | `status-bad` border, ✕ message under the field | `aria-invalid="true"`, `aria-describedby` → error id |

- Selected and current are different: selected is what you picked, current is where you are or what is playing.
- Never signal state by colour alone (1.4.1): every state above also changes a glyph, weight, outline or text.

## Focus ring

- Every interactive element shows the `focus` ring on `:focus-visible`. Do not set `outline: none` without an equal replacement. The ring holds 3:1 on every surface (1.4.11) and is at least 2px thick around the whole control (2.4.13, AAA, met by default).
- Inside tonal cards and on module fills the ring stays `focus` (brand), not the module hue.
- Focus is never hidden under the sticky header or a toast (2.4.11): use `scroll-padding-top` and keep toasts bottom-aligned away from focused content.
- When a `Dialog`, `SideSheet` or `NavDrawer` opens, focus moves to its heading or first field; on close it returns to the control that opened it.

## Keyboard access

- Everything operable by pointer is operable by keyboard (2.1.1), in a logical order (2.4.3), with no traps (2.1.2). `Esc` closes the topmost layer only.
- First focusable element on every page: the skip link `.sn-skip` "Skip to content", targeting `<main id="main" tabindex="-1">` (2.4.1).
- Composite widgets use one tab stop and arrow keys inside: `Tabs`, `SegmentedControl`, `DataTable` rows (when rows are selectable), `CamelotWheel` segments, `ContextMenu`, `OverflowMenu`, `CommandPalette` results.
- `SetSlot` reordering: drag handle plus "Move up" and "Move down" buttons, and Alt+↑ / Alt+↓ when a slot has focus (2.5.7: dragging always has a single-pointer alternative).
- The graph canvas is focusable (`tabindex="0"`, `role="application"` with an `aria-label` "Track graph, 2,410 tracks"); arrow keys move between neighbours, Enter opens the node, + / − zoom, 0 resets.

## Screen-reader semantics

- Landmarks: `header` (`AppHeader`), `nav` (`NavDrawer`, labelled "Main"), `main`, `aside` for `FilterRail` and docked panels (labelled "Filters", "Track detail"), `footer` only where there is one.
- One `h1` per page (the `PageHeader` title, including its lead-in); `SectionHeading` is `h2`; card titles `h3`. Never skip levels.
- Names: every control has a visible label or an `aria-label` that contains the visible text (2.5.3). Icon buttons: "Lock slot 4", "Remove Bicep – Glue from set".
- Tables are real `<table>` with `<th scope="col">`; sortable headers are buttons inside `th` with `aria-sort`.
- `EnergyBar` reads "Energy 7 of 10, building tier"; `KeyBadge` reads "8A, A minor"; `CompatibilityBadge` reads its word, not its glyph.
- Live regions (4.1.3):

| Event | Region | Example announcement |
|---|---|---|
| Set rebuilt | `role="status"` (polite) on the running order summary | "Built Peak time Friday: 24 tracks, 1 h 52 min, 2 clashes." |
| Saved | `role="status"` via `Toast` | "Saved Peak time Friday." |
| Filters applied | `role="status"` result count | "412 tracks." |
| Background job finished | `role="status"` | "Weekly run finished: 38 new tracks." |
| Save failed, connection lost | `role="alert"` (assertive) via `Banner` or `InlineMessage` | "Couldn’t save. The connection dropped." |

- Use `alert` only for errors that need action now. Never announce every WebSocket update; batch them into one status at most every 10 s.

## Small repeated controls

- Slot actions (lock, up, down, remove), energy chips, row "Add to set" buttons: visual 32px (`control-sm`), hit area at least 24 × 24px with 8px between neighbours on pointer devices (2.5.8), 44 × 44px on touch.
- Repeated actions in a row are hidden behind an `OverflowMenu` when more than 3 per row, except on the running order where lock, up, down and remove stay visible.
- Row actions are always in the DOM and reachable by keyboard; they may appear on hover visually only on `hover: hover` devices and must be visible on focus-within.

## Gestures

| Gesture | Where | Effect | Alternative (2.5.1) |
|---|---|---|---|
| Drag | Graph canvas | Pan | Arrow keys; pan buttons in `GraphControls` |
| Pinch / Ctrl + wheel | Graph canvas | Zoom | + / − keys; zoom buttons in `GraphControls` |
| Drag handle | `SetSlot` | Reorder | Move up / Move down buttons, Alt+↑ / Alt+↓ |
| Long-press (500 ms) | Graph node, table row on touch | Opens `ContextMenu` | Shift+F10 or the Menu key; `OverflowMenu` button |
| Right-click | Graph node, edge, canvas | Opens `ContextMenu` | as above |

- No swipe-to-delete, no swipe between pages, no shake. Actions fire on pointer up, not down (2.5.2), so a press can be cancelled by moving away.

## Keyboard shortcuts

The global set is listed in `ShortcutSheet` (open with ?).

| Keys | Action |
|---|---|
| Ctrl/Cmd K, or / | Open `CommandPalette` (search tracks, artists, pages) |
| ? | Open `ShortcutSheet` |
| Esc | Close the topmost layer; then clear selection |
| G then L / S / G / P | Go to Library, Set builder, Graph, Pathfinder |
| 1–4 (graph focused) | Select, Path, Set, Filter tools |
| Alt+↑ / Alt+↓ (slot focused) | Move slot |
| Space (graph focused) | Set selected node as now playing |

- Never override browser or OS shortcuts: Ctrl/Cmd R, F, P, L, T, W, N, D, S, Z, C, V, A, Tab, F5. `App.tsx` currently overrides Ctrl/Cmd R (reload graph), F (search panel) and P (path panel); remove all three. Reload graph becomes a `Button` "Reload graph" in `GraphControls`, search is Ctrl/Cmd K or /, path panel is G then P.
- Single-character shortcuts (1–4, ?, /, G sequences) fire only when focus is not in a text input, textarea, select or contenteditable, and can be turned off in `PreferencesPanel` → "Single-key shortcuts" (2.1.4). `App.tsx` checks inputs and textareas only; add select and contenteditable.
- Shortcuts are hints, never the only way: every shortcut maps to a visible control.

## WCAG 2.2 AA checklist mapped to components

| Criterion | Requirement | Components most at risk |
|---|---|---|
| 1.1.1 Non-text content | Icons named or hidden; charts have a text summary or table | `Button` (icon), `ChartFrame`, `EnergyWave`, `Heatmap`, `CamelotWheel` |
| 1.3.1 Info and relationships | Real tables, lists, headings, labels | `DataTable`, `KeyValueGrid`, `Checklist`, `TextField` |
| 1.3.4 Orientation | Works in portrait and landscape | `GraphExplorerPage`, `PhotoCapture` |
| 1.4.1 Use of colour | Glyph or word with every colour meaning. Booth uses the same traffic-light status hues as dark, so no theme is relied on as colour-blind-safe: the glyph and word are mandatory everywhere | `StatusPill`, `CompatibilityBadge`, `EnergyBar`, `KeyBadge`, graph edges |
| 1.4.3 / 1.4.6 Contrast | 4.5:1 text; 7:1 in booth | all text; checked by `build_tokens.py` |
| 1.4.4 Resize text | 200% without loss | `DataTable`, `AppHeader`, `SetSlot` |
| 1.4.10 Reflow | 320 CSS px, no page scroll sideways | `LibraryPage`, `SetBuilderPage`, `MonitoringPage` |
| 1.4.11 Non-text contrast | 3:1 control edges, focus, chart marks | `TextField`, `Checkbox`, `Switch`, `RangeSlider`, `ProgressBar` |
| 1.4.12 Text spacing | No clipping | `FilterChip`, `Tabs`, `StatusPill` |
| 1.4.13 Content on hover or focus | Dismissible (Esc), hoverable, persistent. `Tooltip` shows immediately on keyboard focus and after 500 ms on mouse hover; hides at once on leave or blur | `Tooltip`, `Popover`, graph node hover card |
| 2.1.1 / 2.1.2 Keyboard, no trap | All operable, Esc exits | `Dialog`, `SideSheet`, graph canvas, `CommandPalette` |
| 2.1.4 Character key shortcuts | Off switch, input-aware | `ShortcutSheet`, `PreferencesPanel` |
| 2.2.1 Timing adjustable | Toasts with actions stay until dismissed; others ≥ 6 s | `Toast` |
| 2.2.2 Pause, stop, hide | Graph simulation and live updates can pause | `GraphControls`, `MonitoringPage` |
| 2.4.1 Bypass blocks | Skip link | `AppHeader` |
| 2.4.2 Page titled | `<title>` = "Set builder: Peak time Friday – SongNodes" | every page |
| 2.4.3 Focus order | Visual order = DOM order | `PageHeader`, `FilterRail` |
| 2.4.6 Headings and labels | Descriptive | `SectionHeading`, `TextField` |
| 2.4.7 / 2.4.11 Focus visible, not obscured | Ring visible, not under sticky UI | all interactive; `AppHeader` |
| 2.5.1 Pointer gestures | Single-pointer alternatives | graph, `RangeSlider` |
| 2.5.2 Pointer cancellation | Act on up-event | `Button`, `ContextMenu` |
| 2.5.3 Label in name | Accessible name contains visible label | `Button`, `TextLink` |
| 2.5.7 Dragging movements | Non-drag alternative | `SetSlot`, `RangeSlider`, graph |
| 2.5.8 Target size (minimum) | 24px or spacing | `SetSlot` actions, `FilterChip`, `Checkbox` |
| 3.2.3 / 3.2.4 Consistent navigation and identification | Same order, same names | `NavDrawer`, `PageHeader`, module icons |
| 3.2.6 Consistent help | Help in the same place | `AppHeader` help menu |
| 3.3.1 / 3.3.3 Error identification and suggestion | Text error with fix | `TextField`, `KeyPicker`, `TracklistPaste` |
| 3.3.4 Error prevention | Confirm or undo destructive actions | `ConfirmDialog`, `Toast` with Undo |
| 3.3.7 Redundant entry | Don't ask twice in one flow | `TracklistPaste`, `SettingsPage` |

| 3.3.8 Accessible authentication | No cognitive tests; paste allowed in `SecretField` | `SecretField`, `AuthCallbackPage` |
| 4.1.2 Name, role, value | Correct ARIA on custom widgets | `Switch`, `SegmentedControl`, `Tabs`, `CamelotWheel` |
| 4.1.3 Status messages | Live regions as above | `Toast`, `Banner`, `StagedProgress` |

## Card overviews and detail sub-routes
- **Focus return**: When navigating back from a detail sub-route (e.g. `/settings/:settingId`) to a card grid overview page (`/settings`), keyboard focus must return to the card action element (`Open setting page →`) that initiated navigation.
- **Live result count**: Search fields that filter card grids live must announce the matching card count using an `aria-live="polite"` region.
- **Two ways back**: Sub-route detail pages must offer both a top `PageHeader` back action button and a card-foot return link, plus support the `Escape` key to return to the parent overview page.
