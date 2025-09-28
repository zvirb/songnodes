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
          {/* Current Track Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: '#7ED321',
            borderRadius: '20px'
          }}>
            <span style={{
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600
            }}>
              🎯 CURRENTLY SELECTED
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
          height={80}
        />
      </div>

      {/* Track Metadata */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{
            color: '#8E8E93',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            Genre
          </span>
          <span style={{
            color: '#FFFFFF',
            fontSize: '14px',
            fontWeight: 600
          }}>
            {track.genre || 'Electronic'}
          </span>
        </div>
        {track.duration && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{
              color: '#8E8E93',
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Duration
            </span>
            <span style={{
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600
            }}>
              {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
            </span>
          </div>
        )}
        <div style={{
          marginTop: '8px',
          padding: '12px',
          backgroundColor: 'rgba(126,211,33,0.1)',
          border: '1px solid rgba(126,211,33,0.3)',
          borderRadius: '6px',
          textAlign: 'center'
        }}>
          <span style={{
            color: '#7ED321',
            fontSize: '13px',
            fontWeight: 600
          }}>
            💡 Tip: Check the recommendations below for harmonically compatible tracks
          </span>
        </div>
      </div>
    </div>
  );
};

export default NowPlayingDeck;