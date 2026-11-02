ESC1: The API client stops HTML-escaping data

Base: main at 9096637d. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md and CLAUDE.md. Branch `esc1-api-no-entity-escaping`. Edit only the lines inside your own STATUS.md slot (SLOT:ESC1).

## Job
Stop `frontend/src/services/api.ts` from entity-encoding every response, GET param and POST/PUT body through `sanitizeObject`/`sanitizeInput` (added in 2e2b30bd), while keeping the dangerous-URL-scheme guard on response data that may be rendered as links.

## Context (local test, 2 Nov 2026)
`docs/integration/LOCAL-TEST-2026-11-02.md` (PR #518): /pipeline shows `Itch-E &amp; Scratch-E`, `Lab&#x27;s Cloud` and `{&quot;detail&quot;...`. React already escapes text, so the encoding is a double escape, and writes through `apiClient.post`/`put` (e.g. `TargetTracksManager`) would store `&amp;` in the database. No stored row contains entities yet.

## Owned paths
- frontend/src/lib/utils.ts (`sanitizeInput`, `sanitizeObject` only)
- frontend/src/services/api.ts
- frontend/src/services/api.test.ts (new)
- plan/agents/ESC1_api_no_entity_escaping.md (this brief)
- STATUS.md (SLOT:ESC1 only)

## Do
1. `sanitizeInput` keeps removing control characters and turning javascript:, vbscript: and non-image data: values into about:blank, and returns every other string unchanged.
2. Responses still pass through `sanitizeObject`. GET params and POST/PUT bodies are sent as typed.
3. Vitest: names with & and ' display as stored and round-trip unchanged through POST and PUT; a script URL in a response becomes about:blank.

## Checks
tsc, oxlint, vitest, vite build, `sync-design-system.sh --check`, `check_design_system.py --check`, scope guard, `scripts/e2e-docker.sh`.
