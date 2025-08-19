import { useEffect, useState } from 'react';

interface Size {
  width: number;
  height: number;
}

export function useResizeObserver(target: HTMLElement | null): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    if (!target) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      }
    });

    resizeObserver.observe(target);

    return () => {
      resizeObserver.disconnect();
    };
  }, [target]);

  return size;
}