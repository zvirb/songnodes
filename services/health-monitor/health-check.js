/**
 * Comprehensive Health Check Service for Song Nodes Infrastructure
 * Provides detailed health monitoring for all system components
 */

const express = require('express');
const { Pool } = require('pg');
const redis = require('redis');
const promClient = require('prom-client');
const os = require('os');
const WebSocket = require('ws');

class HealthCheckService {
  constructor() {
    this.app = express();
    this.port = process.env.HEALTH_PORT || 8085;
    this.dbPool = null;
    this.redisClient = null;
    this.checks = new Map();
    this.metrics = this.setupMetrics();
    this.setupRoutes();
    this.setupChecks();
  }

  setupMetrics() {
    // Create metrics registry
    const register = new promClient.Registry();
    
    // Health check metrics
    const healthCheckDuration = new promClient.Histogram({
      name: 'health_check_duration_seconds',
      help: 'Duration of health checks in seconds',
      labelNames: ['check_name', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0]
    });

    const healthCheckStatus = new promClient.Gauge({
      name: 'health_check_status',
      help: 'Status of health checks (1 = healthy, 0 = unhealthy)',
      labelNames: ['check_name', 'component']
    });

    const systemMetrics = new promClient.Gauge({
      name: 'system_resource_usage',
      help: 'System resource usage metrics',
      labelNames: ['resource_type']
    });

    const connectionMetrics = new promClient.Gauge({
      name: 'connection_pool_status',
      help: 'Connection pool status metrics',
      labelNames: ['pool_type', 'metric_type']
    });

    register.registerMetric(healthCheckDuration);
    register.registerMetric(healthCheckStatus);
    register.registerMetric(systemMetrics);
    register.registerMetric(connectionMetrics);

    return {
      register,
      healthCheckDuration,
      healthCheckStatus,
      systemMetrics,
      connectionMetrics
    };
  }

  setupChecks() {
    this.checks.set('database', this.checkDatabase.bind(this));
    this.checks.set('redis', this.checkRedis.bind(this));
    this.checks.set('memory', this.checkMemory.bind(this));
    this.checks.set('disk', this.checkDisk.bind(this));
    this.checks.set('cpu', this.checkCPU.bind(this));
    this.checks.set('websocket', this.checkWebSocket.bind(this));
    this.checks.set('graph_api', this.checkGraphAPI.bind(this));
    this.checks.set('dependencies', this.checkExternalDependencies.bind(this));
  }

