# TrackDetailPage

Everything about one track: key, tempo, energy, sections, where it was heard, what it plays well with and its IDs.

## When to use / not use
Opened directly at `/track/:id` (or `/library/:trackId`). From a list, the same content opens in a `SideSheet` (`?track=`). Not for editing (Edit track is a `Dialog`).

## Anatomy
| Region | Component | Notes |
|---|---|---|
| Trail | `Breadcrumbs` Library › Bicep › Glue (library colour) | Never starts with Home |
| Header | `PageHeader` "Track: **Bicep – Glue**", band Library › Track detail; primary "Add to set", secondary "Open in graph", `OverflowMenu` (Edit track…, Find a path from here, Copy Spotify link, Flag for an energy check) | |
| Identity | `Card` row: `KeyBadge --lg` with name, `BpmReadout --lg`, `EnergyBar --lg` with tier, length, `SourceBadge` saying where the values came from | `.sn-page-track__identity` |
| Audio | `ChartFrame` + `WaveformStrip`: intro/outro, breakdowns, vocal lane, cues A–D, energy curve | |
| Heard on | `ChartFrame` table: `SourceBadge` per source + `Sparkline` plays per week (12 weeks), total, last heard | |
| Plays well with | `SectionHeading` + `DataTable --stack`: `TrackCell` linking to each track, edge type `CategoryTag` with icon, weight (sets or strength), `KeyBadge` + `CompatibilityBadge`, BPM, `EnergyBar` | Strongest first |
| Raw data | `Disclosure` with a `KeyValueGrid` of values per source | Shows disagreements |
| Aside | `CamelotWheel` (now key ring, dashed compatible keys) + compatible keys list and a Key & mood link; `KeyValueGrid` identifiers with `CopyButton`s (ISRC, Spotify ID, TIDAL ID, Beatport ID, missing Discogs as `sn-none`); sets containing it (`TextLink` sets colour); service links (`TextLink --ext`) | `.sn-page-track__aside` 360px |

## Data
`TrackDetailPageProps`: track with IDs and `valuesFrom`, analysis, weekly plays per source, connected tracks with edges, sets, raw values.

## States
- First load: identity row and KeyValueGrid as `sn-skel`; waveform frame with a skeleton band.
- Refresh: values stay; `FreshnessStamp` in the header meta updates.
- Empty: no analysis yet → waveform replaced by `EmptyState` "Not analysed yet" + "Queue audio analysis"; no connections → "No connections yet. Import a tracklist that includes it."
- Error: per region (waveform, plays, connections), each with its own `ErrorState`.
- Offline: cached detail with stamp; Add to set queues locally.

## Responsive
≥1100px: main column + 360px aside. Below: one column, aside after Raw data; connected tracks become stacked cards below 600px; the heard-on table scrolls inside its box. Wall: capped at 1400px. Booth: same content, larger type.

## Primary action
"Add to set".

## Replaces
`TrackDetailsModal`, the "Track analysis" and "Key & mood" tabs, `EditTrackModal` entry point, and the separate `CamelotWheel.tsx` / `camelotData.ts` colours.
