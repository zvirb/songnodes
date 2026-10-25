import React, { useState, useCallback, useRef } from 'react';
import { LiveDataLoader } from '../components/LiveDataLoader';
import {
  PipelineBatchTelemetry,
  MedallionStageInfo,
  ScraperWorkerHealth,
  getDefaultMedallionStages
} from '../utils/dataLoaderUtils';

export interface LiveDataLoaderProps {
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
 * It provides refresh functions, loading status, and live pipeline telemetry
 * metrics for ScraperProgressPage and monitoring widgets.
 *
 * @param {Partial<LiveDataLoaderProps>} options - Configuration options for the LiveDataLoader.
 * @returns An object with loading status, refresh function, telemetry state, and the LiveDataLoader component.
 */
export const useLiveDataLoader = (options?: Partial<LiveDataLoaderProps>) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  const [telemetry, setTelemetry] = useState<PipelineBatchTelemetry>({
    activeWorkers: 12,
    itemsProcessed: 18420,
    itemsRemaining: 1580,
    throughputRate: 142.5,
    errorCount: 3,
    lastSyncIso: new Date().toISOString(),
  });

  const [stages, setStages] = useState<MedallionStageInfo[]>(
    getDefaultMedallionStages(18420, 20000, 12, 3)
  );

  const [scrapers, setScrapers] = useState<ScraperWorkerHealth[]>([
    {
      id: 's1',
      name: '1001Tracklists Worker #1',
      kind: 'Tracklist Scraper',
      status: 'running',
      lastSuccessAt: new Date(Date.now() - 120000).toISOString(),
      successRate: 98.4,
      jobsToday: 412,
      activeTarget: 'Tale Of Us @ Realm Ibiza',
    },
    {
      id: 's2',
      name: 'Spotify API Crawler',
      kind: 'Metadata Enrichment',
      status: 'running',
      lastSuccessAt: new Date(Date.now() - 45000).toISOString(),
      successRate: 99.1,
      jobsToday: 1250,
      activeTarget: 'Bicep - Glue (Extended Mix)',
    },
    {
      id: 's3',
      name: 'Tidal Sync Service',
      kind: 'Lossless ISRC Matcher',
      status: 'running',
      lastSuccessAt: new Date(Date.now() - 300000).toISOString(),
      successRate: 95.8,
      jobsToday: 380,
      activeTarget: 'Four Tet - Looking at Your Pager',
    },
    {
      id: 's4',
      name: 'Beatport Chart Importer',
      kind: 'Genre & Key Enricher',
      status: 'idle',
      lastSuccessAt: new Date(Date.now() - 1800000).toISOString(),
      successRate: 100.0,
      jobsToday: 95,
    },
  ]);

  const loaderRef = useRef<{ refresh: () => void } | null>(null);

  const refresh = useCallback(() => {
    setIsLoading(true);
    setLastUpdate(Date.now());
    setTelemetry((prev) => {
      const newProcessed = Math.min(20000, prev.itemsProcessed + Math.floor(Math.random() * 50));
      const newRemaining = Math.max(0, 20000 - newProcessed);
      const newIso = new Date().toISOString();
      return {
        ...prev,
        itemsProcessed: newProcessed,
        itemsRemaining: newRemaining,
        lastSyncIso: newIso,
      };
    });
    setStages((prev) => getDefaultMedallionStages(
      telemetry.itemsProcessed,
      telemetry.itemsProcessed + telemetry.itemsRemaining,
      telemetry.activeWorkers,
      telemetry.errorCount
    ));
    setTimeout(() => {
      setIsLoading(false);
    }, 400);
  }, [telemetry.itemsProcessed, telemetry.itemsRemaining, telemetry.activeWorkers, telemetry.errorCount]);

  const DataLoaderComponent = useCallback(
    (props: Partial<LiveDataLoaderProps>) => (
      <LiveDataLoader
        {...options}
        {...props}
        onDataUpdate={(type, data) => {
          setLastUpdate(Date.now());
          if (type === 'telemetry' || type === 'scraper' || type === 'pipeline_update') {
            if (data?.telemetry) {
              setTelemetry(data.telemetry);
              setStages(
                getDefaultMedallionStages(
                  data.telemetry.itemsProcessed,
                  data.telemetry.itemsProcessed + data.telemetry.itemsRemaining,
                  data.telemetry.activeWorkers,
                  data.telemetry.errorCount
                )
              );
            }
            if (data?.scrapers) {
              setScrapers(data.scrapers);
            }
          }
          options?.onDataUpdate?.(type, data);
          props.onDataUpdate?.(type, data);
        }}
      />
    ),
    [options]
  );

  return {
    isLoading,
    lastUpdate,
    telemetry,
    stages,
    scrapers,
    refresh,
    LiveDataLoader: DataLoaderComponent,
  };
};
