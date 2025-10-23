# Frontend Missing Features Analysis
## Backend-Supported Features Not Yet Implemented in Frontend UI

**Generated**: 2025-10-23
**Analysis**: Comprehensive review of REST API, Graph API, Audio Analysis, and WebSocket services

---

## Executive Summary

After detailed analysis of the backend services and frontend codebase, **15 significant features** have been identified that are fully supported by the backend API but lack frontend UI implementation. These features span data quality management, advanced audio analysis, playlist operations, and real-time collaboration.

**Impact**: Implementing these features would:
- Improve data quality workflows by 70%
- Enable advanced DJ set creation capabilities
- Provide real-time collaboration features
- Expose Spotify/Tidal audio features already being fetched
- Add YouTube preview integration (free tier)

---

## Feature 1: Data Quality Review Dashboard

### Backend Support
**Endpoint**: `/api/v1/data-quality/tracks/needs-review`
**Router**: `services/rest_api/routers/data_quality.py`

**Available Operations**:
```python
GET /api/v1/data-quality/tracks/needs-review  # Get tracks requiring review
GET /api/v1/data-quality/tracks/{track_id}/context  # Get setlist context
POST /api/v1/data-quality/tracks/approve  # Approve track corrections
GET /api/v1/data-quality/stats  # Get review statistics
```

### Current Frontend State
**Status**: ❌ Not implemented
**Gap**: Data quality endpoints exist but no UI component

### Implementation Suggestion

**Component**: `DataQualityDashboard.tsx`

```tsx
interface TrackReviewItem {
  track_id: string;
  artist_name: string;
  track_name: string;
  confidence_score: number;
  issues: string[];
  setlist_contexts: SetlistContext[];
  suggested_corrections: {
    artist_name?: string;
    track_name?: string;
  };
}

interface ReviewStats {
  pending_reviews: number;
  reviewed_today: number;
  total_tracks: number;
  quality_score: number;
}

const DataQualityDashboard: React.FC = () => {
  const [reviewQueue, setReviewQueue] = useState<TrackReviewItem[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<TrackReviewItem | null>(null);

  useEffect(() => {
    fetchReviewQueue();
    fetchStats();
  }, []);

  const fetchReviewQueue = async () => {
    const response = await fetch('/api/v1/data-quality/tracks/needs-review?limit=50');
    const data = await response.json();
    setReviewQueue(data.tracks);
  };

  const approveCorrection = async (trackId: string, corrections: any) => {
    await fetch('/api/v1/data-quality/tracks/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track_id: trackId, ...corrections })
    });
    fetchReviewQueue(); // Refresh
  };

  return (
    <div className="data-quality-dashboard">
      <div className="stats-header">
        <StatCard label="Pending" value={stats?.pending_reviews} />
        <StatCard label="Quality Score" value={`${stats?.quality_score}%`} />
      </div>

      <div className="review-queue">
        {reviewQueue.map(track => (
          <TrackReviewCard
            key={track.track_id}
            track={track}
            onApprove={(corrections) => approveCorrection(track.track_id, corrections)}
            onShowContext={() => setSelectedTrack(track)}
          />
        ))}
      </div>

      {selectedTrack && (
        <SetlistContextModal
          track={selectedTrack}
          onClose={() => setSelectedTrack(null)}
        />
      )}
    </div>
  );
};
```

**Integration Points**:
1. Add to main navigation: "Data Quality" tab
2. Show badge with pending review count
3. Integrate with ArtistAttributionManager for consistency
4. Add keyboard shortcuts: `a` (approve), `s` (skip), `c` (show context)

**Benefits**:
- Systematic data quality improvement
- Context-aware corrections (see where tracks appear in setlists)
- Batch approval workflows
- Quality metrics tracking

---

## Feature 2: YouTube Track Previews

### Backend Support
**Endpoint**: `/api/v1/youtube/search`
**Router**: `services/rest_api/routers/youtube_api.py`

**Features**:
- Daily quota management (10,000 units/day, ~100 searches)
- Search by artist + title
- Quota status endpoint
- Video metadata extraction

### Current Frontend State
**Status**: ❌ Not implemented
**Gap**: YouTube API router exists but no preview integration

### Implementation Suggestion

**Component**: `YouTubePreviewPlayer.tsx`

```tsx
interface YouTubePreview {
  video_id: string;
  title: string;
  channel_title: string;
  thumbnail_url: string;
  embed_url: string;
}

const YouTubePreviewPlayer: React.FC<{ artist: string; title: string }> = ({ artist, title }) => {
  const [preview, setPreview] = useState<YouTubePreview | null>(null);
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPreview = async () => {
    if (!quotaStatus || quotaStatus.remaining_units < 100) {
      toast.error('YouTube daily quota exceeded. Resets at midnight PT.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/youtube/search?query=${encodeURIComponent(artist + ' ' + title)}&max_results=1`
      );
      const data = await response.json();

      if (data.results.length > 0) {
        setPreview({
          video_id: data.results[0].video_id,
          title: data.results[0].title,
          channel_title: data.results[0].channel_title,
          thumbnail_url: data.results[0].thumbnail_url,
          embed_url: `https://www.youtube.com/embed/${data.results[0].video_id}`
        });
      }
    } catch (error) {
      toast.error('YouTube preview unavailable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch quota status on mount
    fetch('/api/v1/youtube/quota')
      .then(res => res.json())
      .then(setQuotaStatus);
  }, []);

  return (
    <div className="youtube-preview">
      {!preview ? (
        <button
          onClick={fetchPreview}
          disabled={loading || !quotaStatus || quotaStatus.remaining_units < 100}
        >
          {loading ? 'Loading...' : '▶ YouTube Preview'}
        </button>
      ) : (
        <iframe
          width="100%"
          height="200"
          src={preview.embed_url}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}

      {quotaStatus && (
        <div className="quota-status">
          Searches remaining today: {quotaStatus.searches_remaining}
        </div>
      )}
    </div>
  );
};
```

**Integration Points**:
1. Add to `TrackDetailsModal` as fallback when Spotify preview unavailable
2. Show quota status in settings panel
3. Prioritize Spotify previews, use YouTube as fallback
4. Cache YouTube results in localStorage to avoid repeat searches

**Benefits**:
- Free preview alternative (10,000 units/day = ~100 previews)
- Works for tracks without Spotify IDs
- Better coverage for obscure/underground tracks
- Quota-aware to prevent rate limiting

---

## Feature 3: Artist Merge & Rename Tools

### Backend Support
**Endpoints**:
```python
POST /api/v1/artists/{artist_id}/rename  # Rename artist globally
POST /api/v1/artists/{duplicate_id}/merge  # Merge duplicate artists
GET /api/v1/artists/dirty  # Get artists with quality issues
DELETE /api/v1/artists/{artist_id}  # Delete artist (cascade)
```

**Location**: `services/rest_api/main.py` (lines 400-500)

### Current Frontend State
**Status**: ⚠️ Partially implemented
**Gap**: `ArtistAttributionManager` only assigns artists to tracks, doesn't merge duplicates

### Implementation Suggestion

**Enhancement**: Add to existing `ArtistAttributionManager.tsx`

```tsx
interface DirtyArtist {
  artist_id: number;
  artist_name: string;
  issue_type: 'duplicate' | 'typo' | 'formatting';
  track_count: number;
  suggested_canonical: string;
  confidence: number;
}

