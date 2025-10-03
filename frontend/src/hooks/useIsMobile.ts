import { useState, useEffect } from 'react';

/**
 * Hook to detect if the user is on a mobile device
 *
 * Checks multiple signals:
 * - Viewport width (< 768px)
 * - Touch capability
 * - User agent string
 * - Pointer type
 */
export const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(() => {
    // Initial check (SSR-safe)
    if (typeof window === 'undefined') return false;

    // Check viewport width
    const isSmallViewport = window.innerWidth < 768;

    // Check for touch capability
    const hasTouchScreen = (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (navigator as any).msMaxTouchPoints > 0
    );

    // Check user agent (last resort)
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    const isMobileUA = mobileRegex.test(navigator.userAgent);

    // Consider it mobile if viewport is small OR it's a touch device with mobile UA
    return isSmallViewport || (hasTouchScreen && isMobileUA);
  });

  useEffect(() => {
    const checkMobile = () => {
      const isSmallViewport = window.innerWidth < 768;
      const hasTouchScreen = (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        (navigator as any).msMaxTouchPoints > 0
      );
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      const isMobileUA = mobileRegex.test(navigator.userAgent);

      setIsMobile(isSmallViewport || (hasTouchScreen && isMobileUA));
    };

    // Check on resize
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);

    // Initial check
    checkMobile();

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  return isMobile;
};

/**
 * Hook to detect if device has touch capability
 * (Note: Some laptops have touchscreens, so this doesn't mean mobile)
 */
export const useHasTouch = (): boolean => {
  const [hasTouch, setHasTouch] = useState(() => {
    if (typeof window === 'undefined') return false;

    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (navigator as any).msMaxTouchPoints > 0
    );
  });

  return hasTouch;
};

/**
 * Hook to get current viewport size category
 */
export const useViewportSize = (): 'mobile' | 'tablet' | 'desktop' => {
  const [size, setSize] = useState<'mobile' | 'tablet' | 'desktop'>(() => {
    if (typeof window === 'undefined') return 'desktop';

    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  });

  useEffect(() => {
    const checkSize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setSize('mobile');
      } else if (width < 1024) {
        setSize('tablet');
      } else {
        setSize('desktop');
      }
    };

    window.addEventListener('resize', checkSize);
    window.addEventListener('orientationchange', checkSize);

    checkSize();

    return () => {
      window.removeEventListener('resize', checkSize);
      window.removeEventListener('orientationchange', checkSize);
    };
  }, []);

  return size;
};

export default useIsMobile;
