import React, { useState, useEffect } from 'react';
import { useResponsiveLayout } from './ResponsiveLayoutProvider';
import { useAppSelector, useAppDispatch } from '../../store/index';
import classNames from 'classnames';

interface ViewModeToggleProps {
  is3DMode: boolean;
  onToggle: (mode: boolean) => void;
  className?: string;
}

interface HeaderBarProps {
  is3DMode: boolean;
  onViewModeToggle: (mode: boolean) => void;
  className?: string;
}

const ViewModeToggle: React.FC<ViewModeToggleProps> = ({ is3DMode, onToggle, className }) => {
  const { isMobile, hasTouch } = useResponsiveLayout();

  return (
    <div className={classNames(
      'flex bg-gray-800 rounded-lg p-1 relative',
      isMobile ? 'min-w-[120px]' : 'min-w-[140px]',
      className
    )}>
      {/* 2D Mode Button */}
      <button
        onClick={() => onToggle(false)}
        className={classNames(
          'flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
          'flex items-center justify-center space-x-1',
          !isMobile && 'px-3 py-2',
          !is3DMode
            ? 'bg-blue-600 text-white shadow-md transform scale-105'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700',
          hasTouch && 'min-h-[44px]'
        )}
        aria-label="Switch to 2D graph view"
      >
        <span>📊</span>
        <span className={isMobile ? 'text-[10px]' : 'text-xs'}>2D</span>
        {!is3DMode && <span className="text-green-400 text-xs">●</span>}
      </button>

      {/* 3D Mode Button */}
      <button
        onClick={() => onToggle(true)}
        className={classNames(
          'flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
          'flex items-center justify-center space-x-1',
          !isMobile && 'px-3 py-2',
          is3DMode
            ? 'bg-purple-600 text-white shadow-md transform scale-105'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700',
          hasTouch && 'min-h-[44px]'
        )}
        aria-label="Switch to 3D graph view"
      >
        <span>🌌</span>
        <span className={isMobile ? 'text-[10px]' : 'text-xs'}>3D</span>
        {is3DMode && <span className="text-green-400 text-xs">●</span>}
      </button>
    </div>
  );
};

const MobileMenuButton: React.FC<{ onMenuToggle: () => void; isMenuOpen: boolean }> = ({
  onMenuToggle,
  isMenuOpen
}) => (
  <button
    onClick={onMenuToggle}
    className="lg:hidden p-2 text-white hover:bg-gray-700 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
    aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
    aria-expanded={isMenuOpen}
  >
    <div className="w-6 h-6 flex flex-col justify-center space-y-1">
      <span
        className={classNames(
          'block w-6 h-0.5 bg-current transform transition-transform duration-200',
          isMenuOpen && 'rotate-45 translate-y-1.5'
        )}
      />
      <span
        className={classNames(
          'block w-6 h-0.5 bg-current transition-opacity duration-200',
          isMenuOpen && 'opacity-0'
        )}
      />
      <span
        className={classNames(
          'block w-6 h-0.5 bg-current transform transition-transform duration-200',
          isMenuOpen && '-rotate-45 -translate-y-1.5'
        )}
      />
    </div>
  </button>
);

const QuickActions: React.FC<{ onPanelOpen: (panel: string) => void }> = ({ onPanelOpen }) => {
  const { isMobile, screenSize } = useResponsiveLayout();
  const { nodes, edges, selectedNodes } = useAppSelector(state => state.graph);

  const actions = [
    { id: 'search', label: 'Search', icon: '🔍', action: () => onPanelOpen('search') },
    { id: 'controls', label: 'Controls', icon: '⚙️', action: () => onPanelOpen('controls') },
    { id: 'info', label: 'Info', icon: 'ℹ️', action: () => onPanelOpen('trackInfo'), disabled: selectedNodes.length === 0 }
  ];

  if (isMobile || screenSize === 'sm') {
    // Mobile: Show only icons
    return (
      <div className="flex space-x-1">
        {actions.map(action => (
          <button
            key={action.id}
            onClick={action.action}
            disabled={action.disabled}
            className={classNames(
              'p-2 text-white rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center',
              action.disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-gray-700 active:bg-gray-600'
            )}
            aria-label={action.label}
          >
            <span className="text-lg">{action.icon}</span>
          </button>
        ))}
      </div>
    );
  }

  // Desktop: Show icons with labels
  return (
    <div className="flex space-x-2">
      {actions.map(action => (
        <button
          key={action.id}
          onClick={action.action}
          disabled={action.disabled}
          className={classNames(
            'px-3 py-2 text-white rounded-lg transition-colors flex items-center space-x-2',
            action.disabled
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-gray-700 active:bg-gray-600'
          )}
          aria-label={action.label}
        >
          <span>{action.icon}</span>
          <span className="text-sm font-medium">{action.label}</span>
        </button>
      ))}
    </div>
  );
};

