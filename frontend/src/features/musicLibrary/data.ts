/**
 * Music library data contract (Naarm Set Builder, ported from E:\musicLibrary\artifact).
 *
 * public/data/music-library.json is a copy of musicLibrary/outputs/artifact/library.json,
 * written by the weekly run (`python3 pipeline/run_weekly.py db`) and copied in with
 * scripts/sync-music-library.sh. Field names are the pipeline's compact keys; do not
 * rename them here, map them at the edge.
 */

export interface LibraryTrack {
  id: string;
  /** Artist */
  a: string;
  /** Title */
  t: string;
  /** Mix name, e.g. "Original Mix" */
  m: string | null;
  /** Duration in seconds */
  d: number | null;
  bpm: number | null;
  /** Key as given by the source (Camelot or musical); normalise with SN.camelot */
  k: string | null;
  /** Energy 1–10 (Mixed In Key scale) */
  e: number | null;
  /** Pillar: House, Techno, UK garage, … */
  p: string | null;
  /** Rotation: 1 High, 2 Standard, 3 Vault/Archive (pipeline lifecycle) */
  rot: number | null;
  tags: string[];
  /** Source ids where the track was heard (see LibraryFile.sources) */
  src: string[];
  /** First and last heard, ISO dates */
  first: string | null;
  last: string | null;
  /** Genre */
  g: string | null;
  /** Label */
  lbl: string | null;
  sync: string | null;
  tidal: string | null;
  dz: string | null;
  bp: string | null;
  /** ARIA Club Chart position from the latest run: rank, weeks in, peak. */
  chart: { rank: number; weeks: number; peak?: number } | null;
  /** Needs review (energy check) */
  rev: boolean;
  /** Hand override applied */
  ovr: boolean;
  /** Has a local file */
  local: boolean;
}

export interface LibrarySource { id: string; prior: number; club: boolean; on: boolean }
export interface LibraryRun { date: string; added: number; rejected: number; promoted: number; demoted: number; archived: number; review_queue: number }

export interface LibraryFile {
  generated: string;
  ledger_updated: string;
  counts: { tracks: number; pending: number; rejected: number; beatport_check: number };
  sources: LibrarySource[];
  runs: LibraryRun[];
  tracks: LibraryTrack[];
}

let cache: Promise<LibraryFile> | null = null;

/** Loads the library once per session. */
export function loadLibrary(): Promise<LibraryFile> {
  if (!cache) {
    cache = fetch('/data/music-library.json', { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(`Library file returned ${r.status}`);
      return r.json() as Promise<LibraryFile>;
    });
    cache.catch(() => { cache = null; });
  }
  return cache;
}

/** Saved sets live on this device (localStorage), keyed here so Home and Set builder agree. */
export const SAVED_SETS_KEY = 'sn-music-library-sets';

/** One track in a saved set, as the artifact stored it (pipeline `sync-sets` reads these). */
export interface SavedSetTrack {
  id: string;
  /** Target energy for the slot */
  tgt: number;
  a?: string; t?: string; m?: string | null; e?: number | null; k?: string | null; bpm?: number | null;
  tidal?: string | null;
  /** Key move label from the previous slot */
  move?: string | null;
}

/**
 * Same shape as the Naarm Set Builder's `sets` documents, so a set saved here can be
 * exported to musicLibrary/inbox/artifact_sets.json and picked up by the weekly run.
 */
export interface SavedSet {
  id: string;
  name: string;
  shape: string;
  minutes: number;
  mix: Record<string, number>;
  pool: string;
  /** Send to TIDAL on the weekly run */
  tidal: boolean;
  seed: number;
  tracks: SavedSetTrack[];
  updated: string;
  created: string;
}

export function readSavedSets(): SavedSet[] {
  try {
    const raw = localStorage.getItem(SAVED_SETS_KEY);
    return raw ? (JSON.parse(raw) as SavedSet[]) : [];
  } catch {
    return [];
  }
}

export function writeSavedSets(sets: SavedSet[]): void {
  try { localStorage.setItem(SAVED_SETS_KEY, JSON.stringify(sets)); } catch { /* storage blocked: sets stay in memory */ }
}