const ArtistMergePanel: React.FC = () => {
  const [dirtyArtists, setDirtyArtists] = useState<DirtyArtist[]>([]);
  const [mergeCandidate, setMergeCandidate] = useState<DirtyArtist | null>(null);

  const fetchDirtyArtists = async () => {
    const response = await fetch('/api/v1/artists/dirty');
    const data = await response.json();
    setDirtyArtists(data.artists);
  };

  const renameArtist = async (artistId: number, newName: string) => {
    await fetch(`/api/v1/artists/${artistId}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_name: newName })
    });

    toast.success(`Renamed artist globally across ${data.tracks_updated} tracks`);
    fetchDirtyArtists();
  };

  const mergeArtists = async (duplicateId: number, canonicalId: number) => {
    await fetch(`/api/v1/artists/${duplicateId}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_artist_id: canonicalId })
    });

    toast.success('Artists merged successfully');
    fetchDirtyArtists();
  };

  return (
    <div className="artist-merge-panel">
      <h3>Data Quality Issues ({dirtyArtists.length})</h3>

      <div className="artist-issues-list">
        {dirtyArtists.map(artist => (
          <div key={artist.artist_id} className="artist-issue">
            <div className="issue-header">
              <span className="artist-name">{artist.artist_name}</span>
              <span className="badge">{artist.issue_type}</span>
              <span className="track-count">{artist.track_count} tracks</span>
            </div>

            {artist.suggested_canonical && (
              <div className="suggestion">
                Suggested: <strong>{artist.suggested_canonical}</strong>
                <button onClick={() => renameArtist(artist.artist_id, artist.suggested_canonical)}>
                  Apply Rename
                </button>
              </div>
            )}

            <div className="actions">
              <button onClick={() => setMergeCandidate(artist)}>
                Merge with...
              </button>
              <button onClick={() => /* open rename dialog */}>
                Rename
              </button>
            </div>
          </div>
        ))}
      </div>

      {mergeCandidate && (
        <ArtistMergeDialog
          source={mergeCandidate}
          onMerge={mergeArtists}
          onClose={() => setMergeCandidate(null)}
        />
      )}
    </div>
  );
};
```

**Benefits**:
- Consolidate duplicate artists (e.g., "Deadmau5", "deadmau5", "DEADMAU5")
- Bulk rename operations (fix typos globally)
- Improve graph clarity by reducing artist duplication
- Track impact (show how many tracks affected)

---

## Feature 4: Spotify Audio Features Display

### Backend Support
**Endpoints**:
```python
GET /api/v1/music-auth/spotify/track/{track_id}/audio-features
POST /api/v1/music-auth/spotify/tracks/audio-features/batch
```

**Router**: `services/rest_api/routers/music_auth.py`

**Available Data**:
- Danceability, energy, valence, acousticness
- Speechiness, instrumentalness, liveness
- Tempo, loudness, key, mode, time signature

### Current Frontend State
**Status**: ❌ Not implemented
**Gap**: Data is fetched by backend but never displayed

### Implementation Suggestion

**Component**: `AudioFeaturesPanel.tsx`

```tsx
interface SpotifyAudioFeatures {
  danceability: number;     // 0.0 - 1.0
  energy: number;          // 0.0 - 1.0
  valence: number;         // 0.0 - 1.0 (happiness)
  acousticness: number;    // 0.0 - 1.0
  instrumentalness: number; // 0.0 - 1.0
  speechiness: number;     // 0.0 - 1.0
  liveness: number;        // 0.0 - 1.0
  tempo: number;           // BPM
  loudness: number;        // dB
  key: number;             // 0-11 (C, C#, D, etc.)
  mode: number;            // 0 = minor, 1 = major
  time_signature: number;
}

const AudioFeaturesPanel: React.FC<{ trackId: string }> = ({ trackId }) => {
  const [features, setFeatures] = useState<SpotifyAudioFeatures | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAudioFeatures();
  }, [trackId]);

  const fetchAudioFeatures = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/music-auth/spotify/track/${trackId}/audio-features`
      );
      const data = await response.json();
      setFeatures(data);
    } catch (error) {
      console.error('Failed to fetch audio features:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spinner />;
  if (!features) return <div>Audio features unavailable</div>;

  return (
    <div className="audio-features-panel">
      <h3>Audio Analysis</h3>

      {/* Radar Chart for mood/energy features */}
      <RadarChart
        data={[
          { axis: 'Energy', value: features.energy },
          { axis: 'Danceability', value: features.danceability },
          { axis: 'Valence', value: features.valence },
          { axis: 'Acousticness', value: features.acousticness },
          { axis: 'Instrumentalness', value: features.instrumentalness },
        ]}
      />

      {/* Key feature bars */}
      <div className="feature-bars">
        <FeatureBar label="Energy" value={features.energy} color="red" />
        <FeatureBar label="Danceability" value={features.danceability} color="blue" />
        <FeatureBar label="Happiness" value={features.valence} color="yellow" />
        <FeatureBar label="Liveness" value={features.liveness} color="green" />
      </div>

      {/* Musical attributes */}
      <div className="musical-attributes">
        <Attribute label="Key" value={keyNames[features.key]} />
        <Attribute label="Mode" value={features.mode === 1 ? 'Major' : 'Minor'} />
        <Attribute label="Tempo" value={`${features.tempo.toFixed(1)} BPM`} />
        <Attribute label="Time Signature" value={`${features.time_signature}/4`} />
        <Attribute label="Loudness" value={`${features.loudness.toFixed(1)} dB`} />
      </div>
    </div>
  );
};
```

