import React, { useEffect, useRef } from 'react';
import { useResponsiveLayout } from './ResponsiveLayoutProvider';
import classNames from 'classnames';

interface ResponsivePanelProps {
  panelType: 'navigation' | 'controls' | 'trackInfo' | 'search';
  title: string;
  children: React.ReactNode;
  className?: string;
  showCloseButton?: boolean;
  onClose?: () => void;
}

interface PanelPositionStyles {
  mobile: {
    modal: string;
    bottom: string;
    top: string;
    left: string;
    right: string;
    center: string;
  };
  tablet: {
    modal: string;
    bottom: string;
    top: string;
    left: string;
    right: string;
    center: string;
  };
  desktop: {
    modal: string;
    bottom: string;
    top: string;
    left: string;
    right: string;
    center: string;
  };
}

const PANEL_STYLES: PanelPositionStyles = {
  mobile: {
    modal: 'fixed inset-0 z-[10001] bg-gray-900',
    bottom: 'fixed bottom-0 left-0 right-0 z-[10001] bg-gray-900/95 backdrop-blur-sm border-t border-gray-600 rounded-t-xl max-h-[60vh]',
    top: 'fixed top-[56px] left-0 right-0 z-[10001] bg-gray-900/95 backdrop-blur-sm border-b border-gray-600 max-h-[40vh]',
    left: 'fixed top-[56px] left-0 bottom-0 z-[10001] bg-gray-900 border-r border-gray-600 w-[85vw] max-w-[320px]',
    right: 'fixed top-[56px] right-0 bottom-0 z-[10001] bg-gray-900 border-l border-gray-600 w-[85vw] max-w-[320px]',
    center: 'fixed inset-4 z-[10001] bg-gray-900 border border-gray-600 rounded-xl max-h-[80vh]'
  },
  tablet: {
    modal: 'fixed inset-0 z-[10001] bg-gray-900',
    bottom: 'fixed bottom-0 left-0 right-0 z-[10001] bg-gray-900/95 backdrop-blur-sm border-t border-gray-600 rounded-t-xl max-h-[50vh]',
    top: 'fixed top-[64px] left-0 right-0 z-[10001] bg-gray-900/95 backdrop-blur-sm border-b border-gray-600 max-h-[40vh]',
    left: 'fixed top-[64px] left-0 bottom-0 z-[10001] bg-gray-900 border-r border-gray-600 w-[400px]',
    right: 'fixed top-[64px] right-0 bottom-0 z-[10001] bg-gray-900 border-l border-gray-600 w-[400px]',
    center: 'fixed inset-8 z-[10001] bg-gray-900 border border-gray-600 rounded-xl max-h-[70vh] max-w-[600px] mx-auto'
  },
  desktop: {
    modal: 'fixed inset-0 z-[10001] bg-gray-900/90 backdrop-blur-sm flex items-center justify-center p-8',
    bottom: 'fixed bottom-0 left-0 right-0 z-[10001] bg-gray-900/95 backdrop-blur-sm border-t border-gray-600 max-h-[30vh]',
    top: 'fixed top-[64px] left-0 right-0 z-[10001] bg-gray-900/95 backdrop-blur-sm border-b border-gray-600 max-h-[25vh]',
    left: 'fixed top-[64px] left-0 bottom-0 z-[10001] bg-gray-900 border-r border-gray-600 w-[320px]',
    right: 'fixed top-[64px] right-0 bottom-0 z-[10001] bg-gray-900 border-l border-gray-600 w-[30vw] max-w-[500px] min-w-[350px]',
    center: 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[10001] bg-gray-900 border border-gray-600 rounded-xl shadow-2xl max-h-[80vh] max-w-[800px] min-w-[400px]'
  }
};

