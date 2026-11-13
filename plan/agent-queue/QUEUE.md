# SongNodes agent queue

Precedence: explicit user authorization/platform restrictions; AGENTS.md hard
boundaries; numbered queue rules; RUN-GUIDE.md; individual tasks and worker defaults.
QUEUE.md contains the portable catalog and readable task table. Current branch
execution state is authoritative only in ignored .runtime/ (Q011). Never edit these
records by hand. All tools take the same OS metadata mutex for metadata updates.

| Rule | Requirement and reason | Date and source |
| --- | --- | --- |
| Q001 | One task, owned paths, small batches; prevents lost merged work. | 2026-11-13, AGENTS.md 1–7 |
| Q002 | Read current AGENTS.md, standards, this governance, run guide, dependencies and recent status before claiming. Durable files outrank old chat instructions. | 2026-11-13, attached queue prompt §3 |
| Q003 | Claims are cooperative writer locks. No edits before full acquisition; OS mutex serializes claims and metadata. Special `_folder` conflicts with everything; folder locks conflict with descendants; files conflict at the same resolved path; `_shared` and `_apply` conflict with themselves and `_folder`. | 2026-11-13, attached prompt §4 |
| Q004 | Workers stage proposals only. No source promotion, deployment, pushes, merges, container/DB changes or destructive commands. This first package does not implement apply or Done transitions. | 2026-11-13, attached prompt smallest-working-queue instruction; AGENTS.md small-batch limit |
| Q005 | Stale age alone never proves abandonment. Operator must identify an abandoned run before recovery. Old tokens cannot heartbeat, release or stage afterward. | 2026-11-13, attached prompt §4 |
| Q006 | Preserve IDs, event history, unrelated tasks and references. Never silently reopen terminal tasks; add a linked follow-up. Derived views replay from QUEUE.md after a crash. | 2026-11-13, attached prompt §2, §6 |
| Q007 | The design system at design-system/ is authoritative; synced styles and reference folders are read-only. Unknown metadata stays unknown. | 2026-11-13, AGENTS.md |
| Q008 | Record actual tests, failures and exact remainder. No Done from worker assertions. Proposal staging is Waiting, never applied or deployed. | 2026-11-13, attached prompt §8–9 |
| Q009 | No schedules or automatic workers are enabled. Adding tasks does not authorize executing them. | 2026-11-13, user requested queue construction and backlog import |
| Q010 | Supersedes Q004's implementation limit: verification, guarded apply, rollback, completion recovery, planner transitions and deferred records are implemented. Source application remains disabled by the project configuration until explicitly authorized. This operator's requested Git commit/sync is authorized separately. | 2026-11-13, user: finish implementing the lock system first; then commit and sync |
| Q011 | QUEUE.md is the versioned task catalog and portable terminal evidence. Authoritative current ownership/task execution state is local `.runtime/<branch>/state.json`. Logs, leases, staged output and recovery journals are ignored by Git and never imported from another branch. Catalog states are portable baselines, not a live monitor. | 2026-11-13, user: locks must not enter commits or block new branches from main |
| Q012 | Verification runs configured commands in an isolated input snapshot with proposed outputs. Apply requires passed checks, unchanged baselines/shared sources, an independent integrator's criteria review and an enabled mode. Rollback retains prior terminal history and uses a linked follow-up claim. | 2026-11-13, attached prompt acceptance criteria |

Rule numbers are permanent. Supersede with a new rule and a DECISIONS.md entry;
never delete historical rationale. Project timezone is Australia/Sydney; timestamps
are stored as UTC offsets with this timezone named explicitly in events.

