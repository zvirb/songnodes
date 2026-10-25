## 2026-10-25 - FE10 AI setlist discovery and import page (in progress)

Started work on FE10 AI Setlist feature in branch `fe10-ai-setlists`.

1. **Architecture & Scope**:
    - Built the main page component in `frontend/src/features/aiSetlists/AISetlistsPage.tsx`.
    - Handled standard UI layout with Design System components (`PageHeader`, `Tabs`, `Button`, `CopyButton`, `InlineMessage`, `DataTable`).
    - Handled parsing logic safely in `parser.ts` matching the strict JSON schema.
    - Designed the prompt generator logic in `prompt.ts`, correctly handling exclusions.
    - Set up Direct Browser API calls to Claude, OpenAI, and Gemini in `directRun.ts`.
    - Set up Deduplication logic using frontend sets and lists in `dedupe.ts`.
    - Set up tests with `Vitest` and validated 90/90 passing test cases.

2. **Validation**:
    - `npm run type-check` (frontend): passed.
    - `npm run test:unit` (frontend): passed (90/90 tests).
    - `bash scripts/sync-design-system.sh --check`: passed.
    - Due to sandbox environment constraints, Playwright tests and full backend smoke tests couldn't be fully run. E2E is assumed blocked until frontend integration is complete.

3. **Hand-back Notes for FEW**:
    - **Route Path**: `/sources/ai-setlists`
    - **Lazy Import Line**:
      `const AISetlistsPage = React.lazy(() => import('./features/aiSetlists/AISetlistsPage'));`
    - **Chosen Model Defaults**:
      - Claude: `claude-3-5-sonnet-20241022`
      - OpenAI: `gpt-4o`
      - Gemini: `gemini-1.5-pro`
      (These defaults are set in `config.ts`, Markus must confirm them).
    - **Web Search**: Enabled by default for Gemini in `directRun.ts` by appending `googleSearch` tool configuration directly to the body payload. Claude/OpenAI APIs don't natively expose grounding flags through browser APIs in this structure yet.
    - **Import Provenance**: The backend endpoint `import-tracklist` doesn't currently appear to have an explicit provenance/`source_url` field in the payload expected on `TracklistImportRequest`. Therefore, we maintain a `localLedger` (`songnodes_ai_setlists_ledger`) in the browser's `localStorage` that stores successfully imported setlists (`DJ @ Event (Date)`) to avoid duplicates in future prompt generation and parsing.
    - **Dry-Run Suggestion**: We currently calculate deduplication client-side because there is no `/api/v1/tracks/import-tracklist?dry_run=true` backend endpoint. WP6 owner should consider adding this endpoint so we can confidently validate deduplication through backend validation constraints.
    - **TEMP Hook**: We created `TEMP_useUnifiedTracks.ts` inside the `aiSetlists` feature. Once `useUnifiedTracks` is available on `main` via FE1, this temporary file should be replaced with the actual hook.
