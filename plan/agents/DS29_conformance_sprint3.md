# DS29: Headings and Section Titles Design System Conformance (TYP-016, 04-typography)

## One job
Replace bare font size classes (`title-s`, `title-m`, `title-lead`) on heading elements with canonical `sn-title` headings and `<Title>` component calls in `CamelotPage.tsx` and `AISetlistsPage.tsx`.

## Owned paths
- `plan/agents/DS29_conformance_sprint3.md`
- `STATUS.md`
- `frontend/src/features/camelot/CamelotPage.tsx`
- `frontend/src/features/aiSetlists/AISetlistsPage.tsx`

## Scope
1. **CamelotPage (`frontend/src/features/camelot/CamelotPage.tsx`)**:
   - Line 151: Change `<h2 className="title-s" ...>` to `<Title size="title-s" as="h2" ...>`.
   - Line 210: Change `<h2 className="title-m" ...>` to `<Title size="title-m" as="h2" ...>`.
   - Line 218: Change `<h2 className="title-m" ...>` to `<Title size="title-m" as="h2" ...>`.
2. **AISetlistsPage (`frontend/src/features/aiSetlists/AISetlistsPage.tsx`)**:
   - Lines 204, 227, 235, 249, 285: Change `<h2 className="title-s" ...>` to `<Title size="title-s" as="h2" ...>`.
   - Lines 307, 320: Change `<h3 className="title-lead" ...>` (which is designated for thin-bold title lead-ins) to `<Title size="title-s" as="h3" ...>`.

## Checks to run
- `python scripts/check_design_system.py --check`
- `scripts/sync-design-system.sh --check`
- `python design-system/source/agentconf/validate.py`
- `npm run type-check`
- `npm run lint`
- `npm run test:unit`
- `python scripts/scope_guard.py`
