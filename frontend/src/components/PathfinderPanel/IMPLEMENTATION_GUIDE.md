# PathfinderPanel Refactoring Implementation Guide

## Overview

This guide details the complete refactoring of the PathfinderPanel component from a 600-line monolithic component (score: 3/10) to a modern wizard-based architecture targeting <400 total lines with a score of 9/10.

## Completed Components

### 1. Core Architecture ✅

**File**: `types.ts` (115 lines)
- TypeScript interfaces for all domain models
- Wizard step configurations
- Default constraint values
- Complete type safety for the entire module

**File**: `pathfinder.machine.ts` (245 lines)
- XState state machine managing wizard flow
- States: idle, validating, calculating, success, error
- 11 event types for all user interactions
- Automatic step validation and progression
- Built-in error handling and recovery
- Export functionality (JSON, M3U, CSV)

**File**: `hooks.ts` (220 lines)
- `usePathfinder()`: Main hook integrating XState with Zustand
- `useWizardNavigation()`: Keyboard navigation support
- `usePathfindingAlgorithm()`: Algorithm configuration
- `useFocusManagement()`: WCAG 2.2 focus management
- `useScreenReaderAnnouncement()`: ARIA live region announcements
- `useDebouncedConstraintUpdate()`: Performance optimization
- `useFormatDuration()`: Utility for time formatting

**Total Core Lines**: 580 lines (well-organized, single responsibility)

## Remaining Components to Implement

### 2. Wizard Step Components

Each step component should be <80 lines, focused, and highly accessible.

#### Step 1: SelectStartTrack.tsx (Target: 75 lines)

```tsx
import React from 'react';
import { Track } from '../../../types';
import { useScreenReaderAnnouncement } from '../hooks';

interface SelectStartTrackProps {
  selectedTrack: Track | null;
  currentlySelectedTrack: Track | null;
  onSelectTrack: (track: Track) => void;
  onNext: () => void;
}

export const SelectStartTrack: React.FC<SelectStartTrackProps> = ({
  selectedTrack,
  currentlySelectedTrack,
  onSelectTrack,
  onNext,
}) => {
  const announce = useScreenReaderAnnouncement();

  const handleUseCurrentSelection = () => {
    if (currentlySelectedTrack) {
      onSelectTrack(currentlySelectedTrack);
      announce(
        `Start track set to ${currentlySelectedTrack.name} by ${currentlySelectedTrack.artist}`,
        'polite'
      );
    }
  };

  const handleNext = () => {
    if (selectedTrack) {
      announce('Proceeding to next step', 'polite');
      onNext();
    }
  };

  return (
    <div
      className="wizard-step"
      role="region"
      aria-labelledby="step-start-title"
      aria-describedby="step-start-description"
    >
      <h2 id="step-start-title" className="text-2xl font-bold mb-2">
        Select Start Track
      </h2>
      <p id="step-start-description" className="text-gray-600 mb-6">
        Choose the track to begin your DJ set. You can select a track from the graph
        visualization and click "Use Selected Track" below.
      </p>

      {/* Currently selected track from graph */}
      {currentlySelectedTrack && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
          <span className="text-xs font-semibold text-purple-700">Currently Selected:</span>
          <div className="mt-1">
            <div className="font-medium">{currentlySelectedTrack.name}</div>
            <div className="text-sm text-gray-600">{currentlySelectedTrack.artist}</div>
          </div>
        </div>
      )}

      {/* Selected start track display */}
      {selectedTrack ? (
        <div
          className="bg-green-50 border border-green-200 rounded-lg p-4"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-green-700">Start Track:</span>
              <div className="mt-1">
                <div className="font-medium">{selectedTrack.name}</div>
                <div className="text-sm text-gray-600">{selectedTrack.artist}</div>
              </div>
            </div>
            <button
              onClick={() => onSelectTrack(null as any)}
              aria-label="Clear start track selection"
              className="text-red-600 hover:text-red-800"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleUseCurrentSelection}
          disabled={!currentlySelectedTrack}
          aria-label={
            currentlySelectedTrack
              ? `Use ${currentlySelectedTrack.name} as start track`
              : 'Select a track from the graph first'
          }
          className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-green-400 hover:text-green-800 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ minHeight: '48px' }} // WCAG 2.2 AA target size
        >
          {currentlySelectedTrack ? '✓ Use Selected Track' : 'Select a track on the graph'}
        </button>
      )}

      {/* Navigation */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleNext}
          disabled={!selectedTrack}
          aria-label="Proceed to next step"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          style={{ minHeight: '48px', minWidth: '120px' }}
        >
          Next
        </button>
      </div>
    </div>
  );
};
```

