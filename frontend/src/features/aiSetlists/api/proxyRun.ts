import { aiProxyComplete, AIProxyError } from '../../../services/aiProxyClient';
import type { AIProvider } from '../../../services/aiService';
import { DEFAULT_AI_MODELS } from './config';

export const PROVIDER_NAMES: Record<AIProvider, string> = {
  claude: 'Claude',
  openai: 'OpenAI',
  gemini: 'Gemini',
};

/**
 * Runs the setlist prompt through the server AI proxy. The provider key stays on
 * the server; web search is only honoured by Gemini.
 */
export async function runProxyQuery(
  provider: AIProvider,
  prompt: string,
  options: { model?: string; webSearch?: boolean } = {},
): Promise<string> {
  const res = await aiProxyComplete({
    provider,
    model: options.model || DEFAULT_AI_MODELS[provider],
    system: 'You are an expert DJ researcher.',
    prompt,
    max_tokens: 4096,
    web_search: provider === 'gemini' && options.webSearch === true,
  });
  return res.text || '';
}

/** Plain en-AU message for a failed proxy call. */
export function proxyErrorMessage(error: unknown, provider: AIProvider): string {
  const name = PROVIDER_NAMES[provider] ?? provider;
  if (error instanceof AIProxyError) {
    switch (error.code) {
      case 'AUTH_FAILED':
        return `No working ${name} key is saved. Add or check it in Settings.`;
      case 'RATE_LIMIT':
        return `${name} is limiting requests right now. Wait a minute and try again.`;
      case 'TIMEOUT':
        return `${name} took too long to answer. Try again, or ask for fewer setlists.`;
      case 'PAYLOAD_TOO_LARGE':
        return 'The prompt is too long. Ask for fewer setlists or trim the exclusions.';
      case 'NETWORK_ERROR':
        return 'Could not reach the SongNodes server. Check it is running and try again.';
      default:
        return `${name} could not complete the request. Try again later.`;
    }
  }
  return `${name} could not complete the request. Try again later.`;
}
