// Camelot wheel and harmonic mixing utilities for DJ track transition analysis

export const CAMELOT_WHEEL = {
  '1A': { key: 'Ab', mode: 'minor', position: 0 },
  '2A': { key: 'Eb', mode: 'minor', position: 1 },
  '3A': { key: 'Bb', mode: 'minor', position: 2 },
  '4A': { key: 'F', mode: 'minor', position: 3 },
  '5A': { key: 'C', mode: 'minor', position: 4 },
  '6A': { key: 'G', mode: 'minor', position: 5 },
  '7A': { key: 'D', mode: 'minor', position: 6 },
  '8A': { key: 'A', mode: 'minor', position: 7 },
  '9A': { key: 'E', mode: 'minor', position: 8 },
  '10A': { key: 'B', mode: 'minor', position: 9 },
  '11A': { key: 'F#', mode: 'minor', position: 10 },
  '12A': { key: 'Db', mode: 'minor', position: 11 },
  '1B': { key: 'B', mode: 'major', position: 0 },
  '2B': { key: 'Gb', mode: 'major', position: 1 },
  '3B': { key: 'Db', mode: 'major', position: 2 },
  '4B': { key: 'Ab', mode: 'major', position: 3 },
  '5B': { key: 'Eb', mode: 'major', position: 4 },
  '6B': { key: 'Bb', mode: 'major', position: 5 },
  '7B': { key: 'F', mode: 'major', position: 6 },
  '8B': { key: 'C', mode: 'major', position: 7 },
  '9B': { key: 'G', mode: 'major', position: 8 },
  '10B': { key: 'D', mode: 'major', position: 9 },
  '11B': { key: 'A', mode: 'major', position: 10 },
  '12B': { key: 'E', mode: 'major', position: 11 },
} as const;

export type CamelotKey = keyof typeof CAMELOT_WHEEL;

// Standard key notation to Camelot mapping
export const KEY_TO_CAMELOT: Record<string, CamelotKey> = {
  'Ab minor': '1A', 'G# minor': '1A',
  'Eb minor': '2A', 'D# minor': '2A',
  'Bb minor': '3A', 'A# minor': '3A',
  'F minor': '4A',
  'C minor': '5A',
  'G minor': '6A',
  'D minor': '7A',
  'A minor': '8A',
  'E minor': '9A',
  'B minor': '10A',
  'F# minor': '11A', 'Gb minor': '11A',
  'Db minor': '12A', 'C# minor': '12A',
  'B major': '1B',
  'Gb major': '2B', 'F# major': '2B',
  'Db major': '3B', 'C# major': '3B',
  'Ab major': '4B', 'G# major': '4B',
  'Eb major': '5B', 'D# major': '5B',
  'Bb major': '6B', 'A# major': '6B',
  'F major': '7B',
  'C major': '8B',
  'G major': '9B',
  'D major': '10B',
  'A major': '11B',
  'E major': '12B',
};

// Reverse mapping for Camelot to key
export const CAMELOT_TO_KEY: Record<CamelotKey, string> = Object.entries(KEY_TO_CAMELOT)
  .reduce((acc, [key, camelot]) => {
    acc[camelot] = key;
    return acc;
  }, {} as Record<CamelotKey, string>);

/**
 * Convert standard key notation to Camelot key
 */
export function keyToCamelot(key: string): CamelotKey | null {
  const cleanKey = key.trim();

  // Direct match
  if (KEY_TO_CAMELOT[cleanKey]) {
    return KEY_TO_CAMELOT[cleanKey];
  }

  // Try variations (case insensitive, with/without spaces)
  for (const [standardKey, camelotKey] of Object.entries(KEY_TO_CAMELOT)) {
    if (standardKey.toLowerCase() === cleanKey.toLowerCase() ||
        standardKey.replace(' ', '').toLowerCase() === cleanKey.replace(' ', '').toLowerCase()) {
      return camelotKey;
    }
  }

  return null;
}

/**
 * Convert Camelot key to standard key notation
 */
export function camelotToKey(camelotKey: CamelotKey): string {
  const info = CAMELOT_WHEEL[camelotKey];
  return `${info.key} ${info.mode}`;
}

/**
 * Calculate harmonic compatibility score between two Camelot keys
 * Returns a score from 0 (incompatible) to 1 (perfect match)
 */
