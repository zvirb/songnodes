# Inputs and actions

Every control says what it does, shows its state without colour alone, and can be reached and operated by keyboard. Native elements first (`button`, `input`, `select`, `a`); ARIA only to fill gaps.

## Component index

| Component | Purpose |
|---|---|
| `Button` | Do something now (`.sn-btn` + variants) |
| `TextLink` | Go somewhere (`.sn-link`, destination module colour, always underlined) |
| `CopyButton` | Copy a value (ID, tracklist, link) and confirm in place |
| `FilterChip` | Toggle one filter value on or off (`.sn-chip[aria-pressed]`); the preset variant applies a saved filter view |
| `SearchField` | Free-text search with clear button |
| `AutocompleteSearchField` | Search with completions: recent searches, then artists, titles, tags or tracks to choose with the arrow keys |
| `FilterRail` | The column of filters beside a table (`rail-w`) |
| `TextField`, `NumberField`, `SelectField`, `DateField`, `SecretField` | Single values |
| `Checkbox` | Include/exclude a condition; form agreement |
| `Switch` | A setting that takes effect immediately |
| `RangeSlider` | A range of numbers (BPM 122–128, energy 5–8) |
| `ChipInput` | Many free values (tags, search terms) |
| `KeyPicker` | Pick Camelot keys on a mini wheel or grid |
| `FileDrop` | Drop or choose a file to import |
| `PhotoCapture` | Take or choose a photo (flyer, setlist photo) |
| `TracklistPaste` | Paste a tracklist as text, preview the parse, import |

## Buttons

| Variant | Class | Use | Limit |
|---|---|---|---|
| Primary | `.sn-btn--primary` | The single main action of the view: "Build set", "Save set", "Import 24 tracks" | One per view (dialog counts as its own view) |
| Default | `.sn-btn` | Other actions: "Try another take", "Copy tracklist" | Up to two beside the primary |
| Module | `.sn-btn--mod` in `.sn-m-<key>` | "Open in Set builder": go to or act in that module | Inside tonal cards and launcher areas |
| Quiet | `.sn-btn--quiet` | Toolbar and row actions, "Cancel" | Any |
| Danger | `.sn-btn--danger` | The confirm button of a destructive `ConfirmDialog` only | One |
| Danger quiet | `.sn-btn--danger-quiet` | "Delete set" in a settings or detail page | One per section |

- Sizes: `--sm` 32px (tables, dense toolbars), default 40px, `--lg` 48px (empty states, booth, touch-first). Coarse pointers get at least `touch-min`.
- Labels: verb first, sentence case, name the object: "Save set", "Send to TIDAL", "Approve match". Not "OK", "Submit", "Yes".
- Icon + label: icon before the label, 18px, `aria-hidden`. Icons never replace words on primary or destructive actions.
- Icon-only (`.sn-btn--icon`): only for universal actions (close `x`, overflow `ellipsis`, drawer `menu`, move `arrow-up`/`arrow-down`, lock `lock`) and only with `aria-label` naming action and object ("Move Bicep – Glue up") plus a `Tooltip` with the same text and shortcut.
- Loading: set `aria-busy="true"`, swap the icon for `.sn-spinner`, keep the label ("Building set…"), keep the width. Disable repeat clicks, not the whole form.
- Disabled: prefer enabled + explanation. If disabled, use `aria-disabled="true"` (stays focusable) and a `Tooltip` saying why: "Add a key to every track to build a set".

## Choosing a toggle

| Need | Use | Example |
|---|---|---|
| Show rows matching one of several values | `FilterChip` group (`aria-pressed`) | Pillar: House, Techno, UK garage |
| Include rows matching a condition | `Checkbox` | "Has key and BPM", "Needs an energy check", "Played on 2+ shows" |
| Turn a setting on that applies at once | `Switch` (`role="switch"`) | "Show edge labels", "Live updates" |
| Pick one mode or view of the same content | `SegmentedControl` | Play / Plan, Table / Grid |
| Pick one of many (more than 4) | `SelectField` | Set shape: Journey (two peaks) … Steady groove |
| Agree or confirm in a form | `Checkbox` | "Also remove from TIDAL playlist" |

