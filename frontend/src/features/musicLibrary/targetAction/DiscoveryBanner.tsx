import React, { useState } from 'react';
import { Banner } from '../components/ui';
import { LibraryTrack } from '../data';
import { useUnifiedTracks } from '../../../hooks/useUnifiedTracks';
import { SN } from '../../../lib/songnodes';

interface DiscoveryBannerProps {
  tracks: LibraryTrack[];
}

export const DiscoveryBanner: React.FC<DiscoveryBannerProps> = ({ tracks }) => {
  const { targetTracks, setTrackAsTarget } = useUnifiedTracks();
  const [dismissed, setDismissed] = useState(false);

  // Find tracks in the current view that lack BPM/key
  const unenrichedTracks = tracks.filter((t) => !t.bpm || !t.k);

  if (dismissed || unenrichedTracks.length === 0) {
    return null;
  }

  // Filter out tracks that are already targeted
  const unTargetedTracks = unenrichedTracks.filter((track) => {
    return !targetTracks.some(
      (t) => t.id === track.id ||
             (t.artist.toLowerCase() === track.a.toLowerCase() && t.title.toLowerCase() === track.t.toLowerCase())
    );
  });

  if (unTargetedTracks.length === 0) {
    return null;
  }

  const handleTargetBatch = () => {
    const tracksToTarget = unTargetedTracks.slice(0, 5);
    tracksToTarget.forEach(track => {
      setTrackAsTarget(track.id, 'medium');

      const searchTerms = [track.a, track.t, track.m].filter(Boolean);

      // Fire off API request (optimistic, following TargetActionButton pattern)
      fetch('/api/v1/target-tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: track.t,
          artist: track.a,
          priority: 'medium',
          is_active: true,
          search_terms: searchTerms,
          genres: track.g ? [track.g] : undefined
        })
      }).catch(() => {
        // Silently fail for individual background saves like TargetActionButton does
      });
    });
  };

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <Banner
        status="info"
        title="Enrichment opportunity"
        dismissLabel="Dismiss enrichment banner"
        onDismiss={() => setDismissed(true)}
      >
        <span style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
          {SN.format.count(unTargetedTracks.length)} {unTargetedTracks.length === 1 ? 'track' : 'tracks'} in this view {unTargetedTracks.length === 1 ? 'lacks' : 'lack'} BPM, key, or graph adjacencies and {unTargetedTracks.length === 1 ? 'is' : 'are'} not yet targeted.
        </span>
        <button
          type="button"
          className="sn-btn sn-btn--sm"
          onClick={handleTargetBatch}
        >
          Target top un-enriched
        </button>
      </Banner>
    </div>
  );
};