const ResponsivePanel: React.FC<ResponsivePanelProps> = ({
  panelType,
  title,
  children,
  className,
  showCloseButton = true,
  onClose
}) => {
  const { panels, closePanel, isMobile, isTablet, isDesktop, hasTouch } = useResponsiveLayout();
  const panelRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(350);

  const isResizable = isDesktop && (position === 'left' || position === 'right');

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isResizable) return;

    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = position === 'left' ? startWidth + e.clientX - startX : startWidth - e.clientX + startX;
      if (newWidth > 200 && newWidth < 800) {
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };


  const panel = panels[panelType];
  const { isOpen, position, size } = panel;

  // Close panel on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  // Lock body scroll for modal panels on mobile
  useEffect(() => {
    if (isOpen && (position === 'modal' || (isMobile && position !== 'bottom'))) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, position, isMobile]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      closePanel(panelType);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Get device-specific styles
  const deviceType = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';
  const baseStyles = PANEL_STYLES[deviceType][position];

  // Transition classes
  const getTransitionClasses = () => {
    const base = 'transition-all duration-300 ease-in-out';

    if (!isOpen) {
      switch (position) {
        case 'bottom':
          return `${base} translate-y-full`;
        case 'top':
          return `${base} -translate-y-full`;
        case 'left':
          return `${base} -translate-x-full`;
        case 'right':
          return `${base} translate-x-full`;
        case 'center':
        case 'modal':
          return `${base} opacity-0 scale-95`;
        default:
          return `${base} opacity-0`;
      }
    }

    return `${base} translate-x-0 translate-y-0 opacity-100 scale-100`;
  };

  if (!isOpen) {
    return null;
  }

  const panelContent = (
    <div
      ref={panelRef}
      className={classNames(
        baseStyles,
        getTransitionClasses(),
        'shadow-2xl',
        className
      )}
      style={isResizable ? { width: `${width}px` } : {}}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${panelType}-panel-title`}
    >
      {isResizable && (
        <div
          className={`absolute top-0 ${position === 'left' ? 'right-0' : 'left-0'} w-2 h-full cursor-col-resize`}
          onMouseDown={handleMouseDown}
        />
      )}
      {/* Panel Header */}
      <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 z-10 flex items-center justify-between">
        <h2
          id={`${panelType}-panel-title`}
          className="text-white font-semibold text-lg"
        >
          {title}
        </h2>

        {showCloseButton && (
          <button
            onClick={handleClose}
            className={classNames(
              'text-gray-400 hover:text-white transition-colors rounded-lg p-1',
              hasTouch ? 'min-h-[44px] min-w-[44px] text-xl' : 'text-lg'
            )}
            aria-label="Close panel"
          >
            ×
          </button>
        )}
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {children}
      </div>
    </div>
  );

  // Render with backdrop for modal positions
  if (position === 'modal' || (position === 'center' && isDesktop)) {
    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[10000] flex items-center justify-center p-4"
        onClick={handleBackdropClick}
      >
        {panelContent}
      </div>
    );
  }

  return panelContent;
};

// Export individual panel components for convenience
export const NavigationPanel: React.FC<{
  children: React.ReactNode;
  onClose?: () => void;
}> = ({ children, onClose }) => (
  <ResponsivePanel
    panelType="navigation"
    title="Functions & Tools"
    onClose={onClose}
  >
    {children}
  </ResponsivePanel>
);

export const ControlPanel: React.FC<{
  children: React.ReactNode;
  onClose?: () => void;
}> = ({ children, onClose }) => (
  <ResponsivePanel
    panelType="controls"
    title="Controls & Settings"
    onClose={onClose}
  >
    {children}
  </ResponsivePanel>
);

export const TrackInfoPanel: React.FC<{
  children: React.ReactNode;
  onClose?: () => void;
}> = ({ children, onClose }) => (
  <ResponsivePanel
    panelType="trackInfo"
    title="Track Details"
    onClose={onClose}
  >
    {children}
  </ResponsivePanel>
);

export const SearchPanel: React.FC<{
  children: React.ReactNode;
  onClose?: () => void;
}> = ({ children, onClose }) => (
  <ResponsivePanel
    panelType="search"
    title="Search Graph"
    onClose={onClose}
  >
    {children}
  </ResponsivePanel>
);

export { ResponsivePanel };