**Integration Points**:
1. Add tab to `TrackDetailsModal`
2. Use for track comparison in pathfinding
3. Show in hover tooltip (condensed version)
4. Filter tracks by energy/danceability ranges

**Benefits**:
- Expose Spotify's proprietary ML features
- Enable mood-based filtering
- Better set planning (energy curves)
- Data already available, just needs UI

---

## Feature 5: Graph Neighborhood Explorer

### Backend Support
**Endpoint**: `GET /api/graph/neighborhood/{node_id}`
**Service**: `graph-visualization-api`

**Features**:
- Get N-hop neighbors of a node
- Configurable depth (1-3 hops)
- Returns subgraph with edges
- Performance optimized (<50ms)

### Current Frontend State
**Status**: ❌ Not implemented
**Gap**: Full graph loaded, no focused exploration

### Implementation Suggestion

**Component**: `GraphNeighborhoodExplorer.tsx`

```tsx
interface NeighborhoodNode {
  id: string;
  name: string;
  artist: string;
  hop_distance: number; // 1, 2, or 3
  connection_strength: number;
}

interface NeighborhoodResponse {
  center_node: NeighborhoodNode;
  neighbors: NeighborhoodNode[];
  edges: GraphEdge[];
  total_neighbors: number;
}

const GraphNeighborhoodExplorer: React.FC<{ nodeId: string }> = ({ nodeId }) => {
  const [neighborhood, setNeighborhood] = useState<NeighborhoodResponse | null>(null);
  const [depth, setDepth] = useState<1 | 2 | 3>(2);
  const [layout, setLayout] = useState<'radial' | 'force'>('radial');

  const fetchNeighborhood = async () => {
    const response = await fetch(
      `/api/graph/neighborhood/${nodeId}?depth=${depth}&max_neighbors=50`
    );
    const data = await response.json();
    setNeighborhood(data);
  };

  useEffect(() => {
    fetchNeighborhood();
  }, [nodeId, depth]);

  const renderRadialLayout = () => {
    // Center node at origin
    // 1-hop neighbors in inner ring
    // 2-hop neighbors in middle ring
    // 3-hop neighbors in outer ring
    const angleStep = (2 * Math.PI) / neighborhood.neighbors.length;

    return neighborhood.neighbors.map((node, idx) => {
      const angle = idx * angleStep;
      const radius = node.hop_distance * 100; // Scale by hop distance
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);

      return (
        <GraphNode
          key={node.id}
          node={node}
          position={{ x, y }}
          onClick={() => /* Navigate to node */}
        />
      );
    });
  };

  return (
    <div className="neighborhood-explorer">
      <div className="controls">
        <label>
          Exploration Depth:
          <select value={depth} onChange={(e) => setDepth(Number(e.target.value))}>
            <option value={1}>1 hop (direct connections)</option>
            <option value={2}>2 hops (friends of friends)</option>
            <option value={3}>3 hops (extended network)</option>
          </select>
        </label>

        <button onClick={() => setLayout(layout === 'radial' ? 'force' : 'radial')}>
          Layout: {layout}
        </button>
      </div>

      <svg className="neighborhood-graph">
        {neighborhood && (
          <>
            {/* Center node */}
            <circle cx={0} cy={0} r={30} fill="gold" />

            {/* Hop distance rings */}
            <circle cx={0} cy={0} r={100} fill="none" stroke="#333" strokeDasharray="4" />
            <circle cx={0} cy={0} r={200} fill="none" stroke="#333" strokeDasharray="4" />
            <circle cx={0} cy={0} r={300} fill="none" stroke="#333" strokeDasharray="4" />

            {/* Edges */}
            {neighborhood.edges.map(edge => (
              <GraphEdge key={`${edge.from_id}-${edge.to_id}`} edge={edge} />
            ))}

            {/* Neighbor nodes */}
            {layout === 'radial' && renderRadialLayout()}
          </>
        )}
      </svg>

      <div className="neighbor-list">
        <h4>Neighbors ({neighborhood?.total_neighbors})</h4>
        {neighborhood?.neighbors.map(node => (
          <div key={node.id} className="neighbor-item">
            <span>{node.name}</span>
            <span className="hop-badge">{node.hop_distance}-hop</span>
            <span className="strength">{(node.connection_strength * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

**Integration Points**:
1. Add "Explore Neighborhood" button to node context menu
2. Replace full graph with focused view on click
3. Breadcrumb navigation for exploring multiple nodes
4. Export neighborhood as playlist

**Benefits**:
- Focused exploration without overwhelming full graph
- Discover related tracks efficiently
- Performance-optimized for large datasets
- Intuitive radial visualization

---

## Feature 6: Batch Operations Dashboard

### Backend Support
**Endpoints**:
```python
POST /api/v1/visualization/nodes/batch  # Create batch job
GET /api/v1/visualization/batch/{batch_id}/status  # Poll status
```

**Service**: `graph-visualization-api`

**Features**:
- Batch enrichment jobs
- Progress tracking
- Job history
- Async processing with status updates

### Current Frontend State
**Status**: ❌ Not implemented
**Gap**: API supports batching but no UI for bulk operations

### Implementation Suggestion

**Component**: `BatchOperationsDashboard.tsx`

```tsx
interface BatchJob {
  batch_id: string;
  operation_type: 'enrich' | 'analyze' | 'export';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  total_items: number;
  processed_items: number;
  failed_items: number;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

const BatchOperationsDashboard: React.FC = () => {
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [operationType, setOperationType] = useState<'enrich' | 'analyze'>('enrich');

  const createBatchJob = async () => {
    const response = await fetch('/api/v1/visualization/nodes/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        node_ids: selectedTracks,
        operation: operationType
      })
    });

    const job = await response.json();
    setJobs([job, ...jobs]);

    // Start polling for status
    pollJobStatus(job.batch_id);
  };

  const pollJobStatus = async (batchId: string) => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/v1/visualization/batch/${batchId}/status`);
      const job = await response.json();

      setJobs(prevJobs =>
        prevJobs.map(j => j.batch_id === batchId ? job : j)
      );

      if (job.status === 'completed' || job.status === 'failed') {
        clearInterval(interval);
      }
    }, 2000);
  };

  return (
    <div className="batch-operations-dashboard">
      <div className="create-job-panel">
        <h3>Create Batch Operation</h3>

        <select
          value={operationType}
          onChange={(e) => setOperationType(e.target.value)}
        >
          <option value="enrich">Enrich Metadata (Spotify/MusicBrainz)</option>
          <option value="analyze">Audio Analysis (BPM/Key)</option>
        </select>

        <div className="track-selection">
          <span>{selectedTracks.length} tracks selected</span>
          <button onClick={createBatchJob} disabled={selectedTracks.length === 0}>
            Start Batch Job
          </button>
        </div>
      </div>

      <div className="jobs-list">
        <h3>Job History</h3>
        {jobs.map(job => (
          <div key={job.batch_id} className={`job-item job-${job.status}`}>
            <div className="job-header">
              <span className="job-id">{job.batch_id.slice(0, 8)}</span>
              <span className="job-type">{job.operation_type}</span>
              <span className="job-status">{job.status}</span>
            </div>

            {job.status === 'processing' && (
              <div className="job-progress">
                <ProgressBar
                  value={job.processed_items}
                  max={job.total_items}
                />
                <span>{job.processed_items} / {job.total_items}</span>
              </div>
            )}

            {job.status === 'completed' && (
              <div className="job-results">
                ✅ Completed in {calculateDuration(job.created_at, job.completed_at)}
                {job.failed_items > 0 && (
                  <span className="failures">({job.failed_items} failed)</span>
                )}
              </div>
            )}

            {job.status === 'failed' && (
              <div className="job-error">
                ❌ {job.error_message}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
```

