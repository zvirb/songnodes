# SongNodes Comprehensive API Documentation

**Version:** 1.0.0  
**Date:** August 22, 2025  
**API Version:** v1  
**Base URL**: `https://api.songnodes.com`  
**Authentication**: Bearer JWT Token

## Table of Contents

1. [Authentication API](#authentication-api)
2. [Core Data APIs](#core-data-apis)
3. [Visualization APIs](#visualization-apis)
4. [Data Processing APIs](#data-processing-apis)
5. [Scraping & Orchestration APIs](#scraping--orchestration-apis)
6. [WebSocket APIs](#websocket-apis)
7. [Monitoring & Health APIs](#monitoring--health-apis)
8. [Error Handling](#error-handling)
9. [Rate Limiting](#rate-limiting)
10. [SDK Examples](#sdk-examples)

## Authentication API

### Authentication Service (Port 8080)

#### POST /api/auth/login
Authenticate user and return JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "refresh_token_here",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "permissions": ["read:tracks", "write:playlists"]
  },
  "expiresIn": 3600
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid credentials
- `429 Too Many Requests`: Rate limit exceeded
- `400 Bad Request`: Missing or invalid fields

#### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "password": "securePassword123",
  "name": "Jane Doe",
  "confirmPassword": "securePassword123"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "email": "newuser@example.com",
    "name": "Jane Doe",
    "role": "user"
  }
}
```

#### POST /api/auth/refresh
Refresh JWT token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "refresh_token_here"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "new_jwt_token_here",
  "expiresIn": 3600
}
```

#### POST /api/auth/logout
Invalidate current session and tokens.

**Headers:**
```
Authorization: Bearer jwt_token_here
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Core Data APIs

### REST API Service (Multiple replicas)

#### GET /api/v1/tracks
Retrieve paginated list of tracks with filtering options.

**Query Parameters:**
- `page` (integer, default: 1): Page number
- `limit` (integer, default: 20, max: 100): Items per page
- `artist` (string): Filter by artist name
- `genre` (string): Filter by genre
- `bpm_min` (integer): Minimum BPM
- `bpm_max` (integer): Maximum BPM
- `key` (string): Musical key (e.g., "Am", "C")
- `search` (string): Full-text search query
- `sort` (string): Sort field (title, artist, bpm, created_at)
- `order` (string): Sort order (asc, desc)

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Strobe",
      "artist": {
        "id": "artist-id",
        "name": "Deadmau5"
      },
      "album": "For Lack of a Better Name",
      "duration": 634,
      "bpm": 128,
      "key": "Fm",
      "genre": "Progressive House",
      "year": 2009,
      "metadata": {
        "energy": 0.8,
        "danceability": 0.9,
        "source": "1001tracklists"
      },
      "createdAt": "2025-08-20T10:30:00Z",
      "updatedAt": "2025-08-21T15:45:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15420,
    "totalPages": 771,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### POST /api/v1/tracks
Create a new track entry.

**Request Body:**
```json
{
  "title": "New Track Title",
  "artist": "Artist Name",
  "album": "Album Name",
  "duration": 240,
  "bpm": 130,
  "key": "Am",
  "genre": "Techno",
  "year": 2025,
  "metadata": {
    "source": "manual_entry",
    "confidence": 1.0
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "title": "New Track Title",
    "artist": {
      "id": "artist-new-id",
      "name": "Artist Name"
    },
    // ... full track object
  }
}
```

#### GET /api/v1/tracks/{id}
Get detailed information about a specific track.

**Path Parameters:**
- `id` (UUID): Track identifier

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Strobe",
    "artist": {
      "id": "artist-id",
      "name": "Deadmau5",
      "genre": "Progressive House",
      "trackCount": 234
    },
    "album": "For Lack of a Better Name",
    "duration": 634,
    "bpm": 128,
    "key": "Fm",
    "genre": "Progressive House",
    "relationships": [
      {
        "relatedTrack": {
          "id": "related-track-id",
          "title": "Related Track"
        },
        "relationshipType": "similar",
        "weight": 0.85
      }
    ],
    "playHistory": {
      "totalPlays": 1250,
      "uniqueListeners": 890,
      "lastPlayed": "2025-08-21T20:15:00Z"
    }
  }
}
```

#### PUT /api/v1/tracks/{id}
Update track information.

**Request Body:**
```json
{
  "title": "Updated Track Title",
  "bpm": 132,
  "metadata": {
    "updated_by": "user123",
    "update_reason": "BPM correction"
  }
}
```

#### DELETE /api/v1/tracks/{id}
Delete a track (soft delete with audit trail).

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Track deleted successfully"
}
```

#### GET /api/v1/artists
Retrieve paginated list of artists.

**Query Parameters:**
- `page`, `limit`, `search`, `sort`, `order`: Standard pagination
- `genre` (string): Filter by primary genre
- `country` (string): Filter by country
- `min_tracks` (integer): Minimum number of tracks

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "artist-id",
      "name": "Deadmau5",
      "genre": "Progressive House",
      "country": "Canada",
      "bio": "Canadian electronic music producer...",
      "website": "https://deadmau5.com",
      "socialMedia": {
        "twitter": "@deadmau5",
        "instagram": "@deadmau5"
      },
      "trackCount": 234,
      "totalPlays": 1500000,
      "createdAt": "2025-01-15T09:20:00Z"
    }
  ],
  "pagination": { /* ... */ }
}
```

#### GET /api/v1/artists/{id}
Get detailed artist information including tracks and relationships.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "artist-id",
    "name": "Deadmau5",
    "genre": "Progressive House",
    "tracks": [
      {
        "id": "track-id",
        "title": "Strobe",
        "album": "For Lack of a Better Name",
        "year": 2009
      }
    ],
    "collaborations": [
      {
        "artist": {
          "id": "collab-artist-id",
          "name": "Kaskade"
        },
        "trackCount": 3,
        "relationshipStrength": 0.7
      }
    ],
    "statistics": {
      "totalTracks": 234,
      "totalPlays": 1500000,
      "averageBpm": 128.5,
      "primaryGenres": ["Progressive House", "Electro House"]
    }
  }
}
```

#### GET /api/v1/playlists
Get user playlists.

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "playlist-id",
      "name": "My Progressive House Mix",
      "description": "Best progressive house tracks",
      "isPublic": true,
      "trackCount": 25,
      "duration": 6300,
      "createdAt": "2025-08-15T14:30:00Z",
      "updatedAt": "2025-08-21T16:45:00Z"
    }
  ]
}
```

#### GET /api/v1/search
Global search across tracks, artists, and playlists.

**Query Parameters:**
- `q` (string, required): Search query
- `type` (string): Filter by type (tracks, artists, playlists, all)
- `limit` (integer): Number of results per type

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "tracks": [
      {
        "id": "track-id",
        "title": "Strobe",
        "artist": "Deadmau5",
        "relevanceScore": 0.95
      }
    ],
    "artists": [
      {
        "id": "artist-id",
        "name": "Deadmau5",
        "trackCount": 234,
        "relevanceScore": 0.92
      }
    ],
    "playlists": [
      {
        "id": "playlist-id",
        "name": "Progressive House Classics",
        "trackCount": 50,
        "relevanceScore": 0.88
      }
    ],
    "totalResults": {
      "tracks": 45,
      "artists": 8,
      "playlists": 12
    }
  }
}
```

### GraphQL API Service (Port 8081)

#### Endpoint: /graphql
GraphQL endpoint for complex queries and real-time subscriptions.

**Schema Overview:**
```graphql
type Query {
  # Track queries
  track(id: ID!): Track
  tracks(filter: TrackFilter, pagination: Pagination): TrackConnection
  
  # Artist queries
  artist(id: ID!): Artist
  artists(filter: ArtistFilter, pagination: Pagination): ArtistConnection
  
  # Graph queries
  getGraphData(filter: GraphFilter): GraphData
  getShortestPath(fromTrackId: ID!, toTrackId: ID!): [Track!]
  getArtistNetwork(artistId: ID!, depth: Int = 2): ArtistNetwork
  
  # Analytics queries
  getTrackAnalytics(trackId: ID!, timeRange: TimeRange): TrackAnalytics
  getTrendingTracks(timeRange: TimeRange, limit: Int = 10): [Track!]
}

type Mutation {
  # Track mutations
  createTrack(input: CreateTrackInput!): Track
  updateTrack(id: ID!, input: UpdateTrackInput!): Track
  deleteTrack(id: ID!): Boolean
  
  # Playlist mutations
  createPlaylist(input: CreatePlaylistInput!): Playlist
  addTrackToPlaylist(playlistId: ID!, trackId: ID!): Playlist
}

type Subscription {
  # Real-time updates
  trackUpdated(trackId: ID): Track
  newTrackAdded: Track
  scrapingProgress: ScrapingStatus
  systemStatus: SystemStatus
}
```

**Complex Query Example:**
```graphql
query GetArtistNetworkWithTracks($artistId: ID!, $depth: Int!) {
  artist(id: $artistId) {
    id
    name
    genre
    tracks(limit: 10, sort: { field: POPULARITY, order: DESC }) {
      edges {
        node {
          id
          title
          bpm
          key
          relationships {
            relatedTrack {
              id
              title
              artist {
                name
              }
            }
            relationshipType
            weight
          }
        }
      }
    }
    collaborations(depth: $depth) {
      artist {
        id
        name
      }
      relationshipStrength
      sharedTracks {
        id
        title
      }
    }
  }
}
```

**Subscription Example:**
```graphql
subscription ScrapingProgress {
  scrapingProgress {
    scraperId
    status
    progress
    tracksProcessed
    estimatedCompletion
    errors {
      message
      timestamp
    }
  }
}
```

## Visualization APIs

### Graph Visualization API (Port 8084)

#### GET /api/graph/network
Get graph network data for visualization.

**Query Parameters:**
- `center_node` (string): Node ID to center the graph around
- `depth` (integer, default: 2): Relationship depth to include
- `max_nodes` (integer, default: 1000): Maximum nodes to return
- `layout` (string): Layout algorithm (force, hierarchical, circular)
- `filter_genre` (string): Filter nodes by genre
- `min_weight` (float): Minimum relationship weight to include

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "track-123",
        "type": "track",
        "label": "Strobe - Deadmau5",
        "metadata": {
          "title": "Strobe",
          "artist": "Deadmau5",
          "bpm": 128,
          "genre": "Progressive House",
          "year": 2009
        },
        "position": {
          "x": 150.5,
          "y": 200.3
        },
        "size": 15,
        "color": "#FF6B6B"
      }
    ],
    "edges": [
      {
        "id": "edge-123-456",
        "source": "track-123",
        "target": "track-456",
        "weight": 0.85,
        "type": "similar",
        "metadata": {
          "similarity_score": 0.85,
          "common_features": ["bpm", "key", "genre"]
        }
      }
    ],
    "layout": {
      "algorithm": "force_directed",
      "bounds": {
        "width": 1000,
        "height": 800
      }
    },
    "statistics": {
      "nodeCount": 247,
      "edgeCount": 1892,
      "density": 0.156,
      "averageDegree": 15.3
    }
  }
}
```

#### POST /api/graph/layout
Calculate new layout for existing graph data.

**Request Body:**
```json
{
  "algorithm": "force_directed",
  "parameters": {
    "iterations": 1000,
    "spring_strength": 0.8,
    "repulsion_strength": 1.2,
    "center_gravity": 0.1
  },
  "nodes": [
    {
      "id": "track-123",
      "weight": 1.0
    }
  ]
}
```

#### GET /api/graph/algorithms/{algorithm}
Get available layout algorithms and their parameters.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "algorithm": "force_directed",
    "description": "Physics-based layout using spring forces",
    "parameters": [
      {
        "name": "iterations",
        "type": "integer",
        "default": 1000,
        "min": 100,
        "max": 10000,
        "description": "Number of simulation iterations"
      },
      {
        "name": "spring_strength",
        "type": "float",
        "default": 0.8,
        "min": 0.1,
        "max": 2.0,
        "description": "Strength of attractive forces"
      }
    ],
    "computational_complexity": "O(n²)",
    "recommended_max_nodes": 5000
  }
}
```

### Enhanced Visualization Service (Ports 8090-8091)

#### GET /api/viz/interactive
Get interactive visualization configuration.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "visualization": {
      "engine": "pixi.js",
      "version": "7.3.2",
      "webgl_enabled": true,
      "max_render_nodes": 10000,
      "performance_mode": "auto"
    },
    "interactions": {
      "zoom": {
        "min": 0.1,
        "max": 10.0,
        "wheel_sensitivity": 1.2
      },
      "pan": {
        "enabled": true,
        "momentum": true
      },
      "selection": {
        "multi_select": true,
        "selection_modes": ["click", "drag", "lasso"]
      }
    },
    "rendering": {
      "antialiasing": true,
      "high_dpi": true,
      "background_color": "#1a1a1a",
      "fps_target": 60
    }
  }
}
```