const GraphStats: React.FC = () => {
  const { isMobile, screenSize } = useResponsiveLayout();
  const { nodes, edges } = useAppSelector(state => state.graph);

  if (isMobile || screenSize === 'xs') {
    return null; // Hide on very small screens
  }

  return (
    <div className="hidden md:flex items-center space-x-4 text-gray-300 text-sm">
      <div className="flex items-center space-x-1">
        <span className="text-gray-500">Nodes:</span>
        <span className="text-white font-medium">{nodes.length.toLocaleString()}</span>
      </div>
      <div className="flex items-center space-x-1">
        <span className="text-gray-500">Edges:</span>
        <span className="text-white font-medium">{edges.length.toLocaleString()}</span>
      </div>
    </div>
  );
};

export const UnifiedHeaderBar: React.FC<HeaderBarProps> = ({
  is3DMode,
  onViewModeToggle,
  className
}) => {
  const { isMobile, isTablet, screenSize, viewportWidth, openPanel, togglePanel } = useResponsiveLayout();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu when switching to desktop
  useEffect(() => {
    if (!isMobile && !isTablet) {
      setIsMobileMenuOpen(false);
    }
  }, [isMobile, isTablet]);

  const handlePanelOpen = (panel: string) => {
    openPanel(panel as any);
    setIsMobileMenuOpen(false); // Close mobile menu after action
  };

  return (
    <>
      {/* Main Header Bar */}
      <header
        className={classNames(
          'fixed top-0 left-0 right-0 z-[9999] bg-gray-900/95 backdrop-blur-sm border-b border-gray-600 shadow-lg',
          className
        )}
        style={{ height: isMobile ? '56px' : '64px' }}
      >
        <div className="flex items-center justify-between h-full px-4 max-w-none">
          {/* Left Section: Logo + Mobile Menu */}
          <div className="flex items-center space-x-3">
            <MobileMenuButton
              onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              isMenuOpen={isMobileMenuOpen}
            />

            {/* Logo */}
            <div className="flex items-center space-x-2">
              <span className="text-xl">🎵</span>
              <span className="text-white font-bold text-lg">
                {screenSize === 'xs' ? 'SN' : 'SongNodes'}
              </span>
            </div>
          </div>

          {/* Center Section: View Mode Toggle (Desktop) */}
          {!isMobile && (
            <div className="flex items-center space-x-4">
              <ViewModeToggle
                is3DMode={is3DMode}
                onToggle={onViewModeToggle}
              />
              <GraphStats />
            </div>
          )}

          {/* Right Section: Quick Actions */}
          <div className="flex items-center space-x-2">
            <QuickActions onPanelOpen={handlePanelOpen} />
          </div>
        </div>

        {/* Mobile: View Mode Toggle in Header */}
        {isMobile && (
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
            <div className="bg-gray-800 rounded-b-lg px-3 py-2 shadow-lg">
              <ViewModeToggle
                is3DMode={is3DMode}
                onToggle={onViewModeToggle}
                className="scale-90"
              />
            </div>
          </div>
        )}
      </header>

      {/* Mobile Slide-out Menu */}
      {(isMobile || isTablet) && (
        <>
          {/* Backdrop */}
          <div
            className={classNames(
              'fixed inset-0 bg-black bg-opacity-50 z-[9998] transition-opacity duration-300',
              isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
            style={{ top: isMobile ? '56px' : '64px' }}
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Slide-out Menu */}
          <div
            className={classNames(
              'fixed left-0 top-0 h-full bg-gray-900 border-r border-gray-600 shadow-2xl z-[9999]',
              'transform transition-transform duration-300 ease-in-out',
              'w-80 max-w-[85vw]',
              isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
            )}
            style={{ top: isMobile ? '56px' : '64px' }}
          >
            <div className="p-4 space-y-4">
              <h3 className="text-white font-semibold text-lg">Navigation</h3>

              {/* Menu Items */}
              <div className="space-y-2">
                {[
                  { id: 'search', label: 'Search Graph', icon: '🔍' },
                  { id: 'controls', label: 'Controls & Settings', icon: '⚙️' },
                  { id: 'trackInfo', label: 'Track Information', icon: 'ℹ️' },
                  { id: 'navigation', label: 'Functions & Tools', icon: '🛠️' }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => handlePanelOpen(item.id)}
                    className="w-full text-left p-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors flex items-center space-x-3"
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
              </div>

              {/* Graph Stats (Mobile) */}
              <div className="pt-4 border-t border-gray-700">
                <GraphStats />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};