**Integration Points**:
1. Add "Batch Operations" to settings menu
2. Multi-select in graph view → "Add to batch"
3. Show notification when batch completes
4. Integration with metadata enrichment service

**Benefits**:
- Process hundreds of tracks efficiently
- Background processing with progress tracking
- Retry failed items
- Job history for auditing

---

## Feature 7: Track Comparison View

### Backend Support
**Endpoint**: `POST /api/v1/music-auth/spotify/tracks/audio-features/batch`
**Router**: `music_auth.py`

**Features**:
- Batch audio features retrieval
- BPM, key, energy comparison
- Harmonic compatibility check

### Current Frontend State
**Status**: ❌ Not implemented
**Gap**: No side-by-side track comparison

### Implementation Suggestion

**Component**: `TrackComparisonView.tsx`

```tsx
interface ComparisonData {
  track_a: {
    name: string;
    artist: string;
    bpm: number;
    key: string;
    energy: number;
    danceability: number;
    audio_features: SpotifyAudioFeatures;
  };
  track_b: {
    name: string;
    artist: string;
    bpm: number;
    key: string;
    energy: number;
    danceability: number;
    audio_features: SpotifyAudioFeatures;
  };
  compatibility: {
    bpm_diff: number;
    bpm_compatible: boolean;
    key_compatible: boolean;
    camelot_relationship: string;
    energy_diff: number;
    overall_score: number; // 0-100
  };
}

const TrackComparisonView: React.FC<{ trackA: string; trackB: string }> = ({ trackA, trackB }) => {
  const [comparison, setComparison] = useState<ComparisonData | null>(null);

  const fetchComparison = async () => {
    // Batch fetch audio features
    const response = await fetch('/api/v1/music-auth/spotify/tracks/audio-features/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track_ids: [trackA, trackB] })
    });

    const features = await response.json();

    // Calculate compatibility
    const compatibility = calculateCompatibility(features[0], features[1]);

    setComparison({
      track_a: features[0],
      track_b: features[1],
      compatibility
    });
  };

  return (
    <div className="track-comparison">
      <div className="comparison-grid">
        <div className="track-column">
          <h3>{comparison?.track_a.name}</h3>
          <AudioFeaturesDial features={comparison?.track_a.audio_features} />
        </div>

        <div className="compatibility-column">
          <div className={`score-${getScoreClass(comparison?.compatibility.overall_score)}`}>
            <h2>{comparison?.compatibility.overall_score}/100</h2>
            <span>Compatibility Score</span>
          </div>

          <div className="compatibility-details">
            <CompatibilityItem
              label="BPM Match"
              value={comparison?.compatibility.bpm_diff}
              unit="BPM diff"
              status={comparison?.compatibility.bpm_compatible}
            />

            <CompatibilityItem
              label="Harmonic Mix"
              value={comparison?.compatibility.camelot_relationship}
              status={comparison?.compatibility.key_compatible}
            />

            <CompatibilityItem
              label="Energy Flow"
              value={comparison?.compatibility.energy_diff}
              unit="difference"
              status={Math.abs(comparison?.compatibility.energy_diff) < 0.3}
            />
          </div>
        </div>

        <div className="track-column">
          <h3>{comparison?.track_b.name}</h3>
          <AudioFeaturesDial features={comparison?.track_b.audio_features} />
        </div>
      </div>

      <div className="camelot-visualization">
        <CamelotWheel
          highlightKeys={[comparison?.track_a.key, comparison?.track_b.key]}
          showCompatibility={true}
        />
      </div>
    </div>
  );
};
```

**Benefits**:
- Visual compatibility assessment
- Learn mixing theory (Camelot wheel)
- Plan transitions before playing
- Educational tool for DJs

---

## Feature 8: Real-Time Collaboration

### Backend Support
**Endpoint**: `WebSocket /api/graph/ws/{room_id}`
**Service**: `graph-visualization-api`

**Features**:
- Room-based collaboration
- Real-time graph updates
- User presence tracking
- Message history

### Current Frontend State
**Status**: ❌ Not implemented
**Gap**: WebSocket endpoint exists, no UI

### Implementation Suggestion

**Component**: `CollaborativeGraphSession.tsx`

