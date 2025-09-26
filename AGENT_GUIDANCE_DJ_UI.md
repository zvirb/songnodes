# 🎯 CRITICAL GUIDANCE FOR DJ UI IMPLEMENTATION

## ⚠️ IMMEDIATE CORRECTIONS REQUIRED

### For dj-ui-analyst:
**DEVIATION**: Current UI has NO cognitive offloading features
**CORRECTION**:
- Identify where to add Camelot Wheel color-coding (green/yellow/red)
- Map energy levels (1-10) to visual bar heights, NOT numbers
- Calculate cognitive load reduction metrics

### For dj-ux-architect:
**DEVIATION**: Missing dual-mode interface (Librarian vs Performer)
**CORRECTION**:
```typescript
// Required UI Modes
interface DJModes {
  librarian: {
    features: ['track-analysis', 'tagging', 'playlist-organization'],
    cognitiveLoad: 'moderate',  // Can handle complexity
    timeConstraint: 'relaxed'
  },
  performer: {
    features: ['now-playing', 'intelligent-browser', 'quick-mix'],
    cognitiveLoad: 'minimal',   // Must be glanceable
    timeConstraint: 'critical'  // Decisions in <30 seconds
  }
}
```

### For dj-frontend-developer:
**DEVIATION**: No DJ-specific components exist
**CORRECTION**: Create these components IMMEDIATELY:

```typescript
// 1. NowPlayingDeck.tsx
interface NowPlayingDeckProps {
  track: Track;
  waveform: WaveformData;
  progress: number;
  bpm: number;
  key: CamelotKey;  // e.g., "8A", "9B"
  energy: number;    // 1-10 scale
}

// 2. IntelligentBrowser.tsx
interface IntelligentBrowserProps {
  currentKey: CamelotKey;
  currentEnergy: number;
  recommendations: Track[];  // MAX 20 tracks (Hick's Law)
  colorCoding: {
    perfect: '#7ED321',     // Green
    compatible: '#F5A623',  // Yellow
    clash: '#D0021B'        // Red
  };
}

// 3. EnergyMeter.tsx
interface EnergyMeterProps {
  level: number;  // 1-10
  visual: 'bar' | 'gradient';  // NO NUMBERS
  height: string;  // Visual representation
}

// 4. HarmonicWheel.tsx
interface HarmonicWheelProps {
  currentKey: CamelotKey;
  compatibleKeys: CamelotKey[];
  visualIndicator: 'glow' | 'highlight';
}
```

### For dj-performance-optimizer:
**DEVIATION**: Not optimizing for dark club environments
**CORRECTION**:
- Implement HIGH CONTRAST mode: min 7:1 ratio
- Response times MUST be <100ms for visual updates
- Touch targets minimum 44x44px (Fitts's Law)
- Reduce decision points to 3 or fewer per screen

## 📊 COLOR SCHEME UPDATE REQUIRED

Replace generic colors with DJ-specific semantic colors:

```typescript
const DJ_COLOR_SCHEMES = {
  harmonic: {
    perfect: 0x7ED321,      // Bright Green - same key
    compatible: 0xF5A623,   // Yellow - adjacent keys
    semitone: 0xFFA500,     // Orange - +1/-1 semitone
    clash: 0xD0021B,        // Red - dissonant
  },
  energy: {
    low: 0x2E3A87,         // Deep Blue (1-3)
    moderate: 0x4A90E2,    // Medium Blue (4-6)
    high: 0xFF6B35,        // Orange (7-8)
    peak: 0xFF0000,        // Red (9-10)
  },
  status: {
    playing: 0x7ED321,     // Green - currently playing
    queued: 0xF5A623,      // Yellow - up next
    played: 0x8E8E93,      // Gray - already played
    available: 0x4A90E2,   // Blue - ready to play
  }
};
```

## 🎯 KEY PERFORMANCE INDICATORS

Agents MUST achieve these metrics:
1. **Glanceability**: User can understand state in <500ms
2. **Decision Time**: Track selection in <10 seconds
3. **Error Rate**: <1% wrong key mixing
4. **Cognitive Load**: 70% reduction vs text-based interface

## 🚨 CRITICAL PRINCIPLES TO FOLLOW

1. **Recognition Over Recall** (Nielsen #6)
   - Use COLOR not TEXT for compatibility
   - Use SHAPES not NUMBERS for energy

2. **Minimize Cognitive Load** (Sweller)
   - Offload ALL calculations to the system
   - DJ only makes creative decisions

3. **Co-Pilot Paradigm**
   - System SUGGESTS, user DECIDES
   - Show WHY (transparency builds trust)

4. **Dark Environment Optimization**
   - Minimum 18px fonts
   - High contrast borders
   - Avoid pure white (use #F8F8F8)

## ⏰ MONITORING CHECKPOINTS

Every 3 minutes, agents will be evaluated on:
- [ ] Harmonic color-coding implemented?
- [ ] Energy bars visual, not numeric?
- [ ] Recommendations limited to 10-20?
- [ ] Dual-mode interface structured?
- [ ] Glanceable in dark environments?
- [ ] Co-pilot features active?

## 📝 REFERENCES
- The DJ's Co-Pilot: Sections 3-5 (Visual Indicators)
- UI_UX_GUIDE: Chapter 1 (Cognitive Load), Chapter 2 (Nielsen's Heuristics)
- CLAUDE.md: Track adjacency architecture for recommendations