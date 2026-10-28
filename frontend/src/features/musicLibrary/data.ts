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

export function resetLibraryCache(): void {
  cache = null;
}

export function loadLibrary(forceRefresh = false): Promise<LibraryFile> {
  if (forceRefresh) {
    cache = null;
  }
  if (!cache) {
    cache = (async () => {
      try {
        const res = await fetch('/api/v1/library/search?limit=5000');
        if (res.ok) {
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          const json = await res.json() as any[];
          if (json.length > 0) {
            const tracks = json.map(mapApiToLibraryTrack);
            return {
              generated: new Date().toISOString(),
              ledger_updated: new Date().toISOString(),
              counts: { tracks: tracks.length, pending: 0, rejected: 0, beatport_check: 0 },
              sources: [],
              runs: [],
              tracks,
              _source: 'backend' as const
            };
          }
        }
      } catch (e) {
        console.warn('API library search error, falling back to static JSON', e);
      }

      const r = await fetch('/data/music-library.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error(`Library file returned ${r.status}`);
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-type-assertion */
      const data = await r.json() as LibraryFile;
      data._source = 'library-fixture';
      return data;
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

export async function readSavedSetsAsync(): Promise<{ sets: SavedSet[], source: 'server' | 'device' }> {
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

      const merged: SavedSet[] = [];
      const serverIds = new Set(mapped.map(s => s.id));

      for (const serverSet of mapped) {
        const local = localSets.find(s => s.id === serverSet.id);
        if (local) {
          merged.push({ ...local, ...serverSet, name: serverSet.name, description: serverSet.description, tracks: serverSet.tracks });
        } else {
          merged.push(serverSet);
        }
      }

      for (const localSet of localSets) {
        if (!serverIds.has(localSet.id) && !/^\d+$/.test(localSet.id)) {
          merged.push(localSet);
        }
      }

      writeSavedSets(merged);
      return { sets: merged, source: 'server' };
    }
  } catch (e) {
    console.warn('API sets read failed, falling back to local storage', e);
  }
  return { sets: localSets, source: 'device' };
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
    const isNew = !/^\d+$/.test(s.id);
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
          const data = await res.json() as { id: number };
          if (intId === 0 && data.id) {
            return String(data.id);
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
