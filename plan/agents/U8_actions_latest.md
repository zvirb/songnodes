U8: Pin every GitHub Action to its latest release

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "U8: Pin every GitHub Action to its latest release" on a branch starting with "u8-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:U8 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it.

## Job
Update every `uses:` in .github/workflows to the action's latest release, pinned by full commit SHA with the version in a comment.

## Context (verified on main 2026-10-26)
Sent in wave 4, after G1, QA3 and QA4 changed workflows; include their files. Some workflows use tags (actions/checkout@v7), others SHAs. Pinning by SHA is the safer convention already used in security-secrets-deps.yml.

## Owned paths
- .github/workflows/*.yml (only `uses:` lines and their version comments)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/U8/ if you need to record a decision.)

## Do
1. For each action, find its latest release and the commit SHA of that tag (GitHub API).
2. Replace each `uses:` with `owner/action@<sha> # vX.Y.Z`. Remove the commented placeholder `actions/setup-example@v1` in codeql.yml only if it is a comment.
3. Change nothing else in the workflows (versions of Node and Python are already set).

## Done when (the reviewer's under-10-minute check; put it in the PR)
Every `uses:` line ends in a 40-character SHA and a version comment; CI runs on the PR.

## Checks
`python -c "import yaml,glob; [yaml.safe_load(open(f)) for f in glob.glob('.github/workflows/*.yml')]"`; the PR's own CI run.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
