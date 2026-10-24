# LoadingState

The single loading idiom: skeletons shaped like the content on first load, a slim top line and "Updating…" stamp when refreshing data that is already shown, and the `sn-spinner` only inline.

## When to use
| Wait | Show |
|---|---|
| Under 1 s | Nothing (no flash of skeleton; render skeleton only if data is not back within ~300 ms, then keep it for at least 500 ms) |
| First load, content-shaped | Skeleton rows (`sn-table` rows with `sn-skel`) or tiles; after 1 s add the message "Loading 1,284 tracks…" |
| Refresh of visible data | Keep the data, show `__bar` along the top of the panel and "Updating…" in the freshness stamp |
| A button's own action | `sn-spinner` inside the button, label becomes the ongoing verb ("Saving set…") |
| Over ~10 s or several steps | StagedProgress, not a skeleton |
Never a centred spinner for more than one row, never a blank panel.

## Anatomy
```html
<div class="sn-loading-state" aria-busy="true" data-slow>   <!-- data-slow set by a 1 s timer -->
  <div class="sn-tablebox"><table class="sn-table">…same thead…
    <tr aria-hidden="true"><td><span class="sn-skel" style="--w:64px;--h:12px"></span></td>…</tr>
  </table></div>
  <p class="sn-loading-state__msg" role="status">Loading 1,284 tracks…</p>
</div>
```
Refresh: wrap the content in `sn-loading-state__frame`, put `<div class="sn-loading-state__bar" aria-hidden="true">` first, set `aria-busy="true"` on `sn-loading-state` while fetching. Stamp: `<span class="sn-loading-state__stamp" aria-live="polite">Updated <time>24 Oct 2026, 06:00 AEDT</time></span>`. Inline: `sn-loading-state__inline` with a 14px `sn-spinner` + text. Skeleton sizes via `--w` and `--h` on `sn-skel`; `__lines` stacks two lines for a two-line track cell; `__tiles` / `__tile` for card grids.

## States
- First load: skeleton + reserved message line (hidden, so the 1 s message causes no shift).
- Slow (≥ 1 s): message visible; name the count when known.
- Refreshing: data visible and interactive, bar animates, stamp reads "Updating…".
- Done: bar fades out, stamp shows the new time. Failed: keep the data and switch to ErrorState's last-good layout.

## Content rules
"Loading 1,284 tracks…", "Loading 6 saved sets…", "Updating…". Ellipsis character, sentence case, counts with commas. No "Please wait".

## Accessibility
- `aria-busy="true"` on the region while loading; skeleton rows are `aria-hidden`.
- The message line is `role="status"` (polite), and the stamp `aria-live="polite"`, so the start and end are announced once each.
- Reduced motion: skeleton pulse and the top line stop moving (the line becomes a static half-tone bar).

## Responsive
Skeletons follow the real layout at each breakpoint (mobile explorer rows on phones, tiles reflow). The bar spans the panel, not the page.

## Do / don't
- Do reserve the same row height (`row-comfortable` / `row-compact`) so nothing jumps.
- Don't animate real rows in when data arrives; swap in place.
- Don't blank a table to refresh it.

## In SongNodes
Replaces the `animate-spin` circles in TargetTracksManager.tsx and MusicServiceSearch.tsx, the `Loader2` spinners in ArtistAttributionManager.tsx, "Loading..." on the TIDAL refresh button, and LiveDataLoader's full-panel states; `ui/Skeleton.tsx` keeps its role but uses `sn-skel` shapes. Live WebSocket updates use the refresh pattern.

## In the music library
Crate first load (skeleton crate rows), saved-set tiles, weekly-build data refresh with the "Updated 24 Oct 2026, 06:00 AEDT" stamp.
