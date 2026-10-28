import { LibraryTrack } from '../musicLibrary/data';
import { keyMove } from '../musicLibrary/setBuilder';

export interface TransitionMatch {
  track: LibraryTrack;
  score: number;
  badges: string[];
}

export interface TransitionOptions {
  pool: LibraryTrack[];
  tgtEnergy?: number;
}

/** Scores candidates by Camelot key distance, BPM delta (+/- 4%), and smooth energy progression. */
export function findCompatibleTracks(
  current: LibraryTrack | null,
  options: TransitionOptions
): TransitionMatch[] {
  if (!current) return [];

  const matches: TransitionMatch[] = [];

  for (const track of options.pool) {
    if (track.id === current.id) continue;

    // Reject out of bounds BPM upfront, if both have BPM
    if (current.bpm && track.bpm) {
      const bpmDiff = track.bpm - current.bpm;
      const bpmDeltaPct = Math.abs((bpmDiff / current.bpm) * 100);
      if (bpmDeltaPct > 4.0) continue;
    }

    let score = 0;
    const badges: string[] = [];

    // Key match
    const move = keyMove(current.k, track.k);
    if (move.score > 0) {
        score += move.score;
        badges.push(`Key match ${track.k}`);
    } else {
        continue; // Unusable key transition
    }

    // BPM match
    if (current.bpm && track.bpm) {
      const bpmDiff = track.bpm - current.bpm;
      const bpmDeltaPct = (bpmDiff / current.bpm) * 100;
      if (Math.abs(bpmDeltaPct) <= 4) {
        score += 3 - Math.abs(bpmDeltaPct); // Max 3 points for exact match
        const sign = bpmDeltaPct > 0 ? '+' : '';
        badges.push(`BPM ${sign}${bpmDeltaPct.toFixed(1)}%`);
      }
    }

    // Energy match
    if (current.e !== null && track.e !== null) {
      const eDiff = track.e - current.e;

      // Target energy if provided
      if (options.tgtEnergy !== undefined) {
         if (track.e === options.tgtEnergy) {
            score += 2;
            badges.push(`Energy target ${track.e}`);
         }
      } else {
         if (eDiff >= -1 && eDiff <= 1) { // smooth progression
            score += 1;
         } else {
            // penalise bad energy jump
            score -= Math.abs(eDiff);
         }
      }
    }

    if (score > 0) {
      matches.push({ track, score, badges });
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, 5);
}
