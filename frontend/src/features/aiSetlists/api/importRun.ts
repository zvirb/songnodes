import type { AISetlist } from './schema';

export interface ImportOutcome {
  created: number;
  replayed: number;
  failed: AISetlist[];
  /** Ledger entries for setlists the server accepted. */
  ledger: string[];
}

export const ledgerKey = (sl: AISetlist): string => `${sl.dj} @ ${sl.event} (${sl.date})`;

/**
 * Imports setlists one by one. A setlist counts as created or replayed only when
 * the server answers 2xx; anything else is failed, kept for retry and left out
 * of the ledger.
 */
export async function importSetlists(
  setlists: AISetlist[],
  onProgress: (percent: number) => void = () => {},
  fetchImpl: typeof fetch = fetch,
): Promise<ImportOutcome> {
  const outcome: ImportOutcome = { created: 0, replayed: 0, failed: [], ledger: [] };

  for (let i = 0; i < setlists.length; i++) {
    const sl = setlists[i];
    onProgress(Math.round((i / setlists.length) * 100));
    try {
      const res = await fetchImpl('/api/v1/tracks/import-tracklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dj_artist: sl.dj,
          name: sl.event || 'AI Setlist',
          tracks: sl.tracks.map((t) => ({
            artist: t.artist,
            title: t.title,
            track_number: t.position,
          })),
        }),
      });
      if (!res.ok) {
        outcome.failed.push(sl);
        continue;
      }
      const data = await res.json().catch(() => ({}));
      if (data && data.replayed) outcome.replayed++;
      else outcome.created++;
      outcome.ledger.push(ledgerKey(sl));
    } catch {
      outcome.failed.push(sl);
    }
  }

  onProgress(100);
  return outcome;
}
