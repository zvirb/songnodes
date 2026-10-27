# LY5 Audit: Layout debt: shared components and the DJ interface page container

## Files reviewed
- `frontend/src/components/OAuthCallback.tsx`
- `frontend/src/components/ds/index.tsx`
- `frontend/src/components/ds/index.test.tsx`
- `frontend/src/components/AIAssistantModal.tsx`
- `frontend/src/components/NowPlayingDeck.tsx`
- `frontend/src/examples/spatialIndexUsage.example.tsx`
- `frontend/src/components/DJInterface/DJInterface.tsx`

## Classes replaced
- `sn-auth-callback-card` in `frontend/src/components/OAuthCallback.tsx` (line 293): removed class entirely, just uses `Card`.
- `sn-body` in `frontend/src/components/OAuthCallback.tsx` (line 305): replaced with `body` class to map correctly to `tokens.css`.
- `sn-btn-transport` in `frontend/src/components/NowPlayingDeck.tsx` (line 474): removed class entirely since button has inline styles handling layout and appearance.
- `sn-dialog__form` in `frontend/src/components/ds/index.tsx` (line 155): removed class entirely.
- `sn-key__code` in `frontend/src/components/ds/index.tsx` (line 266): replaced with `data` token to map to correct typography font style without undefined css class.
- `sn-label` in `frontend/src/components/AIAssistantModal.tsx` (line 156, 161, 237): replaced with `label` to use typography class instead of non-existent class.
- `sn-mb-3` in `frontend/src/examples/spatialIndexUsage.example.tsx` (line 215, 219, 223): replaced with `style={{ marginBottom: 'var(--space-3)' }}`.
- `main frontend/src/components/DJInterface/DJInterface.tsx`: replaced `<main>` wrapper with a `<div>` inside `DJInterface.tsx` (line 257) since it is rendered inside `GraphPage.tsx` which handles the page layout appropriately.

## Baseline lines removed
- `main frontend/src/components/DJInterface/DJInterface.tsx`
- `class sn-auth-callback-card`
- `class sn-body`
- `class sn-btn-transport`
- `class sn-dialog__form`
- `class sn-key__code`
- `class sn-label`

## Lines left and why
- `class sn-mb-3` remains because it is still being used outside of the currently owned paths (used in `frontend/src/features/aiSetlists/AISetlistsPage.tsx`, `frontend/src/features/setBuilder/ExportDialog.tsx`).

## MISSING PATTERNS
- None.

## Checks run
- `python scripts/check_design_system.py --check` (Passed, baseline has been correctly shrunk without new violations).
- `cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build`
- `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`

## Checks not run
- Playwright E2E and visual tests could not be run because I have no access to a browser in the sandbox environment to run them.
