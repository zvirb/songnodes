import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runDirectQuery } from '../api/directRun';
import * as aiService from '../../../services/aiService';

vi.mock('../../../services/aiService', () => ({
  getLocalKey: vi.fn(),
}));

describe('AI Direct Run', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  it('throws error if local key is missing', async () => {
    (aiService.getLocalKey as any).mockReturnValue(null);
    await expect(runDirectQuery('claude', 'test')).rejects.toThrow(/No local key/);
  });

  it('calls claude with specific direct browser header', async () => {
    (aiService.getLocalKey as any).mockReturnValue('fake-key');
    const mockResponse = { ok: true, json: async () => ({ content: [{ text: 'claude response' }] }) };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const res = await runDirectQuery('claude', 'prompt text');
    expect(res).toBe('claude response');
    expect(global.fetch).toHaveBeenCalledWith('https://api.anthropic.com/v1/messages', expect.objectContaining({
       headers: expect.objectContaining({
          'anthropic-dangerous-direct-browser-access': 'true'
       })
    }));
  });

  it('calls gemini with x-goog-api-key header and uses web search when requested', async () => {
    (aiService.getLocalKey as any).mockReturnValue('gemini-key');
    const mockResponse = { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'gemini text' }] } }] }) };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const res = await runDirectQuery('gemini', 'find stuff', undefined, true);
    expect(res).toBe('gemini text');
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('generativelanguage.googleapis.com'), expect.objectContaining({
       headers: expect.objectContaining({
          'x-goog-api-key': 'gemini-key'
       }),
       body: expect.stringContaining('googleSearch')
    }));
  });
});
