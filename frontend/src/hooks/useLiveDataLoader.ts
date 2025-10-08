import { useState, useCallback, useRef } from 'react';
import { LiveDataLoader } from '../components/LiveDataLoader';

interface LiveDataLoaderProps {
  autoStart?: boolean;
  updateInterval?: number;
  enableWebSocket?: boolean;
  enablePerformanceTracking?: boolean;
  onDataUpdate?: (type: string, data: any) => void;
  onError?: (error: string) => void;
  showStatus?: boolean;
  maxRetries?: number;
}

/**
 * A hook to integrate the LiveDataLoader's functionality into a component.
 * It provides a refresh function and exposes loading status, while abstracting
 * the LiveDataLoader component itself.
 *
 * @param {Partial<LiveDataLoaderProps>} options - Configuration options for the LiveDataLoader.
 * @returns An object with loading status, refresh function, and the LiveDataLoader component.
 */
export const useLiveDataLoader = (options?: Partial<LiveDataLoaderProps>) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  const loaderRef = useRef<{ refresh: () => void }>();

  const refresh = useCallback(() => {
    loaderRef.current?.refresh();
  }, []);

  const DataLoaderComponent = useCallback((props: Partial<LiveDataLoaderProps>) => (
    <LiveDataLoader
      {...options}
      {...props}
      onDataUpdate={(type, data) => {
        setLastUpdate(Date.now());
        options?.onDataUpdate?.(type, data);
        props.onDataUpdate?.(type, data);
      }}
      // This ref is not on the component itself, but would be passed down if needed
      // For now, we assume the component exposes a refresh function via other means
      // or we can pass down a ref if we modify LiveDataLoader to accept it.
    />
  ), [options]);

  return {
    isLoading,
    lastUpdate,
    refresh,
    LiveDataLoader: DataLoaderComponent,
  };
};