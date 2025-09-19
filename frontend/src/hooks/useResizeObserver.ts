import { useEffect, useState } from 'react';

interface Size {
  width: number;
  height: number;
}

export function useResizeObserver(target: HTMLElement | null): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    if (!target) {
      return;
    }

    // Function to get the actual size
    const getSize = () => {
      const rect = target.getBoundingClientRect();
      return {
        width: rect.width || target.offsetWidth || target.clientWidth || window.innerWidth,
        height: rect.height || target.offsetHeight || target.clientHeight || window.innerHeight
      };
    };

    // Set initial size immediately
    const initialSize = getSize();
    setSize(initialSize);

    // Also set size after a brief delay to handle layout timing
    const timeoutId = setTimeout(() => {
      const delayedSize = getSize();
      if (delayedSize.width !== initialSize.width || delayedSize.height !== initialSize.height) {
        setSize(delayedSize);
      }
    }, 50);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setSize({ width, height });
        }
      }
    });

    resizeObserver.observe(target);

    // Also listen to window resize as fallback
    const handleWindowResize = () => {
      const newSize = getSize();
      if (newSize.width > 0 && newSize.height > 0) {
        setSize(newSize);
      }
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [target]);

  return size;
}