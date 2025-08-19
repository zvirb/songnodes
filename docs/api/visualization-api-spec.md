# Visualization Service API Specification

## Overview

The Visualization Service provides comprehensive APIs for interacting with the song relationship graph, including data retrieval, path-finding, search, and real-time updates. This document details all available endpoints, their parameters, responses, and usage examples.

## Base Configuration

```yaml
Base URL: http://localhost:8090/api/v1
WebSocket URL: ws://localhost:8091
Authentication: Bearer Token (JWT)
Rate Limiting: 100 requests/minute per user
Content-Type: application/json
```

## Authentication

All API requests require authentication via JWT tokens in the Authorization header:

```http
Authorization: Bearer <jwt_token>
```

## REST API Endpoints

### Graph Data Endpoints

#### 1. Get Graph Data

Retrieves the main graph structure with nodes and relationships.

```http
GET /api/v1/visualization/graph
```

**Query Parameters:**
```typescript
{
  limit?: number;           // Max nodes to return (default: 1000, max: 10000)
  offset?: number;          // Pagination offset (default: 0)
  filters?: {
    genres?: string[];      // Filter by genres
    artists?: string[];     // Filter by artists
    yearRange?: [number, number];  // Filter by release year
    bpmRange?: [number, number];   // Filter by BPM
    popularity?: number;    // Minimum popularity score
  };
  include?: {
    relationships?: boolean;  // Include relationships (default: true)
    audioFeatures?: boolean; // Include audio features (default: false)
    metadata?: boolean;      // Include metadata (default: false)
  };
  layout?: 'force' | 'hierarchical' | 'circular' | 'spectral';  // Pre-calculate layout
}
```

**Response:**
```json
{
  "data": {
    "nodes": [
      {
        "id": "node_123",
        "title": "Bohemian Rhapsody",
        "artist": "Queen",
        "album": "A Night at the Opera",
        "genre": "Rock",
        "bpm": 147,
        "key": "Bb",
        "energy": 0.404,
        "valence": 0.221,
        "popularity": 89,
        "releaseDate": "1975-10-31",
        "position": {
          "x": 234.5,
          "y": 567.8
        }
      }
    ],
    "relationships": [
      {
        "id": "rel_456",
        "source": "node_123",
        "target": "node_789",
        "weight": 0.85,
        "type": "genre_similarity",
        "confidence": 0.92
      }
    ],
    "statistics": {
      "totalNodes": 5432,
      "totalRelationships": 18976,
      "filteredNodes": 1000,
      "filteredRelationships": 3421
    }
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2024-01-15T10:30:00Z",
    "processingTime": 234
  }
}
```

#### 2. Get Node Details

Retrieves detailed information about a specific node.

```http
GET /api/v1/visualization/node/{nodeId}
```

**Path Parameters:**
- `nodeId`: The unique identifier of the node

**Query Parameters:**
```typescript
{
  includeRelationships?: boolean;  // Include all relationships (default: true)
  relationshipDepth?: number;      // How many hops to include (default: 1, max: 3)
  includeAudioAnalysis?: boolean;  // Include detailed audio analysis
}
```

**Response:**
```json
{
  "data": {
    "node": {
      "id": "node_123",
      "title": "Bohemian Rhapsody",
      "artist": "Queen",
      "fullDetails": {
        "album": "A Night at the Opera",
        "genres": ["Rock", "Progressive Rock", "Art Rock"],
        "releaseDate": "1975-10-31",
        "duration": 354,
        "isrc": "GBUM71505078",
        "audioFeatures": {
          "acousticness": 0.271,
          "danceability": 0.402,
          "energy": 0.404,
          "instrumentalness": 0,
          "liveness": 0.291,
          "loudness": -9.931,
          "speechiness": 0.0528,
          "tempo": 147.059,
          "valence": 0.221,
          "key": 10,
          "mode": 1,
          "time_signature": 4
        }
      },
      "relationships": {
        "incoming": [
          {
            "source": "node_456",
            "weight": 0.78,
            "type": "playlist_sequence"
          }
        ],
        "outgoing": [
          {
            "target": "node_789",
            "weight": 0.85,
            "type": "genre_similarity"
          }
        ]
      },
      "metrics": {
        "centrality": 0.72,
        "clustering": 0.45,
        "pageRank": 0.0023
      }
    }
  }
}
```

