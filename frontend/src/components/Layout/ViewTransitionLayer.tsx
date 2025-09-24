import React, { useEffect, useState, useRef } from 'react';
import { useResponsiveLayout } from './ResponsiveLayoutProvider';
import classNames from 'classnames';

interface ViewTransitionLayerProps {
  is3DMode: boolean;
  isTransitioning: boolean;
  onTransitionComplete?: () => void;
  children: React.ReactNode;
}

interface TransitionConfig {
  duration: number;
  easing: string;
  showLoadingOverlay: boolean;
  preserveViewport: boolean;
}

const ViewTransitionLayer: React.FC<ViewTransitionLayerProps> = ({
  is3DMode,
  isTransitioning,
  onTransitionComplete,
  children
}) => {
  const { isMobile, isTablet, viewportWidth, viewportHeight } = useResponsiveLayout();
  const [transitionPhase, setTransitionPhase] = useState<'idle' | 'fadeOut' | 'switching' | 'fadeIn'>('idle');
  const [showLoader, setShowLoader] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Device-specific transition configurations
  const getTransitionConfig = (): TransitionConfig => {
    if (isMobile) {
      return {
        duration: 400, // Faster on mobile for better UX
        easing: 'ease-out',
        showLoadingOverlay: true,
        preserveViewport: false // Mobile viewport changes frequently
      };
    }

    if (isTablet) {
      return {
        duration: 500,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        showLoadingOverlay: true,
        preserveViewport: true
      };
    }

    return {
      duration: 600, // Smoother, longer transition on desktop
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      showLoadingOverlay: false, // Desktop can handle quick switches
      preserveViewport: true
    };
  };

  const config = getTransitionConfig();

  // Handle transition sequence
  useEffect(() => {
    if (!isTransitioning) {
      setTransitionPhase('idle');
      setShowLoader(false);
      return;
    }

    const sequence = async () => {
      // Phase 1: Fade out current view
      setTransitionPhase('fadeOut');

      await new Promise(resolve => setTimeout(resolve, config.duration * 0.3));

      // Phase 2: Show loader if configured
      if (config.showLoadingOverlay) {
        setShowLoader(true);
        setTransitionPhase('switching');
        await new Promise(resolve => setTimeout(resolve, config.duration * 0.4));
      } else {
        setTransitionPhase('switching');
        await new Promise(resolve => setTimeout(resolve, 100)); // Minimal switch time
      }

      // Phase 3: Fade in new view
      setShowLoader(false);
      setTransitionPhase('fadeIn');

      await new Promise(resolve => setTimeout(resolve, config.duration * 0.3));

      // Complete
      setTransitionPhase('idle');
      onTransitionComplete?.();
    };

    sequence();
  }, [isTransitioning, config.duration, config.showLoadingOverlay, onTransitionComplete]);

  // Generate transition styles
  const getTransitionStyles = () => {
    const baseTransition = `all ${config.duration}ms ${config.easing}`;

    switch (transitionPhase) {
      case 'fadeOut':
        return {
          transition: baseTransition,
          opacity: 0,
          transform: isMobile
            ? 'scale(0.95) translateY(10px)'
            : 'scale(0.98) translateZ(0)',
          filter: 'blur(2px)'
        };

      case 'switching':
        return {
          transition: baseTransition,
          opacity: 0,
          transform: isMobile
            ? 'scale(0.9) translateY(20px)'
            : 'scale(0.95) translateZ(0)',
          filter: 'blur(4px)'
        };

      case 'fadeIn':
        return {
          transition: baseTransition,
          opacity: 1,
          transform: 'scale(1) translateY(0) translateZ(0)',
          filter: 'blur(0)'
        };

      default:
        return {
          transition: baseTransition,
          opacity: 1,
          transform: 'scale(1) translateY(0) translateZ(0)',
          filter: 'blur(0)'
        };
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ perspective: isTablet || !isMobile ? '1000px' : 'none' }}
    >
      {/* Main Content Container */}
      <div
        className="w-full h-full"
        style={getTransitionStyles()}
      >
        {children}
      </div>

      {/* Loading Overlay */}
      {showLoader && (
        <div
          className={classNames(
            'absolute inset-0 flex items-center justify-center',
            'bg-gray-900/80 backdrop-blur-sm z-50'
          )}
        >
          <div className="flex flex-col items-center space-y-4">
            {/* Animated Mode Indicator */}
            <div className="relative">
              <div
                className={classNames(
                  'w-16 h-16 rounded-full border-4 border-gray-600 flex items-center justify-center',
                  'animate-pulse'
                )}
              >
                <span className="text-2xl">
                  {is3DMode ? '🌌' : '📊'}
                </span>
              </div>

              {/* Rotating Border */}
              <div
                className={classNames(
                  'absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent',
                  'border-t-blue-500 border-r-purple-500 animate-spin'
                )}
                style={{ animationDuration: '1s' }}
              />
            </div>

            {/* Loading Text */}
            <div className="text-center">
              <div className="text-white font-medium mb-1">
                Switching to {is3DMode ? '3D Space' : '2D Graph'}
              </div>
              <div className="text-gray-400 text-sm">
                {isMobile
                  ? 'Optimizing for mobile...'
                  : is3DMode
                  ? 'Initializing WebGL renderer...'
                  : 'Preparing D3.js simulation...'
                }
              </div>
            </div>

            {/* Progress Bar (Mobile only) */}
            {isMobile && (
              <div className="w-48 h-1 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-transform duration-1000 ease-out"
                  style={{
                    transform: transitionPhase === 'switching'
                      ? 'translateX(0%)'
                      : 'translateX(-100%)'
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Performance Hint Overlay */}
      {isTransitioning && !isMobile && (
        <div className="absolute top-4 right-4 z-40">
          <div
            className={classNames(
              'bg-gray-800/90 backdrop-blur-sm border border-gray-600 rounded-lg p-3',
              'text-gray-300 text-xs max-w-[200px]'
            )}
          >
            <div className="flex items-center space-x-2 mb-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="font-medium">Performance Mode</span>
            </div>
            <div>
              {is3DMode
                ? 'GPU acceleration enabled for 3D rendering'
                : 'CPU-optimized 2D graph simulation'
              }
            </div>
          </div>
        </div>
      )}

      {/* Debug Information (Development) */}
      {process.env.NODE_ENV === 'development' && isTransitioning && (
        <div className="absolute bottom-4 left-4 z-40">
          <div className="bg-black/80 text-green-400 text-xs font-mono p-2 rounded">
            <div>Phase: {transitionPhase}</div>
            <div>Mode: {is3DMode ? '3D' : '2D'}</div>
            <div>Device: {isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop'}</div>
            <div>Duration: {config.duration}ms</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewTransitionLayer;