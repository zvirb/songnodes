/**
 * Universal Prometheus Metrics Module for Node.js Services
 * Can be dropped into any Express/Node.js service
 */

const client = require('prom-client');

class MetricsService {
  constructor(serviceName = 'nodejs-service', options = {}) {
    this.serviceName = serviceName;
    this.register = new client.Registry();

    // Set default labels for all metrics
    this.register.setDefaultLabels({
      app: serviceName,
      environment: process.env.NODE_ENV || 'development'
    });

    // Collect default metrics (CPU, memory, etc.)
    client.collectDefaultMetrics({
      register: this.register,
      prefix: `${serviceName.replace(/-/g, '_')}_`
    });

    // Initialize custom metrics
    this.initializeMetrics(options);
  }

  initializeMetrics(options) {
    // HTTP metrics
    this.httpDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: options.buckets || [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
      registers: [this.register]
    });

    this.httpRequests = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register]
    });

    // Business metrics
    this.businessOperations = new client.Counter({
      name: 'business_operations_total',
      help: 'Total number of business operations',
      labelNames: ['operation', 'status'],
      registers: [this.register]
    });

    this.activeConnections = new client.Gauge({
      name: 'active_connections',
      help: 'Number of active connections',
      registers: [this.register]
    });

    // Database metrics
    this.dbQueryDuration = new client.Histogram({
      name: 'db_query_duration_seconds',
      help: 'Duration of database queries',
      labelNames: ['operation', 'table'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
      registers: [this.register]
    });

    this.dbConnections = new client.Gauge({
      name: 'db_connection_pool_size',
      help: 'Database connection pool size',
      labelNames: ['state'],
      registers: [this.register]
    });

    // Cache metrics
    this.cacheHits = new client.Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_type'],
      registers: [this.register]
    });

    this.cacheMisses = new client.Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_type'],
      registers: [this.register]
    });

    // Error metrics
    this.errors = new client.Counter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'severity'],
      registers: [this.register]
    });
  }

  // Express middleware for automatic HTTP metrics
  middleware() {
    return (req, res, next) => {
      const start = Date.now();

      // Increment active connections
      this.activeConnections.inc();

      // Capture the original end function
      const originalEnd = res.end;

      res.end = (...args) => {
        // Call original end function
        originalEnd.apply(res, args);

        // Calculate duration
        const duration = (Date.now() - start) / 1000;

        // Get route path or URL
        const route = req.route ? req.route.path : req.path || req.url;

        // Record metrics
        const labels = {
          method: req.method,
          route: route,
          status_code: res.statusCode
        };

        this.httpDuration.observe(labels, duration);
        this.httpRequests.inc(labels);

        // Decrement active connections
        this.activeConnections.dec();
      };

      next();
    };
  }

  // Get metrics endpoint handler
  async getMetrics() {
    return this.register.metrics();
  }

  // Express route handler
  metricsEndpoint() {
    return async (req, res) => {
      try {
        res.set('Content-Type', this.register.contentType);
        const metrics = await this.getMetrics();
        res.end(metrics);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    };
  }

  // Record business operation
  recordOperation(operation, status = 'success') {
    this.businessOperations.inc({ operation, status });
  }

  // Record database query
  recordDbQuery(operation, table, duration) {
    this.dbQueryDuration.observe({ operation, table }, duration);
  }

  // Record cache activity
  recordCacheHit(cacheType = 'default') {
    this.cacheHits.inc({ cache_type: cacheType });
  }

  recordCacheMiss(cacheType = 'default') {
    this.cacheMisses.inc({ cache_type: cacheType });
  }

  // Record error
  recordError(type, severity = 'error') {
    this.errors.inc({ type, severity });
  }

  // Update gauge metrics
  setDbConnections(active, idle) {
    this.dbConnections.set({ state: 'active' }, active);
    this.dbConnections.set({ state: 'idle' }, idle);
  }
}

// Factory function for easy integration
function createMetrics(serviceName, options = {}) {
  return new MetricsService(serviceName, options);
}

module.exports = { MetricsService, createMetrics };