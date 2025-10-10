# Community Detection & Neighborhood Highlighting Implementation

## Overview

This document describes the complete implementation of community detection and neighborhood highlighting features for the SongNodes music graph visualization.

## Features Implemented

### 1. Neighborhood Highlighting ✅

**Location**: `/mnt/my_external_drive/programming/songnodes/frontend/src/hooks/useGraphInteraction.ts`

**Functionality**:
- Click a node to highlight it and its immediate neighbors (1-hop)
- Double-click a node to highlight it and extended neighbors (2-hop)
- Dim all non-highlighted nodes to 0.2 opacity
- Show edge connections clearly between highlighted nodes
- Support for modifier keys (Ctrl/Shift) for multi-select without triggering highlight

**Key Implementation**:
```typescript
const handleNodeClick = useCallback((node: GraphNode, event?: MouseEvent | React.MouseEvent) => {
  const isCtrlPressed = event?.ctrlKey || event?.metaKey;
  const isShiftPressed = event?.shiftKey;

  if (isCtrlPressed || isShiftPressed) {
    // Multi-select without highlighting
    selectNode(node.id);
  } else {
    // Single selection with neighborhood highlighting
    selectNode(node.id);
    const neighborhood = getNeighborhood(graphData, node.id, 1);

    if (highlightNeighborhood) {
      highlightNeighborhood(node.id, neighborhood.nodes.map(n => n.id));
    }
  }
}, [selectNode, highlightNeighborhood, graphData]);
```

### 2. Community Detection with Louvain Algorithm ✅

**Location**: `/mnt/my_external_drive/programming/songnodes/frontend/src/utils/communityDetection.ts`

**Features**:
- Uses `graphology` and `graphology-communities-louvain` libraries
- Converts GraphData to/from graphology format
- Detects communities with configurable resolution parameter
- Calculates modularity score (quality metric)
- Computes community metadata:
  - Average BPM
  - Dominant genre
  - Key distribution
  - Centroid position
  - Community color (auto-generated)

**Algorithm Parameters**:
- `resolution`: Controls granularity (default: 1.0)
  - Higher values (1.5-2.0) = more smaller communities
  - Lower values (0.5-0.8) = fewer larger communities

**Modularity Score**:
- Range: -0.5 to 1.0
- > 0.3: Strong community structure
- 0.2-0.3: Moderate community structure
- < 0.2: Weak community structure

**Example Output**:
```typescript
{
  communities: [
    {
      id: 0,
      nodes: ["node1", "node2", "node3"],
      size: 3,
      color: "#3498db",
      centroid: { x: 150, y: 200 },
      averageBPM: 128,
      dominantGenre: "house",
      keyDistribution: { "A Minor": 5, "C Major": 3 }
    }
  ],
  nodesCommunityMap: Map { "node1" => 0, "node2" => 0 },
  modularity: 0.42,
  communityCount: 8
}
```

### 3. Community Cluster UI Component ✅

**Location**: `/mnt/my_external_drive/programming/songnodes/frontend/src/components/CommunityCluster.tsx`

**Components**:
1. **CommunityCluster**: Individual community card
2. **CommunityClusterList**: Container for all communities

**Features**:
- Collapsible super-nodes
- Click to expand/collapse
- Shows metadata:
  - Community size (track count)
  - Average BPM / BPM range
  - Dominant genre
  - Top 3 keys with counts
- Lists all tracks in expanded view
- Click track to navigate to node on graph
- Color-coded by community
- Sorted by size (largest first)

**Visual Design**:
- Border and background tinted with community color
- Pills for metadata (BPM, track count)
- Icons for different metadata types
- Smooth transitions on expand/collapse
- Scrollable track list (max-height: 256px)

### 4. Zustand Store Integration ✅

**Location**: `/mnt/my_external_drive/programming/songnodes/frontend/src/store/useStore.ts`

**New State**:
```typescript
communityState: {
  communities: Community[];
  nodesCommunityMap: Map<string, number>;
  modularity: number;
  communityCount: number;
  expandedCommunities: Set<number>;
  highlightedNode: string | null;
  highlightedNeighbors: Set<string>;
  isDetecting: boolean;
  lastDetectionTime: number | null;
}
```

**New Actions**:
```typescript
community: {
  detectCommunities: (resolution?: number) => void;
  setCommunityResults: (results: CommunityDetectionResult) => void;
  toggleCommunityExpanded: (communityId: number) => void;
  expandCommunity: (communityId: number) => void;
  collapseCommunity: (communityId: number) => void;
  highlightNeighborhood: (nodeId: string, neighborIds: string[]) => void;
  clearHighlight: () => void;
  filterByCommunities: (communityIds: number[]) => void;
  resetCommunities: () => void;
}
```

## Usage Examples

### Detect Communities

