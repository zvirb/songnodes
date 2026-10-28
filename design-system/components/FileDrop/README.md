# FileDrop

A visible drop zone with a "Choose file" button for importing set JSON, target-track JSON or tracklist .txt/.csv files, stating accepted types and size, then listing each file with its parse result or error and a remove button.

## When to use / not use
Use for imports from a file on disk. For pasted text use TracklistPaste; for photos use PhotoCapture.

## Anatomy & markup
```html
<div class="sn-file-drop">
  <span class="sn-file-drop__label" id="l">Import tracklists</span>
  <div class="sn-file-drop__zone">                       <!-- data-dragover while dragging -->
    <svg class="sn-icon">upload</svg>
    <div class="sn-file-drop__zone-text"><strong><span class="sn-file-drop__drag">Drag files here, or choose them</span></strong>
      <span class="sn-file-drop__accept" id="h">.txt or .csv, one track per line, up to 2 MB each</span></div>
    <input type="file" class="sn-sr sn-file-drop__input" id="f" accept=".txt,.csv" multiple aria-labelledby="l b" aria-describedby="h">
    <label for="f" class="sn-btn sn-btn--sm sn-file-drop__choose" id="b">Choose files</label>
  </div>
  <ul class="sn-file-drop__files" aria-label="Selected files">
    <li class="sn-file-drop__file"> icon · <div class="sn-file-drop__name"><b>name</b><span class="sn-file-drop__size">2 KB</span></div> · remove
      <div class="sn-file-drop__result">pill + summary</div></li>
  </ul>
</div>
```
The real `<input type="file">` stays in the tab order (visually hidden); its focus ring shows on the Choose button.

## States
Idle (dashed `line-strong`), drag-over (`data-dragover`: solid `brand` border, `brand-soft` fill, "Drop to add the file"), reading (`running` pill, neutral progress bar), read (`ok` pill + summary "14 tracks: 12 in library, 2 new"), error per file (`data-error`: `status-bad` border and message), removed (announced).

## Content rules (GOV.UK file upload)
"The selected file must be a .txt or .csv file." · "The selected file must be smaller than 2 MB." · "The selected file is empty." · "This file isn’t valid JSON. Export it again from SongNodes." Name the next step when there is one. Sizes "18 KB", "3.3 MB".

## Accessibility
Drag and drop is never the only way; the button works by keyboard and on touch. Each added or removed file is announced politely. Remove buttons are named "Remove <file name>"; after removal focus moves to the next file or the Choose button.

## Responsive
On phones the zone is just the button and the accepted-types line (no drag hint). File rows wrap long names anywhere.

## Do / don't
- Do validate type and size before uploading, and parse before importing.
- Don't clear the list after an error; let people remove the bad file and keep the rest.

## In SongNodes / in the music library
Replaces the JSON import in `TargetTracksManager.tsx` and set import in `SetlistBuilder`. In the music library: importing saved sets and weekly radio tracklists.
