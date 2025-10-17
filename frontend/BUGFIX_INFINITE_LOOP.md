# Frontend Infinite Loop Bug Fix - GraphMiniMap

## Issue
The frontend was hanging during page load with an infinite re-render loop, causing the browser to become unresponsive with "Loading..." message and requiring "kill or wait" dialog.

## Root Cause
**File**: `/mnt/my_external_drive/programming/songnodes/frontend/src/components/GraphMiniMap.tsx`

### The Problem
The infinite loop was caused by incorrect useEffect dependency management with PIXI.js ticker callbacks:

```typescript
// BEFORE (BROKEN):
const initializeMiniMap = useCallback(async () => {
  // ... initialization code ...
  app.ticker.add(renderMiniMap);  // ❌ Added ticker callback here
}, []); // No dependencies

const renderMiniMap = useCallback(() => {
  // ... rendering logic ...
}, [graphData, viewState.zoom, viewState.pan, mainGraphWidth, mainGraphHeight, view]); // ✅ Proper dependencies

useEffect(() => {
  initializeMiniMap();
  return () => {
    if (pixiAppRef.current) {
      pixiAppRef.current.ticker.remove(renderMiniMap); // ❌ Cleanup on every change
      pixiAppRef.current.destroy(true, { children: true, texture: true });
      pixiAppRef.current = null;
    }
  };
}, [initializeMiniMap, renderMiniMap]); // ❌ Depends on renderMiniMap
```

### Why This Caused an Infinite Loop
1. `renderMiniMap` is recreated every time its dependencies (`graphData`, `viewState.zoom`, etc.) change
2. When `renderMiniMap` changes, the useEffect re-runs because it depends on `renderMiniMap`
3. The cleanup function removes the ticker callback and destroys the PIXI app
4. The effect then calls `initializeMiniMap()` again, which recreates the app
5. `initializeMiniMap` adds the OLD `renderMiniMap` callback to the ticker
6. This creates a cycle: renderMiniMap changes → effect runs → app destroyed → app recreated → old callback added → renders → dependencies change → renderMiniMap changes → ...

## Solution
Split the initialization and ticker management into two separate effects:

```typescript
// AFTER (FIXED):
const initializeMiniMap = useCallback(async () => {
  // ... initialization code ...
  // ✅ Don't add ticker callback here
}, []); // No dependencies

const renderMiniMap = useCallback(() => {
  // ... rendering logic ...
}, [graphData, viewState.zoom, viewState.pan, mainGraphWidth, mainGraphHeight, view]); // ✅ Proper dependencies

// Effect 1: Initialize PIXI app once on mount
useEffect(() => {
  initializeMiniMap();
  return () => {
    if (pixiAppRef.current) {
      pixiAppRef.current.destroy(true, { children: true, texture: true });
      pixiAppRef.current = null;
    }
  };
}, [initializeMiniMap]); // ✅ Only depends on initializeMiniMap (which has no deps)

// Effect 2: Add/remove ticker callback when renderMiniMap changes
useEffect(() => {
  const app = pixiAppRef.current;
  if (!app) return;

  app.ticker.add(renderMiniMap); // ✅ Add ticker callback here

  return () => {
    app.ticker.remove(renderMiniMap); // ✅ Remove only ticker callback
  };
}, [renderMiniMap]); // ✅ Re-run when renderMiniMap changes
```

### Why This Works
1. **Effect 1** initializes the PIXI app once on mount and cleans up on unmount
2. **Effect 2** manages the ticker callback separately, adding/removing it when `renderMiniMap` changes
3. When `renderMiniMap` changes due to dependency updates:
   - Effect 2 removes the OLD ticker callback
   - Effect 2 adds the NEW ticker callback
   - The PIXI app is NOT destroyed and recreated
   - No infinite loop occurs

## Files Modified
- `/mnt/my_external_drive/programming/songnodes/frontend/src/components/GraphMiniMap.tsx`

## Testing
1. Start the frontend: `cd frontend && npm run dev`
2. Load the page in the browser
3. Verify that:
   - The page loads without hanging
   - The mini-map renders correctly
   - The mini-map updates when the viewport changes
   - No console errors appear
   - No infinite re-render warnings

## Verification Commands
```bash
# Check the fix
git diff frontend/src/components/GraphMiniMap.tsx

# Rebuild and test
cd frontend
npm run dev
```

## Related Issues
- The API successfully returns 472 nodes and 556 edges
- All assets load successfully
- The hang occurred AFTER data loads, during React rendering
- OnboardingOverlay is disabled (returns null on line 34)
- EditTrackModal was removed from ContextMenu to fix an earlier infinite loop issue

## Prevention Guidelines
When working with PIXI.js or other animation frameworks in React:

1. **Separate initialization from rendering**: Initialize the canvas/app once, manage rendering separately
2. **Be careful with ticker callbacks**: Don't add callbacks that depend on changing React state in initialization
3. **Split effects by concern**: One effect for initialization, another for updating
4. **Watch dependency arrays**: Ensure useEffect dependencies don't cause unnecessary re-runs
5. **Test with React DevTools Profiler**: Look for excessive re-renders

## Date Fixed
2025-10-17
