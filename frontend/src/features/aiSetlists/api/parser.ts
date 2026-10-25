import type { AISetlistsResponse, AISetlist } from './schema';

export function parseAndValidate(raw: string): { data: AISetlistsResponse | null, errors: string[] } {
  const errors: string[] = [];

  // 1. Size limit (2 MB)
  if (raw.length > 2 * 1024 * 1024) {
    errors.push('Response exceeds 2 MB limit.');
    return { data: null, errors };
  }

  // 2. Extract first balanced JSON object
  let jsonString = raw;
  const firstBrace = raw.indexOf('{');
  if (firstBrace !== -1) {
    let braceCount = 0;
    let lastBrace = -1;
    for (let i = firstBrace; i < raw.length; i++) {
      if (raw[i] === '{') braceCount++;
      if (raw[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          lastBrace = i;
          break;
        }
      }
    }
    if (lastBrace !== -1) {
      jsonString = raw.substring(firstBrace, lastBrace + 1);
    }
  }

  // 3. Parse safely
  let data: any;
  try {
    data = JSON.parse(jsonString);
  } catch (e) {
    errors.push('Invalid JSON format.');
    return { data: null, errors };
  }

  // 4. Validate schema
  if (data?.schema !== 'songnodes.setlists.v1') {
    errors.push('Missing or invalid schema version. Expected songnodes.setlists.v1.');
    return { data: null, errors };
  }

  if (!Array.isArray(data?.setlists)) {
    errors.push('Missing setlists array.');
    return { data: null, errors };
  }

  const validSetlists: AISetlist[] = [];

  data.setlists.forEach((setlist: any, index: number) => {
    const context = `Setlist ${index + 1} (${setlist.dj || 'Unknown DJ'} @ ${setlist.event || 'Unknown Event'})`;

    if (!setlist.source_url || !setlist.source_url.startsWith('http')) {
      errors.push(`${context}: Missing or invalid source_url.`);
      return;
    }

    if (!Array.isArray(setlist.tracks) || setlist.tracks.length < 5) {
      errors.push(`${context}: Must have at least 5 tracks.`);
      return;
    }

    let trackValid = true;
    for (let i = 0; i < setlist.tracks.length; i++) {
      const t = setlist.tracks[i];
      if (!t.artist || !t.title || typeof t.position !== 'number') {
        errors.push(`${context}, Track ${i + 1}: Missing artist, title, or position.`);
        trackValid = false;
        break;
      }
    }

    if (trackValid) {
      validSetlists.push(setlist);
    }
  });

  return {
    data: { schema: 'songnodes.setlists.v1', setlists: validSetlists },
    errors
  };
}