  async initializeConnections() {
    try {
      // Initialize PostgreSQL connection pool
      this.dbPool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://musicdb_user:musicdb_secure_pass_2024@db-connection-pool:6432/musicdb',
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Initialize Redis connection
      this.redisClient = redis.createClient({
        url: process.env.REDIS_URL || 'redis://redis:6379',
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            return new Error('Redis server connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Redis retry time exhausted');
          }
          if (options.attempt > 10) {
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      await this.redisClient.connect();
      console.log('Health check service connections initialized');
    } catch (error) {
      console.error('Failed to initialize connections:', error);
      throw error;
    }
  }

  async checkDatabase() {
    if (!this.dbPool) {
      return {
        status: 'unhealthy',
        error: 'Database pool not initialized'
      };
    }

    try {
      const start = Date.now();
      const client = await this.dbPool.connect();
      
      try {
        // Test query with timeout
        const result = await client.query('SELECT 1 as health_check, NOW() as timestamp, version() as version');
        const responseTime = Date.now() - start;
        
        // Check connection pool stats
        const poolStats = {
          totalCount: this.dbPool.totalCount,
          idleCount: this.dbPool.idleCount,
          waitingCount: this.dbPool.waitingCount
        };

        // Update metrics
        this.metrics.connectionMetrics.labels('postgres', 'total').set(poolStats.totalCount);
        this.metrics.connectionMetrics.labels('postgres', 'idle').set(poolStats.idleCount);
        this.metrics.connectionMetrics.labels('postgres', 'waiting').set(poolStats.waitingCount);
        
        return {
          status: responseTime < 1000 ? 'healthy' : 'warning',
          responseTime,
          details: {
            ...poolStats,
            version: result.rows[0].version.split(' ').slice(0, 2).join(' '),
            timestamp: result.rows[0].timestamp
          },
          thresholds: {
            responseTime: { value: responseTime, threshold: 1000, unit: 'ms' }
          }
        };
      } finally {
        client.release();
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        code: error.code
      };
    }
  }

  async checkRedis() {
    if (!this.redisClient || !this.redisClient.isOpen) {
      return {
        status: 'unhealthy',
        error: 'Redis client not connected'
      };
    }

    try {
      const start = Date.now();
      const pong = await this.redisClient.ping();
      const responseTime = Date.now() - start;
      
      // Get Redis info
      const memoryInfo = await this.redisClient.info('memory');
      const statsInfo = await this.redisClient.info('stats');
      
      // Parse key metrics
      const parseInfo = (infoStr) => {
        const result = {};
        infoStr.split('\r\n').forEach(line => {
          if (line.includes(':')) {
            const [key, value] = line.split(':');
            result[key] = value;
          }
        });
        return result;
      };

      const memData = parseInfo(memoryInfo);
      const statsData = parseInfo(statsInfo);
      
      return {
        status: responseTime < 100 ? 'healthy' : 'warning',
        responseTime,
        details: {
          ping: pong,
          memory: {
            used: memData.used_memory_human,
            peak: memData.used_memory_peak_human,
            fragmentation_ratio: memData.mem_fragmentation_ratio
          },
          stats: {
            total_commands_processed: statsData.total_commands_processed,
            instantaneous_ops_per_sec: statsData.instantaneous_ops_per_sec,
            connected_clients: statsData.connected_clients
          }
        },
        thresholds: {
          responseTime: { value: responseTime, threshold: 100, unit: 'ms' }
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  checkMemory() {
    const usage = process.memoryUsage();
    const systemMemory = {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem()
    };
    
    const memoryUsagePercent = (systemMemory.used / systemMemory.total) * 100;
    const heapUsagePercent = (usage.heapUsed / usage.heapTotal) * 100;
    
    // Update metrics
    this.metrics.systemMetrics.labels('memory_usage_percent').set(memoryUsagePercent);
    this.metrics.systemMetrics.labels('heap_usage_percent').set(heapUsagePercent);
    
    const status = memoryUsagePercent > 90 ? 'unhealthy' : 
      memoryUsagePercent > 80 ? 'warning' : 'healthy';
    
    return {
      status,
      details: {
        process: {
          heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
          external: Math.round(usage.external / 1024 / 1024),
          rss: Math.round(usage.rss / 1024 / 1024)
        },
        system: {
          total: Math.round(systemMemory.total / 1024 / 1024),
          free: Math.round(systemMemory.free / 1024 / 1024),
          used: Math.round(systemMemory.used / 1024 / 1024),
          usagePercent: Math.round(memoryUsagePercent * 100) / 100
        }
      },
      thresholds: {
        systemMemory: { value: memoryUsagePercent, threshold: 80, unit: '%' },
        heapMemory: { value: heapUsagePercent, threshold: 90, unit: '%' }
      }
    };
  }

  async checkDisk() {
    try {
      const diskUsage = await this.getDiskUsage('/');
      
      // Update metrics
      this.metrics.systemMetrics.labels('disk_usage_percent').set(diskUsage.usagePercent);
      
      const status = diskUsage.usagePercent > 90 ? 'unhealthy' : 
        diskUsage.usagePercent > 80 ? 'warning' : 'healthy';
      
      return {
        status,
        details: diskUsage,
        thresholds: {
          diskUsage: { value: diskUsage.usagePercent, threshold: 80, unit: '%' }
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  checkCPU() {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    const cpuCount = cpus.length;
    
    // Calculate load average as percentage
    const loadPercent = (loadAvg[0] / cpuCount) * 100;
    
    // Update metrics
    this.metrics.systemMetrics.labels('cpu_load_percent').set(loadPercent);
    this.metrics.systemMetrics.labels('cpu_count').set(cpuCount);
    
    const status = loadPercent > 90 ? 'unhealthy' : 
      loadPercent > 70 ? 'warning' : 'healthy';
    
    return {
      status,
      details: {
        count: cpuCount,
        model: cpus[0].model,
        loadAverage: {
          '1min': Math.round(loadAvg[0] * 100) / 100,
          '5min': Math.round(loadAvg[1] * 100) / 100,
          '15min': Math.round(loadAvg[2] * 100) / 100
        },
        loadPercent: Math.round(loadPercent * 100) / 100
      },
      thresholds: {
        cpuLoad: { value: loadPercent, threshold: 70, unit: '%' }
      }
    };
  }

  async checkWebSocket() {
    return new Promise((resolve) => {
      const wsUrl = process.env.WS_URL || 'ws://websocket-service:8001';
      const ws = new WebSocket(wsUrl);
      const start = Date.now();
      
      const timeout = setTimeout(() => {
        ws.terminate();
        resolve({
          status: 'unhealthy',
          error: 'WebSocket connection timeout'
        });
      }, 5000);
      
      ws.on('open', () => {
        const responseTime = Date.now() - start;
        clearTimeout(timeout);
        ws.close();
        
        resolve({
          status: 'healthy',
          responseTime,
          details: {
            url: wsUrl,
            readyState: 'OPEN'
          }
        });
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          status: 'unhealthy',
          error: error.message
        });
      });
    });
  }

  async checkGraphAPI() {
    try {
      const graphApiUrl = process.env.GRAPH_API_URL || 'http://graph-visualization-api:8084';
      const start = Date.now();
      
      const response = await fetch(`${graphApiUrl}/health`, {
        timeout: 5000
      });
      
      const responseTime = Date.now() - start;
      
      if (response.ok) {
        const data = await response.json();
        return {
          status: responseTime < 500 ? 'healthy' : 'warning',
          responseTime,
          details: data,
          thresholds: {
            responseTime: { value: responseTime, threshold: 500, unit: 'ms' }
          }
        };
      } else {
        return {
          status: 'unhealthy',
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  async checkExternalDependencies() {
    // Check external services if any
    return {
      status: 'healthy',
      details: {
        externalServices: 'none configured'
      }
    };
  }

  async getDiskUsage(path) {
    // Simple disk usage check (Linux/Unix)
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      exec(`df -h ${path}`, (error, stdout, _stderr) => {
        if (error) {
          reject(error);
          return;
        }
        
        const lines = stdout.trim().split('\n');
        const data = lines[1].split(/\s+/);
        const usagePercent = parseInt(data[4].replace('%', ''));
        
        resolve({
          filesystem: data[0],
          size: data[1],
          used: data[2],
          available: data[3],
          usagePercent,
          mountPoint: data[5]
        });
      });
    });
  }

  async runAllChecks() {
    const results = {};
    let overallStatus = 'healthy';
    const startTime = Date.now();

    for (const [name, check] of this.checks) {
      const checkStart = Date.now();
      try {
        results[name] = await check();
        const duration = (Date.now() - checkStart) / 1000;
        
        // Update metrics
        this.metrics.healthCheckDuration
          .labels(name, results[name].status)
          .observe(duration);
        
        this.metrics.healthCheckStatus
          .labels(name, name)
          .set(results[name].status === 'healthy' ? 1 : 0);
        
        if (results[name].status === 'unhealthy') {
          overallStatus = 'unhealthy';
        } else if (results[name].status === 'warning' && overallStatus === 'healthy') {
          overallStatus = 'warning';
        }
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          error: error.message
        };
        overallStatus = 'unhealthy';
        
        this.metrics.healthCheckStatus.labels(name, name).set(0);
      }
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: results
    };
  }

  setupRoutes() {
    this.app.use(express.json());
    
    // Basic health check
    this.app.get('/health', async (req, res) => {
      const health = await this.runAllChecks();
      const statusCode = health.status === 'healthy' ? 200 : 
        health.status === 'warning' ? 200 : 503;
      res.status(statusCode).json(health);
    });

    // Kubernetes readiness probe
    this.app.get('/health/ready', async (req, res) => {
      const health = await this.runAllChecks();
      const ready = health.status === 'healthy' && 
                    Object.values(health.checks).every(check => 
                      check.status === 'healthy'
                    );
      res.status(ready ? 200 : 503).json({ 
        ready, 
        health: {
          status: health.status,
          timestamp: health.timestamp
        }
      });
    });

    // Kubernetes liveness probe
    this.app.get('/health/live', (req, res) => {
      res.status(200).json({ 
        alive: true, 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Individual component checks
    this.app.get('/health/:component', async (req, res) => {
      const component = req.params.component;
      if (this.checks.has(component)) {
        const check = this.checks.get(component);
        const result = await check();
        const statusCode = result.status === 'healthy' ? 200 : 
          result.status === 'warning' ? 200 : 503;
        res.status(statusCode).json({
          component,
          ...result,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(404).json({
          error: 'Component not found',
          available: Array.from(this.checks.keys())
        });
      }
    });

    // Prometheus metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      res.set('Content-Type', this.metrics.register.contentType);
      res.end(await this.metrics.register.metrics());
    });

    // Health check summary
    this.app.get('/health/summary', async (req, res) => {
      const health = await this.runAllChecks();
      const summary = {
        status: health.status,
        timestamp: health.timestamp,
        componentsHealthy: Object.values(health.checks).filter(c => c.status === 'healthy').length,
        componentsWarning: Object.values(health.checks).filter(c => c.status === 'warning').length,
        componentsUnhealthy: Object.values(health.checks).filter(c => c.status === 'unhealthy').length,
        totalComponents: Object.keys(health.checks).length
      };
      res.json(summary);
    });
  }

  async start() {
    try {
      await this.initializeConnections();
      
      this.app.listen(this.port, () => {
        console.log(`Health check service running on port ${this.port}`);
        console.log('Endpoints available:');
        console.log('  - GET /health - Comprehensive health check');
        console.log('  - GET /health/ready - Readiness probe');
        console.log('  - GET /health/live - Liveness probe');
        console.log('  - GET /health/:component - Individual component check');
        console.log('  - GET /health/summary - Health summary');
        console.log('  - GET /metrics - Prometheus metrics');
      });
    } catch (error) {
      console.error('Failed to start health check service:', error);
      process.exit(1);
    }
  }

  async stop() {
    if (this.dbPool) {
      await this.dbPool.end();
    }
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully');
  if (global.healthService) {
    await global.healthService.stop();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully');
  if (global.healthService) {
    await global.healthService.stop();
  }
  process.exit(0);
});

// Start the service
if (require.main === module) {
  const service = new HealthCheckService();
  global.healthService = service;
  service.start();
}

module.exports = HealthCheckService;