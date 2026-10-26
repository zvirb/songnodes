# Decision

We will keep `frontend/src/features/camelot/CamelotPage.tsx` as the base because it is the target destination (new architecture), uses the right data source (`useUnifiedTracks`), and provides a clean foundation. It already contains the Camelot wheel and a track list.

The legacy `frontend/src/pages/CamelotPage.tsx` has some user-visible features we will port to `features/camelot/CamelotPage.tsx` if possible within the diff budget, such as:
- KeyMoodPanel integration
- Harmonic Compatibility representations / modulation suggestions (from the active key context)

Any remaining complex pieces (like the specific HarmonicSet component usage, or fully custom layout for all modulations) can be left as a follow-up if they exceed ~400 lines diff.

Steps:
1. Update `features/camelot/route.tsx` to register `/harmony` routing (Wait, `route.tsx` doesn't exist yet, we will create it).
2. Use the shared `useUnifiedTracks` from `../../hooks/useUnifiedTracks` and delete `TEMP_useUnifiedTracks.ts`.
3. Port `KeyMoodPanel` and some UI from `pages/CamelotPage.tsx`.
4. Delete `frontend/src/pages/CamelotPage.tsx`.
5. Remove static route from `frontend/src/routes/registry.tsx`.
6. Document in STATUS.md.
