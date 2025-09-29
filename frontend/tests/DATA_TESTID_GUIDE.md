# 🏷️ Data-TestID Implementation Guide

This guide provides the complete list of `data-testid` attributes needed to enable the full 95-test feature suite.

## 📋 Required Test IDs by Component

### 1. **DJInterface.tsx** - Main Interface
```tsx
<div data-testid="dj-interface">
  <button data-testid="mode-toggle">Librarian/Performer</button>
  <button data-testid="settings-toggle">Settings</button>
  <button data-testid="pipeline-dashboard-button">Pipeline Monitor</button>

  <div data-testid="right-panel">
    <button data-testid="right-panel-tab-analysis">Analysis</button>
    <button data-testid="right-panel-tab-keymood">Key & Mood</button>
    <button data-testid="right-panel-tab-tidal">Tidal</button>

    <div data-testid="analysis-panel">...</div>
    <div data-testid="key-mood-panel">...</div>
    <div data-testid="tidal-panel">...</div>
  </div>

  <div data-testid="now-playing">
    <button data-testid="play-pause-button">Play/Pause</button>
  </div>
</div>
```

### 2. **GraphVisualization.tsx** - Graph Container
```tsx
<div data-testid="graph-container">
  <canvas data-testid="graph-canvas" />
  <div data-testid="graph-loading">Loading...</div>

  <!-- Nodes -->
  <div data-testid="graph-node">...</div>
  <div data-testid="track-node">...</div>

  <!-- Edges -->
  <line data-testid="graph-edge">...</line>

  <!-- Debug Overlay -->
  <div data-testid="debug-overlay">...</div>
</div>
```

### 3. **KeyMoodPanel.tsx** - Key & Mood Analysis
```tsx
<div data-testid="key-mood-panel">
  <button data-testid="key-mood-expand-toggle">Expand/Collapse</button>

  <!-- Tab Navigation -->
  <button data-testid="tab-wheel">Wheel</button>
  <button data-testid="tab-flow">Flow</button>
  <button data-testid="tab-both">Both</button>

  <!-- Settings -->
  <input data-testid="playlist-priority-toggle" type="checkbox" />
  <input data-testid="harmonic-suggestions-toggle" type="checkbox" />

  <!-- Components -->
  <div data-testid="camelot-wheel">
    <g data-testid="key-segment-1A">...</g>
    <text data-testid="track-count-1A">5</text>
    <line data-testid="key-connection-1A-2A">...</line>
  </div>

  <div data-testid="mood-visualizer">
    <circle data-testid="energy-point-1">...</circle>
  </div>

  <!-- Quick Stats -->
  <div data-testid="quick-stats">
    <span data-testid="total-tracks-count">100</span>
    <span data-testid="connections-count">250</span>
    <span data-testid="keys-found-count">24</span>
    <span data-testid="playlist-edges-count">150</span>
  </div>

  <!-- Action Buttons -->
  <div data-testid="quick-actions">
    <button data-testid="shuffle-view-button">Shuffle</button>
    <button data-testid="reset-filters-button">Reset</button>
    <button data-testid="high-energy-button">High Energy</button>
    <button data-testid="mellow-button">Mellow</button>
  </div>

  <div data-testid="help-text">...</div>
</div>
```

### 4. **Search & Filtering Components**
```tsx
<!-- TrackSearch.tsx -->
<input data-testid="track-search-input" />
<button data-testid="clear-search-button">Clear</button>
<div data-testid="search-autocomplete">
  <div data-testid="search-suggestion">...</div>
</div>

<!-- QuickSearch.tsx -->
<input data-testid="quick-search-input" />
<div data-testid="quick-search-results">...</div>

<!-- FilterPanel.tsx -->
<div data-testid="filter-panel">
  <select data-testid="genre-filter-dropdown">
    <option data-testid="genre-option">House</option>
  </select>

  <div data-testid="bpm-range-slider">
    <div className="slider-handle">...</div>
    <div className="slider-track">...</div>
  </div>

  <div data-testid="energy-level-slider">
    <div className="slider-track">...</div>
  </div>

  <select data-testid="key-signature-filter">
    <option data-testid="key-option">1A</option>
  </select>

  <div data-testid="year-range-picker">
    <input data-testid="start-year-input" />
    <input data-testid="end-year-input" />
  </div>

  <button data-testid="clear-filters-button">Clear All</button>
</div>

<!-- Search Results -->
<div data-testid="highlighted-node">...</div>
<div data-testid="no-search-results">No results found</div>
```

