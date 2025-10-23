# 2025 UI/UX Best Practices for Music/DJ Applications

## Executive Summary

This comprehensive guide outlines modern UI/UX best practices for music and DJ applications in 2025, covering design patterns, component architectures, accessibility standards, and performance optimization techniques. Based on extensive research of current industry leaders (Spotify, SoundCloud, Beatport, Serato, Traktor, Rekordbox) and modern design systems (shadcn/ui, Radix, Framer Motion), this document provides actionable guidelines for creating professional-grade music applications.

## Table of Contents

1. [Design System Foundation](#design-system-foundation)
2. [Data Quality Dashboards](#data-quality-dashboards)
3. [Audio Visualizations](#audio-visualizations)
4. [Graph Visualizations](#graph-visualizations)
5. [Comparison Views](#comparison-views)
6. [Playlist Management](#playlist-management)
7. [Real-time Collaboration](#real-time-collaboration)
8. [Search Interfaces](#search-interfaces)
9. [Statistics Dashboards](#statistics-dashboards)
10. [Accessibility Standards](#accessibility-standards)
11. [Performance Optimization](#performance-optimization)
12. [Implementation Priorities](#implementation-priorities)

---

## Design System Foundation

### Design Token Architecture

```css
/* Tailwind CSS 4 @theme pattern (2025) */
@theme {
  /* Color Tokens - Semantic naming */
  --color-primary: #6366f1;
  --color-secondary: #8b5cf6;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;

  /* Dark Mode Variants (avoid pure black/white) */
  --color-background-dark: #121212;
  --color-surface-dark: #1E1E1E;
  --color-text-dark: #F0F0F0;

  /* Spacing - 8pt Grid System */
  --space-0: 0;
  --space-1: 0.5rem;  /* 8px */
  --space-2: 1rem;    /* 16px */
  --space-3: 1.5rem;  /* 24px */
  --space-4: 2rem;    /* 32px */
  --space-5: 2.5rem;  /* 40px */
  --space-6: 3rem;    /* 48px */
  --space-8: 4rem;    /* 64px */

  /* Typography Scale */
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 1.875rem;

  /* Animation Tokens */
  --duration-fast: 150ms;
  --duration-base: 250ms;
  --duration-slow: 400ms;
  --easing-default: cubic-bezier(0.4, 0, 0.2, 1);
  --easing-spring: cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
```

### Component Library Stack

1. **shadcn/ui** - Copy-paste components built on Radix primitives
2. **Radix UI** - Unstyled, accessible component primitives
3. **Framer Motion** - Production-ready animation library
4. **React Spring** - Physics-based animations for natural motion

---

## Data Quality Dashboards

### Review Workflow Components

```tsx
// Modern batch operations pattern with shadcn/ui
interface ReviewDashboardProps {
  tracks: Track[];
  onApprove: (ids: string[]) => void;
  onReject: (ids: string[]) => void;
}

export const ReviewDashboard: React.FC<ReviewDashboardProps> = () => {
  return (
    <div className="space-y-4">
      {/* Bulk Actions Bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2 p-4 border-b">
          <Checkbox
            checked={selectAll}
            onCheckedChange={handleSelectAll}
            aria-label="Select all tracks"
          />
          <Button
            variant="default"
            size="sm"
            disabled={selectedCount === 0}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Approve ({selectedCount})
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={selectedCount === 0}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Reject ({selectedCount})
          </Button>
        </div>
      </div>

      {/* Data Quality Indicators */}
      <Card>
        <CardHeader>
          <CardTitle>Quality Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <QualityIndicator
              label="Artist Attribution"
              value={87}
              threshold={80}
              status="good"
            />
            <QualityIndicator
              label="Metadata Complete"
              value={92}
              threshold={90}
              status="excellent"
            />
            <QualityIndicator
              label="Audio Quality"
              value={68}
              threshold={70}
              status="warning"
            />
            <QualityIndicator
              label="Duplicates"
              value={3}
              threshold={5}
              status="good"
              inverse
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Quality indicator component with visual feedback
const QualityIndicator: React.FC<QualityIndicatorProps> = ({
  label,
  value,
  threshold,
  status,
  inverse = false
}) => {
  const statusColors = {
    excellent: "text-green-600 bg-green-50",
    good: "text-blue-600 bg-blue-50",
    warning: "text-amber-600 bg-amber-50",
    error: "text-red-600 bg-red-50"
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Badge className={statusColors[status]}>
          {value}%
        </Badge>
      </div>
      <Progress
        value={value}
        className="h-1"
        indicatorClassName={statusColors[status]}
      />
    </div>
  );
};
```

### Batch Operation Patterns

- **Optimistic Updates**: Immediately reflect UI changes before server confirmation
- **Undo/Redo Stack**: Allow reversal of batch operations within session
- **Progressive Enhancement**: Start with simple operations, add complex filters
- **Keyboard Shortcuts**: Ctrl+A (select all), Space (toggle selection), Enter (approve)

---

## Audio Visualizations

### Waveform Display Implementation

```tsx
// WaveSurfer.js integration for modern waveforms
import WaveSurfer from 'wavesurfer.js';
import SpectrogramPlugin from 'wavesurfer.js/dist/plugins/spectrogram';

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  audioUrl,
  peaks // Pre-decoded peaks for large files
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize WaveSurfer with modern configuration
    wavesurferRef.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'var(--color-primary)',
      progressColor: 'var(--color-primary-dark)',
      cursorColor: 'var(--color-accent)',
      barWidth: 2,
      barRadius: 3,
      responsive: true,
      normalize: true,
      backend: 'WebAudio',
      peaks: peaks, // Use pre-decoded peaks for performance
      plugins: [
        SpectrogramPlugin.create({
          labels: true,
          height: 200,
          splitChannels: false
        })
      ]
    });

    // Load audio
    wavesurferRef.current.load(audioUrl);

    // Cleanup
    return () => {
      wavesurferRef.current?.destroy();
    };
  }, [audioUrl, peaks]);

  return (
    <div className="space-y-4">
      <div ref={containerRef} className="w-full h-32" />

      {/* Playback Controls */}
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => wavesurferRef.current?.playPause()}
        >
          <Play className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
};
```

### Energy & Spectral Analysis

```tsx
// Real-time audio analysis visualization
export const EnergyVisualization: React.FC = ({ analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      // Clear canvas
      ctx.fillStyle = 'rgb(18, 18, 18)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw frequency bars
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;

        // Color based on frequency range
        const hue = (i / bufferLength) * 120; // Green to red
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;

        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();
  }, [analyser]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-48 rounded-lg"
      width={1024}
      height={256}
    />
  );
};
```

---

## Graph Visualizations

### Network Exploration with Cytoscape.js

```tsx
// Modern force-directed graph with collaboration features
import cytoscape from 'cytoscape';
import cola from 'cytoscape-cola'; // Force-directed layout

cytoscape.use(cola);

export const NetworkGraph: React.FC<NetworkGraphProps> = ({
  nodes,
  edges,
  onNodeSelect,
  collaborators = []
}) => {
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstance = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!cyRef.current) return;

    cyInstance.current = cytoscape({
      container: cyRef.current,

      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'var(--color-primary)',
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '12px',
            'color': 'var(--color-text)',
            'width': 'mapData(weight, 0, 100, 20, 60)',
            'height': 'mapData(weight, 0, 100, 20, 60)'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': 'var(--color-border)',
            'target-arrow-color': 'var(--color-border)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'opacity': 0.7
          }
        },
        {
          selector: '.highlighted',
          style: {
            'background-color': 'var(--color-accent)',
            'z-index': 999
          }
        },
        {
          selector: '.collaborator-cursor',
          style: {
            'border-width': 3,
            'border-color': 'data(collaboratorColor)',
            'border-opacity': 1
          }
        }
      ],

      elements: {
        nodes: nodes.map(node => ({
          data: { ...node },
          position: node.position
        })),
        edges: edges.map(edge => ({
          data: { ...edge }
        }))
      },

      layout: {
        name: 'cola',
        animate: true,
        randomize: false,
        convergenceThreshold: 0.01,
        nodeSpacing: 50,
        flow: { axis: 'y', minSeparation: 30 }
      }
    });

    // Collaboration: Show other users' selections
    collaborators.forEach(collaborator => {
      if (collaborator.selectedNode) {
        cyInstance.current
          ?.getElementById(collaborator.selectedNode)
          .addClass('collaborator-cursor')
          .data('collaboratorColor', collaborator.color);
      }
    });

    // Neighborhood highlighting on hover
    cyInstance.current?.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      const neighborhood = node.closedNeighborhood();

      cyInstance.current?.elements().addClass('faded');
      neighborhood.removeClass('faded').addClass('highlighted');
    });

    cyInstance.current?.on('mouseout', 'node', () => {
      cyInstance.current?.elements().removeClass('faded highlighted');
    });

    return () => {
      cyInstance.current?.destroy();
    };
  }, [nodes, edges, collaborators]);

  return (
    <div className="relative w-full h-[600px]">
      <div ref={cyRef} className="w-full h-full rounded-lg border" />

      {/* Collaboration Presence */}
      <div className="absolute top-4 right-4 space-y-2">
        {collaborators.map(user => (
          <div
            key={user.id}
            className="flex items-center gap-2 bg-background/90 px-3 py-1 rounded-full"
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: user.color }}
            />
            <span className="text-sm">{user.name}</span>
          </div>
        ))}
      </div>

      {/* Graph Controls */}
      <div className="absolute bottom-4 left-4 flex gap-2">
        <Button size="sm" variant="outline" onClick={handleZoomIn}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={handleZoomOut}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={handleFit}>
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
```

---

## Comparison Views

### Side-by-Side Track Analysis

```tsx
// Modern comparison interface with synchronized playback
export const TrackComparison: React.FC<TrackComparisonProps> = ({
  trackA,
  trackB
}) => {
  const [syncPlayback, setSyncPlayback] = useState(true);
  const [activeComparison, setActiveComparison] = useState<'key' | 'bpm' | 'energy'>('key');

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Track A */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{trackA.title}</span>
            <Badge variant="outline">{trackA.key}</Badge>
          </CardTitle>
          <CardDescription>{trackA.artist}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AudioWaveform audioUrl={trackA.url} />

          <div className="space-y-2">
            <MetricRow label="BPM" value={trackA.bpm} />
            <MetricRow label="Key" value={trackA.key} />
            <MetricRow label="Energy" value={trackA.energy} max={100} />
            <MetricRow label="Camelot" value={trackA.camelot} />
          </div>
        </CardContent>
      </Card>

      {/* Track B */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{trackB.title}</span>
            <Badge variant="outline">{trackB.key}</Badge>
          </CardTitle>
          <CardDescription>{trackB.artist}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AudioWaveform audioUrl={trackB.url} />

          <div className="space-y-2">
            <MetricRow label="BPM" value={trackB.bpm} />
            <MetricRow label="Key" value={trackB.key} />
            <MetricRow label="Energy" value={trackB.energy} max={100} />
            <MetricRow label="Camelot" value={trackB.camelot} />
          </div>
        </CardContent>
      </Card>

      {/* Compatibility Score */}
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Compatibility Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <CompatibilityMetric
              label="Harmonic Match"
              value={calculateHarmonicCompatibility(trackA.key, trackB.key)}
              description="Key compatibility for mixing"
            />
            <CompatibilityMetric
              label="Tempo Match"
              value={calculateTempoCompatibility(trackA.bpm, trackB.bpm)}
              description="BPM range for beatmatching"
            />
            <CompatibilityMetric
              label="Energy Flow"
              value={calculateEnergyFlow(trackA.energy, trackB.energy)}
              description="Energy level progression"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const CompatibilityMetric: React.FC<CompatibilityMetricProps> = ({
  label,
  value,
  description
}) => {
  const getColorClass = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-blue-600 bg-blue-50';
    if (score >= 40) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <Badge className={getColorClass(value)}>
          {value}%
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Progress value={value} className="h-1" />
    </div>
  );
};
```

---

## Playlist Management

### Modern Export Flow

```tsx
// Cross-service playlist export with queue management
export const PlaylistExportFlow: React.FC<PlaylistExportProps> = ({
  playlist,
  services
}) => {
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [exportStatus, setExportStatus] = useState<ExportStatus>({});

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Share2 className="mr-2 h-4 w-4" />
          Export Playlist
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export "{playlist.name}"</DialogTitle>
          <DialogDescription>
            Select streaming services to export your playlist
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Service Selection */}
          <div className="grid grid-cols-2 gap-4">
            {services.map(service => (
              <Card
                key={service.id}
                className={cn(
                  "cursor-pointer transition-all",
                  selectedServices.includes(service.id) && "ring-2 ring-primary"
                )}
                onClick={() => toggleService(service.id)}
              >
                <CardContent className="flex items-center p-4">
                  <Checkbox
                    checked={selectedServices.includes(service.id)}
                    className="mr-3"
                  />
                  <img
                    src={service.logo}
                    alt={service.name}
                    className="w-6 h-6 mr-3"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{service.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {service.connected ? 'Connected' : 'Not connected'}
                    </p>
                  </div>
                  {exportStatus[service.id] && (
                    <Badge variant={
                      exportStatus[service.id] === 'success' ? 'default' :
                      exportStatus[service.id] === 'error' ? 'destructive' :
                      'secondary'
                    }>
                      {exportStatus[service.id]}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Track Matching Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Track Availability</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {selectedServices.map(serviceId => {
                  const service = services.find(s => s.id === serviceId);
                  const matchRate = calculateMatchRate(playlist, service);

                  return (
                    <div key={serviceId} className="flex items-center justify-between">
                      <span className="text-sm">{service?.name}</span>
                      <div className="flex items-center gap-2">
                        <Progress value={matchRate} className="w-24 h-1" />
                        <span className="text-sm text-muted-foreground">
                          {matchRate}% match
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Export Options */}
          <div className="space-y-2">
            <Label>Export Format</Label>
            <RadioGroup defaultValue="streaming">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="streaming" id="streaming" />
                <Label htmlFor="streaming">Direct to Streaming Service</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="m3u" id="m3u" />
                <Label htmlFor="m3u">M3U Playlist File</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv">CSV (Track List)</Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={selectedServices.length === 0}
          >
            Export to {selectedServices.length} service{selectedServices.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

---

## Real-time Collaboration

### WebSocket-Based Presence System

```tsx
// Real-time collaboration with cursor tracking
export const CollaborativeWorkspace: React.FC = () => {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [cursors, setCursors] = useState<CursorPosition[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Initialize WebSocket connection
    wsRef.current = new WebSocket('wss://api.songnodes.com/collab');

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'user_joined':
          setCollaborators(prev => [...prev, data.user]);
          break;

        case 'cursor_move':
          // Debounced cursor updates
          setCursors(prev =>
            prev.map(c => c.userId === data.userId
              ? { ...c, x: data.x, y: data.y }
              : c
            )
          );
          break;

        case 'selection_change':
          // Optimistic update with conflict resolution
          handleSelectionChange(data);
          break;
      }
    };

    // Send local cursor position (debounced)
    const handleMouseMove = debounce((e: MouseEvent) => {
      wsRef.current?.send(JSON.stringify({
        type: 'cursor_move',
        x: e.clientX,
        y: e.clientY
      }));
    }, 50); // 20fps update rate

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      wsRef.current?.close();
    };
  }, []);

  return (
    <div className="relative w-full h-screen">
      {/* Main Workspace */}
      <div className="w-full h-full">
        {/* Your main content here */}
      </div>

      {/* Collaborator Cursors */}
      {cursors.map(cursor => (
        <div
          key={cursor.userId}
          className="absolute pointer-events-none transition-all duration-100"
          style={{
            left: cursor.x,
            top: cursor.y,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div
            className="w-4 h-4 rounded-full border-2"
            style={{
              borderColor: cursor.color,
              backgroundColor: `${cursor.color}33`
            }}
          />
          <span
            className="absolute top-5 left-0 text-xs whitespace-nowrap px-2 py-1 rounded"
            style={{
              backgroundColor: cursor.color,
              color: 'white'
            }}
          >
            {cursor.userName}
          </span>
        </div>
      ))}

      {/* Presence Indicators */}
      <div className="absolute top-4 right-4">
        <Card className="w-64">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Active Collaborators ({collaborators.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {collaborators.map(user => (
                <div key={user.id} className="flex items-center gap-2">
                  <div className="relative">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={user.avatar} />
                      <AvatarFallback>{user.name[0]}</AvatarFallback>
                    </Avatar>
                    <span
                      className="absolute bottom-0 right-0 w-2 h-2 rounded-full border border-background"
                      style={{ backgroundColor: user.color }}
                    />
                  </div>
                  <span className="text-sm flex-1">{user.name}</span>
                  {user.isTyping && (
                    <span className="text-xs text-muted-foreground">
                      typing...
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
```

---

## Search Interfaces

### Unified Multi-Service Search

```tsx
// Modern search with real-time results and filtering
export const UnifiedSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    services: ['local', 'spotify', 'soundcloud'],
    type: 'all',
    bpmRange: [60, 200],
    key: null
  });
  const [results, setResults] = useState<SearchResults>({});

  // Real-time search with debouncing
  const debouncedSearch = useMemo(
    () => debounce(async (searchQuery: string) => {
      if (searchQuery.length < 2) return;

      const responses = await Promise.all(
        filters.services.map(service =>
          searchService(service, searchQuery, filters)
        )
      );

      setResults(
        responses.reduce((acc, res) => ({
          ...acc,
          [res.service]: res.results
        }), {})
      );
    }, 300),
    [filters]
  );

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          type="search"
          placeholder="Search tracks, artists, albums..."
          className="pl-10 pr-4 h-12 text-lg"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-2 top-1/2 transform -translate-y-1/2"
            onClick={() => setQuery('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex gap-2 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Services ({filters.services.length})
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {['local', 'spotify', 'soundcloud', 'beatport'].map(service => (
              <DropdownMenuCheckboxItem
                key={service}
                checked={filters.services.includes(service)}
                onCheckedChange={(checked) => {
                  setFilters(prev => ({
                    ...prev,
                    services: checked
                      ? [...prev.services, service]
                      : prev.services.filter(s => s !== service)
                  }));
                }}
              >
                {service.charAt(0).toUpperCase() + service.slice(1)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Select value={filters.type} onValueChange={(value) =>
          setFilters(prev => ({ ...prev, type: value }))
        }>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="track">Tracks</SelectItem>
            <SelectItem value="artist">Artists</SelectItem>
            <SelectItem value="album">Albums</SelectItem>
            <SelectItem value="playlist">Playlists</SelectItem>
          </SelectContent>
        </Select>

        {/* BPM Range Slider */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Music className="mr-2 h-4 w-4" />
              BPM: {filters.bpmRange[0]}-{filters.bpmRange[1]}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <Label>BPM Range</Label>
              <Slider
                min={60}
                max={200}
                step={1}
                value={filters.bpmRange}
                onValueChange={(value) =>
                  setFilters(prev => ({ ...prev, bpmRange: value }))
                }
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{filters.bpmRange[0]} BPM</span>
                <span>{filters.bpmRange[1]} BPM</span>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Search Results */}
      <div className="space-y-6">
        {Object.entries(results).map(([service, items]) => (
          <div key={service}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-semibold capitalize">{service}</h3>
              <Badge variant="secondary">{items.length}</Badge>
            </div>
            <div className="grid gap-2">
              {items.slice(0, 5).map(item => (
                <Card key={item.id} className="hover:bg-accent/50 transition-colors">
                  <CardContent className="flex items-center gap-4 p-4">
                    <img
                      src={item.artwork}
                      alt={item.title}
                      className="w-12 h-12 rounded"
                    />
                    <div className="flex-1">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.artist} • {item.duration}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {item.bpm && (
                        <Badge variant="outline">{item.bpm} BPM</Badge>
                      )}
                      {item.key && (
                        <Badge variant="outline">{item.key}</Badge>
                      )}
                    </div>
                    <Button size="icon" variant="ghost">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {items.length > 5 && (
                <Button variant="ghost" className="w-full">
                  Show {items.length - 5} more from {service}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## Statistics Dashboards

### Network Analytics Visualization

```tsx
// Modern metrics dashboard with Recharts
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export const AnalyticsDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d'>('7d');
  const [metrics, setMetrics] = useState<DashboardMetrics>();

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Tracks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">
                {metrics?.totalTracks.toLocaleString()}
              </span>
              <Badge variant={metrics?.tracksGrowth > 0 ? 'default' : 'secondary'}>
                {metrics?.tracksGrowth > 0 ? '+' : ''}{metrics?.tracksGrowth}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              vs previous period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active DJs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">
                {metrics?.activeDJs.toLocaleString()}
              </span>
              <Badge variant="default">
                +{metrics?.djsGrowth}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Last {timeRange}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Network Density
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">
                {metrics?.networkDensity.toFixed(2)}
              </span>
              <Sparkline
                data={metrics?.densityHistory}
                className="flex-1 h-8"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Connections per node
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Data Quality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">
                {metrics?.dataQuality}%
              </span>
              <Progress value={metrics?.dataQuality} className="flex-1 h-2" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Metadata completeness
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Time Series Charts */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Track Growth</CardTitle>
            <CardDescription>New tracks added over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={metrics?.trackGrowthData}>
                <defs>
                  <linearGradient id="colorTracks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tick={{ fill: 'var(--color-text-muted)' }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'var(--color-text-muted)' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-background)',
                    border: '1px solid var(--color-border)'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="tracks"
                  stroke="var(--color-primary)"
                  fill="url(#colorTracks)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Genre Distribution</CardTitle>
            <CardDescription>Track distribution by genre</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={metrics?.genreData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomizedLabel}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {metrics?.genreData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Network Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Network Analysis</CardTitle>
          <CardDescription>Graph topology and clustering metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={metrics?.networkData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="nodes"
                stroke="var(--color-primary)"
                name="Nodes"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="edges"
                stroke="var(--color-secondary)"
                name="Edges"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="clustering"
                stroke="var(--color-accent)"
                name="Clustering Coefficient"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
```

---

## Accessibility Standards

### WCAG 2.1 Level AA Compliance Checklist

#### Keyboard Navigation
- ✅ All interactive elements accessible via Tab key
- ✅ Visible focus indicators with `:focus-visible` styles
- ✅ Logical tab order following visual flow
- ✅ Skip links for repetitive content
- ✅ Keyboard shortcuts documented and customizable

#### Screen Reader Support
- ✅ Semantic HTML elements (`<nav>`, `<main>`, `<article>`)
- ✅ ARIA labels for icon-only buttons
- ✅ ARIA live regions for dynamic updates
- ✅ Descriptive link text (not "click here")
- ✅ Form labels associated with inputs

#### Color & Contrast
- ✅ 4.5:1 contrast ratio for normal text
- ✅ 3:1 contrast ratio for large text (18pt+)
- ✅ Color not sole indicator of meaning
- ✅ Focus indicators meet contrast requirements

#### Motion & Animation
- ✅ Respect `prefers-reduced-motion`
- ✅ Pause/stop controls for auto-playing content
- ✅ No seizure-inducing flashing (< 3Hz)

```tsx
// Accessibility utilities
export const a11yUtils = {
  // Skip to main content link
  SkipLink: () => (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary text-primary-foreground px-4 py-2 rounded"
    >
      Skip to main content
    </a>
  ),

  // Respect motion preferences
  useReducedMotion: () => {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);

      const handleChange = (e: MediaQueryListEvent) => {
        setPrefersReducedMotion(e.matches);
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    return prefersReducedMotion;
  },

  // Announce to screen readers
  announce: (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  }
};
```

---

## Performance Optimization

### Core Web Vitals Targets (2025)

- **Largest Contentful Paint (LCP)**: < 2.5s
- **Interaction to Next Paint (INP)**: < 200ms
- **Cumulative Layout Shift (CLS)**: < 0.1

### Optimization Techniques

#### Code Splitting
```tsx
// Route-based code splitting
const DJInterface = lazy(() => import('./pages/DJInterface'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Settings = lazy(() => import('./pages/Settings'));

// Component-level splitting for heavy visualizations
const NetworkGraph = lazy(() => import('./components/NetworkGraph'));
const AudioWaveform = lazy(() => import('./components/AudioWaveform'));
```

#### List Virtualization
```tsx
// Use react-window for large lists
import { FixedSizeList } from 'react-window';

export const TrackList: React.FC<TrackListProps> = ({ tracks }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      <TrackItem track={tracks[index]} />
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={tracks.length}
      itemSize={80}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
};
```

#### React 18 Concurrent Features
```tsx
// Use transitions for non-urgent updates
const [isPending, startTransition] = useTransition();
const [filter, setFilter] = useState('');
const [filteredTracks, setFilteredTracks] = useState(tracks);

const handleFilterChange = (newFilter: string) => {
  setFilter(newFilter);

  // Mark filtering as non-urgent
  startTransition(() => {
    const filtered = tracks.filter(track =>
      track.title.toLowerCase().includes(newFilter.toLowerCase())
    );
    setFilteredTracks(filtered);
  });
};
```

#### Image Optimization
```tsx
// Lazy loading with blur placeholder
export const OptimizedImage: React.FC<ImageProps> = ({
  src,
  alt,
  placeholder
}) => {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      style={{
        backgroundImage: `url(${placeholder})`,
        backgroundSize: 'cover',
        filter: 'blur(20px)'
      }}
      onLoad={(e) => {
        e.currentTarget.style.filter = 'none';
      }}
    />
  );
};
```

---

## Implementation Priorities

### Phase 1: Foundation (Weeks 1-2)
1. **Design System Setup**
   - Install and configure shadcn/ui
   - Set up design tokens and theme
   - Implement dark mode support
   - Create base component library

2. **Accessibility Framework**
   - Set up keyboard navigation
   - Implement ARIA patterns
   - Add skip links and landmarks
   - Configure screen reader testing

### Phase 2: Core Features (Weeks 3-6)
1. **Data Quality Dashboard**
   - Review workflow interface
   - Batch operations UI
   - Quality indicators
   - Approval workflows

2. **Audio Visualizations**
   - WaveSurfer.js integration
   - Waveform rendering
   - Spectral analysis display
   - Playback controls

3. **Search Interface**
   - Unified search component
   - Multi-service integration
   - Real-time filtering
   - Result aggregation

### Phase 3: Advanced Features (Weeks 7-10)
1. **Graph Visualizations**
   - Cytoscape.js setup
   - Force-directed layouts
   - Interaction handlers
   - Performance optimization

2. **Real-time Collaboration**
   - WebSocket infrastructure
   - Presence system
   - Cursor tracking
   - Optimistic updates

3. **Statistics Dashboard**
   - Recharts integration
   - KPI components
   - Time series charts
   - Network analytics

### Phase 4: Polish & Optimization (Weeks 11-12)
1. **Performance Optimization**
   - Code splitting
   - List virtualization
   - Bundle analysis
   - Core Web Vitals testing

2. **Animation & Micro-interactions**
   - Framer Motion setup
   - Page transitions
   - Component animations
   - Loading states

3. **Testing & Documentation**
   - E2E accessibility tests
   - Performance benchmarks
   - Component documentation
   - Usage guidelines

---

## Conclusion

This comprehensive guide provides the foundation for building a modern, accessible, and performant music/DJ application in 2025. By following these patterns and best practices, you'll create an application that not only looks professional but also provides an exceptional user experience across all devices and user capabilities.

### Key Takeaways

1. **Component-First Architecture**: Use modern libraries like shadcn/ui for consistent, accessible components
2. **Performance by Default**: Implement virtualization, code splitting, and React 18 features
3. **Accessibility is Non-Negotiable**: WCAG 2.1 AA compliance from day one
4. **Real-time Collaboration**: WebSocket-based features are expected in modern apps
5. **Data Visualization Excellence**: Use specialized libraries for different visualization needs
6. **Dark Mode Support**: Essential for DJ/music applications
7. **Mobile-First Design**: Responsive across all devices
8. **Animation with Purpose**: Enhance UX without compromising performance

### Resources & References

- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Core Web Vitals](https://web.dev/vitals/)
- [Framer Motion](https://www.framer.com/motion/)
- [WaveSurfer.js](https://wavesurfer.xyz/)
- [Cytoscape.js](https://js.cytoscape.org/)
- [Recharts](https://recharts.org/)

---

*Last Updated: October 2025*
*Version: 1.0.0*