```typescript
import useStore from './store/useStore';

function MyCommunityPanel() {
  const detectCommunities = useStore(state => state.community.detectCommunities);
  const communityState = useStore(state => state.communityState);

  const handleDetect = async () => {
    // Default resolution = 1.0
    await detectCommunities();

    // Or with custom resolution
    // await detectCommunities(1.5); // More communities
    // await detectCommunities(0.7); // Fewer communities
  };

  return (
    <div>
      <button onClick={handleDetect} disabled={communityState.isDetecting}>
        {communityState.isDetecting ? 'Detecting...' : 'Detect Communities'}
      </button>

      {communityState.communities.length > 0 && (
        <div>
          <p>Found {communityState.communityCount} communities</p>
          <p>Modularity: {communityState.modularity.toFixed(3)}</p>
        </div>
      )}
    </div>
  );
}
```

### Display Community List

```typescript
import { CommunityClusterList } from './components/CommunityCluster';
import useStore from './store/useStore';

function MyCommunityPanel() {
  const communityState = useStore(state => state.communityState);
  const toggleExpanded = useStore(state => state.community.toggleCommunityExpanded);
  const navigateToNode = useStore(state => state.view.navigateToNode);

  const handleNodeClick = (nodeId: string) => {
    navigateToNode(nodeId, { highlight: true, selectNode: true });
  };

  return (
    <CommunityClusterList
      communities={communityState.communities}
      expandedCommunities={communityState.expandedCommunities}
      onToggle={toggleExpanded}
      onNodeClick={handleNodeClick}
    />
  );
}
```

### Highlight Neighborhood on Node Click

```typescript
import { useGraphInteraction } from './hooks/useGraphInteraction';

function MyGraphComponent() {
  const {
    handleNodeClick,
    handleDoubleClick,
    handleClearHighlight
  } = useGraphInteraction();

  return (
    <div>
      {/* Nodes render here */}
      {nodes.map(node => (
        <div
          key={node.id}
          onClick={(e) => handleNodeClick(node, e)} // 1-hop neighborhood
          onDoubleClick={() => handleDoubleClick(node)} // 2-hop neighborhood
        />
      ))}

      <button onClick={handleClearHighlight}>Clear Highlight</button>
    </div>
  );
}
```

### Filter by Communities

```typescript
function MyCommunityPanel() {
  const filterByCommunities = useStore(state => state.community.filterByCommunities);
  const [selectedCommunityIds, setSelectedCommunityIds] = useState<number[]>([]);

  const handleApplyFilter = async () => {
    if (selectedCommunityIds.length > 0) {
      await filterByCommunities(selectedCommunityIds);
    }
  };

  return (
    <div>
      {/* Community selection UI */}
      <button onClick={handleApplyFilter}>
        Filter Graph ({selectedCommunityIds.length} communities)
      </button>
    </div>
  );
}
```

## Performance Considerations

### Community Detection
- **Cache Results**: Detection results are cached in store with `lastDetectionTime`
- **Async Operation**: Detection runs asynchronously to avoid blocking UI
- **Loading State**: `isDetecting` flag shows progress indicator
- **Error Handling**: Try-catch with user-friendly error messages

### Neighborhood Highlighting
- **O(1) Lookup**: Uses Map for neighbor lookup
- **BFS Algorithm**: Efficient breadth-first search for neighborhood
- **Distance Parameter**: Configurable hop distance (1 or 2)
- **Event Debouncing**: Prevents rapid-fire updates

### Memory Management
- **Lazy Loading**: Community detection utility loaded dynamically
- **Set Data Structures**: Efficient membership testing for highlighted nodes
- **Cleanup**: `clearHighlight()` resets state when done

## Algorithm Details

### Louvain Algorithm
The Louvain method is a greedy optimization algorithm that:

1. **Phase 1**: Each node starts in its own community
2. **Phase 2**: For each node, evaluate modularity gain by moving to neighbor communities
3. **Phase 3**: Move node to community with highest modularity gain
4. **Phase 4**: Build new graph where communities become super-nodes
5. **Repeat** until modularity stops increasing

**Complexity**: O(n log n) where n = number of nodes

### Modularity Calculation
```
Q = 1/(2m) * Σ [A_ij - (k_i * k_j)/(2m)] * δ(c_i, c_j)

Where:
- m = total edges
- A_ij = adjacency matrix (1 if edge exists, 0 otherwise)
- k_i, k_j = degrees of nodes i and j
- δ(c_i, c_j) = 1 if nodes in same community, 0 otherwise
```

## Visual Design Suggestions for Super-Nodes

### Collapsed State (Community Super-Node)
```
┌─────────────────────────────┐
│  👥 Community 0             │
│  128 tracks • house         │
│                             │
│  [128 BPM] [128 nodes]      │
└─────────────────────────────┘
```

### Expanded State
```
┌─────────────────────────────┐
│  👥 Community 0         ▼   │
│  128 tracks • house         │
│                             │
│  📊 120-135 BPM             │
│  🎵 A Minor (25), C Major..│
│  🎸 house                   │
│                             │
│  Tracks:                    │
│  ┌─────────────────────┐   │
│  │ Track 1 - Artist A  │   │
│  │ Track 2 - Artist B  │   │
│  │ Track 3 - Artist C  │   │
│  │ ...                 │   │
│  └─────────────────────┘   │
└─────────────────────────────┘
```

