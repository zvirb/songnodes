import React, { useEffect, useState, useRef } from 'react';
import { EnergyMeter } from './EnergyMeter';
import { HarmonicCompatibility } from './HarmonicCompatibility';
import { CamelotKey, Track } from '../types/dj';

/**
 * NowPlayingDeck - Primary focus of DJ interface
 * Implements Nielsen's "Visibility of System Status" heuristic
 * Large, glanceable display for dark environments
 */

interface NowPlayingDeckProps {
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTimeUpdate?: (time: number) => void;
  onTrackEnd?: () => void;
}

// Waveform visualization for track structure awareness
const WaveformDisplay: React.FC<{
  waveformData?: number[];
  progress: number;
  height?: number;
}> = ({ waveformData = [], progress, height = 60 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Generate sample waveform if no data
    const data = waveformData.length > 0 ? waveformData :
      Array.from({ length: 100 }, () => Math.random() * 0.8 + 0.2);

    const barWidth = canvas.width / data.length;
    const progressX = progress * canvas.width;

    data.forEach((value, i) => {
      const x = i * barWidth;
      const barHeight = value * canvas.height;
      const y = (canvas.height - barHeight) / 2;

      // Color based on position relative to progress
      if (x < progressX) {
        ctx.fillStyle = '#7ED321'; // Played portion - green
      } else {
        ctx.fillStyle = '#4A90E2'; // Unplayed portion - blue
      }

      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });

    // Draw progress line
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(progressX, 0);
    ctx.lineTo(progressX, canvas.height);
    ctx.stroke();
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

// Time formatting helper
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const NowPlayingDeck: React.FC<NowPlayingDeckProps> = ({
  track,
  isPlaying,
  currentTime,
  duration,
  onTimeUpdate,
  onTrackEnd
}) => {
  const [timeRemaining, setTimeRemaining] = useState(duration - currentTime);
  const progress = duration > 0 ? currentTime / duration : 0;

  useEffect(() => {
    setTimeRemaining(duration - currentTime);
    if (currentTime >= duration && duration > 0) {
      onTrackEnd?.();
    }
  }, [currentTime, duration, onTrackEnd]);

  // Simulate playback for demo
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      onTimeUpdate?.(currentTime + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, currentTime, onTimeUpdate]);

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
          No Track Loaded
        </p>
        <p style={{
          color: '#8E8E93',
          fontSize: '14px',
          marginTop: '8px'
        }}>
          Load a track to begin mixing
        </p>
      </div>
    );
  }

  return (
    <div className="now-playing-deck" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      padding: '24px',
      backgroundColor: 'rgba(0,0,0,0.9)',
      borderRadius: '12px',
      border: '2px solid rgba(255,255,255,0.2)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
    }}>
      {/* Track Info Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
      }}>
        <div>
          <h2 style={{
            color: '#FFFFFF',
            fontSize: '24px',
            margin: 0,
            fontWeight: 700,
            letterSpacing: '-0.5px'
          }}>
            {track.name}
          </h2>
          <p style={{
            color: '#8E8E93',
            fontSize: '16px',
            margin: '4px 0 0 0'
          }}>
            {track.artist}
          </p>
        </div>

        <div style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'center'
        }}>
          {/* Playing Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: isPlaying ? '#7ED321' : '#F5A623',
            borderRadius: '20px'
          }}>
            <span style={{
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600
            }}>
              {isPlaying ? '▶ PLAYING' : '⏸ PAUSED'}
            </span>
          </div>
        </div>
      </div>

      {/* Key Metrics Row - Large and Glanceable */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '20px'
      }}>
        {/* BPM */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '16px',
          backgroundColor: 'rgba(74,144,226,0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(74,144,226,0.3)'
        }}>
          <span style={{
            color: '#8E8E93',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '8px'
          }}>
            BPM
          </span>
          <span style={{
            color: '#4A90E2',
            fontSize: '36px',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums'
          }}>
            {track.bpm}
          </span>
        </div>

        {/* Key */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '16px',
          backgroundColor: 'rgba(126,211,33,0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(126,211,33,0.3)'
        }}>
          <span style={{
            color: '#8E8E93',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '8px'
          }}>
            KEY
          </span>
          <span style={{
            color: '#7ED321',
            fontSize: '36px',
            fontWeight: 700
          }}>
            {track.key}
          </span>
        </div>

        {/* Energy */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '16px',
          backgroundColor: 'rgba(255,107,53,0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(255,107,53,0.3)'
        }}>
          <span style={{
            color: '#8E8E93',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '12px'
          }}>
            ENERGY
          </span>
          <EnergyMeter level={track.energy} size="medium" />
        </div>
      </div>

      {/* Waveform Display */}
      <div>
        <WaveformDisplay
          waveformData={track.waveform}
          progress={progress}
          height={80}
        />
      </div>

      {/* Progress Bar and Time */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{
            color: '#8E8E93',
            fontSize: '14px',
            fontVariantNumeric: 'tabular-nums'
          }}>
            {formatTime(currentTime)}
          </span>
          <span style={{
            color: timeRemaining < 30 ? '#F5A623' : '#8E8E93',
            fontSize: '14px',
            fontWeight: timeRemaining < 30 ? 600 : 400,
            fontVariantNumeric: 'tabular-nums'
          }}>
            -{formatTime(timeRemaining)}
          </span>
        </div>

        {/* Progress Bar */}
        <div style={{
          height: '8px',
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${progress * 100}%`,
            backgroundColor: timeRemaining < 30 ? '#F5A623' : '#7ED321',
            transition: 'width 0.5s linear',
            boxShadow: `0 0 10px ${timeRemaining < 30 ? '#F5A623' : '#7ED321'}80`
          }} />
        </div>

        {/* Warning when track is ending */}
        {timeRemaining < 30 && timeRemaining > 0 && (
          <div style={{
            padding: '8px',
            backgroundColor: 'rgba(245,166,35,0.2)',
            border: '1px solid #F5A623',
            borderRadius: '4px',
            textAlign: 'center',
            animation: 'pulse 1s infinite'
          }}>
            <span style={{
              color: '#F5A623',
              fontSize: '14px',
              fontWeight: 600
            }}>
              ⚠ Track ending soon - Select next track
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default NowPlayingDeck;