import React, { useState, useRef, useEffect } from 'react';
import { GraphNode, Track, PerformanceMetrics } from '../types';
import { useStore } from '../store/useStore';
import { useToast, ToastContainer } from '../hooks/useToast';
import { Card } from './ui';
import {
  Music,
  User,
  Clock,
  Zap,
  Hash,
  Calendar,
  TrendingUp,
  Volume2,
  Activity,
  X,
  ExternalLink,
  Copy,
  Play,
  Share,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface InfoCardProps {
  type: 'track' | 'node' | 'performance' | 'stats' | 'setlist';
  data?: Track | GraphNode | PerformanceMetrics | any;
  position?: { x: number; y: number };
  anchorElement?: HTMLElement;
  onClose?: () => void;
  className?: string;
  compact?: boolean;
  interactive?: boolean;
}

interface InfoField {
  key: string;
  label: string;
  value: any;
  icon?: React.ReactNode;
  formatter?: (value: any) => string;
  copyable?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}

export const InfoCard: React.FC<InfoCardProps> = ({
  type,
  data,
  position,
  anchorElement,
  onClose,
  className = '',
  compact = false,
  interactive = false
}) => {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [isAnimating, setIsAnimating] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  // Toast notifications
  const { toasts, showToast, hideToast } = useToast();

  // Store state
  const performanceMetrics = useStore(state => state.performanceMetrics);
  const graphData = useStore(state => state.graphData);
  const currentSetlist = useStore(state => state.currentSetlist);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 100);
    return () => clearTimeout(timer);
  }, []);

  // Get appropriate data based on type
  const getCardData = () => {
    switch (type) {
      case 'performance':
        return data || performanceMetrics;
      case 'stats':
        return {
          totalNodes: graphData.nodes?.length || 0,
          totalEdges: graphData.edges?.length || 0,
          selectedNodes: (graphData.nodes || []).filter(n => n.selected).length,
          setlistTracks: currentSetlist?.tracks.length || 0,
          ...data
        };
      case 'setlist':
        return currentSetlist || data;
      default:
        return data;
    }
  };

  const cardData = getCardData();

  // Build info fields based on type and data
  const getInfoFields = (): InfoField[] => {
    if (!cardData) return [];

    switch (type) {
      case 'track':
      case 'node':
        const track = cardData as Track | GraphNode;
        return [
          {
            key: 'name',
            label: 'Track',
            value: 'name' in track ? track.name : track.label,
            icon: <Music size={16} />,
            copyable: true
          },
          {
            key: 'artist',
            label: 'Artist',
            value: track.artist,
            icon: <User size={16} />,
            copyable: true
          },
          {
            key: 'album',
            label: 'Album',
            value: 'album' in track ? track.album : undefined,
            icon: <Volume2 size={16} />,
            copyable: true
          },
          {
            key: 'bpm',
            label: 'BPM',
            value: track.bpm,
            icon: <Activity size={16} />,
            formatter: (v) => v ? `${Math.round(v)}` : 'Unknown'
          },
          {
            key: 'key',
            label: 'Key',
            value: track.key,
            icon: <Hash size={16} />
          },
          {
            key: 'energy',
            label: 'Energy',
            value: track.energy,
            icon: <Zap size={16} />,
            formatter: (v) => v ? `${Math.round(v * 100)}%` : 'Unknown'
          },
          {
            key: 'year',
            label: 'Year',
            value: track.year,
            icon: <Calendar size={16} />
          },
          {
            key: 'popularity',
            label: 'Popularity',
            value: track.popularity,
            icon: <TrendingUp size={16} />,
            formatter: (v) => v ? `${Math.round(v)}%` : 'Unknown'
          },
          {
            key: 'duration',
            label: 'Duration',
            value: 'duration' in track ? track.duration : undefined,
            icon: <Clock size={16} />,
            formatter: (v) => v ? `${Math.floor(v / 60)}:${(v % 60).toString().padStart(2, '0')}` : undefined
          }
        ].filter(field => field.value !== undefined);

      case 'performance':
        const perf = cardData as PerformanceMetrics;
        return [
          {
            key: 'fps',
            label: 'FPS',
            value: perf.frameRate || perf.fps,
            formatter: (v) => `${Math.round(v)}`
          },
          {
            key: 'renderTime',
            label: 'Render Time',
            value: perf.renderTime,
            formatter: (v) => `${v.toFixed(2)}ms`
          },
          {
            key: 'nodeCount',
            label: 'Nodes',
            value: perf.nodeCount
          },
          {
            key: 'visibleNodes',
            label: 'Visible',
            value: perf.visibleNodes
          },
          {
            key: 'memoryUsage',
            label: 'Memory',
            value: perf.memoryUsage,
            formatter: (v) => `${(v / (1024 * 1024)).toFixed(1)}MB`
          }
        ];

      case 'stats':
        return [
          {
            key: 'totalNodes',
            label: 'Total Tracks',
            value: cardData.totalNodes
          },
          {
            key: 'totalEdges',
            label: 'Connections',
            value: cardData.totalEdges
          },
          {
            key: 'selectedNodes',
            label: 'Selected',
            value: cardData.selectedNodes
          },
          {
            key: 'setlistTracks',
            label: 'Setlist',
            value: cardData.setlistTracks
          }
        ];

      case 'setlist':
        const setlist = cardData;
        return [
          {
            key: 'name',
            label: 'Setlist',
            value: setlist?.name,
            copyable: true
          },
          {
            key: 'tracks',
            label: 'Tracks',
            value: setlist?.tracks?.length || 0
          },
          {
            key: 'duration',
            label: 'Duration',
            value: setlist?.duration,
            formatter: (v) => v ? `${Math.floor(v / 60)}:${(v % 60).toString().padStart(2, '0')}` : 'Unknown'
          },
          {
            key: 'created',
            label: 'Created',
            value: setlist?.created_at,
            formatter: (v) => v ? new Date(v).toLocaleDateString() : undefined
          }
        ].filter(field => field.value !== undefined);

      default:
        return [];
    }
  };

  const infoFields = getInfoFields();

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value.toString());

      const displayValue = value.length > 30
        ? `${value.substring(0, 30)}...`
        : value;

      showToast(`Copied: ${displayValue}`, 'success', 2500);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      showToast('Failed to copy to clipboard', 'error', 2500);
    }
  };

  const getCardTitle = () => {
    switch (type) {
      case 'track':
      case 'node':
        return 'Track Info';
      case 'performance':
        return 'Performance';
      case 'stats':
        return 'Statistics';
      case 'setlist':
        return 'Setlist';
      default:
        return 'Info';
    }
  };

  // Calculate position if anchored to element
  const getCardStyle = (): React.CSSProperties => {
    let style: React.CSSProperties = {
      maxWidth: compact ? '200px' : '300px',
      minWidth: compact ? '150px' : '250px',
      transform: isAnimating ? 'scale(0.95) translateY(10px)' : 'scale(1) translateY(0)',
      opacity: isAnimating ? 0 : 1,
      transition: 'all var(--duration-fast) var(--ease-out)',
    };

    if (position) {
      style.position = 'fixed';
      style.left = position.x;
      style.top = position.y;
      style.zIndex = 10000;
    } else if (anchorElement) {
      const rect = anchorElement.getBoundingClientRect();
      style.position = 'absolute';
      style.left = rect.right + 10;
      style.top = rect.top;
    }

    return style;
  };

  return (
    <Card
      ref={cardRef}
      className={`info-card ${className}`}
      style={getCardStyle()}
    >
      {/* Header */}
      <div className="p-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
        <h3 className={`m-0 font-semibold text-[var(--color-text-primary)] ${compact ? 'text-xs' : 'text-sm'}`}>
          {getCardTitle()}
        </h3>

        <div className="flex items-center gap-2">
          {compact && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="bg-transparent border-none text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer p-1 rounded-[var(--radius-sm)]"
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="bg-transparent border-none text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer p-1 rounded-[var(--radius-sm)]"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {(!compact || isExpanded) && (
        <div className="p-4">
          <div className="grid gap-3 grid-cols-1">
            {infoFields.map((field) => (
              <div
                key={field.key}
                className="flex items-center justify-between p-2 bg-[var(--color-bg-elevated-2)] border border-[var(--color-border-subtle)] rounded-[var(--radius-md)] min-h-[32px]"
              >
                <div className="flex items-center gap-2 text-[var(--color-text-secondary)] text-xs">
                  {field.icon}
                  <span>{field.label}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--color-text-primary)]">
                    {field.formatter ? field.formatter(field.value) : field.value}
                  </span>

                  {field.copyable && (
                    <button
                      onClick={() => handleCopy(field.value)}
                      className="bg-transparent border-none text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer p-0.5 rounded-[var(--radius-sm)]"
                      title="Copy to clipboard"
                    >
                      <Copy size={12} />
                    </button>
                  )}

                  {field.clickable && field.onClick && (
                    <button
                      onClick={field.onClick}
                      className="bg-transparent border-none text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer p-0.5 rounded-[var(--radius-sm)]"
                    >
                      <ExternalLink size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions (for interactive cards) */}
      {interactive && (type === 'track' || type === 'node') && (!compact || isExpanded) && (
        <div className="p-4 border-t border-[var(--color-border-subtle)] flex gap-2 justify-end">
          <button className="px-3 py-1.5 bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-[var(--radius-button)] text-[var(--color-success)] text-xs font-medium cursor-pointer flex items-center gap-1.5 hover:bg-[var(--color-success-bg)]/80 transition-colors">
            <Play size={14} />
            Play
          </button>

          <button className="px-3 py-1.5 bg-[var(--color-brand-secondary-muted)] border border-[var(--color-brand-secondary)]/30 rounded-[var(--radius-button)] text-[var(--color-brand-secondary)] text-xs font-medium cursor-pointer flex items-center gap-1.5 hover:bg-[var(--color-brand-secondary-muted)]/80 transition-colors">
            <Share size={14} />
            Share
          </button>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={hideToast} position="bottom-right" />
    </Card>
  );
};

// Hook for managing info cards
export const useInfoCard = () => {
  const [infoCard, setInfoCard] = useState<{
    type: InfoCardProps['type'];
    data?: any;
    position?: { x: number; y: number };
    anchorElement?: HTMLElement;
  } | null>(null);

  const showInfoCard = React.useCallback((
    type: InfoCardProps['type'],
    data?: any,
    options?: {
      position?: { x: number; y: number };
      anchorElement?: HTMLElement;
    }
  ) => {
    setInfoCard({
      type,
      data,
      position: options?.position,
      anchorElement: options?.anchorElement
    });
  }, []);

  const hideInfoCard = React.useCallback(() => {
    setInfoCard(null);
  }, []);

  return {
    infoCard,
    showInfoCard,
    hideInfoCard
  };
};
