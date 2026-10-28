/* SongNodes component props: documentation for the React components SongNodes implements, and the window.SongNodes helper API. */
/* SongNodes design system — Navigation group (documentation types for the React components). */

export type ModuleKey = "graph" | "library" | "sets" | "paths" | "harmony" | "sources" | "pipeline" | "services";
export type StatusKey = "ok" | "fair" | "warn" | "bad" | "info" | "running" | "idle";

/** One action shown in an OverflowMenu or ContextMenu. */
export interface MenuAction {
  /** Stable id passed back to onSelect. */
  id: string;
  /** Verb-first label in sentence case, e.g. "Export as CSV". */
  label: string;
  /** Lucide icon name from assets/Icons. */
  icon?: string;
  /** Shortcut hint shown as a key cap, e.g. "F". */
  shortcut?: string;
  /** When set the item is aria-disabled and this reason is shown under the label. */
  disabledReason?: string;
  /** Destructive: status-bad text, placed last after a separator; label ends with "…". */
  destructive?: boolean;
  /** Makes it a menuitemcheckbox with this checked state. */
  checked?: boolean;
  /** Group heading this item sits under, e.g. "Route". */
  group?: string;
}

export interface AppHeaderProps {
  /** Lead of the thin–bold page title, normally the module label ("Library"). */
  titleLead: string;
  /** Bold part of the page title ("Melbourne crate"). */
  title: string;
  /** Whether the navigation drawer is open (drives aria-expanded on the hamburger). */
  drawerOpen: boolean;
  /** Id of the NavDrawer element, for aria-controls. */
  drawerId: string;
  /** Called when the hamburger is pressed. */
  onOpenDrawer: () => void;
  /** Play/Plan switch, shown only on the graph page. */
  mode?: { value: "play" | "plan"; onChange: (mode: "play" | "plan") => void };
  /** When the page's data was last refreshed; shown relative with the absolute stamp in a tooltip. */
  updatedAt?: Date | string;
  /** Live-update connection state. */
  connection?: "live" | "reconnecting" | "offline";
  /** Opens the CommandPalette (also bound to Ctrl/⌘ K and /). */
  onOpenSearch: () => void;
  /** App-level secondary actions for the More actions menu. */
  menuActions?: MenuAction[];
  /** Called with the chosen menu action id. */
  onMenuAction?: (id: string) => void;
}

export interface NavDrawerProps {
  /** Open state; when false the drawer is visibility-hidden. */
  open: boolean;
  /** Called on Esc, scrim click, close button or after choosing a row. */
  onClose: () => void;
  /** The current page: a module key, "home" or "preferences". */
  current: ModuleKey | "home" | "preferences";
  /** Optional per-module badge: a neutral count, or a status pill when attention is needed. */
  badges?: Partial<Record<ModuleKey, { value: number; label: string; status?: StatusKey }>>;
  /** Builds the href for a destination. */
  hrefFor: (key: ModuleKey | "home" | "preferences") => string;
  /** Opens the ShortcutSheet from the footer row. */
  onShowShortcuts: () => void;
  /** Render inside a positioned parent instead of the viewport. */
  contained?: boolean;
}

export interface PageHeaderProps {
  /** Module that owns the page; sets the band colour and the title lead. */
  module: ModuleKey;
  /** Href of the module index, linked from the band. */
  moduleHref: string;
  /** Optional sub-page shown in the band after "›" ("Saved sets"). */
  section?: string;
  /** Bold part of the title ("Peak time Friday"). */
  title: string;
  /** One-line description with the key numbers. */
  description?: string;
  /** Freshness stamp: verb and time ("Saved", 24 Oct 2026 21:30). */
  stamp?: { verb: string; at: Date | string };
  /** At most one status pill for the page. */
  status?: { status: StatusKey; label: string };
  /** 0–2 visible secondary buttons; they fold into More actions under 600px. */
  secondaryActions?: MenuAction[];
  /** Further secondary actions, always in More actions. */
  menuActions?: MenuAction[];
  /** The view's single primary action, placed last. */
  primaryAction?: { label: string; icon?: string; onClick: () => void; busyLabel?: string; busy?: boolean };
  /** Called with any secondary or menu action id. */
  onAction?: (id: string) => void;
}

export interface TabsProps {
  /** Accessible name of the tab list ("Track detail"). */
  label: string;
  /** Tabs in fixed order. */
  tabs: { id: string; label: string; count?: number; countLabel?: string; changed?: boolean }[];
  /** Selected tab id. */
  value: string;
  /** Called with the new tab id (arrow keys select immediately). */
  onChange: (id: string) => void;
  /** Module whose colour draws the active line; falls back to brand. */
  module?: ModuleKey;
  /** Render function for the panel of the selected tab. */
  renderPanel: (id: string) => unknown;
}

export interface SegmentedControlProps<V extends string = string> {
  /** Accessible name when there is no visible label ("Mode"). */
  label?: string;
  /** Id of a visible label element; preferred over label. */
  labelledBy?: string;
  /** 2–4 options in a fixed order. */
  options: { value: V; label: string; icon?: string; ariaLabel?: string; disabledReason?: string }[];
  /** Selected value. */
  value: V;
  /** Called on selection; applies immediately. */
  onChange: (value: V) => void;
  /** Small 26px segments for headers and toolbars. */
  size?: "sm" | "md";
  /** Uppercase labels via CSS (Play/Plan). */
  caps?: boolean;
  /** Stretch to the container width with equal segments. */
  block?: boolean;
}

export interface PeriodNavProps {
  /** Current scale. */
  scale: "day" | "week" | "month";
  /** Start of the shown period (weeks start Monday, Australia/Melbourne). */
  start: Date;
  /** Called when the period or scale changes. */
  onChange: (next: { scale: "day" | "week" | "month"; start: Date }) => void;
  /** Hide the Day/Week/Month control for views with a single scale. */
  scales?: ("day" | "week" | "month")[];
  /** Latest period that has data; Next is disabled beyond it. */
  max?: Date;
  /** Bind [ and ] for this instance (one per page). */
  keyboard?: boolean;
}

export interface BreadcrumbsProps {
  /** Accessible name: "Breadcrumb" or "Navigation trail". */
  label?: string;
  /** Levels from the top; the last one is the current page and is not a link. */
  items: { label: string; href?: string; module: ModuleKey; icon?: boolean }[];
  /** Trail style for the mobile explorer, with a visible caption. */
  variant?: "default" | "trail";
  /** Collapse the middle when there are more levels than this (default 4). */
  maxVisible?: number;
}

export interface ShowMoreProps {
  /** Rows shown so far. */
  shown: number;
  /** Total rows matching the current filters. */
  total: number;
  /** Noun for the count ("tracks"). */
  noun: string;
  /** Rows added per click (default 300). */
  batch?: number;
  /** Offer "Show all" when total is at most this. */
  showAllUpTo?: number;
  /** Load the next batch; focus moves to the first new row afterwards. */
  onShowMore: (count: number) => void;
  /** True while a batch loads. */
  loading?: boolean;
}

export interface PaginationProps {
  /** Current page, 1-based. */
  page: number;
  /** Total number of items. */
  total: number;
  /** Items per page. */
  perPage: number;
  /** What the items are ("waiting for review"). */
  description: string;
  /** Accessible name of the page list ("Review queue pages"). */
  label: string;
  /** Called with the new page number. */
  onChange: (page: number) => void;
}

export interface LauncherCardProps {
  /** Module the card launches. */
  module: ModuleKey;
  /** Href of the module. */
  href: string;
  /** Bold part of the title, the headline count ("12 saved sets"). */
  title: string;
  /** One sentence with the latest or most urgent fact. */
  summary: string;
  /** One or two key figures. */
  figures: { value: string; label: string }[];
  /** Status pill, only when attention is needed. */
  status?: { status: StatusKey; label: string };
}

export interface OverflowMenuProps {
  /** Button name; "More actions", or "More actions for <row>" on rows. */
  label?: string;
  /** Items in order; destructive items go last. */
  actions: MenuAction[];
  /** Called with the chosen id; the menu closes and focus returns to the button. */
  onSelect: (id: string) => void;
  /** Quiet small button for table rows. */
  variant?: "page" | "row";
  /** Align or flip the menu. */
  placement?: "bottom-end" | "bottom-start" | "top-end" | "top-start";
}

export interface ContextMenuProps {
  /** What was right-clicked, long-pressed or Shift+F10'd. */
  target: { kind: "node" | "edge" | "canvas" | "row"; title: string; subtitle?: string };
  /** Viewport position to open at (clamped inside the screen). */
  position: { x: number; y: number };
  /** Items for this target (see README for the standard sets). */
  actions: MenuAction[];
  /** Called with the chosen id. */
  onSelect: (id: string) => void;
  /** Called on Esc, outside click or Tab; focus returns to the target. */
  onClose: () => void;
}

export interface CommandPaletteProps {
  /** Open state (Ctrl/⌘ K and / open it). */
  open: boolean;
  /** Called on the second Esc or a scrim click. */
  onClose: () => void;
  /** Search function; a Camelot code filters by key, a 2–3 digit number by BPM ±1. */
  search: (query: string) => PaletteGroup[];
  /** Groups shown before typing (recent items, a few pages and actions). */
  recent: PaletteGroup[];
  /** Called with the chosen result. */
  onPick: (item: PaletteItem) => void;
}
export interface PaletteGroup { label: "Tracks" | "Artists" | "Sets" | "Pages" | "Actions" | string; items: PaletteItem[] }
export interface PaletteItem {
  /** Stable id. */
  id: string;
  /** Kind of result; decides the row layout. */
  kind: "track" | "artist" | "set" | "page" | "action";
  /** Main text (track title, artist, set or page name, action verb). */
  name: string;
  /** Secondary text (artist for a track, "38 tracks", "18 tracks · 1 h 32 min"). */
  sub?: string;
  /** Track data shown at the right. */
  track?: { key?: string; bpm?: number; energy?: number };
  /** Destination module for icon colour. */
  module?: ModuleKey;
  /** Lucide icon name. */
  icon: string;
  /** Shortcut hint for actions. */
  shortcut?: string;
}

export interface ShortcutSheetProps {
  /** Open state (? opens it outside text fields). */
  open: boolean;
  /** Called on Esc, close button or scrim click; focus returns to the opener. */
  onClose: () => void;
  /** Tables by scope; keys use "+" for combos, "|" for alternatives and " then " for sequences. */
  groups: { title: string; scope: string; rows: { keys: string; action: string }[] }[];
  /** Shortcuts removed because they clashed, shown as a note. */
  removed?: { keys: string; note: string }[];
}

