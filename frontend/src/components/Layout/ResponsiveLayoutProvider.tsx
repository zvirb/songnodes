import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/index';
import { updateDeviceInfo, setViewportSize } from '../../store/uiSlice';

interface LayoutContextType {
  // Device detection
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  hasTouch: boolean;

  // Screen metrics
  screenSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  orientation: 'portrait' | 'landscape';
  viewportWidth: number;
  viewportHeight: number;

  // Layout states
  isCompactLayout: boolean;
  isFullscreen: boolean;

  // Panel management
  panels: {
    navigation: PanelState;
    controls: PanelState;
    trackInfo: PanelState;
    search: PanelState;
  };

  // Panel actions
  openPanel: (panel: PanelType) => void;
  closePanel: (panel: PanelType) => void;
  togglePanel: (panel: PanelType) => void;
  closeAllPanels: () => void;

  // Layout modes
  setFullscreen: (enabled: boolean) => void;
  setCompactLayout: (enabled: boolean) => void;
}

interface PanelState {
  isOpen: boolean;
  position: 'left' | 'right' | 'top' | 'bottom' | 'center' | 'modal';
  size: 'small' | 'medium' | 'large' | 'fullscreen';
  priority: number; // For stacking order
}

type PanelType = 'navigation' | 'controls' | 'trackInfo' | 'search';

interface ResponsiveLayoutProviderProps {
  children: ReactNode;
}

const LayoutContext = createContext<LayoutContextType | null>(null);

export const useResponsiveLayout = (): LayoutContextType => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useResponsiveLayout must be used within ResponsiveLayoutProvider');
  }
  return context;
};

export const ResponsiveLayoutProvider: React.FC<ResponsiveLayoutProviderProps> = ({ children }) => {
  const dispatch = useAppDispatch();
  const deviceInfo = useAppSelector(state => state.ui.device);

  // Local state for dynamic measurements
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCompactLayout, setIsCompactLayout] = useState(false);

  // Panel states
  const [panels, setPanels] = useState<LayoutContextType['panels']>({
    navigation: {
      isOpen: false,
      position: deviceInfo.isMobile ? 'bottom' : 'left',
      size: deviceInfo.isMobile ? 'small' : 'medium',
      priority: 1
    },
    controls: {
      isOpen: false,
      position: deviceInfo.isMobile ? 'modal' : 'top',
      size: deviceInfo.isMobile ? 'fullscreen' : 'medium',
      priority: 2
    },
    trackInfo: {
      isOpen: false,
      position: deviceInfo.isMobile ? 'modal' : 'right',
      size: deviceInfo.isMobile ? 'fullscreen' : 'large',
      priority: 3
    },
    search: {
      isOpen: false,
      position: deviceInfo.isMobile ? 'modal' : 'center',
      size: deviceInfo.isMobile ? 'fullscreen' : 'medium',
      priority: 4
    }
  });

  // Device detection logic
  const detectDevice = () => {
    const userAgent = navigator.userAgent;
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    const isMobile = /Mobile|Android|iPhone/.test(userAgent) ||
                    (hasTouch && viewportWidth < 768);
    const isTablet = /Tablet|iPad/.test(userAgent) ||
                    (hasTouch && viewportWidth >= 768 && viewportWidth < 1024);
    const isDesktop = !isMobile && !isTablet;

    const screenSize = viewportWidth < 480 ? 'xs' as const :
                      viewportWidth < 768 ? 'sm' as const :
                      viewportWidth < 1024 ? 'md' as const :
                      viewportWidth < 1280 ? 'lg' as const :
                      viewportWidth < 1920 ? 'xl' as const : '2xl' as const;

    const orientation = viewportWidth > viewportHeight ? 'landscape' as const : 'portrait' as const;

    return {
      isMobile,
      isTablet,
      isDesktop,
      hasTouch,
      screenSize,
      orientation,
      pixelRatio: window.devicePixelRatio || 1
    };
  };

  // Update device info on resize
  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;

      setViewportWidth(newWidth);
      setViewportHeight(newHeight);

      // Update Redux store
      dispatch(setViewportSize({ width: newWidth, height: newHeight }));
      dispatch(updateDeviceInfo(detectDevice()));
    };

    const handleOrientationChange = () => {
      // Delay to ensure accurate dimensions after orientation change
      setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    // Initial detection
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [dispatch]);

  // Update panel positions based on device changes
  useEffect(() => {
    const newDeviceInfo = detectDevice();

    setPanels(prev => ({
      navigation: {
        ...prev.navigation,
        position: newDeviceInfo.isMobile ? 'bottom' : 'left',
        size: newDeviceInfo.isMobile ? 'small' : 'medium'
      },
      controls: {
        ...prev.controls,
        position: newDeviceInfo.isMobile ? 'modal' : 'top',
        size: newDeviceInfo.isMobile ? 'fullscreen' : 'medium'
      },
      trackInfo: {
        ...prev.trackInfo,
        position: newDeviceInfo.isMobile ? 'modal' : 'right',
        size: newDeviceInfo.isMobile ? 'fullscreen' : 'large'
      },
      search: {
        ...prev.search,
        position: newDeviceInfo.isMobile ? 'modal' : 'center',
        size: newDeviceInfo.isMobile ? 'fullscreen' : 'medium'
      }
    }));
  }, [deviceInfo.isMobile, deviceInfo.isTablet, deviceInfo.isDesktop]);

  // Panel management functions
  const openPanel = (panel: PanelType) => {
    setPanels(prev => ({
      ...prev,
      [panel]: { ...prev[panel], isOpen: true }
    }));
  };

  const closePanel = (panel: PanelType) => {
    setPanels(prev => ({
      ...prev,
      [panel]: { ...prev[panel], isOpen: false }
    }));
  };

  const togglePanel = (panel: PanelType) => {
    setPanels(prev => ({
      ...prev,
      [panel]: { ...prev[panel], isOpen: !prev[panel].isOpen }
    }));
  };

  const closeAllPanels = () => {
    setPanels(prev =>
      Object.keys(prev).reduce((acc, key) => ({
        ...acc,
        [key]: { ...prev[key as PanelType], isOpen: false }
      }), {} as typeof prev)
    );
  };

  // Computed properties
  const deviceData = detectDevice();
  const isCompactLayoutComputed = isCompactLayout || deviceData.isMobile || viewportWidth < 1024;

  const contextValue: LayoutContextType = {
    // Device detection
    isMobile: deviceData.isMobile,
    isTablet: deviceData.isTablet,
    isDesktop: deviceData.isDesktop,
    hasTouch: deviceData.hasTouch,

    // Screen metrics
    screenSize: deviceData.screenSize,
    orientation: deviceData.orientation,
    viewportWidth,
    viewportHeight,

    // Layout states
    isCompactLayout: isCompactLayoutComputed,
    isFullscreen,

    // Panel states
    panels,

    // Panel actions
    openPanel,
    closePanel,
    togglePanel,
    closeAllPanels,

    // Layout actions
    setFullscreen: setIsFullscreen,
    setCompactLayout: setIsCompactLayout
  };

  return (
    <LayoutContext.Provider value={contextValue}>
      {children}
    </LayoutContext.Provider>
  );
};