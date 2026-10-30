import React, { useState, useEffect } from 'react';
import { SnIcon } from '../../../lib/songnodes';
import { LibraryTrack } from '../data';
import { useUnifiedTracks } from '../../../hooks/useUnifiedTracks';

interface Props {
  track: LibraryTrack;
}

export const TargetActionButton: React.FC<Props> = ({ track }) => {
  const { targetTracks, setTrackAsTarget } = useUnifiedTracks();
  const [status, setStatus] = useState<'idle' | 'adding' | 'added' | 'error'>('idle');
  const [announcement, setAnnouncement] = useState('');

  // Detect existing targets by id, then by normalised artist + title
  const isTarget = targetTracks.some(
    (t) => t.id === track.id ||
           (t.artist.toLowerCase() === track.a.toLowerCase() && t.title.toLowerCase() === track.t.toLowerCase())
  );

  useEffect(() => {
    if (isTarget) {
      setStatus('added');
    } else {
      setStatus('idle');
    }
  }, [isTarget]);

  const name = `${track.a} – ${track.t}`;

  const handleClick = async () => {
    if (status === 'added' || status === 'adding') return;

    setStatus('adding');
    setAnnouncement(`Adding ${name} to target tracks`);

    try {
      setTrackAsTarget(track.id, 'medium');

      const searchTerms = [track.a, track.t, track.m].filter(Boolean) as string[];

      let res;
      let syncFailed = false;
      try {
        res = await fetch('/api/v1/target-tracks', {
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
        });
        if (!res || !res.ok) syncFailed = true;
      } catch (fetchErr) {
        syncFailed = true;
      }

      if (syncFailed) {
        setStatus('added');
        setAnnouncement(`saved locally, will sync`);
      } else {
        setStatus('added');
        setAnnouncement(`Added ${name} to target tracks`);
      }
    } catch (err) {
      setStatus('error');
      setAnnouncement(`Failed to add ${name} to target tracks`);
    }
  };

  return (
    <>
      <span className="sn-sr" aria-live="polite">{announcement}</span>
      {status === 'added' ? (
        <span className="sn-btn sn-btn--quiet sn-btn--sm sn-btn--icon" title="In target tracks" role="img" aria-label="In target tracks">
          <SnIcon name="check" />
        </span>
      ) : status === 'error' ? (
        <button
          className="sn-btn sn-btn--quiet sn-btn--sm sn-btn--icon"
          type="button"
          aria-label={`Retry adding ${name} to target tracks`}
          title={`Retry adding ${name} to target tracks`}
          onClick={handleClick}
        >
          <SnIcon name="refresh-cw" />
        </button>
      ) : (
        <button
          className="sn-btn sn-btn--quiet sn-btn--sm sn-btn--icon"
          type="button"
          aria-label={`Add ${name} to target tracks`}
          title={`Add ${name} to target tracks`}
          onClick={handleClick}
          aria-busy={status === 'adding' ? true : undefined}
        >
          <SnIcon name="star" />
        </button>
      )}
    </>
  );
};