Never use a `Switch` inside a form that has a Save button; never use a `Checkbox` for something that applies instantly outside a filter.

## Filter and search bars

- Filters apply live as they change. No "Apply" button (except on phones, where the filter sheet has "Show 214 tracks").
- The result count updates with every change and is announced politely (`aria-live="polite"`): "214 of 1,284 tracks".
- Show "Clear filters" (quiet button) whenever any filter differs from the default; it resets filters, not search text, sort or selection.
- Active filters on phones and tablets appear as removable chips above the table.
- Filters persist per person (local storage key `sn-filters-<page>`) and in the URL (see Navigation). A shared URL wins over the stored filters.
- `SearchField`: `search` icon, placeholder names what is searched ("Search tracks, artists, labels"), `x` clear button when not empty, debounce 150 ms, Escape clears. Never put an emoji in a placeholder (the current magnifier-emoji placeholder "Search tracks, artists, BPM, key..." in `DJInterface.tsx`).
- `FilterRail` order in the music library: Search, Pillar, Energy tier, Rotation, Heard on, Tags, then the condition checkboxes. The rail stays visible from 1024px up; below 1024px it becomes a "Filters (n)" button (icon `list-filter`, count in the label) opening a side sheet.
- Energy tier chips carry a mini 3-segment bar of the tier's range instead of a single swatch: Low `energy-1` `energy-3` `energy-4`, Building `energy-5` `energy-6` `energy-7`, High `energy-8` `energy-9` `energy-10`. The label ("Low 1–4") carries the meaning; the bar is decoration (`aria-hidden`).
- Rotation chip counts come from the weekly run: High rotation and Vault are worked out by the weekly run from the library's own play data. Never write a threshold into a chip label or help text.

## Form fields

- Labels above the field (`.sn-field > label`), always visible, sentence case, no colon. Placeholders show an example format only ("e.g. 92"), never the label.
- Mark the minority: if most fields are required, mark optional ones "(optional)" after the label; never use asterisks alone.
- Help text sits under the label in `.sn-field__help`, linked to the input with `aria-describedby`.
- Validate on blur and on submit, not on every keystroke. Clear an error as soon as the value becomes valid.
- Errors in `.sn-field__error` (✕ glyph + text) say what is wrong and how to fix it: "Enter a length between 30 and 360 minutes". Set `aria-invalid="true"`.
- Forms with more than five fields show an error summary `InlineMessage` (bad) at the top on submit, listing each error as a link to its field, and move focus to it.
- Field width matches the expected value (BPM 6ch, set length 8ch, set name full width).

| Field | Rules |
|---|---|
| `NumberField` | `inputmode="numeric"` or `"decimal"`, unit outside the input ("min", "BPM"), steppers `minus`/`plus` optional, arrow keys step, Shift+arrow ×10. Accept "124.0" and "124". |
| `DateField` | Shows "24 Oct 2026"; accepts typed "24/10/2026" (en-AU day first) and ISO; `calendar` icon opens a picker; weeks start Monday. |
| `SelectField` | Native `select` (`.sn-select`) up to ~15 options; above that, a searchable list. Options in a meaningful order (set shapes by energy shape, not alphabetical). |
| `Checkbox` | `.sn-check`; the whole label is clickable; groups wrapped in `fieldset` + `legend`. |
| `SecretField` | For API keys and tokens: masked by default, `eye`/`eye-off` reveal toggle (`aria-pressed`), `CopyButton`, shows only the last four characters after saving ("•••• 3f9a"). Never prefill a secret into the DOM after save. |
| `ChipInput` | Enter or comma adds; Backspace on empty removes the last; paste of a list splits on commas and new lines. |
| `RangeSlider` | Two thumbs with visible values, each also typeable; `aria-valuetext` "122 to 128 BPM". |
| `KeyPicker` | Selected keys use `KeyBadge`; the wheel is optional, a 12×2 grid is the accessible default. |

