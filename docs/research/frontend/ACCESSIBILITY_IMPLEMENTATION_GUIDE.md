# Comprehensive Accessibility Implementation Guide for SongNodes
## 2025 Standards-Based Approach for WCAG 2.2 AA Compliance

### Table of Contents
1. [Executive Summary](#executive-summary)
2. [Current Accessibility Gaps](#current-accessibility-gaps)
3. [2025 Accessibility Standards](#2025-accessibility-standards)
4. [Component-Specific Implementation](#component-specific-implementation)
5. [Keyboard Navigation Patterns](#keyboard-navigation-patterns)
6. [Screen Reader Support](#screen-reader-support)
7. [Focus Management](#focus-management)
8. [Visual Accessibility](#visual-accessibility)
9. [ARIA Patterns for Complex Components](#aria-patterns-for-complex-components)
10. [Testing Strategies](#testing-strategies)
11. [Migration Guide](#migration-guide)
12. [Compliance Checklist](#compliance-checklist)

---

## Executive Summary

This guide addresses the accessibility gaps in 9 critical SongNodes components, providing implementation patterns based on 2025 WCAG 2.2 standards. By following these guidelines, SongNodes will achieve WCAG 2.2 Level AA compliance while improving usability for all users, not just those with disabilities.

### Key Requirements (2025 Standards)
- **WCAG 2.2 Compliance**: 9 new success criteria including Focus Appearance, Dragging Movements, Target Size
- **Target Size**: Minimum 24x24 CSS pixels for all interactive elements
- **Focus Indicators**: 2px outline minimum with 3:1 contrast ratio
- **Keyboard Access**: All features fully operable via keyboard
- **Screen Reader Support**: NVDA, JAWS, VoiceOver compatibility

### Business Impact
- **Legal Compliance**: Avoid potential ADA lawsuits (4,500+ filed in 2024)
- **Market Reach**: 15% of global population has disabilities
- **SEO Benefits**: Accessibility improvements boost search rankings
- **User Experience**: Better for everyone (curb-cut effect)

---

## Current Accessibility Gaps

### Critical Components Requiring Remediation

| Component | Current Issues | Impact Level | Priority |
|-----------|---------------|--------------|----------|
| **IntelligentBrowser** | No keyboard navigation, missing ARIA labels, no focus management | HIGH | P0 |
| **PathfinderPanel** | Missing focus management, no keyboard shortcuts, no announcements | HIGH | P0 |
| **SetlistBuilder** | Drag-drop not keyboard accessible, no alternative interaction | HIGH | P0 |
| **DJInterface** | No screen reader support, missing landmarks, poor focus flow | CRITICAL | P0 |
| **GraphVisualization** | Canvas not accessible, no keyboard node selection, no text alternative | CRITICAL | P0 |
| **CamelotHelix3D** | WebGL without fallback, no keyboard controls, no text description | MEDIUM | P1 |
| **Graph3D** | Missing keyboard controls, no 2D alternative view | MEDIUM | P1 |
| **PathBuilder** | No keyboard waypoint management, missing ARIA live regions | HIGH | P0 |
| **AdvancedSearch** | Missing ARIA live regions, poor focus management, no error announcements | HIGH | P0 |

---

## 2025 Accessibility Standards

### WCAG 2.2 Key Updates
1. **Focus Appearance (Level AA)**: Focus indicator must have 3:1 contrast and be at least 2 CSS pixels thick
2. **Target Size (Level AA)**: Interactive elements minimum 24x24 CSS pixels
3. **Dragging Movements (Level AA)**: Single-pointer alternative for drag actions
4. **Consistent Help (Level A)**: Help mechanisms in consistent location

### ARIA 1.3 Best Practices
- Use semantic HTML first, ARIA second
- Ensure ARIA states update dynamically
- Follow APG (Authoring Practices Guide) patterns
- Test with actual assistive technology

---

## Component-Specific Implementation

### 1. IntelligentBrowser Component

#### Current State
```tsx
// ❌ Current: No keyboard support, no ARIA
<div className="browser-container">
  <div onClick={handleTrackSelect}>Track Name</div>
</div>
```

#### Accessible Implementation
```tsx
// ✅ Accessible: Full keyboard and screen reader support
import { useRef, useEffect, useState } from 'react';
import { useFocusManager, useFocusRing } from '@react-aria/focus';
import { useListBox, useOption } from '@react-aria/listbox';
import { useListState } from '@react-stately/list';

interface IntelligentBrowserProps {
  currentTrack: Track | null;
  allTracks: Track[];
  onTrackSelect: (track: Track) => void;
}

export const IntelligentBrowser: React.FC<IntelligentBrowserProps> = ({
  currentTrack,
  allTracks,
  onTrackSelect
}) => {
  const [announcements, setAnnouncements] = useState<string>('');
  const listState = useListState({
    selectionMode: 'single',
    collection: {
      items: allTracks.map(track => ({
        key: track.id,
        track
      }))
    }
  });

  const ref = useRef<HTMLUListElement>(null);
  const { listBoxProps } = useListBox(
    {
      'aria-label': 'Track recommendations',
      'aria-describedby': 'browser-instructions'
    },
    listState,
    ref
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          listState.selectionManager.setFocusedKey(
            listState.collection.getKeyAfter(listState.selectionManager.focusedKey)
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          listState.selectionManager.setFocusedKey(
            listState.collection.getKeyBefore(listState.selectionManager.focusedKey)
          );
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          const focusedItem = listState.collection.getItem(
            listState.selectionManager.focusedKey
          );
          if (focusedItem) {
            onTrackSelect(focusedItem.track);
            setAnnouncements(`Selected ${focusedItem.track.name} by ${focusedItem.track.artist}`);
          }
          break;
        case 'Home':
          e.preventDefault();
          listState.selectionManager.setFocusedKey(
            listState.collection.getFirstKey()
          );
          break;
        case 'End':
          e.preventDefault();
          listState.selectionManager.setFocusedKey(
            listState.collection.getLastKey()
          );
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [listState, onTrackSelect]);

  return (
    <div
      role="region"
      aria-label="Intelligent Track Browser"
      className="intelligent-browser"
    >
      {/* Screen reader instructions */}
      <div id="browser-instructions" className="sr-only">
        Navigate with arrow keys. Press Enter to select a track.
        Press H for keyboard shortcuts help.
      </div>

      {/* Live region for announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcements}
      </div>

      {/* Skip to recommendations link */}
      <a href="#recommendations" className="skip-link">
        Skip to track recommendations
      </a>

      {/* Current track display */}
      <div
        className="current-track"
        role="status"
        aria-label="Currently playing"
      >
        {currentTrack ? (
          <>
            <span className="label">Now Playing:</span>
            <span className="track-info">
              {currentTrack.name} - {currentTrack.artist}
              {currentTrack.bpm && (
                <span aria-label={`${currentTrack.bpm} beats per minute`}>
                  {currentTrack.bpm} BPM
                </span>
              )}
            </span>
          </>
        ) : (
          <span>No track selected</span>
        )}
      </div>

      {/* Recommendations list with keyboard navigation */}
      <ul
        {...listBoxProps}
        ref={ref}
        id="recommendations"
        className="recommendations-list"
      >
        {recommendations.map((rec, index) => (
          <TrackOption
            key={rec.track.id}
            item={rec}
            state={listState}
            index={index}
            onSelect={onTrackSelect}
          />
        ))}
      </ul>

      {/* Keyboard shortcuts help */}
      <KeyboardHelp />
    </div>
  );
};

// Track option with proper ARIA
const TrackOption: React.FC<{
  item: TrackRecommendation;
  state: any;
  index: number;
  onSelect: (track: Track) => void;
}> = ({ item, state, index, onSelect }) => {
  const ref = useRef<HTMLLIElement>(null);
  const { optionProps, isSelected, isFocused } = useOption(
    { key: item.track.id },
    state,
    ref
  );

  const { focusRingProps } = useFocusRing();

  return (
    <li
      {...optionProps}
      {...focusRingProps}
      ref={ref}
      className={`
        track-option
        ${isSelected ? 'selected' : ''}
        ${isFocused ? 'focused' : ''}
        compatibility-${item.compatibility.harmonic}
      `}
      role="option"
      aria-selected={isSelected}
      aria-describedby={`track-details-${item.track.id}`}
      tabIndex={isFocused ? 0 : -1}
    >
      {/* Visual indicator for compatibility */}
      <div
        className="compatibility-indicator"
        aria-hidden="true"
      >
        {item.compatibility.harmonic === 'perfect' && '🟢'}
        {item.compatibility.harmonic === 'compatible' && '🟡'}
        {item.compatibility.harmonic === 'clash' && '🔴'}
      </div>

      {/* Track information */}
      <div className="track-info">
        <span className="track-name">{item.track.name}</span>
        <span className="track-artist">{item.track.artist}</span>
      </div>

      {/* Detailed information for screen readers */}
      <div id={`track-details-${item.track.id}`} className="sr-only">
        Score: {item.score}.
        Harmonic compatibility: {item.compatibility.harmonic}.
        {item.reasons.map(r => r.description).join('. ')}
      </div>

      {/* Interactive elements with proper sizing -->
      <button
        className="play-preview"
        aria-label={`Preview ${item.track.name}`}
        onClick={(e) => {
          e.stopPropagation();
          handlePreview(item.track);
        }}
        style={{ minWidth: '24px', minHeight: '24px' }}
      >
        ▶
      </button>
    </li>
  );
};
```

---

### 2. PathfinderPanel Component

#### Accessible Implementation
```tsx
// ✅ Accessible PathfinderPanel with keyboard navigation and announcements
import { useRef, useState, useEffect } from 'react';
import { useFocusTrap } from '@react-aria/focus';
import { announce } from '@react-aria/live-announcer';

export const PathfinderPanel: React.FC = () => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Focus trap when panel is active
  useFocusTrap({ isDisabled: !isOpen }, panelRef);

  // Announce search results
  useEffect(() => {
    if (result) {
      const message = result.success
        ? `Path found with ${result.path.length} tracks. Total duration: ${formatDuration(result.total_duration_ms)}`
        : `No path found. ${result.message}`;
      announce(message, 'polite');
    }
  }, [result]);

  return (
    <div
      ref={panelRef}
      role="region"
      aria-label="Pathfinder Panel"
      className="pathfinder-panel"
    >
      {/* Panel header with close button */}
      <div className="panel-header">
        <h2 id="pathfinder-title">Track Pathfinder</h2>
        <button
          aria-label="Close pathfinder panel"
          onClick={onClose}
          className="close-button"
          style={{ minWidth: '44px', minHeight: '44px' }}
        >
          ×
        </button>
      </div>

      {/* Form with proper labels and descriptions */}
      <form
        onSubmit={handleSubmit}
        aria-labelledby="pathfinder-title"
      >
        {/* Start track selection -->
        <div className="form-group">
          <label htmlFor="start-track">
            Start Track
            <span className="required" aria-label="required">*</span>
          </label>
          <div className="track-selector">
            <input
              id="start-track"
              type="text"
              value={startTrack?.name || ''}
              aria-required="true"
              aria-invalid={!startTrack}
              aria-describedby="start-track-error start-track-hint"
              readOnly
            />
            <button
              type="button"
              aria-label="Select start track from current selection"
              onClick={useSelectedTrackAsStart}
              disabled={!currentlySelectedTrack}
            >
              Use Selected
            </button>
          </div>
          <span id="start-track-hint" className="hint">
            Select a track from the graph to set as start point
          </span>
          {!startTrack && (
            <span id="start-track-error" role="alert" className="error">
              Please select a start track
            </span>
          )}
        </div>

        {/* Waypoints with keyboard-accessible list */}
        <div className="form-group">
          <label id="waypoints-label">
            Waypoints (Optional)
          </label>
          <ul
            role="list"
            aria-labelledby="waypoints-label"
            className="waypoints-list"
          >
            {waypoints.map((track, index) => (
              <li key={track.id} className="waypoint-item">
                <span>{index + 1}. {track.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${track.name} from waypoints`}
                  onClick={() => removeWaypoint(track.id)}
                  className="remove-button"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            aria-label="Add selected track as waypoint"
            onClick={useSelectedTrackAsWaypoint}
            disabled={!currentlySelectedTrack}
          >
            Add Selected as Waypoint
          </button>
        </div>

        {/* Target duration with proper input attributes */}
        <div className="form-group">
          <label htmlFor="target-duration">
            Target Duration (minutes)
          </label>
          <input
            id="target-duration"
            type="number"
            min="1"
            max="480"
            value={targetDuration}
            onChange={(e) => setTargetDuration(Number(e.target.value))}
            aria-describedby="duration-hint"
          />
          <span id="duration-hint" className="hint">
            Enter desired set length in minutes
          </span>
        </div>

        {/* Submit with loading state -->
        <button
          type="submit"
          disabled={!startTrack || isSearching}
          aria-busy={isSearching}
          className="submit-button"
        >
          {isSearching ? (
            <>
              <span className="spinner" aria-hidden="true"></span>
              Searching...
            </>
          ) : (
            'Find Path'
          )}
        </button>
      </form>

      {/* Results with proper ARIA -->
      {result && (
        <div
          role="region"
          aria-label="Path results"
          aria-live="polite"
          className="results"
        >
          <h3>Path Results</h3>
          {result.success ? (
            <ol className="path-list">
              {result.path.map((segment, index) => (
                <li key={segment.track.id}>
                  <span className="track-number">{index + 1}</span>
                  <span className="track-details">
                    {segment.track.name} - {segment.track.artist}
                    <span className="track-meta">
                      {segment.track.bpm && `${segment.track.bpm} BPM`}
                      {segment.track.camelot_key && ` • ${segment.track.camelot_key}`}
                      {` • ${formatDuration(segment.track.duration_ms)}`}
                    </span>
                  </span>
                  {segment.is_synthetic_edge && (
                    <span className="synthetic-badge" aria-label="Synthetic connection">
                      AI
                    </span>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <div role="alert" className="error-message">
              {result.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

---

### 3. SetlistBuilder Component (Accessible Drag and Drop)

#### Keyboard-Accessible Drag and Drop Implementation
```tsx
// ✅ Fully accessible drag and drop with keyboard alternatives
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { announce } from '@react-aria/live-announcer';

export const SetlistBuilder: React.FC = () => {
  // Configure sensors for both pointer and keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Prevent accidental drags
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Announce drag operations for screen readers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const track = tracks.find(t => t.id === active.id);
    if (track) {
      announce(`Picked up ${track.name}. Press arrow keys to move, space to drop.`);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      // Reorder logic here
      const oldIndex = tracks.findIndex(t => t.id === active.id);
      const newIndex = tracks.findIndex(t => t.id === over?.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const movedTrack = tracks[oldIndex];
        announce(`Moved ${movedTrack.name} to position ${newIndex + 1}`);
        // Update tracks array
      }
    }
  };

  return (
    <div
      role="application"
      aria-label="Setlist Builder"
      aria-describedby="setlist-instructions"
    >
      {/* Instructions for screen reader users */}
      <div id="setlist-instructions" className="sr-only">
        Use arrow keys to navigate tracks. Press space to pick up a track,
        arrow keys to move it, and space again to drop it.
        Alternatively, use the move up and move down buttons.
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={tracks.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <ol
            role="list"
            aria-label="Setlist tracks"
            className="setlist-tracks"
          >
            {tracks.map((track, index) => (
              <SortableTrack
                key={track.id}
                track={track}
                index={index}
                total={tracks.length}
                onMoveUp={() => moveTrack(index, index - 1)}
                onMoveDown={() => moveTrack(index, index + 1)}
                onRemove={() => removeTrack(track.id)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      {/* Alternative keyboard controls */}
      <div className="keyboard-controls">
        <h3>Keyboard Shortcuts</h3>
        <dl>
          <dt><kbd>Tab</kbd></dt>
          <dd>Navigate to next track</dd>
          <dt><kbd>Space</kbd></dt>
          <dd>Pick up / Drop track</dd>
          <dt><kbd>↑↓</kbd></dt>
          <dd>Move track when held</dd>
          <dt><kbd>Escape</kbd></dt>
          <dd>Cancel drag operation</dd>
          <dt><kbd>Delete</kbd></dt>
          <dd>Remove track from setlist</dd>
        </dl>
      </div>
    </div>
  );
};

// Individual track component with accessibility features
const SortableTrack: React.FC<{
  track: Track;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}> = ({ track, index, total, onMoveUp, onMoveDown, onRemove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`setlist-track ${isDragging ? 'dragging' : ''}`}
      role="listitem"
      aria-label={`Track ${index + 1} of ${total}: ${track.name} by ${track.artist}`}
    >
      {/* Drag handle with proper ARIA -->
      <button
        className="drag-handle"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${track.name}`}
        aria-describedby={`track-${track.id}-position`}
      >
        ⋮⋮
      </button>

      {/* Track information */}
      <div className="track-info">
        <span className="track-position">{index + 1}.</span>
        <span className="track-name">{track.name}</span>
        <span className="track-artist">{track.artist}</span>
        <span className="track-duration">{formatDuration(track.duration)}</span>
      </div>

      {/* Position announcement for screen readers */}
      <span id={`track-${track.id}-position`} className="sr-only">
        Position {index + 1} of {total}
      </span>

      {/* Alternative keyboard controls */}
      <div className="track-controls" role="group" aria-label="Track actions">
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label={`Move ${track.name} up`}
          className="move-button"
        >
          ↑
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          aria-label={`Move ${track.name} down`}
          className="move-button"
        >
          ↓
        </button>
        <button
          onClick={onRemove}
          aria-label={`Remove ${track.name} from setlist`}
          className="remove-button"
        >
          ×
        </button>
      </div>

      {/* Transition quality indicator */}
      {index > 0 && (
        <div
          className={`transition-quality ${transitionQuality}`}
          aria-label={`Transition quality: ${transitionQuality}`}
        >
          <span className="sr-only">
            Transition from previous track: {transitionQuality}
          </span>
        </div>
      )}
    </li>
  );
};
```

---

### 4. GraphVisualization Component (Canvas Accessibility)

#### Making Canvas/PIXI.js Accessible
```tsx
// ✅ Accessible graph visualization with keyboard navigation
import { useRef, useEffect, useState } from 'react';
import * as PIXI from 'pixi.js';
import { announce } from '@react-aria/live-announcer';

export const GraphVisualization: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [focusedNode, setFocusedNode] = useState<string | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [showDataTable, setShowDataTable] = useState(false);

  // Keyboard navigation for graph
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!focusedNode) return;

      const node = nodes.find(n => n.id === focusedNode);
      if (!node) return;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'ArrowDown':
          e.preventDefault();
          // Navigate to adjacent nodes
          const direction = getDirectionVector(e.key);
          const nextNode = findNearestNode(node, direction);
          if (nextNode) {
            setFocusedNode(nextNode.id);
            announce(`Navigated to ${nextNode.label}`);
          }
          break;

        case 'Enter':
        case ' ':
          e.preventDefault();
          // Toggle selection
          const newSelection = new Set(selectedNodes);
          if (newSelection.has(focusedNode)) {
            newSelection.delete(focusedNode);
            announce(`Deselected ${node.label}`);
          } else {
            newSelection.add(focusedNode);
            announce(`Selected ${node.label}`);
          }
          setSelectedNodes(newSelection);
          break;

        case 'Tab':
          // Move to next node in tab order
          if (!e.shiftKey) {
            const nextNode = getNextNode(focusedNode);
            if (nextNode) {
              e.preventDefault();
              setFocusedNode(nextNode.id);
              announce(`Focus moved to ${nextNode.label}`);
            }
          } else {
            const prevNode = getPreviousNode(focusedNode);
            if (prevNode) {
              e.preventDefault();
              setFocusedNode(prevNode.id);
              announce(`Focus moved to ${prevNode.label}`);
            }
          }
          break;

        case 'Escape':
          e.preventDefault();
          setSelectedNodes(new Set());
          announce('Selection cleared');
          break;

        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setSelectedNodes(new Set(nodes.map(n => n.id)));
            announce(`Selected all ${nodes.length} nodes`);
          }
          break;

        case 'h':
        case '?':
          e.preventDefault();
          showHelp();
          break;

        case 't':
          // Toggle table view
          e.preventDefault();
          setShowDataTable(!showDataTable);
          announce(showDataTable ? 'Switched to graph view' : 'Switched to table view');
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [focusedNode, selectedNodes, nodes]);

  return (
    <div
      role="application"
      aria-label="Track relationship graph"
      aria-describedby="graph-description graph-instructions"
    >
      {/* Graph description for screen readers */}
      <div id="graph-description" className="sr-only">
        Interactive graph showing relationships between {nodes.length} tracks
        with {edges.length} connections.
      </div>

      {/* Instructions */}
      <div id="graph-instructions" className="sr-only">
        Use arrow keys to navigate between nodes. Press Enter to select.
        Press T to switch to table view. Press H for help.
      </div>

      {/* Skip to controls */}
      <a href="#graph-controls" className="skip-link">
        Skip to graph controls
      </a>

      {/* View toggle -->
      <div className="view-controls" id="graph-controls">
        <button
          onClick={() => setShowDataTable(!showDataTable)}
          aria-pressed={showDataTable}
          aria-label={`${showDataTable ? 'Show graph' : 'Show data table'} view`}
        >
          {showDataTable ? '📊 Graph View' : '📋 Table View'}
        </button>
      </div>

      {/* Canvas with accessibility attributes -->
      {!showDataTable ? (
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Track relationship graph visualization"
          tabIndex={0}
          onFocus={() => {
            if (!focusedNode && nodes.length > 0) {
              setFocusedNode(nodes[0].id);
              announce(`Entered graph. Focused on ${nodes[0].label}`);
            }
          }}
        />
      ) : (
        <GraphDataTable
          nodes={nodes}
          edges={edges}
          selectedNodes={selectedNodes}
          onNodeSelect={handleNodeSelect}
        />
      )}

      {/* Live region for announcements -->
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {currentAnnouncement}
      </div>

      {/* Node details panel (keyboard accessible) -->
      {focusedNode && (
        <NodeDetailsPanel
          node={nodes.find(n => n.id === focusedNode)}
          edges={edges.filter(e =>
            e.source === focusedNode || e.target === focusedNode
          )}
        />
      )}
    </div>
  );
};

// Accessible data table alternative
const GraphDataTable: React.FC<{
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodes: Set<string>;
  onNodeSelect: (nodeId: string) => void;
}> = ({ nodes, edges, selectedNodes, onNodeSelect }) => {
  return (
    <div role="region" aria-label="Graph data table">
      <table className="graph-table">
        <caption>Track Relationships Data</caption>
        <thead>
          <tr>
            <th scope="col">Select</th>
            <th scope="col">Track</th>
            <th scope="col">Artist</th>
            <th scope="col">BPM</th>
            <th scope="col">Key</th>
            <th scope="col">Connections</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map(node => {
            const nodeEdges = edges.filter(e =>
              e.source === node.id || e.target === node.id
            );

            return (
              <tr key={node.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedNodes.has(node.id)}
                    onChange={() => onNodeSelect(node.id)}
                    aria-label={`Select ${node.label}`}
                  />
                </td>
                <td>{node.label}</td>
                <td>{node.metadata?.artist || 'Unknown'}</td>
                <td>{node.metadata?.bpm || '-'}</td>
                <td>{node.metadata?.key || '-'}</td>
                <td>
                  <button
                    aria-label={`View ${nodeEdges.length} connections for ${node.label}`}
                    onClick={() => showConnections(node.id)}
                  >
                    {nodeEdges.length} connections
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
```

---

## Keyboard Navigation Patterns

### Universal Keyboard Shortcuts

All components should support these standard shortcuts:

| Key | Action | Context |
|-----|--------|---------|
| `Tab` | Move focus forward | All |
| `Shift+Tab` | Move focus backward | All |
| `Enter` / `Space` | Activate focused element | Buttons, links |
| `Escape` | Close modal/cancel operation | Modals, dropdowns |
| `Arrow Keys` | Navigate within component | Lists, grids, graphs |
| `Home` | Move to first item | Lists, grids |
| `End` | Move to last item | Lists, grids |
| `Ctrl/Cmd+A` | Select all | Multi-select contexts |

### Component-Specific Shortcuts

#### Graph Visualization
- `Arrow Keys`: Navigate between nodes
- `Enter/Space`: Select/deselect node
- `Shift+Arrow`: Extend selection
- `+/-`: Zoom in/out
- `0`: Reset zoom
- `T`: Toggle table view
- `F`: Find node (opens search)
- `D`: Show node details
- `H`: Show help

#### Setlist Builder
- `Space`: Pick up/drop track
- `Arrow Up/Down`: Move track while dragging
- `Delete`: Remove track
- `Ctrl+Z`: Undo last action
- `Ctrl+Y`: Redo

#### Pathfinder Panel
- `S`: Set start point from selection
- `E`: Set end point from selection
- `W`: Add waypoint from selection
- `Enter`: Start pathfinding
- `C`: Clear all points

---

## Screen Reader Support

### ARIA Patterns Implementation

#### 1. Live Regions for Dynamic Updates
```tsx
// Announce dynamic changes
<div role="status" aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>

// Critical alerts
<div role="alert" aria-live="assertive">
  {errorMessage}
</div>

// Progress indicators
<div role="status" aria-busy={isLoading} aria-live="polite">
  {isLoading ? 'Loading tracks...' : `Loaded ${tracks.length} tracks`}
</div>
```

#### 2. Semantic Landmarks
```tsx
<header role="banner">
  <nav role="navigation" aria-label="Main">
    {/* Primary navigation */}
  </nav>
</header>

<main role="main" aria-labelledby="page-title">
  <h1 id="page-title">DJ Interface</h1>

  <section role="region" aria-label="Now Playing">
    {/* Now playing content */}
  </section>

  <aside role="complementary" aria-label="Track Browser">
    {/* Sidebar content */}
  </aside>
</main>

<footer role="contentinfo">
  {/* Footer content */}
</footer>
```

#### 3. Form Controls with Proper Labels
```tsx
// Text input with label and description
<div className="form-field">
  <label htmlFor="search-input">
    Search Tracks
    <span className="required" aria-label="required">*</span>
  </label>
  <input
    id="search-input"
    type="search"
    aria-required="true"
    aria-describedby="search-hint search-error"
    aria-invalid={hasError}
  />
  <span id="search-hint" className="hint">
    Enter artist or track name
  </span>
  {hasError && (
    <span id="search-error" role="alert" className="error">
      {errorMessage}
    </span>
  )}
</div>
```

### Screen Reader Testing Checklist

#### NVDA (Windows)
1. Enable NVDA with `Ctrl+Alt+N`
2. Navigate with `Tab` key
3. Use browse mode with arrow keys
4. Check announcements with `Insert+Tab`
5. Test form mode with `Insert+Space`

#### JAWS (Windows)
1. Start JAWS with `Windows+Alt+J`
2. Use virtual cursor with arrow keys
3. List headings with `Insert+F6`
4. Check forms with `Insert+F5`
5. Navigate landmarks with `R` key

#### VoiceOver (macOS)
1. Enable with `Cmd+F5`
2. Navigate with `Ctrl+Option+Arrow`
3. Use rotor with `Ctrl+Option+U`
4. Interact with `Ctrl+Option+Shift+Down`
5. Stop interacting with `Ctrl+Option+Shift+Up`

---

## Focus Management

### Focus Trap Implementation
```tsx
import { FocusTrap } from 'focus-trap-react';

const Modal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
  children
}) => {
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Store current focus
      previousFocus.current = document.activeElement as HTMLElement;
    } else if (previousFocus.current) {
      // Restore focus when closing
      previousFocus.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <FocusTrap
      active={isOpen}
      focusTrapOptions={{
        initialFocus: '#modal-close-button',
        escapeDeactivates: true,
        clickOutsideDeactivates: true,
        returnFocusOnDeactivate: true
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="modal"
      >
        <button
          id="modal-close-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          ×
        </button>
        {children}
      </div>
    </FocusTrap>
  );
};
```

### Roving TabIndex Pattern
```tsx
const useRovingTabIndex = (items: string[]) => {
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev < items.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev > 0 ? prev - 1 : items.length - 1
        );
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(items.length - 1);
        break;
    }
  };

  return { focusedIndex, handleKeyDown };
};
```

### Skip Links Implementation
```tsx
const SkipLinks: React.FC = () => {
  return (
    <div className="skip-links">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <a href="#navigation" className="skip-link">
        Skip to navigation
      </a>
      <a href="#search" className="skip-link">
        Skip to search
      </a>
    </div>
  );
};

// CSS for skip links
.skip-link {
  position: absolute;
  left: -10000px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.skip-link:focus {
  position: fixed;
  left: 10px;
  top: 10px;
  width: auto;
  height: auto;
  padding: 8px 16px;
  background: white;
  border: 2px solid #000;
  z-index: 10000;
}
```

---

## Visual Accessibility

### Color Contrast Requirements

#### WCAG 2.2 Standards
- **Normal text**: 4.5:1 contrast ratio (AA), 7:1 (AAA)
- **Large text** (18pt+): 3:1 contrast ratio (AA), 4.5:1 (AAA)
- **UI components**: 3:1 contrast ratio
- **Focus indicators**: 3:1 contrast ratio

#### Implementation
```scss
// Accessible color palette
:root {
  // Light mode colors (AA compliant)
  --text-primary: #212121;      // 15.5:1 on white
  --text-secondary: #616161;    // 5.9:1 on white
  --text-disabled: #9e9e9e;     // 2.8:1 on white (decorative only)

  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;

  --action-primary: #1976d2;    // 4.5:1 on white
  --action-hover: #1565c0;      // 5.4:1 on white
  --error: #d32f2f;              // 4.5:1 on white
  --success: #2e7d32;            // 4.9:1 on white

  // Focus indicators
  --focus-color: #1976d2;
  --focus-outline: 2px solid var(--focus-color);
  --focus-offset: 2px;
}

// Dark mode colors (AA compliant)
@media (prefers-color-scheme: dark) {
  :root {
    --text-primary: #ffffff;      // 21:1 on black
    --text-secondary: #b3b3b3;    // 7:1 on black
    --bg-primary: #121212;
    --bg-secondary: #1e1e1e;
    --action-primary: #64b5f6;    // 6.5:1 on black
  }
}

// High contrast mode support
@media (prefers-contrast: high) {
  :root {
    --text-primary: #000000;
    --bg-primary: #ffffff;
    --focus-outline: 3px solid #000000;
  }
}
```

### Focus Indicators
```scss
// Universal focus styles
:focus-visible {
  outline: var(--focus-outline);
  outline-offset: var(--focus-offset);
}

// Custom focus for specific elements
.button:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.25);
}

.card:focus-within {
  box-shadow: 0 0 0 3px var(--focus-color);
}

// Remove focus for mouse users
:focus:not(:focus-visible) {
  outline: none;
}
```

### Reduced Motion Support
```scss
// Respect user's motion preferences
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

// TypeScript implementation
const useReducedMotion = () => {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return reducedMotion;
};
```

---

## ARIA Patterns for Complex Components

### 1. Graph/Network Visualization Pattern
```tsx
// ARIA pattern for graph visualization
<div
  role="application"
  aria-label="Interactive track relationship graph"
  aria-roledescription="graph"
>
  <div role="group" aria-label="Graph nodes">
    {nodes.map(node => (
      <div
        key={node.id}
        role="button"
        tabIndex={focusedNode === node.id ? 0 : -1}
        aria-label={node.label}
        aria-pressed={selectedNodes.has(node.id)}
        aria-describedby={`node-details-${node.id}`}
      >
        {/* Node visual representation */}
      </div>
    ))}
  </div>

  <div role="group" aria-label="Graph edges">
    {edges.map(edge => (
      <div
        key={`${edge.source}-${edge.target}`}
        role="img"
        aria-label={`Connection from ${edge.sourceLabel} to ${edge.targetLabel}`}
      >
        {/* Edge visual representation */}
      </div>
    ))}
  </div>
</div>
```

### 2. 3D Visualization Accessibility
```tsx
// Provide 2D fallback for 3D content
const Visualization3D: React.FC = () => {
  const [show2D, setShow2D] = useState(false);
  const prefer2D = useMediaQuery('(prefers-reduced-motion: reduce)');

  useEffect(() => {
    if (prefer2D) {
      setShow2D(true);
    }
  }, [prefer2D]);

  return (
    <div role="region" aria-label="Track visualization">
      <div className="view-toggle">
        <button
          onClick={() => setShow2D(!show2D)}
          aria-pressed={show2D}
        >
          {show2D ? 'Show 3D View' : 'Show 2D View'}
        </button>
      </div>

      {!show2D ? (
        <div
          role="img"
          aria-label="3D visualization of track relationships"
          aria-describedby="visualization-description"
        >
          <canvas ref={webglCanvas} />
          <div id="visualization-description" className="sr-only">
            3D helix showing harmonic relationships between tracks.
            Use the 2D view for keyboard navigation.
          </div>
        </div>
      ) : (
        <Visualization2D />
      )}
    </div>
  );
};
```

### 3. Combobox with Autocomplete Pattern
```tsx
// Accessible autocomplete implementation
const AutocompleteSearch: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [activeOption, setActiveOption] = useState<string>('');

  return (
    <div
      role="combobox"
      aria-expanded={expanded}
      aria-haspopup="listbox"
      aria-owns="search-listbox"
    >
      <input
        type="search"
        role="searchbox"
        aria-autocomplete="list"
        aria-controls="search-listbox"
        aria-activedescendant={activeOption}
        aria-label="Search tracks"
      />

      {expanded && (
        <ul
          id="search-listbox"
          role="listbox"
          aria-label="Search suggestions"
        >
          {suggestions.map(item => (
            <li
              key={item.id}
              id={`option-${item.id}`}
              role="option"
              aria-selected={activeOption === `option-${item.id}`}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

---

## Testing Strategies

### Automated Testing Tools

#### 1. axe-core with Playwright
```typescript
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  use: {
    // Accessibility testing settings
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    forcedColors: 'active'
  }
};

// accessibility.test.ts
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility Tests', () => {
  test('should have no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await injectAxe(page);

    const violations = await checkA11y(page, undefined, {
      detailedReport: true,
      detailedReportOptions: {
        html: true
      }
    });

    expect(violations).toHaveLength(0);
  });

  test('keyboard navigation works', async ({ page }) => {
    await page.goto('/');

    // Tab through interactive elements
    await page.keyboard.press('Tab');
    const firstFocus = await page.evaluate(() =>
      document.activeElement?.getAttribute('aria-label')
    );
    expect(firstFocus).toBeTruthy();

    // Test Enter key activation
    await page.keyboard.press('Enter');
    // Assert expected behavior
  });

  test('screen reader announcements', async ({ page }) => {
    await page.goto('/');

    // Check for live regions
    const liveRegions = await page.$$('[aria-live]');
    expect(liveRegions.length).toBeGreaterThan(0);

    // Trigger an action that should announce
    await page.click('[data-testid="add-track"]');

    // Check announcement was made
    const announcement = await page.textContent('[role="status"]');
    expect(announcement).toContain('Track added');
  });
});
```

#### 2. React Testing Library with jest-axe
```typescript
// setupTests.ts
import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

// Component.test.tsx
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Component } from './Component';

describe('Component Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<Component />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should be keyboard navigable', async () => {
    const user = userEvent.setup();
    const { getByRole } = render(<Component />);

    // Tab to button
    await user.tab();
    const button = getByRole('button');
    expect(button).toHaveFocus();

    // Activate with Enter
    await user.keyboard('{Enter}');
    // Assert behavior
  });

  it('should announce changes to screen readers', async () => {
    const { getByRole, findByRole } = render(<Component />);

    const button = getByRole('button');
    await userEvent.click(button);

    const status = await findByRole('status');
    expect(status).toHaveTextContent('Action completed');
  });
});
```

#### 3. Pa11y CI Integration
```json
// .pa11yci
{
  "defaults": {
    "standard": "WCAG2AA",
    "runners": ["axe", "htmlcs"],
    "ignore": [
      "WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail"
    ]
  },
  "urls": [
    "http://localhost:3000/",
    "http://localhost:3000/dj-interface",
    "http://localhost:3000/graph",
    {
      "url": "http://localhost:3000/setlist",
      "actions": [
        "wait for element .setlist-builder to be visible",
        "set field #track-search to Deadmau5",
        "wait for element .search-results to be visible"
      ]
    }
  ]
}
```

```yaml
# .github/workflows/accessibility.yml
name: Accessibility Tests
on: [push, pull_request]

jobs:
  pa11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2

      - name: Install dependencies
        run: npm ci

      - name: Start application
        run: npm start &

      - name: Wait for app
        run: npx wait-on http://localhost:3000

      - name: Run Pa11y tests
        run: npx pa11y-ci

      - name: Upload results
        if: failure()
        uses: actions/upload-artifact@v2
        with:
          name: pa11y-results
          path: pa11y-results/
```

### Manual Testing Checklist

#### Keyboard Testing
- [ ] Can navigate to all interactive elements with Tab
- [ ] Focus order follows logical reading order
- [ ] Focus indicators are visible and have 3:1 contrast
- [ ] Can activate all controls with Enter/Space
- [ ] Can exit modals/menus with Escape
- [ ] No keyboard traps (can Tab out of all areas)
- [ ] Shortcuts don't conflict with screen reader keys

#### Screen Reader Testing
- [ ] All images have appropriate alt text
- [ ] Form fields have associated labels
- [ ] Error messages are announced
- [ ] Dynamic changes are announced via live regions
- [ ] Landmark regions are properly labeled
- [ ] Tables have proper headers and captions
- [ ] Lists are marked up semantically

#### Visual Testing
- [ ] Text has 4.5:1 contrast ratio (3:1 for large text)
- [ ] Focus indicators have 3:1 contrast
- [ ] Interactive elements are minimum 24x24 pixels
- [ ] Content reflows at 200% zoom without horizontal scroll
- [ ] No information conveyed by color alone
- [ ] Animations respect prefers-reduced-motion

---

## Migration Guide

### Phase 1: Foundation (Week 1-2)
1. **Install accessibility dependencies**
   ```bash
   npm install --save \
     @react-aria/focus \
     @react-aria/live-announcer \
     @react-aria/utils \
     focus-trap-react \
     @axe-core/playwright \
     jest-axe
   ```

2. **Set up automated testing**
   - Configure axe-core with Playwright
   - Add Pa11y to CI pipeline
   - Set up pre-commit hooks for accessibility

3. **Create accessibility utilities**
   - Skip links component
   - Screen reader only CSS class
   - Focus management hooks
   - Announcer service

### Phase 2: Critical Components (Week 3-4)
Fix P0 components in order of user impact:

1. **DJInterface** - Main application shell
   - Add semantic landmarks
   - Implement skip links
   - Fix focus flow

2. **GraphVisualization** - Core feature
   - Add keyboard navigation
   - Create data table alternative
   - Implement announcements

3. **IntelligentBrowser** - Track selection
   - Add ARIA labels
   - Implement keyboard navigation
   - Fix focus management

### Phase 3: Interactive Features (Week 5-6)
1. **SetlistBuilder**
   - Make drag-drop keyboard accessible
   - Add alternative controls
   - Implement announcements

2. **PathfinderPanel**
   - Add keyboard shortcuts
   - Implement focus trap
   - Add live regions

3. **AdvancedSearch**
   - Fix autocomplete pattern
   - Add error announcements
   - Implement proper focus

### Phase 4: Visual Components (Week 7)
1. **CamelotHelix3D** & **Graph3D**
   - Add 2D alternatives
   - Implement keyboard controls
   - Add detailed descriptions

2. **PathBuilder**
   - Keyboard waypoint management
   - Add announcements
   - Fix focus flow

### Phase 5: Testing & Documentation (Week 8)
1. **Comprehensive testing**
   - Manual testing with screen readers
   - User testing with disabled users
   - Performance impact assessment

2. **Documentation**
   - Update component documentation
   - Create accessibility statement
   - Document keyboard shortcuts

---

## Compliance Checklist

### WCAG 2.2 Level AA Requirements

#### Perceivable
- [ ] **1.1.1 Non-text Content**: All images have alt text
- [ ] **1.3.1 Info and Relationships**: Semantic HTML used
- [ ] **1.3.5 Identify Input Purpose**: Autocomplete attributes
- [ ] **1.4.3 Contrast (Minimum)**: 4.5:1 text contrast
- [ ] **1.4.11 Non-text Contrast**: 3:1 UI component contrast

#### Operable
- [ ] **2.1.1 Keyboard**: All functionality keyboard accessible
- [ ] **2.1.2 No Keyboard Trap**: Can Tab out of all components
- [ ] **2.4.3 Focus Order**: Logical tab order
- [ ] **2.4.7 Focus Visible**: Focus indicators visible
- [ ] **2.5.5 Target Size**: Minimum 24x24 pixel targets
- [ ] **2.5.7 Dragging Movements**: Alternative to drag

#### Understandable
- [ ] **3.2.1 On Focus**: No unexpected context changes
- [ ] **3.3.1 Error Identification**: Errors clearly identified
- [ ] **3.3.2 Labels or Instructions**: All inputs labeled

#### Robust
- [ ] **4.1.2 Name, Role, Value**: ARIA used correctly
- [ ] **4.1.3 Status Messages**: Live regions for updates

### Legal Compliance Documentation

#### VPAT (Voluntary Product Accessibility Template)
Create a VPAT documenting:
- Conformance level (AA target)
- Success criteria compliance status
- Known issues and remediation timeline
- Contact for accessibility concerns

#### Accessibility Statement
```markdown
# SongNodes Accessibility Statement

## Our Commitment
SongNodes is committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone and applying the relevant accessibility standards.

## Conformance Status
SongNodes aims to conform to WCAG 2.2 Level AA. We are currently undergoing accessibility improvements with a target completion date of [DATE].

## Feedback
We welcome your feedback on the accessibility of SongNodes. Please contact us:
- Email: accessibility@songnodes.com
- Phone: [Phone number]

## Technical Specifications
Accessibility of SongNodes relies on the following technologies:
- HTML
- CSS
- JavaScript
- WAI-ARIA

## Assessment Approach
We assessed accessibility through:
- Self-evaluation
- Automated testing with axe-core
- Manual testing with screen readers
- User testing with disabled users

## Known Limitations
1. 3D visualizations may not be fully accessible
2. Some third-party content may not meet standards

Last updated: [DATE]
```

---

## Conclusion

Implementing these accessibility improvements will:
1. **Ensure legal compliance** with ADA and international laws
2. **Expand market reach** to 15% of users with disabilities
3. **Improve SEO** through semantic HTML and proper structure
4. **Enhance UX for everyone** through better keyboard support
5. **Demonstrate social responsibility** and inclusive design

The investment in accessibility pays dividends in user satisfaction, legal protection, and market expansion. By following this guide, SongNodes will become a leader in accessible music visualization and DJ tools.

## Resources

### Documentation
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

### Tools
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [NVDA Screen Reader](https://www.nvaccess.org/)
- [Pa11y Command Line](https://pa11y.org/)
- [Contrast Checker](https://webaim.org/resources/contrastchecker/)

### Libraries
- [React Aria](https://react-spectrum.adobe.com/react-aria/)
- [Radix UI](https://www.radix-ui.com/)
- [focus-trap-react](https://github.com/focus-trap/focus-trap-react)
- [@dnd-kit](https://dndkit.com/) (accessible drag and drop)

### Testing
- [Playwright Accessibility](https://playwright.dev/docs/accessibility-testing)
- [jest-axe](https://github.com/nickcolley/jest-axe)
- [Testing Library](https://testing-library.com/docs/queries/byrole)