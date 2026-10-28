/**
 * @file AI Reasoning Service
 * @description Analyzes track compatibility and generates dynamic DJ mixing notes
 * through the server AI proxy (Claude, OpenAI, Gemini).
 * Gated by API keys saved on the server via apiKeyService.
 */

import { fetchExistingKeys } from './apiKeyService';
import { aiProxyComplete } from './aiProxyClient';
import type { APIKey } from '../types';

export type AIProvider = 'claude' | 'openai' | 'gemini';

export interface TrackSummary {
  id?: string;
  name?: string;
  title?: string;
  artist?: string;
  bpm?: number;
  camelotKey?: string;
  camelot_key?: string;
  energy?: number;
  genre?: string;
  [key: string]: unknown;
}

export interface TransitionParams {
  sourceTrack: TrackSummary;
  targetTrack: TrackSummary;
  provider?: AIProvider;
  customPrompt?: string;
}

export interface TransitionAnalysis {
  harmonicCompatibility: string;
  tempoTransition: string;
  eqBlending: string;
  creativeNotes: string;
}

export interface AITransitionResponse {
  status: 'success' | 'unauthenticated' | 'error';
  provider?: AIProvider;
  content?: string;
  analysis?: TransitionAnalysis;
  promptUsed?: string;
  error?: string;
  timestamp: string;
}

export interface AIPromptHistoryItem {
  id: string;
  timestamp: string;
  provider: AIProvider;
  sourceTrack: string;
  targetTrack: string;
  prompt: string;
  response: string;
  status: 'success' | 'error' | 'unauthenticated';
}

const HISTORY_STORAGE_KEY = 'songnodes_ai_prompt_history';

/**
 * Service name aliases mapped to standard AIProvider keys
 */
const PROVIDER_SERVICE_MAP: Record<string, AIProvider> = {
  claude: 'claude',
  anthropic: 'claude',
  'claude-api': 'claude',
  openai: 'openai',
  'openai-api': 'openai',
  gemini: 'gemini',
  google: 'gemini',
  'gemini-api': 'gemini',
};

export interface AvailabilityResult {
  available: boolean;
  configuredProviders: AIProvider[];
  defaultProvider?: AIProvider;
  reason?: string;
}

/**
 * Gatekeeping check: verifies if any valid AI API key is configured on the server.
 */
export const checkAIAvailability = async (): Promise<AvailabilityResult> => {
  const configuredProviders: Set<AIProvider> = new Set();

  // Check backend configured keys via apiKeyService
  try {
    const existingKeys: APIKey[] = await fetchExistingKeys();
    existingKeys.forEach((k) => {
      const normalizedService = k.service_name.toLowerCase();
      const provider = PROVIDER_SERVICE_MAP[normalizedService];
      if (provider) {
        // Must be non-empty and not explicitly marked invalid
        if (k.masked_value && k.masked_value.trim() !== '' && k.is_valid !== false) {
          configuredProviders.add(provider);
        }
      }
    });
  } catch {
    // Backend unreachable: no provider can be used through the proxy
  }

  const providers = Array.from(configuredProviders);
  if (providers.length === 0) {
    return {
      available: false,
      configuredProviders: [],
      reason: 'No valid AI API key (Claude, OpenAI, or Gemini) is configured in Settings.',
    };
  }

  return {
    available: true,
    configuredProviders: providers,
    defaultProvider: providers[0],
  };
};

/**
 * Formats track summary into a clean string representation.
 */
const formatTrackInfo = (t: TrackSummary): string => {
  const title = t.title || t.name || 'Unknown Track';
  const artist = t.artist || 'Unknown Artist';
  const bpm = t.bpm ? `${t.bpm} BPM` : 'BPM unknown';
  const key = t.camelotKey || t.camelot_key || 'Key unknown';
  const energy = t.energy != null ? `Energy: ${t.energy}/10` : 'Energy unknown';
  const genre = t.genre ? `Genre: ${t.genre}` : '';

  return `"${title}" by ${artist} [${bpm}, Camelot ${key}, ${energy}${genre ? `, ${genre}` : ''}]`;
};

/**
 * Generates structured prompt for transition recommendations.
 */