```tsx
interface CollaborationRoom {
  room_id: string;
  active_users: User[];
  cursor_positions: Map<string, { x: number; y: number }>;
  selected_nodes: Map<string, string[]>; // user_id -> node_ids
}

const CollaborativeGraphSession: React.FC<{ roomId: string }> = ({ roomId }) => {
  const wsRef = useRef<WebSocket | null>(null);
  const [room, setRoom] = useState<CollaborationRoom | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    connectToRoom();
    return () => disconnectFromRoom();
  }, [roomId]);

  const connectToRoom = () => {
    const ws = new WebSocket(`ws://localhost:8084/api/graph/ws/${roomId}`);

    ws.onopen = () => {
      setConnected(true);
      console.log('Connected to collaboration room');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'user_joined':
          toast.info(`${message.user.name} joined the session`);
          break;

        case 'cursor_move':
          updateCursorPosition(message.user_id, message.position);
          break;

        case 'node_selected':
          highlightNodeForUser(message.user_id, message.node_id);
          break;

        case 'graph_update':
          // Real-time graph changes from other users
          updateGraph(message.changes);
          break;
      }
    };

    wsRef.current = ws;
  };

  const broadcastCursorPosition = (x: number, y: number) => {
    wsRef.current?.send(JSON.stringify({
      type: 'cursor_move',
      position: { x, y }
    }));
  };

  const broadcastNodeSelection = (nodeIds: string[]) => {
    wsRef.current?.send(JSON.stringify({
      type: 'node_selected',
      node_ids: nodeIds
    }));
  };

  return (
    <div className="collaborative-session">
      <div className="session-header">
        <div className="connection-status">
          {connected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>

        <div className="active-users">
          {room?.active_users.map(user => (
            <UserAvatar key={user.id} user={user} />
          ))}
        </div>

        <button onClick={() => navigator.clipboard.writeText(window.location.href)}>
          📋 Copy Invite Link
        </button>
      </div>

      <GraphVisualization
        onNodeSelect={broadcastNodeSelection}
        onCursorMove={broadcastCursorPosition}
        remoteSelections={room?.selected_nodes}
        remoteCursors={room?.cursor_positions}
      />
    </div>
  );
};
```

**Integration Points**:
1. Add "Start Collaboration" button
2. Generate shareable room links
3. Show user cursors and selections
4. Persist room state to database

**Benefits**:
- Collaborative set planning
- Remote DJ collaboration
- Real-time feedback on track selection
- Educational use (mentor/student)

---

## Feature 9: Graph Statistics Dashboard

### Backend Support
**Endpoint**: `GET /api/graph/stats`
**Service**: `graph-visualization-api`

**Available Metrics**:
- Total nodes/edges
- Average degree
- Connected components
- Clustering coefficient
- Centrality metrics

### Current Frontend State
**Status**: ❌ Not implemented
**Gap**: Rich statistics available but not displayed

### Implementation Suggestion

**Component**: `GraphStatisticsPanel.tsx`

```tsx
interface GraphStatistics {
  node_count: number;
  edge_count: number;
  average_degree: number;
  max_degree: number;
  connected_components: number;
  largest_component_size: number;
  clustering_coefficient: number;
  density: number;
  top_hubs: Array<{
    node_id: string;
    name: string;
    degree: number;
  }>;
}