## Files, photos and pasted tracklists

- `FileDrop`: a dashed `line-strong` box with "Drop a JSON or CSV file, or choose a file", accepted types and size limit stated ("Target tracks JSON, up to 5 MB"). Keyboard: the "Choose a file" button is the control; the drop zone is a convenience.
- After choosing: show the file name, size and a parsed preview ("42 target tracks found, 3 already in the list") before anything is written. The import button names the count: "Import 39 tracks".
- `PhotoCapture`: "Take photo" (`camera`) on devices with a camera, "Choose photo" always. Show the image in `MediaViewer` before upload; strip location metadata before upload and say so.
- `TracklistPaste`: a `textarea` in `data` font; parse live; each line in the preview shows the match result with `StatusPill` (matched, possible match, not found). Unmatched lines stay editable.
- Upload progress uses `ProgressBar` with bytes ("2.1 of 4.8 MB"); failures keep the file chosen and offer "Try again".

## Copy to clipboard

- `CopyButton` (icon `copy`, label "Copy tracklist" or icon-only "Copy Spotify ID"). On success the icon becomes `check` and the label "Copied" for 2 s, announced via `aria-live`; no toast.
- On failure (artifact sandbox, denied permission) select the text in a read-only field and say "Press Ctrl+C to copy". Never fail silently.

## Modal surfaces

| Need | Use | Behaviour |
|---|---|---|
| Ask a question or collect a few fields; block until answered | `Dialog` (`radius-sheet`, `z-dialog`) | Modal, focus trapped, Escape cancels, title `title-m` |
| Confirm a destructive or irreversible action | `ConfirmDialog` | Names object and consequence; confirm button is the verb ("Delete set"), `--danger`; Cancel focused first |
| Show detail of a row while keeping the list in view | `SideSheet` (right, `z-drawer`) | Non-modal on desktop (`bp-desktop`+), modal full-height on phones; URL carries `?track=` |
| Small choice anchored to a control | `Popover` / `OverflowMenu` / `ContextMenu` (`z-popover`) | Light dismiss, arrow keys, returns focus |
| Look at images or step through media | `MediaViewer` (`z-dialog`) | Full screen, arrows, Escape, counter "3 of 12" |
| Short label for an icon or truncated text | `Tooltip` (`z-tooltip`) | Hover and focus, never holds actions |
| Tell the result of an action | `Toast` (`z-toast`) | 5 s, pausable on hover/focus, optional one action ("Undo") |

- Never stack dialogs. A dialog may open a `Popover`, not another `Dialog`.
- Replace every `window.alert` and `window.confirm` (25 calls in SongNodes, e.g. `DJInterface.tsx`, `TargetTracksManager.tsx`, `SettingsPanel.tsx`) with `ConfirmDialog` or `Toast`. They also fail inside artifacts.

## Saving

| Object | Rule |
|---|---|
| Set drafts (running order, controls) | Autosave locally on every change (debounced 1 s) to `sn-set-draft-<id>`; status "Draft saved on this device 21:30" in `fg-3`. Restore on reload with a `Banner` "Restored your unsaved draft from 21:30. Discard draft". |
| Shared sets, target tracks, attribution fixes | Explicit save: `Button --primary` "Save set". Show `StatusPill` saving → saved; unsaved changes mark the title with "· Unsaved" and the browser asks before leaving. |
| Preferences (theme, density, text size) | Apply and persist immediately; no save button. |
| Settings that touch other services (Spotify, TIDAL, API keys) | Explicit save per section; test the connection and show `ServiceStatus`. |
| Review queue decisions (approve, reject, skip) | Each decision saves at once and offers "Undo" in a `Toast` for 10 s. |

Do not mix autosave and a Save button on one surface. Ctrl/Cmd+S triggers the explicit save where one exists and does nothing elsewhere (no browser save dialog).