**Key Features**:
- Minimum 48x48px touch targets (WCAG 2.2 AA)
- ARIA labels and descriptions
- Live regions for screen reader announcements
- Keyboard navigation support
- Clear visual feedback for all states

#### Step 2: SelectEndTrack.tsx (Target: 70 lines)
Similar structure to SelectStartTrack but with optional selection.

#### Step 3: ConfigureConstraints.tsx (Target: 150 lines)

Use React Hook Form + Zod for validation:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const constraintsSchema = z.object({
  targetDuration: z.number().min(15).max(480),
  tolerance: z.number().min(1).max(30),
  preferKeyMatching: z.boolean(),
  minBpm: z.number().min(60).max(200).optional(),
  maxBpm: z.number().min(60).max(200).optional(),
});

type ConstraintsFormData = z.infer<typeof constraintsSchema>;

export const ConfigureConstraints: React.FC = ({ ... }) => {
  const { register, handleSubmit, formState: { errors }, watch } = useForm<ConstraintsFormData>({
    resolver: zodResolver(constraintsSchema),
    defaultValues: {
      targetDuration: 120,
      tolerance: 5,
      preferKeyMatching: true,
    },
  });

  // Real-time validation feedback
  const targetDuration = watch('targetDuration');

  return (
    <form onSubmit={handleSubmit(onSubmit)} aria-labelledby="step-constraints-title">
      {/* Duration slider with ARIA */}
      <div className="form-group">
        <label htmlFor="target-duration">
          Target Duration: {Math.floor(targetDuration / 60)}h {targetDuration % 60}m
        </label>
        <input
          id="target-duration"
          type="range"
          min="15"
          max="480"
          step="5"
          {...register('targetDuration')}
          aria-valuemin={15}
          aria-valuemax={480}
          aria-valuenow={targetDuration}
          aria-valuetext={`${Math.floor(targetDuration / 60)} hours ${targetDuration % 60} minutes`}
          aria-describedby={errors.targetDuration ? 'target-duration-error' : undefined}
        />
        {errors.targetDuration && (
          <span id="target-duration-error" role="alert" className="error">
            {errors.targetDuration.message}
          </span>
        )}
      </div>

      {/* Checkbox with proper ARIA */}
      <div className="form-group">
        <label className="flex items-center">
          <input
            type="checkbox"
            {...register('preferKeyMatching')}
            className="w-5 h-5 mr-2"
            aria-describedby="key-matching-hint"
          />
          <span>Use Camelot key matching</span>
        </label>
        <span id="key-matching-hint" className="text-sm text-gray-600">
          Prioritize harmonically compatible transitions
        </span>
      </div>

      {/* Navigation with disabled state management */}
      <div className="flex justify-between mt-6">
        <button type="button" onClick={onPrevious}>
          Previous
        </button>
        <button type="submit" disabled={Object.keys(errors).length > 0}>
          Next
        </button>
      </div>
    </form>
  );
};
```

#### Step 4: AddWaypoints.tsx (Target: 120 lines)

Use @dnd-kit for accessible drag-and-drop:

```tsx
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

