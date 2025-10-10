# Camelot Key Conversion Implementation

## Overview

The CamelotWheel component now includes complete musical key to Camelot notation conversion, enabling automatic translation of track keys from standard musical notation (e.g., "C Major", "A Minor") to DJ-friendly Camelot notation (e.g., "8B", "8A").

## Implementation Location

**File**: `/mnt/my_external_drive/programming/songnodes/frontend/src/components/CamelotWheel.tsx`

**Function**: `musicalKeyToCamelot(key: string): string | null`

## Camelot Wheel Mapping (Industry Standard)

### Major Keys (B suffix)
- **8B** = C Major
- **3B** = C#/Db Major
- **10B** = D Major
- **5B** = D#/Eb Major
- **12B** = E Major
- **7B** = F Major
- **2B** = F#/Gb Major
- **9B** = G Major
- **4B** = G#/Ab Major
- **11B** = A Major
- **6B** = A#/Bb Major
- **1B** = B Major

### Minor Keys (A suffix)
- **8A** = A Minor
- **3A** = A#/Bb Minor
- **10A** = B Minor
- **5A** = C Minor
- **12A** = C# Minor
- **7A** = D Minor
- **2A** = D#/Eb Minor
- **9A** = E Minor
- **4A** = F Minor
- **11A** = F# Minor
- **6A** = G Minor
- **1A** = G# Minor

## Supported Input Formats

The conversion function handles multiple input formats for maximum compatibility:

### 1. Full Notation
```typescript
musicalKeyToCamelot("C Major")    // => "8B"
musicalKeyToCamelot("A Minor")    // => "8A"
musicalKeyToCamelot("Db major")   // => "3B"
```

### 2. Abbreviated Notation
```typescript
musicalKeyToCamelot("C Maj")      // => "8B"
musicalKeyToCamelot("A min")      // => "8A"
musicalKeyToCamelot("F# Maj")     // => "2B"
```

### 3. Short Form (Note + 'm' for minor)
```typescript
musicalKeyToCamelot("Cm")         // => "5B" (C Minor)
musicalKeyToCamelot("Am")         // => "8A" (A Minor)
musicalKeyToCamelot("C#m")        // => "12A" (C# Minor)
```

### 4. Note Only (assumes major)
```typescript
musicalKeyToCamelot("C")          // => "8B" (C Major assumed)
musicalKeyToCamelot("Db")         // => "3B" (Db Major assumed)
```

## Features

### 1. Case Insensitive
```typescript
musicalKeyToCamelot("c major")    // => "8B"
musicalKeyToCamelot("C MAJOR")    // => "8B"
musicalKeyToCamelot("C Major")    // => "8B"
```

### 2. Whitespace Tolerance
```typescript
musicalKeyToCamelot("  C Major  ")   // => "8B"
musicalKeyToCamelot("C  Major")      // => "8B"
```

### 3. Enharmonic Equivalent Normalization
The function automatically normalizes enharmonic equivalents (sharps and flats that represent the same note):

```typescript
// Sharps and flats are treated as equivalent
musicalKeyToCamelot("C# Major")   // => "3B"
musicalKeyToCamelot("Db Major")   // => "3B" (same as C# Major)

musicalKeyToCamelot("Eb Minor")   // => "2A"
musicalKeyToCamelot("D# Minor")   // => "2A" (same as Eb Minor)
```

### 4. Edge Case Handling
```typescript
musicalKeyToCamelot("")           // => null (empty string)
musicalKeyToCamelot("   ")        // => null (whitespace only)
musicalKeyToCamelot("X Major")    // => null (invalid note)
musicalKeyToCamelot(null)         // => null (null input)
musicalKeyToCamelot(undefined)    // => null (undefined input)
```

## Integration with Track Data

The conversion is automatically applied when tracks are loaded into the Camelot Wheel. The `getTrackKey()` function checks multiple sources and converts various formats:

```typescript
const getTrackKey = (node: GraphNode): string | null => {
  // Try multiple key sources
  const key = node.key ||
              node.metadata?.key ||
              node.metadata?.camelot_key ||
              node.metadata?.musical_key ||
              node.track?.key ||
              node.track?.camelotKey;

  if (!key) return null;

  // Already Camelot format (e.g., "8B", "12A")
  if (key.match(/^\d+[AB]$/)) return key;

  // Open Key format (e.g., "8d", "7m") - converts to Camelot
  if (key.match(/^\d+[dm]$/)) {
    const num = parseInt(key);
    const mode = key.slice(-1);
    return mode === 'd' ? `${((num + 7) % 12) + 1}A` : `${((num + 7) % 12) + 1}B`;
  }

  // Musical key format (e.g., "C Major", "Am") - uses new conversion
  return musicalKeyToCamelot(key);
};
```

