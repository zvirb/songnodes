/**
 * Harmonic Matching Utilities for DJ Transitions
 *
 * Implements best-match algorithm for track transitions based on:
 * - Camelot wheel compatibility
 * - BPM similarity
 * - Energy level progression
 * - Mood compatibility
 */

export interface TrackFeatures {
  id: string;
  title: string;
  artist: string;
  camelotKey: string;
  bpm: number;
  energy?: number; // 0-1 scale
  mood?: string;
  genre?: string;
}

export interface TransitionScore {
  sourceTrack: TrackFeatures;
  targetTrack: TrackFeatures;
  score: number;
  breakdown: {
    harmonicScore: number;
    bpmScore: number;
    energyScore: number;
    genreScore: number;
  };
  transitionType: string;
  recommendation: string;
}

/**
 * Camelot wheel compatibility rules
 */
const CAMELOT_COMPATIBLE: Record<string, string[]> = {
  // Major keys (A)
  '1A': ['12A', '2A', '1B'],
  '2A': ['1A', '3A', '2B'],
  '3A': ['2A', '4A', '3B'],
  '4A': ['3A', '5A', '4B'],
  '5A': ['4A', '6A', '5B'],
  '6A': ['5A', '7A', '6B'],
  '7A': ['6A', '8A', '7B'],
  '8A': ['7A', '9A', '8B'],
  '9A': ['8A', '10A', '9B'],
  '10A': ['9A', '11A', '10B'],
  '11A': ['10A', '12A', '11B'],
  '12A': ['11A', '1A', '12B'],
  // Minor keys (B)
  '1B': ['12B', '2B', '1A'],
  '2B': ['1B', '3B', '2A'],
  '3B': ['2B', '4B', '3A'],
  '4B': ['3B', '5B', '4A'],
  '5B': ['4B', '6B', '5A'],
  '6B': ['5B', '7B', '6A'],
  '7B': ['6B', '8B', '7A'],
  '8B': ['7B', '9B', '8A'],
  '9B': ['8B', '10B', '9A'],
  '10B': ['9B', '11B', '10A'],
  '11B': ['10B', '12B', '11A'],
  '12B': ['11B', '1B', '12A'],
};

/**
 * Calculate harmonic compatibility score (0-1)
 */
export function calculateHarmonicScore(sourceKey: string, targetKey: string): number {
  if (sourceKey === targetKey) {
    return 1.0; // Perfect match - same key
  }

  const compatibleKeys = CAMELOT_COMPATIBLE[sourceKey] || [];

  if (compatibleKeys.includes(targetKey)) {
    // Adjacent keys or relative major/minor
    return 0.9;
  }

  // Calculate key distance on the wheel
  const sourceNum = parseInt(sourceKey);
  const targetNum = parseInt(targetKey);
  const sourceLetter = sourceKey.slice(-1);
  const targetLetter = targetKey.slice(-1);

  if (sourceLetter === targetLetter) {
    // Same mode (both major or both minor)
    const distance = Math.min(
      Math.abs(targetNum - sourceNum),
      12 - Math.abs(targetNum - sourceNum)
    );

    if (distance <= 2) return 0.7;
    if (distance <= 3) return 0.5;
    if (distance <= 5) return 0.3;
    return 0.1;
  }

  // Different modes, non-adjacent
  return 0.2;
}

/**
 * Calculate BPM compatibility score (0-1)
 */
export function calculateBPMScore(sourceBPM: number, targetBPM: number): number {
  const bpmDiff = Math.abs(targetBPM - sourceBPM);

  if (bpmDiff === 0) return 1.0;
  if (bpmDiff <= 3) return 0.9;   // Very close - easy beatmatching
  if (bpmDiff <= 6) return 0.8;   // Close - standard beatmatching
  if (bpmDiff <= 10) return 0.6;  // Moderate - requires adjustment
  if (bpmDiff <= 20) return 0.4;  // Challenging
  if (bpmDiff <= 30) return 0.2;  // Very challenging

  // Check for harmonic BPM relationships (2x, 0.5x, 1.5x)
  const ratio = targetBPM / sourceBPM;
  if (Math.abs(ratio - 2.0) < 0.05 || Math.abs(ratio - 0.5) < 0.05) {
    return 0.7; // Double-time or half-time mixing
  }
  if (Math.abs(ratio - 1.5) < 0.05 || Math.abs(ratio - 0.667) < 0.05) {
    return 0.5; // 3:2 or 2:3 mixing
  }

  return 0.1;
}

/**
 * Calculate energy compatibility score (0-1)
 * Considers desired energy progression
 */
export function calculateEnergyScore(
  sourceEnergy: number,
  targetEnergy: number,
  desiredProgression: 'increase' | 'decrease' | 'maintain' = 'maintain'
): number {
  const energyDiff = targetEnergy - sourceEnergy;

  switch (desiredProgression) {
    case 'increase':
      if (energyDiff > 0.15) return 1.0;  // Strong increase
      if (energyDiff > 0.05) return 0.8;  // Moderate increase
      if (energyDiff > -0.05) return 0.5; // Maintaining
      return 0.3;                         // Decreasing (not desired)

    case 'decrease':
      if (energyDiff < -0.15) return 1.0; // Strong decrease
      if (energyDiff < -0.05) return 0.8; // Moderate decrease
      if (energyDiff < 0.05) return 0.5;  // Maintaining
      return 0.3;                         // Increasing (not desired)

    case 'maintain':
    default:
      const absDiff = Math.abs(energyDiff);
      if (absDiff < 0.05) return 1.0;     // Very similar
      if (absDiff < 0.10) return 0.8;     // Similar
      if (absDiff < 0.20) return 0.6;     // Moderate difference
      if (absDiff < 0.30) return 0.4;     // Noticeable difference
      return 0.2;                         // Large difference
  }
}

