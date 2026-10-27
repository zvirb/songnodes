#!/usr/bin/env python3
"""Build the runtime-upgrade briefs (plan/agents/U*_*.md): one job per image or area, with the target versions chosen.

Versions are looked up when this script runs (PyPI JSON API, npm registry) and written into each brief, so a Jules
session never has to guess what "latest" means. Rerun to refresh the targets before sending a wave:
    python plan/build_upgrade_prompts.py            (needs network to pypi.org and registry.npmjs.org)
Decisions recorded 26 Oct 2026 (plan/RESTRUCTURE.md, section 6):
- Python 3.15 for every image; nlp-processor stays on 3.14 because spaCy 3.8.16 requires Python <3.15.
- Node 26 (LTS from late Oct 2026) for every Node image.
- Test, lint and type-check tooling was upgraded directly in PR #155 (TypeScript 7, Oxlint, Node 26 CI, Python 3.15 CI).
"""
import json
import pathlib
import re
import subprocess
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_rs_prompts import AGENTS, REPO, SLOT, brief  # noqa: E402

PY_DEFAULT, PY_SPACY = "3.15", "3.14"
NODE = "26"
COMPILE_ON_315 = {"annoy", "pyyaml", "ruamel.yaml.clib"}  # no cp315 wheel on PyPI (checked 26 Oct): needs a compiler in the build stage
PY_CHECKS = ("`docker build` the image(s) you own from the repo root exactly as compose.dev.yaml or the Dockerfile's comments do; "
             "inside the image, import the service's entry module; run the service's tests (`python -m pytest` in its folder) if it has any. "
             "Report failures in files you do not own; do not fix them.")


def pypi_latest(name):
    try:
        with urllib.request.urlopen(f"https://pypi.org/pypi/{name}/json", timeout=30) as r:
            return json.load(r)["info"]["version"]
    except Exception:
        return None


def npm_latest(name):
    r = subprocess.run(["npm", "view", name, "version"], capture_output=True, text=True)
    return r.stdout.strip() or None


def parse_reqs(path):
    out = []
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        body = line.split("#")[0].strip()
        if not body or body.startswith(("-", "git+", "http")):
            continue
        m = re.match(r"([A-Za-z0-9_.\-]+)(\[[^\]]*\])?\s*(.*)", body)
        if m:
            out.append((m.group(1), m.group(3).split(";")[0].strip()))
    return out


def py_changes(folder):
    files = sorted(p for p in (REPO / folder).glob("requirements*.txt"))
    names = sorted({n for f in files for n, _ in parse_reqs(f)}, key=str.lower)
    with ThreadPoolExecutor(16) as ex:
        latest = dict(zip(names, ex.map(pypi_latest, names)))
    rows, compile_needed = [], set()
    for f in files:
        for n, spec in parse_reqs(f):
            lat = latest.get(n)
            if n.lower().replace("_", "-") in COMPILE_ON_315:
                compile_needed.add(n)
            m = re.search(r"==\s*([^\s,]+)", spec)
            if lat and m and m.group(1) != lat:
                major = m.group(1).split(".")[0] != lat.split(".")[0]
                rows.append(f"| {f.relative_to(REPO)} | {n} | {m.group(1)} | **{lat}**{' (major: read its changelog)' if major else ''} |")
            elif lat and not m and spec:
                rows.append(f"| {f.relative_to(REPO)} | {n} | `{spec}` | **{lat}** (pin it: `=={lat}`) |")
    return rows, compile_needed


def froms(paths):
    out = []
    for p in paths:
        for m in re.finditer(r"^FROM\s+(\S+)", (REPO / p).read_text(encoding="utf-8"), re.M):
            out.append(f"{p}: `{m.group(1)}`")
    return out


P = []  # (wave, code, slug, title, deps, job, context, owned, do, done, checks)