#### 3. Get Node Relationships

Retrieves all relationships for a specific node.

```http
GET /api/v1/visualization/relationships/{nodeId}
```

**Query Parameters:**
```typescript
{
  depth?: number;                    // Relationship depth (default: 1, max: 3)
  types?: RelationshipType[];        // Filter by relationship types
  minWeight?: number;                // Minimum weight threshold (0-1)
  direction?: 'incoming' | 'outgoing' | 'both';  // Direction filter
  limit?: number;                    // Max relationships per depth level
  includeIndirect?: boolean;         // Include indirect relationships
}
```

### Path-Finding Endpoints

#### 4. Find Shortest Path

Calculates the shortest path between two nodes.

```http
POST /api/v1/visualization/path/shortest
```

**Request Body:**
```json
{
  "startId": "node_123",
  "endId": "node_456",
  "algorithm": "dijkstra",
  "constraints": {
    "maxLength": 10,
    "minWeight": 0.3,
    "allowedTypes": ["genre_similarity", "playlist_sequence"],
    "avoidNodes": ["node_999"],
    "preferredAttributes": {
      "bpmTolerance": 10,
      "keyCompatibility": true,
      "energyProgression": "ascending"
    }
  },
  "options": {
    "returnAlternatives": true,
    "maxAlternatives": 3,
    "includeMetrics": true
  }
}
```

**Response:**
```json
{
  "data": {
    "primaryPath": {
      "id": "path_001",
      "nodes": ["node_123", "node_234", "node_345", "node_456"],
      "relationships": [
        {
          "from": "node_123",
          "to": "node_234",
          "weight": 0.82,
          "type": "genre_similarity"
        }
      ],
      "metrics": {
        "totalDistance": 3.24,
        "avgWeight": 0.78,
        "smoothness": 0.85,
        "diversity": 0.62,
        "feasibility": 0.91
      }
    },
    "alternatives": [
      {
        "id": "path_002",
        "nodes": ["node_123", "node_789", "node_456"],
        "metrics": {
          "totalDistance": 2.87,
          "avgWeight": 0.71
        }
      }
    ]
  }
}
```

#### 5. Find Multiple Paths (K-Shortest)

Finds K shortest paths between two nodes.

```http
POST /api/v1/visualization/path/k-shortest
```

**Request Body:**
```json
{
  "startId": "node_123",
  "endId": "node_456",
  "k": 5,
  "diversityFactor": 0.7,
  "constraints": {
    "maxLength": 15,
    "minWeight": 0.2
  }
}
```

#### 6. Multi-Waypoint Path

Calculates optimal path through multiple waypoints.

```http
POST /api/v1/visualization/path/multi-waypoint
```

**Request Body:**
```json
{
  "waypoints": ["node_123", "node_456", "node_789"],
  "optimization": "shortest",
  "constraints": {
    "allowReordering": true,
    "returnToStart": false,
    "maxTotalDistance": 50,
    "smoothnessWeight": 0.3,
    "diversityWeight": 0.2
  }
}
```

### Search Endpoints

#### 7. Basic Search

Performs text-based search across nodes.

```http
GET /api/v1/visualization/search
```

**Query Parameters:**
```typescript
{
  q: string;                        // Search query
  type?: 'fuzzy' | 'exact' | 'prefix';  // Search type
  fields?: string[];                // Fields to search in
  limit?: number;                   // Max results (default: 20)
  offset?: number;                  // Pagination offset
}
```

**Response:**
```json
{
  "data": {
    "results": [
      {
        "id": "node_123",
        "title": "Bohemian Rhapsody",
        "artist": "Queen",
        "score": 0.95,
        "highlights": {
          "title": "<em>Bohemian</em> Rhapsody"
        }
      }
    ],
    "totalResults": 42,
    "suggestions": ["bohemian", "bohemian rhapsody queen"]
  }
}
```