export interface PreferencesPanelProps {
  /** Current preferences, from SongNodes.prefs.get() plus motion. */
  value: { theme: "system" | "dark" | "light" | "booth"; textSize: "s" | "m" | "l" | "xl"; density: "comfortable" | "compact"; motion: "system" | "reduce" };
  /** Called on every change; apply immediately via SongNodes.prefs. */
  onChange: (next: PreferencesPanelProps["value"]) => void;
  /** Called by the close button. */
  onClose?: () => void;
}
/* SongNodes design system: inputs and actions (documentation types for the React components).
   Markup and classes: components/<Comp>/README.md; styles: source/css/00-core.css + 20-inputs.css. */

import type { ReactNode, MouseEvent } from "react";

/** Module keys (identity colours). */
type ModuleKey = "graph" | "library" | "sets" | "paths" | "harmony" | "sources" | "pipeline" | "services";
/** Camelot key code, "1A"…"12B". */
type CamelotKey = `${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12}${"A" | "B"}`;
/** Energy tier keys used by TIER_LABEL. */
type EnergyTier = "low" | "building" | "high";

export interface ButtonProps {
  /** Visual kind; at most one "primary" per view. */
  kind?: "primary" | "secondary" | "quiet" | "module" | "danger" | "danger-quiet";
  /** Module scope for kind="module" (sets the fill colour). */
  module?: ModuleKey;
  /** Height: sm 32px, md 40px (default), lg 48px; all grow to 44px on touch. */
  size?: "sm" | "md" | "lg";
  /** Lucide icon name shown before the label. */
  icon?: string;
  /** Icon-only button: the label becomes aria-label and is required. */
  iconOnly?: boolean;
  /** Verb-first label in sentence case ("Build set"). */
  children: ReactNode;
  /** Busy: shows sn-spinner, sets aria-busy, keeps width; pass the ongoing verb as busyLabel. */
  busy?: boolean;
  /** Label while busy ("Saving…"). */
  busyLabel?: string;
  /** Disabled; prefer disabledReason so it stays focusable with aria-disabled. */
  disabled?: boolean;
  /** Why it is disabled; renders aria-disabled and an associated description. */
  disabledReason?: string;
  /** Toggle state for toggle buttons (aria-pressed). */
  pressed?: boolean;
  /** Native button type; defaults to "button". */
  type?: "button" | "submit" | "reset";
  /** Click handler. */
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}

export interface TextLinkProps {
  /** Destination URL or route. */
  href: string;
  /** Module the link opens; sets the colour. Omit for the generic `link` colour. */
  module?: ModuleKey;
  /** Leaves SongNodes: adds ↗, target=_blank, rel=noopener and the hidden "opens in a new tab". */
  external?: boolean;
  /** Link sits inside a tonal card: uses destination ink text with the destination-hue underline. */
  onTonal?: boolean;
  /** Render as a mono path/ID that breaks anywhere. */
  path?: boolean;
  /** Allow long URLs in prose to break anywhere. */
  breakAnywhere?: boolean;
  /** Marks the link to the current page (aria-current="page"). */
  current?: boolean;
  /** Link text naming the destination. */
  children: ReactNode;
}

export interface CopyButtonProps {
  /** Text placed on the clipboard. */
  value: string;
  /** What is copied, for the label and the announcement ("Tracklist", "ISRC"). */
  what: string;
  /** Visible label ("Copy tracklist"); omit with iconOnly. */
  label?: string;
  /** Icon-only button (aria-label "Copy <what>"). */
  iconOnly?: boolean;
  /** Show the value itself beside the button, with its source name ("Spotify ID"). */
  showValue?: { name: string };
  /** Button size. */
  size?: "sm" | "md";
  /** Milliseconds the check icon and "Copied" stay; default 2000. */
  confirmMs?: number;
  /** Called after a successful copy. */
  onCopied?: () => void;
  /** Called when every clipboard method is refused and the select-the-text fallback is shown. */
  onFallback?: () => void;
}

interface FilterChipOption {
  /** Stable value. */
  value: string;
  /** Label in sentence case; for tiers use TIER_LABEL. */
  label: string;
  /** Number of matching items, shown in mono; 0 renders the empty style. */
  count?: number;
  /** Energy tier swatch for tier chips. */
  tier?: EnergyTier;
  /** Brand-soft emphasis while off (Rotation High). */
  emphasis?: boolean;
}
export interface FilterChipProps {
  /** Group legend ("Pillar", "Energy tier"). */
  legend: string;
  /** Chips in fixed order. */
  options: FilterChipOption[];
  /** Selected values. */
  value: string[];
  /** Called with the new selection. */
  onChange: (value: string[]) => void;
  /** Show the "Clear (n)" button when anything is selected; default true. */
  clearable?: boolean;
}

export interface SearchFieldProps {
  /** Current query. */
  value: string;
  /** Called on every change (debounce outside for large lists). */
  onChange: (value: string) => void;
  /** Visually hidden label ("Search tracks"). */
  label: string;
  /** Placeholder naming what can be searched. */
  placeholder?: string;
  /** Matching count and total, rendered "42 of 1,284 tracks". */
  resultCount?: { shown: number; total: number; noun?: string };
  /** Typo-tolerant suggestion shown when there are no results ("Overmono"). */
  suggestion?: string;
  /** Called when the suggestion is chosen. */
  onSuggestion?: (s: string) => void;
  /** Register the "/" shortcut and show its hint; default false. */
  shortcut?: boolean;
}
/** One option in an AutocompleteSearchField popup. */
export interface AutocompleteOption {
  /** Stable id (unique within the field). */
  id: string;
  /** Text inserted into the field when chosen ("Bicep"). */
  value: string;
  /** Shown text if it differs from value ("Bicep – Glue"); the typed prefix is marked bold. */
  label?: string;
  /** Right-hand meta in mono ("Artist · 41 tracks", "8A · 124 BPM"). */
  meta?: string;
}
export interface AutocompleteSearchFieldProps extends SearchFieldProps {
  /** Completions for the current query, best first; at most 8 are shown. */
  suggestions: AutocompleteOption[];
  /** Recent queries, newest first; shown (at most 5) when the field is empty or they match the query. */
  recent?: string[];
  /** Called with the chosen option (or the typed text on Enter with no active option). */
  onSelect: (value: string, option?: AutocompleteOption) => void;
  /** Clears the recent list; shows "Clear recent searches" in the popup foot when given. */
  onClearRecent?: () => void;
  /** Group label for suggestions; default "Suggestions" ("Tracks" on the route finder). */
  suggestionsLabel?: string;
}

/** A saved filter view shown as a preset chip (FilterChip preset variant). */
export interface FilterPreset {
  /** Stable id. */
  id: string;
  /** Name in sentence case ("Warmup 118–122"). */
  label: string;
}
export interface FilterPresetsProps {
  /** Saved presets in the order they were saved. */
  presets: FilterPreset[];
  /** Id of the preset that matches the current filters exactly, if any (rendered pressed). */
  activeId?: string;
  /** Apply a preset. */
  onApply: (id: string) => void;
  /** Delete a preset (show a Toast with Undo). */
  onDelete: (id: string) => void;
  /** Save the current filters under a name; disabled when no filter is set. */
  onSave: (label: string) => void;
}

export interface FilterRailProps {
  /** Rail sections (SearchField, FilterChip groups, SelectField, Checkbox group) in order. */
  children: ReactNode;
  /** Active filters for the phone/tablet summary chips. */
  active: { id: string; label: string }[];
  /** Remove one active filter. */
  onRemove: (id: string) => void;
  /** Clear every filter. */
  onClear: () => void;
  /** Live result count for the sheet's "Show n tracks" button. */
  resultCount: number;
  /** Force a layout; default is responsive (rail at 1100px and wider, sheet below). */
  layout?: "rail" | "sheet";
}

export interface TextFieldProps {
  /** Visible label (noun, sentence case). */
  label: string;
  /** Value. */
  value: string;
  /** Change handler. */
  onChange: (value: string) => void;
  /** Help text with a real example. */
  help?: ReactNode;
  /** Error message; sets aria-invalid and links it with aria-describedby. */
  error?: string;
  /** Marks the field "(optional)"; required is the default and not marked. */
  optional?: boolean;
  /** Character limit shown as "18 / 40"; typing past it is allowed and shows an error. */
  maxLength?: number;
  /** Multi-line textarea with this many rows. */
  rows?: number;
  /** Mono font for IDs and codes. */
  data?: boolean;
  /** Read-only (dashed, focusable, copyable). */
  readOnly?: boolean;
  /** Disabled with the reason shown beside a lock icon. */
  disabledReason?: string;
}

export interface NumberFieldProps {
  /** Visible label. */
  label: string;
  /** Current value. */
  value: number;
  /** Called with a committed, clamped, step-snapped value. */
  onChange: (value: number) => void;
  /** Unit shown inside the box and in aria-valuetext ("BPM", "min", "%"). */
  unit: string;
  /** Minimum allowed. */
  min: number;
  /** Maximum allowed. */
  max: number;
  /** Step for arrows and steppers; Page Up/Down use 10 steps. Default 1. */
  step?: number;
  /** Help text. */
  help?: string;
  /** Error message (out of range or not a number). */
  error?: string;
  /** Disabled. */
  disabled?: boolean;
}

export interface SelectFieldProps {
  /** Visible label. */
  label: string;
  /** Options (keep under about 15; otherwise use a combobox). */
  options: { value: string; label: string }[];
  /** Selected value; "" for the neutral first option ("Any show"). */
  value: string;
  /** Change handler. */
  onChange: (value: string) => void;
  /** Help text. */
  help?: string;
  /** Error message. */
  error?: string;
  /** Label beside the select, 32px tall, for toolbars ("Sort by"). */
  inline?: boolean;
  /** Disabled with a reason in the help line. */
  disabledReason?: string;
}

export interface CheckboxProps {
  /** Label: positive statement in sentence case. */
  label: ReactNode;
  /** Checked state. */
  checked: boolean;
  /** Mixed state for select-all (sets input.indeterminate). */
  indeterminate?: boolean;
  /** Change handler. */
  onChange: (checked: boolean) => void;
  /** Hint under the label. */
  hint?: string;
  /** Count shown in mono after the label. */
  count?: number;
  /** Disabled with the reason as the hint. */
  disabledReason?: string;
  /** Render a radio instead (with name and value). */
  radio?: { name: string; value: string };
  /** Label-less box for table cells; ariaLabel is then required. */
  bare?: boolean;
  /** Accessible name for bare boxes ("Select Bicep – Glue"). */
  ariaLabel?: string;
}
export interface CheckboxGroupProps {
  /** Fieldset legend. */
  legend: string;
  /** Help under the legend. */
  help?: string;
  /** Lay options in a row. */
  inline?: boolean;
  /** Checkbox or radio items. */
  children: ReactNode;
}

