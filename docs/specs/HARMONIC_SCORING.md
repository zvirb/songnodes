# Harmonic scoring and energy moves (spec `harmonic-1`, accepted)

Status: **accepted** (proposed M6S, 1 Nov 2026; owner answers to every §5 question 2 Nov 2026, recorded in §5;
implemented as pure functions by M6-F1, work package HS1). Milestone 6 in `docs/IMPLEMENTATION_PLAN.md` asks for one tested
harmonic scoring spec, energy move labels on edges, and tested score-versus-cost semantics. This document
lists every rule the code has today, defines one canonical rule set, gives the worked examples later
packages turn into tests, and splits the implementation into packages. The spec itself changes no code.

Authority: the design system (`SN.compat`, `SN.bpmStep`, `SN.energyStep` in
`design-system/source/bundle.src.js`, described in `design-system/18-music-domain.md` and
`11-data-display.md`) decides the **levels and words shown to people**. Where this spec needs a different
verdict or word, it is listed under [Questions and answers](#5-questions-and-answers) and is settled as a
design-system change (`design-system/17-governance.md`), never patched in app code.

---

## 1. Inventory of existing rules

Line numbers are on `main` at 2427bf9.

### 1.1 Design system (authoritative for UI wording)

| Rule | Where | Behaviour |
|---|---|---|
| Key parse | `design-system/source/bundle.src.js:40` `camelot()` (mirrored at `design-system/components/bundle.js:41` and `frontend/src/styles/design-system/bundle.js:41`) | "8A", "Am", "A minor", "F#m", "Eb" → Camelot; 8A = A minor. Agrees with `services/common/metadata/camelot.py`. |
| Key move | `bundle.src.js:54` `compat(a, b)` | Directed. `d = (nb − na) mod 12`. Same letter: d 0 perfect "same key"; d 1/11 compatible "+1 key"/"−1 key"; d 2 possible "+2 energy boost"; d 10 possible "−2 energy drop" (`:64`); d 7 possible "+7 lift" (`:65`); else clash "key clash". Other letter: d 0 perfect "relative A↔B"; else clash. Unknown: "key ?". |
| Energy tier | `bundle.src.js:73` `tier()` | Low 1–4, Building 5–7, High 8–10 (integers). |
| Energy step | `bundle.src.js:76` `energyStep(prev, next, before)` | `d = next − prev`. d ≥ 2 clash "too steep"; d = 1 perfect; d ≤ −2 perfect "trough reset" (no lower bound); d = −1 compatible, or possible when `before` was also −1; anything else "energy hold". |
| BPM step | `bundle.src.js:85` `bpmStep(a, b)` | `d = Math.round(b − a)`; \|d\| ≤ 2 perfect, ≤ 4 compatible, ≤ 8 possible, else clash. No half/double time. |
| Score bands | `design-system/18-music-domain.md:115`, `11-data-display.md:137`; Q9 in `17-governance.md:161` (open) | 0–100; ≥ 80 Excellent, 60–79 Good, 40–59 Workable, < 40 Hard mix. |
| Transition note | `18-music-domain.md:53–62` | Worst of energy, key, BPM, genre; missing data is "unknown", never a clash. |

### 1.2 Frontend

| Rule | Where | Agrees with SN? |
|---|---|---|
| `SN` re-export | `frontend/src/lib/songnodes.tsx:6` | Yes (thin wrapper). |
| Key verdicts in UI | `components/CamelotWheel.tsx:70`, `components/HarmonicCompatibility.tsx:41`, `components/ds/index.tsx:1668`, `components/EnergyMeter.tsx:51`, `features/musicLibrary/SetBuilderPage.tsx:162`, `features/pathfinder/PathfinderPage.tsx:284–286` | Yes (call SN). |
| Recommendation key | `components/IntelligentBrowser/utils.ts:14` | Uses SN.compat, but unknown key → `clash` (DS says unknown never counts as a clash). |
| Recommendation score | `components/IntelligentBrowser/utils.ts:60–133` | Adjacency 60 + 20·weight; key 25/15; energy \|Δ\| ≤ 1 → 15, ≤ 2 → 10; BPM by **percent** ≤ 2 % → 15, ≤ 6 % → 10. Not on the DS BPM thresholds. Bands at `:146` follow Q9. |
| Set builder key move | `features/musicLibrary/setBuilder.ts:230` `keyMove` | Same table as SN.compat (scores 3 / 2.6 / 2.0 / 1.4 / −2), but no −2 (d 10) case: "−2 energy drop" is a clash here. |
| Set builder BPM | `features/musicLibrary/setBuilder.ts:311` | Same 2/4/8 thresholds as bpmStep, unrounded gap. |
| Transition finder | `features/setBuilder/transitions.ts:31`, `:68` | Hard BPM cut at **4 %**; energy \|Δ\| ≤ 1 smooth. |
| Camelot page targets | `features/camelot/camelotLogic.ts:17`, `:52` | Same, relative, ±1, +2, +7. No −2. |
| Force layout | `utils/harmonicCompatibility.ts:39` (`'semitone'` at `:63` for ±2 both directions), `:190` BPM similarity `exp(−gap/20)` with ×2/÷2 | Layout heuristic, not a verdict. ±2 named "semitone" (it is two fifths, a whole tone). |
| Client pathfinder | `utils/pathfinding.ts:52–204` (used by `components/ContextMenu.tsx`) | `getHarmonicCompatibility` (`utils/harmonic.ts:105`: relative 0.95, ±1 0.8/0.7, diagonal moves allowed, `positionDiff === 7` at `:139` is unreachable); energy thresholds 0.2/0.3 assume a **0–1** scale; strict-mode multipliers (`:88`) are overwritten at `:203`; every edge is also added reversed (`:287`), so direction is lost. |
| Dead copies (no importers) | `utils/harmonicMatching.ts:71/109/135` (0–1 energy, ±30 BPM ladder, 1.5× ratios, comments call A major), `utils/harmonicUtils.ts:16` (±2 both directions possible, no +7), `utils/intelligentBrowserUtils.ts:9`, `components/IntelligentBrowser.legacy.tsx:144` (same number → perfect, ±1 compatible, nothing else) | Disagree; remove (package M6-F3). |

### 1.3 Backend

| Rule | Where | Behaviour / disagreement |
|---|---|---|
| Camelot spec | `services/common/metadata/camelot.py` (`to_camelot` `:92`, Open Key `:99`) | Canonical parser; agrees with SN.camelot. |
| Key evidence agreement | `services/common/metadata/consensus.py:137` `key_agreement` | exact / near (relative or ±1). For **measurement agreement**, not transitions. Keep separate. |
| Tempo folding | `services/common/metadata/tempo.py:53` `fold_tempo`, `:77` `tempo_agreement` (0.5 % tolerance, octave) | For **evidence**, genre-justified only. Not a transition tolerance. |
| Energy contract | `services/common/metadata/energy.py:16`, `:29`; `docs/DATA_LAYER.md:83–87` | `energy-1`: 1–10, one decimal, bands Warm 1.0–3.9, Building 4.0–6.9, Peak 7.0–10.0 (provisional). Disagrees with DS tiers (Low 1–4, Building 5–7, High 8–10). |
| REST pathfinder key | `services/rest_api/routers/pathfinder.py:30` table, `:114`, `:121` | Same / ±1 / relative only; bonus 1.0 same, 0.5 compatible; ±2 and +7 get nothing. |
| REST pathfinder BPM | `pathfinder.py:134–144` | Min of direct, ×2, ÷2 gap; **missing BPM returns 1.0**, a smaller penalty than a known 5 BPM gap. |
| REST pathfinder cost | `pathfinder.py:75`, `:311–314`, `:447`, `:521` | Model says weight "lower is stronger", but callers send `occurrence_count` as weight (`services/graph-visualization-api/catalog.py:109`, `services/rest_api/main.py:582`, `frontend/src/components/PathfinderPanel/hooks.ts:126`): **more-played transitions cost more**. Cost = weight − 0.3·bonus + (gap/100)², and a −1.0 waypoint reward, can go negative. |
| Graph projection | `services/common/datalayer/graph_projection.py:194–239` | Creates `TRANSITIONS_TO` between **every** pair within 10 BPM (inferred, mixed with observed); `key_compatibility` hard-coded 1.0 (`:226`); unknown energy written as `energy_step = 0.0` (`:218`), indistinguishable from a hold. |
| Silver transition metrics | `sql/migrations/medallion/006_track_adjacency_edges_up.sql:28–38`, `:77` | Columns `avg_key_compatibility` (1.0/0.8/0.5/0.0), `avg_bpm_difference`, `avg_energy_difference`, `transition_quality_score` = (1 − gap/20)·key·(1 − \|Δe\|) (0–1 energy). Only copied on merge (`services/common/datalayer/identity.py:105`); no writer computes them. |
| Scraper helper | `scrapers/camelot_wheel.py:155`, `:196` | 1.0 same, 0.8 ±1/relative, 0.5 ±2, 0.3 ±3 or other letter, else 0. Not imported by anything that scores. |
| Gold lists | `services/gold_layer_processor.py:35`, `services/data-transformer/silver_tracks_to_gold_etl.py:58`, `:89`; `services/metadata-enrichment/dj_profiler.py:431` | Compatible-key lists (same, ±1, relative); `_are_keys_compatible` is a stub. |

### 1.4 Disagreements in one place

1. **±2 and +7** are possible in SN; clash in the REST pathfinder, the legacy browser and gold lists; 0.6/0.75 in `utils/harmonic.ts`; −2 is missing from `keyMove` and `camelotLogic`, and from the `11-data-display.md:82–92` table although the bundle has it.
2. **Diagonal moves** (8A → 9B) are clash in SN, 0.7 in `utils/harmonic.ts`, 0.3 in `scrapers/camelot_wheel.py`.
3. **BPM**: absolute 2/4/8 (SN, set builder), percent 2/6 (browser), 4 % cut (transition finder), 10 BPM cut (projection), ×2/÷2 folding in the pathfinder and force layout but not in SN.
4. **Energy scale**: 1–10 (SN, energy contract) vs 0–1 (client pathfinder, dead matcher, migration 006); tiers vs bands differ (open question Q-E5).
5. **Unknown values**: clash (browser), 1.0 BPM gap (pathfinder), 0.0 energy step (projection), "unknown" (SN). Only SN is right.
6. **Score versus cost**: occurrence count used as a cost; costs can go negative; client-side reverses edges.

---

## 2. Canonical spec

### 2.1 Inputs

| Input | Source | Unknown when |
|---|---|---|
| Key | `to_camelot()` (Python) / `SN.camelot()` (JS), 24 codes, 8A = A minor | Unparseable or missing |
| BPM | `tempo.known_bpm()`; the stored consensus BPM, never refolded here | Missing, ≤ 0, NaN, ∞ |
| Energy | `energy_canonical`, contract `energy-1`, 1.0–10.0 at one decimal, with its source | Missing (see Q-E4 for uncalibrated readings) |
| Direction | Edge `from → to`, as played | Always known for observed edges |
| Evidence | `occurrence_count` n ≥ 0 (0 = inferred, not observed) | – |

Edges are **directed**: the key verdict differs between a → b and b → a (+7 vs −7), and the energy move flips sign.

### 2.2 Key verdict (identical to `SN.compat`)

Let `d = (n_to − n_from) mod 12`.

| Relation | Condition | Level | Label (SN) | `key_score` |
|---|---|---|---|---|
| `same` | d 0, same letter | perfect | "same key" | 1.0 |
| `relative` | d 0, other letter | perfect | "relative A↔B" | 1.0 |
| `plus_one` / `minus_one` | d 1 / 11, same letter | compatible | "+1 key" / "−1 key" | 0.8 |
| `plus_two` / `minus_two` | d 2 / 10, same letter | possible | "+2 energy boost" / "−2 energy drop" | 0.5 |
| `plus_seven` | d 7, same letter | possible | "+7 lift" | 0.5 |
| `clash` | anything else (incl. −7 = d 5, and every diagonal) | clash | "key clash" | 0.0 |
| `unknown` | either key unknown | unknown | "key ?" | null |

Scores per level are the ones already in migration 006 and `scrapers/camelot_wheel.py`: perfect 1.0, compatible 0.8, possible 0.5, clash 0.0. Circular boundaries: 12 → 1 is +1, 1 → 12 is −1, 11 → 1 is +2, 6 → 1 is +7.

### 2.3 BPM verdict

1. `direct = |b − a|`; `as_double = |b / 2 − a|` (target is double time); `as_half = |2b − a|` (target is half time).
2. Round each gap to a whole BPM, **half away from zero on the absolute value** (Python `Decimal` `ROUND_HALF_UP`).
3. If the smaller octave gap is strictly less than the direct gap and ≤ 8, relation is `double_time` / `half_time` and that gap is used; otherwise relation is `direct`.
4. Level from the gap: ≤ 2 perfect, 3–4 compatible, 5–8 possible, > 8 clash (SN thresholds). An octave move is **capped at compatible**, never perfect (the groove changes even when the tempo locks; Q-B1, answered).
5. `bpm_score` = level score (1.0 / 0.8 / 0.5 / 0.0); unknown → null, label "BPM ?".
6. Label: the signed direct gap as SN words it ("+3 BPM", "−2 BPM", "same BPM"); an octave move has its own wording,
   "double time" / "half time" (the gap is in `bpm_gap`), with the final words from the design system (M6-DS).

Tempo tolerance for **evidence** (`tempo_agreement`, 0.5 %) and genre folding (`fold_tempo`) are unchanged and are not used here.

### 2.4 Energy move (`energy-move-1`, bound to `energy-1`)

`delta = e_to − e_from` on the one-decimal values, then `n = round(delta)` half away from zero.

| Label | n | Typical use |
|---|---|---|
| `hold` | 0 (−0.4 … +0.4) | Plateau |
| `step_up` | +1 | Climb one level |
| `lift` | +2, +3 | Deliberate push |
| `jarring` | ≥ +4, or ≤ −5 | Rise or fall big enough to break the floor (Q-E2) |
| `reset_drop` | −2 … −4 | Trough reset after a peak (Q-E2; the design system's "trough reset" narrows to this) |
| `step_down` | −1 | Ease off (sixth label, mirrors `step_up`; Q-E1) |
| `unknown` | either energy unknown | Never classified as a known move; delta null |

The label is a fact about the edge's inputs. It carries no set context: the "second −1 in a row" rule (`energyStep`'s `before`) and whether a drop suits the moment belong to the route finder and the UI, not to the stored label. Recalibration publishes `energy-move-2`; stored labels are never edited in place.

### 2.5 Compatibility score

Energy is **not** part of the compatibility score (plan: "compatibility strength and energy movement remain separate facts").

- Weights: key 0.6, BPM 0.4.
- `compat_score = key_score^0.6 × bpm_score^0.4` (weighted geometric mean), so any clash gives 0 and lands in "Hard mix", matching the worst-verdict rule of the transition note.
- `compat_coverage` = sum of the weights of the known parts (1.0, 0.6, 0.4 or 0).
- `compat_score` is stored and shown **only when coverage is 1.0**; otherwise it is null and the UI shows the part verdicts ("key ?"). `partial_score` (same formula, exponents renormalised over the known parts) is kept for cost only.
- Display: `100 × compat_score` rounded half up to a whole number (87.5 → 88; 0.8^0.4 = 0.9146 → 91), with the Q9 bands.

### 2.6 Cost for pathfinding

Scores are "higher is better"; costs are "lower is better". The router never feeds a score or a count in as a cost.

```
c_compat   = 1 − compat_score                           when coverage = 1
           = cov × (1 − partial_score) + (1 − cov) × U   when 0 < coverage < 1
           = U                                          when coverage = 0       (U = 0.5)
c_evidence = 1 / (1 + log2(1 + n))   for observed edges (n ≥ 1);  1.0 for inferred edges (n = 0)
cost       = ε + w_c × c_compat + w_e × c_evidence       (ε = 0.05, w_c = 1, w_e = 1)
```

Required properties (each becomes a test): cost > 0 for every input; cost strictly decreases as `compat_score` rises at fixed n; strictly decreases as n rises at fixed score; an unknown part never costs less than a known perfect part; inferred edges never cost less than the same edge observed once; a → b and b → a are costed separately. Energy-move and wave preferences are added by the route finder at search time from route state (milestone 6 wave routing), not baked into the stored cost. Waypoint handling must not use negative costs.

### 2.7 Stored on each edge

`direction` (from, to), `occurrence_count`, `key_relation`, `key_level`, `key_score`, `bpm_relation`, `bpm_gap`, `bpm_level`, `bpm_score`, `compat_score`, `compat_coverage`, `energy_from`, `energy_to`, `energy_delta`, `energy_move`, `energy_contract` (`energy-1`), `move_version` (`energy-move-1`), `scoring_version` (`harmonic-1`), and the provenance of the inputs (consensus source for key and BPM, energy source and calibration flag). Cost is computed at query time, not stored, so routing policy can change without a rebuild.

---

## 3. Worked examples

Score shown ×100; cost to three decimals. "Today (SN)" is what the current bundle shows where it differs from the spec;
those differences close when M6-DS lands. The golden copy of this table, read by the tests, is
`tests/fixtures/harmonic_scoring/examples.json`. Scores in rows 10, 11, 13, 15, 16 and 19 were corrected on
2 Nov 2026: the first draft rounded 0.8^0.6 = 0.8747 up to 88 and 0.8^0.4 = 0.9146 up to 92; they are 87 and 91.

| # | From → to (key, BPM, energy, n) | Key | BPM | Energy move | Score | Cost | Today (SN) |
|---|---|---|---|---|---|---|---|
| 1 | 8A → 8A, 128 → 128, 6 → 6, n 3 | perfect, same | direct 0, perfect | hold (0) | 100 | 0.383 | same |
| 2 | 8A → 8B, 124 → 125, 5 → 6, n 1 | perfect, relative | direct 1, perfect | step_up (+1) | 100 | 0.550 | same |
| 3 | 8A → 9A, 124 → 127, 6 → 7, n 12 | compatible, +1 | direct 3, compatible | step_up (+1) | 80 | 0.463 | same |
| 4 | 8A → 7A, 126 → 122, 7 → 7, n 2 | compatible, −1 | direct 4, compatible | hold (0) | 80 | 0.637 | same |
| 5 | 8A → 10A, 125 → 130, 5 → 7, n 1 | possible, +2 | direct 5, possible | lift (+2) | 50 | 1.050 | energy clash "too steep" |
| 6 | 10A → 8A, 130 → 125, 7 → 5, n 1 | possible, −2 | direct 5, possible | reset_drop (−2) | 50 | 1.050 | same |
| 7 | 8A → 3A, 124 → 124, 7 → 8, n 4 | possible, +7 | direct 0, perfect | step_up (+1) | 66 | 0.691 | same |
| 8 | 3A → 8A, 124 → 124, 8 → 7, n 0 (inferred) | clash (−7) | direct 0, perfect | step_down (−1, Q-E1) | 0 | 2.050 | same |
| 9 | 8A → 9B, 124 → 124, 6 → 6, n 1 | clash (diagonal) | direct 0, perfect | hold (0) | 0 | 1.550 | same |
| 10 | 12A → 1A, 128 → 128, 6 → 7, n 5 | compatible, +1 (wrap) | direct 0, perfect | step_up (+1) | 87 | 0.454 | same |
| 11 | 1B → 12B, 128 → 126, 8 → 5, n 2 | compatible, −1 (wrap) | direct 2, perfect | reset_drop (−3) | 87 | 0.562 | same |
| 12 | 8A → 11B, 128 → 140, 4 → 9, n 1 | clash | direct 12, clash | jarring (+5) | 0 | 1.550 | energy clash |
| 13 | 5A → 5A, 87 → 174, 6 → 6, n 1 | perfect, same | double_time 0, compatible (capped), "double time" | hold (0) | 91 | 0.635 | BPM clash "+87 BPM" (Q-B1) |
| 14 | 5A → 6A, 128 → 64, 8 → 5, n 1 | compatible, +1 | half_time 0, compatible (capped), "half time" | reset_drop (−3) | 80 | 0.750 | BPM clash "−64 BPM" (Q-B1) |
| 15 | 8A → 8A, 123 → 125.5, 6 → 6, n 1 | perfect | direct 3 (2.5 rounds up), compatible | hold (0) | 91 | 0.635 | "+3 BPM" compatible |
| 16 | 8A → 8A, 125.5 → 123, 6 → 6, n 1 | perfect | direct 3, compatible, "−3 BPM" | hold (0) | 91 | 0.635 | "−2 BPM" perfect (JS rounding, Q-B2) |
| 17 | ? → 8A, 128 → 129, 6 → 6, n 1 | unknown "key ?" | direct 1, perfect | hold (0) | – (coverage 0.4) | 0.850 | same |
| 18 | 8A → 8A, ? → 128, 6 → 6, n 1 | perfect | unknown "BPM ?" | hold (0) | – (coverage 0.6) | 0.750 | same |
| 19 | 8A → 9A, 128 → 128, ? → 7, n 1 | compatible, +1 | direct 0, perfect | unknown | 87 | 0.675 | same |
| 20 | 8A → 8A, 128 → 128, 6.4 → 7.9, n 1 | perfect | perfect | lift (+1.5 → 2) | 100 | 0.550 | "energy hold" (fraction, Q-E3) |
| 21 | 8A → 8A, 128 → 128, 9.0 → 3.0, n 1 | perfect | perfect | jarring (−6, Q-E2) | 100 | 0.550 | perfect "drop −6: trough reset" (Q-E2) |
| 22 | 8A → 8A, 128 → 128, 6.0 → 5.5, n 1 | perfect | perfect | step_down (−0.5 → −1, Q-E1) | 100 | 0.550 | "energy hold" (Q-E3) |
| 23 | 8A → 8A, 128 → 128, 6.0 → 6.4, n 1 | perfect | perfect | hold (+0.4 → 0) | 100 | 0.550 | same |
| 24 | all unknown, n 9 | unknown | unknown | unknown | – (coverage 0) | 0.781 | same |

Also required as tests: all 576 ordered key pairs equal `SN.compat` level and label (generated from the bundle, not hand-typed); every key parse case in `services/common/tests` for `to_camelot`; the cost properties in §2.6.

---

## 4. Packages to implement it

Each is one job within the ~400-line budget; owned paths only. Order: Q-answers (done 2 Nov 2026) → F1 (HS1) → F2 → P1 → P2 → R1 → U1 → F3.

| Code | Job | Owned paths |
|---|---|---|
| M6-F1 | Pure classifier and cost functions, golden tests from §3 | `services/common/metadata/transition_scoring.py`, `services/common/tests/test_transition_scoring.py`, `tests/fixtures/harmonic_scoring/examples.json` |
| M6-F2 | Parity test: SN.compat/bpmStep/energyStep against the same fixture (marks rows that wait on design-system answers as expected differences) | `frontend/src/lib/harmonicScoring.parity.test.ts` |
| M6-DS | Design-system change for the answered questions (BPM octave words and rounding, fractional energy, drop bound, `step_down` word, −2 row in the table, tiers vs bands), version bump and re-sync | `design-system/source/bundle.src.js`, `design-system/18-music-domain.md`, `design-system/11-data-display.md`, `design-system/17-governance.md`, built bundle and `tokens.json` version, `frontend/src/styles/design-system/**` via `scripts/sync-design-system.sh` only |
| M6-P1 | Store scoring fields on observed Silver transitions (migration up/down and writer) | `sql/migrations/<next>_transition_scoring_up.sql`, `..._down.sql`, the transition ETL writer module, its tests |
| M6-P2 | Graph projection carries the stored fields on observed edges only; stop all-pairs inferred `TRANSITIONS_TO` and the 0.0 energy default | `services/common/datalayer/graph_projection.py`, `services/common/tests/test_graph_projection_scoring.py` |
| M6-R1 | REST pathfinder uses §2.6 cost (fixes count-as-cost and negative costs) | `services/rest_api/routers/pathfinder.py`, `services/rest_api/tests/test_pathfinder_cost.py` |
| M6-U1 | Graph API exposes the edge fields; edge details show stored verdicts and move label through `CompatibilityBadge` | `services/graph-visualization-api/catalog.py`, its tests, `frontend/src/components/EdgeDetailsModal.tsx`, its test |
| M6-F3 | Remove dead duplicates (no importers) | `frontend/src/utils/harmonicMatching.ts`, `frontend/src/utils/harmonicUtils.ts`, `frontend/src/utils/intelligentBrowserUtils.ts`, `frontend/src/components/IntelligentBrowser.legacy.tsx` |

Later, not in this split: client pathfinder (`frontend/src/utils/pathfinding.ts`) retired in favour of the REST route finder; recommendation scoring in `IntelligentBrowser/utils.ts` moved onto §2.5; edge colouring by move (milestone 7); wave routing (milestone 6, after R1).

---

## 5. Questions and answers

Every question was answered by the owner (Markus) on 2 Nov 2026. Each row keeps the evidence and the proposed
default; the answer column is binding for `harmonic-1`. Answers that change shown words are design-system changes
(M6-DS), never app-code patches.

| # | Question | Evidence | Proposed default | Answer (2 Nov 2026) |
|---|---|---|---|---|
| Q-E1 | The plan names five labels; a −1 move fits none. | `IMPLEMENTATION_PLAN.md:170–171`; SN treats −1 as its own verdict (`bundle.src.js:82`). | Add `step_down`. Alternative: fold −1 into `hold` (then rows 8 and 22 read `hold`). | Add `step_down` for a −1 move, mirroring `step_up` (rows 8 and 22). |
| Q-E2 | SN calls every drop of 2 or more a perfect "trough reset"; the plan's `jarring` implies very large drops are not. | `bundle.src.js:81`, `18-music-domain.md:47` ("drop 2–3 at once"). | Drops of 2–4 `reset_drop`; 5 or more `jarring`. Rises of 4 or more `jarring`. | Drops of 2–4 are `reset_drop`; drops of 5 or more are `jarring`; rises of 4 or more are `jarring`. The design system's "trough reset" wording narrows to match (M6-DS). |
| Q-E3 | `energyStep` compares exact integers, so a delta of ±0.5 or ±1.5 reads "energy hold". Energy is stored at one decimal. | `bundle.src.js:78–83`, `energy.py:18`. | Round the delta half away from zero before judging, in both SN and the classifier. | Proposed default. |
| Q-E4 | Do uncalibrated readings (legacy 0–1, provider) get a move label? The contract gives them no band. | `energy.py:1–9`, `DATA_LAYER.md:85–87`. | Label them, and store each side's source and calibration flag; routing may ignore uncalibrated moves. | Proposed default. |
| Q-E5 | Tier boundaries disagree: DS Low 1–4 / Building 5–7 / High 8–10 vs contract Warm 1.0–3.9 / Building 4.0–6.9 / Peak 7.0–10.0. Moves do not depend on bands, but the wave chart and route phases do. | `bundle.src.js:73–74`, `11-data-display.md:42–44`, `energy.py:29–33`. | Settle in milestone 3 ratification; the design system wins for wording. | Proposed default. |
| Q-E6 | "Lift" is used both for the key move "+7 lift" and the energy move `lift`; "+2 energy boost" is a key move named after energy. | `bundle.src.js:63–65`, `IMPLEMENTATION_PLAN.md:171`. | Keep both identifiers; show the energy move in UI with a different word (for example "push") chosen by the design system. | Proposed default. |
| Q-B1 | SN has no half/double time: 87 → 174 is a clash. Should an octave move be compatible, possible, or stay a clash, and how is it worded? | `bundle.src.js:85–89`; pathfinder and force layout already fold (`pathfinder.py:134`, `harmonicCompatibility.ts:190`); plan asks for half/double cases (`IMPLEMENTATION_PLAN.md:168`). | Octave gap judged like a direct gap, capped at compatible; label words from the design system. | Judge the halved/doubled BPM like a direct gap, capped at compatible (never perfect), worded "half time" / "double time"; final words from the design system (M6-DS). |
| Q-B2 | `Math.round` rounds −2.5 to −2 and +2.5 to 3, so a gap judges differently by direction. | `bundle.src.js:87`. | Round the absolute gap half up in SN and the classifier. | Proposed default. |
| Q-B3 | Absolute thresholds are looser at 174 BPM than at 120. Keep absolute (SN), or move to percent (browser, transition finder)? | `IntelligentBrowser/utils.ts:117`, `transitions.ts:31`. | Keep SN absolute thresholds in `harmonic-1`; revisit with real-set calibration. | Proposed default. |
| Q-S1 | Weights 0.6/0.4, geometric mean, U = 0.5, ε = 0.05 and the log evidence curve are proposals. | No calibration data yet (ordered real sets pending, `IMPLEMENTATION_PLAN.md:474`). | Use them for `harmonic-1`; fit later as `harmonic-2`. | Proposed default. |
| Q-S2 | Score bands 80/60/40 are still open (Q9). | `17-governance.md:161`. | Use 80/60/40. | Proposed default. |
| Q-S3 | Genre is a TransitionNote dimension but is left out of `compat_score`. | `18-music-domain.md:60`. | Keep genre out of milestone 6 scoring; the route finder may use it. | Proposed default. |
