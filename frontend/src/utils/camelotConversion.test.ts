/**
 * Test suite for musical key to Camelot notation conversion
 *
 * This file demonstrates the conversion function working correctly
 * for various input formats and edge cases.
 */

// Standalone version of the conversion function for testing
function musicalKeyToCamelot(key: string): string | null {
  if (!key || typeof key !== 'string') return null;

  // Normalize: trim, lowercase for pattern matching
  const normalized = key.trim().toLowerCase();

  // Extract note and mode
  let note = '';
  let mode: 'major' | 'minor' | null = null;

  // Match patterns like "C Major", "C# Minor", "Db Maj", "C", "Am", "C#m"
  const patterns = [
    // Full notation: "C Major", "C# Minor", "Db major"
    /^([a-g][#b]?)\s*(major|minor|maj|min)/i,
    // Short notation with mode suffix: "Cm", "C#m", "Dbm" (minor)
    /^([a-g][#b]?)m$/i,
    // Just note: "C", "C#", "Db" (assume major)
    /^([a-g][#b]?)$/i
  ];

  let match = null;
  for (const pattern of patterns) {
    match = normalized.match(pattern);
    if (match) break;
  }

  if (!match) return null;

  // Extract note (first capture group)
  note = match[1].toUpperCase();

  // Determine mode
  if (match[2]) {
    // Full notation with explicit mode
    mode = match[2].toLowerCase().startsWith('maj') ? 'major' : 'minor';
  } else if (normalized.endsWith('m')) {
    // Short notation with 'm' suffix (e.g., "Cm", "Am")
    mode = 'minor';
  } else {
    // No mode specified, assume major
    mode = 'major';
  }

  // Normalize sharp/flat equivalents to sharp for consistency
  const noteMap: Record<string, string> = {
    'C': 'C',
    'C#': 'C#', 'DB': 'C#',
    'D': 'D',
    'D#': 'D#', 'EB': 'D#',
    'E': 'E',
    'F': 'F',
    'F#': 'F#', 'GB': 'F#',
    'G': 'G',
    'G#': 'G#', 'AB': 'G#',
    'A': 'A',
    'A#': 'A#', 'BB': 'A#',
    'B': 'B', 'CB': 'B'
  };

  const canonicalNote = noteMap[note];
  if (!canonicalNote) return null;

  // Camelot wheel mapping (industry standard)
  const majorMap: Record<string, string> = {
    'C': '8B',
    'C#': '3B',
    'D': '10B',
    'D#': '5B',
    'E': '12B',
    'F': '7B',
    'F#': '2B',
    'G': '9B',
    'G#': '4B',
    'A': '11B',
    'A#': '6B',
    'B': '1B'
  };

  const minorMap: Record<string, string> = {
    'A': '8A',
    'A#': '3A',
    'B': '10A',
    'C': '5A',
    'C#': '12A',
    'D': '7A',
    'D#': '2A',
    'E': '9A',
    'F': '4A',
    'F#': '11A',
    'G': '6A',
    'G#': '1A'
  };

  if (mode === 'major') {
    return majorMap[canonicalNote] || null;
  } else {
    return minorMap[canonicalNote] || null;
  }
}

// Test cases
const testCases = [
  // Major keys - full notation
  { input: 'C Major', expected: '8B', description: 'C Major (full)' },
  { input: 'G Major', expected: '9B', description: 'G Major (full)' },
  { input: 'D Major', expected: '10B', description: 'D Major (full)' },
  { input: 'A Major', expected: '11B', description: 'A Major (full)' },
  { input: 'E Major', expected: '12B', description: 'E Major (full)' },
  { input: 'F Major', expected: '7B', description: 'F Major (full)' },
  { input: 'B Major', expected: '1B', description: 'B Major (full)' },

  // Major keys - short notation
  { input: 'C Maj', expected: '8B', description: 'C Major (short)' },
  { input: 'G maj', expected: '9B', description: 'G Major (lowercase)' },

  // Major keys - just note (assume major)
  { input: 'C', expected: '8B', description: 'C (assumed major)' },
  { input: 'G', expected: '9B', description: 'G (assumed major)' },

  // Major keys with sharps
  { input: 'C# Major', expected: '3B', description: 'C# Major' },
  { input: 'F# Major', expected: '2B', description: 'F# Major' },
  { input: 'G# Major', expected: '4B', description: 'G# Major' },

  // Major keys with flats (should normalize to sharp equivalent)
  { input: 'Db Major', expected: '3B', description: 'Db Major (= C# Major)' },
  { input: 'Eb Major', expected: '5B', description: 'Eb Major (= D# Major)' },
  { input: 'Gb Major', expected: '2B', description: 'Gb Major (= F# Major)' },
  { input: 'Ab Major', expected: '4B', description: 'Ab Major (= G# Major)' },
  { input: 'Bb Major', expected: '6B', description: 'Bb Major (= A# Major)' },

  // Minor keys - full notation
  { input: 'A Minor', expected: '8A', description: 'A Minor (full)' },
  { input: 'E Minor', expected: '9A', description: 'E Minor (full)' },
  { input: 'B Minor', expected: '10A', description: 'B Minor (full)' },
  { input: 'F# Minor', expected: '11A', description: 'F# Minor (full)' },
  { input: 'C# Minor', expected: '12A', description: 'C# Minor (full)' },
  { input: 'D Minor', expected: '7A', description: 'D Minor (full)' },
  { input: 'G Minor', expected: '6A', description: 'G Minor (full)' },

  // Minor keys - short notation with 'm' suffix
  { input: 'Am', expected: '8A', description: 'Am (short)' },
  { input: 'Em', expected: '9A', description: 'Em (short)' },
  { input: 'Bm', expected: '10A', description: 'Bm (short)' },
  { input: 'C#m', expected: '12A', description: 'C#m (short)' },
  { input: 'Dm', expected: '7A', description: 'Dm (short)' },

  // Minor keys - abbreviated
  { input: 'A Min', expected: '8A', description: 'A Minor (abbreviated)' },
  { input: 'E min', expected: '9A', description: 'E Minor (lowercase abbr)' },

  // Minor keys with sharps
  { input: 'G# Minor', expected: '1A', description: 'G# Minor' },
  { input: 'D# Minor', expected: '2A', description: 'D# Minor' },
  { input: 'A# Minor', expected: '3A', description: 'A# Minor' },

  // Minor keys with flats
  { input: 'Bb Minor', expected: '3A', description: 'Bb Minor (= A# Minor)' },
  { input: 'Eb Minor', expected: '2A', description: 'Eb Minor (= D# Minor)' },

  // Edge cases
  { input: '', expected: null, description: 'Empty string' },
  { input: '   ', expected: null, description: 'Whitespace only' },
  { input: 'X Major', expected: null, description: 'Invalid note' },
  { input: 'C Majorr', expected: null, description: 'Typo in mode' },
  { input: '123', expected: null, description: 'Numbers only' },

  // Case insensitive
  { input: 'c major', expected: '8B', description: 'Lowercase input' },
  { input: 'C MAJOR', expected: '8B', description: 'Uppercase input' },
  { input: 'a minor', expected: '8A', description: 'Lowercase minor' },
  { input: 'A MINOR', expected: '8A', description: 'Uppercase minor' },

  // Whitespace handling
  { input: '  C Major  ', expected: '8B', description: 'Extra whitespace' },
  { input: 'C  Major', expected: '8B', description: 'Double space' },
];

// Run tests
console.log('🎵 Musical Key to Camelot Conversion Test Suite\n');
console.log('=' .repeat(80));

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  const result = musicalKeyToCamelot(testCase.input);
  const success = result === testCase.expected;

  if (success) {
    passed++;
    console.log(`✅ Test ${index + 1}: ${testCase.description}`);
    console.log(`   Input: "${testCase.input}" → Output: ${result}`);
  } else {
    failed++;
    console.log(`❌ Test ${index + 1}: ${testCase.description}`);
    console.log(`   Input: "${testCase.input}"`);
    console.log(`   Expected: ${testCase.expected}, Got: ${result}`);
  }
});

console.log('=' .repeat(80));
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${testCases.length} total\n`);

// Print Camelot wheel reference
console.log('📚 Camelot Wheel Reference:');
console.log('\nMajor Keys (B):');
console.log('  8B = C Major     |  3B = C#/Db Major  | 10B = D Major');
console.log('  5B = D#/Eb Major | 12B = E Major      |  7B = F Major');
console.log('  2B = F#/Gb Major |  9B = G Major      |  4B = G#/Ab Major');
console.log(' 11B = A Major     |  6B = A#/Bb Major  |  1B = B Major');

console.log('\nMinor Keys (A):');
console.log('  8A = A Minor     |  3A = A#/Bb Minor  | 10A = B Minor');
console.log('  5A = C Minor     | 12A = C# Minor     |  7A = D Minor');
console.log('  2A = D#/Eb Minor |  9A = E Minor      |  4A = F Minor');
console.log(' 11A = F# Minor    |  6A = G Minor      |  1A = G# Minor');

console.log('\n🎛️  Harmonic Mixing Rules:');
console.log('  ✓ Same number (e.g., 8A ↔ 8B) - Perfect match (relative major/minor)');
console.log('  ✓ Adjacent numbers (e.g., 8A → 9A or 7A) - Energy shift');
console.log('  ✓ +7 on wheel (e.g., 8A → 3A) - Perfect fifth interval');

// Exit with appropriate code
process.exit(failed > 0 ? 1 : 0);
