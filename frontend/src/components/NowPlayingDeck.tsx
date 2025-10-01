import React, { useEffect, useState, useRef } from 'react';
import { EnergyMeter } from './EnergyMeter';
import { Track } from '../types/dj';

/**
 * NowPlayingDeck - Primary focus of DJ interface
 * Implements Nielsen's "Visibility of System Status" heuristic
 * Large, glanceable display for dark environments
 */

interface NowPlayingDeckProps {
  track: Track | null;
  onTrackSelect?: () => void;
}

// Visual waveform display for track structure awareness (static)
const WaveformDisplay: React.FC<{
  waveformData?: number[];
  height?: number;
}> = ({ waveformData = [], height = 60 }) => {
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

    data.forEach((value, i) => {
      const x = i * barWidth;
      const barHeight = value * canvas.height;
      const y = (canvas.height - barHeight) / 2;

      // Gradient color for visual appeal
      const gradient = ctx.createLinearGradient(x, 0, x, canvas.height);
      gradient.addColorStop(0, '#4A90E2');
      gradient.addColorStop(1, '#7ED321');
      ctx.fillStyle = gradient;

      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });
  }, [waveformData]);

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


export const NowPlayingDeck: React.FC<NowPlayingDeckProps> = ({
  track,
  onTrackSelect
}) => {

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
      gap: '12px',
      padding: '16px 20px',
      backgroundColor: 'rgba(0,0,0,0.9)',
      borderRadius: '12px',
      border: '2px solid rgba(255,255,255,0.2)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      height: '100%',
      maxHeight: '220px',
      overflow: 'hidden'
    }}>
      {/* Track Info Header - Single Line */}
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
          {track.bpm} BPM
        </span>
        <span style={{ color: '#8E8E93', fontSize: '16px', flexShrink: 0 }}>•</span>
        <span style={{
          color: '#7ED321',
          fontSize: '14px',
          fontWeight: 600,
          flexShrink: 0
        }}>
          {track.key}
        </span>
      </div>

      {/* Key Metrics Row - Compact and Horizontal */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px'
      }}>
        {/* BPM */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '8px 12px',
          backgroundColor: 'rgba(74,144,226,0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(74,144,226,0.3)'
        }}>
          <span style={{
            color: '#8E8E93',
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px'
          }}>
            BPM
          </span>
          <span style={{
            color: '#4A90E2',
            fontSize: '20px',
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
          padding: '8px 12px',
          backgroundColor: 'rgba(126,211,33,0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(126,211,33,0.3)'
        }}>
          <span style={{
            color: '#8E8E93',
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px'
          }}>
            KEY
          </span>
          <span style={{
            color: '#7ED321',
            fontSize: '20px',
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
          padding: '8px 12px',
          backgroundColor: 'rgba(255,107,53,0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(255,107,53,0.3)'
        }}>
          <span style={{
            color: '#8E8E93',
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px'
          }}>
            ENERGY
          </span>
          <EnergyMeter level={track.energy} size="small" />
        </div>

        {/* Duration */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '8px 12px',
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <span style={{
            color: '#8E8E93',
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px'
          }}>
            TIME
          </span>
          <span style={{
            color: '#FFFFFF',
            fontSize: '16px',
            fontWeight: 600
          }}>
            {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
          </span>
        </div>
      </div>
    </div>
  );
};

export default NowPlayingDeck;