#### POST /api/viz/export
Export visualization in various formats.

**Request Body:**
```json
{
  "format": "png",
  "width": 1920,
  "height": 1080,
  "quality": 0.9,
  "include_labels": true,
  "background_transparent": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "download_url": "https://api.songnodes.com/exports/viz_20250822_103045.png",
    "format": "png",
    "size_bytes": 2456789,
    "expires_at": "2025-08-23T10:30:45Z"
  }
}
```

#### WebSocket: /ws/visualization
Real-time visualization updates via WebSocket.

**Connection URL:** `ws://localhost:8091/ws/visualization`

**Message Types:**
```json
// Subscribe to graph updates
{
  "type": "subscribe",
  "channel": "graph_updates",
  "filter": {
    "center_node": "track-123",
    "radius": 2
  }
}

// Node position update
{
  "type": "node_update",
  "data": {
    "node_id": "track-123",
    "position": {
      "x": 156.7,
      "y": 203.9
    },
    "timestamp": "2025-08-22T10:30:45Z"
  }
}

// New relationship discovered
{
  "type": "edge_added",
  "data": {
    "edge_id": "edge-123-789",
    "source": "track-123",
    "target": "track-789",
    "weight": 0.76,
    "type": "similar"
  }
}
```

## Data Processing APIs