export function getHarmonicCompatibility(key1: CamelotKey, key2: CamelotKey): number {
  if (key1 === key2) {
    return 1.0; // Perfect match
  }

  const pos1 = CAMELOT_WHEEL[key1].position;
  const pos2 = CAMELOT_WHEEL[key2].position;
  const mode1 = key1.endsWith('A') ? 'minor' : 'major';
  const mode2 = key2.endsWith('A') ? 'minor' : 'major';

  // Same position, different mode (relative major/minor) - excellent compatibility
  if (pos1 === pos2 && mode1 !== mode2) {
    return 0.95;
  }

  // Adjacent positions (±1 semitone) - good compatibility
  const positionDiff = Math.min(
    Math.abs(pos1 - pos2),
    12 - Math.abs(pos1 - pos2) // Circular distance
  );

  if (positionDiff === 1) {
    return mode1 === mode2 ? 0.8 : 0.7; // Better if same mode
  }

  // Perfect fifth relationship (±7 semitones) - good compatibility
  if (positionDiff === 7) {
    return mode1 === mode2 ? 0.75 : 0.65;
  }

  // Other relationships
  switch (positionDiff) {
    case 2: return mode1 === mode2 ? 0.6 : 0.5;
    case 3: return mode1 === mode2 ? 0.4 : 0.3;
    case 4: return mode1 === mode2 ? 0.3 : 0.25;
    case 5: return mode1 === mode2 ? 0.35 : 0.3;
    case 6: return 0.2; // Tritone - generally difficult
    default: return 0.1; // Very distant keys
  }
}

/**
 * Get compatible keys for harmonic mixing
 */
export function getCompatibleKeys(camelotKey: CamelotKey): {
  perfect: CamelotKey[];
  excellent: CamelotKey[];
  good: CamelotKey[];
  acceptable: CamelotKey[];
} {
  const result = {
    perfect: [] as CamelotKey[],
    excellent: [] as CamelotKey[],
    good: [] as CamelotKey[],
    acceptable: [] as CamelotKey[],
  };

  for (const [key, _] of Object.entries(CAMELOT_WHEEL)) {
    const testKey = key as CamelotKey;
    const compatibility = getHarmonicCompatibility(camelotKey, testKey);

    if (compatibility >= 0.95) {
      if (testKey !== camelotKey) result.excellent.push(testKey);
      else result.perfect.push(testKey);
    } else if (compatibility >= 0.7) {
      result.good.push(testKey);
    } else if (compatibility >= 0.5) {
      result.acceptable.push(testKey);
    }
  }

  return result;
}

/**
 * Suggest next keys for DJ mixing progression
 */
export function suggestNextKeys(currentKey: CamelotKey, energyDirection: 'up' | 'down' | 'same' = 'same'): {
  key: CamelotKey;
  reason: string;
  compatibility: number;
}[] {
  const pos = CAMELOT_WHEEL[currentKey].position;
  const isMinor = currentKey.endsWith('A');
  const suggestions: { key: CamelotKey; reason: string; compatibility: number; }[] = [];

  // Same key
  suggestions.push({
    key: currentKey,
    reason: 'Same key - safe mixing',
    compatibility: 1.0,
  });

  // Relative major/minor
  const relativeKey = isMinor ? `${pos + 1}B` as CamelotKey : `${pos + 1}A` as CamelotKey;
  if (CAMELOT_WHEEL[relativeKey]) {
    suggestions.push({
      key: relativeKey,
      reason: `Relative ${isMinor ? 'major' : 'minor'} - smooth transition`,
      compatibility: 0.95,
    });
  }

  // Energy flow considerations
  if (energyDirection === 'up') {
    // Move up in energy (typically +1 or +2 positions)
    const nextPos = (pos + 1) % 12;
    const energyKey1 = `${nextPos + 1}${isMinor ? 'A' : 'B'}` as CamelotKey;
    if (CAMELOT_WHEEL[energyKey1]) {
      suggestions.push({
        key: energyKey1,
        reason: 'Energy boost - adjacent key',
        compatibility: 0.8,
      });
    }

    const nextPos2 = (pos + 2) % 12;
    const energyKey2 = `${nextPos2 + 1}${isMinor ? 'A' : 'B'}` as CamelotKey;
    if (CAMELOT_WHEEL[energyKey2]) {
      suggestions.push({
        key: energyKey2,
        reason: 'Energy boost - two steps up',
        compatibility: 0.6,
      });
    }
  } else if (energyDirection === 'down') {
    // Move down in energy (typically -1 or -2 positions)
    const prevPos = (pos - 1 + 12) % 12;
    const energyKey1 = `${prevPos + 1}${isMinor ? 'A' : 'B'}` as CamelotKey;
    if (CAMELOT_WHEEL[energyKey1]) {
      suggestions.push({
        key: energyKey1,
        reason: 'Energy descent - adjacent key',
        compatibility: 0.8,
      });
    }

    const prevPos2 = (pos - 2 + 12) % 12;
    const energyKey2 = `${prevPos2 + 1}${isMinor ? 'A' : 'B'}` as CamelotKey;
    if (CAMELOT_WHEEL[energyKey2]) {
      suggestions.push({
        key: energyKey2,
        reason: 'Energy descent - two steps down',
        compatibility: 0.6,
      });
    }
  }

  // Perfect fifth (dominant relationship)
  const fifthPos = (pos + 7) % 12;
  const fifthKey = `${fifthPos + 1}${isMinor ? 'A' : 'B'}` as CamelotKey;
  if (CAMELOT_WHEEL[fifthKey]) {
    suggestions.push({
      key: fifthKey,
      reason: 'Perfect fifth - harmonic relationship',
      compatibility: 0.75,
    });
  }

  // Sort by compatibility score
  return suggestions
    .sort((a, b) => b.compatibility - a.compatibility)
    .slice(0, 6); // Return top 6 suggestions
}

