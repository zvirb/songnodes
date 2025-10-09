/**
 * Data Quality Review Component
 *
 * Human-in-the-loop interface for validating low-confidence enrichment data.
 * Implements 2025 best practices for data quality management.
 *
 * Features:
 * - Multi-tier confidence filtering (high/medium/low)
 * - Setlist context view (surrounding tracks)
 * - Approve/reject/skip actions
 * - Bulk review workflow
 * - Real-time statistics dashboard
 */

import React, { useState, useEffect, useCallback } from 'react';
import './DataQualityReview.css';

// Types
interface SetlistContext {
  playlist_id: string;
  playlist_name: string;
  track_position: number;
  total_tracks: number;
  previous_tracks?: TrackSummary[];
  next_tracks?: TrackSummary[];
  dj_name?: string;
  event_date?: string;
}

interface TrackSummary {
  title: string;
  artists: string;
  bpm?: number;
  key?: string;
  energy?: number;
  genre?: string;
}

interface TrackReviewItem {
  track_id: string;
  title: string;
  artist_name?: string;

  // Original scraped data
  scraped_genre?: string;
  scraped_artist?: string;
  scraped_title?: string;

  // Enrichment suggestions
  suggested_genre?: string;
  suggested_artist?: string;
  genre_confidence?: 'high' | 'medium' | 'low';
  genre_match_score?: number;

  // Metadata quality
  has_spotify_id: boolean;
  has_musicbrainz_id: boolean;
  has_isrc: boolean;
  enrichment_sources: string[];

  // Setlist context
  setlist_contexts: SetlistContext[];

  // Review metadata
  created_at: string;
  last_scraped?: string;
  review_count: number;
  last_reviewed_at?: string;
}

interface ReviewStats {
  total_needs_review: number;
  by_confidence: Record<string, number>;
  by_issue_type: Record<string, number>;
  reviewed_today: number;
  approved_today: number;
  rejected_today: number;
}

type ConfidenceLevel = 'high' | 'medium' | 'low' | 'all';
type IssueType = 'missing_genre' | 'low_confidence' | 'unknown_artist' | 'all';