def py_pkg(wave, code, slug, folder, dockerfiles, live, extra_owned=(), pyver=PY_DEFAULT, note=""):
    rows, comp = py_changes(folder)
    table = ("| File | Package | Now | Target |\n|---|---|---|---|\n" + "\n".join(rows)) if rows else "Every pinned requirement is already on its latest version; only the Python version changes."
    ctx = (f"{'Part of the running stack (compose.dev.yaml).' if live else 'Not in compose.dev.yaml (not part of the running stack); keep it building and importable.'} "
           f"Base images now: {'; '.join(froms(dockerfiles)) or 'none (requirements only)'}. Target Python: **{pyver}**. {note}\n\n"
           f"Chosen versions (latest on PyPI when this brief was built):\n\n{table}")
    do = [f"Change every Python base image you own to `{pyver}-slim`, keeping its registry prefix (for example `public.ecr.aws/docker/library/python:{pyver}-slim`).",
          "Set each pin in the table to its target. Do not add, remove or loosen other requirements.",
          "For a major version, read the package's changelog and fix only the call sites inside your owned paths; if a needed change is outside them, stop at the last working step and report it.",
          "Rebuild the image and run the checks; commit one step at a time."]
    if comp:
        do.insert(2, f"{', '.join(sorted(comp))} ship no Python {pyver} wheel yet and compile from source: make sure the build stage has a compiler "
                     "(for example `build-essential`) and that it is not left in the final image if the Dockerfile has a separate runtime stage.")
    owned = [f"{d} (base image and install steps only)" for d in dockerfiles] + [f"{folder}/requirements*.txt"] + list(extra_owned)
    P.append((wave, code, slug, f"Upgrade {folder} to Python {pyver} and latest requirements", [],
              f"Move {folder} to Python {pyver} and set its pinned requirements to the latest versions listed below.",
              ctx, owned, do,
              f"`docker build` succeeds for {', '.join(dockerfiles) or 'the requirements (pip install into a python:' + pyver + '-slim container)'}; the entry module imports inside the image; `python --version` in the image prints {pyver}.",
              PY_CHECKS))


def node_pkg(wave, code, slug, folder, dockerfiles):
    pkg = json.loads((REPO / folder / "package.json").read_text(encoding="utf-8")) if (REPO / folder / "package.json").exists() else {}
    names = [(sec, n, v) for sec in ("dependencies", "devDependencies") for n, v in (pkg.get(sec) or {}).items()]
    with ThreadPoolExecutor(16) as ex:
        lat = list(ex.map(lambda t: npm_latest(t[1]), names))
    rows = [f"| {sec} | {n} | `{v}` | **^{l}**{' (major)' if l and re.sub(r'[^0-9.]', '', v).split('.')[0] != l.split('.')[0] else ''} |"
            for (sec, n, v), l in zip(names, lat) if l and re.sub(r"[\^~>=<\s]", "", v) != l]
    table = ("| Section | Package | Now | Target |\n|---|---|---|---|\n" + "\n".join(rows)) if rows else "All npm dependencies are already on their latest versions."
    P.append((wave, code, slug, f"Upgrade {folder} to Node {NODE} and latest npm dependencies", [],
              f"Move {folder} to Node {NODE} and set its npm dependencies to the latest versions listed below.",
              f"Not in compose.dev.yaml (not part of the running stack). Base images now: {'; '.join(froms(dockerfiles))}.\n\n{table}",
              [f"{d} (base image lines only)" for d in dockerfiles] + [f"{folder}/package.json", f"{folder}/package-lock.json"],
              [f"Change every Node base image you own to `node:{NODE}-alpine`, keeping its registry prefix.",
               "Set each dependency to its target and regenerate package-lock.json with `npm install` on Linux (npm 12).",
               "For a major version, fix only call sites inside your owned paths; otherwise stop and report.",
               "Build the image and run the package's own test script if it has one."],
              "`docker build` succeeds; `node --version` in the image prints v26.", "`npm ci && npm test` (if a test script exists) in the folder; `docker build` of each owned Dockerfile."))


# ---- wave "up": the running stack and shared infrastructure ----
py_pkg("up", "U1", "rest_api_py315", "services/rest_api", ["services/rest_api/Dockerfile"], True,
       note="annoy (used by the route finder) has only a cp310 wheel and is compiled from source on any newer Python. neo4j 5 to 6 is a major bump, but no rest_api code imports neo4j on main (checked 26 Oct).")
py_pkg("up", "U2", "graph_api_py315", "services/graph-visualization-api", ["services/graph-visualization-api/Dockerfile"], True)
py_pkg("up", "U3", "worker_py315", "services/worker", ["services/worker/Dockerfile"], True,
       note="neo4j goes from 5 to 6 (major), but no worker code imports it on main (checked 26 Oct); only check the image builds and the Celery app imports.")
py_pkg("up", "U4", "scrapers_py315", "scrapers", ["scrapers/Dockerfile", "scrapers/Dockerfile.unified"], True,
       note="tidalapi constrains python-dateutil (see #115); keep that constraint working.")
P.append(("up", "U5", "redis_8", "Upgrade Redis to 8.10 in the dev stack", [],
          "Move the compose Redis service from redis:7-alpine to redis:8.10-alpine.",
          "Redis 8.10.2 is the latest release (17 Sep 2026). Redis 8 reads Redis 7 RDB/AOF files, so the existing volume carries over. compose.dev.yaml is shared: change only the redis service block.",
          ["compose.dev.yaml (the redis service block only)", "docs/upgrades/redis-8.md"],
          ["Change the image to redis:8.10-alpine; keep the volume, command and healthcheck unless 8.x requires a change (say which).",
           "Start redis 7 with a key written, switch to 8.10 on the same volume in your sandbox, and show the key survives.",
           "Write docs/upgrades/redis-8.md: what changed and how the owner checks it."],
          "The PR shows the key surviving the 7 to 8.10 switch on the same volume.",
          "`docker compose -f compose.dev.yaml config` passes; the volume test above."))