### 5. **Interactive Components**
```tsx
<!-- ContextMenu.tsx -->
<div data-testid="context-menu" role="menu">
  <div data-testid="context-menu-item-action" role="menuitem">...</div>
</div>

<!-- RadialMenu.tsx -->
<div data-testid="radial-menu">
  <div data-testid="radial-menu-center">...</div>
  <div data-testid="radial-item">...</div>
</div>

<!-- SmartTooltip.tsx -->
<div data-testid="smart-tooltip">
  <div data-testid="tooltip-waveform">...</div>
  <div data-testid="tooltip-track-info">...</div>
  <div data-testid="tooltip-actions">
    <button data-testid="tooltip-action-button">Action</button>
  </div>
</div>

<!-- InfoCard.tsx -->
<div data-testid="info-card">
  <button data-testid="copy-info-button">Copy</button>
  <button data-testid="info-card-close">Close</button>
</div>
<div data-testid="info-card-node">...</div>
<div data-testid="info-card-performance">...</div>
<div data-testid="info-card-setlist">...</div>
```

### 6. **Track Management**
```tsx
<!-- SetlistBuilder.tsx -->
<div data-testid="setlist-builder">
  <div data-testid="setlist-item">
    <button data-testid="remove-track-button">Remove</button>
  </div>
  <button data-testid="save-setlist-button">Save</button>
  <select data-testid="load-setlist-dropdown">
    <option data-testid="setlist-option">Setlist 1</option>
  </select>
</div>

<!-- Save Modal -->
<div data-testid="save-setlist-modal">
  <input data-testid="setlist-name-input" />
  <button data-testid="confirm-save-button">Save</button>
</div>

<!-- TargetTracksManager.tsx -->
<div data-testid="target-tracks-manager">
  <button data-testid="add-target-track-button">Add Target</button>
  <div data-testid="target-tracks-list">
    <div data-testid="target-track-item">
      <button data-testid="edit-target-track">Edit</button>
      <button data-testid="delete-target-track">Delete</button>
      <button data-testid="search-trigger-button">Search</button>
      <select data-testid="priority-dropdown">...</select>
    </div>
  </div>
</div>

<!-- Target Track Modals -->
<div data-testid="add-target-track-modal">
  <input data-testid="track-name-input" />
  <input data-testid="artist-input" />
  <select data-testid="priority-select">...</select>
  <button data-testid="submit-target-track">Add</button>
</div>

<div data-testid="edit-target-track-modal">
  <button data-testid="update-target-track">Update</button>
</div>

<div data-testid="confirm-delete-modal">
  <button data-testid="confirm-delete">Delete</button>
</div>

<!-- TrackDetailsModal.tsx -->
<div data-testid="track-details-modal">
  <button data-testid="modal-close">X</button>
  <div data-testid="track-basic-info">...</div>
  <div data-testid="track-audio-analysis">...</div>
  <div data-testid="related-tracks">...</div>

  <!-- Tabs -->
  <button data-testid="waveform-tab">Waveform</button>
  <button data-testid="key-analysis-tab">Key Analysis</button>
  <button data-testid="metadata-tab">Metadata</button>

  <button data-testid="set-current-track">Set as Current</button>
</div>
```

