# AI Proxy Migration Notes (SEC6B)

The introduction of the `/api/v1/ai/complete` endpoint routes AI provider calls through the backend server, which now manages the API keys securely. This requires a migration for frontend services that previously called the providers directly and stored API keys in `localStorage`.

## Overview
1. **Frontend Client (`aiProxyClient.ts`)**: A new typed client that handles requests to `/api/v1/ai/complete` and maps errors (e.g. 429, timeouts) appropriately.
2. **Switching over `aiService.ts`**: In a later package, `aiService.ts` will be modified to use `aiProxyClient.ts` instead of directly calling `fetch` to Anthropic, OpenAI, or Google.
3. **Switching over `AISetlistsPage`**: The AI Setlists page (`frontend/src/features/aiSetlists/api/directRun.ts`) will also switch to `aiProxyClient.ts`.
4. **Local Storage Cleanup**: The UI needs a mechanism to drop old locally-stored provider keys.

## Clearing Old `localStorage` Keys
Currently, the frontend might store provider keys in several places:
- `songnodes_ai_key_config` (managed by `apiKeyService.ts`)
- `songnodes_key_claude` / `songnodes_key_openai` / `songnodes_key_gemini`
- `ai_key_claude` / `ai_key_openai` / `ai_key_gemini`
- `apiKey_claude` / `apiKey_openai` / `apiKey_gemini`

When switching to the new proxy, we must clear these old local storage entries to prevent accidental leaks. The clear logic should look like this:

```typescript
const OLD_PREFIXES = ['songnodes_key_', 'ai_key_', 'apiKey_'];
const PROVIDERS = ['claude', 'openai', 'gemini'];

export function clearLegacyLocalKeys() {
  PROVIDERS.forEach(provider => {
    OLD_PREFIXES.forEach(prefix => {
      localStorage.removeItem(`${prefix}${provider}`);
    });
  });
}
```

## Adapting `aiService.ts`
When `aiService.ts` is updated:
1. Replace `executeClaude`, `executeOpenAI`, and `executeGemini` direct fetch calls with a single call to `aiProxyComplete()`.
2. Map the existing prompt and provider choice to `AICompletionRequest`.

## Adapting `AISetlistsPage` (`directRun.ts`)
When `directRun.ts` is updated:
1. Replace the direct `fetch` logic for each provider with a single call to `aiProxyComplete()`.
2. Extract the response `text` from `AICompletionResponse`.
