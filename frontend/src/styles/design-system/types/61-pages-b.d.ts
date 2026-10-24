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
