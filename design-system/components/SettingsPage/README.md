# SettingsPage

The Services module page: connect streaming services, manage API keys, set preferences and move your data in and out via individual card modules and sub-routes.

## Overview and routing
Settings is structured into a two-tier navigation pattern:
1. **Settings overview (`/settings`)**: A card grid overview displaying all setting categories as distinct `Card` modules, equipped with a top-level `SearchField` to instantly filter setting cards by title, description, eyebrow lead, or search keywords.
2. **Individual setting page (`/settings/:settingId`)**: A dedicated focus page for inspecting and configuring a single setting category (`streaming-services`, `api-keys`, `display-preferences`, `data-storage`, `about-system`), offering clear back navigation via `PageHeader` quiet action and a card-foot return link (`← Back to all settings`).

Preferences also opens globally from the header More menu as the floating `PreferencesPanel`; the settings page embeds or routes to the same controls.

## Anatomy
| Region | Component | Notes |
|---|---|---|
| Header | `PageHeader` services band, "Services: **Settings**" (or specific setting title on `/settings/:settingId`), with quiet back action on detail pages | |
| Search field (`/settings`) | `SearchField` for filtering settings cards live with keyboard shortcut support (`/` or `Cmd+K`) | Max width 560px above card grid |
| Card overview grid (`/settings`) | Responsive grid (`grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))`) of neutral `Card` components | Each card has eyebrow lead, title, body description, control preview, and `Card` foot link (`Open setting page →`) |
| Setting detail view (`/settings/:settingId`) | Focused `Card` (max-width 720px) rendering controls for the specific setting ID | Includes eyebrow lead, title, description, interactive controls, and return link (`← Back to all settings`) |
| Streaming connections (`streaming-services`) | Spotify & TIDAL OAuth status, status badges, and connect/disconnect actions | Registered in `/settings/streaming-services` |
| API keys (`api-keys`) | `SecretField` inputs with mask reveal, test key handlers, and validation badges for scrapers/services | Registered in `/settings/api-keys` |
| Display preferences (`display-preferences`) | Theme, text size, density, motion controls applying live via `SongNodes.prefs` | Registered in `/settings/display-preferences` |
| Data storage & Danger zone (`data-storage`) | Saved credential clear and preferences reset buttons triggering `ConfirmDialog` modals | Registered in `/settings/data-storage` |
| About system (`about-system`) | `KeyValueGrid` displaying design system version, locale, time zone, and API endpoint | Registered in `/settings/about-system` |

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

## Recommendations for navigation and accessibility
To further rectify and standardize navigation flow and accessibility across setting cards and similar views in SongNodes, the following design system improvements should be implemented:

1. **Back navigation from sub-routes**:
   - Every sub-route detail page (e.g. `/settings/:settingId`) must provide dual back-navigation controls: a `PageHeader` quiet action (`Button` kind="quiet" with `SnIcon` `undo-2` or `arrow-left`) and a card-foot return link (`← Back to all settings`).
   - Pressing `Escape` when focus is not inside an active text input or dialog should navigate back to the parent overview page (`/settings`).

2. **Search field and live filtering**:
   - The top overview `SearchField` must expose an `aria-live="polite"` region that dynamically announces search filtering results (e.g. "5 setting cards shown for 'theme'" or "No setting cards found").
   - Clearing search filters via the `EmptyPanel` action or keyboard shortcut must restore focus to the `SearchField` input.
   - Global shortcut `/` or `Cmd+K` / `Ctrl+K` must focus the search input automatically when on the `/settings` page.

3. **Card focus and deep links**:
   - Navigating back from `/settings/:settingId` to `/settings` should return keyboard focus to the card link (`Open setting page →`) of the setting card that was just opened, preventing focus loss to the document root.
   - Setting card URLs (`/settings/streaming-services`, `/settings/api-keys`, `/settings/display-preferences`, etc.) must preserve deep links so users can bookmark or directly share specific setting views.

4. **Splitting large pages**:
   - Evaluate other complex pages (such as `LibraryPage` filter rails, `SetBuilderPage` panels) for decomposition into card-based overview components with deep-linkable sub-routes where complex nested configuration or management is required.

## Replaces
`SettingsPanel` and `APIKeyManager` overlays, the "Spotify" and "TIDAL" tabs used for connecting, and the `confirm()` used for destructive actions.

## Locations (1.4.0)
Exports and imports name the place in words ("Saved to your Downloads folder", "Pipeline output folder"), never a path. A setting whose value is a location (the pipeline output folder on the server) is a `TextField` showing the value being edited, with no copy button; a folder chosen on this device uses the system picker ("Choose folder…"). See 01-writing, *File paths and system locations*.
