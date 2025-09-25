# StatsPanel Component Documentation

## Overview

The `StatsPanel` component provides comprehensive graph statistics and visualizations for the SongNodes DJ application. It features multiple chart types, detailed analytics, and export capabilities to help DJs understand their music collection's structure and relationships.

## Features

### Core Statistics
- **Graph Metrics**: Nodes, edges, density, clustering coefficient, average path length
- **Connection Analysis**: Most connected tracks, bridge tracks identification
- **Performance Monitoring**: Real-time FPS, render time, memory usage
- **Network Analysis**: Connected components, average degree, network density

### Visualizations
- **BPM Distribution**: Bar chart showing tempo distribution across tracks
- **Key Distribution**: Camelot key distribution with harmonic color coding
- **Camelot Wheel**: Interactive circular visualization of key relationships
- **Genre Breakdown**: Pie chart of music genres in the collection
- **Bridge Track Analysis**: Tracks that connect different parts of the graph

### Export Capabilities
- **JSON Export**: Complete statistics with metadata
- **CSV Export**: Structured data for spreadsheet analysis
- **Format Options**: Configurable export formats

## Component Architecture

### Dependencies
- **React 18.3+**: Functional component with hooks
- **D3.js**: Data visualization (d3-selection, d3-scale, d3-shape, d3-axis, d3-array)
- **Zustand Store**: State management integration
- **TypeScript**: Full type safety

### Key Files
- `src/components/StatsPanel.tsx` - Main component
- `src/utils/graphHelpers.ts` - Graph analysis utilities
- `src/utils/harmonic.ts` - Camelot key system utilities
- `src/styles/global.css` - Component styling (lines 1186-1416)

## Usage

### Integration
The component is already integrated into the main application:

1. **Import**: Already lazy-loaded in `App.tsx` (line 12)
2. **Panel System**: Accessible via the stats button in the toolbar
3. **State Integration**: Uses Zustand store hooks for data access

### Accessing the Panel
1. Click the 📊 "Statistics" button in the toolbar
2. The panel opens on the right side of the interface
3. Navigate between different chart types using the button selector

### Chart Types

#### Overview Tab
- Graph statistics grid with key metrics
- Performance monitoring section
- Network analysis data
- Component distribution information

#### BPM Chart
- Histogram of track tempos grouped in 10 BPM buckets
- Interactive bars with hover effects
- Useful for identifying energy patterns in collection

#### Key Distribution
- Bar chart of Camelot keys with color coding
- Shows harmonic distribution of tracks
- Helps identify key compatibility patterns

#### Camelot Wheel
- Circular visualization of the harmonic mixing wheel
- Outer ring: Major keys, Inner ring: Minor keys
- Opacity indicates track count for each key
- Interactive hover labels

#### Genre Distribution
- Pie chart of top 10 music genres
- Color-coded segments with labels
- Shows genre diversity in collection

#### Most Connected Tracks
- List of tracks with highest connection counts
- Shows track name, artist, and connection number
- Useful for identifying hub tracks in the network

#### Bridge Tracks
- Advanced betweenness centrality analysis
- Identifies tracks that connect different graph regions
- Shows bridge score, connections, and path count
- Critical for understanding graph connectivity

## Technical Implementation

### Data Processing
```typescript
// Graph statistics calculation
const graphStats = useMemo((): GraphStatistics => {
  // Performance-optimized calculations
  const basicStats = calculateGraphStats({ nodes, edges });
  const degrees = calculateNodeDegrees({ nodes, edges });

  // Sample-based path length calculation for large graphs
  // Clustering coefficient computation
  // Bridge track identification using betweenness centrality
}, [nodes, edges]);
```

### Chart Rendering
- **D3.js Integration**: Pure D3 for high-performance visualizations
- **SVG Rendering**: Scalable vector graphics with responsive design
- **Theme Integration**: Uses application color variables
- **Performance Optimized**: Efficient re-rendering with memoization

