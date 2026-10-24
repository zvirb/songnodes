import { describe, expect, it } from 'vitest';
import { parseAttributions } from './attributions';

describe('parseAttributions', () => {
  it('keeps well-formed https attributions', () => {
    const payload = { attributions: [{ provider: 'getsongbpm', text: 'BPM and key data provided by GetSongBPM', url: 'https://getsongbpm.com' }] };
    expect(parseAttributions(payload)).toEqual(payload.attributions);
  });

  it('drops malformed entries, non-https links and unexpected payloads', () => {
    const payload = { attributions: [
      { provider: 'a', text: 'x', url: 'http://insecure.example' },
      { provider: 'b', text: 'x', url: 'javascript:alert(1)' },
      { provider: 'c', text: 'x', url: 'not a url' },
      { provider: 'd', text: 5, url: 'https://ok.example' },
      null,
    ] };
    expect(parseAttributions(payload)).toEqual([]);
    expect(parseAttributions(undefined)).toEqual([]);
    expect(parseAttributions({ attributions: 'nope' })).toEqual([]);
  });
});