/**
 * Calculate genre compatibility score (0-1)
 */
export function calculateGenreScore(sourceGenre?: string, targetGenre?: string): number {
  if (!sourceGenre || !targetGenre) return 0.5; // Unknown - neutral score

  if (sourceGenre === targetGenre) return 1.0;

  // Genre family groupings
  const genreFamilies: Record<string, string[]> = {
    house: ['house', 'tech house', 'deep house', 'progressive house'],
    techno: ['techno', 'minimal techno', 'industrial techno'],
    trance: ['trance', 'progressive trance', 'uplifting trance', 'psytrance'],
    drum_bass: ['drum and bass', 'liquid dnb', 'neurofunk', 'jungle'],
    dubstep: ['dubstep', 'brostep', 'riddim', 'future bass'],
    ambient: ['ambient', 'downtempo', 'chillout', 'psybient'],
  };

  // Check if genres are in the same family
  for (const family of Object.values(genreFamilies)) {
    if (family.includes(sourceGenre.toLowerCase()) && family.includes(targetGenre.toLowerCase())) {
      return 0.8; // Same family - compatible
    }
  }

  return 0.4; // Different families - less compatible but not impossible
}

/**
 * Find best matching tracks for transition
 */
export function findBestMatches(
  sourceTrack: TrackFeatures,
  candidateTracks: TrackFeatures[],
  options: {
    energyProgression?: 'increase' | 'decrease' | 'maintain';
    weights?: {
      harmonic?: number;
      bpm?: number;
      energy?: number;
      genre?: number;
    };
    topN?: number;
  } = {}
): TransitionScore[] {
  const {
    energyProgression = 'maintain',
    weights = {
      harmonic: 0.40,
      bpm: 0.30,
      energy: 0.20,
      genre: 0.10
    },
    topN = 5
  } = options;

  // Normalize weights
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const normalizedWeights = {
    harmonic: (weights.harmonic || 0) / totalWeight,
    bpm: (weights.bpm || 0) / totalWeight,
    energy: (weights.energy || 0) / totalWeight,
    genre: (weights.genre || 0) / totalWeight,
  };

  const scores: TransitionScore[] = candidateTracks
    .filter(track => track.id !== sourceTrack.id) // Exclude source track
    .map(targetTrack => {
      // Calculate individual scores
      const harmonicScore = calculateHarmonicScore(sourceTrack.camelotKey, targetTrack.camelotKey);
      const bpmScore = calculateBPMScore(sourceTrack.bpm, targetTrack.bpm);
      const energyScore = calculateEnergyScore(
        sourceTrack.energy || 0.5,
        targetTrack.energy || 0.5,
        energyProgression
      );
      const genreScore = calculateGenreScore(sourceTrack.genre, targetTrack.genre);

      // Calculate weighted total score
      const totalScore =
        harmonicScore * normalizedWeights.harmonic +
        bpmScore * normalizedWeights.bpm +
        energyScore * normalizedWeights.energy +
        genreScore * normalizedWeights.genre;

      // Determine transition type
      let transitionType = 'standard';
      if (harmonicScore >= 0.9 && bpmScore >= 0.8) {
        transitionType = 'seamless';
      } else if (harmonicScore <= 0.5 || bpmScore <= 0.5) {
        transitionType = 'creative';
      }

      // Generate recommendation
      let recommendation = '';
      if (totalScore >= 0.8) {
        recommendation = 'Excellent match - highly recommended';
      } else if (totalScore >= 0.6) {
        recommendation = 'Good match - works well';
      } else if (totalScore >= 0.4) {
        recommendation = 'Moderate match - requires skill';
      } else {
        recommendation = 'Challenging match - for experienced DJs';
      }

      return {
        sourceTrack,
        targetTrack,
        score: totalScore,
        breakdown: {
          harmonicScore,
          bpmScore,
          energyScore,
          genreScore
        },
        transitionType,
        recommendation
      };
    });

  // Sort by score (descending) and return top N
  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

/**
 * Get energy progression recommendation based on set position
 */
export function getEnergyProgressionForSetPosition(
  position: 'opening' | 'building' | 'peak' | 'closing'
): 'increase' | 'decrease' | 'maintain' {
  switch (position) {
    case 'opening':
      return 'maintain'; // Start steady
    case 'building':
      return 'increase'; // Build energy
    case 'peak':
      return 'maintain'; // Maintain high energy
    case 'closing':
      return 'decrease'; // Wind down
    default:
      return 'maintain';
  }
}

/**
 * Get recommended transition technique based on scores
 */
export function getTransitionTechnique(score: TransitionScore): string {
  const { harmonicScore, bpmScore, energyScore } = score.breakdown;

  if (harmonicScore >= 0.9 && bpmScore >= 0.9) {
    return 'Simple beatmatching - blend over 16-32 bars';
  } else if (harmonicScore >= 0.9 && bpmScore >= 0.6) {
    return 'Beatmatch with tempo adjustment - use pitch control';
  } else if (harmonicScore >= 0.7) {
    return 'Standard harmonic mix - 8-16 bar transition';
  } else if (bpmScore >= 0.8) {
    return 'Quick cut or filter sweep - focus on rhythm';
  } else if (energyScore >= 0.8) {
    return 'Energy-based transition - use EQ and effects';
  } else {
    return 'Creative transition - drop/break technique recommended';
  }
}