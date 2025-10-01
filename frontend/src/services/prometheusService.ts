/**
 * Prometheus Service Client
 * Fetches real-time metrics from Prometheus for scraping and pipeline monitoring
 *
 * Based on 2025 observability best practices
 */

export interface PrometheusMetric {
  metric: Record<string, string>;
  value: [number, string]; // [timestamp, value]
}

export interface PrometheusQueryResult {
  status: string;
  data: {
    resultType: string;
    result: PrometheusMetric[];
  };
}

export interface ScraperMetrics {
  // Scraper health
  scraperUp: Record<string, boolean>;

  // Collection metrics
  totalCollections: number;
  successfulCollections: number;
  failedCollections: number;
  successRate: number;

  // Queue metrics
  queuedCollections: number;
  activeCollections: number;

  // Performance metrics
  avgCollectionDuration: number;
  p95CollectionDuration: number;

  // Data metrics
  totalSongsScraped: number;
  songsScrapedLast24h: number;

  // Error metrics
  recentErrors: number;
  errorRate: number;
}

export interface PipelineMetrics {
  // Pipeline health
  pipelineRuns: {
    total: number;
    successful: number;
    failed: number;
    running: number;
  };

  // Data quality
  avgQualityScore: number;
  qualityTrend: 'improving' | 'declining' | 'stable';

  // Source extraction
  sourceExtractions: {
    attempted: number;
    successful: number;
    failed: number;
    avgResponseTime: number;
  };

  // Graph validation
  graphValidations: {
    total: number;
    passed: number;
    failed: number;
  };

  // Anomalies
  anomalies: {
    critical: number;
    warning: number;
    info: number;
  };
}

export interface SystemMetrics {
  // Database metrics
  dbConnections: {
    active: number;
    idle: number;
    waiting: number;
  };

  // Memory usage
  memoryUsage: Record<string, number>;

  // Request rates
  requestRate: Record<string, number>;

  // Error rates
  errorRate: Record<string, number>;
}

class PrometheusService {
  private baseUrl: string;

  constructor() {
    // Use nginx proxy to avoid CORS issues
    // In production, this will be /prometheus
    // In development, you can set VITE_PROMETHEUS_URL to http://localhost:9091
    this.baseUrl = import.meta.env.VITE_PROMETHEUS_URL || '/prometheus';
  }

