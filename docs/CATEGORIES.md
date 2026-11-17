# Document categories (one scheme for SongNodes and Music Library Development)

This file is the single definition. Both projects use these nine categories, the same letters and names, in indexes, queue rows and the Claude Project doc list. Do not add a project-specific category: change this file, then both indexes.

| Code | Category | What belongs | Examples (path prefix) |
|---|---|---|---|
| P | Plan | Phase plans, schedules, restructure and work-package plans | `musicLibrary/plan/`, `songnodes/plan/RESTRUCTURE.md`, `songnodes-import-schedule.md`, `*/UX_RECOMMENDATIONS_PLAN.md` |
| B | Brief and prompt | Agent briefs, run prompts, review prompts, instructions | `musicLibrary/plan/agents/`, `plan/agent-queue/RUN-GUIDE.md` (run guide), `*/INSTRUCTIONS*.md`, `*_prompts.py` outputs |
| S | Build source | Scripts and generators that rebuild a deliverable, so a refresh is a file swap | `*/build/`, `songnodes-setup/build.py`, `songnodes-design-system/tools/`, `plan/agent-queue/tools/`, `songnodes-queue/imports/` |
| R | Research and analysis | Investigations, audits, reports, data-flow studies | `data-flow-analysis/`, `docs/research/`, `docs/design-system/audits/`, `musicLibrary/docs/mb/` |
| D | Design system | Tokens, bundle, components, graph helpers, spec sources | `songnodes-design-system/`, `songnodes/design-system/`, `docs/design-system/` |
| Q | Queue records | Governance, decisions, catalog, reports and import records of the agent queue | `plan/agent-queue/` (GOVERNANCE, DECISIONS, QUEUE, reports/, imports/) |
| X | Reference | Stable how-it-works documents, specs, setup and deployment guides | `docs/*.md`, `docs/specs/`, `docs/requirements/`, `songnodes-setup/src/`, `musicLibrary/docs/` |
| L | Decision and version log | Dated decisions and the version index | `musicLibrary/decisions/`, `docs/decisions/`, `musicLibrary/index/musicLibrary_versions.csv` |
| H | Human housekeeping | Things only Markus answers or does: design questions put as rendered options pages, account steps, sign-offs. Not docs. Tracked as `human` lane tasks (rule Q018); the page is linked from the task and not indexed as a document | `songnodes-design-system/proposals/` options pages (for example `graph-strength-options.html`), the human tasks in the queue |

Rules:
- A file takes the first category above that fits it by path prefix; a file that fits none is a gap to report, not a new category.
- Options pages (H) leave the document list once Markus has answered; the answer is then recorded as a dated entry in category L.
- Retired pages stay listed with the word retired. The 30 Oct "SongNodes Work Queue" page and `plan/work-queue-2026-10-30/` are retired (category Q, superseded by `plan/agent-queue/` and the Queue Monitor).
- The design system is shared: category D lives once in `songnodes/design-system/` (mirrored from the published design system); the Music Library project consumes it and never forks it.

## Where each project's documents live

- SongNodes: repo `E:\songnodes`. Plans in `plan/`, queue in `plan/agent-queue/`, reference in `docs/`, design system in `design-system/`, and in the Claude Project "Music Library Development" under `songnodes-queue/`, `songnodes-setup/`, `songnodes-design-system/`, `data-flow-analysis/`.
- Music Library: folder `E:\musicLibrary`. Plans in `plan/`, agent briefs in `plan/agents/`, decisions in `decisions/`, version index in `index/musicLibrary_versions.csv`, reference in `docs/`, and in the Claude Project under `musicLibrary/`.
- The Claude Project "Music Library Development" holds copies of both projects' documents; its index (this scheme applied) is the project index doc.
