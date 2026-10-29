/**
 * Music library data contract (Naarm Set Builder, ported from E:\musicLibrary\artifact).
 *
 * Tracks are loaded from the REST API (/api/v1/library/search).
 * Field names are the pipeline's compact keys; do not rename them here, map them at the edge.
 */
import { DRAFT_KEY, lsGet, lsSet } from './storage';

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

  /** MusicBrainz provenance */
  mbid?: string;
  mbconf?: string;
  mbdump?: string;
  source_url?: string;
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
  _source?: 'backend' | 'library-fixture';
}

let cache: Promise<LibraryFile> | null = null;

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function mapApiToLibraryTrack(row: any): LibraryTrack {
  return {
    id: row.id,
    a: row.a,
    t: row.t,
    m: row.m ?? null,
    d: row.d ?? null,
    bpm: row.bpm ?? null,
    k: row.k ?? null,
    e: row.e ?? null,
    p: row.p ?? null,
    rot: row.rot ?? null,
    tags: row.tags ?? [],
    src: row.src ?? [],
    first: row.first ?? null,
    last: row.last ?? null,
    g: row.g ?? null,
    lbl: row.lbl ?? null,
    sync: row.sync ?? null,
    tidal: row.tidal ?? null,
    dz: row.dz ?? null,
    bp: row.bp ?? null,
    chart: row.chart ?? null,
    rev: row.rev ?? false,
    ovr: row.ovr ?? false,
    local: row.local ?? false,
    mbid: row.mbid ?? undefined,
    mbconf: row.mbconf ?? undefined,
    mbdump: row.mbdump ?? undefined,
    source_url: row.source_url ?? undefined,
  };
}

export function loadLibrary(forceRefresh = false): Promise<LibraryFile> {
  if (forceRefresh) {
    cache = null;
  }
  if (!cache) {
    cache = (async () => {
      const res = await fetch('/api/v1/library/search?limit=5000');
      if (!res.ok) {
        throw new Error(`Library search failed with status ${res.status}`);
      }
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const json = await res.json() as any[];
      const tracks = Array.isArray(json) ? json.map(mapApiToLibraryTrack) : [];
      return {
        generated: new Date().toISOString(),
        ledger_updated: new Date().toISOString(),
        counts: { tracks: tracks.length, pending: 0, rejected: 0, beatport_check: 0 },
        sources: [],
        runs: [],
        tracks,
        _source: 'backend' as const,
      };
    })().catch((err) => {
      cache = null;
      throw err;
    });
  }
  return cache;
}

export const SAVED_SETS_KEY = 'sn-music-library-sets';

export interface SavedSetTrack {
  id: string;
  tgt: number;
  a?: string; t?: string; m?: string | null; e?: number | null; k?: string | null; bpm?: number | null;
  tidal?: string | null;
  move?: string | null;
  track_id?: string;
}

export interface SavedSet {
  id: string;
  name: string;
  shape: string;
  minutes: number;
  mix: Record<string, number>;
  pool: string;
  tidal: boolean;
  seed: number;
  tracks: SavedSetTrack[];
  updated: string;
  created: string;
  description?: string;
}

let serverSetsCache: SavedSet[] = [];

/** A set the server has not given an id yet carries a local id such as `set-mh2x9k`. */
const isServerId = (id: string) => /^\d+$/.test(id);

/** Same set by content: the name and the running order (track ids in order). */
const sameContent = (a: SavedSet, b: SavedSet) =>
  a.name === b.name &&
  a.tracks.length === b.tracks.length &&
  a.tracks.every((t, i) => t.id === b.tracks[i].id);

/**
 * The stored draft still points at a set's local id after the server gave it a real one:
 * point it at the server id so the open set, Save and Delete all find the same document.
 */
function remapStoredDraftId(idMap: Map<string, string>): void {
  if (!idMap.size) return;
  const draft = lsGet<{ id?: unknown } | null>(DRAFT_KEY, null);
  if (draft && typeof draft.id === 'string' && idMap.has(draft.id)) {
    lsSet(DRAFT_KEY, { ...draft, id: idMap.get(draft.id) });
  }
}

export interface SavedSetsRead {
  sets: SavedSet[];
  source: 'server' | 'device';
  /** Local id → server id for local copies that turned out to be sets already on the server. */
  remapped: Record<string, string>;
}

