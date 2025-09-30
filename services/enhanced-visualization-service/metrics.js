/**
 * Comprehensive Prometheus Metrics Module for Enhanced Visualization Service
 * This module provides all the metrics expected by the Grafana dashboard
 */

import client from 'prom-client';

// Create a Registry
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Service health gauge
const serviceHealth = new client.Gauge({
  name: 'up',
  help: 'Service health status (1 = up, 0 = down)',
  labelNames: ['job'],
  registers: [register]
});

// WebSocket metrics
const websocketConnectionsActive = new client.Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections',
  labelNames: ['job'],
  registers: [register]
});

const websocketConnectionsTotal = new client.Counter({
  name: 'websocket_connections_total',
  help: 'Total number of WebSocket connections established',
  labelNames: ['job'],
  registers: [register]
});

const websocketDisconnectionsTotal = new client.Counter({
  name: 'websocket_disconnections_total',
  help: 'Total number of WebSocket disconnections',
  labelNames: ['job'],
  registers: [register]
});

const websocketMessagesSentTotal = new client.Counter({
  name: 'websocket_messages_sent_total',
  help: 'Total number of WebSocket messages sent',
  labelNames: ['job'],
  registers: [register]
});

const websocketMessagesReceivedTotal = new client.Counter({
  name: 'websocket_messages_received_total',
  help: 'Total number of WebSocket messages received',
  labelNames: ['job'],
  registers: [register]
});

// Visualization sessions
const visualizationSessionsActive = new client.Gauge({
  name: 'visualization_sessions_active',
  help: 'Number of active visualization sessions',
  labelNames: ['job'],
  registers: [register]
});

// HTTP metrics
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'job'],
  registers: [register]
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code', 'job'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
});

// Graph rendering metrics
const graphRenderDuration = new client.Histogram({
  name: 'graph_render_duration_seconds',
  help: 'Graph rendering duration in seconds',
  labelNames: ['type', 'job'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

const graphNodesRenderedTotal = new client.Counter({
  name: 'graph_nodes_rendered_total',
  help: 'Total number of graph nodes rendered',
  labelNames: ['job'],
  registers: [register]
});

const graphEdgesRenderedTotal = new client.Counter({
  name: 'graph_edges_rendered_total',
  help: 'Total number of graph edges rendered',
  labelNames: ['job'],
  registers: [register]
});

// Memory metrics (custom)
const memoryUsageBytes = new client.Gauge({
  name: 'memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type', 'job'],
  registers: [register]
});

// Event loop lag
const eventLoopLag = new client.Histogram({
  name: 'event_loop_lag_seconds',
  help: 'Event loop lag in seconds',
  labelNames: ['job'],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register]
});

// Database and cache connections
const databaseCacheConnections = new client.Gauge({
  name: 'database_cache_connections',
  help: 'Number of database and cache connections',
  labelNames: ['type', 'job'],
  registers: [register]
});

// Error rate
const errorRate = new client.Counter({
  name: 'error_total',
  help: 'Total number of errors',
  labelNames: ['type', 'job'],
  registers: [register]
});

// Initialize service health
serviceHealth.set({ job: 'enhanced-visualization-service' }, 1);

// Middleware to track HTTP metrics
export function httpMetricsMiddleware(req, res, next) {
  const start = Date.now();
  const route = req.route ? req.route.path : req.url;

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const labels = {
      method: req.method,
      route: route,
      status_code: res.statusCode,
      job: 'enhanced-visualization-service'
    };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duration);
  });

  next();
}

// Update memory metrics periodically
export function updateMemoryMetrics() {
  const memUsage = process.memoryUsage();
  memoryUsageBytes.set({ type: 'heapUsed', job: 'enhanced-visualization-service' }, memUsage.heapUsed);
  memoryUsageBytes.set({ type: 'heapTotal', job: 'enhanced-visualization-service' }, memUsage.heapTotal);
  memoryUsageBytes.set({ type: 'rss', job: 'enhanced-visualization-service' }, memUsage.rss);
  memoryUsageBytes.set({ type: 'external', job: 'enhanced-visualization-service' }, memUsage.external);
}

// WebSocket connection tracking
export function onWebSocketConnection() {
  websocketConnectionsTotal.inc({ job: 'enhanced-visualization-service' });
  websocketConnectionsActive.inc({ job: 'enhanced-visualization-service' });
  visualizationSessionsActive.inc({ job: 'enhanced-visualization-service' });
}

export function onWebSocketDisconnection() {
  websocketDisconnectionsTotal.inc({ job: 'enhanced-visualization-service' });
  websocketConnectionsActive.dec({ job: 'enhanced-visualization-service' });
  visualizationSessionsActive.dec({ job: 'enhanced-visualization-service' });
}

export function onWebSocketMessageSent() {
  websocketMessagesSentTotal.inc({ job: 'enhanced-visualization-service' });
}

export function onWebSocketMessageReceived() {
  websocketMessagesReceivedTotal.inc({ job: 'enhanced-visualization-service' });
}

// Graph rendering tracking
export function trackGraphRender(type, duration, nodeCount, edgeCount) {
  graphRenderDuration.observe({ type, job: 'enhanced-visualization-service' }, duration);
  graphNodesRenderedTotal.inc({ job: 'enhanced-visualization-service' }, nodeCount);
  graphEdgesRenderedTotal.inc({ job: 'enhanced-visualization-service' }, edgeCount);
}

// Event loop monitoring
let eventLoopLagInterval;
export function startEventLoopMonitoring() {
  let lastTime = Date.now();

  eventLoopLagInterval = setInterval(() => {
    const now = Date.now();
    const lag = (now - lastTime - 1000) / 1000; // Expected 1s interval
    if (lag > 0) {
      eventLoopLag.observe({ job: 'enhanced-visualization-service' }, lag);
    }
    lastTime = now;
  }, 1000);
}

export function stopEventLoopMonitoring() {
  if (eventLoopLagInterval) {
    clearInterval(eventLoopLagInterval);
  }
}

// Database connection tracking
export function updateDatabaseConnections(poolSize) {
  databaseCacheConnections.set({ type: 'postgresql', job: 'enhanced-visualization-service' }, poolSize);
}

export function updateCacheConnections(redisConnections) {
  databaseCacheConnections.set({ type: 'redis', job: 'enhanced-visualization-service' }, redisConnections);
}

// Error tracking
export function trackError(type) {
  errorRate.inc({ type, job: 'enhanced-visualization-service' });
}

// Start memory metrics update interval
setInterval(updateMemoryMetrics, 5000);

// Start event loop monitoring
startEventLoopMonitoring();

// Export the metrics endpoint handler
export function getMetrics() {
  return register.metrics();
}

export default {
  register,
  getMetrics,
  httpMetricsMiddleware,
  httpRequestsTotal,
  httpRequestDuration,
  onWebSocketConnection,
  onWebSocketDisconnection,
  onWebSocketMessageSent,
  onWebSocketMessageReceived,
  trackGraphRender,
  updateDatabaseConnections,
  updateCacheConnections,
  trackError,
  startEventLoopMonitoring,
  stopEventLoopMonitoring
};