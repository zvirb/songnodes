import type { AISetlist } from './schema';
import type { UnifiedTrack } from '../../../types/unifiedTrack';

export interface CatalogSetlist {
  dj_artist_name: string | null;
  event_name: string | null;
  set_date: string | null;
  setlist_name: string | null;
}

export interface DedupeResult {
  newSetlists: AISetlist[];
  existingSetlists: { setlist: AISetlist, reason: string }[];
  invalidSetlists: { setlist: AISetlist, reason: string }[];
  tracksNew: number;
  tracksExisting: number;
}

function normalizeStr(s: string | null | undefined): string {
  if (!s) return '';
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeArtistTitle(artist: string, title: string): string {
  return `${normalizeStr(artist)} - ${normalizeStr(title)}`;
}

export function dedupe(
  setlists: AISetlist[],
  catalogSetlists: CatalogSetlist[],
  localLedgerKeys: string[],
  catalogTracks: UnifiedTrack[]
): DedupeResult {
  const newSetlists: AISetlist[] = [];
  const existingSetlists: { setlist: AISetlist, reason: string }[] = [];
  const invalidSetlists: { setlist: AISetlist, reason: string }[] = [];

  let tracksNew = 0;
  let tracksExisting = 0;

  const existingTrackKeys = new Set<string>();
  catalogTracks.forEach(t => {
    existingTrackKeys.add(normalizeArtistTitle(t.artist, t.title));
  });

  const inPayloadSetlists = new Set<string>();

  for (const sl of setlists) {
    // Check in-payload duplicates (by same tracklist order or same dj+event+date)
    const tracklistKey = sl.tracks.map(t => normalizeArtistTitle(t.artist, t.title)).join('|');
    const metaKey = `${normalizeStr(sl.dj)}|${normalizeStr(sl.event)}|${normalizeStr(sl.date)}`;
    const ledgerKey = `${sl.dj} @ ${sl.event} (${sl.date})`;

    if (inPayloadSetlists.has(tracklistKey) || inPayloadSetlists.has(metaKey)) {
       existingSetlists.push({ setlist: sl, reason: 'Duplicate inside payload.' });
       continue;
    }

    inPayloadSetlists.add(tracklistKey);
    inPayloadSetlists.add(metaKey);

    // Check against local ledger
    if (localLedgerKeys.includes(ledgerKey)) {
        existingSetlists.push({ setlist: sl, reason: 'Already imported in this browser.' });
        continue;
    }

    // Check against catalog
    const isCatalogMatch = catalogSetlists.some(c =>
      normalizeStr(c.dj_artist_name) === normalizeStr(sl.dj) &&
      normalizeStr(c.event_name) === normalizeStr(sl.event) &&
      normalizeStr(c.set_date) === normalizeStr(sl.date)
    );

    if (isCatalogMatch) {
       existingSetlists.push({ setlist: sl, reason: 'Already in catalog.' });
       continue;
    }

    // New setlist
    newSetlists.push(sl);

    // Count tracks
    sl.tracks.forEach(t => {
       const tk = normalizeArtistTitle(t.artist, t.title);
       if (existingTrackKeys.has(tk)) {
         tracksExisting++;
       } else {
         tracksNew++;
         existingTrackKeys.add(tk); // don't count duplicate new tracks twice
       }
    });
  }

  return { newSetlists, existingSetlists, invalidSetlists, tracksNew, tracksExisting };
}
