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
