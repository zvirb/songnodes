import type { AIProvider } from '../../../services/aiService';

// Default model IDs used for setlist generation (Markus must confirm these defaults)
export const DEFAULT_AI_MODELS: Record<AIProvider, string> = {
  claude: 'claude-3-5-sonnet-20241022',
  openai: 'gpt-4o',
  gemini: 'gemini-1.5-pro'
};
