# SettingsPage

The Services module page: connect streaming services, manage API keys, set preferences and move your data in and out, all on one page.

## When to use / not use
`/settings` is one page (decided: no sub-pages or tabs) with an anchor link per section: `#services`, `#keys`, `#preferences`, `#data`. The danger zone sits at the end of `#data` and About at the page foot, neither with its own anchor. Preferences also opens from the header More menu as the floating `PreferencesPanel`; this page embeds the same panel.

## Anatomy
| Region | Component | Notes |
|---|---|---|
| Header | `PageHeader` services band, "Services: **Settings**", attention `StatusPill` ("TIDAL needs a sign-in"), `OverflowMenu` (Export settings as JSON, Show keyboard shortcuts) | No primary in the header: each section saves itself |
| Section list | In-page `TextLink`s (services colour), sticky, desktop only | `.sn-page-settings__toc` |
| Services (`#services`) | `ServiceStatus` × 3: Spotify connected (Disconnect), TIDAL expired (Reconnect TIDAL in `svc-tidal`), Beatport not connected (Connect Beatport) | |
| API keys (`#keys`) | `SecretField` × 3 in flat cards: saved and working, saved and refused (401, what to do), not set (entry with reveal); "Save API keys" | 2-up from 768px |
| Preferences (`#preferences`) | `PreferencesPanel` embedded (no close button, resting shadow): theme, text size, density, reduce motion via `SongNodes.prefs` incl. `prefs.setMotion` | Applies live |
| Data (`#data`) | Export buttons (CSV, JSON) + `FileDrop` "Import sets or target tracks" with a parsed file row | |
| Danger zone (end of Data) | Rows with a sentence naming the consequence and a secondary button ending "…"; each opens `ConfirmDialog` (typed confirmation "delete 12 sets" for deleting all sets) | Danger styling only inside the dialog |
| About (page foot) | `KeyValueGrid`: version (`SongNodes.version`), library data stamp, source link | |

## Data
`SettingsPageProps`: connections, API keys (masked tails and last test), version, handlers for connect, test, export, import, danger actions.

## States
- First load: ServiceStatus and SecretField rows as skeletons; Preferences render at once (local).
- Testing a key: button busy "Testing…", status `StatusPill` running, then works/refused with a stamp.
- Empty: no keys yet → each SecretField starts in entry mode with its help line.
- Error: per service row (`ServiceStatus` error with retry time); an import error stays on the file row.
- Offline: connect and test are disabled with "Reconnect to the internet to connect services" (`aria-disabled` + description); Preferences still work.

## Responsive
≥1100px: 220px section list + content. Below: stacked sections, connect buttons drop under the text, keys 1-up on phones. Wall: capped at 1400px. Booth: same order, larger type.

## Primary action
None in the header; per section: Connect/Reconnect, Save API keys, Import.

## Replaces
`SettingsPanel` and `APIKeyManager` overlays, the "Spotify" and "TIDAL" tabs used for connecting, and the `confirm()` used for destructive actions.
