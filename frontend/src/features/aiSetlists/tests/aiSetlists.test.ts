import { describe, it, expect } from 'vitest';
import { buildPrompt } from '../api/prompt';
import { parseAndValidate } from '../api/parser';
import { dedupe } from '../api/dedupe';

describe('AI Setlists Prompts', () => {
  it('truncates large exclusions and shows a truncation notice', () => {
    const existingSetlists = Array.from({ length: 250 }, (_, i) => `DJ ${i} - Event ${i}`);
    const prompt = buildPrompt({
      genre: 'Techno',
      djsOrEvents: 'Any',
      dateRange: '2020-2023',
      count: 5,
      exclusions: {
        existingSetlists,
        existingTracks: [],
        localLedger: [],
        userExtra: ''
      }
    });

    expect(prompt).toContain('...and 50 more older setlists.');
    expect(prompt).toContain('schema": "songnodes.setlists.v1"');
  });
});

describe('AI Setlists Parser', () => {
  it('extracts JSON from fenced prose and validates', () => {
    const raw = `
      Here is the data you requested:
      \`\`\`json
      {
        "schema": "songnodes.setlists.v1",
        "setlists": [{
           "dj": "A", "event": "B", "date": "2023-01-01", "venue": null, "genre": null, "source_url": "http://x",
           "tracks": [
             {"position": 1, "artist": "Art1", "title": "Tit1", "mix": null, "label": null},
             {"position": 2, "artist": "Art1", "title": "Tit2", "mix": null, "label": null},
             {"position": 3, "artist": "Art1", "title": "Tit3", "mix": null, "label": null},
             {"position": 4, "artist": "Art1", "title": "Tit4", "mix": null, "label": null},
             {"position": 5, "artist": "Art1", "title": "Tit5", "mix": null, "label": null}
           ]
        }]
      }
      \`\`\`
      Enjoy!
    `;

    const result = parseAndValidate(raw);
    expect(result.errors).toEqual([]);
    expect(result.data?.setlists.length).toBe(1);
  });
});

describe('AI Setlists Dedupe', () => {
  it('identifies existing setlists and counts new tracks', () => {
     const setlists = [{
           "dj": "A", "event": "B", "date": "2023-01-01", "venue": null, "genre": null, "source_url": "http://x",
           "tracks": [
             {"position": 1, "artist": "Art1", "title": "Tit1", "mix": null, "label": null},
             {"position": 2, "artist": "Art2", "title": "Tit2", "mix": null, "label": null}
           ]
     }];

     const catalogTracks = [{
         id: '1', artist: 'art1', title: 'tit1',
         mix: null, durationSec: null, bpm: null, key: null, energy: null, genre: null, label: null,
         source: 'backend' as const, isTarget: false, targetPriority: null, tidalUrl: null
     }];

     const res = dedupe(setlists, [], [], catalogTracks);
     expect(res.tracksExisting).toBe(1); // Art1 - Tit1
     expect(res.tracksNew).toBe(1);      // Art2 - Tit2
  });
});