### 7. **Settings & Configuration**
```tsx
<!-- SettingsPanel.tsx -->
<div data-testid="settings-panel">
  <!-- Performance Settings -->
  <div data-testid="performance-settings">
    <input data-testid="webgl-acceleration-toggle" type="checkbox" />
    <select data-testid="animation-quality-select">...</select>
    <input data-testid="node-limit-input" type="number" />
  </div>

  <!-- Visual Settings -->
  <div data-testid="visual-settings">
    <select data-testid="theme-select">
      <option>dark</option>
      <option>light</option>
    </select>
    <select data-testid="color-scheme-select">
      <option>neon</option>
    </select>
    <div data-testid="node-size-slider">
      <div className="slider-track">...</div>
    </div>
    <div data-testid="edge-thickness-slider">
      <div className="slider-track">...</div>
    </div>
  </div>

  <!-- Audio Settings -->
  <div data-testid="audio-settings">
    <div data-testid="volume-slider">
      <div className="slider-track">...</div>
    </div>
    <input data-testid="crossfade-duration-input" type="number" />
    <input data-testid="auto-gain-toggle" type="checkbox" />
    <select data-testid="audio-format-select">
      <option>flac</option>
    </select>
  </div>

  <!-- Import/Export -->
  <button data-testid="export-settings-button">Export</button>
  <button data-testid="import-settings-button">Import</button>

  <!-- Feedback -->
  <div data-testid="setting-change-feedback">Settings saved</div>
  <div data-testid="validation-message">Invalid value</div>
</div>

<!-- Pipeline Monitoring -->
<div data-testid="pipeline-dashboard">
  <div data-testid="pipeline-status-indicators">
    <div data-testid="status-scraper">...</div>
    <div data-testid="status-api-gateway">...</div>
    <div data-testid="status-graph-processor">...</div>
    <div data-testid="status-database">...</div>
  </div>

  <button data-testid="refresh-pipeline-status">Refresh</button>

  <div data-testid="pipeline-status-area">...</div>

  <div data-testid="connection-status">
    <div data-testid="websocket-status">...</div>
    <div data-testid="api-connection-status">...</div>
    <div data-testid="database-status">...</div>
  </div>

  <div data-testid="pipeline-errors">
    <div data-testid="connection-errors">...</div>
    <div data-testid="service-errors">...</div>
    <div data-testid="data-errors">...</div>
  </div>
</div>
```

### 8. **Error States**
```tsx
<div data-testid="network-error">Network connection failed</div>
<div data-testid="connection-error">Unable to connect</div>
<div data-testid="error-message">An error occurred</div>
<div data-testid="data-loading-error">Failed to load data</div>
<div data-testid="validation-error">Invalid input</div>
<div data-testid="input-error">Please enter a valid value</div>
<div data-testid="performance-warning">Performance degraded</div>
<div data-testid="empty-state">No data available</div>
<div data-testid="no-data">No results found</div>
```

## 🔧 Implementation Example

### React Component Example:
```tsx
// Before
<div className="interface-container">
  <button onClick={toggleMode}>Switch Mode</button>
</div>

// After
<div className="interface-container" data-testid="dj-interface">
  <button onClick={toggleMode} data-testid="mode-toggle">Switch Mode</button>
</div>
```

### Adding Accessibility:
```tsx
<button
  onClick={handleClick}
  data-testid="settings-toggle"
  aria-label="Open settings panel"
>
  ⚙️ Settings
</button>
```

## 📝 Naming Conventions

### Test ID Format:
- **Components**: `component-name` (e.g., `dj-interface`)
- **Actions**: `action-verb` (e.g., `mode-toggle`)
- **States**: `state-descriptor` (e.g., `loading`, `error`)
- **Lists**: `item-type` (e.g., `setlist-item`)
- **Modals**: `purpose-modal` (e.g., `save-setlist-modal`)

### Examples:
- `data-testid="graph-node"` - Graph node element
- `data-testid="track-search-input"` - Search input field
- `data-testid="high-energy-button"` - Action button
- `data-testid="network-error"` - Error state
- `data-testid="key-segment-1A"` - Specific key segment

## ✅ Implementation Checklist

- [ ] Main interface elements (9 IDs)
- [ ] Graph visualization components (6 IDs)
- [ ] Key & Mood panel (20 IDs)
- [ ] Search & filtering (15 IDs)
- [ ] Interactive components (12 IDs)
- [ ] Track management (18 IDs)
- [ ] Settings & configuration (25 IDs)
- [ ] Error states (9 IDs)

**Total Test IDs Required: ~114**

## 🚀 Testing After Implementation

Once test IDs are added, run the full test suite:

```bash
# Run all tests
npm test

# Run specific category
npm test main-interface.desktop.spec.ts
npm test key-mood-analysis.desktop.spec.ts

# Update screenshots after UI changes
npm test -- --update-snapshots

# Debug mode for troubleshooting
npm run test:ui
```

---

This guide provides the complete blueprint for enabling the full test suite. Each test ID corresponds to specific test cases in the Playwright suite, ensuring comprehensive coverage of all functionality.