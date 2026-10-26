UX3: Lexicon autocomplete: prefix trie and token completion

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "UX3: Lexicon autocomplete: prefix trie and token completion" on a branch starting with "ux3-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:UX3 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Add a lightweight, pure TypeScript prefix trie / token completion engine for fast in-memory search.

## Context (verified on main 2026-10-26)
Typing into filter boxes or search inputs should complete words (artists, genres, Camelot keys 1A-12B, labels, pillars) instantly without network latency or external dependencies.

## Owned paths
- frontend/src/utils/lexiconTrie.ts
- frontend/src/utils/lexiconTrie.test.ts

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/UX3/ if you need to record a decision.)

## Do
1. Implement LexiconTrie class with insert(word: string, category?: string, weight?: number), insertBatch(words: string[]), searchPrefix(prefix: string, limit = 8): { word: string; category?: string }[], clear().
2. Normalize case, strip punctuation, rank exact prefix matches first, then weighted frequency (e.g. play count / rotation).
3. Include built-in Camelot key vocabulary (1A-12B) and standard Melbourne music pillars.
4. Unit tests: empty prefix, case-insensitive match, limit capping, rank order, special characters, batch insertion performance (<5ms for 5,000 words).

## Done when (the reviewer's under-10-minute check; put it in the PR)
`npx vitest run src/utils/lexiconTrie.test.ts` passes.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
