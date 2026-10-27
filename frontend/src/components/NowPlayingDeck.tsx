import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';

import { Track } from '../types/dj';
import { trackApi } from '../services/api';
import { TrackEnergy } from './ds';
import { Bpm, KeyBadge } from '../lib/songnodes';

interface NowPlayingDeckProps {
  track: Track | null;
  onTrackSelect?: () => void;
}

const WaveformDisplay: React.FC<{
  waveformData?: number[];
  height?: number;
  progress?: number;
}> = ({ waveformData = [], height = 56, progress = 0 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // No waveform data → draw nothing
    const data = waveformData;
    if (data.length === 0) return;

    const styles = getComputedStyle(canvas);
    const fg3 = styles.getPropertyValue('--fg-3').trim();
    const nowColor = styles.getPropertyValue('--now').trim();

    const barWidth = canvas.width / data.length;

    data.forEach((value, index) => {
      const x = index * barWidth;
      const barHeight = value * canvas.height;
      const y = (canvas.height - barHeight) / 2;
      ctx.fillStyle = fg3;
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });

    if (progress > 0) {
      const clampedProgress = Math.max(0, Math.min(progress, 1));
      const progressX = canvas.width * clampedProgress;
      ctx.fillStyle = nowColor;
      ctx.fillRect(progressX - 1, 0, 2, canvas.height);
    }
  }, [waveformData, progress]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={height}
      style={{
        width: '100%',
        height: `${height}px`,
        backgroundColor: 'var(--surface-2)',
        borderRadius: 'var(--radius-control)',
        border: '1px solid var(--line)'
      }}
    />
  );
};

