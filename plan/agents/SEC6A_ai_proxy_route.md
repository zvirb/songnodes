SEC6A: AI proxy route on the REST API

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "SEC6A: AI proxy route on the REST API" on a branch starting with "sec6a-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:SEC6A BEGIN/END). Depends on: G3. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Add POST /api/v1/ai/complete so AI calls use the server-side encrypted keys instead of keys in the browser.

## Context (verified on main 2026-10-26)
frontend/src/services/aiService.ts calls Anthropic, OpenAI and Google from the browser with keys in localStorage (Gemini puts the key in the URL). The backend stores provider keys encrypted (services/rest_api/routers/api_keys.py, API_KEY_ENCRYPTION_SECRET).

## Owned paths
- services/rest_api/routers/ai_proxy.py
- services/rest_api/ai_proxy/**
- tests/ai_proxy/**

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/SEC6A/ if you need to record a decision.)

## Do
1. Body {provider: claude|openai|gemini, model, system?, prompt, max_tokens?, web_search?}; response {text, provider, model, usage?}. Keys come from the existing store through api_keys.py's helpers (do not duplicate crypto) and go in headers only.
2. Limits: provider allowlist, body size cap, max_tokens cap, timeout, bounded concurrency, readable 401/403/429/5xx mapping, no stack traces. Model names configurable; check current provider docs for request shapes.
3. Tests with mocked provider HTTP: success per provider, missing key, 429, 500, oversized body, timeout, and that no response, log line or exception contains the key.

## Done when (the reviewer's under-10-minute check; put it in the PR)
TestClient call with a fake key returns normalised text; the key never appears in output.

## Checks
`python -m pytest` for the paths you own, from the repo root. Report failures in files you do not own; do not fix them. Never print or commit a real key.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
