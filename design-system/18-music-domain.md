# Music domain

The words and judgements of a working DJ, fixed so both products say and show them the same way. Thresholds here are the ones implemented in `SongNodes.energyStep`, `SongNodes.bpmStep` and `SongNodes.compat` (`source/bundle.src.js`); change them there and here together.

## Vocabulary

| Term | Means | Not |
|---|---|---|
| Track | One recording: artist, title, version | Song, item, node (in UI copy) |
| Crate | The music library's full track list | Database, collection |
| Set | An ordered list of tracks for one performance | Playlist (that is the TIDAL/Spotify object), setlist (only for imported real-world sets) |
| Slot | One position in a set | Row, index |
| Running order | The slots of a set in order | Queue |
| Tracklist | A list of what was played in a real set or show (imported) | Set |
| Transition | The move from one slot to the next | Mix, link |
| Energy | 1–10 intensity rating | Vibe, mood |
| Key | Camelot code | Scale, musical key (only in detail: "A minor") |
| Show | A radio programme ("PBS Soul Time") | Station |
| Weekly run | The scheduled job that builds the library and sends sets to TIDAL | Sync, cron |

## Energy tiers

| Tier | Range | Role in a set |
|---|---|---|
| Low | 1–4 | Openers, warm-up, breathers |
| Building | 5–7 | The body of a set; genre switches happen here |
| High | 8–10 | Peaks; held briefly |

Tier boundaries are drawn as gaps in `EnergyBar` and as `chart-grid` bands at 4.5 and 7.5 in `EnergyWave`.

## Set shapes

Shape names are fixed; the target wave is drawn dashed (`chart-ref`) behind the slot bars. The descriptions below summarise the intent; the numeric curves in the Naarm Set Builder are the reference, and SongNodes' path builder presets must be refitted to reproduce them, not tuned by hand.

| Shape | Target wave (energy by position) | Typical length |
|---|---|---|
| Journey (two peaks) | Rise from 4 to a first peak 8 at ~40%, trough 5–6, second peak 9–10 at ~80%, ease to 7 | 120–180 min |
| Peak time (three waves) | Start at 6, three waves 6→9 with 2–3 point drops between, last wave highest | 60–120 min |
| Warm-up opener | 2–3 rising slowly to 6, never above 7 | 60–120 min |
| Closing | Start at 8–9, step down to 4–5 with one late lift | 60–90 min |
| Steady groove | Hold 5–7, ±1 moves only | Any |

### Wave rules

1. Energy climbs +1 at a time and may hold (+0) for any number of slots.
2. A climb of +2 or more in one transition is a clash: "energy +2: too steep, step up one at a time".
3. After a peak, drop 2–3 points at once ("drop −3: trough reset", perfect). A single −1 is compatible; a second −1 in a row is flagged possible: "second −1 in a row: drop 2–3 at once instead".
4. Genre switches (House → Techno → UK garage) happen in the Building tier, after a run of three or more tracks in the current genre.
5. Locked slots never move; rebuilds ("Try another take") fill around them.

## Transitions

A `TransitionNote` judges four dimensions and shows the worst verdict as its overall `CompatibilityBadge`, then each part as text: "energy +1 · +1 key · +2 BPM · House → Techno".

| Dimension | Perfect ● | Compatible ◐ | Possible ○ | Clash ✕ |
|---|---|---|---|---|
| Energy (`energyStep`) | +1, hold, drop of 2 or more | −1 (single) | second −1 in a row | +2 or more |
| Key (`compat`) | same key; relative A↔B | ±1, same letter | +2 same letter ("+2 energy boost"); +7 same letter ("+7 lift") | anything else |
| BPM (`bpmStep`) | gap ≤ 2 | 3–4 | 5–8 | > 8 |
| Genre | same genre | switch in Building tier after 3+ | switch elsewhere | — (genre never clashes alone) |

- Missing data gives "unknown" with "?" ("key ?", "BPM ?", "energy ?") and never counts as a clash. Show `fg-3` and offer "Add key" where editable.
- Words beat glyphs, glyphs beat colours: every verdict shows glyph + word; the colour comes from `compat-*`, the same traffic light in every theme (dark, light and booth). No theme is colour-blind-safe on its own, so the glyph and the word are never dropped.

