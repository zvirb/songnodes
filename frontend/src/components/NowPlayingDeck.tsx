import { TrackEnergy } from './ds';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';

import { Track } from '../types/dj';
import { tokenHex } from '../lib/graphColours';
import { trackApi } from '../services/api';

interface NowPlayingDeckProps {
  track: Track | null;
  onTrackSelect?: () => void;
}

const WaveformDisplay: React.FC<{
  waveformData?: number[];
  height?: number;
  progress?: number;
}> = ({ waveformData = [], height = 60, progress = 0 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // No waveform data → draw nothing (never a made-up waveform)
    const data = waveformData;
    if (data.length === 0) return;
    const ink = (t: string) => `#${tokenHex(t).toString(16).padStart(6, '0')}`;

    const barWidth = canvas.width / data.length;

    data.forEach((value, index) => {
      const x = index * barWidth;
      const barHeight = value * canvas.height;
      const y = (canvas.height - barHeight) / 2;
      ctx.fillStyle = ink('fg-3');
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });

    if (progress > 0) {
      const clampedProgress = Math.max(0, Math.min(progress, 1));
      const progressX = canvas.width * clampedProgress;
      ctx.fillStyle = ink('now');
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
        backgroundColor: 'var(--surface-1)',
        borderRadius: '4px',
        border: '1px solid var(--line-strong)'
      }}
    />
  );
};

const generateWaveform = (seedSource: string, length = 120): number[] => {
  let seed = 0;
  for (let i = 0; i < seedSource.length; i += 1) {
    seed = (seed * 31 + seedSource.charCodeAt(i)) % 997;
  }

  const values: number[] = [];
  for (let i = 0; i < length; i += 1) {
    seed = (seed * 73 + 37) % 1000;
    const value = 0.2 + (seed / 1000) * 0.7;
    values.push(Number(value.toFixed(3)));
  }
  return values;
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
      : []; // no stored waveform → none drawn (never generated)
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
      } catch (error) {
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
      <div className="now-playing-deck-empty" style={{
        padding: '40px',
        backgroundColor: 'var(--surface-1)',
        borderRadius: '12px',
        border: '2px solid var(--line)',
        textAlign: 'center'
      }}>
        <p style={{
          color: 'var(--fg-2)',
          fontSize: '1.125rem',
          margin: 0
        }}>
          No Track Selected
        </p>
        <p style={{
          color: 'var(--fg-2)',
          fontSize: '0.875rem',
          marginTop: '8px'
        }}>
          Select a track from the graph or browser
        </p>
      </div>
    );
  }

  return (
    <div className="now-playing-deck" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      padding: '16px 20px',
      backgroundColor: 'var(--surface-1)',
      borderRadius: '12px',
      border: '2px solid var(--line-strong)',
      boxShadow: 'var(--shadow-2)',
      height: '100%',
      maxHeight: '280px',
      overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minHeight: 0,
        whiteSpace: 'nowrap',
        overflow: 'hidden'
      }}>
        <span style={{
          color: 'var(--fg)',
          fontSize: '1.125rem',
          fontWeight: 700,
          letterSpacing: '-0.5px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flexShrink: 1
        }}>
          {track.name}
        </span>
        <span style={{ color: 'var(--fg-2)', fontSize: '1rem', flexShrink: 0 }}>•</span>
        <span style={{
          color: 'var(--fg-2)',
          fontSize: '0.875rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flexShrink: 1
        }}>
          {track.artist}
        </span>
        <span style={{ color: 'var(--fg-2)', fontSize: '1rem', flexShrink: 0 }}>•</span>
        <span style={{
          color: 'var(--brand)',
          fontSize: '0.875rem',
          fontWeight: 600,
          flexShrink: 0
        }}>
          {track.bpm ?? '—'} BPM
        </span>
        <span style={{ color: 'var(--fg-2)', fontSize: '1rem', flexShrink: 0 }}>•</span>
        <span style={{
          color: 'var(--status-ok)',
          fontSize: '0.875rem',
          fontWeight: 600,
          flexShrink: 0
        }}>
          {track.key ?? '—'}
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '8px 12px',
          backgroundColor: 'var(--surface-2)',
          borderRadius: '8px',
          border: '1px solid var(--surface-2)'
        }}>
          <span style={{
            color: 'var(--fg-2)',
            fontSize: '0.6875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px'
          }}>
            Energy
          </span>
          <span style={{
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
          padding: '8px 12px',
          backgroundColor: 'var(--surface-2)',
          borderRadius: '8px',
          border: '1px solid var(--surface-2)'
        }}>
          <span style={{
            color: 'var(--fg-2)',
            fontSize: '0.6875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px'
          }}>
            Valence
          </span>
          <span style={{
            color: 'var(--fg)',
            fontSize: '1.25rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums'
          }}>
            {valencePercent !== null ? `${valencePercent}` : '—'}
          </span>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '8px 12px',
          backgroundColor: 'var(--surface-2)',
          borderRadius: '8px',
          border: '1px solid var(--surface-2)'
        }}>
          <span style={{
            color: 'var(--fg-2)',
            fontSize: '0.6875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px'
          }}>
            Genre
          </span>
          <span style={{
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
          padding: '8px 12px',
          backgroundColor: 'var(--surface-2)',
          borderRadius: '8px',
          border: '1px solid var(--surface-2)'
        }}>
          <span style={{
            color: 'var(--fg-2)',
            fontSize: '0.6875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px'
          }}>
            Length
          </span>
          <span style={{
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleTogglePreview}
              disabled={!previewUrl || isPreviewLoading}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: '1px solid var(--line-strong)',
                backgroundColor: 'var(--surface-2)',
                color: 'var(--fg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: previewUrl ? 'pointer' : 'not-allowed'
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
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{
                position: 'relative',
                height: '6px',
                borderRadius: '999px',
                backgroundColor: 'var(--surface-2)'
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: `${progressPercent}%`,
                  background: 'var(--brand)',
                  borderRadius: '999px',
                  transition: 'width 0.12s ease-out'
                }} />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.floor(progressPercent)}
                onChange={(event) => handleScrub(Number(event.target.value))}
                disabled={!previewUrl}
                style={{ width: '100%' }}
              />
            </div>
            <span style={{
              fontSize: '0.75rem',
              color: 'var(--fg-2)',
              minWidth: '68px',
              textAlign: 'right'
            }}>
              {formatSeconds(totalPreviewSeconds * progress)} / {formatSeconds(totalPreviewSeconds)}
            </span>
          </div>
          {isPreviewLoading && (
            <span style={{ fontSize: '0.6875rem', color: 'var(--fg-2)' }}>
              Fetching preview from connected services…
            </span>
          )}
          {previewError && (
            <span style={{ fontSize: '0.6875rem', color: 'var(--status-bad)' }}>{previewError}</span>
          )}
        </div>
      ) : (
        <p style={{
          fontSize: '0.75rem',
          color: 'var(--fg-2)',
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
