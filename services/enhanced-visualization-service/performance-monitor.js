#!/usr/bin/env node
/**
 * Performance Monitoring Tool
 * Continuous monitoring of system resources and service performance
 */

import { performance } from 'perf_hooks';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

const config = {
  monitoring: {
    interval: 5000, // 5 seconds
    duration: 300000, // 5 minutes
    services: [
      'enhanced-visualization-service',
      'musicdb-postgres',
      'musicdb-redis'
    ]
  },
  thresholds: {
    cpu: 80, // 80% CPU usage
    memory: 80, // 80% memory usage
    responseTime: 1000, // 1 second response time
  }
};

class PerformanceMonitor {
  constructor() {
    this.metrics = [];
    this.alerts = [];
    this.startTime = Date.now();
    this.running = false;
  }

  async start() {
    console.log('📊 Starting Performance Monitor...');
    console.log(`   Monitoring for ${config.monitoring.duration / 1000}s at ${config.monitoring.interval / 1000}s intervals`);
    console.log('='.repeat(70));

    this.running = true;
    const endTime = this.startTime + config.monitoring.duration;

    while (this.running && Date.now() < endTime) {
      try {
        const timestamp = new Date().toISOString();
        console.log(`\n📅 ${timestamp}`);
        
        const metrics = await this.collectMetrics();
        metrics.timestamp = timestamp;
        this.metrics.push(metrics);
        
        this.analyzeMetrics(metrics);
        this.printCurrentMetrics(metrics);
        
        await this.sleep(config.monitoring.interval);
      } catch (error) {
        console.error('❌ Monitoring error:', error.message);
      }
    }

    await this.generateReport();
  }

  async collectMetrics() {
    const metrics = {
      system: await this.getSystemMetrics(),
      containers: await this.getContainerMetrics(),
      services: await this.getServiceMetrics(),
      network: await this.getNetworkMetrics()
    };

    return metrics;
  }

  async getSystemMetrics() {
    try {
      // CPU usage
      const cpuResult = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1");
      const cpuUsage = parseFloat(cpuResult.stdout.trim()) || 0;

      // Memory usage
      const memResult = await execAsync("free | grep Mem | awk '{printf \"%.1f\", $3/$2 * 100.0}'");
      const memUsage = parseFloat(memResult.stdout.trim()) || 0;

      // Load average
      const loadResult = await execAsync("uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//'");
      const loadAverage = parseFloat(loadResult.stdout.trim()) || 0;

      // Disk usage
      const diskResult = await execAsync("df -h / | awk 'NR==2{printf \"%s\", $5}' | sed 's/%//'");
      const diskUsage = parseFloat(diskResult.stdout.trim()) || 0;

      return {
        cpu: cpuUsage,
        memory: memUsage,
        loadAverage,
        disk: diskUsage
      };
    } catch (error) {
      return {
        cpu: 0,
        memory: 0,
        loadAverage: 0,
        disk: 0,
        error: error.message
      };
    }
  }

  async getContainerMetrics() {
    const containers = {};
    
    for (const service of config.monitoring.services) {
      try {
        // Check if container is running
        const runningResult = await execAsync(`docker ps --filter "name=${service}" --format "{{.Names}}"`);
        const isRunning = runningResult.stdout.trim() === service;

        if (isRunning) {
          // Get container stats
          const statsResult = await execAsync(`docker stats ${service} --no-stream --format "table {{.CPUPerc}},{{.MemUsage}},{{.NetIO}},{{.BlockIO}}"`);
          const statsLines = statsResult.stdout.trim().split('\n');
          
          if (statsLines.length > 1) {
            const stats = statsLines[1].split(',');
            containers[service] = {
              running: true,
              cpu: parseFloat(stats[0].replace('%', '')) || 0,
              memory: stats[1] || 'N/A',
              network: stats[2] || 'N/A',
              disk: stats[3] || 'N/A'
            };
          } else {
            containers[service] = { running: true, stats: 'unavailable' };
          }
        } else {
          containers[service] = { running: false };
        }
      } catch (error) {
        containers[service] = { running: false, error: error.message };
      }
    }

    return containers;
  }

  async getServiceMetrics() {
    const services = {};

    // Test enhanced-visualization-service
    try {
      const startTime = performance.now();
      const healthResult = await execAsync('curl -s -o /dev/null -w "%{http_code}" http://localhost:8090/health');
      const responseTime = performance.now() - startTime;
      const statusCode = parseInt(healthResult.stdout.trim());

      services.enhancedVisualization = {
        available: statusCode === 200,
        responseTime,
        statusCode
      };
    } catch (error) {
      services.enhancedVisualization = {
        available: false,
        error: error.message
      };
    }

    // Test database
    try {
      const startTime = performance.now();
      const dbResult = await execAsync('pg_isready -h localhost -p 5433 -U musicdb_user');
      const responseTime = performance.now() - startTime;

      services.database = {
        available: dbResult.stdout.includes('accepting connections'),
        responseTime
      };
    } catch (error) {
      services.database = {
        available: false,
        error: error.message
      };
    }

    // Test Redis
    try {
      const startTime = performance.now();
      const redisResult = await execAsync('redis-cli -h localhost -p 6380 ping');
      const responseTime = performance.now() - startTime;

      services.redis = {
        available: redisResult.stdout.trim() === 'PONG',
        responseTime
      };
    } catch (error) {
      services.redis = {
        available: false,
        error: error.message
      };
    }

    return services;
  }