### Data Transformer Service (Port 8002)

#### POST /api/transform/batch
Submit batch transformation task.

**Request Body:**
```json
{
  "source": "1001tracklists",
  "data": [
    {
      "title": "raw track title - artist name",
      "metadata": {
        "duration": "5:34",
        "bpm": "128 BPM",
        "key": "F# minor"
      }
    }
  ],
  "transformation_config": {
    "normalize_titles": true,
    "extract_artists": true,
    "parse_metadata": true,
    "generate_fingerprints": true
  }
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "task_id": "transform_task_20250822_103045",
  "status": "queued",
  "estimated_completion": "2025-08-22T10:32:00Z",
  "track_count": 1000,
  "progress_url": "/api/transform/tasks/transform_task_20250822_103045"
}
```

#### GET /api/transform/tasks/{task_id}
Get transformation task status and results.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "task_id": "transform_task_20250822_103045",
    "status": "completed",
    "progress": 100,
    "started_at": "2025-08-22T10:30:45Z",
    "completed_at": "2025-08-22T10:31:23Z",
    "statistics": {
      "total_tracks": 1000,
      "successful_transforms": 987,
      "failed_transforms": 13,
      "skipped_duplicates": 45
    },
    "results": [
      {
        "original": {
          "title": "deadmau5 - strobe (original mix)"
        },
        "transformed": {
          "title": "Strobe",
          "artist": "Deadmau5",
          "version": "Original Mix",
          "fingerprint": "sha256:abc123...",
          "confidence_score": 0.95
        }
      }
    ],
    "errors": [
      {
        "index": 45,
        "error": "Unable to parse artist from title",
        "original_data": { /* ... */ }
      }
    ]
  }
}
```

#### POST /api/transform/normalize
Synchronous normalization for real-time processing.

**Request Body:**
```json
{
  "title": "Artist Name - Track Title (Remix)",
  "metadata": {
    "duration": "4:25",
    "bpm": "130.5 BPM"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "title": "Track Title",
    "artist": "Artist Name",
    "version": "Remix",
    "duration_seconds": 265,
    "bpm": 130.5,
    "fingerprint": "sha256:def456...",
    "confidence_score": 0.88,
    "transformations_applied": [
      "title_artist_separation",
      "version_extraction",
      "duration_parsing",
      "bpm_normalization"
    ]
  }
}
```

### Data Validator Service (Port 8003)

#### POST /api/validate/tracks
Validate track data against business rules.

**Request Body:**
```json
{
  "tracks": [
    {
      "title": "Strobe",
      "artist": "Deadmau5",
      "duration": 634,
      "bpm": 128,
      "key": "Fm",
      "genre": "Progressive House"
    }
  ],
  "validation_rules": [
    "schema_validation",
    "quality_checks",
    "business_rules",
    "duplicate_detection"
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "validation_id": "validation_20250822_103045",
    "overall_score": 0.92,
    "results": [
      {
        "track_index": 0,
        "overall_score": 0.92,
        "issues": [
          {
            "type": "WARNING",
            "category": "quality",
            "rule": "genre_consistency",
            "message": "Genre 'Progressive House' not found in standard taxonomy",
            "suggestion": "Consider using 'Progressive House' or 'House'"
          }
        ],
        "validations": {
          "schema": {
            "status": "passed",
            "score": 1.0
          },
          "quality": {
            "status": "passed_with_warnings",
            "score": 0.85,
            "details": {
              "title_quality": 1.0,
              "artist_quality": 1.0,
              "metadata_completeness": 0.7
            }
          },
          "business_rules": {
            "status": "passed",
            "score": 1.0
          },
          "duplicates": {
            "status": "no_duplicates",
            "potential_matches": []
          }
        }
      }
    ]
  }
}
```

## Scraping & Orchestration APIs

### Scraper Orchestrator Service (Port 8001)

#### GET /api/scrapers/status
Get status of all registered scrapers.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "scrapers": [
      {
        "id": "1001tracklists",
        "name": "1001tracklists Scraper",
        "status": "healthy",
        "last_activity": "2025-08-22T10:29:15Z",
        "statistics": {
          "tracks_scraped_today": 1250,
          "success_rate": 0.96,
          "average_response_time": "1.2s",
          "error_count_24h": 12
        },
        "rate_limiting": {
          "requests_per_minute": 60,
          "current_usage": 45,
          "queue_size": 23
        }
      },
      {
        "id": "mixesdb",
        "name": "MixesDB Scraper",
        "status": "rate_limited",
        "last_activity": "2025-08-22T10:28:30Z",
        "next_available": "2025-08-22T10:31:00Z"
      }
    ],
    "overall_status": "operational",
    "total_active_tasks": 156,
    "queue_sizes": {
      "high_priority": 23,
      "normal": 89,
      "low_priority": 44
    }
  }
}
```