export interface SwitchProps {
  /** The setting, not the action ("Sprite mode (performance)"). */
  label: string;
  /** What changes and when. */
  description?: string;
  /** On or off. */
  checked: boolean;
  /** Applies immediately; resolve to show "Saved hh:mm". */
  onChange: (checked: boolean) => void | Promise<void>;
  /** Disabled (aria-disabled, focusable) with the reason as the description. */
  disabledReason?: string;
}

export interface RangeSliderProps {
  /** Group label ("BPM range"). */
  label: string;
  /** One value (single thumb) or [low, high] (dual thumb). */
  value: number | [number, number];
  /** Called while dragging and on key or box changes. */
  onChange: (value: number | [number, number]) => void;
  /** Scale minimum. */
  min: number;
  /** Scale maximum. */
  max: number;
  /** Arrow-key step; default 1. */
  step?: number;
  /** Page Up/Down step; default 10 steps. */
  bigStep?: number;
  /** Tick values to label on the scale (include both ends). */
  ticks?: number[];
  /** aria-valuetext and readout formatter ("124 BPM"). */
  format?: (v: number) => string;
  /** Accessible names for the thumbs and boxes ["Minimum BPM", "Maximum BPM"]. */
  thumbLabels: [string] | [string, string];
  /** Help text. */
  help?: string;
}

export interface DateFieldProps {
  /** Legend ("Released on"). */
  label: string;
  /** ISO date "2026-10-24" or null when empty. Date-only: no time zone. */
  value: string | null;
  /** Called with a valid ISO date, or null while incomplete. */
  onChange: (value: string | null) => void;
  /** Help, for example "For example, 24 10 2026". */
  help?: string;
  /** Error message; mark only the wrong parts with invalidParts. */
  error?: string;
  /** Which boxes are wrong. */
  invalidParts?: ("day" | "month" | "year")[];
  /** Use the native date input with the readable date underneath. */
  native?: boolean;
}
export interface DateRangeFieldProps {
  /** Legend ("Last heard between"). */
  label: string;
  /** [from, to] ISO dates. */
  value: [string | null, string | null];
  /** Change handler. */
  onChange: (value: [string | null, string | null]) => void;
  /** Presets; default Last 7 days, Last 30 days, This year. */
  presets?: { id: string; label: string; range: () => [string, string] }[];
  /** "Today" for presets, in Melbourne; defaults to the current date. */
  today?: string;
}

export interface SecretFieldProps {
  /** Visible label ("Setlist.fm API key"). */
  label: string;
  /** Server-provided mask of the saved key ("sk-…3f9a"); never the key. Null when none saved. */
  savedMask: string | null;
  /** Save a new key. */
  onSave: (key: string) => Promise<void>;
  /** Test the saved or typed key; resolves with the result. */
  onTest: (key?: string) => Promise<{ ok: boolean; message?: string; testedAt: string }>;
  /** Last test result to show on load. */
  lastTest?: { ok: boolean; message?: string; testedAt: string };
  /** Where to get a key (external link). */
  getKeyUrl?: string;
  /** Link text; default "Get an API key". */
  getKeyLabel?: string;
}

export interface FileDropProps {
  /** Visible label ("Import tracklists"). */
  label: string;
  /** Accepted extensions [".txt", ".csv"]. */
  accept: string[];
  /** Size limit per file in MB. */
  maxMb: number;
  /** Allow several files. */
  multiple?: boolean;
  /** Line under the title: types, contents and limit. */
  hint: string;
  /** Parse a valid file; resolve with a short summary or throw a message. */
  parse: (file: File) => Promise<{ summary: string }>;
  /** Files currently selected, with state. */
  files: { id: string; name: string; size: number; state: "reading" | "read" | "error"; progress?: number; summary?: string; error?: string }[];
  /** Files added (already type/size checked). */
  onAdd: (files: File[]) => void;
  /** Remove one file. */
  onRemove: (id: string) => void;
}

export interface PhotoCaptureProps {
  /** Title lead and title ("Crate photo: Add a sleeve"). */
  title: { lead: string; title: string };
  /** Current image (object URL or stored URL) or null. */
  src: string | null;
  /** File name, size and time line under the actions. */
  meta?: string;
  /** Alt-text value. */
  alt: string;
  /** Alt-text change. */
  onAltChange: (alt: string) => void;
  /** New image from camera or file (EXIF location removed before upload). */
  onImage: (file: File) => void;
  /** Remove the image. */
  onRemove: () => void;
  /** Show "Take photo" (rear camera on phones); default true when a camera is likely. */
  camera?: boolean;
  /** Size limit in MB; default 10. */
  maxMb?: number;
}

export interface ChipInputProps {
  /** Visible label. */
  label: string;
  /** Current chips. */
  value: string[];
  /** Called with the new list after add or remove. */
  onChange: (value: string[]) => void;
  /** Help line; default explains Enter, comma and Backspace. */
  help?: string;
  /** Placeholder for the text input ("Add a genre"). */
  placeholder?: string;
  /** Suggestions source; values already added are left out. */
  suggest?: (query: string) => { value: string; count?: number }[];
  /** Maximum number of chips. */
  max?: number;
}

export interface KeyPickerProps {
  /** Visible label ("Keys"). */
  label: string;
  /** Selected keys. */
  value: CamelotKey[];
  /** Change handler. */
  onChange: (value: CamelotKey[]) => void;
  /** Key of the playing or reference track; marked with the now bar and used by the quick select. */
  currentKey?: CamelotKey;
  /** Keys to outline as suggestions. */
  suggested?: CamelotKey[];
  /** Allow only one key (aria-pressed on one button at a time). */
  single?: boolean;
}

export interface TracklistPasteProps {
  /** Title lead/title ("Import tracklist: 3RRR Superfreak, 18 Oct 2026"). */
  title?: { lead: string; title: string };
  /** Pasted text (kept exactly as pasted). */
  value: string;
  /** Text change. */
  onChange: (value: string) => void;
  /** Library matcher: return the track id when artist and title are in the library. */
  match: (artist: string, title: string) => string | null;
  /** Import the read lines (in library and new). */
  onImport: (rows: { line: number; artist: string; title: string; label?: string; trackId: string | null }[]) => Promise<void>;
}
/* SongNodes design system — data display components (group 30). Documentation for the React components SongNodes should implement. */
import type { ReactNode } from "react";

export type Status = "ok" | "fair" | "warn" | "bad" | "info" | "running" | "idle";
export type CompatLevel = "perfect" | "compatible" | "possible" | "clash" | "unknown";
export type ModuleKey = "graph" | "library" | "sets" | "paths" | "harmony" | "sources" | "pipeline" | "services";

export interface FigureTileProps {
  /** The headline figure, already formatted ("1,284", "+38", "92 min"). */
  figure: string;
  /** Optional small unit or denominator after the figure ("of 7"). */
  unit?: string;
  /** What the figure counts, sentence case ("High rotation"). */
  label: string;
  /** Optional change or context line ("+38 added last run"). */
  delta?: string;
  /** Optional status shown as a StatusPill in the footer. */
  status?: { status: Status; label: string };
  /** Optional link to the filtered view this figure summarises. */
  href?: string;
  /** Link text, verb first ("Show these", "Review"). */
  linkLabel?: string;
  /** Render tonal in the nearest module scope (module hub pages only). */
  tonal?: boolean;
  /** Show a skeleton figure while loading. */
  loading?: boolean;
}

export interface StatusPillProps {
  /** Design status; or pass `raw` and let SongNodes.status() map it. */
  status?: Status;
  /** Raw backend enum (TaskStatus, ScraperStatus, ProxyStatus, EnrichmentStatus, CircuitState, health or save state). */
  raw?: string;
  /** Visible word; defaults to the mapped label ("Paused after errors"). */
  label?: string;
  /** Outline style for dense tables. */
  outline?: boolean;
  /** Larger size for page-level save state. */
  size?: "md" | "lg";
}

export interface CategoryTagProps {
  /** Tag text: genre, pillar, rotation, remix type or edge type. */
  children: ReactNode;
  /** Emphasis: "high" for High rotation (brand-soft), "vault" for muted, default neutral. */
  emphasis?: "default" | "high" | "vault";
  /** Optional Lucide icon name (edge types). */
  icon?: string;
}

export interface EnergyBarProps {
  /** Energy 1–10; null or undefined renders the unknown state. */
  value: number | null | undefined;
  /** "row" for tables (default), "lg" for detail views (adds the tier label). */
  size?: "row" | "lg";
  /** Set target for this slot; outlines that segment and shows "target N". */
  target?: number;
  /** Energy is an estimate that needs a listen; shows the "Check" flag. */
  needsCheck?: boolean;
}

export interface KeyBadgeProps {
  /** Any key notation ("8A", "Am", "A minor"); normalised with SongNodes.camelot(). */
  value: string | null | undefined;
  /** Show the key name next to the code (detail views). */
  withName?: boolean;
  /** "row" (default) or "lg" for detail headers. */
  size?: "row" | "lg";
}

export interface BpmReadoutProps {
  /** BPM; one decimal shown only when fractional (123.5). */
  value?: number | null;
  /** Upper bound for a range ("122–128"). */
  to?: number;
  /** Half- or double-time reading shown in brackets ("87 (174)"). */
  alt?: number;
  /** Show the "BPM" unit after the number. */
  unit?: boolean;
  /** "row" (default) or "lg" for detail views. */
  size?: "row" | "lg";
  /** Previous track's BPM: renders the transition delta with its verdict instead. */
  deltaFrom?: number;
}

export interface CompatibilityBadgeProps {
  /** Verdict level (from SongNodes.compat, bpmStep or energyStep). */
  level: CompatLevel;
  /** Visible words ("+1 key", "−2 BPM", "energy +1"). */
  label: string;
  /** Outline style for tables and rule lists. */
  outline?: boolean;
}

export interface TransitionNoteItem {
  /** What changes: "energy", "key", "bpm" or "genre". */
  kind: "energy" | "key" | "bpm" | "genre";
  /** Verdict colour and glyph. */
  level: CompatLevel | "neutral";
  /** Short label ("+1 key 8A→9A", "+2 BPM", "House → UK garage"). */
  label: string;
  /** One-sentence reason, shown in the expanded form and the tooltip. */
  why?: string;
}