const formatSeconds = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const NowPlayingDeck: React.FC<NowPlayingDeckProps> = ({ track }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute('src');
    }

    setIsPlayingPreview(false);
    setProgress(0);
    setPreviewDuration(0);
    setPreviewUrl(null);
    setPreviewError(null);
    setIsPreviewLoading(false);

    if (!track) {
      setWaveformData([]);
      return;
    }

    const waveform = Array.isArray(track.waveform) && track.waveform.length > 0
      ? track.waveform
      : [];
    setWaveformData(waveform);

    if (!track.id) {
      return;
    }

    if (track.preview_url) {
      setPreviewUrl(track.preview_url);
      return;
    }

    let cancelled = false;
    const fetchPreview = async () => {
      setIsPreviewLoading(true);
      try {
        const response = await trackApi.getTrackPreview(track.id);
        if (!cancelled) {
          if (response.status === 'success' && response.data?.previewUrl) {
            setPreviewUrl(response.data.previewUrl);
            setPreviewError(null);
          } else {
            setPreviewError('Preview not available for this track.');
          }
        }
      } catch {
        if (!cancelled) {
          setPreviewError('Unable to fetch preview audio. Check your streaming credentials.');
        }
      } finally {
        if (!cancelled) {
          setIsPreviewLoading(false);
        }
      }
    };

    fetchPreview();

    return () => {
      cancelled = true;
    };
  }, [track]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !previewUrl) return;
    audio.src = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlayingPreview(true);
    const handlePause = () => setIsPlayingPreview(false);
    const handleEnded = () => {
      setIsPlayingPreview(false);
      setProgress(0);
    };
    const handleTimeUpdate = () => {
      if (!audio.duration) return;
      setProgress(audio.currentTime / audio.duration);
    };
    const handleLoadedMetadata = () => {
      if (audio.duration) {
        setPreviewDuration(audio.duration);
      }
    };
    const handleError = () => {
      setPreviewError('Playback failed. Try reconnecting your streaming provider.');
      setIsPlayingPreview(false);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('error', handleError);
    };
  }, [previewUrl]);

  const handleTogglePreview = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !previewUrl) {
      return;
    }

    if (isPlayingPreview) {
      audio.pause();
      return;
    }

    audio.play().catch(() => {
      setPreviewError('Unable to start playback. Check your streaming provider setup.');
    });
  }, [isPlayingPreview, previewUrl]);

  const handleScrub = useCallback((value: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) {
      return;
    }
    const normalised = clamp(value, 0, 100) / 100;
    audio.currentTime = audio.duration * normalised;
    setProgress(normalised);
  }, []);

  const progressPercent = clamp(progress, 0, 1) * 100;
  const totalPreviewSeconds = previewDuration > 0 ? previewDuration : 30;
  const trackDurationSeconds = track?.duration ?? track?.duration_seconds ?? 0;
  const valencePercent = track?.valence !== undefined ? Math.round(track.valence * 100) : null;

  if (!track) {
    return (
      <div
        className="now-playing-deck-empty"
        style={{
          padding: 'var(--space-8)',
          backgroundColor: 'var(--surface-1)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--line)',
          textAlign: 'center'
        }}
      >
        <p style={{
          fontFamily: 'var(--font-display)',
          color: 'var(--fg)',
          fontSize: '1.125rem',
          fontWeight: 700,
          margin: 0
        }}>
          No Track Selected
        </p>
        <p style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--fg-3)',
          fontSize: '0.875rem',
          marginTop: 'var(--space-2)'
        }}>
          Select a track from the graph or browser
        </p>
      </div>
    );
  }

  return (
    <div
      className="now-playing-deck"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        padding: 'var(--space-4)',
        backgroundColor: 'var(--surface-1)',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--line-strong)',
        boxShadow: 'var(--shadow-2)',
        height: '100%',
        maxHeight: '300px',
        overflow: 'hidden'
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        minHeight: 0,
        whiteSpace: 'nowrap',
        overflow: 'hidden'
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          color: 'var(--fg)',
          fontSize: '1.125rem',
          fontWeight: 700,
          letterSpacing: '-0.01em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flexShrink: 1
        }}>
          {track.name}
        </span>
        <span style={{ color: 'var(--fg-3)', fontSize: '1rem', flexShrink: 0 }}>•</span>
        <span style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--fg-2)',
          fontSize: '0.875rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flexShrink: 1
        }}>
          {track.artist}
        </span>
        <span style={{ color: 'var(--fg-3)', fontSize: '1rem', flexShrink: 0 }}>•</span>
        {track.bpm ? <Bpm value={track.bpm} /> : null}
        <span style={{ color: 'var(--fg-3)', fontSize: '1rem', flexShrink: 0 }}>•</span>
        {track.key || track.camelotKey ? <KeyBadge value={track.camelotKey || track.key} /> : null}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 'var(--space-3)'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'var(--surface-2)',
          borderRadius: 'var(--radius-control)',
          border: '1px solid var(--line)'
        }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--fg-3)',
            fontSize: '0.6875rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 'var(--space-1)'
          }}>
            Energy
          </span>
          <span style={{
            fontFamily: 'var(--font-data)',
            color: 'var(--status-ok)',
            fontSize: '1.25rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums'
          }}>
            <TrackEnergy energy={track?.energy} scale={track?.energy_scale} />
          </span>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'var(--surface-2)',
          borderRadius: 'var(--radius-control)',
          border: '1px solid var(--line)'
        }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--fg-3)',
            fontSize: '0.6875rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 'var(--space-1)'
          }}>
            Valence
          </span>
          <span style={{
            fontFamily: 'var(--font-data)',
            color: 'var(--fg)',
            fontSize: '1.25rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums'
          }}>
            {valencePercent !== null ? `${valencePercent}%` : '—'}
          </span>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'var(--surface-2)',
          borderRadius: 'var(--radius-control)',
          border: '1px solid var(--line)'
        }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--fg-3)',
            fontSize: '0.6875rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 'var(--space-1)'
          }}>
            Genre
          </span>
          <span style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--fg)',
            fontSize: '0.875rem',
            fontWeight: 600,
            textTransform: 'uppercase'
          }}>
            {track.genre ?? 'N/A'}
          </span>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'var(--surface-2)',
          borderRadius: 'var(--radius-control)',
          border: '1px solid var(--line)'
        }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--fg-3)',
            fontSize: '0.6875rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 'var(--space-1)'
          }}>
            Length
          </span>
          <span style={{
            fontFamily: 'var(--font-data)',
            color: 'var(--fg)',
            fontSize: '1.25rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums'
          }}>
            {formatSeconds(trackDurationSeconds)}
          </span>
        </div>
      </div>

      <WaveformDisplay waveformData={waveformData} height={56} progress={progress} />

      {(previewUrl || isPreviewLoading || previewError) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <button
              onClick={handleTogglePreview}
              disabled={!previewUrl || isPreviewLoading}
              style={{
                width: 'var(--control-md)',
                height: 'var(--control-md)',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--line-strong)',
                backgroundColor: 'var(--surface-2)',
                color: 'var(--fg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: previewUrl ? 'pointer' : 'not-allowed',
                opacity: previewUrl ? 1 : 'var(--opacity-disabled)'
              }}

              aria-label={isPlayingPreview ? 'Pause preview' : 'Play preview'}
            >
              {isPreviewLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : isPlayingPreview ? (
                <Pause size={18} />
              ) : (
                <Play size={18} />
              )}
            </button>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <div style={{
                position: 'relative',
                height: '6px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--surface-3)'
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: `${progressPercent}%`,
                  background: 'var(--brand)',
                  borderRadius: 'var(--radius-pill)',
                  transition: 'width var(--duration-fast) var(--ease-standard)'
                }} />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.floor(progressPercent)}
                onChange={(event) => handleScrub(Number(event.target.value))}
                disabled={!previewUrl}
                aria-label="Seek preview track"
                style={{ width: '100%' }}
              />
            </div>
            <span style={{
              fontFamily: 'var(--font-data)',
              fontSize: '0.75rem',
              color: 'var(--fg-2)',
              minWidth: '68px',
              textAlign: 'right'
            }}>
              {formatSeconds(totalPreviewSeconds * progress)} / {formatSeconds(totalPreviewSeconds)}
            </span>
          </div>
          {isPreviewLoading && (
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--fg-2)' }}>
              Fetching preview from connected services…
            </span>
          )}
          {previewError && (
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--status-bad)' }}>{previewError}</span>
          )}
        </div>
      ) : (
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.75rem',
          color: 'var(--fg-3)',
          margin: 0
        }}>
          Connect Spotify or Tidal from settings to audition a 30s preview.
        </p>
      )}

      <audio ref={audioRef} preload="metadata" style={{ display: 'none' }} />
    </div>
  );
};

export default NowPlayingDeck;