| ID | State | Priority | Task |
| --- | --- | --- | --- |
| WQ00001 | Ready | 1 | Reproduce and resolve connection on /: Missing connection status |
| WQ00002 | Ready | 1 | Reproduce and resolve tools on /: Missing More actions menu |
| WQ00003 | Ready | 1 | Reproduce and resolve header-scroll on /: Header moved to -500 after scrolling |
| WQ00004 | Ready | 1 | Reproduce and resolve header-scroll on /: Header moved to -115 after scrolling |
| WQ00005 | Ready | 1 | Reproduce and resolve header-scroll on /: Header moved to -66 after scrolling |
| WQ00006 | Ready | 1 | Reproduce and resolve header-scroll on /: Header moved to -244 after scrolling |
| WQ00007 | Ready | 2 | Reproduce and resolve heading on /callback/spotify: Expected one visible page h1 |
| WQ00008 | Ready | 2 | Reproduce and resolve heading on /graph: Expected one visible page h1 |
| WQ00009 | Ready | 1 | Reproduce and resolve header on /graph: Expected one visible AppHeader |
| WQ00010 | Ready | 1 | Reproduce and resolve skip-link on /graph: Missing skip link to main |
| WQ00011 | Ready | 2 | Reproduce and resolve heading on /harmony: Expected one visible page h1 |
| WQ00012 | Ready | 1 | Reproduce and resolve header on /harmony: Expected one visible AppHeader |
| WQ00013 | Ready | 1 | Reproduce and resolve skip-link on /harmony: Missing skip link to main |
| WQ00014 | Ready | 1 | Reproduce and resolve header-scroll on /harmony: Header moved to -500 after scrolling |
| WQ00015 | Ready | 2 | Reproduce and resolve heading on /library: Expected one visible page h1 |
| WQ00016 | Ready | 1 | Reproduce and resolve header on /library: Expected one visible AppHeader |
| WQ00017 | Ready | 1 | Reproduce and resolve skip-link on /library: Missing skip link to main |
| WQ00018 | Ready | 1 | Reproduce and resolve header-scroll on /library: Header moved to -500 after scrolling |
| WQ00019 | Ready | 2 | Reproduce and resolve axe:target-size on /library: serious: All touch targets must be 24px large, or leave sufficient space |
| WQ00020 | Ready | 2 | Reproduce and resolve axe:target-size on /library: serious: All touch targets must be 24px large, or leave sufficient space |
| WQ00021 | Ready | 2 | Reproduce and resolve heading on /library/buy: Expected one visible page h1 |
| WQ00022 | Ready | 1 | Reproduce and resolve header on /library/buy: Expected one visible AppHeader |
| WQ00023 | Ready | 1 | Reproduce and resolve skip-link on /library/buy: Missing skip link to main |
| WQ00024 | Ready | 1 | Reproduce and resolve header-scroll on /library/buy: Header moved to -223 after scrolling |
| WQ00025 | Ready | 1 | Reproduce and resolve header-scroll on /library/buy: Header moved to -336 after scrolling |
| WQ00026 | Ready | 1 | Reproduce and resolve header-scroll on /library/buy: Header moved to -87 after scrolling |
| WQ00027 | Ready | 1 | Reproduce and resolve header-scroll on /library/buy: Header moved to -116 after scrolling |
| WQ00028 | Ready | 1 | Reproduce and resolve header-scroll on /library/buy: Header moved to -316 after scrolling |
| WQ00029 | Ready | 1 | Reproduce and resolve header-scroll on /library/buy: Header moved to -416 after scrolling |
| WQ00030 | Ready | 1 | Reproduce and resolve header-scroll on /library/buy: Header moved to -109 after scrolling |
| WQ00031 | Ready | 1 | Reproduce and resolve header-scroll on /library/buy: Header moved to -140 after scrolling |
| WQ00032 | Ready | 2 | Reproduce and resolve heading on /library/review: Expected one visible page h1 |
| WQ00033 | Ready | 1 | Reproduce and resolve header on /library/review: Expected one visible AppHeader |
| WQ00034 | Ready | 1 | Reproduce and resolve skip-link on /library/review: Missing skip link to main |
| WQ00035 | Ready | 1 | Reproduce and resolve header-scroll on /library/review: Header moved to -129 after scrolling |
| WQ00036 | Ready | 1 | Reproduce and resolve header-scroll on /library/review: Header moved to -83 after scrolling |
| WQ00037 | Ready | 1 | Reproduce and resolve header-scroll on /library/review: Header moved to -228 after scrolling |
| WQ00038 | Ready | 2 | Reproduce and resolve heading on /login: Expected one visible page h1 |
| WQ00039 | Ready | 1 | Reproduce and resolve header on /login: Expected one visible AppHeader |
| WQ00040 | Ready | 1 | Reproduce and resolve skip-link on /login: Missing skip link to main |
| WQ00041 | Ready | 2 | Reproduce and resolve console on /login: Failed to load resource: the server responded with a status of 401 (Unauthorized) |
| WQ00042 | Ready | 1 | Reproduce and resolve header-scroll on /login: Header moved to -157 after scrolling |
| WQ00043 | Ready | 1 | Reproduce and resolve header-scroll on /login: Header moved to -228 after scrolling |
| WQ00044 | Ready | 1 | Reproduce and resolve header-scroll on /login: Header moved to -131 after scrolling |
| WQ00045 | Ready | 1 | Reproduce and resolve header-scroll on /login: Header moved to -136 after scrolling |
| WQ00046 | Ready | 1 | Reproduce and resolve header-scroll on /login: Header moved to -223 after scrolling |
| WQ00047 | Ready | 1 | Reproduce and resolve header-scroll on /login: Header moved to -242 after scrolling |
| WQ00048 | Ready | 1 | Reproduce and resolve header-scroll on /login: Header moved to -135 after scrolling |
| WQ00049 | Ready | 1 | Reproduce and resolve header-scroll on /login: Header moved to -139 after scrolling |
| WQ00050 | Ready | 2 | Reproduce and resolve heading on /oauth/callback: Expected one visible page h1 |
| WQ00051 | Ready | 2 | Reproduce and resolve axe:aria-prohibited-attr on /oauth/callback: serious: Elements must only use permitted ARIA attributes |
| WQ00052 | Ready | 1 | Reproduce and resolve connection on /paths: Missing connection status |
| WQ00053 | Ready | 1 | Reproduce and resolve tools on /paths: Missing More actions menu |
| WQ00054 | Ready | 2 | Reproduce and resolve heading on /pipeline: Expected one visible page h1 |
| WQ00055 | Ready | 1 | Reproduce and resolve header on /pipeline: Expected one visible AppHeader |
| WQ00056 | Ready | 1 | Reproduce and resolve skip-link on /pipeline: Missing skip link to main |
| WQ00057 | Ready | 1 | Reproduce and resolve header-scroll on /pipeline: Header moved to -500 after scrolling |
| WQ00058 | Ready | 2 | Reproduce and resolve heading on /pipeline/runs: Expected one visible page h1 |
| WQ00059 | Ready | 1 | Reproduce and resolve header on /pipeline/runs: Expected one visible AppHeader |
| WQ00060 | Ready | 1 | Reproduce and resolve skip-link on /pipeline/runs: Missing skip link to main |
| WQ00061 | Ready | 1 | Reproduce and resolve header-scroll on /pipeline/runs: Header moved to -149 after scrolling |
| WQ00062 | Ready | 1 | Reproduce and resolve header-scroll on /pipeline/runs: Header moved to -286 after scrolling |
| WQ00063 | Ready | 1 | Reproduce and resolve header-scroll on /pipeline/runs: Header moved to -21 after scrolling |
| WQ00064 | Ready | 1 | Reproduce and resolve header-scroll on /pipeline/runs: Header moved to -45 after scrolling |
| WQ00065 | Ready | 1 | Reproduce and resolve header-scroll on /pipeline/runs: Header moved to -233 after scrolling |
| WQ00066 | Ready | 1 | Reproduce and resolve header-scroll on /pipeline/runs: Header moved to -391 after scrolling |
| WQ00067 | Ready | 1 | Reproduce and resolve header-scroll on /pipeline/runs: Header moved to -39 after scrolling |
| WQ00068 | Ready | 1 | Reproduce and resolve header-scroll on /pipeline/runs: Header moved to -62 after scrolling |
| WQ00069 | Ready | 2 | Reproduce and resolve heading on /sets: Expected one visible page h1 |
| WQ00070 | Ready | 1 | Reproduce and resolve header on /sets: Expected one visible AppHeader |
| WQ00071 | Ready | 1 | Reproduce and resolve skip-link on /sets: Missing skip link to main |
| WQ00072 | Ready | 1 | Reproduce and resolve header-scroll on /sets: Header moved to -500 after scrolling |
| WQ00073 | Ready | 2 | Reproduce and resolve heading on /settings: Expected one visible page h1 |
| WQ00074 | Ready | 1 | Reproduce and resolve header on /settings: Expected one visible AppHeader |
| WQ00075 | Ready | 1 | Reproduce and resolve skip-link on /settings: Missing skip link to main |
| WQ00076 | Ready | 1 | Reproduce and resolve header-scroll on /settings: Header moved to -500 after scrolling |
| WQ00077 | Ready | 1 | Reproduce and resolve connection on /sources: Missing connection status |
| WQ00078 | Ready | 1 | Reproduce and resolve tools on /sources: Missing More actions menu |
| WQ00079 | Ready | 1 | Reproduce and resolve header-scroll on /sources: Header moved to -173 after scrolling |
| WQ00080 | Ready | 1 | Reproduce and resolve header-scroll on /sources: Header moved to -106 after scrolling |
| WQ00081 | Ready | 1 | Reproduce and resolve header-scroll on /sources: Header moved to -90 after scrolling |
| WQ00082 | Ready | 1 | Reproduce and resolve header-scroll on /sources: Header moved to -371 after scrolling |
| WQ00083 | Ready | 1 | Reproduce and resolve header-scroll on /sources: Header moved to -500 after scrolling |
| WQ00084 | Ready | 1 | Reproduce and resolve header-scroll on /sources: Header moved to -152 after scrolling |
| WQ00085 | Ready | 2 | Reproduce and resolve heading on /sources/import: Expected one visible page h1 |
| WQ00086 | Ready | 1 | Reproduce and resolve header on /sources/import: Expected one visible AppHeader |
| WQ00087 | Ready | 1 | Reproduce and resolve skip-link on /sources/import: Missing skip link to main |
| WQ00088 | Ready | 1 | Reproduce and resolve header-scroll on /sources/import: Header moved to -500 after scrolling |
| WQ00089 | Ready | 1 | Reproduce and resolve header-scroll on /sources/import: Header moved to -358 after scrolling |
| WQ00090 | Ready | 1 | Reproduce and resolve header-scroll on /sources/import: Header moved to -444 after scrolling |
| WQ00091 | Ready | 1 | Reproduce and resolve header-scroll on /sources/import: Header moved to -423 after scrolling |
| WQ00092 | Ready | 1 | Reproduce and resolve connection on /sources/targets: Missing connection status |
| WQ00093 | Ready | 1 | Reproduce and resolve tools on /sources/targets: Missing More actions menu |
| WQ00094 | Ready | 1 | Reproduce and resolve header-scroll on /sources/targets: Header moved to -173 after scrolling |
| WQ00095 | Ready | 1 | Reproduce and resolve header-scroll on /sources/targets: Header moved to -402 after scrolling |
| WQ00096 | Ready | 1 | Reproduce and resolve header-scroll on /sources/targets: Header moved to -90 after scrolling |
| WQ00097 | Ready | 1 | Reproduce and resolve header-scroll on /sources/targets: Header moved to -83 after scrolling |
| WQ00098 | Ready | 1 | Reproduce and resolve header-scroll on /sources/targets: Header moved to -500 after scrolling |
| WQ00099 | Ready | 1 | Reproduce and resolve header-scroll on /sources/targets: Header moved to -152 after scrolling |
| WQ00100 | Ready | 2 | No concrete example for * |
| WQ00101 | Ready | 2 | No concrete example for /callback/:service |
| WQ00102 | Ready | 2 | No concrete example for /settings/:settingId |
| WQ00103 | Ready | 2 | No concrete example for /track/:id |
| WQ00104 | Ready | 2 | No concrete example for /tracks/:id |

