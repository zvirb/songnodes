import { useCallback, useRef } from 'react';

export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCallTime = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);
  
  // Update callback ref without triggering re-render
  callbackRef.current = callback;

  const throttledCallback = useCallback(
    ((...args: Parameters<T>) => {
      const now = performance.now();
      const timeSinceLastCall = now - lastCallTime.current;

      if (timeSinceLastCall >= delay) {
        // Enough time has passed, execute immediately
        lastCallTime.current = now;
        callbackRef.current(...args);
      } else {
        // Not enough time has passed, schedule for later
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        const remainingTime = delay - timeSinceLastCall;
        timeoutRef.current = setTimeout(() => {
          lastCallTime.current = performance.now();
          callbackRef.current(...args);
          timeoutRef.current = null;
        }, remainingTime);
      }
    }) as T,
    [delay]
  );

  return throttledCallback;
}

/**
 * Enhanced throttled callback with requestAnimationFrame for visual updates
 */
export function useRAFThrottledCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const rafId = useRef<number | null>(null);
  const callbackRef = useRef(callback);
  const argsRef = useRef<Parameters<T> | null>(null);
  
  // Update callback ref without triggering re-render
  callbackRef.current = callback;

  const throttledCallback = useCallback(
    ((...args: Parameters<T>) => {
      // Store the latest arguments
      argsRef.current = args;
      
      // If we already have a pending RAF, don't schedule another
      if (rafId.current !== null) {
        return;
      }

      rafId.current = requestAnimationFrame(() => {
        if (argsRef.current !== null) {
          callbackRef.current(...argsRef.current);
          argsRef.current = null;
        }
        rafId.current = null;
      });
    }) as T,
    []
  );

  return throttledCallback;
}