#### POST /api/tasks/submit
Submit new scraping task.

**Request Body:**
```json
{
  "scraper": "1001tracklists",
  "priority": "high",
  "target": {
    "type": "tracklist",
    "url": "https://1001tracklists.com/tracklist/12345",
    "metadata": {
      "event": "Ultra Music Festival 2025",
      "artist": "Deadmau5"
    }
  },
  "options": {
    "include_related": true,
    "max_depth": 2,
    "callback_url": "https://yourapp.com/webhook/scraping"
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "task_id": "scraping_task_20250822_103045",
  "status": "queued",
  "priority": "high",
  "estimated_start": "2025-08-22T10:32:00Z",
  "estimated_completion": "2025-08-22T10:35:00Z",
  "progress_url": "/api/tasks/scraping_task_20250822_103045"
}
```

#### GET /api/tasks/{task_id}
Get detailed task progress and results.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "task_id": "scraping_task_20250822_103045",
    "status": "in_progress",
    "progress": 65,
    "started_at": "2025-08-22T10:32:15Z",
    "estimated_completion": "2025-08-22T10:34:30Z",
    "details": {
      "phase": "parsing_tracklist",
      "current_operation": "extracting_track_metadata",
      "tracks_found": 42,
      "tracks_processed": 27,
      "errors": [
        {
          "timestamp": "2025-08-22T10:33:12Z",
          "severity": "warning",
          "message": "Unable to extract BPM for track ID 15",
          "track": "Unknown Artist - Track Title"
        }
      ]
    },
    "results": [
      {
        "title": "Strobe",
        "artist": "Deadmau5",
        "position": 1,
        "metadata": {
          "bpm": 128,
          "key": "Fm",
          "extracted_at": "2025-08-22T10:32:45Z"
        }
      }
    ]
  }
}
```

## WebSocket APIs

### WebSocket API Service (Port 8083)

#### Connection: /ws/connect
Main WebSocket connection endpoint.

**Connection URL:** `ws://localhost:8083/ws/connect?token=jwt_token_here`

