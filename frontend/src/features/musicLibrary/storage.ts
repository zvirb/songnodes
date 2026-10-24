/**
 * Per-device storage for the music library pages. Every read and write is wrapped: storage can be
 * blocked (private windows, previews) and the pages must still work from memory.
 */
import type { LibraryTrack } from './data';
import { sanitiseDraft, type Draft } from './setBuilder';

export function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function lsSet(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: keep in memory */ }
}

/** Library filters and sort (12-inputs: `sn-filters-<page>`). */
export const FILTERS_KEY = 'sn-filters-library';
/** The set being built; Library's add-to-set writes here too. */
export const DRAFT_KEY = 'sn-set-draft';

export const readDraft = (): Draft => sanitiseDraft(lsGet<unknown>(DRAFT_KEY, null));
export const writeDraft = (d: Draft) => lsSet(DRAFT_KEY, d);

/** A banner dismissal sticks until the condition's count changes. */
export const bannerKey = (page: string) => `sn-banner-keyed-${page}`;

/** Normalise keys once at the edge so every view and the builder read Camelot codes. */
export function normaliseTracks(tracks: LibraryTrack[], camelot: (k: string | null | undefined) => string | null): LibraryTrack[] {
  return tracks.map((t) => ({ ...t, k: t.k ? camelot(t.k) : null, tags: t.tags || [], src: t.src || [] }));
}

/**
 * The pipeline writes run stamps in Melbourne local time without a zone ("2026-10-23T20:27:14").
 * Read them as Melbourne time, whichever zone the browser is in.
 */
export function melbourneStamp(s: string | null | undefined, timeOf: (d: Date) => string): Date | null {
  if (!s) return null;
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(s)) { const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; }
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?/.exec(s);
  if (!m) return null;
  const hhmm = m[2] ? `${m[2]}:${m[3]}` : '12:00';
  const local = m[2] ? s : `${m[1]}T12:00:00`;
  for (const off of ['+11:00', '+10:00']) {
    const d = new Date(local + off);
    if (!Number.isNaN(d.getTime()) && timeOf(d) === hhmm) return d;
  }
  const d = new Date(local + '+10:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Download a JSON file without leaving the page. */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
