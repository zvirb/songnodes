# DJ-Focused Graph Visualization Requirements

## 🎯 Core Mission
Transform the graph visualization from a static network view into an **interactive DJ mixing assistant** that helps DJs discover track connections and build better setlists based on real-world mixing data.

## 🎵 Essential DJ Features

### 1. Track Information Display
**Current Issue**: Nodes show no information about tracks
**Solution**:
- Display track name, artist, BPM, key on hover
- Color-code nodes by:
  - Genre (primary)
  - BPM range (secondary mode)
  - Key/Camelot wheel position (harmonic mode)
- Node size = popularity (how many sets include this track)

### 2. Edge Visualization (Mix Relationships)
**Current Issue**: Edges are invisible or too faint
**Solution**:
- Edge thickness = occurrence_count (how often mixed together)
- Edge color/style indicates:
  - Green solid: Direct transition (distance=1)
  - Blue dashed: Close proximity (distance=2)
  - Gray dotted: Same set but further apart (distance=3)
- Edge opacity = confidence (based on occurrence count)
- Animated flow direction showing typical mixing direction

### 3. Interactive Navigation
**Current Issue**: Can't navigate between nodes or explore relationships
**Solution**:
- **Click node**: Highlight all connected tracks
- **Double-click**: Focus view on node and immediate neighbors
- **Right-click menu**:
  - "Show compatible tracks" (BPM ±8%, harmonic keys)
  - "Find path to..." (shortest mixing path to another track)
  - "Add to setlist"
  - "Show track details"
- **Keyboard shortcuts**:
  - Arrow keys: Navigate between connected nodes
  - Space: Play preview (if available)
  - Enter: Add to setlist

### 4. DJ Setlist Builder Panel
**New Feature**: Side panel for building setlists
- Drag & drop tracks from graph
- Auto-suggest next track based on:
  - BPM progression
  - Key compatibility
  - Energy flow
  - Historical success rate
- Show mixing notes:
  - BPM difference
  - Key relationship
  - Suggested transition type
- Export setlist to:
  - Text format
  - Rekordbox XML
  - Serato crate

### 5. Advanced Filtering
**Current Issue**: Can't filter the massive graph
**Solution**:
- BPM range slider (e.g., 120-130 BPM)
- Key selector (Camelot wheel interface)
- Genre tags
- Energy level (1-10 scale)
- Year/era
- Minimum connection strength
- Hide unconnected nodes option

### 6. Harmonic Mixing Overlay
**New Feature**: Camelot wheel visualization
- Show current track position on wheel
- Highlight compatible keys:
  - Same key (perfect match)
  - ±1 on wheel (compatible)
  - Relative major/minor
- Color edges by harmonic compatibility

### 7. BPM Transition Helper
**New Feature**: BPM ladder visualization
- Show BPM progression path
- Suggest intermediate tracks for large BPM jumps
- Display percentage change between tracks
- Warn about difficult transitions (>10% change)

### 8. Performance Metrics
**New Feature**: Track success indicators
- "Dancefloor tested" rating based on:
  - Number of DJs who've played it
  - Average set position (opener/peak/closer)
  - Remix vs original popularity
- Trending indicator (recently popular)
- Classic/anthem badge

## 🛠 Technical Implementation Requirements

### Graph Rendering Fixes
1. **Edge Rendering**:
   ```javascript
   // Minimum edge opacity for visibility
   const minOpacity = 0.3;
   const maxOpacity = 1.0;

   // Scale thickness by occurrence count
   const thickness = Math.log(occurrenceCount + 1) * 2;

   // Different edge styles for relationship types
   if (distance === 1) {
     // Direct transition - solid line
     strokeStyle = 'solid';
     color = '#10B981'; // green
   } else if (distance === 2) {
     // One track between - dashed
     strokeStyle = 'dashed';
     color = '#3B82F6'; // blue
   }
   ```

2. **Node Labels**:
   ```javascript
   // Always show labels for high-importance nodes
   if (node.connections > 10 || node.playCount > 50) {
     showLabel = true;
     labelSize = 12;
   }

   // Show on hover for others
   onHover: () => {
     showTooltip({
       title: node.trackName,
       artist: node.artistName,
       bpm: node.bpm || 'Unknown',
       key: node.key || 'Unknown',
       genre: node.genre,
       connections: node.edgeCount
     });
   }
   ```

### Data Requirements
1. **Populate BPM/Key data**:
   - Integrate Spotify API for track metadata
   - Use AcousticBrainz for open-source analysis
   - Allow manual entry/correction

2. **Enhance adjacency data**:
   - Track transition success rate
   - Store actual mix points (timestamps)
   - Record DJ/event context

### UI Components Needed
1. **Track Info Card** (Material-UI Card)
2. **Setlist Builder** (Drag & drop list)
3. **Filter Panel** (Sliders, checkboxes)
4. **Camelot Wheel** (Custom SVG component)
5. **BPM Ladder** (Vertical progression viz)
6. **Search Bar** (Autocomplete with fuzzy matching)

## 🎯 Success Metrics
- DJs can find compatible next tracks in <3 seconds
- Edge relationships are clearly visible
- Can build a 1-hour setlist in <10 minutes
- Graph loads and renders smoothly with 1000+ nodes
- Mobile responsive for iPad use in DJ booths

## 🚀 Implementation Priority
1. **Fix edge visibility** (Critical)
2. **Add node labels/tooltips** (Critical)
3. **Implement click navigation** (High)
4. **Add filter panel** (High)
5. **Build setlist panel** (Medium)
6. **Add harmonic overlay** (Medium)
7. **Integrate BPM/key data** (Medium)
8. **Add export features** (Low)