**Authentication:**
- JWT token required in URL parameter or header
- Connection established after successful authentication
- Heartbeat every 30 seconds

#### Message Types

**Subscribe to Channels:**
```json
{
  "type": "subscribe",
  "channels": [
    "scraping_progress",
    "graph_updates",
    "system_status"
  ],
  "filters": {
    "scraping_progress": {
      "scrapers": ["1001tracklists", "mixesdb"]
    },
    "graph_updates": {
      "center_node": "track-123",
      "radius": 2
    }
  }
}
```

**Real-time Updates:**
```json
// Scraping Progress Update
{
  "type": "scraping_progress",
  "data": {
    "task_id": "scraping_task_20250822_103045",
    "scraper": "1001tracklists",
    "progress": 75,
    "tracks_found": 45,
    "current_track": "Artist - Track Title",
    "timestamp": "2025-08-22T10:33:45Z"
  }
}

// Graph Node Update
{
  "type": "graph_update",
  "data": {
    "operation": "node_added",
    "node": {
      "id": "track-456",
      "title": "New Track",
      "artist": "New Artist"
    },
    "connections": [
      {
        "target": "track-123",
        "weight": 0.78
      }
    ]
  }
}

// System Status Update
{
  "type": "system_status",
  "data": {
    "component": "database",
    "status": "healthy",
    "metrics": {
      "response_time": 15,
      "active_connections": 45,
      "cpu_usage": 0.35
    }
  }
}
```

