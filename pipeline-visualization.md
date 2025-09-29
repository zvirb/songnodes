# SongNodes Data Pipeline Visualization

## 📊 Complete Data Flow

```mermaid
graph TB
    subgraph "1. Data Sources"
        TL[1001Tracklists.com]
        MDB[MixesDB.com]
        SF[Setlist.fm]
    end

    subgraph "2. Orchestration Layer"
        RQ[Redis Queue<br/>141 tasks queued]
        SO[Scraper Orchestrator<br/>:8001]
        RQC[Redis Queue Consumer]
    end

    subgraph "3. Scraper Services"
        S1[Scraper-1001tracklists<br/>:8011]
        S2[Scraper-MixesDB<br/>:8012]
        S3[Scraper-Setlistfm<br/>:8013]
    end

    subgraph "4. Data Processing"
        RDS[real_data_scraper.py]
        DBP[database_pipeline.py<br/>formerly simple_database_pipeline]
        RD[raw_data_store.py<br/>Backup Storage]
    end

    subgraph "5. PostgreSQL Database"
        direction LR
        AT[artists table<br/>4 records]
        ST[songs table<br/>1012 records]
        PT[playlists table<br/>1 record]
        SAT[song_adjacency table<br/>2 records]
    end

    subgraph "6. API Services"
        AG[API Gateway<br/>:8080]
        GV[Graph Visualization API<br/>:8084]
        RA[REST API<br/>:8082]
    end

    subgraph "7. Frontend"
        FE[React Frontend<br/>:3006]
        D3[D3.js Graph]
        PX[PIXI.js Renderer]
    end

    %% Data flow connections
    TL -.->|Web Scraping| S1
    MDB -.->|Web Scraping| S2
    SF -.->|Web Scraping| S3

    SO -->|Pushes Tasks| RQ
    RQ -->|Consumes| RQC
    RQC -->|HTTP POST /scrape| S1

    S1 -->|Process| RDS
    RDS -->|Items| DBP
    DBP -->|Batch Insert| AT
    DBP -->|Batch Insert| ST
    DBP -->|Batch Insert| PT
    DBP -->|Batch Insert| SAT
    RDS -->|Backup| RD

    AT --> GV
    ST --> GV
    SAT --> GV
    PT --> GV

    GV -->|Graph Data| AG
    RA -->|Target Tracks| AG
    AG -->|JSON| FE
    FE --> D3
    FE --> PX

    style RQ fill:#ff9999
    style SAT fill:#ffcc99
    style PT fill:#ffcc99
```

## 🔄 Current Pipeline Status

### ✅ Working Components:
1. **Redis Queue**: 141 tasks queued and being processed
2. **Scraper Services**: All running and responding to health checks
3. **Data Processing**: Successfully processing tracks and playlists
4. **Database Storage**:
   - Songs: 1012 ✅
   - Artists: 4 ✅
   - Playlists: 1 ✅ (fixed)
   - Adjacencies: 2 ✅ (consecutive tracks only)

### ⚠️ Issues:
1. **Graph Visualization API**: Returns empty graph despite data in database
2. **Frontend**: Not showing adjacency connections

## 📈 Data Processing Flow

### Step 1: Task Creation
```
Orchestrator → Creates search tasks → Redis Queue
```

### Step 2: Task Consumption
```
Redis Queue Consumer → Pulls task → Calls Scraper API
```

### Step 3: Scraping
```python
# real_data_scraper.py
1. Search for playlists containing target track
2. Scrape playlist data from web
3. Generate playlist with consecutive tracks
```

### Step 4: Processing
```python
# database_pipeline.py
1. Process playlist item → Convert dates
2. Process track items → Store songs
3. Process adjacency items → Only consecutive tracks (i→i+1)
```

### Step 5: Database Storage
```sql
-- Adjacency Example
song_adjacency:
  Levels → Deadmau5 - Strobe (distance: 1)
  Deadmau5 - Strobe → Boom (distance: 1)
```

### Step 6: API Layer
```
Graph API → Queries database → Should return nodes + edges
Currently: Returns nodes but NO edges ❌
```

### Step 7: Visualization
```
Frontend → Requests /graph → Should display connected nodes
Currently: Shows isolated nodes ❌
```

## 🔍 Key Insights

1. **Adjacency = Consecutive Only**: Tracks must be played directly next to each other
2. **Distance Always 1**: Because we only track immediate neighbors
3. **Deduplication**: Happens at scraper, pipeline, and database levels
4. **Date Conversion**: ISO timestamps → PostgreSQL DATE format

## 🐛 Current Bug
The Graph Visualization API (`/graph` endpoint) is:
- ✅ Reading songs from database
- ❌ Not including adjacency relationships as edges
- ❌ Returning `{nodes: [], links: []}` instead of populated data

## 🎯 Next Steps
1. Fix Graph Visualization API to include adjacency edges
2. Ensure frontend receives and renders the connections
3. Process remaining 141 tasks in queue for more adjacency data