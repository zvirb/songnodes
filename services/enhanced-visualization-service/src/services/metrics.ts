/**
 * Prometheus Metrics Service for Enhanced Visualization Service
 * Comprehensive monitoring and metrics collection
 */

import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

/**
 * Metrics service for collecting and exposing Prometheus metrics
 */
export class MetricsService {
  // HTTP request metrics
  public readonly httpRequestTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
  });

  public readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  });

  // WebSocket connection metrics
  public readonly websocketConnections = new Gauge({
    name: 'websocket_connections_active',
    help: 'Number of active WebSocket connections',
  });

  public readonly websocketConnectionsTotal = new Counter({
    name: 'websocket_connections_total',
    help: 'Total number of WebSocket connections established',
  });

  public readonly websocketDisconnectionsTotal = new Counter({
    name: 'websocket_disconnections_total',
    help: 'Total number of WebSocket disconnections',
    labelNames: ['reason'],
  });

  public readonly websocketMessagesSent = new Counter({
    name: 'websocket_messages_sent_total',
    help: 'Total number of WebSocket messages sent',
    labelNames: ['type'],
  });

  public readonly websocketMessagesReceived = new Counter({
    name: 'websocket_messages_received_total',
    help: 'Total number of WebSocket messages received',
    labelNames: ['type'],
  });

  public readonly websocketMessageSize = new Histogram({
    name: 'websocket_message_size_bytes',
    help: 'Size of WebSocket messages in bytes',
    labelNames: ['direction', 'type'],
    buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  });

  // Database metrics
  public readonly databaseConnections = new Gauge({
    name: 'database_connections_active',
    help: 'Number of active database connections',
  });

  public readonly databaseQueryDuration = new Histogram({
    name: 'database_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['operation', 'table'],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  });

  public readonly databaseQueryTotal = new Counter({
    name: 'database_queries_total',
    help: 'Total number of database queries',
    labelNames: ['operation', 'table', 'status'],
  });

  // Redis metrics
  public readonly redisConnections = new Gauge({
    name: 'redis_connections_active',
    help: 'Number of active Redis connections',
  });

  public readonly redisOperationDuration = new Histogram({
    name: 'redis_operation_duration_seconds',
    help: 'Duration of Redis operations in seconds',
    labelNames: ['operation'],
    buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
  });

  public readonly redisOperationTotal = new Counter({
    name: 'redis_operations_total',
    help: 'Total number of Redis operations',
    labelNames: ['operation', 'status'],
  });

  // Visualization metrics
  public readonly graphRenderTime = new Histogram({
    name: 'graph_render_duration_seconds',
    help: 'Time taken to render graph visualizations',
    labelNames: ['type', 'node_count_range'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
  });

  public readonly graphNodesRendered = new Counter({
    name: 'graph_nodes_rendered_total',
    help: 'Total number of graph nodes rendered',
    labelNames: ['type'],
  });

  public readonly graphEdgesRendered = new Counter({
    name: 'graph_edges_rendered_total',
    help: 'Total number of graph edges rendered',
    labelNames: ['type'],
  });

  public readonly activeVisualizationSessions = new Gauge({
    name: 'visualization_sessions_active',
    help: 'Number of active visualization sessions',
  });

  public readonly visualizationSessionDuration = new Histogram({
    name: 'visualization_session_duration_seconds',
    help: 'Duration of visualization sessions',
    buckets: [30, 60, 300, 600, 1800, 3600, 7200, 14400], // 30s to 4h
  });

  // Memory and performance metrics
  public readonly memoryUsage = new Gauge({
    name: 'memory_usage_bytes',
    help: 'Memory usage in bytes',
    labelNames: ['type'],
  });

  public readonly cpuUsage = new Gauge({
    name: 'cpu_usage_percent',
    help: 'CPU usage percentage',
  });

  public readonly eventLoopLag = new Histogram({
    name: 'event_loop_lag_seconds',
    help: 'Event loop lag in seconds',
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  });

  // Cache metrics
  public readonly cacheHitRate = new Counter({
    name: 'cache_operations_total',
    help: 'Total cache operations',
    labelNames: ['type', 'result'], // type: get/set/del, result: hit/miss/success/error
  });

  public readonly cacheSizeBytes = new Gauge({
    name: 'cache_size_bytes',
    help: 'Current cache size in bytes',
    labelNames: ['cache_type'],
  });

  // Error metrics
  public readonly errorTotal = new Counter({
    name: 'errors_total',
    help: 'Total number of errors',
    labelNames: ['type', 'code', 'service'],
  });

  // Service health metrics
  public readonly serviceUptime = new Gauge({
    name: 'service_uptime_seconds',
    help: 'Service uptime in seconds',
  });

  public readonly serviceHealth = new Gauge({
    name: 'service_health_status',
    help: 'Service health status (1 = healthy, 0 = unhealthy)',
    labelNames: ['service', 'check_type'],
  });

  private startTime: number;
  private memoryMonitorInterval?: NodeJS.Timeout;
  private eventLoopMonitorInterval?: NodeJS.Timeout;

  constructor() {
    this.startTime = Date.now();
    
    // Collect default Node.js metrics
    collectDefaultMetrics({
      register,
      prefix: 'enhanced_viz_',
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
    });

    this.setupMemoryMonitoring();
    this.setupEventLoopMonitoring();
  }

  /**
   * Set up memory usage monitoring
   */
  private setupMemoryMonitoring(): void {
    this.memoryMonitorInterval = setInterval(() => {
      const memUsage = process.memoryUsage();
      
      this.memoryUsage.set({ type: 'rss' }, memUsage.rss);
      this.memoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
      this.memoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
      this.memoryUsage.set({ type: 'external' }, memUsage.external);
      
      // Update service uptime
      this.serviceUptime.set((Date.now() - this.startTime) / 1000);
    }, 5000); // Update every 5 seconds
  }

  /**
   * Set up event loop lag monitoring
   */
  private setupEventLoopMonitoring(): void {
    this.eventLoopMonitorInterval = setInterval(() => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1e9;
        this.eventLoopLag.observe(lag);
      });
    }, 1000); // Check every second
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.httpRequestTotal.inc({ method, route, status_code: statusCode.toString() });
    this.httpRequestDuration.observe(
      { method, route, status_code: statusCode.toString() },
      duration
    );
  }

  /**
   * Record WebSocket connection metrics
   */
  recordWebSocketConnection(): void {
    this.websocketConnections.inc();
    this.websocketConnectionsTotal.inc();
  }

  /**
   * Record WebSocket disconnection metrics
   */
  recordWebSocketDisconnection(reason: string): void {
    this.websocketConnections.dec();
    this.websocketDisconnectionsTotal.inc({ reason });
  }

  /**
   * Record WebSocket message metrics
   */
  recordWebSocketMessage(
    direction: 'sent' | 'received',
    type: string,
    sizeBytes: number
  ): void {
    if (direction === 'sent') {
      this.websocketMessagesSent.inc({ type });
    } else {
      this.websocketMessagesReceived.inc({ type });
    }
    
    this.websocketMessageSize.observe(
      { direction, type },
      sizeBytes
    );
  }

  /**
   * Record database query metrics
   */
  recordDatabaseQuery(
    operation: string,
    table: string,
    duration: number,
    success: boolean
  ): void {
    const status = success ? 'success' : 'error';
    this.databaseQueryTotal.inc({ operation, table, status });
    this.databaseQueryDuration.observe({ operation, table }, duration);
  }

  /**
   * Record Redis operation metrics
   */
  recordRedisOperation(operation: string, duration: number, success: boolean): void {
    const status = success ? 'success' : 'error';
    this.redisOperationTotal.inc({ operation, status });
    this.redisOperationDuration.observe({ operation }, duration);
  }

  /**
   * Record visualization render metrics
   */
  recordGraphRender(type: string, nodeCount: number, duration: number): void {
    const nodeCountRange = this.getNodeCountRange(nodeCount);
    this.graphRenderTime.observe({ type, node_count_range: nodeCountRange }, duration);
  }

  /**
   * Record visualization session metrics
   */
  recordVisualizationSession(duration: number): void {
    this.visualizationSessionDuration.observe(duration);
  }

  /**
   * Record cache operation metrics
   */
  recordCacheOperation(type: 'get' | 'set' | 'del', result: 'hit' | 'miss' | 'success' | 'error'): void {
    this.cacheHitRate.inc({ type, result });
  }

  /**
   * Record error metrics
   */
  recordError(type: string, code: string, service: string): void {
    this.errorTotal.inc({ type, code, service });
  }

  /**
   * Update service health status
   */
  updateServiceHealth(service: string, checkType: string, healthy: boolean): void {
    this.serviceHealth.set({ service, check_type: checkType }, healthy ? 1 : 0);
  }

  /**
   * Get node count range for metrics labeling
   */
  private getNodeCountRange(nodeCount: number): string {
    if (nodeCount <= 100) return '0-100';
    if (nodeCount <= 500) return '101-500';
    if (nodeCount <= 1000) return '501-1000';
    if (nodeCount <= 5000) return '1001-5000';
    if (nodeCount <= 10000) return '5001-10000';
    return '10000+';
  }

  /**
   * Get metrics registry for Prometheus scraping
   */
  getMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    register.resetMetrics();
  }

  /**
   * Clean up monitoring intervals
   */
  cleanup(): void {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
    }
    if (this.eventLoopMonitorInterval) {
      clearInterval(this.eventLoopMonitorInterval);
    }
  }
}

// Export singleton instance
export const metricsService = new MetricsService();