## Monitoring & Health APIs

### Health Check Endpoints

#### GET /health
Universal health check endpoint available on all services.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2025-08-22T10:30:45Z",
  "uptime": 86400,
  "version": "1.0.0",
  "service": "api-gateway",
  "dependencies": [
    {
      "name": "postgres",
      "status": "healthy",
      "response_time": 15
    },
    {
      "name": "redis",
      "status": "healthy",
      "response_time": 2
    }
  ]
}
```

#### GET /metrics
Prometheus metrics endpoint (available on all services).

**Response (200 OK):**
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",endpoint="/api/v1/tracks",status="200"} 1250

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",endpoint="/api/v1/tracks",le="0.1"} 1100
http_request_duration_seconds_bucket{method="GET",endpoint="/api/v1/tracks",le="0.5"} 1240
```

### System Monitoring APIs

#### GET /api/system/status
Comprehensive system status overview.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "overall_status": "healthy",
    "timestamp": "2025-08-22T10:30:45Z",
    "services": {
      "api_gateway": {
        "status": "healthy",
        "response_time": 25,
        "requests_per_minute": 1250
      },
      "database": {
        "status": "healthy",
        "connections": 45,
        "query_time": 15
      },
      "cache": {
        "status": "healthy",
        "hit_ratio": 0.89,
        "memory_usage": 0.67
      }
    },
    "performance_metrics": {
      "api_response_time_95th": 85,
      "database_response_time_avg": 15,
      "cache_hit_ratio": 0.89,
      "error_rate_1h": 0.002
    }
  }
}
```

## Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Track validation failed",
    "details": "Title field is required",
    "path": "/api/v1/tracks",
    "timestamp": "2025-08-22T10:30:45Z",
    "request_id": "req_20250822_103045_abc123"
  },
  "validation_errors": [
    {
      "field": "title",
      "message": "Title is required",
      "code": "REQUIRED_FIELD"
    }
  ]
}
```