  async getNetworkMetrics() {
    try {
      // Network connections
      const connectionsResult = await execAsync("netstat -an | grep ':80\\|:443\\|:8080\\|:8090\\|:5433\\|:6380' | wc -l");
      const activeConnections = parseInt(connectionsResult.stdout.trim()) || 0;

      // Network traffic (bytes in/out)
      const trafficResult = await execAsync("cat /proc/net/dev | grep eth0 | awk '{print $2,$10}' || echo '0 0'");
      const [bytesIn, bytesOut] = trafficResult.stdout.trim().split(' ').map(x => parseInt(x) || 0);

      return {
        activeConnections,
        bytesIn,
        bytesOut
      };
    } catch (error) {
      return {
        activeConnections: 0,
        bytesIn: 0,
        bytesOut: 0,
        error: error.message
      };
    }
  }

  analyzeMetrics(metrics) {
    const timestamp = metrics.timestamp;

    // Check system thresholds
    if (metrics.system.cpu > config.thresholds.cpu) {
      this.alerts.push({
        timestamp,
        type: 'CPU',
        severity: 'high',
        message: `High CPU usage: ${metrics.system.cpu.toFixed(1)}%`
      });
    }

    if (metrics.system.memory > config.thresholds.memory) {
      this.alerts.push({
        timestamp,
        type: 'Memory',
        severity: 'high',
        message: `High memory usage: ${metrics.system.memory.toFixed(1)}%`
      });
    }

    // Check service response times
    Object.entries(metrics.services).forEach(([service, data]) => {
      if (data.responseTime && data.responseTime > config.thresholds.responseTime) {
        this.alerts.push({
          timestamp,
          type: 'Response Time',
          severity: 'medium',
          message: `Slow response from ${service}: ${data.responseTime.toFixed(0)}ms`
        });
      }

      if (!data.available) {
        this.alerts.push({
          timestamp,
          type: 'Service Down',
          severity: 'critical',
          message: `Service ${service} is not available`
        });
      }
    });

    // Check container status
    Object.entries(metrics.containers).forEach(([container, data]) => {
      if (!data.running) {
        this.alerts.push({
          timestamp,
          type: 'Container Down',
          severity: 'critical',
          message: `Container ${container} is not running`
        });
      }
    });
  }

  printCurrentMetrics(metrics) {
    // System metrics
    console.log('🖥️  System:');
    console.log(`   CPU: ${metrics.system.cpu.toFixed(1)}%  Memory: ${metrics.system.memory.toFixed(1)}%  Load: ${metrics.system.loadAverage.toFixed(2)}`);

    // Container status
    console.log('📦 Containers:');
    Object.entries(metrics.containers).forEach(([name, data]) => {
      const status = data.running ? '🟢' : '🔴';
      const cpu = data.cpu ? `${data.cpu.toFixed(1)}%` : 'N/A';
      console.log(`   ${status} ${name}: CPU=${cpu} Mem=${data.memory || 'N/A'}`);
    });

    // Service status
    console.log('🔧 Services:');
    Object.entries(metrics.services).forEach(([name, data]) => {
      const status = data.available ? '🟢' : '🔴';
      const responseTime = data.responseTime ? `${data.responseTime.toFixed(0)}ms` : 'N/A';
      console.log(`   ${status} ${name}: ${responseTime}`);
    });

    // Network
    console.log(`🌐 Network: ${metrics.network.activeConnections} connections`);

    // Recent alerts
    const recentAlerts = this.alerts.filter(alert => 
      Date.now() - new Date(alert.timestamp).getTime() < 30000 // Last 30 seconds
    );

    if (recentAlerts.length > 0) {
      console.log('🚨 Recent Alerts:');
      recentAlerts.forEach(alert => {
        const icon = alert.severity === 'critical' ? '🔴' : alert.severity === 'high' ? '🟠' : '🟡';
        console.log(`   ${icon} ${alert.message}`);
      });
    }
  }

