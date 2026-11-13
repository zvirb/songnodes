# MUS rules (generated)

| ID | Rule | Check | Test |
|---|---|---|---|
| MUS-001 | The thresholds in SongNodes.energyStep, SongNodes.bpmStep and SongNodes.compat and the music-domain document shall be changed together. | judgement | Threshold changes touch bundle.src.js and 18-music-domain.md in one change. |
| MUS-002 | UI copy shall say "Track" for one recording and not Song, item or node. | lint | UI strings contain no Song/item/node for a recording. |
| MUS-003 | UI copy shall say "Crate" for the music library's full track list and not Database or collection. | lint | No Database/collection used for the crate. |
| MUS-004 | UI copy shall say "Set" for an ordered list of tracks for one performance and not Playlist, which is the TIDAL/Spotify object. | lint | UI does not call a set a playlist. |
| MUS-005 | "Setlist" shall be used only for imported real-world sets. | judgement | Setlist appears only for imported real-world sets. |
| MUS-006 | UI copy shall say "Slot" for one position in a set and not Row or index. | lint | No Row/index for a set position. |
| MUS-007 | UI copy shall say "Running order" for the slots of a set in order and not Queue. | lint | No Queue for a set order. |
| MUS-008 | "Tracklist" shall mean a list of what was played in a real set or show (imported) and shall not mean Set. | judgement | Tracklist only used for imported played lists. |
| MUS-009 | UI copy shall say "Transition" for the move from one slot to the next and not Mix or link. | lint | No Mix/link for a transition. |
| MUS-010 | UI copy shall say "Energy" for the 1-10 intensity rating and not Vibe or mood. | lint | No Vibe/mood for energy. |
| MUS-011 | UI copy shall say "Key" for the Camelot code and shall use scale or musical key only in detail views (e.g. "A minor"). | judgement | Key means Camelot code; key names only in detail. |
| MUS-012 | UI copy shall say "Show" for a radio programme and not Station. | lint | No Station for a programme. |
| MUS-013 | UI copy shall say "Weekly run" for the scheduled job that builds the library and sends sets to TIDAL and not Sync or cron. | lint | No Sync/cron for the weekly run. |
| MUS-014 | Energy tiers shall be Low 1-4, Building 5-7 and High 8-10. | lint | Tier mapping boundaries are 1-4, 5-7, 8-10. |
| MUS-015 | Tier boundaries shall be drawn as gaps in EnergyBar. | dom | EnergyBar has gaps after segments 4 and 7. |
| MUS-016 | Tier boundaries shall be drawn as chart-grid bands at 4.5 and 7.5 in EnergyWave. | dom | EnergyWave has bands at 4.5 and 7.5. |
| MUS-017 | Set shape names shall be Journey (two peaks), Peak time (three waves), Warm-up opener, Closing and Steady groove. | lint | Shape labels equal the five names. |
| MUS-018 | The target wave of a set shape shall be drawn dashed (chart-ref) behind the slot bars. | dom | Target wave path has dash and chart-ref colour, drawn before bars. |
| MUS-019 | SongNodes path builder presets shall be refitted to reproduce the Naarm Set Builder numeric curves and shall not be tuned by hand. | judgement | Preset outputs equal the Naarm curves. |
| MUS-020 | Within a set, energy shall climb by +1 at a time and may hold (+0) for any number of slots. | judgement | Generated sets climb at most +1 per transition. |
| MUS-021 | A climb of +2 or more in one transition shall be flagged as a clash with the message "energy +2: too steep, step up one at a time". | judgement | +2 energy transition returns clash with that message. |
| MUS-022 | After a peak, a drop of 2-3 points at once shall be rated perfect ("drop −3: trough reset"). | judgement | Drop of 2+ returns perfect. |
| MUS-023 | A single -1 energy drop shall be rated compatible. | judgement | -1 once returns compatible. |
| MUS-024 | A second -1 in a row shall be flagged possible with the message "second −1 in a row: drop 2–3 at once instead". | judgement | Second consecutive -1 returns possible with that message. |
| MUS-025 | Genre switches shall happen in the Building tier after a run of three or more tracks in the current genre. | judgement | Generated genre switches occur at energy 5-7 after 3+ same-genre tracks. |
| MUS-026 | Locked slots shall never move and rebuilds shall fill around them. | judgement | Rebuild leaves locked slots in place. |
| MUS-027 | A TransitionNote shall judge energy, key, BPM and genre and show the worst verdict as its overall CompatibilityBadge. | dom | TransitionNote badge equals worst of four dimensions. |
| MUS-028 | A TransitionNote shall show each dimension as text in the form "energy +1 · +1 key · +2 BPM · House → Techno". | dom | TransitionNote text lists the four dimensions. |
| MUS-029 | Key compatibility shall be perfect for the same key or relative A↔B, compatible for ±1 on the same letter, possible for +2 or +7 on the same letter, and clash otherwise. | lint | SongNodes.compat returns these verdicts for sample pairs. |
| MUS-030 | BPM compatibility shall be perfect for a gap ≤ 2, compatible for 3-4, possible for 5-8 and clash for > 8. | lint | bpmStep returns these verdicts at 2,3,4,5,8,9. |
| MUS-031 | Genre compatibility shall be perfect for the same genre, compatible for a switch in the Building tier after 3+ tracks, possible for a switch elsewhere, and genre alone shall never clash. | lint | Genre dimension never returns clash. |
| MUS-032 | Missing key, BPM or energy data shall show "unknown" with "?" (e.g. "key ?") and shall not count as a clash. | dom | Missing value displays "?" and verdict is not clash. |
| MUS-033 | Unknown values shall be shown in fg-3 with an "Add key" action where editable. | dom | Unknown key renders fg-3 and an Add key action when editable. |
| MUS-034 | Every verdict shall show a glyph and a word. | dom | Each verdict element contains glyph and word. |
| MUS-035 | Verdict colour shall come from compat-* tokens and be the same traffic light in every theme. | lint | Verdict colours use compat-* tokens in all themes. |
| MUS-036 | Rotation High shall mean heard on 2 or more different shows in the run window, or on the ARIA Club Chart for 4 weeks or fewer. | judgement | Rotation calculation applies the stated High rule. |
| MUS-037 | Rotation High shall display as a CategoryTag with brand-soft emphasis, Standard as a neutral CategoryTag, and Vault as a neutral CategoryTag sorted last. | dom | Tag emphasis and sort match the table. |
| MUS-038 | Rotation Standard shall mean everything else that has been heard. | judgement | Heard tracks not High/Vault are Standard. |
| MUS-039 | Rotation Vault shall mean not heard for longer than the learned gap threshold. | judgement | Tracks beyond threshold are Vault. |
| MUS-040 | Rotation shall be calculated by the weekly run from the library's own play data and never hard-coded. | judgement | No hard-coded rotation values. |
| MUS-041 | The library page shall show the rotation values the run used in the Disclosure "How rotation is worked out". | dom | Disclosure exists and prints the run values. |
| MUS-042 | The High/Standard rule shall be refitted if the owner's own rotation calls stop matching it. | judgement | Rule reproduces the owner's rotation calls. |
| MUS-043 | The Vault threshold shall be learned, once 8 or more weeks of history exist, as the larger of the 90th percentile of repeat-play gaps and 3× the median show cadence, and nothing shall move to Vault before then. | judgement | Fewer than 8 weeks gives no Vault; otherwise threshold = max(p90, 3×median). |
| MUS-044 | Copy shall not print a fixed rotation threshold and shall quote the values the latest run computed. | judgement | No literal threshold in copy; values from the run. |
| MUS-045 | Rotation shall be a category and never a status, with no green, amber or red. | dom | Rotation tags use no status colours. |
| MUS-046 | Pillars shall be House, Techno and UK garage shown as neutral CategoryTags. | dom | Pillar tags are neutral. |
| MUS-047 | The genre mix control shall set weights 0.00-1.00 with two decimals summing to 1.00. | dom | Weights have two decimals and sum to 1.00. |
| MUS-048 | Charts split by pillar shall use chart-1, chart-2 and chart-3 in that order. | lint | Pillar series colours are chart-1..3 in order. |
| MUS-049 | Sources shall be shown by group as the sources table specifies (SourceBadge for radio, charts, tracklists, video/audio and stores; IDs only for metadata). | judgement | Source display matches table. |
| MUS-050 | "Heard on" shall count distinct shows, not plays. | judgement | Heard on count equals distinct shows. |
| MUS-051 | "Last heard" shall be the latest play date in Melbourne time. | judgement | Last heard equals latest play date (Melbourne). |
| MUS-052 | The weekly run's last and next time shall be shown with FreshnessStamp using the run's real schedule. | dom | FreshnessStamp shows last and next run. |
| MUS-053 | The weekly run steps shall be shown in StagedProgress as Collect plays, Match tracks, Enrich, Score, Build library, Send sets to TIDAL. | dom | StagedProgress steps equal the six steps in order. |
| MUS-054 | The default graph node fill shall be set by the "Colour by" control in GraphControls: Neutral (default, fg-2), Energy (energy-1…10), Key (key-* colours) or Genre (chart-1…8), and the legend shall change with the mode. | dom | Fill and legend follow the Colour by mode. |
| MUS-055 | Only graph node states shall carry colour in Neutral mode. | visual | Neutral mode nodes are fg-2 apart from state rings. |
| MUS-056 | A hovered graph node shall have a 1.5px fg ring and show its label. | visual | Hover node has 1.5px fg ring and label. |
| MUS-057 | A selected graph node shall have a 2px brand ring and its label. | visual | Selected node has 2px brand ring and label. |
| MUS-058 | The now-playing graph node shall have a 3px amber now ring and a "Now" tag, with one at a time. | visual | Exactly one node has 3px now ring and Now tag. |
| MUS-059 | A graph node in a path shall have a mod-paths ring. | visual | Path nodes have mod-paths ring. |
| MUS-060 | Waypoint, start and finish graph nodes shall use a mod-paths fill with a map-pin label, with start and finish labelled "Start" and "Finish" in text. | visual | Waypoint nodes use mod-paths fill and labels. |
| MUS-061 | Graph nodes outside the filter or selection shall use opacity-faded. | visual | Out-of-filter nodes use opacity-faded. |
| MUS-062 | Graph edge types (adjacency, similarity, collaboration, genre, key_compatibility) shall be distinguished by stroke pattern. | visual | Each edge type has a distinct dash pattern. |
| MUS-063 | Graph edge weight shall map to width 1-4px and opacity up to opacity-edge (0.9 for strong). | visual | Edge width within 1-4px; strong edge opacity 0.9. |
| MUS-064 | Recommendation scores shall be 0-100 (normalise 0-1 ×100). | lint | All scores are 0-100. |
| MUS-065 | Recommendation score bands shall be ≥ 80 Excellent match (perfect), 60-79 Good match (compatible), 40-59 Workable with care (possible) and < 40 Hard mix (clash). | lint | Banding function returns these bands at 80,60,40. |
| MUS-066 | Lists shall show the score band word and detail views shall show the number and its breakdown (harmonic, BPM, energy, genre, played together). | dom | List shows band word; detail shows number and breakdown. |
| MUS-067 | Recommendations shall be sorted by score with ties broken by "played together" count. | lint | Sort comparator uses score then played-together. |
| MUS-068 | Data confidence high shall map to status ok ● "High confidence", medium to fair ◐ "Medium confidence" and low to warn ▲ "Low confidence". | lint | Mapping matches the confidence table. |
| MUS-069 | Medium confidence shall be shown with its number in detail (e.g. "Medium confidence (0.64)"). | dom | Detail shows number with medium label. |
| MUS-070 | Low confidence rows shall be flagged and sent to the review queue. | judgement | Low-confidence rows flagged and queued. |
| MUS-071 | Confidence numbers shall be 0.00-1.00 with two decimals. | lint | Confidence displayed with two decimals within 0-1. |
| MUS-072 | The backend shall assign the confidence band and the UI shall never re-band a number. | judgement | UI uses backend band when provided. |
| MUS-073 | Where only a confidence number arrives, ≥ 0.80 shall be high, 0.50-0.79 medium and < 0.50 low until thresholds are fitted to review-queue decisions. | lint | Fallback banding matches 0.80/0.50. |
| MUS-074 | Every raw backend status enum shall be mapped through SongNodes.status(raw) and the raw value shall never be printed. | lint | No UI prints a raw enum; all go through status(). |
| MUS-075 | The status mapping shall follow STATUS_MAP in the backend statuses table (raw enum → status, glyph, label). | lint | status() output equals the table for every row. |
| MUS-076 | An unmapped raw status shall map to info with glyph i and the raw value, and a mapping shall be added in a minor release. | lint | status("zzz") returns info with raw text. |
| MUS-077 | ValidationSeverity warning shall map to warn "Warning" and info to info "Note". | lint | status("warning") and status("info") return those. |
| MUS-078 | TaskPriority values shall pass through a separate priority() mapping shown as neutral CategoryTags ("Low", "Medium", "High") and never through status(). | lint | Priority UI uses priority() and CategoryTag. |
| MUS-079 | A critical priority shall be shown as a StatusPill bad ✕ "Critical". | dom | critical renders StatusPill bad Critical. |
| MUS-080 | The genre mix control shall be a SliderGroup of relative weights 0.00-1.00 with two decimals and the resulting share of each pillar shown; the weights are not required to sum to 1.00. | dom | Weights have two decimals, a share is shown per pillar and no total is enforced. |