export interface TransitionNoteProps {
  /** One item per dimension that changes between the two slots. */
  items: TransitionNoteItem[];
  /** Expanded form with reasons (slot detail, hover card). */
  expanded?: boolean;
}

export interface TrackCellProps {
  /** Artist credit as shown ("Fred again.."). */
  artist: string;
  /** Track title without the mix name. */
  title: string;
  /** Mix name ("Extended mix", "VIP"). */
  mix?: string;
  /** Record label. */
  label?: string;
  /** Duration in seconds; shown as "6:12". */
  durationSec?: number;
  /** Marks the now-playing track. */
  now?: boolean;
  /** Energy is estimated and needs a listen. */
  needsEnergyCheck?: boolean;
  /** Beatport match is uncertain. */
  needsBeatportCheck?: boolean;
  /** Service links shown as small external text links. */
  links?: { service: "TIDAL" | "Deezer" | "Beatport" | "Spotify"; href: string }[];
  /** One-line compact form for 32px rows. */
  compact?: boolean;
}

export interface DataTableColumn<T> {
  /** Stable column id (persisted in the column chooser). */
  id: string;
  /** Header text, sentence case. */
  header: string;
  /** Right-align and use tabular mono figures. */
  numeric?: boolean;
  /** Sort accessor; omit for unsortable columns. */
  sortValue?: (row: T) => string | number | null;
  /** Cell renderer. */
  cell: (row: T) => ReactNode;
  /** Visible by default (crate: Energy, Track, BPM, Key, Pillar, Rotation, Heard, Last heard). */
  defaultVisible?: boolean;
  /** Cannot be hidden (Track). */
  fixed?: boolean;
  /** Label used on the stacked phone card; defaults to header. */
  stackLabel?: string;
}

export interface DataTableProps<T> {
  /** Rows to show. */
  rows: T[];
  /** Column definitions. */
  columns: DataTableColumn<T>[];
  /** Row id accessor. */
  rowId: (row: T) => string;
  /** Caption naming the table and its scope ("Crate · 12 of 1,284 tracks"). */
  caption: string;
  /** Current sort; one column at a time. */
  sort?: { column: string; direction: "ascending" | "descending" };
  /** Called when a header is activated. */
  onSortChange?: (sort: { column: string; direction: "ascending" | "descending" }) => void;
  /** Tiebreak accessor applied after the sort column (default artist then title). */
  tiebreak?: (row: T) => string;
  /** Selected row ids; enables the checkbox column and select-all. */
  selected?: Set<string>;
  /** Selection change handler. */
  onSelectionChange?: (ids: Set<string>) => void;
  /** Group rows by this accessor; group header shows the name and count. */
  groupBy?: (row: T) => string;
  /** Order of group keys and their display names. */
  groups?: { key: string; label: string }[];
  /** Flagged rows get flag-bg. */
  isFlagged?: (row: T) => boolean;
  /** The now row gets the 3px now bar. */
  isNow?: (row: T) => boolean;
  /** Row actions rendered at row end (quiet icon buttons, then OverflowMenu). */
  rowActions?: (row: T) => ReactNode;
  /** Bulk actions shown in the toolbar when rows are selected. */
  bulkActions?: (ids: Set<string>) => ReactNode;
  /** Row height; persisted per person via SongNodes.prefs.setDensity. */
  density?: "comfortable" | "compact";
  /** Visible column ids; persisted per person. */
  visibleColumns?: string[];
  /** Data state; non-data states replace the body with one explanatory row. */
  state?: "data" | "loading" | "empty" | "error";
  /** Empty and error copy plus their single action. */
  emptyMessage?: { title: string; body: string; action?: ReactNode };
  /** Error copy: what happened and what to do next. */
  errorMessage?: { title: string; body: string; action?: ReactNode };
  /** Max height of the scroll box before the sticky header takes over (default 480px). */
  maxHeight?: string;
  /** Keyboard row navigation (J/K, arrows, Enter, Space, T): the scroll box takes focus; default false. */
  keyboard?: boolean;
  /** Id of the keyboard-active row (outlined, not selected). */
  activeRowId?: string;
  /** Called when J/K or the arrow keys move the active row. */
  onActiveRowChange?: (id: string) => void;
  /** Enter on the active row (open the track). */
  onRowOpen?: (row: T) => void;
  /** Single-letter quick actions on the active row, e.g. { t: addToTargets, " ": togglePreview }. */
  rowShortcuts?: Record<string, (row: T) => void>;
}

export interface MiniAudioPreviewProps {
  /** Preview clip URL (about 30 seconds); missing or failing renders the unavailable state. */
  src?: string | null;
  /** Track named in the button label ("Bicep – Glue"). */
  title: string;
  /** Clip length in seconds when known before loading (default 30). */
  duration?: number;
}

export interface KeyValueGridProps {
  /** Label/value pairs; null values render as an en dash. */
  items: { label: string; value: ReactNode | null; copy?: string; mono?: boolean }[];
  /** Layout: one pair per row (default), two pairs per row, or stacked tiles. */
  layout?: "single" | "two" | "stacked";
}

export interface SourceBadgeProps {
  /** Where the track was heard or found, most relevant first. */
  sources: { name: string; kind: "radio" | "list" | "chart" | "store"; detail?: string; when?: string }[];
  /** How many sources to show before "+N" (default 1). */
  max?: number;
}

export interface ServiceStatusProps {
  /** The connected service. */
  service: "Spotify" | "TIDAL" | "Beatport";
  /** Connection state. */
  state: "connected" | "expired" | "not-connected" | "error";
  /** Account name when connected. */
  account?: string;
  /** Expiry as an ISO date. */
  expiresAt?: string;
  /** What happened and what to do next (expired, error). */
  detail?: string;
  /** Connect or reconnect handler. */
  onConnect?: () => void;
  /** Disconnect handler. */
  onDisconnect?: () => void;
}

export interface FreshnessStampProps {
  /** Lead-in naming the data ("Library as of"). */
  label: string;
  /** Data time as ISO; null when never loaded. */
  at: string | null;
  /** Days after which the stamp warns (default 8, weekly data). */
  staleAfterDays?: number;
  /** A refresh is running; the old stamp stays. */
  refreshing?: boolean;
  /** Short relative form for headers and card footers. */
  short?: boolean;
}

export interface ConnectionStatusProps {
  /** Live-update connection state. */
  state: "live" | "reconnecting" | "offline" | "partial";
  /** Reconnect attempt number. */
  attempt?: number;
  /** Time of the data on screen when offline (ISO). */
  dataAt?: string;
  /** Unreachable source name for "partial". */
  source?: string;
  /** Compact header pill or full-width banner. */
  form?: "compact" | "banner";
  /** Retry handler (banner). */
  onRetry?: () => void;
}

export interface ChecklistProps {
  /** Check rows in display order. */
  items: { state: "pass" | "fail" | "warn" | "pending"; label: string; note?: string; aside?: string }[];
  /** Show the counts summary above the list. */
  summary?: boolean;
  /** Tight rows without dividers (table cells, tooltips). */
  compact?: boolean;
}

export interface DisclosureProps {
  /** Summary text, sentence case. */
  summary: string;
  /** Optional right-aligned hint ("2 on", "1 to 10"). */
  hint?: string;
  /** Storage key; open state is remembered per section on this device. */
  rememberKey?: string;
  /** Initially open when nothing is remembered. */
  defaultOpen?: boolean;
  /** Bordered box variant (filter rail). */
  boxed?: boolean;
  /** Section content. */
  children: ReactNode;
}

export interface SectionHeadingProps {
  /** Thin lead-in before the colon ("Crate"). */
  lead?: string;
  /** Bold title. */
  title: string;
  /** Heading level and size. */
  size?: "title-m" | "title-s";
  /** Heading element level. */
  level?: 2 | 3 | 4;
  /** Count after the title ("47 tracks"). */
  count?: string;
  /** Right-side action or link. */
  end?: ReactNode;
  /** One-line caveat under the title. */
  caveat?: ReactNode;
  /** Rule under the heading. */
  rule?: boolean;
}

export interface CardProps {
  /** Variant: neutral (default), tonal, media, list or link. */
  variant?: "neutral" | "tonal" | "media" | "list" | "link";
  /** Module scope for tonal, media placeholders and link hover. */
  module?: ModuleKey;
  /** Image URL for media cards. */
  image?: string;
  /** Eyebrow line above the title. */
  eyebrow?: string;
  /** Card title (for link cards this becomes the one primary link). */
  title?: ReactNode;
  /** Destination for link cards; the whole card is clickable. */
  href?: string;
  /** Footer actions, pinned to the bottom so grid heights align. */
  footer?: ReactNode;
  /** Compact padding. */
  compact?: boolean;
  /** Body. */
  children?: ReactNode;
}

export interface SetCardProps {
  /** Set name. */
  name: string;
  /** Set shape ("Peak time three waves"). */
  shape: string;
  /** Length in minutes. */
  lengthMin: number;
  /** Number of tracks. */
  trackCount: number;
  /** Number of peaks in the energy wave. */
  peaks: number;
  /** Energy per slot, 1–10, drawn as the mini wave. */
  wave: number[];
  /** "Send to TIDAL" state. */
  tidal: { status: "not-sent" | "queued" | "sent" | "failed"; label: string };
  /** Last updated, ISO. */
  updatedAt: string;
  /** Link to open the set. */
  href: string;
  /** Duplicate handler. */
  onDuplicate?: () => void;
}

export interface SetSlotProps {
  /** Slot number, 1-based. */
  index: number;
  /** Target energy for this slot from the set shape. */
  targetEnergy: number;
  /** The track in this slot; omit for an empty slot. */
  track?: TrackCellProps & { energy: number | null; bpm: number | null; key: string | null };
  /** Locked slots survive "Try another take" and cannot move. */
  locked?: boolean;
  /** Current slot while playing. */
  now?: boolean;
  /** Up to 3 spare suggestions. */
  spares?: { artist: string; title: string; energy: number; key: string }[];
  /** Why the slot is empty and what to do. */
  emptyReason?: string;
  /** Action handlers. */
  onLock?: (locked: boolean) => void;
  onMove?: (direction: "up" | "down") => void;
  onRemove?: () => void;
  onSwapIn?: (spareIndex: number) => void;
}
/* SongNodes design system — Charts group (documentation types for the React components SongNodes should implement). */