/**
 * Analyze harmonic progression quality for a sequence of keys
 */
export function analyzeHarmonicProgression(keys: CamelotKey[]): {
  overallScore: number;
  transitions: Array<{
    from: CamelotKey;
    to: CamelotKey;
    compatibility: number;
    suggestion?: string;
  }>;
  keyDistribution: Record<string, number>;
  problematicTransitions: Array<{
    position: number;
    from: CamelotKey;
    to: CamelotKey;
    issue: string;
  }>;
} {
  if (keys.length < 2) {
    return {
      overallScore: 1.0,
      transitions: [],
      keyDistribution: {},
      problematicTransitions: [],
    };
  }

  const transitions: Array<{
    from: CamelotKey;
    to: CamelotKey;
    compatibility: number;
    suggestion?: string;
  }> = [];

  const problematicTransitions: Array<{
    position: number;
    from: CamelotKey;
    to: CamelotKey;
    issue: string;
  }> = [];

  let totalCompatibility = 0;

  // Analyze transitions
  for (let i = 0; i < keys.length - 1; i++) {
    const from = keys[i];
    const to = keys[i + 1];
    const compatibility = getHarmonicCompatibility(from, to);

    transitions.push({ from, to, compatibility });
    totalCompatibility += compatibility;

    // Identify problematic transitions
    if (compatibility < 0.4) {
      let issue = 'Poor harmonic compatibility';
      if (compatibility < 0.2) {
        issue = 'Very difficult key change';
      }

      problematicTransitions.push({
        position: i,
        from,
        to,
        issue,
      });
    }
  }

  // Calculate key distribution
  const keyDistribution: Record<string, number> = {};
  keys.forEach(key => {
    const keyName = camelotToKey(key);
    keyDistribution[keyName] = (keyDistribution[keyName] || 0) + 1;
  });

  const overallScore = transitions.length > 0 ? totalCompatibility / transitions.length : 1.0;

  return {
    overallScore,
    transitions,
    keyDistribution,
    problematicTransitions,
  };
}

/**
 * Get key color for visualization (based on circle of fifths)
 */
export function getKeyColor(camelotKey: CamelotKey): string {
  const position = CAMELOT_WHEEL[camelotKey].position;
  const isMinor = camelotKey.endsWith('A');

  // Use HSL color space for smooth transitions
  const hue = (position * 30) % 360; // 30 degrees per position
  const saturation = isMinor ? '60%' : '80%'; // Minor keys are less saturated
  const lightness = isMinor ? '40%' : '60%'; // Minor keys are darker

  return `hsl(${hue}, ${saturation}, ${lightness})`;
}

/**
 * Format camelot key for display
 */
export function formatCamelotKey(camelotKey: CamelotKey): string {
  return camelotKey.replace('A', 'm').replace('B', 'M');
}

/**
 * Parse various key formats and convert to Camelot
 */
export function parseKeyToCamelot(keyInput: string): CamelotKey | null {
  if (!keyInput) return null;

  const input = keyInput.trim();

  // If already Camelot format
  if (input.match(/^\d{1,2}[AB]$/)) {
    return input as CamelotKey;
  }

  // If displayed format (1m, 1M)
  if (input.match(/^\d{1,2}[mM]$/)) {
    const num = input.slice(0, -1);
    const mode = input.slice(-1).toLowerCase() === 'm' ? 'A' : 'B';
    return `${num}${mode}` as CamelotKey;
  }

  // Standard key notation
  return keyToCamelot(input);
}