P.append(("up-legacy", "U6", "rabbitmq_4", "Upgrade RabbitMQ to 4.3 in the dev stack", [],
          "Move the compose RabbitMQ service from rabbitmq:3.13-alpine to rabbitmq:4.3-alpine by the officially supported upgrade path.",
          "RabbitMQ 3.13 lost community support in Sep 2024; 4.3.7 is the latest (19 Oct 2026). RabbitMQ requires all stable feature flags enabled before a 3.13 to 4.x upgrade, and may not allow skipping minor series. compose.dev.yaml is shared: change only the rabbitmq service block.",
          ["compose.dev.yaml (the rabbitmq service block only)", "docs/upgrades/rabbitmq-4.md"],
          ["Read the official RabbitMQ upgrade docs and state the supported path from 3.13 in the PR (direct, or through intermediate series).",
           "Change the image to rabbitmq:4.3-alpine. If a direct jump on the existing volume is not supported, use a new named volume for 4.3 and document that queues start empty (the outbox in Postgres replays durable work); never delete the old volume.",
           "Write docs/upgrades/rabbitmq-4.md with the exact owner steps (enable feature flags on 3.13 first if needed).",
           "Test the path in your sandbox: publish to a durable queue on 3.13, upgrade, and show the result."],
          "The PR states the supported path and shows the sandbox upgrade result.",
          "`docker compose -f compose.dev.yaml config` passes; the sandbox upgrade above."))
P.append(("hold", "U7", "postgres_18", "Prepare the Postgres 18 upgrade (owner runs it)", [],
          "Prepare the move from postgres:16-alpine to postgres:18-alpine (18.6) without touching the existing data volume.",
          "Postgres data files are not compatible across major versions: the 16 volume cannot be opened by 18. The project rule is never to reset the Postgres volume (CLAUDE.md). The owner runs the migration; this package prepares and proves it.",
          ["compose.dev.yaml (the postgres service block and its volume declaration only)", "scripts/upgrade-postgres-18.sh", "docs/upgrades/postgres-18.md"],
          ["compose: postgres:18-alpine on a NEW named volume (for example dev-postgres-18). Keep the old volume declared so it is never removed.",
           "scripts/upgrade-postgres-18.sh: dump from the running 16 container (pg_dumpall), start 18 on the new volume, restore, run the migrations check, print row counts of the main tables before and after. Idempotent; refuses if the new volume already has data; never deletes anything.",
           "docs/upgrades/postgres-18.md: the owner steps, how to verify, and how to roll back (switch compose back to 16 and the old volume).",
           "Prove it in your sandbox with the repo fixtures: 16 with data, run the script, 18 with the same counts."],
          "The PR shows before/after counts from the sandbox run. Merge only after the owner has run the script on the laptop.",
          "`bash -n scripts/upgrade-postgres-18.sh`; `docker compose -f compose.dev.yaml config`; the sandbox run."))
P.append(("4", "U8", "actions_latest", "Pin every GitHub Action to its latest release", [],
          "Update every `uses:` in .github/workflows to the action's latest release, pinned by full commit SHA with the version in a comment.",
          "Sent in wave 4, after G1, QA3 and QA4 changed workflows; include their files. Some workflows use tags (actions/checkout@v7), others SHAs. Pinning by SHA is the safer convention already used in security-secrets-deps.yml.",
          [".github/workflows/*.yml (only `uses:` lines and their version comments)"],
          ["For each action, find its latest release and the commit SHA of that tag (GitHub API).",
           "Replace each `uses:` with `owner/action@<sha> # vX.Y.Z`. Remove the commented placeholder `actions/setup-example@v1` in codeql.yml only if it is a comment.",
           "Change nothing else in the workflows (versions of Node and Python are already set)."],
          "Every `uses:` line ends in a 40-character SHA and a version comment; CI runs on the PR.",
          "`python -c \"import yaml,glob; [yaml.safe_load(open(f)) for f in glob.glob('.github/workflows/*.yml')]\"`; the PR's own CI run."))

