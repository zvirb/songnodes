# S3: Music search UI: show the real error

## Objective
Make the music search box show the API's error message instead of a generic one or an empty result, using the Design System's `ErrorPanel` component.

## Changes Made
- Modified `frontend/src/components/MusicServiceSearch.tsx` to handle an array of errors per-service instead of one global message.
- Modified the component to display `ErrorPanel` if a service search fails.
- Modified the UI so partial results can be seen alongside an error warning if one service works while the other fails.
- Wrote frontend test for `MusicServiceSearch` to cover error handling behaviors.
