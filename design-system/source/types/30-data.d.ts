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