/** One data series in a chart. Colour comes from its fixed slot, never from rank. */
export interface ChartSeries {
  /** Stable id; the colour slot follows the entity across filters. */
  id: string;
  /** Visible name used for direct labels, legend and tooltip ("House"). */
  name: string;
  /** Categorical slot 1–8 → `var(--chart-N)`. */
  slot: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** Values aligned to the chart's x categories; null = no data. */
  values: Array<number | null>;
  /** Marker shape at the end point, second cue besides colour. */
  shape?: "circle" | "square" | "diamond";
}

export interface ChartFrameProps {
  /** Dimmed lead-in of the thin–bold title, without the colon ("Library"). */
  lead?: string;
  /** Bold title in sentence case ("Plays per week by pillar"). */
  title: string;
  /** Unit, period and source ("Radio plays · 12 weeks, 3 Aug – 24 Oct 2026"). */
  subtitle: string;
  /** Chart form. */
  kind: "line" | "bar";
  /** X categories, already formatted ("3 Aug", "124–126"). */
  categories: string[];
  /** Series to draw; more than 3 switches from direct labels to a legend row. */
  series: ChartSeries[];
  /** Fixed y domain; default 0 to a nice max. */
  yDomain?: [number, number];
  /** Labelled dashed reference line. */
  reference?: { value: number; label: string };
  /** Fractional x index of "now" (vertical --now line + "Now" tag). */
  nowAt?: number;
  /** First x index of simulated/projected data; drawn hatched and labelled "Preview". */
  previewFrom?: number;
  /** One-sentence takeaway used as the SVG description for screen readers. */
  summary: string;
  /** Index of the bar or point that gets a direct value label. */
  emphasise?: number;
  /** Show the loading skeleton (keeps the frame size). */
  loading?: boolean;
  /** Empty-state copy and its one action; shown when every value is null or 0. */
  empty?: { title: string; help: string; actionLabel?: string; onAction?: () => void };
  /** Caption and column header for the "View as table" alternative. */
  tableCaption: string;
  /** Optional source / time zone note under the chart. */
  note?: string;
}

export interface EnergyWaveSlot {
  /** Track shown in the tooltip and table ("Overmono – So U Kno"). */
  track: string;
  /** Energy 1–10 → `var(--energy-N)`. */
  energy: number;
  /** Target energy from the set shape for this slot. */
  target: number;
}

export interface EnergyWaveProps {
  /** Set name for the title ("Peak time Friday"). */
  setName: string;
  /** Subtitle with track count, length and shape. */
  subtitle: string;
  /** Running order, slot 1 first. */
  slots: EnergyWaveSlot[];
  /** 1-based slot playing now; omit when not playing. */
  nowSlot?: number;
  /** 1-based first slot of a rebuild proposal; slots from here are hatched "Preview". */
  previewFrom?: number;
  /** Accept / discard handlers shown with a preview. */
  onUsePreview?: () => void;
  onDiscardPreview?: () => void;
  /** Compact height for saved-set cards. */
  compact?: boolean;
  /** Called with the slot index when a bar is activated (opens that row). */
  onSlotSelect?: (index: number) => void;
}

export interface ProgressStage {
  /** Stage name ("Enrich"). */
  name: string;
  /** Stage state. */
  state: "done" | "current" | "queued" | "failed";
  /** 0–100 for current or failed stages. */
  percent?: number;
}

export interface ProgressBarProps {
  /** What is in progress, with its object ("Import tracklists from 1001tracklists"). */
  label: string;
  /** Items done; omit with total for indeterminate. */
  value?: number;
  /** Items in total. */
  total?: number;
  /** Unit for the value text ("tracklists"). */
  unit?: string;
  /** Indeterminate: what it is waiting for ("Waiting for Spotify to lift the rate limit"). */
  waitingFor?: string;
  /** Staged job; replaces value/total with one segment per stage. */
  stages?: ProgressStage[];
  /** Bar height: 4, 8 or 12 px. */
  size?: "sm" | "md" | "lg";
  /** Footer text: start time and estimate, or what slowed it. */
  detail?: string;
  /** Raw backend status mapped by `SongNodes.status()` into a separate health pill. */
  health?: string;
}

export interface ProgressRingProps {
  /** Completion 0–1. */
  value: number;
  /** Ring size in px. */
  size: 24 | 40 | 64;
  /** Goal name, also the accessible name ("Library keyed"). */
  label: string;
  /** Counts and what's left ("616 of 1,284 tracks"). */
  detail?: string;
}

export interface HeatmapProps {
  /** Title lead and title ("Key & mood", "Library coverage"). */
  lead?: string;
  title: string;
  subtitle: string;
  /** Row headers; `camelot` adds the key dot ("8A"). */
  rows: Array<{ label: string; ariaLabel?: string; camelot?: string }>;
  /** Column headers; empty label keeps the column unlabelled visually. */
  columns: Array<{ label: string; ariaLabel?: string }>;
  /** Column indexes after which a 4px gap is drawn (energy tiers: [3, 6]). */
  gapsAfter?: number[];
  /** Counts [row][col]; null = no data (dashed), "future" = blank. */
  values: Array<Array<number | null | "future">>;
  /** Lower bounds of ramp steps 0–6; default [0, 1, 4, 8, 13, 19, 26]. */
  bins?: number[];
  /** Words for the no-data key ("No episode"). */
  noDataLabel?: string;
  /** Cell size in px. */
  cell?: { width: number; height: number };
  /** Readout and aria text for a cell. */
  describe: (row: number, col: number, value: number | null | "future") => string;
  /** Called when a cell is activated with Enter or click. */
  onCellSelect?: (row: number, col: number) => void;
}

export interface CamelotWheelProps {
  /** Key playing now, standard Camelot ("8A" = A minor). */
  nowKey?: string;
  /** Selected keys (multi-select filter). */
  selected: string[];
  /** Selection change. */
  onSelectedChange: (keys: string[]) => void;
  /** Track counts per key; shown when `showCounts`. */
  counts?: Record<string, number>;
  /** Show the count under each code. */
  showCounts?: boolean;
  /** Outline the clean mixes from `nowKey` (±1 same letter, relative key). Default true. */
  showCompatible?: boolean;
  /** Rendered size in px (max 420). */
  size?: number;
}

export type GraphColourMode = "none" | "energy" | "key" | "genre";
export type GraphEdgeType = "adjacency" | "similarity" | "key_compatibility" | "collaboration" | "genre";

export interface GraphStylesProps {
  /** Current node colour mode; the legend mirrors it. */
  colourMode: GraphColourMode;
  /** Genres in fixed slot order (max 7 + Other) for the genre legend. */
  genres?: string[];
  /** Edge types currently drawn (from the layer toggles). */
  visibleEdgeTypes: GraphEdgeType[];
  /** Whether a path is shown, to include path rings in the legend. */
  hasPath?: boolean;
  /** Collapsed behind a "Legend" button (phones). */
  collapsed?: boolean;
}

export interface GraphControlsProps {
  /** Node and link counts after filters. */
  nodeCount: number;
  edgeCount: number;
  /** Zoom factor, 0.25–4. */
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** Fit the whole graph in view. */
  onFit: () => void;
  /** Back to 100% centred. */
  onReset: () => void;
  /** Layout simulation running. */
  running: boolean;
  onToggleRunning: () => void;
  /** Link layers on/off. */
  layers: Record<GraphEdgeType, boolean>;
  onLayersChange: (layers: Record<GraphEdgeType, boolean>) => void;
  /** 2D/3D, omit to hide the switch. */
  dimension?: "2d" | "3d";
  onDimensionChange?: (d: "2d" | "3d") => void;
  /** Minimap viewport in graph units; omit to hide the minimap. */
  viewport?: { x: number; y: number; width: number; height: number };
}

export interface SparklineProps {
  /** Values oldest first (12 weeks). */
  values: number[];
  /** Week-start labels for the low/high tip ("3 Aug"). */
  labels: string[];
  /** What is counted, for the accessible sentence ("Plays per week"). */
  measure: string;
  /** Size preset: table 96×22, tile 132×32. */
  size?: "table" | "tile";
  /** Show the latest value beside the line. Default true. */
  showValue?: boolean;
  /** Focusable (figure tiles); table rows leave it false. */
  focusable?: boolean;
}

export interface WaveformStripProps {
  /** Track title for the header ("Bicep – Glue"). */
  title: string;
  /** Duration in seconds. */
  duration: number;
  /** Tempo for the beat grid and bar numbers. */
  bpm: number;
  /** Camelot key for the header. */
  camelot?: string;
  /** Envelope samples 0–1, evenly spaced over the duration. */
  envelope: number[];
  /** Intro, outro and breakdown regions in seconds. */
  sections: Array<{ start: number; end: number; kind: "intro" | "outro" | "breakdown"; label?: string }>;
  /** Vocal segments in seconds. */
  vocals: Array<{ start: number; end: number }>;
  /** Cue points (letter A–H, name). */
  cues: Array<{ at: number; letter: string; name: string }>;
  /** Energy curve points [seconds, 1–10]. */
  energy: Array<[number, number]>;
  /** Playhead position in seconds. */
  position: number;
  onSeek?: (seconds: number) => void;
  /** Zoom 1, 2, 4 or 8. */
  zoom?: 1 | 2 | 4 | 8;
  onZoomChange?: (z: 1 | 2 | 4 | 8) => void;
  /** When the analysis ran, for the subtitle. */
  analysedAt?: string;
}
/* SongNodes design system: feedback & surfaces (documentation types for the React components). */
import type { ReactNode } from "react";

/** Status keys shared with sn-pill. */
export type FeedbackStatus = "ok" | "fair" | "warn" | "bad" | "info";

export interface EmptyStateProps {
  /** Which empty case this is; picks the default icon and wording pattern. */
  kind: "first-use" | "filtered" | "not-connected" | "done";
  /** Lucide icon name shown muted in the circle (e.g. "list-music"). */
  icon: string;
  /** Short title in sentence case: "No sets yet". */
  title: string;
  /** One sentence: what will appear here and why it is empty now. */
  text: ReactNode;
  /** The one action that fills the panel ("Build set", "Clear filters", "Connect TIDAL"); omit for "done". */
  action?: ReactNode;
  /** Optional context under the text, e.g. the active filter tags. */
  meta?: ReactNode;
  /** Smaller padding and icon for panels under 320px tall. */
  compact?: boolean;
}

