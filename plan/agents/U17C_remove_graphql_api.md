U17C: Remove the unused graphql-api service

Base: main at 62795a7. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md and CLAUDE.md. Open one PR against main titled "U17C: Remove the unused graphql-api service" on a branch starting with "u17c-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:U17C BEGIN/END, added at the end of the file if missing). Depends on: nothing. Before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only paths under services/graphql-api/.

## Job
Delete services/graphql-api and the references that build, start, health-check or update it.

## Context (verified on main 62795a7, 1 Nov 2026)
Owner decision (Markus, 2 Nov 2026): remove services/graphql-api. It is not in compose.dev.yaml and only returns example rows. It supersedes U17B (websocket mount), which is no longer needed. No CI workflow, Helm or k8s file under deploy/ or k8s/ names it.

## Owned paths
- services/graphql-api/** (deleted in full)
- start-docker.sh (the graphql-api name in the legacy start line only)
- deploy/build-and-push-images.sh (the graphql-api build line only)
- .github/dependabot.yml (the /services/graphql-api pip entry only)
- services/api-gateway/routes/health.js (the graphql-api downstream check only)
- services/api-gateway/.env.example (the GRAPHQL_API_URL line only)
- plan/agents/U17C_remove_graphql_api.md (this brief)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/U17C/ if you need to record a decision.)

## Do
1. `git rm -r services/graphql-api`.
2. Remove the graphql-api line or entry from each owned file above; change nothing else in them.
3. Report other "graphql" hits (design-system docs, plan history, test load scripts, env examples) without editing them.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`git grep -n "graphql-api"` lists only plan history, STATUS.md, docs/integration/U17*, the design-system pages and services/metadata-enrichment/INTEGRATION.md (reported as follow-ups); `python -m pytest --collect-only -q` (root) does not mention graphql.

## Checks
Root `python -m pytest --collect-only -q`; YAML parse of .github/dependabot.yml; `bash -n` on the two shell scripts; `node --check` on health.js; scope guard.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
