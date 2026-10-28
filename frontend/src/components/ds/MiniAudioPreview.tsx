/**
 * MiniAudioPreview (design system 1.2.0, Music).
 *
 * A 32px inline player for a track's preview clip: play/pause, a thin progress line and the
 * time in mono. States: paused, loading, playing, unavailable (no clip or it failed to load).
 * Only one preview plays at a time across the app (shared manager below).
 * Markup and behaviour: design-system/components/MiniAudioPreview/README.md.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SnIcon, SN } from '../../lib/songnodes';

export interface MiniAudioPreviewProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Preview clip URL (about 30 seconds); missing or failing renders the unavailable state. */
  src?: string | null;
  /** Track named in the button label ("Bicep – Glue"). */
  title: string;
  /** Clip length in seconds when known before loading (default 30). */
  duration?: number;
}

type PreviewState = 'paused' | 'loading' | 'playing' | 'unavailable';

/* ------------------------------------------------------------------ */
/* One preview at a time                                               */
/* ------------------------------------------------------------------ */

type StopFn = () => void;
let current: { id: symbol; stop: StopFn } | null = null;

/** Shared audio manager: claiming playback stops whichever preview was playing. */
export const previewAudioManager = {
  claim(id: symbol, stop: StopFn) {
    if (current && current.id !== id) current.stop();
    current = { id, stop };
  },
  release(id: symbol) {
    if (current?.id === id) current = null;
  },
  /** Stop any preview (route changes, dialogs opening). */
  stopAll() {
    const c = current;
    current = null;
    c?.stop();
  },
  get playingId(): symbol | null {
    return current?.id ?? null;
  },
};

/* ------------------------------------------------------------------ */

export const MiniAudioPreview = React.forwardRef<HTMLDivElement, MiniAudioPreviewProps>(({
  src,
  title,
  duration = 30,
  className = '',
  style,
  ...props
}, ref) => {
  const idRef = useRef<symbol>(Symbol('mini-preview'));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<PreviewState>(src ? 'paused' : 'unavailable');
  const [at, setAt] = useState(0);
  const [length, setLength] = useState(duration);
  const [prevSrc, setPrevSrc] = useState(src);

  // A new clip resets the player (derived during render, no effect needed).
  if (prevSrc !== src) {
    setPrevSrc(src);
    setState(src ? 'paused' : 'unavailable');
    setAt(0);
  }

  const teardown = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.removeAttribute('src');
    a.load?.();
    audioRef.current = null;
  }, []);

  // Release the audio when the clip changes or the component unmounts.
  useEffect(() => {
    const id = idRef.current;
    if (!src) return undefined;
    return () => {
      previewAudioManager.release(id);
      teardown();
    };
  }, [src, teardown]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setState((s) => (s === 'unavailable' ? s : 'paused'));
  }, []);

  const play = useCallback(() => {
    if (!src) return;
    let a = audioRef.current;
    if (!a) {
      a = new Audio();
      a.preload = 'none';
      a.addEventListener('timeupdate', () => setAt(a?.currentTime ?? 0));
      a.addEventListener('loadedmetadata', () => { if (a && Number.isFinite(a.duration) && a.duration > 0) setLength(a.duration); });
      a.addEventListener('playing', () => setState('playing'));
      a.addEventListener('ended', () => { setState('paused'); setAt(0); previewAudioManager.release(idRef.current); });
      a.addEventListener('error', () => { setState('unavailable'); previewAudioManager.release(idRef.current); });
      a.src = src;
      audioRef.current = a;
    }
    previewAudioManager.claim(idRef.current, pause);
    setState('loading');
    const p = a.play();
    if (p && typeof p.catch === 'function') {
      p.catch((err: unknown) => {
        // An interrupted play (pause pressed while loading) is not a failure.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setState('unavailable');
        previewAudioManager.release(idRef.current);
      });
    }
  }, [pause, src]);

  const toggle = () => {
    if (state === 'playing' || state === 'loading') {
      pause();
      previewAudioManager.release(idRef.current);
    } else {
      play();
    }
  };

  const unavailable = state === 'unavailable';
  const playing = state === 'playing';
  const pct = length > 0 ? Math.min(100, Math.round((100 * at) / length)) : 0;
  const name = unavailable
    ? `No preview for ${title}`
    : `${playing || state === 'loading' ? 'Pause' : 'Play'} preview of ${title}`;
  const cssVars: React.CSSProperties & { '--sn-mini-preview-pct': string } = { '--sn-mini-preview-pct': `${pct}%` };

  return (
    <div
      ref={ref}
      className={['sn-mini-preview', className].filter(Boolean).join(' ')}
      data-state={state}
      style={{ ...cssVars, ...style }}
      {...props}
    >
      <button
        type="button"
        className="sn-mini-preview__btn"
        aria-label={name}
        aria-pressed={playing}
        aria-busy={state === 'loading' || undefined}
        disabled={unavailable}
        onClick={toggle}
      >
        {state === 'loading'
          ? <span className="sn-spinner" aria-hidden="true" />
          : <SnIcon name={playing ? 'pause' : 'play'} size={14} />}
      </button>
      <span className="sn-mini-preview__track" aria-hidden="true"><span className="sn-mini-preview__fill" /></span>
      <span className="sn-mini-preview__time">
        {unavailable ? 'No preview' : `${SN.format.duration(at)} / ${SN.format.duration(length)}`}
      </span>
    </div>
  );
});
MiniAudioPreview.displayName = 'MiniAudioPreview';
