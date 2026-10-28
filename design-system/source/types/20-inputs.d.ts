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
  /** Recent-search store key ("library-crate", "pathfinder-waypoints"): the field reads, saves and clears recent searches itself (utils/recentSearches) when `recent` is not given. */
  namespace?: string;
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
  /** Show the icon-only calendar button ("Pick the dates on the calendar") that opens DateRange with focus on the grid. Default true. */
  calendar?: boolean;
  /** DateRange options for the calendar (title, outcome, marks, extra presets). */
  calendarProps?: Partial<Pick<DateRangeProps, "title" | "outcome" | "marks" | "presets">>;
  /** Called when the calendar opens (for analytics or lazy-loading marks). */
  onPickOnCalendar?: () => void;
}

/** A day mark the page passes to DateRange (not a built-in calendar). */
export interface DateRangeMark {
  /** ISO date "2026-11-03". Date-only: no time zone. */
  date: string;
  /** Short code shown under the number ("PH", "RUN"); omit for a plain data dot ("this day has records"). */
  code?: string;
  /** The day's own name, in `title` and the announced name ("Melbourne Cup"). */
  name: string;
  /** What kind of mark, for the key and the announced name ("Public holiday", "Weekly library run", "Plays heard"). */
  kind: string;
}
/** Built-in DateRange presets (Monday–Sunday weeks, Melbourne dates). */
export type DateRangePresetId = "last-7-days" | "last-30-days" | "this-year" | "last-week" | "this-week" | "next-week";
/** A page's own named span ("Summer 2026–27"). */
export interface DateRangePreset {
  id: string;
  label: string;
  /** [from, to] ISO dates, or a function giving them (evaluated when pressed). */
  range: [string, string] | (() => [string, string]);
}
export interface DateRangeProps {
  /** [from, to] ISO dates; to is null while only From is picked. */
  value: [string | null, string | null];
  /** Called after each pick, preset or Clear; presetId is the pressed preset, or null. */
  onChange: (value: [string | null, string | null], presetId: string | null) => void;
  /** The outcome button: called with the range when pressed (To defaults to From). */
  onApply: (value: [string, string]) => void;
  /** Escape or the close button; return focus to the control that opened it. */
  onClose: () => void;
  /** Popover title naming what the span is for ("Plays to export"). Default "Pick the dates". */
  title?: string;
  /** Outcome button label, named for what it does: "Use these dates" (default), "Download CSV", "Print". */
  outcome?: string;
  /** Presets in this order; default ["last-7-days", "last-30-days", "this-year"]; week presets are optional. Then the page's own spans. */
  presets?: (DateRangePresetId | DateRangePreset)[];
  /** Day marks; the key lists only the kinds used here. */
  marks?: DateRangeMark[];
  /** "Today" as a Melbourne ISO date; defaults to SongNodes.calendar.today(). */
  today?: string;
  /** Show the pressed preset (for a value that came from one). */
  presetId?: string | null;
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
