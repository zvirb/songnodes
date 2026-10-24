# AuthCallbackPage

The page Spotify and TIDAL send you back to after sign-in: it shows progress, then says you are connected or what went wrong.

## When to use / not use
Only at `/callback/spotify` and `/oauth/callback` (TIDAL). No shell: no header, drawer or search, because the window may be a pop-up. Not for any other loading state.

## Anatomy
| Region | Component | Notes |
|---|---|---|
| Wordmark | Text "SongNodes" in `brand` | `.sn-page-auth__wordmark` |
| Processing | `Card` with `StagedProgress`: title with `sn-spinner` "Connecting: **TIDAL**", steps Check the sign-in with TIDAL → Save the connection → Return to Settings, "Keep this window open." | `aria-busy`, polite status line |
| Connected | `Card`: "TIDAL: **Connected**", `ServiceStatus` "Connected to TIDAL as markusz… You can close this window.", `TextLink` "Return to SongNodes" (services colour) + "Returning to Settings in 2 s" | Auto-return after 2 s; the link is there for when it doesn't |
| Error | `ErrorState` bad: "TIDAL did not accept the sign-in", the reason in plain words ("The sign-in link expired… links last 10 minutes"), whether retrying helps, primary "Try again", `TextLink` "Back to Settings" | `role="alert"` |

The preview shows the three states side by side; the real page shows one card at a time, centred, with one `h1`.

## Data
`AuthCallbackPageProps`: provider (from the route), phase, account name, error title and text, auto-return seconds.

## States
Processing (first load), connected, error, as shown. Offline: error card "You’re offline. Reconnect, then try again." Never show raw `code`, `state` or tokens; log them server-side only.

## Responsive
Desktop preview: three columns. Real page and phones: one centred card, max 440px, `space-4` gutter. Booth theme: larger type, same layout.

## Primary action
"Try again" in the error state only; success has a link back, not a button.

## Replaces
`OAuthCallback` and the inline-styled "Loading..." fallback in `App.tsx`, including its emoji and alert text.
