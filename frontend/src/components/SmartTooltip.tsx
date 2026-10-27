import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { GraphNode, Track } from '../types';
import { useStore } from '../store/useStore';
import {
  Music,
  User,
  Clock,
  Zap,
  Hash,
  Activity,
  TrendingUp,
  Calendar,
  Volume2,
  Info,
  Play,
  Plus
} from 'lucide-react';

interface TooltipContent {
  title: string;
  subtitle?: string;
  details?: Array<{
    label: string;
    value: string;
    icon?: React.ReactNode;
    color?: string;
  }>;
  actions?: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    color?: string;
  }>;
  preview?: {
    image?: string;
    waveform?: number[];
  };
}

interface SmartTooltipProps {
  targetElement: HTMLElement | null;
  content: TooltipContent | null;
  delay?: number;
  interactive?: boolean;
  maxWidth?: number;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  offset?: number;
  onClose?: () => void;
  forceVisible?: boolean; // For context menus that should show immediately
}

export const SmartTooltip: React.FC<SmartTooltipProps> = ({
  targetElement,
  content,
  delay = 500,
  interactive = false,
  maxWidth = 320,
  placement = 'auto',
  offset = 10,
  onClose,
  forceVisible = false
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [actualPlacement, setActualPlacement] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const [isAnimating, setIsAnimating] = useState(false);

  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const hideTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Calculate optimal position and placement
  const calculatePosition = useCallback(() => {
    if (!targetElement || !tooltipRef.current) return;

    const targetRect = targetElement.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    let bestPlacement = placement === 'auto' ? 'top' : placement;
    let x = 0;
    let y = 0;

    if (placement === 'auto') {
      // Determine best placement based on available space
      const spaceTop = targetRect.top;
      const spaceBottom = windowHeight - targetRect.bottom;
      const spaceLeft = targetRect.left;
      const spaceRight = windowWidth - targetRect.right;

      if (spaceTop >= tooltipRect.height + offset) {
        bestPlacement = 'top';
      } else if (spaceBottom >= tooltipRect.height + offset) {
        bestPlacement = 'bottom';
      } else if (spaceRight >= tooltipRect.width + offset) {
        bestPlacement = 'right';
      } else if (spaceLeft >= tooltipRect.width + offset) {
        bestPlacement = 'left';
      } else {
        // Default to bottom if no good placement
        bestPlacement = 'bottom';
      }
    }

    // Calculate position based on placement
    switch (bestPlacement) {
      case 'top':
        x = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
        y = targetRect.top - tooltipRect.height - offset;
        break;
      case 'bottom':
        x = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
        y = targetRect.bottom + offset;
        break;
      case 'left':
        x = targetRect.left - tooltipRect.width - offset;
        y = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
        break;
      case 'right':
        x = targetRect.right + offset;
        y = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
        break;
    }

    // Keep tooltip within viewport
    x = Math.max(10, Math.min(x, windowWidth - tooltipRect.width - 10));
    y = Math.max(10, Math.min(y, windowHeight - tooltipRect.height - 10));

    setPosition({ x: x + scrollX, y: y + scrollY });
    setActualPlacement(bestPlacement);
  }, [targetElement, placement, offset]);

  // Show tooltip with delay
  const showTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 200);
    }, delay);
  }, [delay]);

  // Hide tooltip
  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!interactive) {
      setIsVisible(false);
      return;
    }

    // For interactive tooltips, delay hiding
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 100);
  }, [interactive]);

  // Force show tooltip immediately for context menus
  useEffect(() => {
    if (forceVisible && targetElement && content) {
      showTooltip();
    }
  }, [forceVisible, targetElement, content, showTooltip]);

  // Handle mouse events on target element
  useEffect(() => {
    if (!targetElement || !content || forceVisible) return; // Skip event listeners if force visible

    const handleMouseEnter = () => showTooltip();
    const handleMouseLeave = () => hideTooltip();

    targetElement.addEventListener('mouseenter', handleMouseEnter);
    targetElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      targetElement.removeEventListener('mouseenter', handleMouseEnter);
      targetElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [targetElement, content, forceVisible, showTooltip, hideTooltip]);

  // Update position when visible
  useEffect(() => {
    if (isVisible) {
      calculatePosition();

      // Recalculate on scroll or resize
      const handleReposition = () => calculatePosition();
      window.addEventListener('scroll', handleReposition);
      window.addEventListener('resize', handleReposition);

      return () => {
        window.removeEventListener('scroll', handleReposition);
        window.removeEventListener('resize', handleReposition);
      };
    }
  }, [isVisible, calculatePosition]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  if (!isVisible || !content || !targetElement) return null;

  return createPortal(
    <div
      ref={tooltipRef}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        maxWidth: `${maxWidth}px`,
        backgroundColor: 'var(--surface-1)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-control)',
        boxShadow: 'var(--shadow-2)',
        backdropFilter: 'blur(20px)',
        color: 'var(--fg)',
        fontSize: '0.8125rem',
        lineHeight: '1.4',
        zIndex: 'var(--z-tooltip)',
        opacity: isAnimating ? 0 : 1,
        transform: `scale(${isAnimating ? 0.95 : 1}) translateY(${isAnimating ?
          actualPlacement === 'bottom' ? '-5px' : '5px' : '0px'})`,
        transition: 'opacity 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        pointerEvents: interactive ? 'auto' : 'none'
      }}
      role="tooltip"
      onMouseEnter={() => {
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
        }
      }}
      onMouseLeave={() => hideTooltip()}
    >
      {/* Arrow */}
      <div
        style={{
          position: 'absolute',
          width: '12px',
          height: '12px',
          backgroundColor: 'var(--surface-1)',
          border: '1px solid var(--line)',
          transform: 'rotate(45deg)',
          ...(actualPlacement === 'top' && {
            bottom: '-7px',
            left: '50%',
            marginLeft: '-6px',
            borderTop: 'none',
            borderLeft: 'none'
          }),
          ...(actualPlacement === 'bottom' && {
            top: '-7px',
            left: '50%',
            marginLeft: '-6px',
            borderBottom: 'none',
            borderRight: 'none'
          }),
          ...(actualPlacement === 'left' && {
            right: '-7px',
            top: '50%',
            marginTop: '-6px',
            borderLeft: 'none',
            borderBottom: 'none'
          }),
          ...(actualPlacement === 'right' && {
            left: '-7px',
            top: '50%',
            marginTop: '-6px',
            borderRight: 'none',
            borderTop: 'none'
          })
        }}
      />

      <div style={{ padding: '16px' }}>
        {/* Header */}
        <div style={{ marginBottom: content.details || content.actions ? '12px' : '0' }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--fg)',
            marginBottom: content.subtitle ? '4px' : '0',
            wordBreak: 'break-word'
          }}>
            {content.title}
          </div>
          {content.subtitle && (
            <div style={{
              fontSize: '12px',
              color: 'var(--fg-3)',
              wordBreak: 'break-word'
            }}>
              {content.subtitle}
            </div>
          )}
        </div>

        {/* Preview (waveform or image) */}
        {content.preview && (
          <div style={{ marginBottom: '12px' }}>
            {content.preview.waveform && (
              <div style={{
                height: '32px',
                display: 'flex',
                alignItems: 'end',
                gap: '1px',
                padding: '8px',
                backgroundColor: 'var(--surface-2)',
                borderRadius: '6px'
              }}>
                {content.preview.waveform.map((amplitude, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: `${amplitude * 100}%`,
                      backgroundColor: 'var(--brand-soft)',
                      borderRadius: '1px',
                      minHeight: '2px'
                    }}
                  />
                ))}
              </div>
            )}
            {content.preview.image && (
              <img
                src={content.preview.image}
                alt="Preview"
                style={{
                  width: '100%',
                  height: '80px',
                  objectFit: 'cover',
                  borderRadius: '6px',
                  backgroundColor: 'var(--surface-2)'
                }}
              />
            )}
          </div>
        )}

        {/* Details */}
        {content.details && content.details.length > 0 && (
          <div style={{
            display: 'grid',
            gap: '8px',
            marginBottom: content.actions ? '12px' : '0'
          }}>
            {content.details.map((detail, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--fg-2)',
                  fontSize: '12px'
                }}>
                  {detail.icon}
                  {detail.label}
                </span>
                <span style={{
                  color: detail.color || 'var(--fg)',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  {detail.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Interactive Actions */}
        {interactive && content.actions && content.actions.length > 0 && (
          <div style={{
            display: 'flex',
            gap: '8px',
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid var(--line)'
          }}>
            {content.actions.map((action, index) => (
              <button
                key={index}
                onClick={() => {
                  action.onClick();
                  if (onClose) onClose();
                }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  borderRadius: '6px',
                  color: action.color || 'var(--fg)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                  flex: 1,
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = action.color
                    ? 'var(--surface-3)'
                    : 'var(--surface-3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-2)';
                }}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

// Utility function to convert hex to RGB
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '255, 255, 255';
}

// Hook for managing smart tooltips
export const useSmartTooltip = () => {
  const [tooltip, setTooltip] = useState<{
    targetElement: HTMLElement;
    content: TooltipContent;
    options?: Partial<SmartTooltipProps>;
  } | null>(null);

  // Store actions for tooltip interactions
  const addToSetlist = useStore(state => state.setlist.addTrackToSetlist);
  const selectNode = useStore(state => state.graph.selectNode);

  const showTooltip = useCallback((
    targetElement: HTMLElement,
    data: GraphNode | Track | any,
    options?: Partial<SmartTooltipProps>
  ) => {
    let content: TooltipContent;

    // Generate content based on data type
    if ('label' in data || 'name' in data) {
      // GraphNode or Track
      const track = data as GraphNode | Track;
      const title = 'name' in track ? track.name : track.label;
      const artist = track.artist || 'Unknown Artist';

      content = {
        title: title || 'Unknown Track',
        subtitle: artist,
        details: [
          ...(track.bpm ? [{
            label: 'BPM',
            value: Math.round(track.bpm).toString(),
            icon: <Activity size={12} />,
            color: 'var(--status-ok)'
          }] : []),
          ...(track.key ? [{
            label: 'Key',
            value: track.key,
            icon: <Hash size={12} />,
            color: 'var(--brand)'
          }] : []),
          ...(track.energy ? [{
            label: 'Energy',
            value: `${Math.round(track.energy * 100)}%`,
            icon: <Zap size={12} />,
            color: 'var(--status-warn)'
          }] : []),
          ...(track.year ? [{
            label: 'Year',
            value: track.year.toString(),
            icon: <Calendar size={12} />
          }] : []),
          ...('duration' in track && track.duration ? [{
            label: 'Duration',
            value: `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}`,
            icon: <Clock size={12} />
          }] : [])
        ],
        actions: options?.interactive ? [
          {
            label: 'Play',
            icon: <Play size={12} />,
            onClick: () => { /* Play functionality not implemented */ },
            color: 'var(--status-ok)'
          },
          {
            label: 'Add',
            icon: <Plus size={12} />,
            onClick: () => {
              if ('track' in track && track.track) {
                addToSetlist(track.track);
              } else {
                addToSetlist(track as Track);
              }
            },
            color: 'var(--mod-graph)'
          }
        ] : undefined,
        // Generate mock waveform for preview
        preview: {
          waveform: Array.from({ length: 40 }, () => Math.random() * 0.8 + 0.2)
        }
      };
    } else {
      // Generic content
      content = {
        title: data.title || 'Info',
        subtitle: data.subtitle,
        details: data.details
      };
    }

    setTooltip({
      targetElement,
      content,
      options
    });
  }, [addToSetlist]);

  const hideTooltip = useCallback(() => {
    setTooltip(null);
  }, []);

  return {
    tooltip,
    showTooltip,
    hideTooltip
  };
};