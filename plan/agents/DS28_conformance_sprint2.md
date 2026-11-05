# DS28: EmptyState Action and Filter Tag Conformance (FBK-001, FBK-002, WRT-110)

## One job
Bring empty states and no-match filtered tables into conformance with design system rules FBK-001, FBK-002, and WRT-110 by providing informative explanation sentences, exactly one clear action, and active filter tags in metadata.

## Owned paths
- `plan/agents/DS28_conformance_sprint2.md`
- `STATUS.md`
- `frontend/src/features/musicLibrary/SetBuilderPage.tsx`
- `frontend/src/features/musicLibrary/LibraryPage.tsx`
- `frontend/src/features/pathfinder/PathfinderPage.tsx`

## Scope
1. **SetBuilderPage Empty States (`FBK-001`, `WRT-110`)**:
   - Running order empty state (`No tracks yet`): add primary action `<button className="sn-btn sn-btn--primary" type="button" onClick={() => build()} disabled={!lib}><SnIcon name="wand-sparkles" />Build set</button>`.
   - Saved sets empty state (`No saved sets yet`): update text from "Build a set and save it to see it here." to "Build a set from the crate and save it here.", and add primary action button that triggers `save()` (or builds a set if empty).
2. **LibraryPage Filtered Empty State (`FBK-002`)**:
   - Provide active filter chips in `meta` as `.sn-tag` elements for pillars, energy tiers, rotation, and search queries so the user sees exactly what is filtering out results, paired with the "Clear filters" action.
3. **PathfinderPage Empty States (`FBK-001`, `WRT-110`)**:
   - Ready empty state (`Ready to find a path`): provide an action to focus the start track combobox.
   - No tracks found (`No tracks found`): provide an action link `<Link className="sn-link sn-m-library" to="/library">Open library</Link>`.

## Checks to run
- `python scripts/check_design_system.py --check`
- `scripts/sync-design-system.sh --check`
- `python design-system/source/agentconf/validate.py`
- `npm run type-check`
- `npm run lint`
- `npm run test:unit`
- `python scripts/scope_guard.py`