### Error Codes

- `400 BAD_REQUEST`: Invalid request data
- `401 UNAUTHORIZED`: Authentication required
- `403 FORBIDDEN`: Insufficient permissions
- `404 NOT_FOUND`: Resource not found
- `422 VALIDATION_FAILED`: Data validation errors
- `429 RATE_LIMITED`: Rate limit exceeded
- `500 INTERNAL_ERROR`: Server error
- `503 SERVICE_UNAVAILABLE`: Service temporarily unavailable

## Rate Limiting

### Rate Limit Headers

All API responses include rate limiting headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1692700800
X-RateLimit-Retry-After: 3600
```

### Rate Limit Tiers

- **Guest**: 100 requests/hour
- **User**: 1,000 requests/hour  
- **Premium**: 10,000 requests/hour
- **Enterprise**: 100,000 requests/hour

## SDK Examples

### JavaScript/TypeScript SDK

```typescript
import { SongNodesAPI } from '@songnodes/api-sdk';

const api = new SongNodesAPI({
  baseURL: 'https://api.songnodes.com',
  apiKey: 'your_api_key_here'
});

// Get tracks with filtering
const tracks = await api.tracks.list({
  genre: 'Progressive House',
  bpm_min: 125,
  bpm_max: 135,
  limit: 50
});

// Real-time graph updates
const ws = api.websocket.connect();
ws.subscribe('graph_updates', (update) => {
  console.log('Graph updated:', update);
});

// Submit scraping task
const task = await api.scraping.submit({
  scraper: '1001tracklists',
  target: 'https://1001tracklists.com/tracklist/12345'
});
```

### Python SDK

```python
from songnodes import SongNodesClient

client = SongNodesClient(
    api_key='your_api_key_here',
    base_url='https://api.songnodes.com'
)

# Search for tracks
tracks = client.tracks.search(
    query='progressive house',
    filters={'bpm_range': [125, 135]}
)

# Get graph data
graph = client.visualization.get_graph(
    center_node='track-123',
    depth=2,
    layout='force_directed'
)

# Batch data transformation
result = client.processing.transform_batch(
    data=raw_track_data,
    config={'normalize_titles': True}
)
```

---

**API Documentation Complete**  
**Total Endpoints**: 50+ across 11 services  
**Authentication**: JWT-based with role permissions  
**Real-time**: WebSocket support for live updates  
**Performance**: Sub-100ms response times  
**Status**: Production Ready APIs