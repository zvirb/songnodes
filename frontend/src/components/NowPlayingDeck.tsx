import { formatStoredEnergy } from '../utils/trackMetadata';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';

import { Track } from '../types/dj';
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

    const data = waveformData.length > 0 ? waveformData :
      Array.from({ length: 120 }, () => Math.random() * 0.7 + 0.2);

    const barWidth = canvas.width / data.length;

    data.forEach((value, index) => {
      const x = index * barWidth;
      const barHeight = value * canvas.height;
      const y = (canvas.height - barHeight) / 2;

      const gradient = ctx.createLinearGradient(x, 0, x, canvas.height);
      gradient.addColorStop(0, '#44aaff'); // var(--color-brand-secondary)
      gradient.addColorStop(1, '#00ff41'); // var(--color-brand-primary)
      ctx.fillStyle = gradient;

      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });

    if (progress > 0) {
      const clampedProgress = Math.max(0, Math.min(progress, 1));
      const progressX = canvas.width * clampedProgress;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(0, 0, progressX, canvas.height);

      ctx.fillStyle = '#00ff41'; // var(--color-brand-primary)
      ctx.fillRect(progressX - 1, 0, 2, canvas.height);
    }
  }, [waveformData, progress]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={height}
      data-testid="waveform-canvas"
      aria-label="Track audio waveform visualization"
      style={{
        width: '100%',
        height: `${height}px`,
        backgroundColor: 'var(--color-bg-elevated-1)',
        borderRadius: 'var(--radius-base)',
        border: '1px solid var(--color-border-subtle)'
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
      : generateWaveform(track.id || `${track.name}-${track.artist}`);
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
  const energyDisplay = formatStoredEnergy(track?.energy, track?.energy_scale);
  const valencePercent = track?.valence !== undefined ? Math.round(track.valence * 100) : null;

  if (!track) {
    return (
      <div
        className="now-playing-deck-empty"
        data-testid="now-playing-empty"
        style={{
          padding: 'var(--space-8)',
          backgroundColor: 'var(--color-bg-elevated-1)',
          borderRadius: 'var(--radius-xl)',
          border: '2px solid var(--color-border-subtle)',
          textAlign: 'center'
        }}
      >
        <p style={{
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-medium)',
          margin: 0
        }}>
          No Track Selected
        </p>
        <p style={{
          color: 'var(--color-text-tertiary)',
          fontSize: 'var(--font-size-sm)',
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
      data-testid="now-playing-deck"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        padding: 'var(--space-4) var(--space-5)',
        backgroundColor: 'var(--color-panel-bg)',
        borderRadius: 'var(--radius-xl)',
        border: '2px solid var(--color-border-default)',
        boxShadow: 'var(--shadow-lg)',
        height: '100%',
        maxHeight: '280px',
        overflow: 'hidden'
      }}
    >
      <div
        data-testid="now-playing"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          minHeight: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden'
        }}
      >
        <span
          data-testid="telemetry-title"
          style={{
            color: 'var(--color-text-primary)',
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-bold)',
            letterSpacing: 'var(--letter-spacing-tight)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flexShrink: 1
          }}
        >
          {track.name}
        </span>
        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-base)', flexShrink: 0 }}>•</span>
        <span
          data-testid="telemetry-artist"
          style={{
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-sm)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flexShrink: 1
          }}
        >
          {track.artist}
        </span>
        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-base)', flexShrink: 0 }}>•</span>
        <span
          data-testid="telemetry-bpm"
          style={{
            color: 'var(--color-brand-secondary)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0
          }}
        >
          {track.bpm ?? '—'} BPM
        </span>
        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-base)', flexShrink: 0 }}>•</span>
        <span
          data-testid="telemetry-key"
          style={{
            color: 'var(--color-brand-primary)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0
          }}
        >
          {track.key ?? '—'}
        </span>
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
          backgroundColor: 'var(--color-brand-secondary-muted)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border-subtle)'
        }}>
          <span style={{
            color: 'var(--color-text-tertiary)',
            fontSize: 'var(--font-size-xs)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--letter-spacing-wider)',
            marginBottom: 'var(--space-1)'
          }}>
            Energy
          </span>
          <span
            data-testid="telemetry-energy"
            style={{
              color: 'var(--color-brand-primary)',
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-bold)',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {energyDisplay}
          </span>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'var(--color-success-bg)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-success-border)'
        }}>
          <span style={{
            color: 'var(--color-text-tertiary)',
            fontSize: 'var(--font-size-xs)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--letter-spacing-wider)',
            marginBottom: 'var(--space-1)'
          }}>
            Valence
          </span>
          <span
            data-testid="telemetry-valence"
            style={{
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-bold)',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {valencePercent !== null ? `${valencePercent}` : '—'}
          </span>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'var(--color-bg-elevated-1)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border-subtle)'
        }}>
          <span style={{
            color: 'var(--color-text-tertiary)',
            fontSize: 'var(--font-size-xs)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--letter-spacing-wider)',
            marginBottom: 'var(--space-1)'
          }}>
            Genre
          </span>
          <span
            data-testid="telemetry-genre"
            style={{
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              textTransform: 'uppercase'
            }}
          >
            {track.genre ?? 'N/A'}
          </span>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'var(--color-info-bg)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-info-border)'
        }}>
          <span style={{
            color: 'var(--color-text-tertiary)',
            fontSize: 'var(--font-size-xs)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--letter-spacing-wider)',
            marginBottom: 'var(--space-1)'
          }}>
            Length
          </span>
          <span
            data-testid="telemetry-length"
            style={{
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-bold)',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
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
              data-testid="play-trigger"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-bg-elevated-2)',
                color: 'var(--color-text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: previewUrl ? 'pointer' : 'not-allowed',
                transition: 'var(--transition-button)'
              }}
              aria-label={isPlayingPreview ? 'Pause preview' : 'Play preview'}
            >
              {isPreviewLoading ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : isPlayingPreview ? (
                <Pause size={18} aria-hidden="true" />
              ) : (
                <Play size={18} aria-hidden="true" />
              )}
            </button>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <div style={{
                position: 'relative',
                height: '6px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-bg-elevated-1)'
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: `${progressPercent}%`,
                  background: 'linear-gradient(90deg, var(--color-brand-secondary), var(--color-brand-primary))',
                  borderRadius: 'var(--radius-full)',
                  transition: 'width var(--duration-fast) var(--ease-out)'
                }} />
              </div>
              <input
                type="range"
                data-testid="scrub-slider"
                aria-label="Seek preview position"
                min={0}
                max={100}
                value={Math.floor(progressPercent)}
                onChange={(event) => handleScrub(Number(event.target.value))}
                disabled={!previewUrl}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>
            <span
              data-testid="preview-timer"
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-tertiary)',
                minWidth: '68px',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {formatSeconds(totalPreviewSeconds * progress)} / {formatSeconds(totalPreviewSeconds)}
            </span>
          </div>
          {isPreviewLoading && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
              Fetching preview from connected services…
            </span>
          )}
          {previewError && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)' }}>{previewError}</span>
          )}
        </div>
      ) : (
        <p style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-tertiary)',
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