# ---- wave "up-legacy": images not in the running stack ----
legacy = [
    ("U9", "api_gateway_internal", "services/api-gateway-internal", ["services/api-gateway-internal/Dockerfile"]),
    ("U10", "audio_analysis", "services/audio-analysis", ["services/audio-analysis/Dockerfile"]),
    ("U11", "browser_collector", "services/browser-collector", ["services/browser-collector/Dockerfile"]),
    ("U12", "data_transformer", "services/data-transformer", ["services/data-transformer/Dockerfile"]),
    ("U13", "data_validator", "services/data-validator", ["services/data-validator/Dockerfile"]),
    ("U14", "db_connection_pool", "services/db-connection-pool", ["services/db-connection-pool/Dockerfile"]),
    ("U15", "dlq_manager", "services/dlq-manager", ["services/dlq-manager/Dockerfile"]),
    ("U16", "gold_etl", "services/gold-to-operational-etl", ["services/gold-to-operational-etl/Dockerfile", "services/Dockerfile.gold_processor"]),
    ("U17", "graphql_api", "services/graphql-api", ["services/graphql-api/Dockerfile"]),
    ("U18", "metadata_enrichment", "services/metadata-enrichment", ["services/metadata-enrichment/Dockerfile", "services/metadata-enrichment/Dockerfile.worker"]),
    ("U20", "scraper_orchestrator", "services/scraper-orchestrator", ["services/scraper-orchestrator/Dockerfile", "services/scraper-orchestrator/Dockerfile.enhanced"]),
    ("U21", "serato_integration", "services/serato-integration", ["services/serato-integration/Dockerfile"]),
    ("U22", "websocket_api", "services/websocket-api", ["services/websocket-api/Dockerfile"]),
    ("U23", "streaming_integrations", "services/streaming-integrations", []),
    ("U24", "tidal_integration", "services/tidal-integration", []),
]
for code, slug, folder, dfs in legacy:
    py_pkg("up-legacy", code, slug, folder, dfs, False)
py_pkg("up-legacy", "U19", "nlp_processor", "services/nlp-processor", ["services/nlp-processor/Dockerfile"], False, pyver=PY_SPACY,
       note="Python 3.14, not 3.15: spaCy 3.8.16 (latest) declares requires_python <3.15 and has no cp315 wheels. Move to 3.15 when spaCy supports it.")
py_pkg("up-legacy", "U25", "base_template", "shared/templates", ["shared/templates/Dockerfile.base-service"], False,
       note="The template takes ARG PYTHON_VERSION; set its default to 3.15.")
P.append(("up-legacy", "U29", "graph_projection_py315", "Upgrade the graph projection service to Python 3.15 and neo4j 6", ["R3"],
          "Move services/graph-projection (restored by R3) to Python 3.15 and the neo4j driver from 5.17.0 to the latest 6.x, keeping the projection working.",
          "R3 restores services/graph-projection/{Dockerfile, cli.py, requirements.txt} (neo4j==5.17.0, asyncpg) and services/common/datalayer/graph_projection.py, which uses neo4j.AsyncGraphDatabase against Memgraph.",
          ["services/graph-projection/Dockerfile (base image and install steps only)", "services/graph-projection/requirements.txt",
           "services/common/datalayer/graph_projection.py (only the lines the neo4j 6 API requires)", "tests/graph_projection/**"],
          ["Look up the latest neo4j 6.x release on PyPI and its 5-to-6 migration notes; list the changes that touch AsyncGraphDatabase, sessions and transactions.",
           "Set Python 3.15-slim and neo4j to that version; change only the graph_projection.py lines the migration notes require.",
           "Run tests/graph_projection (from R3) against the new driver."],
          "`python -m pytest tests/graph_projection` passes with neo4j 6; the image builds on Python 3.15.",
          PY_CHECKS))
node_pkg("up-legacy", "U26", "api_gateway_node", "services/api-gateway", ["services/api-gateway/Dockerfile"])
node_pkg("up-legacy", "U27", "enhanced_viz_node", "services/enhanced-visualization-service",
         ["services/enhanced-visualization-service/Dockerfile", "services/enhanced-visualization-service/Dockerfile.test"])
node_pkg("up-legacy", "U28", "health_monitor_node", "services/health-monitor", ["services/health-monitor/Dockerfile"])



def main():
    status = REPO / "STATUS.md"
    s = status.read_text(encoding="utf-8")
    added = []
    for wave, code, slug, title, deps, job, ctx, owned, do, done, checks in P:
        for old in AGENTS.glob(f"{code}_*.md"):
            old.unlink()
        (AGENTS / f"{code}_{slug}.md").write_text(brief(code, title, deps, job, ctx, owned, do, done, checks), encoding="utf-8")
        if f"SLOT:{code} BEGIN" not in s:
            s = s.rstrip("\n") + "\n\n" + SLOT.format(c=code, t=title)
            added.append(code)
    status.write_text(s, encoding="utf-8")
    print(f"{len(P)} upgrade briefs written; slots added: {', '.join(added) or 'none'}")


if __name__ == "__main__":
    main()