## Harmonic Mixing Rules

The Camelot wheel enables DJs to identify harmonically compatible tracks:

### Perfect Match
- **Same number, different letter** (e.g., 8A ↔ 8B)
- Represents relative major/minor keys
- Always harmonically compatible

### Energy Shift
- **Adjacent numbers** (e.g., 8A → 9A or 7A)
- Moves one position clockwise or counter-clockwise
- Smooth energy transition

### Perfect Fifth
- **+7 positions on wheel** (e.g., 8A → 3A)
- Perfect fifth interval
- Strong harmonic relationship

### Visual Compatibility Indicators
The wheel displays:
- **Solid green lines**: Actual playlist transitions (proven DJ mixes)
- **Dashed gray lines**: Harmonic suggestions based on Camelot compatibility
- **Track count badges**: Number of tracks in each key

## Testing

A comprehensive test suite is available at:
`/mnt/my_external_drive/programming/songnodes/frontend/src/utils/camelotConversion.test.ts`

Run the tests:
```bash
cd /mnt/my_external_drive/programming/songnodes/frontend
npx tsx src/utils/camelotConversion.test.ts
```

The test suite validates:
- All 12 major keys (with sharps and flats)
- All 12 minor keys (with sharps and flats)
- Multiple input formats
- Edge cases and error handling
- Case insensitivity
- Whitespace handling

## Example Usage in Application

When a track is loaded with metadata:

```typescript
const track = {
  id: "track-123",
  name: "Example Song",
  artist: "Example Artist",
  metadata: {
    key: "C Major",  // Standard musical notation
    bpm: 128
  }
};

// The CamelotWheel component automatically converts this to:
// "8B" (Camelot notation)
// And displays it on the wheel with harmonic compatibility indicators
```

## API Reference

### Function Signature
```typescript
function musicalKeyToCamelot(key: string): string | null
```

### Parameters
- **key** (string): Musical key in various formats
  - Full: "C Major", "A Minor"
  - Abbreviated: "C Maj", "A min"
  - Short: "Cm", "Am"
  - Note only: "C", "Db"

### Returns
- **string**: Camelot notation (e.g., "8B", "8A")
- **null**: If input is invalid or cannot be converted

### Example
```typescript
import { CamelotWheel } from './components/CamelotWheel';

// The function is used internally by CamelotWheel
// to convert track keys automatically
```

## Implementation Details

### Algorithm Overview

1. **Input Validation**: Check for null/undefined/empty strings
2. **Normalization**: Convert to lowercase, trim whitespace
3. **Pattern Matching**: Use regex to extract note and mode
4. **Note Normalization**: Convert flats to sharp equivalents (Db → C#)
5. **Camelot Lookup**: Map normalized note + mode to Camelot notation
6. **Return**: Camelot string or null

### Regex Patterns
```typescript
// Full notation: "C Major", "C# Minor"
/^([a-g][#b]?)\s*(major|minor|maj|min)/i

// Short notation with 'm' suffix: "Cm", "C#m"
/^([a-g][#b]?)m$/i

// Note only: "C", "C#"
/^([a-g][#b]?)$/i
```

## Performance Considerations

- **Memoized with `useCallback`**: Function is cached to prevent unnecessary re-creation
- **Efficient lookups**: Uses Record<string, string> for O(1) key mapping
- **Early returns**: Invalid inputs fail fast
- **No external dependencies**: Pure TypeScript implementation

## Future Enhancements

Potential future improvements:
- [ ] Support for alternative key notations (e.g., "Amin", "Cmin")
- [ ] Support for key signatures (e.g., "3 sharps")
- [ ] Support for Open Key notation (already partially implemented)
- [ ] Export as standalone utility function for use in other components
- [ ] Add unit tests in Jest/Vitest format

## Related Files

- `/mnt/my_external_drive/programming/songnodes/frontend/src/components/CamelotWheel.tsx` - Main component
- `/mnt/my_external_drive/programming/songnodes/frontend/src/utils/camelotConversion.test.ts` - Test suite
- `/mnt/my_external_drive/programming/songnodes/frontend/src/types.ts` - TypeScript types

## References

- [Mixed In Key - What is the Camelot Wheel?](https://mixedinkey.com/camelot-wheel/)
- [Wikipedia - Camelot Wheel](https://en.wikipedia.org/wiki/Camelot_Wheel)
- [Circle of Fifths](https://en.wikipedia.org/wiki/Circle_of_fifths)