export const DataQualityReview: React.FC = () => {
  const [tracks, setTracks] = useState<TrackReviewItem[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showContext, setShowContext] = useState(false);

  // Filters
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceLevel>('all');
  const [issueTypeFilter, setIssueTypeFilter] = useState<IssueType>('all');

  // Load tracks needing review
  const loadTracks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (confidenceFilter !== 'all') params.append('confidence_level', confidenceFilter);
      if (issueTypeFilter !== 'all') params.append('issue_type', issueTypeFilter);
      params.append('limit', '50');

      const response = await fetch(`/api/data-quality/tracks/needs-review?${params}`);
      const data = await response.json();
      setTracks(data);
      setCurrentTrackIndex(0);
    } catch (error) {
      console.error('Failed to load tracks:', error);
    } finally {
      setLoading(false);
    }
  }, [confidenceFilter, issueTypeFilter]);

  // Load statistics
  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/data-quality/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadTracks();
    loadStats();
  }, [loadTracks, loadStats]);

  // Handle approve/reject/skip
  const handleAction = async (action: 'approve' | 'reject' | 'skip', field: string, value?: string) => {
    const currentTrack = tracks[currentTrackIndex];
    if (!currentTrack) return;

    try {
      await fetch('/api/data-quality/tracks/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track_id: currentTrack.track_id,
          field,
          action,
          approved_value: value,
        }),
      });

      // Move to next track
      if (currentTrackIndex < tracks.length - 1) {
        setCurrentTrackIndex(currentTrackIndex + 1);
      } else {
        // Reload tracks when we reach the end
        loadTracks();
      }

      // Refresh stats
      loadStats();
    } catch (error) {
      console.error('Failed to submit action:', error);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const currentTrack = tracks[currentTrackIndex];
      if (!currentTrack) return;

      switch (e.key) {
        case 'a':
        case 'A':
          // Approve suggestion
          if (currentTrack.suggested_genre) {
            handleAction('approve', 'genre', currentTrack.suggested_genre);
          }
          break;
        case 'r':
        case 'R':
          // Reject suggestion
          if (currentTrack.suggested_genre) {
            handleAction('reject', 'genre', currentTrack.suggested_genre);
          }
          break;
        case 's':
        case 'S':
        case ' ':
          // Skip
          e.preventDefault();
          handleAction('skip', 'genre');
          break;
        case 'c':
        case 'C':
          // Toggle context
          setShowContext(!showContext);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [tracks, currentTrackIndex, showContext, handleAction]);

  const currentTrack = tracks[currentTrackIndex];

  if (loading && tracks.length === 0) {
    return (
      <div className="data-quality-review loading">
        <div className="spinner"></div>
        <p>Loading tracks needing review...</p>
      </div>
    );
  }

  if (!currentTrack) {
    return (
      <div className="data-quality-review empty">
        <div className="empty-state">
          <h2>🎉 All Caught Up!</h2>
          <p>No tracks currently need review.</p>
          <button onClick={loadTracks}>Refresh</button>
        </div>
      </div>
    );
  }

  return (
    <div className="data-quality-review">
      {/* Statistics Dashboard */}
      {stats && (
        <div className="stats-header">
          <div className="stat-card">
            <div className="stat-value">{stats.total_needs_review}</div>
            <div className="stat-label">Need Review</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.by_confidence.low || 0}</div>
            <div className="stat-label">Low Confidence</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.by_confidence.medium || 0}</div>
            <div className="stat-label">Medium Confidence</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.reviewed_today}</div>
            <div className="stat-label">Reviewed Today</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.approved_today}</div>
            <div className="stat-label success">Approved Today</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <label>Confidence Level:</label>
          <select
            value={confidenceFilter}
            onChange={(e) => setConfidenceFilter(e.target.value as ConfidenceLevel)}
          >
            <option value="all">All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Issue Type:</label>
          <select
            value={issueTypeFilter}
            onChange={(e) => setIssueTypeFilter(e.target.value as IssueType)}
          >
            <option value="all">All</option>
            <option value="missing_genre">Missing Genre</option>
            <option value="low_confidence">Low Confidence</option>
            <option value="unknown_artist">Unknown Artist</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Progress:</label>
          <span className="progress-indicator">
            {currentTrackIndex + 1} / {tracks.length}
          </span>
        </div>
      </div>

      {/* Main Review Card */}
      <div className="review-card">
        <div className="track-header">
          <div className="track-info">
            <h2 className="track-title">{currentTrack.title}</h2>
            <p className="track-artist">{currentTrack.artist_name || 'Unknown Artist'}</p>
          </div>

          <div className="quality-indicators">
            {currentTrack.has_spotify_id && (
              <span className="indicator spotify" title="Has Spotify ID">
                <span className="icon">🎵</span> Spotify
              </span>
            )}
            {currentTrack.has_musicbrainz_id && (
              <span className="indicator mb" title="Has MusicBrainz ID">
                <span className="icon">🎼</span> MB
              </span>
            )}
            {currentTrack.has_isrc && (
              <span className="indicator isrc" title="Has ISRC">
                <span className="icon">🔢</span> ISRC
              </span>
            )}
          </div>
        </div>

        {/* Genre Review Section */}
        {currentTrack.suggested_genre && (
          <div className="review-section genre-review">
            <h3>Genre Suggestion</h3>

            <div className="comparison">
              <div className="original">
                <label>Original:</label>
                <div className="value">{currentTrack.scraped_genre || 'None'}</div>
              </div>

              <div className="arrow">→</div>

              <div className="suggested">
                <label>Suggested:</label>
                <div className="value suggested-value">{currentTrack.suggested_genre}</div>
              </div>
            </div>

            <div className="confidence-info">
              <span className={`confidence-badge ${currentTrack.genre_confidence}`}>
                {currentTrack.genre_confidence?.toUpperCase()} CONFIDENCE
              </span>
              {currentTrack.genre_match_score && (
                <span className="match-score">
                  Match Score: {currentTrack.genre_match_score.toFixed(1)}%
                </span>
              )}
            </div>

            <div className="enrichment-sources">
              <label>Sources:</label>
              {currentTrack.enrichment_sources.map((source) => (
                <span key={source} className="source-badge">
                  {source}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="action-buttons">
          <button
            className="action-btn approve"
            onClick={() => handleAction('approve', 'genre', currentTrack.suggested_genre)}
            disabled={!currentTrack.suggested_genre}
            title="Keyboard: A"
          >
            ✓ Approve
          </button>

          <button
            className="action-btn reject"
            onClick={() => handleAction('reject', 'genre', currentTrack.suggested_genre)}
            disabled={!currentTrack.suggested_genre}
            title="Keyboard: R"
          >
            ✗ Reject
          </button>

          <button
            className="action-btn skip"
            onClick={() => handleAction('skip', 'genre')}
            title="Keyboard: S or Space"
          >
            → Skip
          </button>

          <button
            className="action-btn context"
            onClick={() => setShowContext(!showContext)}
            title="Keyboard: C"
          >
            {showContext ? '▼' : '▶'} Context ({currentTrack.setlist_contexts.length})
          </button>
        </div>

        {/* Setlist Context */}
        {showContext && currentTrack.setlist_contexts.length > 0 && (
          <div className="setlist-context">
            <h3>Setlist Context</h3>
            {currentTrack.setlist_contexts.map((context) => (
              <div key={context.playlist_id} className="context-card">
                <div className="context-header">
                  <h4>{context.playlist_name}</h4>
                  <span className="position-indicator">
                    Track {context.track_position} of {context.total_tracks}
                  </span>
                </div>

                {context.dj_name && (
                  <div className="context-meta">
                    <span className="dj-name">DJ: {context.dj_name}</span>
                    {context.event_date && (
                      <span className="event-date">{context.event_date}</span>
                    )}
                  </div>
                )}

                {/* Previous Tracks */}
                {context.previous_tracks && context.previous_tracks.length > 0 && (
                  <div className="context-tracks previous">
                    <label>Previous tracks:</label>
                    <div className="track-list">
                      {context.previous_tracks.map((track, idx) => (
                        <div key={idx} className="context-track">
                          <span className="track-info">
                            {track.title} - {track.artists}
                          </span>
                          {track.genre && <span className="genre-tag">{track.genre}</span>}
                          {track.bpm && <span className="bpm-tag">{track.bpm} BPM</span>}
                          {track.key && <span className="key-tag">{track.key}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Current Track Indicator */}
                <div className="current-track-indicator">
                  <span>→ Current Track ←</span>
                </div>

                {/* Next Tracks */}
                {context.next_tracks && context.next_tracks.length > 0 && (
                  <div className="context-tracks next">
                    <label>Next tracks:</label>
                    <div className="track-list">
                      {context.next_tracks.map((track, idx) => (
                        <div key={idx} className="context-track">
                          <span className="track-info">
                            {track.title} - {track.artists}
                          </span>
                          {track.genre && <span className="genre-tag">{track.genre}</span>}
                          {track.bpm && <span className="bpm-tag">{track.bpm} BPM</span>}
                          {track.key && <span className="key-tag">{track.key}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="keyboard-shortcuts">
        <h4>Keyboard Shortcuts:</h4>
        <div className="shortcuts-grid">
          <div className="shortcut">
            <kbd>A</kbd> <span>Approve</span>
          </div>
          <div className="shortcut">
            <kbd>R</kbd> <span>Reject</span>
          </div>
          <div className="shortcut">
            <kbd>S</kbd> / <kbd>Space</kbd> <span>Skip</span>
          </div>
          <div className="shortcut">
            <kbd>C</kbd> <span>Toggle Context</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataQualityReview;