  /**
   * Execute a Prometheus query
   */
  private async query(query: string): Promise<PrometheusQueryResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/query?query=${encodeURIComponent(query)}`);

      if (!response.ok) {
        throw new Error(`Prometheus query failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Prometheus query error:', error);
      throw error;
    }
  }

  /**
   * Execute a Prometheus range query
   */
  private async queryRange(query: string, start: number, end: number, step: string = '1m'): Promise<PrometheusQueryResult> {
    try {
      const params = new URLSearchParams({
        query,
        start: start.toString(),
        end: end.toString(),
        step
      });

      const response = await fetch(`${this.baseUrl}/api/v1/query_range?${params}`);

      if (!response.ok) {
        throw new Error(`Prometheus range query failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Prometheus range query error:', error);
      throw error;
    }
  }

  /**
   * Get scraper metrics
   */
  async getScraperMetrics(): Promise<ScraperMetrics> {
    try {
      // Execute multiple queries in parallel
      const [
        scraperUpResult,
        collectionsResult,
        queuedResult,
        activeResult,
        durationResult,
        songsResult
      ] = await Promise.all([
        this.query('up{job=~"scraper-orchestrator|browser-collector"}'),
        this.query('sum by (status) (collection_tasks_total)'),
        this.query('queued_collections'),
        this.query('active_collections'),
        this.query('histogram_quantile(0.95, rate(collection_duration_seconds_bucket[5m]))'),
        this.query('sum(increase(songs_scraped_total[24h]))')
      ]);

      // Parse scraper health
      const scraperUp: Record<string, boolean> = {};
      scraperUpResult.data.result.forEach(m => {
        const job = m.metric.job || 'unknown';
        scraperUp[job] = parseFloat(m.value[1]) === 1;
      });

      // Parse collection metrics
      let totalCollections = 0;
      let successfulCollections = 0;
      let failedCollections = 0;

      collectionsResult.data.result.forEach(m => {
        const count = parseFloat(m.value[1]);
        totalCollections += count;

        if (m.metric.status === 'success') {
          successfulCollections = count;
        } else if (m.metric.status === 'failed') {
          failedCollections = count;
        }
      });

      const successRate = totalCollections > 0 ? (successfulCollections / totalCollections) * 100 : 0;

      // Parse queue and active collections
      const queuedCollections = queuedResult.data.result[0]?.value[1]
        ? parseFloat(queuedResult.data.result[0].value[1])
        : 0;

      const activeCollections = activeResult.data.result[0]?.value[1]
        ? parseFloat(activeResult.data.result[0].value[1])
        : 0;

      // Parse duration metrics
      const p95CollectionDuration = durationResult.data.result[0]?.value[1]
        ? parseFloat(durationResult.data.result[0].value[1])
        : 0;

      // Parse songs scraped
      const totalSongsScraped = songsResult.data.result[0]?.value[1]
        ? parseFloat(songsResult.data.result[0].value[1])
        : 0;

      return {
        scraperUp,
        totalCollections,
        successfulCollections,
        failedCollections,
        successRate,
        queuedCollections,
        activeCollections,
        avgCollectionDuration: p95CollectionDuration * 0.7, // Rough estimate
        p95CollectionDuration,
        totalSongsScraped,
        songsScrapedLast24h: totalSongsScraped,
        recentErrors: failedCollections,
        errorRate: totalCollections > 0 ? (failedCollections / totalCollections) * 100 : 0
      };
    } catch (error) {
      console.error('Failed to fetch scraper metrics:', error);
      throw error;
    }
  }

  /**
   * Get pipeline metrics from REST API
   * (Prometheus doesn't store pipeline-specific metrics like quality scores)
   */
  async getPipelineMetrics(): Promise<PipelineMetrics> {
    try {
      // Use the REST API observability endpoints for detailed pipeline metrics
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8082';
      const response = await fetch(`${apiUrl}/api/v1/observability/metrics/summary`);

      if (!response.ok) {
        throw new Error('Failed to fetch pipeline metrics from API');
      }

      const data = await response.json();

      return {
        pipelineRuns: {
          total: data.summary?.total_runs || 0,
          successful: data.summary?.successful_runs || 0,
          failed: data.summary?.failed_runs || 0,
          running: 0 // Would need to query separately
        },
        avgQualityScore: data.quality_by_pillar?.reduce((sum: number, p: any) => sum + p.avg_score, 0) / (data.quality_by_pillar?.length || 1) || 0,
        qualityTrend: 'stable',
        sourceExtractions: {
          attempted: 0,
          successful: 0,
          failed: 0,
          avgResponseTime: 0
        },
        graphValidations: {
          total: 0,
          passed: 0,
          failed: 0
        },
        anomalies: {
          critical: data.recent_anomalies?.find((a: any) => a.severity === 'critical')?.count || 0,
          warning: data.recent_anomalies?.find((a: any) => a.severity === 'warning')?.count || 0,
          info: data.recent_anomalies?.find((a: any) => a.severity === 'info')?.count || 0
        }
      };
    } catch (error) {
      console.error('Failed to fetch pipeline metrics:', error);
      throw error;
    }
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const [
        dbConnectionsResult,
        memoryResult,
        requestRateResult
      ] = await Promise.all([
        this.query('pg_stat_database_numbackends{datname="musicdb"}'),
        this.query('container_memory_usage_bytes'),
        this.query('rate(http_requests_total[5m])')
      ]);

      // Parse DB connections
      const activeConnections = dbConnectionsResult.data.result[0]?.value[1]
        ? parseFloat(dbConnectionsResult.data.result[0].value[1])
        : 0;

      // Parse memory usage by service
      const memoryUsage: Record<string, number> = {};
      memoryResult.data.result.forEach(m => {
        const container = m.metric.container || m.metric.job || 'unknown';
        const bytes = parseFloat(m.value[1]);
        memoryUsage[container] = Math.round(bytes / 1024 / 1024); // Convert to MB
      });

      // Parse request rates by service
      const requestRate: Record<string, number> = {};
      requestRateResult.data.result.forEach(m => {
        const job = m.metric.job || 'unknown';
        requestRate[job] = parseFloat(m.value[1]);
      });

      return {
        dbConnections: {
          active: activeConnections,
          idle: 0,
          waiting: 0
        },
        memoryUsage,
        requestRate,
        errorRate: {}
      };
    } catch (error) {
      console.error('Failed to fetch system metrics:', error);
      throw error;
    }
  }

  /**
   * Get time series data for charts
   */
  async getScraperTimeSeries(hours: number = 24): Promise<any[]> {
    const now = Math.floor(Date.now() / 1000);
    const start = now - (hours * 3600);

    try {
      const result = await this.queryRange(
        'rate(collection_tasks_total{status="success"}[5m])',
        start,
        now,
        '5m'
      );

      if (result.data.result.length === 0) {
        return [];
      }

      // Transform to chart-friendly format
      return result.data.result[0].values?.map((v: [number, string]) => ({
        timestamp: v[0] * 1000, // Convert to milliseconds
        value: parseFloat(v[1])
      })) || [];
    } catch (error) {
      console.error('Failed to fetch scraper time series:', error);
      return [];
    }
  }
}

// Export singleton instance
export const prometheusService = new PrometheusService();
