# SecretField

Entry and management of an API key or client secret: a saved key is only ever shown masked ("sk-…3f9a"), a new key is typed masked with a reveal toggle, and "Test key" reports the result as a pill with a last-tested stamp.

## When to use / not use
Use for third-party credentials in Services: Spotify client secret, setlist.fm, Discogs, YouTube, Last.fm keys. Not for passwords to SongNodes itself (use the browser's password field with `autocomplete="current-password"`).

## Anatomy & markup
```html
<div class="sn-secret-field">
  <div class="sn-secret-field__head"><span class="sn-secret-field__label" id="k-l">Setlist.fm API key</span>
    <a class="sn-link sn-link--ext" href="…" target="_blank" rel="noopener">Get an API key</a></div>
  <!-- saved -->
  <div class="sn-secret-field__row"><div class="sn-secret-field__saved"><svg class="sn-icon">lock</svg> sk-…3f9a</div>
    <button class="sn-btn">Test key</button><button class="sn-btn sn-btn--quiet">Replace key</button></div>
  <!-- editing -->
  <div class="sn-secret-field__row"><div class="sn-secret-field__box">
    <input class="sn-input" type="password" autocomplete="off" spellcheck="false">
    <button class="sn-secret-field__reveal" aria-pressed="false" aria-label="Show key">eye</button></div>
    <button class="sn-btn">Test key</button><button class="sn-btn sn-btn--quiet">Cancel</button></div>
  <div class="sn-secret-field__status" aria-live="polite"><span class="sn-pill" data-status="ok">Key works</span>
    <span class="sn-secret-field__stamp">Last tested 24 Oct 2026, 06:00 AEDT</span></div>
</div>
```
(Icons come from `SongNodes.icon()`: lock, eye, eye-off.)

## States
Saved (dashed box, lock icon, last 4 characters only), editing (masked, reveal toggle eye / eye-off), testing (button `aria-busy`, spinner, "Testing…", pill "Testing"), works (`ok` pill), refused (`bad` pill + the service's reason and the next step), not tested (`idle` pill "Not tested").

## Content rules
Mask as the service prefix plus "…" plus the last 4 ("sk-…3f9a", "…77c2"). Results: "Key works"; "Key refused" + "Spotify returned 401 invalid_client. Copy the secret again from the dashboard." Stamps use the full Melbourne time. The help link names the destination: "Get an API key", "Open Spotify dashboard".

## Accessibility
The reveal button is a toggle (`aria-pressed`) whose name changes "Show key"/"Hide key". Test results land in a polite live region. Screen readers hear "Saved key ending 3 f 9 a". Never put the key in a URL, title or log.

## Responsive
Row wraps: the box takes the remaining width, buttons follow. Reveal is 44px on touch.

## Do / don't
- Do let people replace a key without seeing the old one.
- Don't send the full saved key back to the browser; the server returns the mask.
- Don't auto-test on every keystroke; test on demand or on save.

## In SongNodes / in the music library
Replaces the key inputs in `APIKeyManager.tsx` and the service credentials in `SettingsPanel.tsx`. In the music library: TIDAL and Deezer credentials for the weekly run.