export const buildTransitionPrompt = (source: TrackSummary, target: TrackSummary, customInstructions?: string): string => {
  const sourceStr = formatTrackInfo(source);
  const targetStr = formatTrackInfo(target);

  return `You are an expert DJ and musical acoustic analyst. Analyze the following transition between two tracks and provide clear, creative, professional DJ mixing notes.

SOURCE TRACK: ${sourceStr}
TARGET TRACK: ${targetStr}

${customInstructions ? `USER INSTRUCTIONS: ${customInstructions}\n` : ''}
Please provide your analysis structured under the following 4 section headings:
1. HARMONIC COMPATIBILITY ANALYSIS
2. TEMPO & BEATMATCHING TRANSITION
3. EQ & BLENDING STRATEGY
4. CREATIVE SETLIST TRANSITION NOTES

Keep the tone concise, punchy, and actionable for live DJ performance.`;
};

/**
 * Transition notes go through the server AI proxy (POST /api/v1/ai/complete);
 * the provider key is read on the server and never reaches the browser.
 */
const executeClaude = async (prompt: string): Promise<string> => {
  const res = await aiProxyComplete({
    provider: 'claude',
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1000,
    prompt,
  });
  return res.text || 'No response text received from Claude.';
};

const executeOpenAI = async (prompt: string): Promise<string> => {
  const res = await aiProxyComplete({
    provider: 'openai',
    model: 'gpt-4o-mini',
    system: 'You are an expert DJ assistant specializing in setlist transitions and harmonic mixing.',
    prompt,
  });
  return res.text || 'No response text received from OpenAI.';
};

const executeGemini = async (prompt: string): Promise<string> => {
  const res = await aiProxyComplete({
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    prompt,
  });
  return res.text || 'No response text received from Gemini.';
};

/**
 * Rule-based analytical fallback for mixing guidance when the AI proxy call fails
 */
const generateAlgorithmicNotes = (source: TrackSummary, target: TrackSummary, provider: AIProvider): string => {
  const sBpm = Number(source.bpm) || 120;
  const tBpm = Number(target.bpm) || 120;
  const bpmDiff = Math.abs(tBpm - sBpm);
  const bpmPercent = ((tBpm - sBpm) / sBpm) * 100;

  const sKey = (source.camelotKey || source.camelot_key || '8A').toString().toUpperCase();
  const tKey = (target.camelotKey || target.camelot_key || '8A').toString().toUpperCase();

  const sEnergy = Number(source.energy) || 5;
  const tEnergy = Number(target.energy) || 5;
  const energyDiff = tEnergy - sEnergy;

  return `1. HARMONIC COMPATIBILITY ANALYSIS
Keys: ${sKey} → ${tKey}. ${sKey === tKey ? 'Perfect key match (identical key). Natural harmonic blend.' : 'Check Camelot Wheel distance for energy boost or smooth transition.'}

2. TEMPO & BEATMATCHING TRANSITION
BPM: ${sBpm} → ${tBpm} (${bpmDiff === 0 ? 'exact match' : `${bpmDiff.toFixed(1)} BPM shift, ${bpmPercent > 0 ? '+' : ''}${bpmPercent.toFixed(1)}%`}).
${bpmDiff <= 3 ? 'Smooth tempo drift across a 16-bar intro/outro transition.' : 'Consider a quick drop-swap, echo out, or loop transition to handle tempo difference.'}

3. EQ & BLENDING STRATEGY
- Lows: Swap sub-bass at phrase boundary (bar 16/32). Avoid playing both low EQs open simultaneously.
- Mids: Soft crossfade across vocal/synth phrases.
- Highs: Blend hats and shakers during intro/outro loops.

4. CREATIVE SETLIST TRANSITION NOTES (${provider.toUpperCase()} AI Mode)
- Energy Delta: ${energyDiff > 0 ? `+${energyDiff} energy ramp-up. Build momentum.` : energyDiff < 0 ? `${energyDiff} energy release. Reset room tension.` : 'Sustained energy level.'}
- Recommended transition duration: 16 to 32 bars depending on track structure and breakdown placement.`;
};

/**
 * Parses raw markdown response into structured TransitionAnalysis object.
 */