#### 8. Advanced Search

Performs multi-criteria advanced search.

```http
POST /api/v1/visualization/search/advanced
```

**Request Body:**
```json
{
  "criteria": {
    "text": {
      "query": "rock",
      "fields": ["genre", "title", "artist"],
      "fuzzy": true
    },
    "filters": {
      "bpmRange": [120, 140],
      "yearRange": [1970, 1980],
      "genres": ["Rock", "Progressive Rock"],
      "key": ["C", "G", "D"],
      "energy": {
        "min": 0.5,
        "max": 0.8
      }
    },
    "similarity": {
      "referenceNodeId": "node_123",
      "threshold": 0.7,
      "attributes": ["genre", "bpm", "key"]
    }
  },
  "options": {
    "limit": 50,
    "offset": 0,
    "sortBy": "relevance",
    "includeFacets": true
  }
}
```

#### 9. Similar Songs

Finds songs similar to a reference song.

```http
GET /api/v1/visualization/similar/{nodeId}
```

**Query Parameters:**
```typescript
{
  limit?: number;                   // Max results
  threshold?: number;               // Similarity threshold (0-1)
  attributes?: string[];            // Attributes to consider
  includeReasons?: boolean;         // Include similarity reasoning
}
```

### Analytics Endpoints

#### 10. Graph Statistics

Retrieves overall graph statistics.

```http
GET /api/v1/visualization/analytics/statistics
```

**Response:**
```json
{
  "data": {
    "graph": {
      "nodeCount": 12543,
      "edgeCount": 45678,
      "density": 0.00058,
      "avgDegree": 7.28,
      "diameter": 12,
      "radius": 6,
      "clusteringCoefficient": 0.42,
      "connectedComponents": 3
    },
    "distributions": {
      "degree": {
        "min": 1,
        "max": 342,
        "mean": 7.28,
        "median": 5,
        "std": 14.3
      },
      "genres": {
        "Rock": 2341,
        "Pop": 1876,
        "Electronic": 1654
      },
      "years": {
        "1970s": 876,
        "1980s": 1243,
        "1990s": 2341
      }
    }
  }
}
```

#### 11. Cluster Detection

Identifies clusters within the graph.

```http
GET /api/v1/visualization/analytics/clusters
```

**Query Parameters:**
```typescript
{
  algorithm?: 'louvain' | 'kmeans' | 'hierarchical' | 'spectral';
  resolution?: number;              // Clustering resolution
  minSize?: number;                 // Minimum cluster size
  maxClusters?: number;              // Maximum number of clusters
}
```

#### 12. Graph Insights

Provides intelligent insights about the graph.

```http
GET /api/v1/visualization/analytics/insights
```

**Query Parameters:**
```typescript
{
  types?: InsightType[];            // Types of insights to generate
  limit?: number;                   // Max insights per type
  context?: string;                 // User context for personalization
}
```

**Response:**
```json
{
  "data": {
    "insights": [
      {
        "type": "bridge_songs",
        "title": "Genre Bridge Songs",
        "description": "Songs that connect different genre clusters",
        "items": [
          {
            "nodeId": "node_123",
            "title": "Bohemian Rhapsody",
            "reason": "Connects Rock and Classical clusters",
            "importance": 0.89
          }
        ]
      },
      {
        "type": "trending_paths",
        "title": "Popular Transitions",
        "description": "Most frequently used song transitions",
        "items": [
          {
            "path": ["node_123", "node_456"],
            "frequency": 234,
            "avgRating": 4.7
          }
        ]
      }
    ]
  }
}
```

### Playlist Generation Endpoints

#### 13. Generate Playlist

Automatically generates a playlist based on criteria.

```http
POST /api/v1/visualization/playlist/generate
```

