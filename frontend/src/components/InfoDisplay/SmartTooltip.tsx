import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipPosition {
  x: number;
  y: number;
  placement: 'top' | 'bottom' | 'left' | 'right';
}

interface SmartTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  isOpen: boolean;
  onClose?: () => void;
  triggerRef?: React.RefObject<HTMLElement>;
  mousePosition?: { x: number; y: number };
  followCursor?: boolean;
  delay?: number;
  className?: string;
  size?: 'small' | 'medium' | 'large';
  interactive?: boolean;
  placement?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
}

const TOOLTIP_OFFSET = 8;
const VIEWPORT_PADDING = 16;

export const SmartTooltip: React.FC<SmartTooltipProps> = ({
  children,
  content,
  isOpen,
  onClose,
  triggerRef,
  mousePosition,
  followCursor = false,
  delay = 200,
  className = '',
  size = 'medium',
  interactive = false,
  placement = 'auto'
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<TooltipPosition>({ x: 0, y: 0, placement: 'top' });
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Calculate optimal tooltip position
  const calculatePosition = (): TooltipPosition => {
    if (!tooltipRef.current) return { x: 0, y: 0, placement: 'top' };

    const tooltip = tooltipRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let targetRect: DOMRect;
    let targetX: number;
    let targetY: number;

    if (followCursor && mousePosition) {
      // Use mouse position
      targetX = mousePosition.x;
      targetY = mousePosition.y;
      targetRect = new DOMRect(targetX, targetY, 0, 0);
    } else if (triggerRef?.current) {
      // Use trigger element position
      targetRect = triggerRef.current.getBoundingClientRect();
      targetX = targetRect.left + targetRect.width / 2;
      targetY = targetRect.top + targetRect.height / 2;
    } else {
      return { x: 0, y: 0, placement: 'top' };
    }

    const placements = placement === 'auto'
      ? ['top', 'bottom', 'right', 'left'] as const
      : [placement] as const;

    // Try each placement to find the best fit
    for (const currentPlacement of placements) {
      let x: number;
      let y: number;

      switch (currentPlacement) {
        case 'top':
          x = targetX - tooltipRect.width / 2;
          y = (followCursor ? targetY : targetRect.top) - tooltipRect.height - TOOLTIP_OFFSET;
          break;
        case 'bottom':
          x = targetX - tooltipRect.width / 2;
          y = (followCursor ? targetY : targetRect.bottom) + TOOLTIP_OFFSET;
          break;
        case 'left':
          x = (followCursor ? targetX : targetRect.left) - tooltipRect.width - TOOLTIP_OFFSET;
          y = targetY - tooltipRect.height / 2;
          break;
        case 'right':
          x = (followCursor ? targetX : targetRect.right) + TOOLTIP_OFFSET;
          y = targetY - tooltipRect.height / 2;
          break;
        default:
          x = targetX;
          y = targetY;
      }

      // Check if tooltip fits in viewport
      const fitsHorizontally = x >= VIEWPORT_PADDING &&
                               x + tooltipRect.width <= viewportWidth - VIEWPORT_PADDING;
      const fitsVertically = y >= VIEWPORT_PADDING &&
                             y + tooltipRect.height <= viewportHeight - VIEWPORT_PADDING;

      if (fitsHorizontally && fitsVertically) {
        return { x, y, placement: currentPlacement };
      }
    }

    // Fallback: position with viewport constraints
    let x = targetX - tooltipRect.width / 2;
    let y = targetY - tooltipRect.height - TOOLTIP_OFFSET;

    // Constrain to viewport
    x = Math.max(VIEWPORT_PADDING, Math.min(x, viewportWidth - tooltipRect.width - VIEWPORT_PADDING));
    y = Math.max(VIEWPORT_PADDING, Math.min(y, viewportHeight - tooltipRect.height - VIEWPORT_PADDING));

    return { x, y, placement: 'top' };
  };

  // Update position when dependencies change
  useEffect(() => {
    if (isOpen && tooltipRef.current) {
      const newPosition = calculatePosition();
      setPosition(newPosition);
    }
  }, [isOpen, mousePosition, triggerRef?.current]);

  // Handle delayed show/hide
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (isOpen) {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, delay);
    } else {
      setIsVisible(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isOpen, delay]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible && onClose) {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isVisible, onClose]);

  // Handle click outside for interactive tooltips
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (interactive && tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    };

    if (isVisible && interactive) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isVisible, interactive, onClose]);

  const sizeClasses = {
    small: 'max-w-xs text-xs',
    medium: 'max-w-sm text-sm',
    large: 'max-w-md text-base'
  };

  const placementClasses = {
    top: 'tooltip-top',
    bottom: 'tooltip-bottom',
    left: 'tooltip-left',
    right: 'tooltip-right'
  };

  if (!isVisible) return <>{children}</>;

  const tooltipElement = (
    <div
      ref={tooltipRef}
      className={`
        fixed z-[10002] pointer-events-auto
        bg-gray-900/95 backdrop-blur-md border border-gray-600/80 rounded-lg shadow-2xl
        px-3 py-2 text-white
        transition-all duration-200 ease-out
        ${sizeClasses[size]}
        ${placementClasses[position.placement]}
        ${className}
        ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
      `}
      style={{
        left: position.x,
        top: position.y,
        pointerEvents: interactive ? 'auto' : 'none'
      }}
      role="tooltip"
      aria-hidden={!isVisible}
    >
      {/* Arrow */}
      <div
        className={`
          absolute w-2 h-2 bg-gray-900 border transform rotate-45
          ${position.placement === 'top' ? 'bottom-[-4px] left-1/2 -translate-x-1/2 border-r border-b border-gray-600/80' : ''}
          ${position.placement === 'bottom' ? 'top-[-4px] left-1/2 -translate-x-1/2 border-l border-t border-gray-600/80' : ''}
          ${position.placement === 'left' ? 'right-[-4px] top-1/2 -translate-y-1/2 border-r border-t border-gray-600/80' : ''}
          ${position.placement === 'right' ? 'left-[-4px] top-1/2 -translate-y-1/2 border-l border-b border-gray-600/80' : ''}
        `}
      />

      {/* Content */}
      <div className="relative z-10">
        {content}
      </div>

      {/* Close button for interactive tooltips */}
      {interactive && onClose && (
        <button
          onClick={onClose}
          className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded text-xs transition-colors"
          aria-label="Close tooltip"
        >
          ×
        </button>
      )}
    </div>
  );

  return (
    <>
      {children}
      {createPortal(tooltipElement, document.body)}
    </>
  );
};