export const parseTransitionAnalysis = (rawText: string): TransitionAnalysis => {
  const lines = rawText.split('\n');
  let currentSection = '';
  const sections: Record<string, string[]> = {
    harmonic: [],
    tempo: [],
    eq: [],
    creative: [],
  };

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.includes('HARMONIC COMPATIBILITY')) {
      currentSection = 'harmonic';
      continue;
    } else if (upper.includes('TEMPO') || upper.includes('BEATMATCHING')) {
      currentSection = 'tempo';
      continue;
    } else if (upper.includes('EQ') || upper.includes('BLENDING')) {
      currentSection = 'eq';
      continue;
    } else if (upper.includes('CREATIVE') || upper.includes('SETLIST')) {
      currentSection = 'creative';
      continue;
    }

    if (currentSection && sections[currentSection]) {
      sections[currentSection].push(line);
    }
  }

  return {
    harmonicCompatibility: sections.harmonic.join('\n').trim() || rawText.slice(0, 300),
    tempoTransition: sections.tempo.join('\n').trim() || 'Adjust pitch sliders gradually over 16-32 bars.',
    eqBlending: sections.eq.join('\n').trim() || 'Gradual bass swap on beat 1 of phrase.',
    creativeNotes: sections.creative.join('\n').trim() || 'Smooth transitions keep energy consistent.',
  };
};

/**
 * Generate transition notes for given source and target tracks.
 */
export const generateTransitionNotes = async (
  params: TransitionParams
): Promise<AITransitionResponse> => {
  const timestamp = new Date().toISOString();

  // 1. Availability check
  const availability = await checkAIAvailability();
  if (!availability.available) {
    const unauthResponse: AITransitionResponse = {
      status: 'unauthenticated',
      error: availability.reason || 'No valid AI API key is configured.',
      timestamp,
    };
    saveHistoryItem({
      id: `hist_${Date.now()}`,
      timestamp,
      provider: params.provider || 'claude',
      sourceTrack: formatTrackInfo(params.sourceTrack),
      targetTrack: formatTrackInfo(params.targetTrack),
      prompt: buildTransitionPrompt(params.sourceTrack, params.targetTrack, params.customPrompt),
      response: unauthResponse.error || 'Unauthenticated',
      status: 'unauthenticated',
    });
    return unauthResponse;
  }

  // 2. Select Provider
  const provider = params.provider && availability.configuredProviders.includes(params.provider)
    ? params.provider
    : availability.defaultProvider || availability.configuredProviders[0] || 'claude';

  const prompt = buildTransitionPrompt(params.sourceTrack, params.targetTrack, params.customPrompt);

  try {
    let rawResult = '';
    if (provider === 'claude') {
      rawResult = await executeClaude(prompt);
    } else if (provider === 'openai') {
      rawResult = await executeOpenAI(prompt);
    } else {
      rawResult = await executeGemini(prompt);
    }

    const analysis = parseTransitionAnalysis(rawResult);

    const successResponse: AITransitionResponse = {
      status: 'success',
      provider,
      content: rawResult,
      analysis,
      promptUsed: prompt,
      timestamp,
    };

    saveHistoryItem({
      id: `hist_${Date.now()}`,
      timestamp,
      provider,
      sourceTrack: formatTrackInfo(params.sourceTrack),
      targetTrack: formatTrackInfo(params.targetTrack),
      prompt,
      response: rawResult,
      status: 'success',
    });

    return successResponse;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    // Fallback to algorithmic guidance if external API call fails (CORS, network, etc.)
    const fallbackText = generateAlgorithmicNotes(params.sourceTrack, params.targetTrack, provider);
    const fallbackAnalysis = parseTransitionAnalysis(fallbackText);

    const result: AITransitionResponse = {
      status: 'success',
      provider,
      content: `${fallbackText}\n\n[Note: AI request failed (${errorMsg}). Showing local DJ analysis.]`,
      analysis: fallbackAnalysis,
      promptUsed: prompt,
      timestamp,
    };

    saveHistoryItem({
      id: `hist_${Date.now()}`,
      timestamp,
      provider,
      sourceTrack: formatTrackInfo(params.sourceTrack),
      targetTrack: formatTrackInfo(params.targetTrack),
      prompt,
      response: result.content || '',
      status: 'success',
    });

    return result;
  }
};

/**
 * Local prompt history functions
 */
export const getPromptHistory = (): AIPromptHistoryItem[] => {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const saveHistoryItem = (item: AIPromptHistoryItem): void => {
  try {
    const current = getPromptHistory();
    const updated = [item, ...current].slice(0, 30); // Keep last 30 queries
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
};

export const clearPromptHistory = (): void => {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch {
    // Ignore
  }
};