export const AddWaypoints: React.FC = ({ waypoints, onReorder, onRemove, onAdd }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = waypoints.findIndex((w) => w.id === active.id);
      const newIndex = waypoints.findIndex((w) => w.id === over.id);
      onReorder(oldIndex, newIndex);
    }
  };

  return (
    <div role="region" aria-label="Waypoint management">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={waypoints.map((w) => w.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul role="list" aria-label="Waypoints">
            {waypoints.map((waypoint, index) => (
              <SortableWaypoint
                key={waypoint.id}
                waypoint={waypoint}
                index={index}
                onRemove={onRemove}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {/* Keyboard alternative - move up/down buttons */}
      {/* ... */}
    </div>
  );
};
```

#### Step 5: ReviewPath.tsx (Target: 100 lines)
Display path results with export options and visualization preview.

### 3. Shared Components

#### PathVisualization.tsx (Target: 150 lines)
D3.js force-directed graph showing the calculated path visually.

#### ConstraintsForm.tsx (Already integrated in Step 3)

#### WaypointManager.tsx (Already integrated in Step 4)

### 4. Main Container

#### index.tsx (Target: 180 lines)

```tsx
import React, { useEffect } from 'react';
import { usePathfinder, useWizardNavigation, useFocusManagement } from './hooks';
import { WIZARD_STEPS } from './types';
import { SelectStartTrack } from './steps/SelectStartTrack';
import { SelectEndTrack } from './steps/SelectEndTrack';
import { ConfigureConstraints } from './steps/ConfigureConstraints';
import { AddWaypoints } from './steps/AddWaypoints';
import { ReviewPath } from './steps/ReviewPath';

export const PathfinderPanel: React.FC = () => {
  const { state, send, currentlySelectedTrack, isCalculating, hasResult, hasError } = usePathfinder();

  const currentStepIndex = WIZARD_STEPS.findIndex((s) => s.id === state.currentStep);
  const currentStepConfig = WIZARD_STEPS[currentStepIndex];
  const canGoNext = currentStepConfig.validation(state);
  const canGoPrevious = currentStepIndex > 0;

  useWizardNavigation(state.currentStep, send, canGoNext, canGoPrevious);
  const stepRef = useFocusManagement(state.currentStep);

  // Focus trap when panel is active
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Close panel or navigate back
        send({ type: 'PREVIOUS_STEP' });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [send]);

  return (
    <div
      className="pathfinder-panel h-full flex flex-col"
      role="region"
      aria-label="DJ Set Pathfinder"
    >
      {/* Progress indicator */}
      <nav aria-label="Wizard progress">
        <ol className="flex items-center justify-between mb-6">
          {WIZARD_STEPS.map((step, index) => (
            <li
              key={step.id}
              className={`
                step-indicator
                ${index === currentStepIndex ? 'active' : ''}
                ${state.completedSteps.has(step.id) ? 'completed' : ''}
              `}
            >
              <button
                onClick={() => send({ type: 'GO_TO_STEP', step: step.id })}
                aria-label={`${step.title}${state.completedSteps.has(step.id) ? ' (completed)' : ''}${index === currentStepIndex ? ' (current)' : ''}`}
                aria-current={index === currentStepIndex ? 'step' : undefined}
              >
                {index + 1}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {/* Current step */}
      <div ref={stepRef} tabIndex={-1} className="flex-1 overflow-y-auto">
        {state.currentStep === 'selectStart' && (
          <SelectStartTrack
            selectedTrack={state.startTrack}
            currentlySelectedTrack={currentlySelectedTrack}
            onSelectTrack={(track) => send({ type: 'SET_START_TRACK', track })}
            onNext={() => send({ type: 'NEXT_STEP' })}
          />
        )}

        {state.currentStep === 'selectEnd' && (
          <SelectEndTrack
            selectedTrack={state.endTrack}
            currentlySelectedTrack={currentlySelectedTrack}
            onSelectTrack={(track) => send({ type: 'SET_END_TRACK', track })}
            onNext={() => send({ type: 'NEXT_STEP' })}
            onPrevious={() => send({ type: 'PREVIOUS_STEP' })}
          />
        )}

        {state.currentStep === 'configureConstraints' && (
          <ConfigureConstraints
            constraints={state.constraints}
            onUpdate={(constraints) => send({ type: 'UPDATE_CONSTRAINTS', constraints })}
            onNext={() => send({ type: 'NEXT_STEP' })}
            onPrevious={() => send({ type: 'PREVIOUS_STEP' })}
          />
        )}

        {state.currentStep === 'addWaypoints' && (
          <AddWaypoints
            waypoints={state.waypoints}
            currentlySelectedTrack={currentlySelectedTrack}
            onAdd={(track) => send({ type: 'ADD_WAYPOINT', track })}
            onRemove={(waypointId) => send({ type: 'REMOVE_WAYPOINT', waypointId })}
            onReorder={(fromIndex, toIndex) =>
              send({ type: 'REORDER_WAYPOINTS', fromIndex, toIndex })
            }
            onNext={() => send({ type: 'NEXT_STEP' })}
            onPrevious={() => send({ type: 'PREVIOUS_STEP' })}
          />
        )}

        {state.currentStep === 'reviewPath' && (
          <ReviewPath
            context={state}
            isCalculating={isCalculating}
            hasResult={hasResult}
            hasError={hasError}
            onCalculate={() => send({ type: 'CALCULATE_PATH' })}
            onExport={(format) => send({ type: 'EXPORT_PATH', format })}
            onPrevious={() => send({ type: 'PREVIOUS_STEP' })}
            onReset={() => send({ type: 'RESET' })}
          />
        )}
      </div>

      {/* ARIA live region for announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {state.announcement}
      </div>

      {/* Error display */}
      {state.error && (
        <div role="alert" className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">{state.error}</p>
        </div>
      )}
    </div>
  );
};
```

## Implementation Checklist

### Phase 1: Complete Step Components (Week 1)
- [ ] SelectStartTrack.tsx (75 lines)
- [ ] SelectEndTrack.tsx (70 lines)
- [ ] ConfigureConstraints.tsx (150 lines)
- [ ] AddWaypoints.tsx (120 lines)
- [ ] ReviewPath.tsx (100 lines)

### Phase 2: Shared Components (Week 2)
- [ ] PathVisualization.tsx (150 lines)
- [ ] SortableWaypoint.tsx (60 lines)
- [ ] StepIndicator.tsx (40 lines)
- [ ] ExportModal.tsx (80 lines)

### Phase 3: Main Container & Integration (Week 3)
- [ ] index.tsx (180 lines)
- [ ] CSS module with design tokens
- [ ] Integration with existing Zustand store
- [ ] Keyboard shortcut documentation

### Phase 4: Accessibility & Testing (Week 4)
- [ ] NVDA screen reader testing
- [ ] JAWS screen reader testing
- [ ] Keyboard navigation testing
- [ ] Color contrast validation
- [ ] Focus indicator testing
- [ ] Mobile responsive testing
- [ ] Playwright E2E tests

## Dependencies Required

Add to package.json:
```json
{
  "@xstate/react": "^4.1.0",
  "xstate": "^5.0.0",
  "react-hook-form": "^7.49.0",
  "@hookform/resolvers": "^3.3.0",
  "zod": "^3.22.0",
  "@dnd-kit/core": "^6.1.0",
  "@dnd-kit/sortable": "^8.0.0",
  "@dnd-kit/utilities": "^3.2.0",
  "d3": "^7.8.0",
  "@types/d3": "^7.4.0"
}
```

## Final Metrics

**Target Architecture**:
- Total lines: <1200 (including all components)
- Average file size: <150 lines
- Cyclomatic complexity: <10 per function
- Accessibility score: WCAG 2.2 AA compliance
- Quality score: 9/10

**Performance**:
- First render: <100ms
- Step transition: <50ms
- Path calculation: Web Worker (non-blocking)
- Memory footprint: <5MB

**Accessibility**:
- All interactive elements: 24x24px minimum
- Focus indicators: 2px with 3:1 contrast
- Screen reader support: NVDA, JAWS, VoiceOver
- Keyboard navigation: Complete coverage
- ARIA live regions: Proper announcement timing

## Notes

1. **XState Machine**: Provides bulletproof state management with automatic validation
2. **React Hook Form + Zod**: Real-time validation with great DX
3. **@dnd-kit**: Modern, accessible drag-and-drop with keyboard support
4. **Focus Management**: Automatic focus shifting between wizard steps
5. **Design Tokens**: Use CSS variables for theming and consistency
6. **Mobile-First**: Touch targets, swipe gestures, responsive layout

This architecture transforms a problematic monolith into a maintainable, accessible, and performant wizard experience.