export interface LoadingStateProps {
  /** first = nothing to show yet (skeleton); refresh = data stays, slim top line shows. */
  mode: "first" | "refresh";
  /** Shape of the skeleton for first loads, matching the content that will arrive. */
  shape?: "rows" | "tiles" | "custom";
  /** Number of skeleton rows or tiles; match the expected first screen (default 5 rows / 3 tiles). */
  count?: number;
  /** What is loading, shown after 1 s: "Loading 1,284 tracks…". */
  message?: string;
  /** Delay before the message appears, in ms (default 1000). */
  messageDelayMs?: number;
  /** Last successful update, shown in the freshness stamp; replaced by "Updating…" while refreshing. */
  updatedAt?: Date | string;
  /** The real content (kept visible during refresh). */
  children?: ReactNode;
}

export interface StagedProgressStep {
  /** Step name, verb first: "Match plays to tracks". */
  name: string;
  /** done ●, running ↻, waiting –, failed ✕, cancelled –. */
  state: "done" | "running" | "waiting" | "failed" | "cancelled";
  /** Current detail: "Matching 312 of 500 tracks", or the failure reason. */
  detail?: string;
  /** Items done and total for the running step; shows a neutral progress bar when both are known. */
  done?: number;
  /** Total items for the running step. */
  total?: number;
  /** Seconds the step took (done/failed). */
  seconds?: number;
  /** Step-level actions after a failure ("Retry this step", "Skip MixesDB"). */
  actions?: ReactNode;
}

export interface StagedProgressProps {
  /** Thin–bold title parts: lead "Weekly build", title "Sat 24 Oct". */
  lead: string;
  /** Bold part of the title. */
  title: string;
  /** Ordered steps. */
  steps: StagedProgressStep[];
  /** Seconds since start; rendered as "Elapsed 4:18". */
  elapsedSeconds: number;
  /** Seconds left, only when the job can estimate honestly; rounded up ("About 3 min left"). */
  remainingSeconds?: number;
  /** Cancels the job; omit when the job cannot be cancelled. */
  onCancel?: () => void;
  /** True when the job runs on the server and survives navigation; shows the "You can leave this page" notice. */
  runsInBackground?: boolean;
}

export interface ErrorStateProps {
  /** Cause; picks icon, status colour and default retry guidance. */
  kind: "offline" | "timeout" | "auth-expired" | "not-found" | "server" | "validation";
  /** What happened, in plain words: "TIDAL is slow right now". */
  title: string;
  /** What it affects and what to do next. */
  text: ReactNode;
  /** Whether retrying will help, said in words ("Retrying won't help until you reconnect"). */
  retryHint?: string;
  /** False when retrying cannot help (shows – instead of ↻). */
  retryHelps?: boolean;
  /** Called by the Retry button; omit when retry cannot help. */
  onRetry?: () => void;
  /** Cause-specific action instead of or beside Retry ("Reconnect TIDAL", "Go to saved sets"). */
  action?: ReactNode;
  /** Server reference ID, shown copyable for 5xx errors. */
  referenceId?: string;
  /** Fields to fix for validation errors; each links to its field. */
  fields?: { id: string; label: string; message: string }[];
  /** Last successful data, shown under the error with its time. */
  lastGood?: { at: Date | string; content: ReactNode };
  /** Borderless variant that fills a panel instead of sitting as a card. */
  panel?: boolean;
}

export interface BannerProps {
  /** info / warn / bad / ok. */
  status: "info" | "warn" | "bad" | "ok";
  /** Bold lead sentence: "Sets are shaped on energy alone." */
  title: string;
  /** Supporting sentence with numbers: "Only 611 of 1,284 tracks have a key and BPM so far." */
  text?: ReactNode;
  /** One or two actions (secondary buttons or a module button). */
  actions?: ReactNode;
  /** Dismiss handler; not allowed for status "bad". Dismissal is remembered per person. */
  onDismiss?: () => void;
  /** Full-bleed under the page header (no side borders or radius). */
  page?: boolean;
}

export interface InlineMessageProps {
  /** Status glyph and colour: ● ok, ◐ fair, ▲ warn, ✕ bad, i info. */
  status: FeedbackStatus;
  /** Message text; bold the key part with <strong>. */
  children: ReactNode;
  /** Optional link that jumps to the thing ("Show them"). No dismiss. */
  action?: ReactNode;
  /** Tinted box for card sections; plain under fields and in rows. */
  boxed?: boolean;
  /** id so a field can point aria-describedby at the message. */
  id?: string;
}

export interface ToastOptions {
  /** Past-tense confirmation: "Set saved", "Tracklist copied: 18 tracks". */
  message: ReactNode;
  /** One optional action, usually Undo; must also be available elsewhere (e.g. Ctrl/Cmd+Z, history). */
  action?: { label: string; onAction: () => void };
  /** Visible time in ms: default 4000, 8000 with an action. Pauses on hover and focus. */
  durationMs?: number;
}

export interface ToastProps {
  /** Queue manager: shows one toast at a time, keeps at most 3 waiting (oldest dropped). */
  queueLimit?: 3;
  /** Placement: bottom centre, bottom right from the desktop breakpoint. */
  placement?: "auto";
  /** Push a toast; never for errors that need action (use Banner, ErrorState or InlineMessage). */
  toast?: (options: ToastOptions) => void;
}

export interface DialogProps {
  /** Open state; uses the native <dialog> showModal() for the focus trap and Esc. */
  open: boolean;
  /** Called on Esc, the close button and Cancel. */
  onClose: () => void;
  /** Regular lead of the thin–bold title: "Edit cues". */
  lead?: string;
  /** Bold title: "Bicep – Glue". */
  title: string;
  /** One-line context under the title: "Slot 7 of 18 in “Peak time Friday”". */
  subtitle?: string;
  /** S 400, M 600, L 800. M and L become full-screen sheets below 480px. */
  size?: "s" | "m" | "l";
  /** Body content (scrolls). */
  children: ReactNode;
  /** Footer actions, right-aligned: Cancel then the primary. */
  footer: ReactNode;
  /** Optional quiet action at the left of the footer ("Reset cues"). */
  footerStart?: ReactNode;
  /** Element to focus on open; default the first field, else the primary-adjacent Cancel. */
  initialFocusRef?: { current: HTMLElement | null };
}

export interface ConfirmDialogProps {
  /** Open state (alertdialog, modal). */
  open: boolean;
  /** Question naming the object: "Delete “Peak time Friday”?" */
  title: string;
  /** Consequence and who it affects; say what is kept. */
  text: ReactNode;
  /** Extra facts as a short list ("The 18 tracks stay in the library."). */
  facts?: string[];
  /** Danger button label, verb + object: "Delete set". */
  confirmLabel: string;
  /** Called by the danger button. */
  onConfirm: () => void;
  /** Called by Cancel and Esc. Cancel has initial focus. */
  onCancel: () => void;
  /** High-stakes: the exact text the person must type (usually the set name) before the danger button enables. */
  requireTyping?: string;
}

export interface ArmedButtonProps {
  /** Resting label: "Clear draft". */
  label: string;
  /** Armed question shown for the window: "Clear the current draft?" */
  armedLabel: string;
  /** Window in ms (default 3000); a second press inside it acts. */
  windowMs?: number;
  /** The low-stakes action. */
  onConfirm: () => void;
}

export interface SideSheetProps {
  /** Open state. */
  open: boolean;
  /** Close handler (close button, Esc; also scrim tap on phones). */
  onClose: () => void;
  /** Title; may use the thin–bold lead ("Track:", "Bicep – Glue"). */
  title: ReactNode;
  /** Scrollable body. */
  children: ReactNode;
  /** Sticky footer actions. */
  footer?: ReactNode;
  /** Desktop behaviour: push the content aside (default) or overlay it. Phones always get a modal bottom sheet. */
  mode?: "push" | "overlay";
  /** Width on tablet and desktop in px (default 380). */
  width?: number;
}

export interface MediaItem {
  /** Kind of media. */
  kind: "artwork" | "photo" | "waveform";
  /** Image URL or a render function for the waveform. */
  src: string | (() => ReactNode);
  /** Caption title: "Bicep – Glue (cover art)". */
  title: string;
  /** Source line: "Beatport · 1,400 × 1,400". */
  source: string;
  /** Alt text; always shown in the caption and used as the accessible name. */
  alt: string;
}

export interface MediaViewerProps {
  /** Items to page through. */
  items: MediaItem[];
  /** Index shown first. */
  index: number;
  /** Open state (full-screen, modal). */
  open: boolean;
  /** Close handler (close button, Esc); focus returns to the thumbnail that opened it. */
  onClose: () => void;
  /** Called when prev/next or the arrow keys change the item. */
  onIndexChange?: (index: number) => void;
  /** Maximum zoom (default 4 = 400%). */
  maxZoom?: number;
}

export interface TooltipProps {
  /** Short supplementary text: a name, a key name ("A minor"), an absolute time. Never essential or interactive. */
  content: ReactNode;
  /** Optional keyboard shortcut shown as a key cap. */
  shortcut?: string;
  /** The trigger; must be focusable. */
  children: ReactNode;
  /** Hover delay in ms (default 500); hiding is immediate. */
  delayMs?: number;
  /** How the trigger uses it: "describe" sets aria-describedby; "label" for icon buttons whose aria-label already matches. */
  relation?: "describe" | "label";
  /** Preferred side; flips when there is no room. */
  side?: "top" | "bottom";
}

export interface PopoverProps {
  /** Trigger button (gets aria-expanded, aria-controls, aria-haspopup="dialog"). */
  trigger: ReactNode;
  /** Title at the top; focus moves here on open. */
  title: ReactNode;
  /** Interactive content: lists, checkboxes, small actions. */
  children: ReactNode;
  /** Footer actions or a link. */
  footer?: ReactNode;
  /** Controlled open state. */
  open?: boolean;
  /** Open change (click trigger, Esc, outside click, focus leaving). */
  onOpenChange?: (open: boolean) => void;
  /** Align to the trigger's start or end edge. */
  align?: "start" | "end";
  /** Open below (default) or above. */
  side?: "bottom" | "top";
}
/* SongNodes design system — Pages A (documentation types: route-level page props and the data each page loads). */

export type ModuleKey = "graph" | "library" | "sets" | "paths" | "harmony" | "sources" | "pipeline" | "services";
export type StatusKey = "ok" | "fair" | "warn" | "bad" | "info" | "running" | "idle";
export type CompatLevel = "perfect" | "compatible" | "possible" | "clash" | "unknown";
/** ISO 8601 timestamp with offset, e.g. "2026-10-24T06:00:00+11:00". */
export type IsoStamp = string;

