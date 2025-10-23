/**
 * CurrentTrack Component
 * Display currently playing track with metadata
 */

import React from 'react';
import type { Track } from './types';
import { formatDuration } from './utils';
import styles from './IntelligentBrowser.module.css';

interface CurrentTrackProps {
  track: Track | null;
}

export const CurrentTrack: React.FC<CurrentTrackProps> = ({ track }) => {
  if (!track) {
    return (
      <div className={styles.currentTrackEmpty} role="status">
        <p className={styles.emptyMessage}>
          Load a track to see intelligent recommendations
        </p>
      </div>
    );
  }

  return (
    <div className={styles.currentTrack} role="status" aria-label="Currently playing">
      {/* Header */}
      <div className={styles.currentTrackHeader}>
        <div className={styles.currentTrackTitle}>
          <h3 className={styles.trackName}>{track.name}</h3>
          <p className={styles.trackArtist}>{track.artist}</p>
        </div>
        <span className={styles.activeIndicator} aria-label="Co-Pilot Active">
          Co-Pilot Active
        </span>
      </div>

      {/* Metrics Grid */}
      <div className={styles.metricsGrid}>
        {/* BPM */}
        <div className={styles.metric}>
          <span className={styles.metricLabel}>BPM</span>
          <span className={styles.metricValue} style={{ color: '#4A90E2' }}>
            {track.bpm || '---'}
          </span>
        </div>

        {/* Key */}
        <div className={styles.metric}>
          <span className={styles.metricLabel}>KEY</span>
          <span className={styles.metricValue} style={{ color: '#7ED321' }}>
            {track.key || '---'}
          </span>
        </div>

        {/* Energy */}
        <div className={styles.metric}>
          <span className={styles.metricLabel}>ENERGY</span>
          {track.energy !== undefined ? (
            <div className={styles.energyBars} aria-label={`Energy level ${track.energy} out of 10`}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={styles.energyBar}
                  style={{
                    backgroundColor: i < Math.ceil(track.energy! / 2) ? '#7ED321' : 'rgba(255,255,255,0.1)'
                  }}
                />
              ))}
            </div>
          ) : (
            <span className={styles.metricValue}>---</span>
          )}
        </div>

        {/* Duration */}
        <div className={styles.metric}>
          <span className={styles.metricLabel}>TIME</span>
          <span className={styles.metricValue}>
            {formatDuration(track.duration)}
          </span>
        </div>
      </div>

      {/* Screen reader summary */}
      <div className="sr-only">
        Now playing: {track.name} by {track.artist}.
        {track.bpm && ` ${track.bpm} BPM.`}
        {track.key && ` Key: ${track.key}.`}
        {track.energy && ` Energy level: ${track.energy} out of 10.`}
      </div>
    </div>
  );
};