  async generateReport() {
    console.log('\n' + '='.repeat(70));
    console.log('📋 PERFORMANCE MONITORING REPORT');
    console.log('='.repeat(70));

    const duration = Date.now() - this.startTime;
    const totalSamples = this.metrics.length;

    console.log(`\n📊 MONITORING SUMMARY:`);
    console.log(`  Duration: ${(duration / 1000).toFixed(0)}s`);
    console.log(`  Samples: ${totalSamples}`);
    console.log(`  Alerts: ${this.alerts.length}`);

    if (this.metrics.length > 0) {
      // Calculate averages
      const avgCpu = this.metrics.reduce((sum, m) => sum + m.system.cpu, 0) / this.metrics.length;
      const avgMemory = this.metrics.reduce((sum, m) => sum + m.system.memory, 0) / this.metrics.length;
      const maxCpu = Math.max(...this.metrics.map(m => m.system.cpu));
      const maxMemory = Math.max(...this.metrics.map(m => m.system.memory));

      console.log(`\n💻 SYSTEM PERFORMANCE:`);
      console.log(`  CPU - Avg: ${avgCpu.toFixed(1)}%  Max: ${maxCpu.toFixed(1)}%`);
      console.log(`  Memory - Avg: ${avgMemory.toFixed(1)}%  Max: ${maxMemory.toFixed(1)}%`);

      // Service availability
      console.log(`\n🔧 SERVICE AVAILABILITY:`);
      const services = ['enhancedVisualization', 'database', 'redis'];
      services.forEach(service => {
        const availableCount = this.metrics.filter(m => m.services[service]?.available).length;
        const availability = (availableCount / totalSamples * 100).toFixed(1);
        console.log(`  ${service}: ${availability}% (${availableCount}/${totalSamples})`);
      });
    }

    // Alert summary
    if (this.alerts.length > 0) {
      console.log(`\n🚨 ALERT SUMMARY:`);
      const alertTypes = {};
      this.alerts.forEach(alert => {
        alertTypes[alert.type] = (alertTypes[alert.type] || 0) + 1;
      });

      Object.entries(alertTypes).forEach(([type, count]) => {
        console.log(`  ${type}: ${count} alerts`);
      });

      console.log(`\n🔥 CRITICAL ALERTS:`);
      const criticalAlerts = this.alerts.filter(a => a.severity === 'critical');
      if (criticalAlerts.length > 0) {
        criticalAlerts.forEach(alert => {
          console.log(`  - ${alert.timestamp}: ${alert.message}`);
        });
      } else {
        console.log(`  None`);
      }
    }

    // Recommendations
    console.log(`\n💡 RECOMMENDATIONS:`);
    if (avgCpu > 70) {
      console.log(`  • High CPU usage detected - consider optimizing or scaling`);
    }
    if (maxMemory > 85) {
      console.log(`  • High memory usage detected - check for memory leaks`);
    }
    if (this.alerts.some(a => a.type === 'Service Down')) {
      console.log(`  • Service downtime detected - review service reliability`);
    }
    if (this.alerts.some(a => a.type === 'Response Time')) {
      console.log(`  • Slow response times detected - optimize service performance`);
    }

    // Write detailed report
    await this.writeDetailedReport();
    
    console.log('\n='.repeat(70));
  }

  async writeDetailedReport() {
    const reportData = {
      metadata: {
        startTime: new Date(this.startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: Date.now() - this.startTime,
        samples: this.metrics.length
      },
      metrics: this.metrics,
      alerts: this.alerts,
      summary: this.generateSummary()
    };

    try {
      await fs.writeFile('./performance-monitoring-report.json', JSON.stringify(reportData, null, 2));
      console.log('  📄 Detailed report saved to: performance-monitoring-report.json');
    } catch (error) {
      console.error('  ❌ Failed to write report:', error.message);
    }
  }

  generateSummary() {
    if (this.metrics.length === 0) return {};

    const avgCpu = this.metrics.reduce((sum, m) => sum + m.system.cpu, 0) / this.metrics.length;
    const avgMemory = this.metrics.reduce((sum, m) => sum + m.system.memory, 0) / this.metrics.length;
    const maxCpu = Math.max(...this.metrics.map(m => m.system.cpu));
    const maxMemory = Math.max(...this.metrics.map(m => m.system.memory));

    return {
      system: {
        cpu: { avg: avgCpu, max: maxCpu },
        memory: { avg: avgMemory, max: maxMemory }
      },
      alerts: {
        total: this.alerts.length,
        critical: this.alerts.filter(a => a.severity === 'critical').length,
        high: this.alerts.filter(a => a.severity === 'high').length,
        medium: this.alerts.filter(a => a.severity === 'medium').length
      }
    };
  }

  stop() {
    this.running = false;
    console.log('\n⏹️  Monitoring stopped');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, stopping monitor...');
  if (monitor) {
    monitor.stop();
  }
  process.exit(0);
});

// Create and start monitor
const monitor = new PerformanceMonitor();
monitor.start().catch(console.error);