## Rotation

| Value | Means | Display |
|---|---|---|
| High | First pick: heard on 2 or more different shows in the run window, or on the ARIA Club Chart for 4 weeks or fewer (new or rising) | `CategoryTag` with `brand-soft` emphasis |
| Standard | Everything else that has been heard | `CategoryTag` neutral |
| Vault | Not heard for longer than the learned gap threshold (see below); used for colour | `CategoryTag` neutral, sorted last |

Rotation is calculated, never hard-coded. High rotation and Vault are worked out by the weekly run from the library's own play data, and the UI shows the values the run used (the `Disclosure` "How rotation is worked out" on the library page prints them).

- **High / Standard:** the rule above is fitted to the current library: it reproduces all 294 tracks of the 24 Oct 2026 run. Refit it if Markus's own rotation calls stop matching it.
- **Vault:** no track has been demoted yet; there are only 15 days of play history. Once 8 or more weeks exist, the threshold is learned from two methods cross-checked: the 90th percentile of gaps between repeat plays of the same track, and 3× the median show cadence (days between episodes). The larger of the two is used. Until then nothing moves to Vault.
- Never print a fixed threshold in copy: quote the values the latest run computed.

Rotation is a category, never a status: no green/amber/red.

## Pillars

House, Techno, UK garage. Neutral `CategoryTag`s; the genre mix control sets weights (0.00–1.00, two decimals, summing to 1.00: "House 0.45 · Techno 0.35 · UK garage 0.20"). Charts that split by pillar use `chart-1`, `chart-2`, `chart-3` in that order.

## Sources and the weekly run

| Source group | Sources | Shown as |
|---|---|---|
| Radio | PBS (e.g. "PBS Soul Time"), 3RRR ("3RRR Superfreak"), triple j ("triple j Mix Up") | `SourceBadge` with show name; plays per show |
| Charts | ARIA Club Chart | `SourceBadge` "ARIA Club Chart #12" |
| Tracklists | 1001tracklists, MixesDB, Setlist.fm, WatchTheDJ, Reddit | `SourceBadge`, link to the set |
| Video / audio | YouTube, SoundCloud | `SourceBadge`, external link |
| Stores and services | Spotify, Apple Music, Beatport, TIDAL, Deezer | `SourceBadge` + IDs in `KeyValueGrid` |
| Metadata | MusicBrainz, Discogs | IDs only |

- "Heard on" counts distinct shows, not plays. "Last heard" is the latest play date (Melbourne).
- Show the weekly run's last and next time with `FreshnessStamp`, using the run's real schedule: "Library built Sat 24 Oct, 06:00 AEDT · Next run Sat 31 Oct" (example). Its steps in `StagedProgress`: Collect plays, Match tracks, Enrich, Score, Build library, Send sets to TIDAL.

## Graph node states and edge types

| Node state | Treatment |
|---|---|
| Default | Fill set by the "Colour by" control in `GraphControls`: Neutral (default, `fg-2`; only the states below carry colour), Energy (`energy-1…10`), Key (`key-*` Camelot colours) or Genre (`chart-1…8`). The legend changes with the mode |
| Hovered | 1.5px `fg` ring, label shown |
| Selected | 2px `brand` ring + label |
| Now playing | 3px amber `now` ring + "Now" tag; one at a time. Now and selected differ by hue (amber vs lavender) and by the "Now" word |
| In path | `mod-paths` ring |
| Waypoint / start / finish | `mod-paths` fill with `map-pin` label; start and finish labelled "Start", "Finish" in text |
| Outside filter or selection | `opacity-faded` |

Edge types (`adjacency`, `similarity`, `collaboration`, `genre`, `key_compatibility`) are distinguished by stroke pattern, defined in Data display. Edge weight maps to width (1–4px) and opacity (`opacity-edge` → 0.9 for strong).

## Recommendation scores

Scores 0–100 (normalise 0–1 ×100). Bands: ≥ 80 Excellent match (perfect ●), 60–79 Good match (compatible ◐), 40–59 Workable with care (possible ○), < 40 Hard mix (clash ✕). Show the band word in lists, the number and its breakdown (harmonic, BPM, energy, genre, played together) in detail. Sort by score, ties by "played together" count.