<!-- AUTHORITATIVE STATE -->
```json
{
  "next_id": 105,
  "tasks": [
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve connection on /: Missing connection status",
      "origin": "design-audit:93d0be6c7072f057fce929723e73d7216c3aaf4a679668ade42e73fe35016b2f",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/",
        "finding": {
          "rule": "connection",
          "message": "Missing connection status"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00001",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.040600+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.040615+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve tools on /: Missing More actions menu",
      "origin": "design-audit:4704665e6bb2406acb9de709309ff2ba03afb77e6c82a44c7f5279a5355f7273",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/",
        "finding": {
          "rule": "tools",
          "message": "Missing More actions menu"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00002",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.044361+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.044369+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /: Header moved to -500 after scrolling",
      "origin": "design-audit:3f6b51591dec70542fdae5fc316459564dd7a807faf639b674dc68c5cf7d4f53",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -500 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00003",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.048111+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.048119+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /: Header moved to -115 after scrolling",
      "origin": "design-audit:60999cd963b398ae4562f7d353d327359808f1a414c2f1bbfd6a1a3afc8c616e",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -115 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00004",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.052019+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.052028+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /: Header moved to -66 after scrolling",
      "origin": "design-audit:f4277f1aff151f7887f1a278c8e94fe36a0b9bc37c9da399ef24d0a05fb97721",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -66 after scrolling"
        },
        "occurrences": [
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          }
        ]
      },
      "id": "WQ00005",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.056821+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.056833+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /: Header moved to -244 after scrolling",
      "origin": "design-audit:e84d86120a09b50b49e7e77784eb05bebe0c2d0b55a4e17a635a3c1f8ca051be",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -244 after scrolling"
        },
        "occurrences": [
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00006",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.061257+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.061267+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 2,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve heading on /callback/spotify: Expected one visible page h1",
      "origin": "design-audit:453c0a74b75fd846b952d021bf169c120be0496fd537cc4653dfedfab8f44810",
      "resources": [
        "file:frontend/src/components/OAuthCallback.tsx"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/callback/spotify",
        "finding": {
          "rule": "heading",
          "message": "Expected one visible page h1"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00007",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.064068+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.064078+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 2,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve heading on /graph: Expected one visible page h1",
      "origin": "design-audit:5005661c8a68beee04cc1797ea1d7b55cfd080f9f84afb3b2b4080cca210a377",
      "resources": [
        "file:frontend/src/pages/GraphPage.tsx"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/graph",
        "finding": {
          "rule": "heading",
          "message": "Expected one visible page h1"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00008",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.066149+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.066160+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header on /graph: Expected one visible AppHeader",
      "origin": "design-audit:88deb3fca32bdda2724ad816a041461bf16baca4346b91f77316501473ed0322",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/graph",
        "finding": {
          "rule": "header",
          "message": "Expected one visible AppHeader"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00009",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.070005+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.070012+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve skip-link on /graph: Missing skip link to main",
      "origin": "design-audit:256ebfb78dc5535fe3612cb39af11cc86c413f8838050f84e480a9563431814c",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/graph",
        "finding": {
          "rule": "skip-link",
          "message": "Missing skip link to main"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00010",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.074000+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.074007+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 2,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve heading on /harmony: Expected one visible page h1",
      "origin": "design-audit:1c4ef1699080e7e861d4416c5071fe8e0a24a78ed89fa51532cb7739e570d332",
      "resources": [
        "file:frontend/src/features/camelot/CamelotPage.tsx"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/harmony",
        "finding": {
          "rule": "heading",
          "message": "Expected one visible page h1"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00011",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.075895+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.075902+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header on /harmony: Expected one visible AppHeader",
      "origin": "design-audit:10299fd8580f9f17717b3721413554879508ad5ef1f33185c6abdec7e3e29968",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/harmony",
        "finding": {
          "rule": "header",
          "message": "Expected one visible AppHeader"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00012",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.079963+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.079997+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve skip-link on /harmony: Missing skip link to main",
      "origin": "design-audit:d0c32bf7f257c6e68288243311fdbd28ebbfb160d80c08d284c3386bbcbe1279",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/harmony",
        "finding": {
          "rule": "skip-link",
          "message": "Missing skip link to main"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00013",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.084870+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.084880+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /harmony: Header moved to -500 after scrolling",
      "origin": "design-audit:057893b8a0b12c701bcd65dd2ddb3b32325a9b9dacae374f7ad90090d12dd662",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/harmony",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -500 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00014",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.089762+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.089770+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 2,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve heading on /library: Expected one visible page h1",
      "origin": "design-audit:94e5069618571d12dbb90bfa7b7bb418a03ca75947219df5b65ba8294143bb3f",
      "resources": [
        "file:frontend/src/features/musicLibrary/LibraryPage.tsx"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/library",
        "finding": {
          "rule": "heading",
          "message": "Expected one visible page h1"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00015",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.092049+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.092058+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header on /library: Expected one visible AppHeader",
      "origin": "design-audit:d208476029807e9658cab4f072c418af1608066e8fd764a311528398625d8006",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/library",
        "finding": {
          "rule": "header",
          "message": "Expected one visible AppHeader"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00016",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.096682+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.096692+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve skip-link on /library: Missing skip link to main",
      "origin": "design-audit:4c0190dd46f0e9d09d5342214ba78f2fe217b713019c5d24377d98d8aca27aff",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/library",
        "finding": {
          "rule": "skip-link",
          "message": "Missing skip link to main"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00017",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.100854+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.100864+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /library: Header moved to -500 after scrolling",
      "origin": "design-audit:43580322193b9f79f3a4133c826e3e70c02bb87246859d9334198a49085561dc",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/library",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -500 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00018",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.105037+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.105047+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 2,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve axe:target-size on /library: serious: All touch targets must be 24px large, or leave sufficient space",
      "origin": "design-audit:779e4f1f5aedeaecf0d9b928c55eba90563166d7893d61c8eaee37e5699fa917",
      "resources": [
        "file:frontend/src/features/musicLibrary/LibraryPage.tsx"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/library",
        "finding": {
          "rule": "axe:target-size",
          "message": "serious: All touch targets must be 24px large, or leave sufficient space",
          "targets": [
            [
              "tr[data-row=\"6\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__links > .sn-link--ext[rel=\"noopener noreferrer\"][target=\"_blank\"]:nth-child(1)"
            ],
            [
              "tr[data-row=\"8\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__flag--info.sn-ml-flag-toggle.sn-track-cell__flag"
            ],
            [
              "tr[data-row=\"14\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__links > .sn-link--ext[rel=\"noopener noreferrer\"][target=\"_blank\"]:nth-child(2)"
            ],
            [
              "tr[data-row=\"21\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__flag--info.sn-ml-flag-toggle.sn-track-cell__flag"
            ],
            [
              "tr[data-row=\"23\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__links > .sn-link--ext[rel=\"noopener noreferrer\"][target=\"_blank\"]:nth-child(2)"
            ],
            [
              "tr[data-row=\"26\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__flag--info.sn-ml-flag-toggle.sn-track-cell__flag"
            ],
            [
              "tr[data-row=\"33\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__flag--info.sn-ml-flag-toggle.sn-track-cell__flag"
            ],
            [
              "tr[data-row=\"79\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__flag--info.sn-ml-flag-toggle.sn-track-cell__flag"
            ],
            [
              "tr[data-row=\"82\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__flag--info.sn-ml-flag-toggle.sn-track-cell__flag"
            ],
            [
              "tr[data-row=\"95\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__links > .sn-link--ext[rel=\"noopener noreferrer\"][target=\"_blank\"]:nth-child(2)"
            ],
            [
              "tr[data-row=\"106\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__links > .sn-link--ext[rel=\"noopener noreferrer\"][target=\"_blank\"]:nth-child(2)"
            ],
            [
              "tr[data-row=\"118\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__flag--info.sn-ml-flag-toggle.sn-track-cell__flag"
            ],
            [
              "tr[data-row=\"137\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__flag--info.sn-ml-flag-toggle.sn-track-cell__flag"
            ],
            [
              "tr[data-row=\"142\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__links > .sn-link--ext[rel=\"noopener noreferrer\"][target=\"_blank\"]:nth-child(2)"
            ],
            [
              "tr[data-row=\"145\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__links > .sn-link--ext[rel=\"noopener noreferrer\"][target=\"_blank\"]:nth-child(2)"
            ]
          ]
        },
        "occurrences": [
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          }
        ]
      },
      "id": "WQ00019",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.107983+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.107993+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 2,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve axe:target-size on /library: serious: All touch targets must be 24px large, or leave sufficient space",
      "origin": "design-audit:5cceebb543b1c837858ae5539420b02d4729f5999d7f294d8424361406623136",
      "resources": [
        "file:frontend/src/features/musicLibrary/LibraryPage.tsx"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/library",
        "finding": {
          "rule": "axe:target-size",
          "message": "serious: All touch targets must be 24px large, or leave sufficient space",
          "targets": [
            [
              "tr[data-row=\"9\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__flag--info.sn-ml-flag-toggle.sn-track-cell__flag"
            ],
            [
              "tr[data-row=\"10\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__flag--info.sn-ml-flag-toggle.sn-track-cell__flag"
            ],
            [
              "tr[data-row=\"19\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__flag--info.sn-ml-flag-toggle.sn-track-cell__flag"
            ],
            [
              "tr[data-row=\"24\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__links > .sn-link--ext[rel=\"noopener noreferrer\"][target=\"_blank\"]:nth-child(2)"
            ],
            [
              "tr[data-row=\"28\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__links > .sn-link--ext[rel=\"noopener noreferrer\"][target=\"_blank\"]:nth-child(1)"
            ],
            [
              "tr[data-row=\"34\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__links > .sn-link--ext[rel=\"noopener noreferrer\"][target=\"_blank\"]:nth-child(2)"
            ],
            [
              "tr[data-row=\"36\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__links > .sn-link--ext[rel=\"noopener noreferrer\"][target=\"_blank\"]:nth-child(2)"
            ],
            [
              "tr[data-row=\"37\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__links > .sn-link--ext[rel=\"noopener noreferrer\"][target=\"_blank\"]:nth-child(2)"
            ],
            [
              "tr[data-row=\"38\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__links > .sn-link--ext[rel=\"noopener noreferrer\"][target=\"_blank\"]:nth-child(2)"
            ],
            [
              "tr[data-row=\"67\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__links > .sn-link--ext[rel=\"noopener noreferrer\"][target=\"_blank\"]:nth-child(1)"
            ],
            [
              "tr[data-row=\"75\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__links > .sn-link--ext[rel=\"noopener noreferrer\"][target=\"_blank\"]:nth-child(2)"
            ],
            [
              "tr[data-row=\"89\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__flag--info.sn-ml-flag-toggle.sn-track-cell__flag"
            ],
            [
              "tr[data-row=\"93\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__flag--info.sn-ml-flag-toggle.sn-track-cell__flag"
            ],
            [
              "tr[data-row=\"98\"] > .sn-data-table__track > .sn-track-cell > .sn-track-cell__meta > .sn-track-cell__flag--info.sn-ml-flag-toggle.sn-track-cell__flag"
            ]
          ]
        },
        "occurrences": [
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00020",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.110415+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.110426+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 2,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve heading on /library/buy: Expected one visible page h1",
      "origin": "design-audit:3ce8a213e7f64b1c12c376c26e156f18ffea1bd9bbbe1d98ae25e6d7e2f45e1e",
      "resources": [
        "file:frontend/src/features/musicLibrary/BuyListPage.tsx"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/library/buy",
        "finding": {
          "rule": "heading",
          "message": "Expected one visible page h1"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00021",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.113214+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.113224+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header on /library/buy: Expected one visible AppHeader",
      "origin": "design-audit:d5b4a66c3a2e319d9e1838ef20fd9bd66c82f9bb9ae86dfaae351a470e23f2e5",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/library/buy",
        "finding": {
          "rule": "header",
          "message": "Expected one visible AppHeader"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00022",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.117541+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.117554+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve skip-link on /library/buy: Missing skip link to main",
      "origin": "design-audit:158f75ebe76dd272df71f5cb2746abfa7012ff37279fc66cfd4a83e3bfb49b93",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/library/buy",
        "finding": {
          "rule": "skip-link",
          "message": "Missing skip link to main"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00023",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.123382+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.123392+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /library/buy: Header moved to -223 after scrolling",
      "origin": "design-audit:1e11eff3f3cdc21b954a0bb69e4469c9b0d4021c654e1ebb36ddfd7415ebc2e5",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/library/buy",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -223 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          }
        ]
      },
      "id": "WQ00024",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.128178+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.128190+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /library/buy: Header moved to -336 after scrolling",
      "origin": "design-audit:b9bc070aa570f4db2e191a134ad15b2531a33e046c57781676ed4288a43fd6f2",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/library/buy",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -336 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00025",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.132821+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.132830+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /library/buy: Header moved to -87 after scrolling",
      "origin": "design-audit:7428c3aadd22298f6bbf437f5ce760d88a3fd97831539bb3b456f9c67881bc18",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/library/buy",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -87 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          }
        ]
      },
      "id": "WQ00026",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.137276+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.137286+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /library/buy: Header moved to -116 after scrolling",
      "origin": "design-audit:1d4f568626fd97c9ea45cb287175b92463fc8590b72a13d8a38275ae079d533f",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/library/buy",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -116 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00027",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.141490+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.141499+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /library/buy: Header moved to -316 after scrolling",
      "origin": "design-audit:bdcd406614b1a0ce789f6d3db113c3d65fc31605c02705dabf05148f0b26767a",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/library/buy",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -316 after scrolling"
        },
        "occurrences": [
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          }
        ]
      },
      "id": "WQ00028",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.146424+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.146433+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /library/buy: Header moved to -416 after scrolling",
      "origin": "design-audit:d48f626b3fbf99243d8fa300238bdca912a64109ed7dcb202a3598d273399f72",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/library/buy",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -416 after scrolling"
        },
        "occurrences": [
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00029",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.150446+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.150454+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /library/buy: Header moved to -109 after scrolling",
      "origin": "design-audit:2cd39100262e345b2bda34c7130ab13727bf7e7400425e5d0327936847a1f2fc",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/library/buy",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -109 after scrolling"
        },
        "occurrences": [
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          }
        ]
      },
      "id": "WQ00030",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.154572+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.154583+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /library/buy: Header moved to -140 after scrolling",
      "origin": "design-audit:821e51719668b69b77273a0486bad76b38a4da483d1ab5ecb4a89054b9793ece",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/library/buy",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -140 after scrolling"
        },
        "occurrences": [
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00031",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.159038+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.159048+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 2,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve heading on /library/review: Expected one visible page h1",
      "origin": "design-audit:a4ec5c8d18914bcdf15218e342c231b6ef13ae6e70763d3826f00fc393141458",
      "resources": [
        "file:frontend/src/features/musicLibrary/ReviewQueuePage.tsx"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/library/review",
        "finding": {
          "rule": "heading",
          "message": "Expected one visible page h1"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00032",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.161117+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.161127+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header on /library/review: Expected one visible AppHeader",
      "origin": "design-audit:bc10cb6ce92e2ad6918a112d5e6764b3a0c941590deeae255dbc64bd8d2dca51",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/library/review",
        "finding": {
          "rule": "header",
          "message": "Expected one visible AppHeader"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00033",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.165212+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.165221+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve skip-link on /library/review: Missing skip link to main",
      "origin": "design-audit:fc20918e7a1c3136fc3b4cb7415fb309adf141f19e357b8e91493f23457b28e4",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/library/review",
        "finding": {
          "rule": "skip-link",
          "message": "Missing skip link to main"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00034",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.169402+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.169411+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /library/review: Header moved to -129 after scrolling",
      "origin": "design-audit:5dc8464649c1706171016f6db093cbca96a396caaf58de6e1aee394af21b84fb",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/library/review",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -129 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00035",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.174659+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.174673+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /library/review: Header moved to -83 after scrolling",
      "origin": "design-audit:f081e1350cff66f06b7611690bf7d07b1077eb7e55aaf233bcd6a90bd5ba28bd",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/library/review",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -83 after scrolling"
        },
        "occurrences": [
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          }
        ]
      },
      "id": "WQ00036",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.180977+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.180990+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /library/review: Header moved to -228 after scrolling",
      "origin": "design-audit:7a1bdf05c9ec50046493658c66356c433c85a359ef8b5cbf51fbe806b6628e53",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/library/review",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -228 after scrolling"
        },
        "occurrences": [
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00037",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.186476+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.186489+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 2,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve heading on /login: Expected one visible page h1",
      "origin": "design-audit:57fc26452585a2da3886cecf2288e9644492a6b220de1172866174d3bfa9c9d7",
      "resources": [
        "file:frontend/src/features/auth/LoginPage.tsx"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/login",
        "finding": {
          "rule": "heading",
          "message": "Expected one visible page h1"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00038",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.189751+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.189764+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header on /login: Expected one visible AppHeader",
      "origin": "design-audit:7d2b9ac4ad21a68860483572b8cabf34e07ad7357bce7f26b1a990ed7373a8ff",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/login",
        "finding": {
          "rule": "header",
          "message": "Expected one visible AppHeader"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00039",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.195997+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.196010+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve skip-link on /login: Missing skip link to main",
      "origin": "design-audit:aa038e64ffa3d77411f2e925275712e5e77af82b602c11f6808122d2c2fad4ac",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/login",
        "finding": {
          "rule": "skip-link",
          "message": "Missing skip link to main"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00040",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.200338+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.200347+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 2,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve console on /login: Failed to load resource: the server responded with a status of 401 (Unauthorized)",
      "origin": "design-audit:156129c8d91e9c2527d4c377932b2df7a86c44ac402d1858a12393af0bc8bff7",
      "resources": [
        "file:frontend/src/features/auth/LoginPage.tsx"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/login",
        "finding": {
          "rule": "console",
          "message": "Failed to load resource: the server responded with a status of 401 (Unauthorized)"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00041",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.202298+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.202305+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /login: Header moved to -157 after scrolling",
      "origin": "design-audit:4dde0d63da03604cc1b2d9534ade4fce4425a23e797a90b563e1c59ab831f232",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/login",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -157 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          }
        ]
      },
      "id": "WQ00042",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.207097+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.207107+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /login: Header moved to -228 after scrolling",
      "origin": "design-audit:42724739f2fc5b3c52be71a71e1c050b54e7cf10900046a8fe7cafcc829de7df",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/login",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -228 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00043",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.212563+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.212575+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /login: Header moved to -131 after scrolling",
      "origin": "design-audit:8300a369df043354f1cbd73c46b159ac97431f8ea1fe9317e56588d69bdab3ff",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/login",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -131 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          }
        ]
      },
      "id": "WQ00044",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.218732+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.218741+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /login: Header moved to -136 after scrolling",
      "origin": "design-audit:accf9460222e6e126ccd88c6886d7d9d76bc6a140b62d98b922a79ef97135122",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/login",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -136 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00045",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.223536+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.223544+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /login: Header moved to -223 after scrolling",
      "origin": "design-audit:dfc8d4eea894af986d554e5bb1a8ef241dcf268a4caebb296fe0b806be0e3030",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/login",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -223 after scrolling"
        },
        "occurrences": [
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          }
        ]
      },
      "id": "WQ00046",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.227843+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.227853+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /login: Header moved to -242 after scrolling",
      "origin": "design-audit:ef6c71af4d0d029cc8fd3621ee9fbfb0b26e29e9fdc9de80bd4cfef0283e2fad",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/login",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -242 after scrolling"
        },
        "occurrences": [
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00047",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.232468+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.232477+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /login: Header moved to -135 after scrolling",
      "origin": "design-audit:900bb0a2d5e5ad7107891bf98484dea293082e666ffe71e8a679ef5380ac62ac",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/login",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -135 after scrolling"
        },
        "occurrences": [
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          }
        ]
      },
      "id": "WQ00048",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.236532+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.236541+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /login: Header moved to -139 after scrolling",
      "origin": "design-audit:e5fa7eb7ecdc7c7675d41eb8fbc3f2f1459701aa0d0c3f5871c07b5f38567bcb",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/login",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -139 after scrolling"
        },
        "occurrences": [
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00049",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.240698+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.240707+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 2,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve heading on /oauth/callback: Expected one visible page h1",
      "origin": "design-audit:2828179bd8667b5ba99a5d7073d988d276e7048b3949173b544d2ee7d584a38a",
      "resources": [
        "file:frontend/src/components/OAuthCallback.tsx"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/oauth/callback",
        "finding": {
          "rule": "heading",
          "message": "Expected one visible page h1"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00050",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.242647+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.242655+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 2,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve axe:aria-prohibited-attr on /oauth/callback: serious: Elements must only use permitted ARIA attributes",
      "origin": "design-audit:071a9023aa0bb48ad986451de26cfa10a1c38ea97c65682173ac567c13372a45",
      "resources": [
        "file:frontend/src/components/OAuthCallback.tsx"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/oauth/callback",
        "finding": {
          "rule": "axe:aria-prohibited-attr",
          "message": "serious: Elements must only use permitted ARIA attributes",
          "targets": [
            [
              ".sn-spinner"
            ]
          ]
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00051",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.244726+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.244734+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve connection on /paths: Missing connection status",
      "origin": "design-audit:657dc1a6c85889bacacdca56312cf7b91ea234124ee58a687a4b7b3960a210d3",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/paths",
        "finding": {
          "rule": "connection",
          "message": "Missing connection status"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00052",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.248948+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.248957+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve tools on /paths: Missing More actions menu",
      "origin": "design-audit:c868d28ec5f3281d29764f9c150acb0ffa8f15254cf702edf8c52f75e778da15",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/paths",
        "finding": {
          "rule": "tools",
          "message": "Missing More actions menu"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00053",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.252570+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.252579+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 2,
      "role": "frontend",
      "notes": [
        "Source owner corrected from current feature route declaration before worker execution"
      ],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve heading on /pipeline: Expected one visible page h1",
      "origin": "design-audit:3b2e04bf897c31196acf79a0db8aad38ca61145cb31b5574173424cd2550f7a0",
      "resources": [
        "file:frontend/src/pages/ScraperProgressPage.tsx"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/pipeline",
        "finding": {
          "rule": "heading",
          "message": "Expected one visible page h1"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00054",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.254628+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.254637+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header on /pipeline: Expected one visible AppHeader",
      "origin": "design-audit:f4bdef9b0a70bbb2240c51360735a4a1d207c5d9acf1fa13028fbb7830c57a4d",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/pipeline",
        "finding": {
          "rule": "header",
          "message": "Expected one visible AppHeader"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00055",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.258328+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.258336+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve skip-link on /pipeline: Missing skip link to main",
      "origin": "design-audit:72645675ffe575ebbd952f7c92c48366d2e5dcffc9693532f1c17c157a94b338",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/pipeline",
        "finding": {
          "rule": "skip-link",
          "message": "Missing skip link to main"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00056",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.262216+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.262226+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /pipeline: Header moved to -500 after scrolling",
      "origin": "design-audit:196b094410e019c89a5a78e05e00a82440d5aa24d90f7e24a1abbc908d7cb0d4",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/pipeline",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -500 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00057",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.265903+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.265910+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 2,
      "role": "frontend",
      "notes": [
        "Source owner corrected from current feature route declaration before worker execution"
      ],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve heading on /pipeline/runs: Expected one visible page h1",
      "origin": "design-audit:bc03f98d11445af1b26e3d06154ee982e1fb4ce351d574bc301b17ade360a713",
      "resources": [
        "file:frontend/src/pages/ScraperProgressPage.tsx"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/pipeline/runs",
        "finding": {
          "rule": "heading",
          "message": "Expected one visible page h1"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00058",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.267830+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.267836+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header on /pipeline/runs: Expected one visible AppHeader",
      "origin": "design-audit:a8ecff3399c5ad0dcbf6c4587da894d8f0d2da1290c24693eb434a7fb0f33d41",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/pipeline/runs",
        "finding": {
          "rule": "header",
          "message": "Expected one visible AppHeader"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00059",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.271493+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.271499+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve skip-link on /pipeline/runs: Missing skip link to main",
      "origin": "design-audit:e3da27c0e4e2b2596a0cd0f4d38adbcaf3c724b57f5d3e5dcba0f1bca0526093",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/pipeline/runs",
        "finding": {
          "rule": "skip-link",
          "message": "Missing skip link to main"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00060",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.275306+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.275314+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /pipeline/runs: Header moved to -149 after scrolling",
      "origin": "design-audit:c2157afe25174d5b6be0a3255dc92b4058ad6d088cebc4e3c5fe5729c1f8d27f",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/pipeline/runs",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -149 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          }
        ]
      },
      "id": "WQ00061",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.279066+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.279074+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /pipeline/runs: Header moved to -286 after scrolling",
      "origin": "design-audit:8c5f9fdf2fa9fcc94a8848b2203f82c2eea07cb069bc10ff757397d2988b1233",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/pipeline/runs",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -286 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00062",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.282705+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.282711+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /pipeline/runs: Header moved to -21 after scrolling",
      "origin": "design-audit:09f649fc4be4a22df48870e090360286a8e95efd5810304c6bb7d61d7874391b",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/pipeline/runs",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -21 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          }
        ]
      },
      "id": "WQ00063",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.286361+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.286368+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /pipeline/runs: Header moved to -45 after scrolling",
      "origin": "design-audit:259a115a81235e54b765d1eeada2a09258cc0e40e59820f76e03907774beafa8",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/pipeline/runs",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -45 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00064",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.290127+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.290135+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /pipeline/runs: Header moved to -233 after scrolling",
      "origin": "design-audit:cfabedaaad7d25e003af8c5947691a33d5c42a04d3ed654b7ba583726079db42",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/pipeline/runs",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -233 after scrolling"
        },
        "occurrences": [
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          }
        ]
      },
      "id": "WQ00065",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.294269+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.294276+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /pipeline/runs: Header moved to -391 after scrolling",
      "origin": "design-audit:7dc3ff059e429f8995209bb934c537d4407a93afa62641bb71bd58f179a7b7cc",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/pipeline/runs",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -391 after scrolling"
        },
        "occurrences": [
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00066",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.298114+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.298119+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /pipeline/runs: Header moved to -39 after scrolling",
      "origin": "design-audit:135536c4ee6f8034790afadd8c7014fe2d4a2c819b7d956a79cd1b804e163cf7",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/pipeline/runs",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -39 after scrolling"
        },
        "occurrences": [
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          }
        ]
      },
      "id": "WQ00067",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.302423+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.302432+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /pipeline/runs: Header moved to -62 after scrolling",
      "origin": "design-audit:e1b017c7f5a3b3baf82fac9609dd2fd6da771e8c4dea7ae7a8d3ce7293e3d003",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/pipeline/runs",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -62 after scrolling"
        },
        "occurrences": [
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00068",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.306610+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.306618+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 2,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve heading on /sets: Expected one visible page h1",
      "origin": "design-audit:82b4d68d69c2f04e16fb166c0a1fab36681d8787181c286e3b292f071f3b6230",
      "resources": [
        "file:frontend/src/features/musicLibrary/SetBuilderPage.tsx"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sets",
        "finding": {
          "rule": "heading",
          "message": "Expected one visible page h1"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00069",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.308605+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.308611+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header on /sets: Expected one visible AppHeader",
      "origin": "design-audit:84b8bd80e5fe8a7c296c92e6140ef3d870aef8c1d674bfb6dadd3868db9ea86c",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sets",
        "finding": {
          "rule": "header",
          "message": "Expected one visible AppHeader"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00070",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.312176+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.312183+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve skip-link on /sets: Missing skip link to main",
      "origin": "design-audit:a7424ffe2ce332f8e8af32d92e8d34a6f8e97dd17c60ba7a35f8e847f57a2b94",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sets",
        "finding": {
          "rule": "skip-link",
          "message": "Missing skip link to main"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00071",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.316039+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.316048+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /sets: Header moved to -500 after scrolling",
      "origin": "design-audit:8cb9ea7358838b353345f5ef1c64eaae27d6261eebc73e9db19c636c656a8f5e",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sets",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -500 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00072",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.319834+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.319842+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 2,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve heading on /settings: Expected one visible page h1",
      "origin": "design-audit:eceaade165e5c3987fe06d49c7e1021edc795de878f6de80a799db13f428234b",
      "resources": [
        "file:frontend/src/pages/SettingsPage.tsx"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/settings",
        "finding": {
          "rule": "heading",
          "message": "Expected one visible page h1"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00073",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.322205+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.322216+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header on /settings: Expected one visible AppHeader",
      "origin": "design-audit:e72bad33e5ac03b6756e7537989e29e2544d2eb900660b91c168336b37a876ec",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/settings",
        "finding": {
          "rule": "header",
          "message": "Expected one visible AppHeader"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00074",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.326230+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.326238+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve skip-link on /settings: Missing skip link to main",
      "origin": "design-audit:81c7f39b9309390b4ba7fd58d849d9835358d7aeb1156aee0ab9bcf6158c8310",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/settings",
        "finding": {
          "rule": "skip-link",
          "message": "Missing skip link to main"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00075",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.330198+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.330206+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /settings: Header moved to -500 after scrolling",
      "origin": "design-audit:fad4ba8571fb722695d6c82f7b6dfa677925b0b99eb025844c128f1a3fded145",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/settings",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -500 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00076",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.334027+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.334036+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve connection on /sources: Missing connection status",
      "origin": "design-audit:6b88897e28c85367e2109c77c244ad7d261b9a1e0248c4addb485f1860114edd",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sources",
        "finding": {
          "rule": "connection",
          "message": "Missing connection status"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00077",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.337623+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.337631+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve tools on /sources: Missing More actions menu",
      "origin": "design-audit:5bcbd5a1b316e3a064e79561c952bfb5c4400275e06def349c6a53976c32a5d1",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sources",
        "finding": {
          "rule": "tools",
          "message": "Missing More actions menu"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00078",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.341020+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.341027+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /sources: Header moved to -173 after scrolling",
      "origin": "design-audit:ac853e1d53fe2daf67972fa918992664d66af359a60d5f5135edb08980f94377",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sources",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -173 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          }
        ]
      },
      "id": "WQ00079",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.344524+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.344531+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /sources: Header moved to -106 after scrolling",
      "origin": "design-audit:2d5abfaed70a630196258303856a2402b24f9e1c37b9aa21f9a433178faa12c2",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sources",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -106 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00080",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.347956+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.347961+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /sources: Header moved to -90 after scrolling",
      "origin": "design-audit:eabc7d7d787cb9a51d9814d59ecbe30e18f2887d6010f90bad59e9f2b15817a4",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sources",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -90 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          }
        ]
      },
      "id": "WQ00081",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.351340+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.351346+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /sources: Header moved to -371 after scrolling",
      "origin": "design-audit:09ac76dce38c36d396834e88f9f7049cfd9e7cc2b7f91829c8fed84ad871b344",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sources",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -371 after scrolling"
        },
        "occurrences": [
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          }
        ]
      },
      "id": "WQ00082",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.354885+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.354892+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /sources: Header moved to -500 after scrolling",
      "origin": "design-audit:f55e0f4563703c8bbe934b0c932143778ea77a327516f6867607bda67d26006b",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sources",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -500 after scrolling"
        },
        "occurrences": [
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00083",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.358496+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.358504+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /sources: Header moved to -152 after scrolling",
      "origin": "design-audit:51ba52620812d44ff24ec6231bcf2b40c9e24ff8ab893d7c09375e22bdc4bae4",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sources",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -152 after scrolling"
        },
        "occurrences": [
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          }
        ]
      },
      "id": "WQ00084",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.362018+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.362025+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 2,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve heading on /sources/import: Expected one visible page h1",
      "origin": "design-audit:53da2181d47d2426d34dbbde48b2e514a15ea07155ed7d22f48ef1b88d724607",
      "resources": [
        "file:frontend/src/features/aiSetlists/AISetlistsPage.tsx"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sources/import",
        "finding": {
          "rule": "heading",
          "message": "Expected one visible page h1"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00085",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.363818+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.363825+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header on /sources/import: Expected one visible AppHeader",
      "origin": "design-audit:53decb01f71fc13f3f101370483128b0365cc3c32d2d4cfc8897c7eb034f8048",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sources/import",
        "finding": {
          "rule": "header",
          "message": "Expected one visible AppHeader"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00086",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.367220+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.367226+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve skip-link on /sources/import: Missing skip link to main",
      "origin": "design-audit:9f43db4b3acbcd111afa8cc33e4a82fbdc63dfd0e6d8c4b791da6345362e6845",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sources/import",
        "finding": {
          "rule": "skip-link",
          "message": "Missing skip link to main"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00087",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.370691+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.370698+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /sources/import: Header moved to -500 after scrolling",
      "origin": "design-audit:9243f265d0a9a8c852c792d66e498a17d3b667b369ee63aa858768e4f7916486",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sources/import",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -500 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00088",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.374174+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.374179+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /sources/import: Header moved to -358 after scrolling",
      "origin": "design-audit:e45886683283500f0b759a3e1ad08a4eb5b4346deb1ff012dfb5aa186d57ab52",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sources/import",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -358 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          }
        ]
      },
      "id": "WQ00089",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.377603+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.377609+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /sources/import: Header moved to -444 after scrolling",
      "origin": "design-audit:630bc88f3f1f528c488c8540e86d2ff106755bba0e4832373bc30bfba3ee5d58",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sources/import",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -444 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00090",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.382697+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.382705+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /sources/import: Header moved to -423 after scrolling",
      "origin": "design-audit:6a65d9918140158efeae632ad5d43660167be8b2537f273fcb0becda91707321",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sources/import",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -423 after scrolling"
        },
        "occurrences": [
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          }
        ]
      },
      "id": "WQ00091",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.387473+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.387482+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve connection on /sources/targets: Missing connection status",
      "origin": "design-audit:4aa971f8bdfdae37897621c7ec8cccdde2d2f7333b88ec7ac322deefb66a789e",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sources/targets",
        "finding": {
          "rule": "connection",
          "message": "Missing connection status"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00092",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.391441+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.391450+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve tools on /sources/targets: Missing More actions menu",
      "origin": "design-audit:feaa8bd7c14a2c7c33131bd1bb70aa789d956561ccd30b26931321d91e42857c",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sources/targets",
        "finding": {
          "rule": "tools",
          "message": "Missing More actions menu"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "dark",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          },
          {
            "theme": "booth",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00093",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.395050+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.395057+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /sources/targets: Header moved to -173 after scrolling",
      "origin": "design-audit:771f3a8a4a3b71d91c0700018d2324040d1c85dac9947e7959b3452eee0f1b5a",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sources/targets",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -173 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "m"
          },
          {
            "theme": "light",
            "width": 1440,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00094",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.398588+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.398595+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /sources/targets: Header moved to -402 after scrolling",
      "origin": "design-audit:fdd93e37b78749a88e07a82b0047b634c214259a0d5bf7a7d1bc01593df3fdae",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sources/targets",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -402 after scrolling"
        },
        "occurrences": [
          {
            "theme": "dark",
            "width": 390,
            "size": "xl"
          },
          {
            "theme": "light",
            "width": 390,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00095",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.402008+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.402014+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /sources/targets: Header moved to -90 after scrolling",
      "origin": "design-audit:91005f5ef89ead8235920db2c8b98f86aa05489bb16a7db5e913021ef8a52f9d",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sources/targets",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -90 after scrolling"
        },
        "occurrences": [
          {
            "theme": "light",
            "width": 1440,
            "size": "m"
          }
        ]
      },
      "id": "WQ00096",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.406142+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.406148+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /sources/targets: Header moved to -83 after scrolling",
      "origin": "design-audit:25c00f373245d91109af95466ab4e928b2ffdfa7e6e06a8bf24d63f2215e2919",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sources/targets",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -83 after scrolling"
        },
        "occurrences": [
          {
            "theme": "booth",
            "width": 390,
            "size": "m"
          }
        ]
      },
      "id": "WQ00097",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.409685+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.409691+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /sources/targets: Header moved to -500 after scrolling",
      "origin": "design-audit:f92025a17c8771760947a27e22e896f0d541369466ef2b5b97d23e1af4333d84",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sources/targets",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -500 after scrolling"
        },
        "occurrences": [
          {
            "theme": "booth",
            "width": 390,
            "size": "xl"
          }
        ]
      },
      "id": "WQ00098",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.413250+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.413255+00:00",
      "completed": null
    },
    {
      "type": "deviation",
      "dependencies": [],
      "priority": 1,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "Reproduce and resolve header-scroll on /sources/targets: Header moved to -152 after scrolling",
      "origin": "design-audit:447659717e85a272cfba58be12f63869cd3771daa34ec60cde8ee5ac349bd1ea",
      "resources": [
        "file:frontend/src/shell/AppShell.tsx",
        "file:frontend/src/styles/app.css"
      ],
      "criteria": [
        "Confirm observation against authoritative design-system card before editing; report false positives with evidence",
        "One deviation only; reproduce and verify every recorded display-matrix occurrence",
        "Run source conformance, frontend type-check and targeted browser regression; preserve honest loading/error/empty states",
        "Stage reviewable proposal with test output and git rollback reference; independent integration is required before calling the deviation fixed"
      ],
      "source": "reports/design-system-audit.json",
      "observation": {
        "path": "/sources/targets",
        "finding": {
          "rule": "header-scroll",
          "message": "Header moved to -152 after scrolling"
        },
        "occurrences": [
          {
            "theme": "booth",
            "width": 1440,
            "size": "m"
          }
        ]
      },
      "id": "WQ00099",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.416767+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.416771+00:00",
      "completed": null
    },
    {
      "type": "verification",
      "dependencies": [],
      "priority": 2,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "No concrete example for *",
      "origin": "design-audit-gap:No concrete example for *",
      "resources": [
        "file:frontend/tests/design-system-route-examples.json"
      ],
      "criteria": [
        "Supply a real concrete route without invented records",
        "Rerun the audit for this route and retain evidence; record any new observations separately"
      ],
      "source": "reports/design-system-audit.json",
      "id": "WQ00100",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.418933+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.418938+00:00",
      "completed": null
    },
    {
      "type": "verification",
      "dependencies": [],
      "priority": 2,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "No concrete example for /callback/:service",
      "origin": "design-audit-gap:No concrete example for /callback/:service",
      "resources": [
        "file:frontend/tests/design-system-route-examples.json"
      ],
      "criteria": [
        "Supply a real concrete route without invented records",
        "Rerun the audit for this route and retain evidence; record any new observations separately"
      ],
      "source": "reports/design-system-audit.json",
      "id": "WQ00101",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.421436+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.421445+00:00",
      "completed": null
    },
    {
      "type": "verification",
      "dependencies": [],
      "priority": 2,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "No concrete example for /settings/:settingId",
      "origin": "design-audit-gap:No concrete example for /settings/:settingId",
      "resources": [
        "file:frontend/tests/design-system-route-examples.json"
      ],
      "criteria": [
        "Supply a real concrete route without invented records",
        "Rerun the audit for this route and retain evidence; record any new observations separately"
      ],
      "source": "reports/design-system-audit.json",
      "id": "WQ00102",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.423935+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.423941+00:00",
      "completed": null
    },
    {
      "type": "verification",
      "dependencies": [],
      "priority": 2,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "No concrete example for /track/:id",
      "origin": "design-audit-gap:No concrete example for /track/:id",
      "resources": [
        "file:frontend/tests/design-system-route-examples.json"
      ],
      "criteria": [
        "Supply a real concrete route without invented records",
        "Rerun the audit for this route and retain evidence; record any new observations separately"
      ],
      "source": "reports/design-system-audit.json",
      "id": "WQ00103",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.425947+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.425952+00:00",
      "completed": null
    },
    {
      "type": "verification",
      "dependencies": [],
      "priority": 2,
      "role": "frontend",
      "notes": [],
      "evidence": [],
      "rollback": null,
      "description": "No concrete example for /tracks/:id",
      "origin": "design-audit-gap:No concrete example for /tracks/:id",
      "resources": [
        "file:frontend/tests/design-system-route-examples.json"
      ],
      "criteria": [
        "Supply a real concrete route without invented records",
        "Rerun the audit for this route and retain evidence; record any new observations separately"
      ],
      "source": "reports/design-system-audit.json",
      "id": "WQ00104",
      "state": "Ready",
      "owner": null,
      "claim": null,
      "added": "2026-11-13T08:05:52.427918+00:00",
      "started": null,
      "updated": "2026-11-13T08:05:52.427924+00:00",
      "completed": null
    }
  ],
  "claims": [],
  "events": [
    {
      "timestamp": "2026-11-13T08:05:52.427929+00:00",
      "timezone": "Australia/Sydney",
      "run": "planner",
      "tasks": [
        "WQ00001",
        "WQ00002",
        "WQ00003",
        "WQ00004",
        "WQ00005",
        "WQ00006",
        "WQ00007",
        "WQ00008",
        "WQ00009",
        "WQ00010",
        "WQ00011",
        "WQ00012",
        "WQ00013",
        "WQ00014",
        "WQ00015",
        "WQ00016",
        "WQ00017",
        "WQ00018",
        "WQ00019",
        "WQ00020",
        "WQ00021",
        "WQ00022",
        "WQ00023",
        "WQ00024",
        "WQ00025",
        "WQ00026",
        "WQ00027",
        "WQ00028",
        "WQ00029",
        "WQ00030",
        "WQ00031",
        "WQ00032",
        "WQ00033",
        "WQ00034",
        "WQ00035",
        "WQ00036",
        "WQ00037",
        "WQ00038",
        "WQ00039",
        "WQ00040",
        "WQ00041",
        "WQ00042",
        "WQ00043",
        "WQ00044",
        "WQ00045",
        "WQ00046",
        "WQ00047",
        "WQ00048",
        "WQ00049",
        "WQ00050",
        "WQ00051",
        "WQ00052",
        "WQ00053",
        "WQ00054",
        "WQ00055",
        "WQ00056",
        "WQ00057",
        "WQ00058",
        "WQ00059",
        "WQ00060",
        "WQ00061",
        "WQ00062",
        "WQ00063",
        "WQ00064",
        "WQ00065",
        "WQ00066",
        "WQ00067",
        "WQ00068",
        "WQ00069",
        "WQ00070",
        "WQ00071",
        "WQ00072",
        "WQ00073",
        "WQ00074",
        "WQ00075",
        "WQ00076",
        "WQ00077",
        "WQ00078",
        "WQ00079",
        "WQ00080",
        "WQ00081",
        "WQ00082",
        "WQ00083",
        "WQ00084",
        "WQ00085",
        "WQ00086",
        "WQ00087",
        "WQ00088",
        "WQ00089",
        "WQ00090",
        "WQ00091",
        "WQ00092",
        "WQ00093",
        "WQ00094",
        "WQ00095",
        "WQ00096",
        "WQ00097",
        "WQ00098",
        "WQ00099",
        "WQ00100",
        "WQ00101",
        "WQ00102",
        "WQ00103",
        "WQ00104"
      ],
      "resources": [],
      "outcome": "added",
      "changed": "Imported task records",
      "verification": null,
      "rollback": null,
      "remaining": "Imported task records"
    },
    {
      "timestamp": "2026-11-13T08:06:30.415698+00:00",
      "timezone": "Australia/Sydney",
      "run": "WQ1-bootstrap",
      "tasks": [
        "WQ00054",
        "WQ00058"
      ],
      "resources": [],
      "outcome": "owner-map-corrected",
      "changed": "Pipeline route imports pages/ScraperProgressPage.tsx",
      "verification": null,
      "rollback": null,
      "remaining": "Pipeline route imports pages/ScraperProgressPage.tsx"
    },
    {
      "timestamp": "2026-11-13T08:07:07.530517+00:00",
      "timezone": "Australia/Sydney",
      "run": "planner",
      "tasks": [],
      "resources": [],
      "outcome": "added",
      "changed": "Imported task records",
      "verification": null,
      "rollback": null,
      "remaining": "Imported task records"
    }
  ]
}
```