/** Load state every page region reports; drives LoadingState, ErrorState, EmptyState and ConnectionStatus. */
export interface RegionState {
  /** "loading" = first load (skeletons), "refreshing" = keep old data with the loading bar. */
  phase: "loading" | "ready" | "refreshing" | "empty" | "error" | "offline";
  /** What failed and what to do next, shown in ErrorState. */
  error?: { title: string; text: string; retryHelps: boolean; referenceId?: string };
  /** When the shown data was produced (FreshnessStamp). */
  dataFrom?: IsoStamp;
}

/** One track as pages display it (rows, slots, recommendations). */
export interface TrackSummary {
  /** SongNodes ID, e.g. "trk_8f2a". */
  id: string;
  /** Artist credit as shown, e.g. "Bicep". */
  artist: string;
  /** Title, e.g. "Glue". */
  title: string;
  /** Mix name, e.g. "Original mix". */
  mix?: string;
  /** Length in seconds. */
  durationSec?: number;
  /** Energy 1–10, null when not set (shown as an en dash). */
  energy: number | null;
  /** Camelot key, e.g. "8A"; null when unknown. */
  key: string | null;
  /** Tempo in BPM. */
  bpm: number | null;
  /** House, Techno or UK garage. */
  pillar?: "House" | "Techno" | "UK garage";
  /** Library rotation. */
  rotation?: "High" | "Standard" | "Vault";
  /** Sources it was heard on, newest first ("triple j Mix Up", "1001tracklists"). */
  heardOn?: string[];
  /** Date last heard, "2026-10-23". */
  lastHeard?: string;
  /** External links by service name ("TIDAL", "Beatport"). */
  links?: Record<string, string>;
  /** Flagged "Needs an energy check". */
  needsEnergyCheck?: boolean;
}

/** Props shared by every page inside the shell. */
export interface ShellPageProps {
  /** Lead of the thin–bold title, normally the module label. */
  titleLead: string;
  /** Bold half of the title, also shown in AppHeader. */
  title: string;
  /** Module that owns the page (colour, drawer row, PageHeader band). Omit for Home. */
  module?: ModuleKey;
  /** Drawer counts and attention badges: { pipeline: [2, "scrapers paused", "warn"] }. */
  drawerCounts?: Partial<Record<ModuleKey, [number, string, StatusKey?]>>;
}

export interface HomePageProps extends ShellPageProps {
  /** One launcher card per module, drawer order. */
  modules: { key: ModuleKey; title: string; summary: string; figures: [string, string][]; attention?: { status: StatusKey; label: string } }[];
  /** "Since your last visit" tiles; only changes, newest first, at most 4. */
  changes: { figure: string; label: string; detail?: string; module: ModuleKey; href: string; linkText: string; status?: StatusKey }[];
  /** Time of the previous visit (per device). */
  lastVisit?: IsoStamp;
  /** Last 5 sets and last 5 tracks opened on this device. */
  recent: { sets: { id: string; name: string; minutes: number; tracks: number; openedAt: IsoStamp }[]; tracks: TrackSummary[] };
  /** Health rows: problems are expanded ServiceStatus rows, healthy ones collapse to a pill line. */
  health: { name: string; status: StatusKey; label: string; detail?: string }[];
  /** When the library data was built. */
  dataFrom: IsoStamp;
}

export interface LibraryFilters {
  /** Free text over artist and title (debounced into ?q=). */
  q?: string;
  pillar?: ("House" | "Techno" | "UK garage")[];
  tier?: ("low" | "building" | "high")[];
  rotation?: ("High" | "Standard" | "Vault")[];
  /** Show name, e.g. "PBS Soul Time". */
  heardOn?: string;
  tags?: string[];
  hasKeyAndBpm?: boolean;
  needsEnergyCheck?: boolean;
  playedOnTwoPlusShows?: boolean;
}

export interface LibraryPageProps extends ShellPageProps {
  /** Filters, mirrored in the URL (?pillar=house&tier=building). */
  filters: LibraryFilters;
  /** Sort column id; leading minus = descending ("-energy"). */
  sort: string;
  /** Rows loaded so far (ShowMore adds 150 at a time). */
  rows: TrackSummary[];
  /** Matches for the current filters, and the library size. */
  totals: { matching: number; library: number; heardThisWeek: number; needEnergyCheck: number; keyedShare: number };
  /** Coverage note shown as a Banner while tracks lack key or BPM; dismissible per device. */
  coverageNote?: { missing: number };
  state: RegionState;
  onBuildSetFromFilters(filters: LibraryFilters): void;
  onAddToSet(trackId: string): void;
}

export interface SetSlotData {
  track: TrackSummary | null;
  /** Target energy from the chosen shape. */
  target: number;
  locked?: boolean;
  /** Up to 3 spare suggestions. */
  spares?: TrackSummary[];
}

export interface SetBuilderPageProps extends ShellPageProps {
  set: {
    id: string; name: string;
    shape: "journey-two-peaks" | "peak-time-three-waves" | "warm-up-opener" | "closing" | "steady-groove";
    lengthMin: number;
    /** Genre weights in percent; must add up to 100. */
    mix: { house: number; techno: number; ukGarage: number };
    pool: "library" | "high-rotation" | "heard-this-month" | "filtered";
    sendToTidal: boolean;
    slots: SetSlotData[];
    savedAt?: IsoStamp;
    tidal?: { status: StatusKey; label: string };
  };
  savedSets: { id: string; name: string; shape: string; minutes: number; tracks: number; peaks: number; wave: number[]; tidal: { status: StatusKey; label: string }; updatedAt: IsoStamp }[];
  /** Slots shown before ShowMore. */
  visibleSlots?: number;
  onBuild(): void;
  onSave(): void;
  /** Opens ConfirmDialog first; only clears the on-screen running order. */
  onNewEmptySet(): void;
}

export interface GraphNode { id: string; track: TrackSummary; degree: number; x?: number; y?: number; state?: "now" | "selected" | "path" | "faded" }
export interface GraphEdge { from: string; to: string; type: "adjacency" | "similarity" | "collaboration" | "genre" | "key_compatibility"; weight: number; sets?: number }