// Basic tooltip content components
export const BasicTooltipContent: React.FC<{
  title: string;
  description?: string;
  metadata?: Array<{ label: string; value: string | number }>;
}> = ({ title, description, metadata }) => (
  <div className="space-y-2">
    <div className="font-medium text-white">{title}</div>
    {description && (
      <div className="text-gray-300 text-xs leading-relaxed">{description}</div>
    )}
    {metadata && metadata.length > 0 && (
      <div className="space-y-1 pt-1 border-t border-gray-700">
        {metadata.map((item, index) => (
          <div key={index} className="flex justify-between text-xs">
            <span className="text-gray-400">{item.label}:</span>
            <span className="text-gray-200 font-medium">{item.value}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

// Advanced tooltip content with actions
export const AdvancedTooltipContent: React.FC<{
  title: string;
  description?: string;
  metadata?: Array<{ label: string; value: string | number }>;
  actions?: Array<{ label: string; onClick: () => void; icon?: React.ReactNode }>;
}> = ({ title, description, metadata, actions }) => (
  <div className="space-y-3">
    <BasicTooltipContent title={title} description={description} metadata={metadata} />

    {actions && actions.length > 0 && (
      <div className="flex gap-2 pt-2 border-t border-gray-700">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={action.onClick}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>
    )}
  </div>
);