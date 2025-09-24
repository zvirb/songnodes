import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon, ExpandIcon, CollapseIcon, InfoIcon } from '../Icons/SettingsIcons';

interface InfoCardProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  position?: { x: number; y: number };
  triggerRef?: React.RefObject<HTMLElement>;
  className?: string;
  size?: 'compact' | 'default' | 'expanded';
  resizable?: boolean;
  draggable?: boolean;
  children: React.ReactNode;
}

interface CardPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_SIZES = {
  compact: { width: 280, height: 200 },
  default: { width: 360, height: 280 },
  expanded: { width: 480, height: 400 }
};

export const InfoCard: React.FC<InfoCardProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  position,
  triggerRef,
  className = '',
  size = 'default',
  resizable = false,
  draggable = true,
  children
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [cardPosition, setCardPosition] = useState<CardPosition>({
    x: 0,
    y: 0,
    ...DEFAULT_SIZES[size]
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isExpanded, setIsExpanded] = useState(size === 'expanded');

  // Calculate initial position
  useEffect(() => {
    if (!isOpen || !cardRef.current) return;

    let initialX = 0;
    let initialY = 0;

    if (position) {
      initialX = position.x;
      initialY = position.y;
    } else if (triggerRef?.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      initialX = triggerRect.right + 8;
      initialY = triggerRect.top;
    } else {
      // Center on screen
      initialX = (window.innerWidth - DEFAULT_SIZES[size].width) / 2;
      initialY = (window.innerHeight - DEFAULT_SIZES[size].height) / 2;
    }

    // Ensure card stays within viewport
    const maxX = window.innerWidth - DEFAULT_SIZES[size].width - 16;
    const maxY = window.innerHeight - DEFAULT_SIZES[size].height - 16;

    initialX = Math.max(16, Math.min(initialX, maxX));
    initialY = Math.max(16, Math.min(initialY, maxY));

    setCardPosition(prev => ({
      ...prev,
      x: initialX,
      y: initialY
    }));
  }, [isOpen, position, triggerRef, size]);

  // Handle dragging
  useEffect(() => {
    if (!isDragging || !draggable) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Constrain to viewport
      const maxX = window.innerWidth - cardPosition.width - 16;
      const maxY = window.innerHeight - cardPosition.height - 16;

      setCardPosition(prev => ({
        ...prev,
        x: Math.max(16, Math.min(newX, maxX)),
        y: Math.max(16, Math.min(newY, maxY))
      }));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, cardPosition.width, cardPosition.height, draggable]);

  // Handle resizing
  useEffect(() => {
    if (!isResizing || !resizable) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(200, e.clientX - cardPosition.x);
      const newHeight = Math.max(150, e.clientY - cardPosition.y);

      // Constrain to viewport
      const maxWidth = window.innerWidth - cardPosition.x - 16;
      const maxHeight = window.innerHeight - cardPosition.y - 16;

      setCardPosition(prev => ({
        ...prev,
        width: Math.min(newWidth, maxWidth),
        height: Math.min(newHeight, maxHeight)
      }));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, cardPosition.x, cardPosition.y, resizable]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!draggable || !headerRef.current?.contains(e.target as Node)) return;

    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (!resizable) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  };

  const toggleExpanded = () => {
    const newSize = isExpanded ? 'default' : 'expanded';
    const targetSize = DEFAULT_SIZES[newSize];

    setCardPosition(prev => ({
      ...prev,
      width: targetSize.width,
      height: targetSize.height
    }));
    setIsExpanded(!isExpanded);
  };

  if (!isOpen) return null;

  const cardElement = (
    <div
      ref={cardRef}
      className={`
        fixed z-[10001] bg-gray-900/95 backdrop-blur-md border border-gray-600/80 rounded-lg
        shadow-2xl overflow-hidden transition-all duration-200 ease-out
        ${isDragging ? 'cursor-grabbing' : ''}
        ${className}
      `}
      style={{
        left: cardPosition.x,
        top: cardPosition.y,
        width: cardPosition.width,
        height: cardPosition.height
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-card-title"
    >
      {/* Header */}
      <div
        ref={headerRef}
        className={`
          flex items-center justify-between p-4 border-b border-gray-700/80 bg-gray-800/50
          ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}
        `}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <InfoIcon className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 id="info-card-title" className="text-white font-semibold text-sm truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-gray-400 text-xs truncate">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {resizable && (
            <button
              onClick={toggleExpanded}
              className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <CollapseIcon className="w-4 h-4" />
              ) : (
                <ExpandIcon className="w-4 h-4" />
              )}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Close"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {children}
      </div>

      {/* Resize handle */}
      {resizable && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-50 hover:opacity-100 transition-opacity"
          onMouseDown={handleResizeMouseDown}
        >
          <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-gray-400" />
        </div>
      )}
    </div>
  );

  return createPortal(cardElement, document.body);
};

