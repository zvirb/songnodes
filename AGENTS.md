# Contributor instructions

## Task tracking

At the beginning of every task, update the repository-root `STATUS.md` with the
task being started, its scope, and the next concrete step. This is a user
requirement so work can be resumed across sessions.

Before stopping or completing a task, record what changed, the checks actually
run and their outcomes, unresolved issues, and the exact next task. Preserve
relevant previous results rather than replacing them with an unsupported
readiness claim.

## Design system (single source of truth)

All formatting and design decisions come from the SongNodes design system in
[design-system/](design-system/README.md). Before any UI or copy change, read its
README and the sections and component cards you are touching. Use tokens and `sn-*`
classes only, with no hex, px font sizes or emoji. Format through `SN.format`
(`frontend/src/lib/songnodes.tsx`). Never edit `frontend/src/styles/design-system/`
(it is synced by `scripts/sync-design-system.sh`). Where code and the system
disagree, the system wins. A gap in the system is proposed as a change to the
system, not patched locally. The design-system gates for each lifecycle phase are
in [docs/sdlc/SDLC.md](docs/sdlc/SDLC.md). Quick references:
[docs/design-system/](docs/design-system/README.md), including the rendered
`reference.html` and the code-only `CODE_REFERENCE.md`.

## Development

Use [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) as the maintained
architecture plan. Wave routing belongs to milestone 6; keep its UI feature flag
off until the replacement route finder is validated.

Before editing enrichment/provider clients or graph metadata, consult the plan's
WP1–WP5 metadata program and docs/requirements/TRACK_METADATA_RETRIEVAL.md. Preserve
unknown metadata; do not substitute invented BPM/key/energy values. Record live
provider validation and actual coverage separately from synthetic test results.

Use [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the tested minimal stack.
The historical README contains full-platform commands that do not match the
current checkout. Keep synthetic smoke-test data distinct from production data.

Cloud development does not require saving project files to the user's laptop.
If local laptop files are needed, the user prefers `D:\` to conserve `C:\` space.