export async function readSavedSetsAsync(): Promise<SavedSetsRead> {
  const localSets = readSavedSets();
  try {
    const res = await fetch('/api/v1/library/sets');
    if (res.ok) {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-type-assertion */
      const data = await res.json() as any[];
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-type-assertion */
      const mapped = data.map((d: any) => ({
        ...d,
        id: String(d.id),
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        tracks: (d.tracks || []).map((t: any) => ({ ...t, id: t.track_id || t.id }))
      })) as SavedSet[];

      serverSetsCache = JSON.parse(JSON.stringify(mapped));

      // Pair every server set with its local copy: by id, or, for a copy still holding its local
      // id (the create reached the server but its new id never came back), by content. A paired
      // local copy is replaced by the server set, so each set is listed once, under the server id.
      const merged: SavedSet[] = [];
      const used = new Set<SavedSet>();
      const idMap = new Map<string, string>();

      for (const serverSet of mapped) {
        let local = localSets.find(s => !used.has(s) && s.id === serverSet.id);
        if (!local) {
          local = localSets.find(s => !used.has(s) && !isServerId(s.id) && sameContent(s, serverSet));
          if (local) idMap.set(local.id, serverSet.id);
        }
        if (local) {
          used.add(local);
          merged.push({ ...local, ...serverSet, name: serverSet.name, description: serverSet.description, tracks: serverSet.tracks });
        } else {
          merged.push(serverSet);
        }
      }

      // Sets made on this device that never reached the server stay; a numeric id the server
      // no longer lists was deleted elsewhere.
      for (const localSet of localSets) {
        if (!used.has(localSet) && !isServerId(localSet.id)) {
          merged.push(localSet);
        }
      }

      writeSavedSets(merged);
      remapStoredDraftId(idMap);
      return { sets: merged, source: 'server', remapped: Object.fromEntries(idMap) };
    }
  } catch (e) {
    console.warn('API sets read failed, falling back to local storage', e);
  }
  return { sets: localSets, source: 'device', remapped: {} };
}

const pendingCreates = new Map<string, Promise<string>>();

export async function writeSavedSetsAsync(sets: SavedSet[]): Promise<SavedSet[]> {
  const currentIds = new Set(sets.map(s => s.id));

  const toDelete = serverSetsCache.filter(s => !currentIds.has(s.id));
  const toSave = sets.filter(s => {
    const prev = serverSetsCache.find(x => x.id === s.id);
    return !prev || prev.updated !== s.updated || prev.name !== s.name;
  });

  let hasError = false;

  for (const s of toDelete) {
    try {
      const res = await fetch(`/api/v1/library/sets/${s.id}`, { method: 'DELETE' });
      if (!res.ok) hasError = true;
    } catch (e) {
      console.warn(`Failed to delete set ${s.id}`, e);
      hasError = true;
    }
  }

  const idMap = new Map<string, string>();

  for (const s of toSave) {
    const isNew = !isServerId(s.id);
    const intId = isNew ? 0 : parseInt(s.id, 10);

    if (isNew && pendingCreates.has(s.id)) {
      try {
        const newId = await pendingCreates.get(s.id);
        if (newId) idMap.set(s.id, newId);
      } catch (e) {
        hasError = true;
      }
      continue;
    }

    const savePromise = (async () => {
      try {
        const res = await fetch(`/api/v1/library/sets/${intId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: s.name,
            description: s.description || '',
            tracks: s.tracks.map(t => ({ track_id: t.id }))
          }),
        });
        if (res.ok) {
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-type-assertion */
          const data = await res.json() as { id?: unknown } | null;
          if (intId === 0) {
            // A create must come back with the new set's id. Without one the set keeps its
            // local id and is matched to the server copy by content on the next read.
            const id = Number(data?.id);
            if (Number.isInteger(id) && id > 0) return String(id);
            hasError = true;
          }
        } else {
          hasError = true;
        }
      } catch (e) {
        console.warn(`Failed to save set ${s.id}`, e);
        hasError = true;
      }
      return null;
    })();

    if (isNew) {
      pendingCreates.set(s.id, savePromise.then(id => id || ''));
    }

    const newId = await savePromise;
    if (newId) {
      idMap.set(s.id, newId);
    }

    if (isNew) {
      pendingCreates.delete(s.id);
    }
  }

  const updatedSets = sets.map(s => idMap.has(s.id) ? { ...s, id: idMap.get(s.id)! } : s);

  if (!hasError) {
    serverSetsCache = JSON.parse(JSON.stringify(updatedSets));
  }

  writeSavedSets(updatedSets);
  remapStoredDraftId(idMap);
  return updatedSets;
}

export function readSavedSets(): SavedSet[] {
  try {
    const raw = localStorage.getItem(SAVED_SETS_KEY);
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-type-assertion */
    return raw ? (JSON.parse(raw) as SavedSet[]) : [];
  } catch {
    return [];
  }
}

export function writeSavedSets(sets: SavedSet[]): void {
  try { localStorage.setItem(SAVED_SETS_KEY, JSON.stringify(sets)); } catch { /* storage blocked: sets stay in memory */ }
}