## Data confidence

| Raw | Status | Label | Use |
|---|---|---|---|
| `high` | ok ● | High confidence | Matches, attribution, key/BPM detection |
| `medium` | fair ◐ | Medium confidence | Shown with the number "Medium confidence (0.64)" in detail |
| `low` | warn ▲ | Low confidence | Row flagged; sent to the review queue |

Confidence numbers are 0.00–1.00, two decimals. The backend assigns the band; the UI never re-bands a number. Where only a number arrives, use ≥ 0.80 high, 0.50–0.79 medium, < 0.50 low until thresholds are fitted to Markus's review-queue decisions (approved vs rejected).

## Backend statuses → `StatusPill`

Map every raw enum through `SongNodes.status(raw)`; never print the raw value. This is `STATUS_MAP` from `source/bundle.src.js`.

| Raw enum | Status | Glyph | Label | Comes from |
|---|---|---|---|---|
| `pending`, `queued` | idle | – | Queued | `TaskStatus`, `ProcessingStatus`, `EnrichmentStatus`, `ValidationStatus` |
| `running` | running | ↻ | Running | `ScraperStatus`, `TaskStatus` |
| `processing` | running | ↻ | Processing | `ProcessingStatus` (data-transformer) |
| `in_progress` | running | ↻ | In progress | `EnrichmentStatus` |
| `validating` | running | ↻ | Validating | `ValidationStatus` |
| `completed`, `success` | ok | ● | Done | most |
| `skipped` | idle | – | Skipped | `ProcessingStatus` |
| `partial` | warn | ▲ | Partly done | `EnrichmentStatus` |
| `cancelled` | idle | – | Cancelled | `TaskStatus` |
| `timeout` | bad | ✕ | Timed out | `TaskStatus` |
| `failed` | bad | ✕ | Failed | most; `ProxyStatus` |
| `error` | bad | ✕ | Error | `ScraperStatus`, `ValidationSeverity` |
| `idle` | idle | – | Idle | `ScraperStatus` |
| `disabled` | idle | – | Off | `ScraperStatus` |
| `circuit_open` | bad | ✕ | Paused after errors | `ScraperStatus` |
| `cooldown` | warn | ▲ | Cooling down | rate limiting |
| `healthy`, `ok` | ok | ● | Healthy, OK | `ProxyStatus`, health checks |
| `degraded` | warn | ▲ | Degraded | `ProxyStatus` |
| `unhealthy` | bad | ✕ | Down | health checks |
| `critical` | bad | ✕ | Critical | health-monitor |
| `untested` | idle | – | Not tested | `ProxyStatus` |
| `not_configured` | idle | – | Not set up | integrations |
| `not_initialized` | idle | – | Starting | services |
| `closed` | ok | ● | Normal | `CircuitState` |
| `half_open` | warn | ▲ | Testing | `CircuitState` |
| `open` | bad | ✕ | Paused after errors | `CircuitState` |
| `high` / `medium` / `low` | ok / fair / warn | ● ◐ ▲ | High / Medium / Low confidence | data quality (collides with `TaskPriority`, see below) |
| `saving` / `saved` | running / ok | ↻ ● | Saving… / Saved | client saves |
| anything else | info | i | the raw value | add a mapping (minor release) |

Gaps to close (minor release): `ValidationSeverity` `warning` and `info` are not mapped (they fall through to info with the raw lowercase word); map `warning` → warn "Warning" and `info` → info "Note". `TaskPriority` in `services/scraper-orchestrator/main.py` uses `low`/`medium`/`high`/`critical` (priority, not confidence): pass priorities through a separate `priority()` mapping shown as neutral `CategoryTag`s ("Low", "Medium", "High"), never `status()`, or they read "High confidence". The one exception is `critical`, shown as a `StatusPill` bad ✕ "Critical" because it needs action now. Enum sources: `services/scraper-orchestrator/main.py`, `services/data-transformer/main.py`, `services/metadata-enrichment/main.py`, `services/data-validator/main.py`, `scrapers/proxy_manager.py`, `common/api_gateway/circuit_breaker.py`.