**Request Body:**
```json
{
  "criteria": {
    "seedSongs": ["node_123", "node_456"],
    "duration": 3600,
    "songCount": 15,
    "mood": "energetic",
    "genres": ["Rock", "Alternative"],
    "era": "1990s",
    "diversity": 0.7,
    "familiarity": 0.5
  },
  "constraints": {
    "noDuplicateArtists": true,
    "smoothTransitions": true,
    "energyProfile": "ascending",
    "excludeSongs": ["node_999"]
  }
}
```

#### 14. Optimize Playlist

Optimizes an existing playlist for better flow.

```http
POST /api/v1/visualization/playlist/optimize
```

**Request Body:**
```json
{
  "playlist": ["node_123", "node_456", "node_789"],
  "optimization": {
    "goals": ["smooth_transitions", "maintain_energy", "genre_coherence"],
    "weights": {
      "transition": 0.4,
      "diversity": 0.3,
      "popularity": 0.3
    }
  },
  "constraints": {
    "preserveFirst": true,
    "preserveLast": true,
    "maxReorder": 5
  }
}
```

### Export Endpoints

#### 15. Export Graph Data

Exports graph data in various formats.

```http
POST /api/v1/visualization/export/graph
```

**Request Body:**
```json
{
  "format": "graphml",
  "nodes": ["node_123", "node_456"],
  "includeRelationships": true,
  "options": {
    "compression": "gzip",
    "includeMetadata": true
  }
}
```

**Supported Formats:**
- `json`: Standard JSON format
- `graphml`: GraphML XML format
- `gexf`: Gephi format
- `csv`: Comma-separated values
- `cytoscape`: Cytoscape.js format

#### 16. Export Playlist

Exports a playlist to various music platforms.

```http
POST /api/v1/visualization/export/playlist
```

**Request Body:**
```json
{
  "playlist": ["node_123", "node_456", "node_789"],
  "platform": "spotify",
  "options": {
    "name": "My Discovery Playlist",
    "description": "Generated from SongNodes",
    "public": false
  }
}
```

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('ws://localhost:8091');

