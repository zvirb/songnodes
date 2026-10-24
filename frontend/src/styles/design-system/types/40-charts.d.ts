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
