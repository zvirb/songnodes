export interface PromptParams {
  genre: string;
  djsOrEvents: string;
  dateRange: string;
  count: number;
  exclusions: {
    existingSetlists: string[]; // DJ + Event + Date
    existingTracks: string[]; // Artist - Title
    localLedger: string[];
    userExtra: string;
  };
}

export function buildPrompt(params: PromptParams): string {
  const { genre, djsOrEvents, dateRange, count, exclusions } = params;

  let exclusionsBlock = '';
  const totalExistingSetlists = exclusions.existingSetlists.length + exclusions.localLedger.length;

  // Truncate existing setlists for prompt if too long
  const MAX_SETLIST_EXCLUSIONS = 200;
  const allSetlistExclusions = [...exclusions.existingSetlists, ...exclusions.localLedger];
  const truncatedSetlists = allSetlistExclusions.slice(0, MAX_SETLIST_EXCLUSIONS);
  const setlistsTruncatedBy = Math.max(0, allSetlistExclusions.length - MAX_SETLIST_EXCLUSIONS);

  // Truncate existing tracks for prompt if too long
  const MAX_TRACK_EXCLUSIONS = 500;
  const truncatedTracks = exclusions.existingTracks.slice(0, MAX_TRACK_EXCLUSIONS);
  const tracksTruncatedBy = Math.max(0, exclusions.existingTracks.length - MAX_TRACK_EXCLUSIONS);

  if (truncatedSetlists.length > 0 || truncatedTracks.length > 0 || exclusions.userExtra) {
    exclusionsBlock = `\nEXCLUSIONS:\nDo not return any setlist or track that closely matches the following:\n`;

    if (exclusions.userExtra) {
      exclusionsBlock += `\nUser-specified exclusions:\n${exclusions.userExtra}\n`;
    }

    if (truncatedSetlists.length > 0) {
      exclusionsBlock += `\nAlready in database (Setlists):\n${truncatedSetlists.join('\n')}`;
      if (setlistsTruncatedBy > 0) {
        exclusionsBlock += `\n...and ${setlistsTruncatedBy} more older setlists.`;
      }
      exclusionsBlock += '\n';
    }

    if (truncatedTracks.length > 0) {
      exclusionsBlock += `\nAlready in database (Tracks):\n${truncatedTracks.join('\n')}`;
      if (tracksTruncatedBy > 0) {
         exclusionsBlock += `\n...and ${tracksTruncatedBy} more tracks.`;
      }
      exclusionsBlock += '\n';
    }
  }

  return `Find ${count} real, publicly documented DJ setlists.
What to find:
- Genre/Style: ${genre || 'Any'}
- DJs or Events: ${djsOrEvents || 'Any'}
- Date Range: ${dateRange || 'Any'}

Rules:
1. Return ONLY real, publicly documented setlists.
2. Provide a valid HTTP(S) source URL for each setlist in the \`source_url\` field.
3. Never invent or hallucinate tracks or sources.
4. Setlists must have at least 5 tracks. If you are unsure, return fewer setlists rather than fabricating them.
5. Provide the exact JSON format below. Do not add markdown code fences, just the raw JSON.
6. Say nothing outside the JSON.

Expected JSON Schema (songnodes.setlists.v1):
{
  "schema": "songnodes.setlists.v1",
  "setlists": [
    {
      "dj": "DJ Name",
      "event": "Event Name",
      "date": "YYYY-MM-DD or null",
      "venue": "Venue Name or null",
      "genre": "Genre or null",
      "source_url": "https://...",
      "tracks": [
        {
          "position": 1,
          "artist": "Artist Name",
          "title": "Track Title",
          "mix": "Mix Name or null",
          "label": "Label or null"
        }
      ]
    }
  ]
}
${exclusionsBlock}`;
}