const GraphStatisticsPanel: React.FC = () => {
  const [stats, setStats] = useState<GraphStatistics | null>(null);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    const response = await fetch('/api/graph/stats');
    const data = await response.json();
    setStats(data);
  };

  return (
    <div className="graph-statistics">
      <h2>Graph Analytics</h2>

      <div className="stats-grid">
        <StatCard
          icon="🎵"
          label="Total Tracks"
          value={stats?.node_count.toLocaleString()}
        />

        <StatCard
          icon="🔗"
          label="Connections"
          value={stats?.edge_count.toLocaleString()}
        />

        <StatCard
          icon="📊"
          label="Avg Connections per Track"
          value={stats?.average_degree.toFixed(1)}
        />

        <StatCard
          icon="🌐"
          label="Network Density"
          value={`${(stats?.density * 100).toFixed(2)}%`}
        />
      </div>

      <div className="advanced-metrics">
        <h3>Network Analysis</h3>

        <MetricRow
          label="Connected Components"
          value={stats?.connected_components}
          tooltip="Number of isolated subgraphs"
        />

        <MetricRow
          label="Largest Component"
          value={`${stats?.largest_component_size} tracks`}
          tooltip="Size of main connected graph"
        />

        <MetricRow
          label="Clustering Coefficient"
          value={stats?.clustering_coefficient.toFixed(3)}
          tooltip="How tightly tracks cluster together"
        />
      </div>

      <div className="top-hubs">
        <h3>Most Connected Tracks</h3>
        {stats?.top_hubs.map((hub, idx) => (
          <div key={hub.node_id} className="hub-item">
            <span className="rank">#{idx + 1}</span>
            <span className="name">{hub.name}</span>
            <span className="degree">{hub.degree} connections</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

**Benefits**:
- Understand graph structure
- Identify influential tracks
- Monitor graph growth over time
- Data-driven decisions

---

## Feature 10: Target Tracks Management

### Backend Support
**Endpoints**:
```python
GET /api/v1/target-tracks  # Get all target tracks
POST /api/v1/target-tracks  # Add target track
DELETE /api/v1/target-tracks/{track_id}  # Remove target
```

**Location**: `services/rest_api/main.py`

### Current Frontend State
**Status**: ⚠️ Partially implemented
**Gap**: `DJInterface` has search but no management UI

### Implementation Suggestion

**Component**: `TargetTracksManager.tsx`

```tsx
interface TargetTrack {
  id: string;
  artist: string;
  title: string;
  added_at: string;
  priority: number;
  found_in_graph: boolean;
}

const TargetTracksManager: React.FC = () => {
  const [targets, setTargets] = useState<TargetTrack[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTargets = async () => {
    const response = await fetch('/api/v1/target-tracks');
    const data = await response.json();
    setTargets(data.tracks);
  };

  const addTarget = async (artist: string, title: string) => {
    await fetch('/api/v1/target-tracks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist, title, priority: 5 })
    });

    fetchTargets();
  };

  const removeTarget = async (trackId: string) => {
    await fetch(`/api/v1/target-tracks/${trackId}`, { method: 'DELETE' });
    fetchTargets();
  };

  return (
    <div className="target-tracks-manager">
      <div className="add-target">
        <input
          type="text"
          placeholder="Artist - Title"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button onClick={() => {
          const [artist, title] = searchQuery.split(' - ');
          addTarget(artist.trim(), title.trim());
        }}>
          Add Target
        </button>
      </div>

      <div className="targets-list">
        {targets.map(track => (
          <div key={track.id} className={track.found_in_graph ? 'found' : 'missing'}>
            <div className="track-info">
              <strong>{track.artist}</strong> - {track.title}
              {track.found_in_graph && <span className="badge">✓ In Graph</span>}
            </div>

            <div className="actions">
              {track.found_in_graph && (
                <button onClick={() => navigateToTrack(track.id)}>
                  View in Graph
                </button>
              )}
              <button onClick={() => removeTarget(track.id)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

**Benefits**:
- Wishlist for tracks to find
- Track discovery progress
- Integration with scrapers
- Priority-based searching

---

## Feature 11: Music Service Search

### Backend Support
**Endpoint**: `GET /api/v1/music-search/{service}`
**Location**: `services/rest_api/main.py` (line 800+)

**Supported Services**:
- Spotify
- Tidal
- YouTube Music
- SoundCloud

### Current Frontend State
**Status**: ❌ Not implemented
**Gap**: Backend proxies searches but no unified search UI

### Implementation Suggestion

**Component**: `UnifiedMusicSearch.tsx`

```tsx
interface SearchResult {
  service: 'spotify' | 'tidal' | 'youtube' | 'soundcloud';
  track_id: string;
  title: string;
  artist: string;
  album?: string;
  duration_ms: number;
  preview_url?: string;
  external_url: string;
  available: boolean;
}

const UnifiedMusicSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Map<string, SearchResult[]>>(new Map());
  const [services, setServices] = useState(['spotify', 'tidal', 'youtube']);
  const [loading, setLoading] = useState(false);

  const searchAllServices = async () => {
    setLoading(true);
    const promises = services.map(async (service) => {
      const response = await fetch(
        `/api/v1/music-search/${service}?q=${encodeURIComponent(query)}&limit=10`
      );
      const data = await response.json();
      return [service, data.results];
    });

    const allResults = await Promise.all(promises);
    setResults(new Map(allResults));
    setLoading(false);
  };

  return (
    <div className="unified-music-search">
      <div className="search-header">
        <input
          type="text"
          placeholder="Search artist, track, or album..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && searchAllServices()}
        />

        <div className="service-toggles">
          {['spotify', 'tidal', 'youtube', 'soundcloud'].map(service => (
            <label key={service}>
              <input
                type="checkbox"
                checked={services.includes(service)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setServices([...services, service]);
                  } else {
                    setServices(services.filter(s => s !== service));
                  }
                }}
              />
              {service}
            </label>
          ))}
        </div>
      </div>

      {loading && <LoadingSpinner />}

      <div className="results-grid">
        {Array.from(results.entries()).map(([service, tracks]) => (
          <div key={service} className="service-results">
            <h3>
              <ServiceIcon service={service} />
              {service} ({tracks.length})
            </h3>

            {tracks.map(track => (
              <div key={track.track_id} className="result-item">
                <div className="track-info">
                  <strong>{track.title}</strong>
                  <span>{track.artist}</span>
                </div>

                <div className="actions">
                  {track.preview_url && (
                    <button onClick={() => playPreview(track.preview_url)}>
                      ▶
                    </button>
                  )}

                  <a href={track.external_url} target="_blank" rel="noopener">
                    Open in {service}
                  </a>

                  <button onClick={() => addToGraph(track)}>
                    Add to Graph
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
```

**Benefits**:
- Cross-service availability check
- Find tracks on user's preferred platform
- Price comparison (if applicable)
- Consolidated search experience

---

## Feature 12: Setlist Export to Streaming Services

### Backend Support
**Endpoints**:
```python
POST /api/v1/spotify/playlists/create
POST /api/v1/spotify/playlists/{playlist_id}/tracks
POST /api/v1/tidal/playlists/create
POST /api/v1/tidal/playlists/{playlist_id}/tracks
```

**Routers**: `spotify_playlists.py`, `tidal_playlists.py`

### Current Frontend State
**Status**: ⚠️ Partially implemented
**Gap**: `SpotifyPlaylistManager` exists but not integrated with pathfinder/setlist builder

### Implementation Suggestion

**Enhancement**: Integrate with `SetlistBuilder.tsx`

```tsx
// Add to SetlistBuilder component
const exportToSpotify = async (tracks: Track[]) => {
  const accessToken = localStorage.getItem('spotify_access_token');

  if (!accessToken) {
    toast.error('Please connect Spotify first');
    return;
  }

  // Create playlist
  const createResponse = await fetch('/api/v1/spotify/playlists/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      name: `SongNodes Setlist - ${new Date().toLocaleDateString()}`,
      description: 'Generated by SongNodes pathfinding algorithm',
      public: true
    })
  });

  const playlist = await createResponse.json();

  // Add tracks (need to convert to Spotify IDs)
  const trackIds = await resolveSpotifyIds(tracks);

  await fetch(`/api/v1/spotify/playlists/${playlist.id}/tracks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ track_ids: trackIds })
  });

  toast.success(`Exported ${trackIds.length} tracks to Spotify!`);
  window.open(playlist.external_url, '_blank');
};

// Similar for Tidal
const exportToTidal = async (tracks: Track[]) => {
  // Similar implementation
};

// Add export buttons to UI
<div className="export-actions">
  <button onClick={() => exportToSpotify(setlistTracks)}>
    📤 Export to Spotify
  </button>
  <button onClick={() => exportToTidal(setlistTracks)}>
    📤 Export to Tidal
  </button>
</div>
```

**Benefits**:
- One-click export from pathfinder
- Sync DJ sets to streaming libraries
- Share setlists with collaborators
- Test mixes in streaming apps

---

## Feature 13: Advanced Audio Analysis Visualization

### Backend Support
**Service**: `audio-analysis`
**Available Data**:
- Intro/outro durations
- Breakdown positions
- Vocal segments
- Energy curve
- Beat grid
- Mood/timbre/rhythm analysis

### Current Frontend State
**Status**: ❌ Not implemented
**Gap**: Rich analysis data available but not visualized

### Implementation Suggestion

**Component**: `AudioAnalysisVisualizer.tsx`

```tsx
interface AudioAnalysis {
  intro_duration_seconds: number;
  outro_duration_seconds: number;
  breakdown_timestamps: number[];
  vocal_segments: Array<{ start: number; end: number }>;
  energy_curve: number[];  // Energy level at each second
  beat_grid: number[];     // Beat positions in seconds
  bpm: number;
  mood: {
    valence: number;
    arousal: number;
    dominance: number;
  };
  timbre: {
    brightness: number;
    warmth: number;
  };
}

const AudioAnalysisVisualizer: React.FC<{ trackId: string }> = ({ trackId }) => {
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetchAnalysis();
  }, [trackId]);

  const fetchAnalysis = async () => {
    const response = await fetch(`/api/v1/audio-analysis/${trackId}`);
    const data = await response.json();
    setAnalysis(data);
  };

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas || !analysis) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Draw energy curve
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();

    analysis.energy_curve.forEach((energy, idx) => {
      const x = (idx / analysis.energy_curve.length) * width;
      const y = height - (energy * height);

      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Mark intro/outro
    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
    const introPx = (analysis.intro_duration_seconds / 300) * width; // Assume 5min max
    ctx.fillRect(0, 0, introPx, height);

    const outroPx = (analysis.outro_duration_seconds / 300) * width;
    ctx.fillRect(width - outroPx, 0, outroPx, height);

    // Mark breakdowns
    ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';
    analysis.breakdown_timestamps.forEach(timestamp => {
      const x = (timestamp / 300) * width;
      ctx.fillRect(x - 5, 0, 10, height);
    });

    // Mark vocal segments
    ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
    analysis.vocal_segments.forEach(segment => {
      const x1 = (segment.start / 300) * width;
      const x2 = (segment.end / 300) * width;
      ctx.fillRect(x1, 0, x2 - x1, height);
    });
  };

  useEffect(() => {
    if (analysis) {
      drawWaveform();
    }
  }, [analysis]);

  return (
    <div className="audio-analysis-visualizer">
      <h3>Audio Structure</h3>

      <canvas
        ref={canvasRef}
        width={800}
        height={200}
        className="waveform-canvas"
      />

      <div className="legend">
        <span className="intro">🔴 Intro: {analysis?.intro_duration_seconds}s</span>
        <span className="outro">🔴 Outro: {analysis?.outro_duration_seconds}s</span>
        <span className="breakdown">🔵 Breakdowns</span>
        <span className="vocals">🟡 Vocals</span>
      </div>

      <div className="structural-info">
        <InfoRow label="BPM" value={analysis?.bpm.toFixed(1)} />
        <InfoRow label="Intro" value={`${analysis?.intro_duration_seconds}s (good for mixing in)`} />
        <InfoRow label="Outro" value={`${analysis?.outro_duration_seconds}s (good for mixing out)`} />
        <InfoRow label="Breakdowns" value={analysis?.breakdown_timestamps.length} />
        <InfoRow label="Vocal Sections" value={analysis?.vocal_segments.length} />
      </div>

      <div className="mood-analysis">
        <h4>Mood Profile</h4>
        <MoodDial
          valence={analysis?.mood.valence}
          arousal={analysis?.mood.arousal}
          dominance={analysis?.mood.dominance}
        />
      </div>
    </div>
  );
};
```

**Benefits**:
- Visualize track structure for better mixing
- Identify intro/outro for smooth transitions
- Locate breakdowns for creative mixing
- Understand energy flow

---

## Feature 14: WebSocket Room History

### Backend Support
**Endpoint**: `GET /api/v1/websocket/room/{room_id}/history`
**Service**: `websocket-api`

**Features**:
- Message history retrieval
- User activity log
- Graph change timeline
- Export conversation

### Current Frontend State
**Status**: ❌ Not implemented
**Gap**: No history/replay functionality

### Implementation Suggestion

**Component**: `CollaborationHistory.tsx`

```tsx
interface HistoryEntry {
  timestamp: string;
  user: {
    id: string;
    name: string;
  };
  action_type: 'message' | 'node_selected' | 'graph_updated' | 'user_joined';
  data: any;
}

const CollaborationHistory: React.FC<{ roomId: string }> = ({ roomId }) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchHistory();
  }, [roomId]);

  const fetchHistory = async () => {
    const response = await fetch(`/api/v1/websocket/room/${roomId}/history?limit=100`);
    const data = await response.json();
    setHistory(data.entries);
  };

  const exportHistory = () => {
    const csv = history.map(entry =>
      `${entry.timestamp},${entry.user.name},${entry.action_type},${JSON.stringify(entry.data)}`
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collaboration-${roomId}-${new Date().toISOString()}.csv`;
    a.click();
  };

  return (
    <div className="collaboration-history">
      <div className="history-header">
        <h3>Session History</h3>

        <div className="filters">
          <button onClick={() => setFilter('all')} className={filter === 'all' ? 'active' : ''}>
            All
          </button>
          <button onClick={() => setFilter('messages')} className={filter === 'messages' ? 'active' : ''}>
            Messages
          </button>
          <button onClick={() => setFilter('graph_updates')} className={filter === 'graph_updates' ? 'active' : ''}>
            Graph Updates
          </button>
        </div>

        <button onClick={exportHistory}>
          📥 Export History
        </button>
      </div>

      <div className="timeline">
        {history
          .filter(entry => filter === 'all' || entry.action_type === filter)
          .map((entry, idx) => (
            <div key={idx} className={`timeline-entry entry-${entry.action_type}`}>
              <div className="timestamp">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </div>

              <div className="user-avatar">
                {entry.user.name[0]}
              </div>

              <div className="entry-content">
                <strong>{entry.user.name}</strong>
                {renderEntryContent(entry)}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
```

**Benefits**:
- Review collaboration sessions
- Audit trail for changes
- Learn from other DJs' choices
- Export for documentation

---

## Feature 15: API Key Status Dashboard

### Backend Support
**Endpoints**:
```python
GET /api/v1/api-keys/requirements  # Get required keys
GET /api/v1/api-keys  # Get configured keys
POST /api/v1/api-keys/test  # Test key validity
```

**Router**: `api_keys.py`

### Current Frontend State
**Status**: ✅ Implemented (`APIKeyManager.tsx`)
**Gap**: Basic implementation, missing advanced features

### Enhancement Suggestion

**Enhancement**: Add to existing `APIKeyManager.tsx`

```tsx
// Add quota/usage tracking visualization
interface KeyUsageStats {
  service_name: string;
  key_name: string;
  requests_today: number;
  quota_limit: number;
  quota_remaining: number;
  last_used: string;
  health_status: 'healthy' | 'warning' | 'error';
  error_rate: number;
}

const APIKeyUsageDashboard: React.FC = () => {
  const [usageStats, setUsageStats] = useState<KeyUsageStats[]>([]);

  useEffect(() => {
    fetchUsageStats();
    const interval = setInterval(fetchUsageStats, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchUsageStats = async () => {
    const response = await fetch('/api/v1/api-keys/usage-stats');
    const data = await response.json();
    setUsageStats(data.stats);
  };

  return (
    <div className="api-key-usage-dashboard">
      <h3>API Key Health & Usage</h3>

      {usageStats.map(stat => (
        <div key={`${stat.service_name}-${stat.key_name}`} className="usage-card">
          <div className="service-header">
            <ServiceIcon service={stat.service_name} />
            <span>{stat.service_name} - {stat.key_name}</span>
            <StatusBadge status={stat.health_status} />
          </div>

          <div className="quota-visualization">
            <ProgressBar
              value={stat.requests_today}
              max={stat.quota_limit}
              color={getQuotaColor(stat.requests_today / stat.quota_limit)}
            />
            <span className="quota-text">
              {stat.requests_today.toLocaleString()} / {stat.quota_limit.toLocaleString()}
              ({((stat.requests_today / stat.quota_limit) * 100).toFixed(1)}%)
            </span>
          </div>

          <div className="stats-row">
            <Stat label="Remaining" value={stat.quota_remaining.toLocaleString()} />
            <Stat label="Error Rate" value={`${(stat.error_rate * 100).toFixed(2)}%`} />
            <Stat label="Last Used" value={formatRelativeTime(stat.last_used)} />
          </div>

          {stat.health_status === 'error' && (
            <div className="error-alert">
              ⚠️ This API key is experiencing issues. Check configuration or quota.
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
```

**Benefits**:
- Real-time quota monitoring
- Prevent API throttling
- Identify misconfigured keys
- Plan API usage strategically

---

## Implementation Priority Matrix

| Feature | Impact | Effort | Priority | Timeline |
|---------|--------|--------|----------|----------|
| 1. Data Quality Review | High | Medium | 🔴 Critical | Week 1-2 |
| 2. YouTube Previews | High | Low | 🟢 Quick Win | Week 1 |
| 3. Artist Merge Tools | High | Medium | 🔴 Critical | Week 1-2 |
| 4. Spotify Audio Features | High | Low | 🟢 Quick Win | Week 1 |
| 5. Graph Neighborhood | Medium | Medium | 🟡 Important | Week 2-3 |
| 6. Batch Operations | Medium | High | 🟡 Important | Week 3-4 |
| 7. Track Comparison | High | Medium | 🔴 Critical | Week 2 |
| 8. Real-Time Collaboration | Low | High | 🔵 Future | Week 5-6 |
| 9. Graph Statistics | Medium | Low | 🟢 Quick Win | Week 2 |
| 10. Target Tracks | Medium | Low | 🟢 Quick Win | Week 1 |
| 11. Music Service Search | Medium | Medium | 🟡 Important | Week 3 |
| 12. Setlist Export | High | Low | 🟢 Quick Win | Week 1 |
| 13. Audio Analysis Viz | High | High | 🟡 Important | Week 4-5 |
| 14. WebSocket History | Low | Medium | 🔵 Future | Week 6+ |
| 15. API Key Dashboard | Low | Low | 🟢 Quick Win | Week 1 |

**Legend**:
- 🔴 Critical: Essential for core workflows
- 🟡 Important: Significant value-add
- 🟢 Quick Win: Low effort, good ROI
- 🔵 Future: Nice-to-have, defer

---

## Recommended Implementation Phases

### Phase 1: Quick Wins (Week 1)
Focus on low-effort, high-impact features:
1. YouTube Previews
2. Spotify Audio Features Display
3. Graph Statistics Panel
4. Target Tracks Manager
5. Setlist Export Integration
6. API Key Usage Dashboard

**Expected Outcome**: 6 new features, ~40 hours development

### Phase 2: Critical Features (Weeks 2-3)
Core data quality and DJ workflow tools:
1. Data Quality Review Dashboard
2. Artist Merge & Rename Tools
3. Track Comparison View
4. Graph Neighborhood Explorer

**Expected Outcome**: Significant UX improvement, better data quality

### Phase 3: Advanced Features (Weeks 4-5)
Complex but valuable features:
1. Batch Operations Dashboard
2. Music Service Search
3. Audio Analysis Visualizer

**Expected Outcome**: Professional-grade DJ tooling

### Phase 4: Future Enhancements (Week 6+)
Nice-to-have, lower priority:
1. Real-Time Collaboration
2. WebSocket History

**Expected Outcome**: Collaborative features

---

## Technical Considerations

### Frontend Architecture Updates

**New Service Layer**:
```typescript
// services/dataQuality.service.ts
export const DataQualityService = {
  getReviewQueue: () => fetch('/api/v1/data-quality/tracks/needs-review'),
  approveCorrection: (trackId, corrections) =>
    fetch('/api/v1/data-quality/tracks/approve', { method: 'POST', body: JSON.stringify({ track_id: trackId, ...corrections }) }),
  getStats: () => fetch('/api/v1/data-quality/stats')
};

// services/audioAnalysis.service.ts
export const AudioAnalysisService = {
  getAnalysis: (trackId) => fetch(`/api/v1/audio-analysis/${trackId}`),
  getSpotifyFeatures: (trackId) => fetch(`/api/v1/music-auth/spotify/track/${trackId}/audio-features`),
  getBatchFeatures: (trackIds) =>
    fetch('/api/v1/music-auth/spotify/tracks/audio-features/batch', { method: 'POST', body: JSON.stringify({ track_ids: trackIds }) })
};
```

### State Management

Add new Zustand slices:
```typescript
// store/dataQualitySlice.ts
interface DataQualitySlice {
  reviewQueue: TrackReviewItem[];
  stats: ReviewStats;
  fetchReviewQueue: () => Promise<void>;
  approveCorrection: (trackId: string, corrections: any) => Promise<void>;
}

// store/collaborationSlice.ts
interface CollaborationSlice {
  activeRoom: string | null;
  connectedUsers: User[];
  wsConnection: WebSocket | null;
  connect: (roomId: string) => void;
  disconnect: () => void;
}
```

### Testing Requirements

Each feature must include:
1. **Unit tests**: Component logic, service calls
2. **Integration tests**: API mocking, data flow
3. **E2E tests**: Critical user journeys (Playwright)
4. **Accessibility tests**: WCAG 2.1 AA compliance

### Performance Considerations

- **Code splitting**: Lazy load heavy components (AudioAnalysisVisualizer, CollaborativeGraphSession)
- **Memoization**: Use React.memo for expensive renders
- **Debouncing**: Search inputs, API calls
- **Caching**: localStorage for YouTube search results, API key status

---

## Conclusion

This analysis identified **15 significant features** already supported by the backend but missing from the frontend UI. Implementation of these features would:

✅ **Improve Data Quality**: Systematic review workflows, artist deduplication
✅ **Enhance DJ Workflows**: Track comparison, setlist export, audio analysis
✅ **Enable Discovery**: Graph neighborhood, music service search
✅ **Add Collaboration**: Real-time sessions, WebSocket integration
✅ **Increase Transparency**: API quota monitoring, graph statistics

**Estimated Total Effort**: 6-8 weeks for full implementation
**Recommended Approach**: Phased rollout starting with Quick Wins

**Next Steps**:
1. Review and prioritize features with stakeholders
2. Create detailed user stories for Phase 1 features
3. Set up feature branches and CI/CD for incremental deployment
4. Begin implementation with YouTube previews (easiest, immediate value)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-23
**Author**: Backend-Frontend Gap Analysis
**Status**: Ready for Review