### Graph Visualization Integration

**Option 1: Replace nodes with super-nodes**
- Community appears as large node
- Click to expand into constituent nodes
- Size proportional to member count

**Option 2: Overlay on existing graph**
- Communities shown as colored hulls/regions
- Original nodes remain visible
- Toggle visibility

**Option 3: Side panel (Implemented)**
- Communities shown in sidebar
- Click to filter/navigate
- Graph updates to show selection

## Testing

### Unit Tests
```typescript
// Test community detection
describe('detectCommunities', () => {
  it('should detect communities in graph', () => {
    const result = detectCommunities(testGraphData);
    expect(result.communities.length).toBeGreaterThan(0);
    expect(result.modularity).toBeGreaterThan(0);
  });

  it('should respect resolution parameter', () => {
    const lowRes = detectCommunities(testGraphData, { resolution: 0.5 });
    const highRes = detectCommunities(testGraphData, { resolution: 2.0 });
    expect(highRes.communityCount).toBeGreaterThan(lowRes.communityCount);
  });
});
```

### Integration Tests
```typescript
// Test neighborhood highlighting
describe('Neighborhood Highlighting', () => {
  it('should highlight neighbors on node click', () => {
    const { handleNodeClick } = useGraphInteraction();
    handleNodeClick(testNode);

    const state = useStore.getState();
    expect(state.communityState.highlightedNode).toBe(testNode.id);
    expect(state.communityState.highlightedNeighbors.size).toBeGreaterThan(0);
  });
});
```

## API Reference

### Types

```typescript
interface Community {
  id: number;
  nodes: string[];
  size: number;
  color: string;
  centroid?: { x: number; y: number };
  averageBPM?: number;
  dominantGenre?: string;
  keyDistribution?: Record<string, number>;
}

interface CommunityDetectionResult {
  communities: Community[];
  nodesCommunityMap: Map<string, number>;
  modularity: number;
  communityCount: number;
}
```

### Functions

```typescript
// Detection
function detectCommunities(
  graphData: GraphData,
  options?: { resolution?: number }
): CommunityDetectionResult

// Conversion
function convertToGraphology(graphData: GraphData): Graph
function convertFromGraphology(graph: Graph): GraphData

// Utilities
function assignCommunityColors(
  graphData: GraphData,
  communities: Community[],
  nodesCommunityMap: Map<string, number>
): GraphData

function filterByCommunities(
  graphData: GraphData,
  communityIds: number[],
  nodesCommunityMap: Map<string, number>
): GraphData

function getNodeCommunity(
  nodeId: string,
  communities: Community[]
): Community | undefined

function getNeighboringCommunities(
  communityId: number,
  graphData: GraphData,
  nodesCommunityMap: Map<string, number>
): Set<number>
```

## Files Created/Modified

### Created
1. `/frontend/src/utils/communityDetection.ts` - Community detection utility (380 lines)
2. `/frontend/src/components/CommunityCluster.tsx` - UI components (220 lines)
3. `/frontend/src/examples/CommunityDetectionExample.tsx` - Example usage (230 lines)
4. `/COMMUNITY_DETECTION_IMPLEMENTATION.md` - This documentation

### Modified
1. `/frontend/src/hooks/useGraphInteraction.ts` - Added neighborhood highlighting
2. `/frontend/src/store/useStore.ts` - Added community state and actions

## Dependencies

Already installed in `package.json`:
- `graphology` (^0.26.0)
- `graphology-communities-louvain` (^2.0.2)

No additional dependencies required!

## Next Steps

### Potential Enhancements
1. **Super-node Visualization**: Render communities as large nodes on graph
2. **Hierarchical Communities**: Multi-level community detection
3. **Community Comparison**: Compare metadata across communities
4. **Export Communities**: Save community assignments to file
5. **Community Transitions**: Animate transitions between communities
6. **Edge Bundling**: Bundle edges within communities for clarity
7. **Community Metrics Dashboard**: Show detailed statistics per community

### Integration Points
1. **Pathfinding**: Consider community boundaries in path calculation
2. **Setlist Builder**: Suggest tracks from same community
3. **Search**: Filter search by community
4. **Graph Layout**: Use community structure for force-directed layout

## Conclusion

The community detection and neighborhood highlighting features are fully implemented and ready for use. The implementation follows SongNodes best practices:

✅ TypeScript types for all interfaces
✅ Zustand store integration
✅ Performance optimized (caching, lazy loading)
✅ Comprehensive error handling
✅ Clean, maintainable code
✅ Example usage provided
✅ Documented API

The modularity score of the detection results can be used to validate the quality of community structure in your music graph. Higher modularity (> 0.3) indicates strong clustering, which is ideal for discovering musical patterns and relationships.
