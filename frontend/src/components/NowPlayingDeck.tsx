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
      gradient.addColorStop(0, '#4A90E2');
      gradient.addColorStop(1, '#7ED321');
      ctx.fillStyle = gradient;

      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });

    if (progress > 0) {
      const clampedProgress = Math.max(0, Math.min(progress, 1));
      const progressX = canvas.width * clampedProgress;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(0, 0, progressX, canvas.height);

      ctx.fillStyle = '#7ED321';
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
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: '4px',
        border: '1px solid rgba(255,255,255,0.2)'
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
  const energyPercent = track?.energy !== undefined ? Math.round(track.energy * 100) : null;
  const valencePercent = track?.valence !== undefined ? Math.round(track.valence * 100) : null;

  if (!track) {
    return (
      <div className="now-playing-deck-empty" style={{
        padding: '40px',
        backgroundColor: 'rgba(0,0,0,0.9)',
        borderRadius: '12px',
        border: '2px solid rgba(255,255,255,0.1)',
        textAlign: 'center'
      }}>
        <p style={{
          color: '#8E8E93',
          fontSize: '18px',
          margin: 0
        }}>
          No Track Selected
        </p>
        <p style={{
          color: '#8E8E93',
          fontSize: '14px',
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
      backgroundColor: 'rgba(0,0,0,0.9)',
      borderRadius: '12px',
      border: '2px solid rgba(255,255,255,0.2)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
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
          color: '#FFFFFF',
          fontSize: '18px',
          fontWeight: 700,
          letterSpacing: '-0.5px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flexShrink: 1
        }}>
          {track.name}
        </span>
        <span style={{ color: '#8E8E93', fontSize: '16px', flexShrink: 0 }}>•</span>
        <span style={{
          color: '#8E8E93',
          fontSize: '14px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flexShrink: 1
        }}>
          {track.artist}
        </span>
        <span style={{ color: '#8E8E93', fontSize: '16px', flexShrink: 0 }}>•</span>
        <span style={{
          color: '#4A90E2',
          fontSize: '14px',
          fontWeight: 600,
          flexShrink: 0
        }}>
          {track.bpm ?? '—'} BPM
        </span>
        <span style={{ color: '#8E8E93', fontSize: '16px', flexShrink: 0 }}>•</span>
        <span style={{
          color: '#7ED321',
          fontSize: '14px',
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
          backgroundColor: 'rgba(74,144,226,0.08)',
          borderRadius: '8px',
          border: '1px solid rgba(74,144,226,0.25)'
        }}>
          <span style={{
            color: '#8E8E93',
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px'
          }}>
            Energy
          </span>
          <span style={{
            color: '#7ED321',
            fontSize: '20px',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums'
          }}>
            {energyPercent !== null ? `${energyPercent}` : '—'}
          </span>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '8px 12px',
          backgroundColor: 'rgba(126,211,33,0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(126,211,33,0.28)'
        }}>
          <span style={{
            color: '#8E8E93',
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px'
          }}>
            Valence
          </span>
          <span style={{
            color: '#FFFFFF',
            fontSize: '20px',
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
          backgroundColor: 'rgba(148,163,184,0.12)',
          borderRadius: '8px',
          border: '1px solid rgba(148,163,184,0.28)'
        }}>
          <span style={{
            color: '#8E8E93',
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px'
          }}>
            Genre
          </span>
          <span style={{
            color: '#FFFFFF',
            fontSize: '14px',
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
          backgroundColor: 'rgba(59,130,246,0.12)',
          borderRadius: '8px',
          border: '1px solid rgba(59,130,246,0.28)'
        }}>
          <span style={{
            color: '#8E8E93',
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px'
          }}>
            Length
          </span>
          <span style={{
            color: '#FFFFFF',
            fontSize: '20px',
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
                border: '1px solid rgba(255,255,255,0.2)',
                backgroundColor: 'rgba(255,255,255,0.05)',
                color: '#FFFFFF',
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
                backgroundColor: 'rgba(255,255,255,0.08)'
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: `${progressPercent}%`,
                  background: 'linear-gradient(90deg, #4A90E2, #7ED321)',
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
              fontSize: '12px',
              color: '#8E8E93',
              minWidth: '68px',
              textAlign: 'right'
            }}>
              {formatSeconds(totalPreviewSeconds * progress)} / {formatSeconds(totalPreviewSeconds)}
            </span>
          </div>
          {isPreviewLoading && (
            <span style={{ fontSize: '11px', color: '#8E8E93' }}>
              Fetching preview from connected services…
            </span>
          )}
          {previewError && (
            <span style={{ fontSize: '11px', color: '#EF4444' }}>{previewError}</span>
          )}
        </div>
      ) : (
        <p style={{
          fontSize: '12px',
          color: '#8E8E93',
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
