/**
 * @file Data Loader Utilities
 * @description Contains helper functions for LiveDataLoader, Pipeline Telemetry, and Scraper Progress.
 */

import { GraphNode } from '../types';

/**
 * Checks if a graph node has a valid, non-generic artist attribution.
 * This is used to filter out tracks that are likely part of a mix or compilation
 * with generic artist names like "Various Artists".
 *
 * @param {GraphNode} node - The graph node to validate.
 * @returns {boolean} True if the artist name is considered valid, false otherwise.
 */
export const hasValidArtist = (node: GraphNode): boolean => {
  const artist = node.artist || node.metadata?.artist;

  if (!artist) return false;

  const normalizedArtist = String(artist).toLowerCase().trim();

  const invalidArtists = new Set(['unknown', 'unknown artist', 'various artists', 'various', 'va']);
  if (invalidArtists.has(normalizedArtist)) return false;

  const invalidPrefixes = ['va @', 'various artists @', 'unknown artist,', 'unknown artist @'];
  if (invalidPrefixes.some(prefix => normalizedArtist.startsWith(prefix))) return false;

  return true;
};

export type MedallionStageId = 'bronze' | 'silver' | 'gold' | 'serving';
export type PipelineStageState = 'done' | 'running' | 'waiting' | 'warning' | 'failed' | 'cancelled';

export interface MedallionStageInfo {
  id: MedallionStageId;
  name: string;
  description: string;
  state: PipelineStageState;
  done: number;
  total: number;
  detail?: string;
  seconds?: number;
}

export interface PipelineBatchTelemetry {
  activeWorkers: number;
  itemsProcessed: number;
  itemsRemaining: number;
  throughputRate: number | null; // items per minute (null if < 2 points)
  errorCount: number;
  lastSyncIso: string;
}

export interface ScraperWorkerHealth {
  id: string;
  name: string;
  kind: string;
  status: 'idle' | 'running' | 'error' | 'disabled' | 'circuit_open';
  lastSuccessAt: string | null;
  successRate: number;
  jobsToday: number;
  activeTarget?: string;
}

export interface JobResponse {
  job_id: string;
  kind: string;
  idempotency_key: string;
  status: 'queued' | 'running' | 'succeeded' | 'dead';
  attempts: number;
  max_attempts: number;
  run_after: string;
  started_at: string | null;
  finished_at: string | null;
  last_error: string | null;
  payload: Record<string, any>;
  result: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface OutboxStatusResponse {
  consumers: Array<{ consumer: string; backlog: number; updated_at: string | null }>;
  dead_letters: number;
  projection: any;
}

/**
 * Calculate default Medallion Pipeline Stages given raw processing metrics
 */
export const getDefaultMedallionStages = (
  processed = 18420,
  total = 20000,
  activeWorkers = 12,
  errorCount = 3
): MedallionStageInfo[] => {
  const isComplete = processed >= total;
  const isSilverActive = processed > 5000;
  const isGoldActive = processed > 12000;
  const isServingActive = processed > 18000;

  return [
    {
      id: 'bronze',
      name: "Stage 1: bronze ingestion",
      description: 'Raw scraping & API queries from 1001TL, Spotify & Tidal',
      state: isComplete ? 'done' : 'running',
      done: Math.min(processed, total),
      total: total,
      detail: isComplete
        ? `Ingested ${total.toLocaleString()} raw track logs`
        : `Fetching targets via ${activeWorkers} active worker processes`,
      seconds: 245,
    },
    {
      id: 'silver',
      name: "Stage 2: silver normalization",
      description: 'Artist cleaning, schema validation & key/BPM standardization',
      state: isComplete ? 'done' : isSilverActive ? 'running' : 'waiting',
      done: isComplete ? total : Math.floor(processed * 0.95),
      total: total,
      detail: isSilverActive
        ? `Validated ${Math.floor(processed * 0.95).toLocaleString()} normalized entities (${errorCount} validation errors)`
        : 'Awaiting raw ingestion stream',
      seconds: isComplete ? 180 : undefined,
    },
    {
      id: 'gold',
      name: "Stage 3: gold graphing",
      description: 'Adjacency matrix generation, track affinity & edge weighting',
      state: isComplete ? 'done' : isGoldActive ? 'running' : 'waiting',
      done: isComplete ? total : Math.floor(processed * 0.88),
      total: total,
      detail: isGoldActive
        ? `Computed harmonic affinity and co-occurrence edges`
        : 'Queued for graph computation',
      seconds: isComplete ? 112 : undefined,
    },
    {
      id: 'serving',
      name: "Stage 4: serving index",
      description: 'Operational cache synchronization & client delivery',
      state: isComplete ? 'done' : isServingActive ? 'running' : 'waiting',
      done: isComplete ? total : Math.floor(processed * 0.82),
      total: total,
      detail: isServingActive
        ? 'Warming Redis cache and indexing graph vectors'
        : 'Waiting for graph batch completion',
      seconds: isComplete ? 45 : undefined,
    },
  ];
};

/**
 * Format throughput rates cleanly
 */
export const formatThroughput = (rate: number | null): string => {
  if (rate === null) return '—';
  if (rate >= 1000) {
    return `${(rate / 1000).toFixed(1)}k items/min`;
  }
  return `${rate.toFixed(1)} items/min`;
};

/**
 * Map status strings to tokenized design system status colors
 */
export const getStatusTokenColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'ok':
    case 'done':
    case 'running':
    case 'healthy':
    case 'success':
      return 'var(--status-ok)';
    case 'warn':
    case 'circuit_open':
    case 'degraded':
      return 'var(--status-warn)';
    case 'bad':
    case 'error':
    case 'failed':
      return 'var(--status-bad)';
    case 'info':
    case 'idle':
    case 'waiting':
    case 'disabled':
    default:
      return 'var(--status-info)';
  }
};