// Specialized info card components
export const NodeInfoCard: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  node: any;
  position?: { x: number; y: number };
  triggerRef?: React.RefObject<HTMLElement>;
}> = ({ isOpen, onClose, node, position, triggerRef }) => {
  if (!node) return null;

  const metadata = node.metadata || {};

  return (
    <InfoCard
      isOpen={isOpen}
      onClose={onClose}
      title={metadata.title || node.title || node.label || 'Unknown Track'}
      subtitle={metadata.artist || node.artist || 'Unknown Artist'}
      position={position}
      triggerRef={triggerRef}
      resizable={true}
    >
      <div className="space-y-4">
        {/* Basic Information */}
        <div className="space-y-2">
          <h4 className="text-white font-medium text-sm">Basic Information</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {metadata.album && (
              <div>
                <span className="text-gray-500">Album:</span>
                <p className="text-gray-300 break-words">{metadata.album}</p>
              </div>
            )}
            {metadata.genre && (
              <div>
                <span className="text-gray-500">Genre:</span>
                <p className="text-gray-300">{metadata.genre}</p>
              </div>
            )}
            {metadata.bpm && (
              <div>
                <span className="text-gray-500">BPM:</span>
                <p className="text-gray-300">{metadata.bpm}</p>
              </div>
            )}
            {metadata.key && (
              <div>
                <span className="text-gray-500">Key:</span>
                <p className="text-gray-300">{metadata.key}</p>
              </div>
            )}
            {metadata.year && (
              <div>
                <span className="text-gray-500">Year:</span>
                <p className="text-gray-300">{metadata.year}</p>
              </div>
            )}
            {metadata.duration && (
              <div>
                <span className="text-gray-500">Duration:</span>
                <p className="text-gray-300">{metadata.duration}s</p>
              </div>
            )}
          </div>
        </div>

        {/* Graph Metrics */}
        {node.metrics && (
          <div className="space-y-2">
            <h4 className="text-white font-medium text-sm">Graph Metrics</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {node.metrics.degree && (
                <div>
                  <span className="text-gray-500">Connections:</span>
                  <p className="text-gray-300">{node.metrics.degree}</p>
                </div>
              )}
              {node.metrics.centrality && (
                <div>
                  <span className="text-gray-500">Centrality:</span>
                  <p className="text-gray-300">{node.metrics.centrality.toFixed(3)}</p>
                </div>
              )}
              {node.metrics.clustering && (
                <div>
                  <span className="text-gray-500">Clustering:</span>
                  <p className="text-gray-300">{node.metrics.clustering.toFixed(3)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audio Features */}
        {node.audioFeatures && (
          <div className="space-y-2">
            <h4 className="text-white font-medium text-sm">Audio Features</h4>
            <div className="space-y-1">
              {Object.entries(node.audioFeatures).map(([key, value]) => (
                <div key={key} className="flex justify-between text-xs">
                  <span className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                  <span className="text-gray-300">
                    {typeof value === 'number' ? value.toFixed(3) : value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Metadata */}
        {Object.keys(metadata).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-white font-medium text-sm">Additional Data</h4>
            <div className="text-xs space-y-1">
              {Object.entries(metadata)
                .filter(([key]) => !['title', 'artist', 'album', 'genre', 'bpm', 'key', 'year', 'duration'].includes(key))
                .map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                    <span className="text-gray-300 break-all max-w-[60%] text-right">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </InfoCard>
  );
};

export const EdgeInfoCard: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  edge: any;
  position?: { x: number; y: number };
  triggerRef?: React.RefObject<HTMLElement>;
}> = ({ isOpen, onClose, edge, position, triggerRef }) => {
  if (!edge) return null;

  return (
    <InfoCard
      isOpen={isOpen}
      onClose={onClose}
      title="Edge Details"
      subtitle={`${edge.source} → ${edge.target}`}
      position={position}
      triggerRef={triggerRef}
      size="compact"
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="text-xs">
            <span className="text-gray-500">Source:</span>
            <p className="text-gray-300 break-words">{edge.source}</p>
          </div>
          <div className="text-xs">
            <span className="text-gray-500">Target:</span>
            <p className="text-gray-300 break-words">{edge.target}</p>
          </div>
          {edge.weight && (
            <div className="text-xs">
              <span className="text-gray-500">Weight:</span>
              <p className="text-gray-300">{edge.weight}</p>
            </div>
          )}
          {edge.type && (
            <div className="text-xs">
              <span className="text-gray-500">Type:</span>
              <p className="text-gray-300 capitalize">{edge.type}</p>
            </div>
          )}
          {edge.label && (
            <div className="text-xs">
              <span className="text-gray-500">Label:</span>
              <p className="text-gray-300">{edge.label}</p>
            </div>
          )}
        </div>

        {edge.metadata && Object.keys(edge.metadata).length > 0 && (
          <div className="space-y-2 pt-2 border-t border-gray-700">
            <h4 className="text-white font-medium text-sm">Metadata</h4>
            <div className="text-xs space-y-1">
              {Object.entries(edge.metadata).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-gray-500 capitalize">{key}:</span>
                  <span className="text-gray-300">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </InfoCard>
  );
};