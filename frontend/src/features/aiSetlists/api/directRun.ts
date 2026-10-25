import { getLocalKey } from '../../../services/aiService';
import type { AIProvider } from '../../../services/aiService';
import { DEFAULT_AI_MODELS } from './config';

export async function runDirectQuery(provider: AIProvider, prompt: string, modelOverride?: string, useWebSearch: boolean = true): Promise<string> {
  const key = getLocalKey(provider);
  if (!key) throw new Error(`No local key found for ${provider}. Ensure it is saved in settings.`);

  const modelId = modelOverride || DEFAULT_AI_MODELS[provider];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

  try {
    if (provider === 'claude') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }]
        }),
        signal: controller.signal
      });

      if (!res.ok) {
         const err = await res.json().catch(() => ({}));
         throw new Error(err.error?.message || `Claude API returned ${res.status}`);
      }
      const data = await res.json();
      return data.content?.[0]?.text || '';

    } else if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: 'You are an expert DJ researcher.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7
        }),
        signal: controller.signal
      });

      if (!res.ok) {
         const err = await res.json().catch(() => ({}));
         throw new Error(err.error?.message || `OpenAI API returned ${res.status}`);
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';

    } else if (provider === 'gemini') {
      const toolConfig = useWebSearch ? { tools: [{ googleSearch: {} }] } : {};

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          ...toolConfig
        }),
        signal: controller.signal
      });

      if (!res.ok) {
         const err = await res.json().catch(() => ({}));
         throw new Error(err.error?.message || `Gemini API returned ${res.status}`);
      }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    throw new Error(`Unsupported provider: ${provider}`);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`API request to ${provider} timed out after 60 seconds.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
