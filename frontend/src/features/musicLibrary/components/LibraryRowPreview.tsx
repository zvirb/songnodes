/**
 * Deezer 30-second preview for one crate row (PV2), built on the design-system MiniAudioPreview
 * (design-system/components/MiniAudioPreview/README.md).
 *
 * The clip URL is fetched only when the person presses play (GET /api/v1/library/tracks/{id}/preview,
 * PV1), so a crate of hundreds of rows makes no requests up front. Until then the row shows the
 * card's paused markup; while the URL is fetched it shows the loading state (a second press cancels);
 * once known, MiniAudioPreview takes over and starts the clip the person asked for. Deezer having no
 * clip, or the lookup failing, is the card's unavailable state ("No preview"); a failure keeps its
 * cause in the tooltip.
 */
import React, { useEffect, useRef, useState } from 'react';
import { MiniAudioPreview, previewAudioManager } from '../../../components/ds/MiniAudioPreview';
import { SN, SnIcon } from '../../../lib/songnodes';

type Lookup =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; url: string }
  | { kind: 'none' }
  | { kind: 'error'; cause: string };

export class PreviewLookupError extends Error {}

/** The Deezer preview URL for a library track, or null when Deezer has none. */
export async function fetchPreviewUrl(trackId: string, signal?: AbortSignal): Promise<string | null> {
  const res = await fetch(`/api/v1/library/tracks/${encodeURIComponent(trackId)}/preview`, { signal });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = typeof body?.detail === 'string' ? body.detail : `Preview lookup failed (HTTP ${res.status})`;
    throw new PreviewLookupError(detail);
  }
  return typeof body?.url === 'string' && body.url ? body.url : null;
}

export interface LibraryRowPreviewProps {
  trackId: string;
  /** Track named in the button label ("Bicep – Glue"). */
  title: string;
}

export const LibraryRowPreview: React.FC<LibraryRowPreviewProps> = ({ trackId, title }) => {
  const [lookup, setLookup] = useState<Lookup>({ kind: 'idle' });
  const abortRef = useRef<AbortController | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const startWhenReady = useRef(false);

  useEffect(() => () => abortRef.current?.abort(), []);

  // The person pressed play before the URL was known: start the clip once the player is mounted.
  useEffect(() => {
    if (lookup.kind !== 'ready' || !startWhenReady.current) return;
    startWhenReady.current = false;
    playerRef.current?.querySelector<HTMLButtonElement>('.sn-mini-preview__btn')?.click();
  }, [lookup]);

  const press = () => {
    if (lookup.kind === 'loading') {
      abortRef.current?.abort();
      startWhenReady.current = false;
      setLookup({ kind: 'idle' });
      return;
    }
    previewAudioManager.stopAll();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    startWhenReady.current = true;
    setLookup({ kind: 'loading' });
    fetchPreviewUrl(trackId, ctrl.signal)
      .then((url) => { if (!ctrl.signal.aborted) setLookup(url ? { kind: 'ready', url } : { kind: 'none' }); })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setLookup({ kind: 'error', cause: err instanceof PreviewLookupError ? err.message : 'Preview lookup failed: the server could not be reached' });
      });
  };

  if (lookup.kind === 'ready') return <MiniAudioPreview ref={playerRef} src={lookup.url} title={title} />;
  if (lookup.kind === 'none') return <MiniAudioPreview src={null} title={title} />;
  if (lookup.kind === 'error') return <span title={lookup.cause}><MiniAudioPreview src={null} title={title} /></span>;

  const loading = lookup.kind === 'loading';
  return (
    <div className="sn-mini-preview" data-state={loading ? 'loading' : 'paused'}>
      <button
        type="button"
        className="sn-mini-preview__btn"
        aria-label={`${loading ? 'Pause' : 'Play'} preview of ${title}`}
        aria-pressed={false}
        aria-busy={loading || undefined}
        onClick={press}
      >
        {loading ? <span className="sn-spinner" aria-hidden="true" /> : <SnIcon name="play" size={14} />}
      </button>
      <span className="sn-mini-preview__track" aria-hidden="true"><span className="sn-mini-preview__fill" /></span>
      <span className="sn-mini-preview__time">{`${SN.format.duration(0)} / ${SN.format.duration(30)}`}</span>
    </div>
  );
};