### Export Functions
```typescript
const exportData = useCallback((format: 'json' | 'csv') => {
  const data = {
    timestamp: new Date().toISOString(),
    graphStats,
    distributions: { bpm, key, genre },
    performanceMetrics,
  };
  // Download generation with proper MIME types
}, [/* dependencies */]);
```

## Styling

### CSS Classes
- `.stats-panel` - Main container with flex layout
- `.chart-container` - SVG chart wrapper with responsive sizing
- `.stat-card` - Metric display cards with hover effects
- `.export-controls` - Control buttons with theme integration

### Responsive Design
- Mobile-optimized layouts for screens < 768px
- Flexible chart sizing with minimum dimensions
- Touch-friendly button controls
- Adaptive grid layouts for different screen sizes

## Performance Considerations

### Optimization Strategies
- **Lazy Loading**: Component is lazy-loaded to reduce initial bundle size
- **Memoization**: Heavy calculations cached with useMemo
- **Sample-based Analysis**: Large graph analysis uses statistical sampling
- **Efficient Re-rendering**: Targeted updates using React.memo patterns

### Memory Management
- **Chart Cleanup**: D3 selections properly cleared on unmount
- **Event Listeners**: Properly registered and cleaned up
- **Large Dataset Handling**: Pagination and virtualization for large lists

### Browser Compatibility
- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Feature Detection**: Graceful degradation for unsupported features
- **WebGL Fallbacks**: SVG rendering when WebGL unavailable

## Customization

### Adding New Charts
1. Add chart type to `selectedChart` state options
2. Implement data processing in component state
3. Create rendering function following D3 patterns
4. Add chart selector button and content section
5. Update CSS styles for new chart type

### Extending Statistics
1. Add new metrics to `GraphStatistics` interface
2. Implement calculation in `graphStats` useMemo
3. Add display components in overview section
4. Update export functions to include new data

### Theme Customization
All colors reference CSS custom properties:
- `--color-text-primary` - Main text color
- `--color-bg-secondary` - Panel backgrounds
- `--color-accent-tertiary` - Interactive elements
- `--color-border-primary` - Border colors

## API Integration

### Data Sources
- **Graph Data**: `useGraphNodes()` and `useGraphEdges()` hooks
- **Performance**: `usePerformanceMetrics()` for real-time monitoring
- **Track Metadata**: Accesses BPM, key, genre from track objects
- **Camelot Keys**: Converts standard keys to harmonic mixing format

### State Management
Uses Zustand store selectors for reactive updates:
```typescript
const nodes = useGraphNodes();
const edges = useGraphEdges();
const performanceMetrics = usePerformanceMetrics();
```

## Future Enhancements

### Planned Features
- **Time-series Analysis**: Historical statistics tracking
- **Recommendation Engine**: Suggest tracks based on graph analysis
- **Advanced Clustering**: Community detection algorithms
- **Export Templates**: Predefined report formats
- **Real-time Updates**: Live statistics during DJ sessions

### Accessibility
- **Screen Reader Support**: ARIA labels and descriptions
- **Keyboard Navigation**: Tab-based interaction
- **High Contrast**: Automatic theme detection
- **Reduced Motion**: Animation preferences respected

## Troubleshooting

### Common Issues
1. **Charts Not Rendering**: Check SVG container dimensions and D3 imports
2. **Performance Issues**: Monitor component re-renders and data size
3. **Export Failures**: Verify browser download permissions
4. **Styling Issues**: Ensure CSS custom properties are defined

### Debug Mode
Enable development mode performance monitoring:
```typescript
// Shows real-time metrics in development
if (process.env.NODE_ENV === 'development') {
  setShowPerformanceMonitor(true);
}
```

### Browser Console
The component logs performance warnings and errors to help with debugging:
- Chart rendering times
- Data processing performance
- Memory usage alerts
- Export operation status

## Version History

### v2.0.0 (Current)
- Complete rewrite with TypeScript
- D3.js v7 integration
- Camelot wheel visualization
- Bridge track analysis
- Enhanced performance monitoring
- Responsive design improvements
- Full export functionality

This component represents the complete statistics and analytics solution for the SongNodes DJ application, providing comprehensive insights into music collection structure and relationships.