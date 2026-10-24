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
