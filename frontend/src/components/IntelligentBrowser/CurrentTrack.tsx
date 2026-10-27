/**
 * CurrentTrack Component
 * Displays the currently loaded track with BPM, Key, Energy, and Duration.
 */

import React from 'react';
import { AudioWaveform } from 'lucide-react';
import type { Track } from './types';
import { Bpm, KeyBadge, SN } from '../../lib/songnodes';
import { EmptyPanel, TrackEnergy } from '../ds';
import styles from './IntelligentBrowser.module.css';

interface CurrentTrackProps {
  track: Track | null;
}

export const CurrentTrack: React.FC<CurrentTrackProps> = ({ track }) => {
  if (!track) {
    return (
      <EmptyPanel compact icon={AudioWaveform} title="Nothing playing yet">
        Pick a track in the graph to see what to play next.
      </EmptyPanel>
    );
  }

  const seconds = track.duration != null && track.duration > 0 ? track.duration : null;

  return (
    <section className={styles.current} aria-label="Now playing">
      <div className={styles.currentHead}>
        <div>
          <h3 className={`sn-title title-s ${styles.currentName}`}>{track.name}</h3>
          <p className={styles.currentArtist}>{track.artist}</p>
        </div>
        <span className="sn-tag">Now playing</span>
      </div>

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>BPM</span>
          <Bpm value={track.bpm} />
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Key</span>
          <KeyBadge value={track.key} />
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Energy</span>
          <TrackEnergy energy={track.energy} scale={(track as { energy_scale?: string }).energy_scale} />
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Length</span>
          {seconds != null ? (
            <span className={styles.metricValue}>{SN.format.duration(seconds)}</span>
          ) : (
            <span className="sn-none" title="Length not set">–</span>
          )}
        </div>
      </div>
    </section>
  );
};
