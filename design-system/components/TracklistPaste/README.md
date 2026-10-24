# TracklistPaste

A paste box for a tracklist with a live preview table that shows how each line was read (in library, new, not read) and an Import button that stays disabled until at least one line parses.

## When to use / not use
Use to import a radio show, DJ set or chart pasted from a website or notes. For files use FileDrop. For a single track use search.

## Anatomy & markup
```html
<div class="sn-tracklist-paste">
  <div class="sn-tracklist-paste__cols">
    <div class="sn-field"><label for="tl">Tracklist</label>
      <textarea class="sn-textarea sn-tracklist-paste__input" id="tl" spellcheck="false"></textarea>
      <details class="sn-tracklist-paste__formats"><summary>Supported formats</summary><ul>…</ul></details></div>
    <div class="sn-tracklist-paste__preview">
      <div class="sn-tracklist-paste__summary">9 lines: pills</div>
      <div class="sn-tablebox sn-tracklist-paste__table"><table class="sn-table">Line · Track · Status</table></div>
    </div>
  </div>
  <div class="sn-tracklist-paste__foot"><span class="sn-tracklist-paste__why"></span> Clear · <button class="sn-btn sn-btn--primary">Import 7 tracks</button></div>
</div>
```
Rows carry `data-row="matched|new|unparsed"`; not-read rows use the `flag-bg` fill and show the raw line and the reason.

## Parsing rules
Per line: drop timestamps (`[00:00]`, `01:02:30`) and numbering (`1.`, `05`, `3)`); keep a trailing `[Label]`; split on " – ", " — " or " - " (artist first) or on " by " (title first); read `ft.`, `ft`, `feat` and `featuring` as "feat."; "ID – ID" is not read (unreleased). Blank lines and separator lines are ignored. Match against the library on artist (without features) and title, ignoring case and dash type.

## States
Empty ("Paste a tracklist on the left…"), parsed (summary pills: `ok` "5 in library", `info` "2 new", `warn` "2 not read"), nothing parseable (Import disabled with the reason), importing (Import `aria-busy`).

## Content rules
Statuses: "In library", "New", "Not read". Reasons: "No “ – ” or “by” between artist and title", "Unreleased track (ID – ID)". Button: "Import 7 tracks" (count of in-library plus new). Footer note: "2 not-read lines are skipped. Edit them on the left to include them."

## Accessibility
The preview updates live; a summary ("7 tracks read, 2 lines not read") is announced politely after typing pauses. The disabled Import button is described by the reason text. The formats help is a native `<details>`.

## Responsive
Container query: below 640px the preview stacks under the textarea. The table scrolls inside its box (max 300px tall).

## Do / don't
- Do keep what the person pasted; never rewrite the textarea.
- Don't import not-read lines as tracks with empty artists.

## In SongNodes / in the music library
Replaces `TracklistImporter.tsx` (its "🔍 Parse Tracklist" step becomes the live preview). In the music library: adding PBS, 3RRR and triple j show tracklists each week.