export interface GraphExplorerPageProps extends ShellPageProps {
  /** ?mode=play|plan; Play is the booth view (recommendations first). */
  mode: "play" | "plan";
  nowPlaying: TrackSummary | null;
  /** Up next, ranked; each carries the transition from now playing. */
  recommendations: { track: TrackSummary; reason: string; score: number }[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** ?track= — opens the SideSheet. */
  selectedTrackId?: string;
  /** Live updates socket state for ConnectionStatus. */
  connection: "live" | "reconnecting" | "offline" | "partial";
  activeFilterCount: number;
  onSetNowPlaying(trackId: string): void;
}

export interface TrackDetailPageProps extends ShellPageProps {
  track: TrackSummary & {
    label?: string; year?: number;
    ids: { isrc?: string; spotify?: string; tidal?: string; beatport?: string; discogs?: string };
    /** Which source supplied energy, BPM and key. */
    valuesFrom: "ledger" | "audio-analysis" | "mixed-in-key";
  };
  analysis?: { sections: { from: number; to: number; kind: "intro" | "breakdown" | "outro" }[]; vocals: [number, number][]; cues: { at: number; label: string }[]; energy: [number, number][] };
  /** Plays per week, 12 weeks, per source. */
  heardOn: { source: string; kind: "radio" | "tracklists" | "chart" | "store"; weekly: number[]; lastHeard: string }[];
  connected: { track: TrackSummary; edge: GraphEdge }[];
  sets: { id: string; name: string; slot: number; of: number }[];
  /** Values that differ between sources, for the "Raw data" disclosure. */
  raw?: Record<string, string>;
}

export interface SettingsPageProps extends ShellPageProps {
  connections: { service: "Spotify" | "TIDAL" | "Beatport"; status: StatusKey; label: string; account?: string; detail: string }[];
  apiKeys: { id: string; label: string; maskedTail?: string; docsUrl: string; lastTest?: { ok: boolean; at: IsoStamp; message?: string } }[];
  version: string;
  onConnect(service: string): void;
  onTestKey(id: string, value?: string): Promise<{ ok: boolean; message?: string }>;
  onExport(kind: "library-csv" | "sets-json" | "targets-json"): void;
  onImport(file: File): Promise<{ ok: boolean; summary: string }>;
  /** Danger-zone actions; each opens ConfirmDialog (typed confirmation for deleting all sets). */
  onDangerAction(kind: "disconnect-all" | "delete-all-sets"): void;
}

export interface AuthCallbackPageProps {
  /** From the route: /callback/spotify or /oauth/callback (TIDAL). */
  provider: "spotify" | "tidal";
  phase: "checking" | "saving" | "connected" | "error";
  /** Account name returned by the service, shown on success. */
  account?: string;
  /** Plain-language reason; never raw codes or tokens. */
  error?: { title: string; text: string };
  /** Seconds before returning to Settings after success (default 2). */
  autoReturnSec?: number;
  onRetry(): void;
}
/* SongNodes design system: pages B (documentation types for the React page components and the data they need). */
import type { ReactNode } from "react";

/** ISO 8601 with Melbourne offset, e.g. "2026-10-24T21:30:00+11:00". */
export type IsoTime = string;
/** Calendar date without time, e.g. "2026-10-24". */
export type IsoDate = string;
/** Raw backend enum passed through SongNodes.status(raw, domain); never printed directly. */
export type RawStatus = string;

/* ---------- LogPage ---------- */
export interface TargetTrack {
  /** Stable ID; newest has the highest. */ id: number;
  /** Artist as the label writes it. */ artist: string;
  /** Title without the mix. */ title: string;
  /** Genres from ChipInput. */ genres: string[];
  /** Extra spellings matched in tracklists. */ searchTerms: string[];
  /** TaskPriority from the scraper orchestrator; shown via SongNodes.status(p, "priority"). */ priority: "critical" | "high" | "medium" | "low";
  /** Search state; archived rows are hidden unless "Show archived" is on. */ state: "active" | "paused" | "archived";
  /** How many of the 4 checks are done (found in tracklists, key, BPM, TIDAL link). */ checksDone: 0 | 1 | 2 | 3 | 4;
  /** What is still missing, in words ("key, TIDAL link"). */ missing?: string;
  /** Appearances in scraped tracklists. */ tracklistCount: number;
  /** Last search of this track; stale (▲) after 8 days. */ lastSearchedAt: IsoTime;
}
export interface RunLogEntry {
  /** Run start. */ startedAt: IsoTime;
  /** Records added. */ added: number;
  /** Records updated. */ updated: number;
  /** Errors in the run. */ errors: number;
  /** Duration in seconds. */ durationSec: number;
  /** TaskStatus of the run (completed, partial, failed). */ status: RawStatus;
  /** One sentence when not completed. */ note?: string;
  /** Link to the job log in Pipeline. */ href: string;
}
export interface LogPageProps {
  /** Records, newest first. */ records: TargetTrack[];
  /** Append-only run history, newest first. */ runs?: RunLogEntry[];
  /** Next scheduled run. */ nextRunAt?: IsoTime;
  /** Data state of the records region. */ state: "loading" | "ready" | "refreshing" | "error" | "offline";
  /** Adds a record from the entry dialog. */ onAdd(record: Omit<TargetTrack, "id" | "state" | "checksDone" | "tracklistCount" | "lastSearchedAt">): Promise<void>;
  /** Bulk or row action; delete is confirmed in a ConfirmDialog first, archive offers Undo. */ onAction(action: "active" | "paused" | "archived" | "delete" | "search", ids: number[]): Promise<void>;
}

/* ---------- DailyViewPage ---------- */
export interface RadioPlay {
  /** Air time. */ at: IsoTime;
  /** Track identity for TrackCell. */ artist: string; title: string; mix?: string; label?: string; durationSec?: number;
  /** Library track ID when already in the crate; absent = new to library. */ trackId?: string;
  /** Other shows or sites that played it. */ alsoHeardOn: string[];
}
export interface ShowDay {
  /** Show name as the station writes it ("PBS Soul Time"). */ show: string;
  /** Slot, 24-hour ("13:00–15:00"). */ slot: string;
  /** True while the show is on air; draws the now line after the last play. */ onAir?: boolean;
  /** Plays in air order. */ plays: RadioPlay[];
}
export interface DailyViewPageProps {
  /** The day shown (Melbourne). */ date: IsoDate;
  /** Groups in start-time order. */ shows: ShowDay[];
  /** When the plays were last fetched. */ dataFrom: IsoTime;
  /** Current time; the now line shows only when date is today. */ now: IsoTime;
  /** Data state. */ state: "loading" | "ready" | "refreshing" | "empty" | "error" | "offline";
  /** Day navigation ([ and ]); next is disabled on today. */ onDayChange(date: IsoDate): void;
}

/* ---------- WeeklyGridPage ---------- */
export interface WeekCell {
  /** Plays that day, or null when the show had no episode. */ plays: number | null;
  /** Of those, tracks new to the crate. */ newTracks: number;
}
export interface WeeklyGridPageProps {
  /** Monday of the week (weeks start Monday). */ weekOf: IsoDate;
  /** Rows: shows with Mon–Sun cells (index 0 = Monday). Future days render "Not yet". */ rows: { show: string; slot: string; days: WeekCell[] }[];
  /** Today, for the --now column. */ today: IsoDate;
  /** Week navigation. */ onWeekChange(weekOf: IsoDate): void;
  /** Data state. */ state: "loading" | "ready" | "refreshing" | "empty" | "error" | "offline";
}

/* ---------- MatrixPage ---------- */
export interface MatrixSource { id: string; name: string; group: "radio" | "chart" | "lists"; /** Unit of the count ("plays" or "weeks on chart"). */ unit: string; }
export interface MatrixPageProps {
  /** Columns. */ sources: MatrixSource[];
  /** Rows: a track and its count per source ID (absent = not played). */ rows: { trackId: string; artist: string; title: string; mix?: string; counts: Record<string, number> }[];
  /** Key × energy coverage: 24 keys (1A…12B) × 10 energies. */ coverage: number[][];
  /** Period covered, for the description. */ from: IsoDate; to: IsoDate;
  /** Opens the library filtered to one heatmap cell. */ onCellSelect(key: string, energy: number): void;
  /** Initial tab (?tab=). */ tab?: "sources" | "keys";
}

/* ---------- MonitoringPage ---------- */
export interface ScraperHealth {
  /** Scraper name as the source writes it. */ name: string;
  /** Source kind shown under the name. */ kind: string;
  /** ScraperStatus: idle | running | error | disabled | circuit_open. */ status: RawStatus;
  /** Last successful job; ▲ after 1 h, ✕ after 6 h. */ lastSuccessAt: IsoTime | null;
  /** Hourly success rate 0–100 for the last 24 h, oldest first; null when off. */ successRate: number[] | null;
  /** Jobs run today. */ jobsToday: number;
  /** Next scheduled run, null when off. */ nextRunAt: IsoTime | null;
}
export interface ProxyHealth { name: string; region: string; /** ProxyStatus: healthy | degraded | failed | untested. */ status: RawStatus; /** Last measured latency in ms. */ latencyMs: number | null; }
export interface PipelineIncident { /** Bold first sentence. */ title: string; /** Number or consequence. */ text: string; /** Severity; only the worst one renders as the page Banner. */ status: "bad" | "warn" | "info"; }
export interface MonitoringPageProps {
  /** Live-update connection for ConnectionStatus. */ connection: "live" | "reconnecting" | "offline" | "partial";
  /** Active incidents; the most severe becomes the one Banner, the rest collapse into it. */ incidents: PipelineIncident[];
  /** Figure tiles. */ totals: { jobsToday: number; failedToday: number; queueLength: number; oldestWaitingSec: number; proxiesHealthy: number; proxiesTotal: number };
  /** Scraper table rows. */ scrapers: ScraperHealth[];
  /** Current enrichment run steps for StagedProgress (EnrichmentStatus per step). */ enrichment?: { startedAt: IsoTime; steps: { name: string; status: RawStatus; done?: number; total?: number; detail?: string }[] };
  /** Proxy pool. */ proxies: ProxyHealth[];
  /** Review-queue counts for the Checklist. */ reviewQueue: { autoApproved: number; lowConfidence: number; conflicts: number; unchecked: number };
  /** Recent errors, newest first; the first one that needs the person gets ErrorState guidance. */ errors: { at: IsoTime; source: string; message: string; action?: ReactNode }[];
  /** Primary action. */ onRunScrapers(): Promise<void>;
}

/* ---------- RetiredPageNotice ---------- */
export interface RetiredPageNoticeProps {
  /** moved = has a new place; retired = no replacement (410 after the grace period). */ kind: "moved" | "retired";
  /** Old route or file, shown in mono. */ oldPath: string;
  /** One sentence: what changed and why. */ reason: string;
  /** New place (moved only); the link takes this module's colour. */ destination?: { module: string; label: string; href: string };
  /** Date it moved or was retired. */ changedOn: IsoDate;
  /** End of the 90-day notice period; then 301 (moved) or 410 (retired). */ noticeUntil: IsoDate;
  /** Per-device opt-in to skip the notice; off by default, no countdown. */ allowSkip?: boolean;
}

/* ---------- ErrorPage ---------- */
export interface ErrorPageProps {
  /** HTTP status; 404 uses 404.html, 500/502/503/504 use 50x.html. */ code: 404 | 410 | 500 | 502 | 503 | 504;
  /** nginx $request_id (X-Request-ID) for 50x, shown in mono. */ requestId?: string;
  /** In-app route version renders inside the shell; the nginx files are static HTML. */ inShell?: boolean;
}

/* ---------- PrintSheet ---------- */
export interface PrintSlot {
  /** Slot number from 1. */ slot: number; artist: string; title: string;
  /** BPM, one decimal at most. */ bpm: number | null;
  /** Camelot code; printed with its name ("8A A minor"). */ key: string | null;
  /** Energy 1–10. */ energy: number | null;
  /** Seconds this slot plays before the next comes in; drives "Time in". */ playSec: number;
  /** Locked slots print a lock icon. */ locked?: boolean;
}
export interface PrintSheetProps {
  /** Set name for the title and footer. */ name: string;
  /** Shape name ("Peak time (three waves)"). */ shape: string;
  /** Running order, up to 24 slots per A4 page. */ slots: PrintSlot[];
  /** Genre mix line ("House 50 · Techno 30 · UK garage 20"). */ genreMix?: string;
  /** Full URL of the view for the footer. */ url: string;
  /** Library freshness for the footer. */ dataFrom: IsoTime;
  /** Adds the blank 30 mm notes column. */ notesColumn?: boolean;
}

/* ---- window.SongNodes helpers (components/bundle.js) ---- */
export type ModuleKey = "graph" | "library" | "sets" | "paths" | "harmony" | "sources" | "pipeline" | "services";
export type DesignStatus = "ok" | "fair" | "warn" | "bad" | "info" | "running" | "idle";
export type CompatLevel = "perfect" | "compatible" | "possible" | "clash" | "unknown";
export interface SongNodesHelpers {
  version: string; locale: "en-AU"; timeZone: "Australia/Melbourne";
  modules: { key: ModuleKey; label: string; icon: string; summary: string }[];
  icon(name: string, opts?: { size?: number; label?: string; cls?: string }): string;
  camelot(input: string | null | undefined): string | null;
  keyName(code: string): string | null;
  compat(a: string, b: string): { level: CompatLevel; label: string };
  tier(energy: number): "low" | "building" | "high" | null;
  energyStep(prev: number, next: number, before?: number): { level: CompatLevel; label: string };
  bpmStep(a: number, b: number): { level: CompatLevel; label: string };
  format: { date(d: Date | string): string; day(d: Date | string): string; month(d: Date | string): string; time(d: Date | string): string; dateTime(d: Date | string): string; zone(d: Date | string): string; stamp(d: Date | string): string; relative(d: Date | string, now?: Date): string; duration(seconds: number): string; span(seconds: number): string; count(n: number): string; bpm(b: number): string; percent(x: number, digits?: number): string; dateOnly(isoDate: string): string };
  status(raw: string, domain?: "confidence" | "priority"): { status: DesignStatus; label: string; glyph: string };
  html: { energy(e: number): string; key(k: string, withName?: boolean): string; pill(raw: string, label?: string): string; compat(level: CompatLevel, label?: string): string; link(mod: ModuleKey, href: string, text: string): string; title(lead: string, title: string, size?: "title-l" | "title-m" | "title-s"): string };
  prefs: { init(): void; setTheme(t: "dark" | "light" | "booth" | "system"): void; setTextSize(s: "s" | "m" | "l" | "xl"): void; setDensity(d: "comfortable" | "compact"): void; setMotion(m: "system" | "reduce" | "full"): void; get(): { theme: string; textSize: string; density: string; motion: string } };
}
declare global { interface Window { SongNodes: SongNodesHelpers } }
