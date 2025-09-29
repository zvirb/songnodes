import { useState, useRef, useCallback, Dispatch, SetStateAction, MutableRefObject } from 'react';

/**
 * Custom hook that provides state management with closure-safe access patterns.
 * This hook solves the React stale closure problem by maintaining both state and ref.
 *
 * @template T The type of the state value
 * @param initialValue The initial state value
 * @returns A tuple containing:
 *   - The current state value (for React rendering)
 *   - A ref containing the current value (for use in callbacks/closures)
 *   - A setter function that updates both state and ref
 *
 * @example
 * ```tsx
 * const [isActive, isActiveRef, setIsActive] = useStaleClosureSafeState(false);
 *
 * // Use state for rendering
 * <div>{isActive ? 'Active' : 'Inactive'}</div>
 *
 * // Use ref in callbacks to avoid stale closures
 * const handleTimeout = useCallback(() => {
 *   setTimeout(() => {
 *     if (isActiveRef.current) { // Always current value
 *       doSomething();
 *     }
 *   }, 5000);
 * }, []); // No dependencies needed!
 * ```
 *
 * @since 2025 - Best practice for handling React closure issues
 */
export function useStaleClosureSafeState<T>(
  initialValue: T | (() => T)
): [T, MutableRefObject<T>, Dispatch<SetStateAction<T>>] {
  // Initialize state with the standard useState hook
  const [state, setState] = useState<T>(initialValue);

  // Initialize ref with the same initial value
  const stateRef = useRef<T>(
    typeof initialValue === 'function'
      ? (initialValue as () => T)()
      : initialValue
  );

  // Create a wrapped setter that updates both state and ref
  const setStateAndRef = useCallback<Dispatch<SetStateAction<T>>>((newValue) => {
    setState(prevState => {
      const nextState = typeof newValue === 'function'
        ? (newValue as (prev: T) => T)(prevState)
        : newValue;

      // CRITICAL: Update ref immediately to avoid any timing issues
      stateRef.current = nextState;

      return nextState;
    });
  }, []);

  // Return state for rendering, ref for closures, and the synchronized setter
  return [state, stateRef, setStateAndRef];
}

/**
 * Alternative version that returns an object for better naming
 *
 * @example
 * ```tsx
 * const connectionStatus = useStaleClosureSafeStateObject({
 *   connected: false,
 *   retryCount: 0
 * });
 *
 * // Access pattern
 * connectionStatus.value // for rendering
 * connectionStatus.ref.current // for callbacks
 * connectionStatus.set // for updating
 * ```
 */
export function useStaleClosureSafeStateObject<T>(
  initialValue: T | (() => T)
) {
  const [value, ref, set] = useStaleClosureSafeState(initialValue);

  return {
    value,
    ref,
    set,
    // Convenience getter for ref.current
    current: () => ref.current
  };
}

/**
 * Hook specifically designed for boolean flags (common use case)
 *
 * @example
 * ```tsx
 * const { isActive, isActiveRef, setIsActive, toggle } = useStaleClosureSafeBoolean(false);
 *
 * // Has a bonus toggle function for convenience
 * <button onClick={toggle}>Toggle</button>
 * ```
 */
export function useStaleClosureSafeBoolean(initialValue: boolean = false) {
  const [value, ref, set] = useStaleClosureSafeState(initialValue);

  const toggle = useCallback(() => {
    set(prev => !prev);
  }, [set]);

  return {
    value,
    ref,
    set,
    toggle,
    // Convenience methods
    setTrue: useCallback(() => set(true), [set]),
    setFalse: useCallback(() => set(false), [set])
  };
}

/**
 * Hook for managing counters with closure-safe increments/decrements
 *
 * @example
 * ```tsx
 * const retryCount = useStaleClosureSafeCounter(0, { max: 5 });
 *
 * // In a setTimeout or interval
 * if (retryCount.ref.current < retryCount.max) {
 *   retryCount.increment();
 * }
 * ```
 */
export function useStaleClosureSafeCounter(
  initialValue: number = 0,
  options?: { min?: number; max?: number; step?: number }
) {
  const [value, ref, set] = useStaleClosureSafeState(initialValue);
  const { min = -Infinity, max = Infinity, step = 1 } = options || {};

  const increment = useCallback(() => {
    set(prev => Math.min(prev + step, max));
  }, [set, step, max]);

  const decrement = useCallback(() => {
    set(prev => Math.max(prev - step, min));
  }, [set, step, min]);

  const reset = useCallback(() => {
    set(initialValue);
  }, [set, initialValue]);

  return {
    value,
    ref,
    set,
    increment,
    decrement,
    reset,
    max,
    min
  };
}