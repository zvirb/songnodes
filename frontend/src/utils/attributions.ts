/** Provider attributions the interface must display (for example the GetSongBPM backlink once that provider is enabled). */
export interface Attribution {
  provider: string;
  text: string;
  url: string;
}

/** Keep only well-formed https attributions; anything else is dropped rather than rendered as a link. */
export function parseAttributions(payload: unknown): Attribution[] {
  const list = (payload as { attributions?: unknown })?.attributions;
  if (!Array.isArray(list)) return [];
  const result: Attribution[] = [];
  for (const item of list) {
    const { provider, text, url } = (item ?? {}) as Record<string, unknown>;
    if (typeof provider !== 'string' || typeof text !== 'string' || typeof url !== 'string') continue;
    try {
      if (new URL(url).protocol !== 'https:') continue;
    } catch {
      continue;
    }
    result.push({ provider, text, url });
  }
  return result;
}

export async function fetchAttributions(signal?: AbortSignal): Promise<Attribution[]> {
  try {
    const response = await fetch('/api/v1/attributions', { signal });
    return response.ok ? parseAttributions(await response.json()) : [];
  } catch {
    return [];
  }
}