// Authentication after connection
ws.send(JSON.stringify({
  type: 'auth',
  token: 'your_jwt_token'
}));
```

### Event Types

#### Client to Server Events

##### 1. Subscribe to Graph Updates

```json
{
  "type": "subscribe",
  "channel": "graph",
  "params": {
    "nodeIds": ["node_123", "node_456"],
    "depth": 2,
    "includeRelationships": true
  }
}
```

##### 2. Request Path Calculation

```json
{
  "type": "calculate_path",
  "requestId": "req_123",
  "params": {
    "start": "node_123",
    "end": "node_456",
    "algorithm": "dijkstra",
    "realtime": true
  }
}
```

##### 3. Collaborative Session

```json
{
  "type": "session",
  "action": "create",
  "params": {
    "name": "Playlist Creation Session",
    "public": false,
    "maxParticipants": 5
  }
}
```

##### 4. Real-time Search

```json
{
  "type": "search",
  "query": "queen",
  "streaming": true,
  "params": {
    "limit": 10,
    "fields": ["title", "artist"]
  }
}
```

#### Server to Client Events

##### 1. Graph Update

```json
{
  "type": "graph_update",
  "data": {
    "added": [
      {
        "id": "node_new",
        "title": "New Song",
        "artist": "New Artist"
      }
    ],
    "modified": [
      {
        "id": "node_123",
        "changes": {
          "popularity": 91
        }
      }
    ],
    "removed": ["node_old"]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

##### 2. Path Calculation Progress

```json
{
  "type": "path_progress",
  "requestId": "req_123",
  "status": "calculating",
  "progress": 0.45,
  "nodesExplored": 234,
  "currentBest": {
    "distance": 4.5,
    "nodes": 5
  }
}
```

##### 3. Path Calculation Result

```json
{
  "type": "path_result",
  "requestId": "req_123",
  "status": "complete",
  "data": {
    "path": ["node_123", "node_234", "node_456"],
    "distance": 3.2,
    "confidence": 0.89
  }
}
```

##### 4. Session Update

```json
{
  "type": "session_update",
  "sessionId": "session_456",
  "event": "user_action",
  "data": {
    "userId": "user_789",
    "action": "select_node",
    "nodeId": "node_123",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

##### 5. Search Results Stream

```json
{
  "type": "search_results",
  "query": "queen",
  "results": [
    {
      "id": "node_123",
      "title": "Bohemian Rhapsody",
      "artist": "Queen",
      "score": 0.95
    }
  ],
  "hasMore": true,
  "total": 42
}
```

## GraphQL API

### Schema

```graphql
schema {
  query: Query
  mutation: Mutation
  subscription: Subscription
}

type Query {
  # Node operations
  node(id: ID!): SongNode
  nodes(
    filter: NodeFilter
    pagination: PaginationInput
    sort: SortInput
  ): NodeConnection!
  
  # Relationship operations
  relationships(
    nodeId: ID!
    filter: RelationshipFilter
  ): [Relationship!]!
  
  # Path operations
  shortestPath(
    start: ID!
    end: ID!
    constraints: PathConstraints
  ): Path
  
  kShortestPaths(
    start: ID!
    end: ID!
    k: Int!
    diversity: Float
  ): [Path!]!
  
  # Search operations
  search(
    query: String!
    type: SearchType
    limit: Int
  ): SearchResult!
  
  # Analytics
  statistics: GraphStatistics!
  clusters(params: ClusterParams): [Cluster!]!
  insights(types: [InsightType!]): [Insight!]!
}

type Mutation {
  # Playlist operations
  createPlaylist(input: PlaylistInput!): Playlist!
  updatePlaylist(id: ID!, input: PlaylistInput!): Playlist!
  deletePlaylist(id: ID!): Boolean!
  
  # User preferences
  rateTransition(
    from: ID!
    to: ID!
    rating: Float!
  ): Relationship!
  
  saveView(input: ViewInput!): SavedView!
  
  # Session operations
  createSession(input: SessionInput!): Session!
  joinSession(id: ID!): SessionMembership!
  leaveSession(id: ID!): Boolean!
}

type Subscription {
  # Real-time updates
  graphUpdates(filter: UpdateFilter): GraphUpdate!
  pathProgress(requestId: ID!): PathProgress!
  sessionUpdates(sessionId: ID!): SessionEvent!
  searchResults(query: String!): SearchUpdate!
}

# Core Types
type SongNode {
  id: ID!
  title: String!
  artist: String!
  album: String
  genre: [String!]
  releaseDate: Date
  duration: Int
  bpm: Float
  key: String
  energy: Float
  valence: Float
  popularity: Int
  audioFeatures: AudioFeatures
  relationships(filter: RelationshipFilter): [Relationship!]!
  metrics: NodeMetrics
}

type Relationship {
  id: ID!
  source: SongNode!
  target: SongNode!
  weight: Float!
  type: RelationshipType!
  confidence: Float
  context: [RelationshipContext!]
  metadata: JSON
}

type Path {
  id: ID!
  nodes: [SongNode!]!
  relationships: [Relationship!]!
  distance: Float!
  metrics: PathMetrics!
}

type AudioFeatures {
  acousticness: Float
  danceability: Float
  energy: Float
  instrumentalness: Float
  liveness: Float
  loudness: Float
  speechiness: Float
  tempo: Float
  valence: Float
  key: Int
  mode: Int
  timeSignature: Int
}

# Input Types
input NodeFilter {
  genres: [String!]
  artists: [String!]
  yearRange: YearRange
  bpmRange: FloatRange
  energyRange: FloatRange
  popularityMin: Int
  ids: [ID!]
}

input PathConstraints {
  maxLength: Int
  minWeight: Float
  allowedTypes: [RelationshipType!]
  avoidNodes: [ID!]
  smoothness: Float
  diversity: Float
}

input PaginationInput {
  limit: Int
  offset: Int
  cursor: String
}

# Enums
enum RelationshipType {
  PLAYLIST_SEQUENCE
  GENRE_SIMILARITY
  ARTIST_COLLABORATION
  REMIX_VARIANT
  BPM_HARMONIC
  KEY_COMPATIBLE
  ENERGY_MATCH
  USER_PREFERENCE
  DJ_MIX_TRANSITION
}

enum SearchType {
  FUZZY
  EXACT
  PREFIX
  SIMILARITY
}

enum SortField {
  TITLE
  ARTIST
  RELEASE_DATE
  POPULARITY
  BPM
  ENERGY
}

enum SortOrder {
  ASC
  DESC
}
```

### Example Queries

#### Get Node with Relationships

```graphql
query GetNodeDetails($nodeId: ID!) {
  node(id: $nodeId) {
    id
    title
    artist
    album
    genre
    bpm
    key
    audioFeatures {
      energy
      valence
      danceability
    }
    relationships(filter: { minWeight: 0.5 }) {
      target {
        id
        title
        artist
      }
      weight
      type
    }
    metrics {
      centrality
      clustering
      pageRank
    }
  }
}
```

#### Find Shortest Path

```graphql
query FindPath($start: ID!, $end: ID!) {
  shortestPath(
    start: $start
    end: $end
    constraints: {
      maxLength: 10
      minWeight: 0.3
      smoothness: 0.7
    }
  ) {
    nodes {
      id
      title
      artist
    }
    distance
    metrics {
      smoothness
      diversity
      feasibility
    }
  }
}
```

#### Search with Filters

```graphql
query SearchSongs($query: String!) {
  search(
    query: $query
    type: FUZZY
    limit: 20
  ) {
    results {
      node {
        id
        title
        artist
        genre
        popularity
      }
      score
      highlights
    }
    totalCount
    suggestions
  }
}
```

### Example Mutations

#### Create Playlist

```graphql
mutation CreatePlaylist($input: PlaylistInput!) {
  createPlaylist(input: $input) {
    id
    name
    description
    songs {
      id
      title
      artist
    }
    duration
    metrics {
      coherence
      diversity
      energy
    }
  }
}
```

#### Rate Transition

```graphql
mutation RateTransition($from: ID!, $to: ID!, $rating: Float!) {
  rateTransition(from: $from, to: $to, rating: $rating) {
    source {
      id
      title
    }
    target {
      id
      title
    }
    weight
    confidence
  }
}
```

### Example Subscriptions

#### Real-time Graph Updates

```graphql
subscription GraphUpdates {
  graphUpdates(filter: { types: [PLAYLIST_SEQUENCE, GENRE_SIMILARITY] }) {
    added {
      id
      title
      artist
    }
    modified {
      id
      changes
    }
    removed
    timestamp
  }
}
```

#### Path Calculation Progress

```graphql
subscription PathProgress($requestId: ID!) {
  pathProgress(requestId: $requestId) {
    status
    progress
    nodesExplored
    currentBest {
      distance
      nodeCount
    }
    estimatedTimeRemaining
  }
}
```

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "INVALID_PATH",
    "message": "No path exists between the specified nodes",
    "details": {
      "startNode": "node_123",
      "endNode": "node_456",
      "exploredNodes": 1234,
      "searchTime": 523
    },
    "suggestions": [
      "Try relaxing the weight constraints",
      "Check if nodes are in the same connected component"
    ]
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| `INVALID_NODE_ID` | 404 | Node with specified ID not found |
| `INVALID_PATH` | 404 | No path exists between nodes |
| `CONSTRAINT_VIOLATION` | 400 | Path constraints cannot be satisfied |
| `GRAPH_TOO_LARGE` | 413 | Requested graph exceeds size limits |
| `RATE_LIMIT_EXCEEDED` | 429 | API rate limit exceeded |
| `INVALID_ALGORITHM` | 400 | Specified algorithm not supported |
| `SEARCH_TIMEOUT` | 408 | Search operation timed out |
| `INVALID_FILTER` | 400 | Invalid filter parameters |
| `AUTH_REQUIRED` | 401 | Authentication required |
| `PERMISSION_DENIED` | 403 | Insufficient permissions |
| `SERVER_ERROR` | 500 | Internal server error |

## Rate Limiting

### Limits by Endpoint

| Endpoint Category | Requests/Minute | Burst Limit |
|------------------|-----------------|-------------|
| Graph Data | 100 | 200 |
| Path Finding | 20 | 30 |
| Search | 60 | 100 |
| Analytics | 30 | 50 |
| Export | 10 | 15 |
| WebSocket Messages | 100 | 150 |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1642248000
X-RateLimit-Retry-After: 30
```

## Performance Considerations

### Caching Strategy

```yaml
Cache Layers:
  CDN:
    - Static assets (JS, CSS, images)
    - Public graph layouts
    - Common search results
    
  Redis:
    - Session data
    - Recent paths
    - User preferences
    - Computed metrics
    
  Browser:
    - LocalStorage for user settings
    - IndexedDB for offline data
    - Service Worker for PWA support
```

### Query Optimization

```yaml
Best Practices:
  - Use pagination for large result sets
  - Specify only required fields in GraphQL
  - Cache frequently accessed paths
  - Use appropriate indexes in filters
  - Batch multiple related requests
  - Use WebSocket for real-time needs
  - Implement client-side debouncing
```

## SDK Examples

### JavaScript/TypeScript

```typescript
import { VisualizationClient } from '@songnodes/visualization-sdk';

const client = new VisualizationClient({
  apiUrl: 'http://localhost:8090/api/v1',
  wsUrl: 'ws://localhost:8091',
  token: 'your_jwt_token'
});

// Get graph data
const graph = await client.getGraph({
  limit: 1000,
  filters: {
    genres: ['Rock', 'Alternative']
  }
});

// Find shortest path
const path = await client.findShortestPath({
  startId: 'node_123',
  endId: 'node_456',
  constraints: {
    maxLength: 10,
    smoothness: 0.7
  }
});

// Subscribe to real-time updates
client.subscribe('graph_updates', (update) => {
  console.log('Graph updated:', update);
});

// Search songs
const results = await client.search('queen', {
  type: 'fuzzy',
  limit: 20
});
```

### Python

```python
from songnodes import VisualizationClient

client = VisualizationClient(
    api_url='http://localhost:8090/api/v1',
    ws_url='ws://localhost:8091',
    token='your_jwt_token'
)

# Get graph data
graph = client.get_graph(
    limit=1000,
    filters={
        'genres': ['Rock', 'Alternative']
    }
)

# Find shortest path
path = client.find_shortest_path(
    start_id='node_123',
    end_id='node_456',
    constraints={
        'max_length': 10,
        'smoothness': 0.7
    }
)

# Async context for WebSocket
async with client.websocket() as ws:
    await ws.subscribe('graph_updates')
    async for update in ws:
        print(f'Graph updated: {update}')
```

## Testing

### API Testing with cURL

```bash
# Get graph data
curl -X GET "http://localhost:8090/api/v1/visualization/graph?limit=100" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Find shortest path
curl -X POST "http://localhost:8090/api/v1/visualization/path/shortest" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startId": "node_123",
    "endId": "node_456",
    "algorithm": "dijkstra"
  }'

# Search songs
curl -X GET "http://localhost:8090/api/v1/visualization/search?q=queen&type=fuzzy" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### WebSocket Testing with wscat

```bash
# Install wscat
npm install -g wscat

# Connect to WebSocket
wscat -c ws://localhost:8091

# Authenticate
> {"type": "auth", "token": "YOUR_TOKEN"}

# Subscribe to updates
> {"type": "subscribe", "channel": "graph", "params": {"depth": 2}}

# Request path calculation
> {"type": "calculate_path", "requestId": "req_123", "params": {"start": "node_123", "end": "node_456"}}
```

## Conclusion

This API specification provides a comprehensive interface for interacting with the SongNodes visualization service. The combination of REST, GraphQL, and WebSocket APIs ensures that developers can choose the most appropriate protocol for their use case, whether it's bulk data retrieval, complex queries, or real-time updates.