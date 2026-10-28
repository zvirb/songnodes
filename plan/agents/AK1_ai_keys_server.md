AK1: AI setlists through the server with keys saved in Settings

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "AK1: AI setlists through the server with keys saved in Settings" on a branch starting with "ak1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:AK1 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
AI keys entered in Settings are stored on the server under the names the AI proxy reads, and the AI setlists page calls the provider through the proxy with the preferred provider, so no AI key is held in or sent from the browser.

## Context (verified on main 2026-10-28)
frontend/src/services/apiKeyService.ts saveAIKey (:190-216) keeps the raw key in localStorage (AIKeyConfig.claudeApiKey etc.) and best-effort saves it under service 'ai-providers', key '<provider>_api_key' (:212; also clearAIKey :242, validateAIKey :280). services/rest_api/routers/api_keys.py:68-75 allow-lists services without 'ai-providers', so every save fails and is swallowed by the catch. services/rest_api/routers/ai_proxy.py:42-53 reads ('anthropic','api_key'), ('openai','api_key'), ('google','api_key') through utils/api_key_helper.get_api_key (env fallback ANTHROPIC_API_KEY etc.); it ignores body.web_search. The page (frontend/src/features/aiSetlists/AISetlistsPage.tsx:113) calls api/directRun.ts runDirectQuery, which fetches api.anthropic.com/openai/googleapis from the browser with getLocalKey() (services/aiService.ts:80). aiService.ts executeClaude/executeOpenAI/executeGemini (:200-300) do the same for transition notes. frontend/src/services/aiProxyClient.ts aiProxyComplete already wraps POST /api/v1/ai/complete but nothing uses it. getPreferredAIProvider (apiKeyService.ts:322) is never read; the page defaults to 'claude' (:40). The import loop (:146-156) never checks res.ok, so a 4xx/5xx counts as created and goes into the ledger; the payload drops sl.date (TracklistImportRequest in services/rest_api/main.py:96 has no date field). 'beatport' is in the allow-list (:70) and the test dispatcher (:377); SongNodes never uses Beatport. SettingsPage.tsx and APIKeyManager.tsx call saveAIKey and show getMaskedKey(aiConfig.claudeApiKey); they are read-only for you, so keep their contract.

## Owned paths
- services/rest_api/routers/api_keys.py (allow-list, requirements query, test dispatcher only)
- services/rest_api/routers/ai_proxy.py
- frontend/src/services/apiKeyService.ts (the AI key functions, :160-337)
- frontend/src/services/aiService.ts (key reads and the three execute* functions only)
- frontend/src/features/aiSetlists/** (page, api/, tests/)
- tests/ai_proxy/test_ai_proxy.py
- tests/rest_api/test_api_keys_ai_services.py (new)
- frontend/src/services/apiKeyService.test.ts (new)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/AK1/ if you need to record a decision.)

## Do
1. api_keys.py: allow 'anthropic', 'openai', 'google'; remove 'beatport' from the allow-list and the dispatcher, and exclude it in GET /requirements (`WHERE service_name <> 'beatport'`; no migration). Test dispatcher for the three AI services: one GET to the provider's model list with the key in a header (x-api-key + anthropic-version, Authorization Bearer, x-goog-api-key), 10 s timeout, never the key in a URL or log.
2. apiKeyService.ts: map claude->anthropic, openai->openai, gemini->google, key 'api_key', for save, clear and test. saveAIKey throws when the server save fails (no silent local fallback) and stores only the server's masked_value in AIKeyConfig.<provider>ApiKey, so Settings still shows a mask. Remove any raw key already in localStorage (AIKeyConfig and songnodes_key_/ai_key_/apiKey_<provider>) on first read.
3. ai_proxy.py: when provider is gemini and web_search is true, add `tools: [{google_search: {}}]`; other providers ignore it. Read the key per request as now.
4. AI setlists: replace runDirectQuery with aiProxyComplete (delete directRun.ts or make it a thin wrapper), start with getPreferredAIProvider() when it is configured, keep the Gemini-only web search toggle (:291) and pass it as web_search. Map AIProxyError codes to plain en-AU messages (no key configured: point to Settings).
5. Import loop: count a setlist as created or replayed only when res.ok; otherwise failed and kept for retry, and not added to the ledger.
6. aiService.ts: if the budget allows, route execute* through aiProxyComplete and drop getLocalKey/setLocalKey and 'anthropic-dangerous-direct-browser-access'; otherwise leave it and list it as a follow-up.
7. Tests: allow-list accepts the three AI services and rejects beatport; gemini web_search adds the tool; apiKeyService saves under anthropic/openai/google and never writes a raw key to localStorage; the page path calls /api/v1/ai/complete and no provider host; a failed import is counted failed.
Not in scope (follow-up): sending the set date needs TracklistImportRequest (main.py) and catalog_writes.import_tracklist to accept it.

## Done when (the reviewer's under-10-minute check; put it in the PR)
Save a Claude key in Settings, reload: the mask shows and `SELECT service_name FROM api_keys` lists 'anthropic'; localStorage has no raw key. Run AI setlists: the browser network panel shows only /api/v1/ai/complete, never api.anthropic.com.

## Checks
`python -m pytest tests/ai_proxy tests/rest_api/test_api_keys_ai_services.py tests/security/test_api_keys_security.py -q`, `cd frontend && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build`, `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
