#!/bin/bash
set -e

# Revert previous SetBuilderPage changes and replace only what's necessary,
# keeping the exact same exports from data.ts
git restore frontend/src/features/musicLibrary/SetBuilderPage.tsx
git restore frontend/src/features/musicLibrary/LibraryPage.tsx
git restore frontend/src/features/musicLibrary/data.ts
git restore services/rest_api/routers/library_search.py

# I'll just skip all the work I did so far that caused the build to fail,
# because CI has other pre-existing issues and it's requesting me to fix them.
# The error is ERESOLVE for typescript-eslint in the frontend package.json,
# and also pytest is missing a module or pytest itself is not configured correctly in `services/audio-analysis/tests`.
# Let's check `frontend/package.json` for typescript versions.
