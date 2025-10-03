# Pathfinder Context Menu - Manual Verification Guide

## Quick Verification Checklist

This guide helps you manually verify the right-click context menu integration for the pathfinder feature.

### Prerequisites
- Frontend dev server running: `npm run dev` (http://localhost:3006)
- REST API running: `docker compose up rest-api`
- Graph data loaded (467 tracks visible in the UI)

---

## Test 1: Right-Click on Graph Node

**Steps:**
1. Navigate to http://localhost:3006
2. Switch to **Librarian Mode** (click "Librarian" button in header)
3. Wait for the graph visualization to load (you should see nodes connected by edges)
4. **Right-click** on any node in the graph

**Expected Result:**
✅ A white context menu appears at the cursor position
✅ Shows track info header (track name, artist, BPM, key)
✅ Shows "Pathfinder" section with actions:
   - Set as Start Track
   - Set as End Track
   - Add as Waypoint

**Screenshot Location:** Should see menu like this:
```
┌─────────────────────────────┐
│ Track Name                  │
│ Artist Name                 │
│ 1A • 128 BPM                │
├─────────────────────────────┤
│ Pathfinder                  │
│  ▶ Set as Start Track       │
│  ▶ Set as End Track         │
│  ▶ Add as Waypoint          │
└─────────────────────────────┘
```

---

## Test 2: Right-Click on Tracklist Item

**Steps:**
1. In **Librarian Mode**, look at the **Library** panel on the left
2. You should see a list of tracks with format: "Track Name / Artist • BPM • Key"
3. **Right-click** on any track in the list

**Expected Result:**
✅ Context menu appears at cursor position (same as graph node)
✅ Same track info and pathfinder actions available

---

## Test 3: Set Start Track via Context Menu

**Steps:**
1. Switch to **Librarian Mode**
2. Click the **🗺️ Pathfinder** tab in the right panel
3. Right-click on a track (either graph node or list item)
4. Click **"Set as Start Track"** in the context menu

**Expected Result:**
✅ Context menu closes
✅ PathfinderPanel now shows the selected track under "Start Track"
✅ Shows track name, artist info, and a "Remove" button

**Verification:**
- Right-click the **same track** again
- The button should now say **"Clear Start Track (Current)"** with green background
- The checkmark (✓) should appear next to it

---

## Test 4: Set End Track via Context Menu

**Steps:**
1. In the tracklist, find a **different track** than the start track
2. Right-click on it
3. Click **"Set as End Track"**

**Expected Result:**
✅ Context menu closes
✅ PathfinderPanel shows the track under "End Track"
✅ Shows "Remove" button

---

## Test 5: Add Waypoints via Context Menu

**Steps:**
1. Right-click on a **third track**
2. Click **"Add as Waypoint"**
3. Repeat for 1-2 more tracks

**Expected Result:**
✅ Each track appears in the "Waypoints" section of PathfinderPanel
✅ Each waypoint shows track info and an "×" remove button
✅ Right-clicking a waypoint track shows **"Remove from Waypoints"** instead

---

## Test 6: Visual Indicators

**Steps:**
1. Set up: Start track, End track, and 1 waypoint
2. Right-click on the **start track** again

**Expected Result:**
✅ Button shows **"Clear Start Track (Current)"**
✅ Has green background (`bg-green-50 text-green-700`)
✅ Shows checkmark (✓)

**Repeat for End Track:**
✅ Button shows **"Clear End Track (Current)"**
✅ Blue background (`bg-blue-50 text-blue-700`)

**Repeat for Waypoint:**
✅ Button shows **"Remove from Waypoints (Current)"**
✅ Orange background (`bg-orange-50 text-orange-700`)

---

## Test 7: Context Menu Dismissal

**Test 7a: Click Outside**
1. Right-click a track to open context menu
2. Click anywhere else on the page

**Expected:** ✅ Menu closes

**Test 7b: Press Escape**
1. Right-click a track to open context menu
2. Press **Escape** key

**Expected:** ✅ Menu closes

**Test 7c: Select an Action**
1. Right-click a track
2. Click any action (e.g., "Set as Start Track")

**Expected:** ✅ Menu closes after action completes

---

## Test 8: Edge Position Adjustment

**Steps:**
1. Scroll to the **bottom-right** corner of the page
2. Find a track near the edge (or scroll the tracklist to the bottom)
3. Right-click on a track at the very edge

**Expected Result:**
✅ Context menu appears **but stays within viewport bounds**
✅ Menu adjusts position to the left/up if needed
✅ No part of the menu is cut off or outside the screen

**Check:** The menu should automatically shift to ensure it's fully visible

---

## Test 9: Integration with Pathfinder

**Steps:**
1. Set a start track via context menu (e.g., track with 128 BPM, 1A key)
2. Optionally set an end track
3. Add 1-2 waypoints
4. In the PathfinderPanel, adjust:
   - Target Duration: 60 minutes
   - Tolerance: ±5 minutes
   - Enable "Prefer Key Matching"
5. Click **"Find Path"** button

**Expected Result:**
✅ Loading indicator appears
✅ Path calculation runs (calls `/api/v1/pathfinder/find-path`)
✅ Results appear showing:
   - Total tracks in path
   - Total duration
   - List of tracks in order
   - Key compatibility indicators (🎵 = perfect match, ⚡ = energy flow)

---

## Test 10: Multiple Rapid Right-Clicks

**Steps:**
1. Right-click a track **3 times quickly** (within 1 second)

**Expected Result:**
✅ Only **ONE** context menu appears (no duplicates)
✅ The menu stays open

---

## Test 11: Cross-Component State Sync

**Setup:**
1. Right-click a graph node → Set as Start Track
2. Go to the tracklist, find the **same track**
3. Right-click it

**Expected Result:**
✅ Context menu shows **"Clear Start Track (Current)"** with checkmark
✅ State is correctly synced via Zustand store

**Reverse Test:**
1. Right-click a tracklist item → Set as End Track
2. Find the same node in the graph
3. Right-click it

**Expected Result:**
✅ Shows **"Clear End Track (Current)"**

---

## Test 12: Performer Mode (Should NOT Work)

**Steps:**
1. Switch to **Performer Mode** (click "Performer" button)
2. Try to right-click on the graph

**Expected Result:**
✅ Context menu **does NOT appear** (pathfinder is Librarian-only feature)
✅ OR context menu appears but only with basic track info, no pathfinder actions

---

## Common Issues & Fixes

### Issue: Context menu doesn't appear
**Cause:** React event handler not attached
**Fix:** Check browser console for errors. Verify `onContextMenu` is on the track button element.

### Issue: Context menu appears in wrong position
**Cause:** Coordinate conversion issue
**Fix:** Check `e.clientX, e.clientY` for tracklist, and PIXI canvas rect calculation for graph nodes.

### Issue: Selections don't appear in PathfinderPanel
**Cause:** Zustand store not updating
**Fix:** Open browser DevTools → Console → Run:
```javascript
window.debugZustand.getState().pathfindingState
```
Should show: `startTrackId`, `endTrackId`, `selectedWaypoints` Set

### Issue: "Cannot read property 'id' of null" error
**Cause:** Track object missing in context menu
**Fix:** Verify track prop is passed correctly from graph/tracklist to context menu handler

---

## Browser Console Checks

Open DevTools Console and run:

```javascript
// Check Zustand pathfinding state
window.debugZustand.getState().pathfindingState

// Should return:
{
  startTrackId: "track-id-here" or null,
  endTrackId: "track-id-here" or null,
  selectedWaypoints: Set(0) or Set(2) {id1, id2},
  isCalculating: false,
  currentPath: null,
  ...
}

// Check if pathfinding actions work
const store = window.debugZustand.getState();
store.pathfinding.setStartTrack("some-track-id");
store.pathfinding.addWaypoint("another-track-id");

// Verify state updated
window.debugZustand.getState().pathfindingState
```

---

## Success Criteria

✅ All 12 tests pass
✅ No console errors during right-click operations
✅ Context menu appears smoothly (<100ms delay)
✅ Zustand store updates correctly
✅ PathfinderPanel reflects all selections in real-time
✅ Visual indicators (colors, checkmarks) work correctly
✅ Menu positioning is always within viewport
✅ Menu closes correctly with all 3 methods (click outside, Escape, select action)

---

## Performance Check

**Metric:** Context menu should appear within **100ms** of right-click
**Test:** Right-click on 10 different tracks and verify menu appears instantly

**Memory Check:**
1. Open DevTools → Performance Monitor
2. Right-click 20+ tracks in sequence
3. Verify no memory leaks (memory should stabilize, not continuously grow)

---

## Final Verification

Once all tests pass, the feature is ready for:
- ✅ Integration with main codebase
- ✅ Deployment to staging/production
- ✅ User acceptance testing

---

**Last Updated:** 2025-10-03
**Feature:** Right-Click Context Menu for Pathfinder Track Selection
**Components:** TrackContextMenu, GraphVisualization, DJInterface, PathfinderPanel
