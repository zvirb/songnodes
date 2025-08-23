#!/usr/bin/env node
/**
 * Database Performance Testing Suite
 * Focused testing for PostgreSQL query optimization and performance
 */

import { Pool } from 'pg';
import { performance } from 'perf_hooks';

const config = {
  database: {
    host: 'localhost',
    port: 5433,
    database: 'musicdb',
    user: 'musicdb_user',
    password: 'musicdb_secure_pass',
    max: 50,
    connectionTimeoutMillis: 30000,
  },
  performance: {
    targetNodes: 420,
    targetEdges: 1253,
    maxResponseTime: 200,
  }
};

class DatabasePerformanceTester {
  constructor() {
    this.pool = null;
    this.results = {
      connection: {},
      schema: {},
      queries: {},
      optimization: {},
      recommendations: []
    };
  }

  async run() {
    console.log('🗄️  Starting Database Performance Testing...');
    console.log('='.repeat(60));

    try {
      await this.testConnection();
      await this.testSchemaPerformance();
      await this.testQueryOptimization();
      await this.testConcurrentLoad();
      await this.generateRecommendations();
      
      this.printResults();
    } catch (error) {
      console.error('❌ Database performance test failed:', error);
    } finally {
      if (this.pool) {
        await this.pool.end();
      }
    }
  }

  async testConnection() {
    console.log('\n📊 Testing Database Connection...');
    
    this.pool = new Pool(config.database);
    
    const start = performance.now();
    await this.pool.query('SELECT 1');
    const connectionTime = performance.now() - start;
    
    console.log(`  ✅ Connection established in ${connectionTime.toFixed(2)}ms`);
    
    this.results.connection = {
      time: connectionTime,
      successful: true
    };
  }

  async testSchemaPerformance() {
    console.log('\n📋 Testing Schema Performance...');
    
    // Test if tables exist and create sample data
    const start = performance.now();
    
    try {
      // Create test tables if they don't exist
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS test_nodes (
          id SERIAL PRIMARY KEY,
          x_position FLOAT,
          y_position FLOAT,
          node_type VARCHAR(50),
          metadata JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS test_edges (
          id SERIAL PRIMARY KEY,
          source_id INTEGER,
          target_id INTEGER,
          weight FLOAT,
          edge_type VARCHAR(50),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Add indexes for performance
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_test_nodes_position 
        ON test_nodes(x_position, y_position)
      `);
      
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_test_edges_source_target 
        ON test_edges(source_id, target_id)
      `);
      
      const schemaTime = performance.now() - start;
      console.log(`  ✅ Schema setup completed in ${schemaTime.toFixed(2)}ms`);
      
      this.results.schema = {
        setupTime: schemaTime,
        tablesCreated: true
      };
      
    } catch (error) {
      console.log(`  ⚠️  Schema setup failed: ${error.message}`);
      this.results.schema = {
        setupTime: performance.now() - start,
        tablesCreated: false,
        error: error.message
      };
    }
  }

  async testQueryOptimization() {
    console.log('\n⚡ Testing Query Optimization...');
    
    // Insert test data
    await this.insertTestData();
    
    // Test various query patterns
    await this.testNodeQueries();
    await this.testEdgeQueries();
    await this.testJoinQueries();
    await this.testAggregationQueries();
  }

  async insertTestData() {
    console.log('  📊 Inserting test data...');
    
    const start = performance.now();
    
    // Insert nodes
    const nodeValues = [];
    for (let i = 0; i < config.performance.targetNodes; i++) {
      nodeValues.push(`(${Math.random() * 1000}, ${Math.random() * 1000}, 'track', '{"name": "Track_${i}"}', NOW())`);
    }
    
    await this.pool.query(`
      INSERT INTO test_nodes (x_position, y_position, node_type, metadata, created_at) 
      VALUES ${nodeValues.join(', ')}
    `);
    
    // Insert edges
    const edgeValues = [];
    for (let i = 0; i < config.performance.targetEdges; i++) {
      const sourceId = Math.floor(Math.random() * config.performance.targetNodes) + 1;
      const targetId = Math.floor(Math.random() * config.performance.targetNodes) + 1;
      if (sourceId !== targetId) {
        edgeValues.push(`(${sourceId}, ${targetId}, ${Math.random()}, 'similarity', NOW())`);
      }
    }
    
    await this.pool.query(`
      INSERT INTO test_edges (source_id, target_id, weight, edge_type, created_at) 
      VALUES ${edgeValues.join(', ')}
    `);
    
    const insertTime = performance.now() - start;
    console.log(`  ✅ Test data inserted in ${insertTime.toFixed(2)}ms`);
    
    this.results.queries.dataInsertion = {
      time: insertTime,
      nodeCount: config.performance.targetNodes,
      edgeCount: config.performance.targetEdges
    };
  }

  async testNodeQueries() {
    console.log('  🔍 Testing node queries...');
    
    // Simple select
    const simpleStart = performance.now();
    const simpleResult = await this.pool.query(`
      SELECT id, x_position, y_position, node_type 
      FROM test_nodes 
      LIMIT 1000
    `);
    const simpleTime = performance.now() - simpleStart;
    
    // Spatial query
    const spatialStart = performance.now();
    const spatialResult = await this.pool.query(`
      SELECT id, x_position, y_position 
      FROM test_nodes 
      WHERE x_position BETWEEN 100 AND 900 
      AND y_position BETWEEN 100 AND 900
    `);
    const spatialTime = performance.now() - spatialStart;
    
    // JSONB query
    const jsonbStart = performance.now();
    const jsonbResult = await this.pool.query(`
      SELECT id, metadata 
      FROM test_nodes 
      WHERE metadata->>'name' LIKE 'Track_%' 
      LIMIT 100
    `);
    const jsonbTime = performance.now() - jsonbStart;
    
    console.log(`    Simple query: ${simpleTime.toFixed(2)}ms (${simpleResult.rows.length} rows)`);
    console.log(`    Spatial query: ${spatialTime.toFixed(2)}ms (${spatialResult.rows.length} rows)`);
    console.log(`    JSONB query: ${jsonbTime.toFixed(2)}ms (${jsonbResult.rows.length} rows)`);
    
    this.results.queries.nodes = {
      simple: { time: simpleTime, rows: simpleResult.rows.length },
      spatial: { time: spatialTime, rows: spatialResult.rows.length },
      jsonb: { time: jsonbTime, rows: jsonbResult.rows.length }
    };
  }

  async testEdgeQueries() {
    console.log('  🔗 Testing edge queries...');
    
    // All edges
    const allStart = performance.now();
    const allResult = await this.pool.query(`
      SELECT source_id, target_id, weight 
      FROM test_edges 
      LIMIT 1000
    `);
    const allTime = performance.now() - allStart;
    
    // Filtered edges
    const filteredStart = performance.now();
    const filteredResult = await this.pool.query(`
      SELECT source_id, target_id, weight 
      FROM test_edges 
      WHERE weight > 0.5 
      ORDER BY weight DESC 
      LIMIT 100
    `);
    const filteredTime = performance.now() - filteredStart;
    
    console.log(`    All edges: ${allTime.toFixed(2)}ms (${allResult.rows.length} rows)`);
    console.log(`    Filtered edges: ${filteredTime.toFixed(2)}ms (${filteredResult.rows.length} rows)`);
    
    this.results.queries.edges = {
      all: { time: allTime, rows: allResult.rows.length },
      filtered: { time: filteredTime, rows: filteredResult.rows.length }
    };
  }

  async testJoinQueries() {
    console.log('  🔄 Testing join queries...');
    
    // Simple join
    const simpleJoinStart = performance.now();
    const simpleJoinResult = await this.pool.query(`
      SELECT n1.id as source_id, n2.id as target_id, e.weight
      FROM test_edges e
      INNER JOIN test_nodes n1 ON e.source_id = n1.id
      INNER JOIN test_nodes n2 ON e.target_id = n2.id
      LIMIT 500
    `);
    const simpleJoinTime = performance.now() - simpleJoinStart;
    
    // Complex join with aggregation
    const complexJoinStart = performance.now();
    const complexJoinResult = await this.pool.query(`
      SELECT n.id, n.node_type, 
             COUNT(e1.id) as outgoing_edges,
             COUNT(e2.id) as incoming_edges,
             AVG(e1.weight) as avg_outgoing_weight
      FROM test_nodes n
      LEFT JOIN test_edges e1 ON n.id = e1.source_id
      LEFT JOIN test_edges e2 ON n.id = e2.target_id
      GROUP BY n.id, n.node_type
      HAVING COUNT(e1.id) > 0
      ORDER BY outgoing_edges DESC
      LIMIT 100
    `);
    const complexJoinTime = performance.now() - complexJoinStart;
    
    console.log(`    Simple join: ${simpleJoinTime.toFixed(2)}ms (${simpleJoinResult.rows.length} rows)`);
    console.log(`    Complex join: ${complexJoinTime.toFixed(2)}ms (${complexJoinResult.rows.length} rows)`);
    
    this.results.queries.joins = {
      simple: { time: simpleJoinTime, rows: simpleJoinResult.rows.length },
      complex: { time: complexJoinTime, rows: complexJoinResult.rows.length }
    };
  }

  async testAggregationQueries() {
    console.log('  📊 Testing aggregation queries...');
    
    // Node statistics
    const nodeStatsStart = performance.now();
    const nodeStatsResult = await this.pool.query(`
      SELECT 
        COUNT(*) as total_nodes,
        AVG(x_position) as avg_x,
        AVG(y_position) as avg_y,
        MIN(x_position) as min_x,
        MAX(x_position) as max_x
      FROM test_nodes
    `);
    const nodeStatsTime = performance.now() - nodeStatsStart;
    
    // Edge statistics
    const edgeStatsStart = performance.now();
    const edgeStatsResult = await this.pool.query(`
      SELECT 
        COUNT(*) as total_edges,
        AVG(weight) as avg_weight,
        MIN(weight) as min_weight,
        MAX(weight) as max_weight,
        COUNT(DISTINCT source_id) as unique_sources,
        COUNT(DISTINCT target_id) as unique_targets
      FROM test_edges
    `);
    const edgeStatsTime = performance.now() - edgeStatsStart;
    
    console.log(`    Node statistics: ${nodeStatsTime.toFixed(2)}ms`);
    console.log(`    Edge statistics: ${edgeStatsTime.toFixed(2)}ms`);
    
    this.results.queries.aggregations = {
      nodeStats: { time: nodeStatsTime, result: nodeStatsResult.rows[0] },
      edgeStats: { time: edgeStatsTime, result: edgeStatsResult.rows[0] }
    };
  }

  async testConcurrentLoad() {
    console.log('\n⚡ Testing Concurrent Load...');
    
    const concurrentStart = performance.now();
    
    // Run 10 concurrent queries
    const promises = Array.from({ length: 10 }, (_, i) => 
      this.pool.query(`
        SELECT n.id, e.weight 
        FROM test_nodes n 
        LEFT JOIN test_edges e ON n.id = e.source_id 
        WHERE n.id = $1
      `, [i + 1])
    );
    
    const results = await Promise.all(promises);
    const concurrentTime = performance.now() - concurrentStart;
    
    console.log(`  ✅ 10 concurrent queries completed in ${concurrentTime.toFixed(2)}ms`);
    
    this.results.queries.concurrent = {
      time: concurrentTime,
      queryCount: 10,
      avgTime: concurrentTime / 10
    };
  }

  async generateRecommendations() {
    const queries = this.results.queries;
    const target = config.performance.maxResponseTime;
    
    // Analyze query performance
    if (queries.nodes?.simple.time > target) {
      this.results.recommendations.push(
        'Consider adding indexes on frequently queried node columns'
      );
    }
    
    if (queries.edges?.filtered.time > target) {
      this.results.recommendations.push(
        'Add index on edge weight column for performance'
      );
    }
    
    if (queries.joins?.complex.time > target) {
      this.results.recommendations.push(
        'Optimize complex joins with better indexing strategy'
      );
    }
    
    if (queries.concurrent?.avgTime > target / 2) {
      this.results.recommendations.push(
        'Consider connection pooling optimization for concurrent queries'
      );
    }
    
    // General recommendations
    this.results.recommendations.push(
      'Implement query result caching for frequently accessed data',
      'Consider partitioning large tables for better performance',
      'Monitor query execution plans for optimization opportunities'
    );
  }

  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 DATABASE PERFORMANCE REPORT');
    console.log('='.repeat(60));
    
    // Connection Results
    console.log('\n📊 CONNECTION PERFORMANCE:');
    console.log(`  Connection Time: ${this.results.connection.time?.toFixed(2)}ms`);
    
    // Query Results
    if (this.results.queries.nodes) {
      console.log('\n🔍 QUERY PERFORMANCE:');
      console.log(`  Node Queries:`);
      console.log(`    Simple: ${this.results.queries.nodes.simple.time.toFixed(2)}ms`);
      console.log(`    Spatial: ${this.results.queries.nodes.spatial.time.toFixed(2)}ms`);
      console.log(`    JSONB: ${this.results.queries.nodes.jsonb.time.toFixed(2)}ms`);
      
      console.log(`  Edge Queries:`);
      console.log(`    All: ${this.results.queries.edges.all.time.toFixed(2)}ms`);
      console.log(`    Filtered: ${this.results.queries.edges.filtered.time.toFixed(2)}ms`);
      
      console.log(`  Join Queries:`);
      console.log(`    Simple: ${this.results.queries.joins.simple.time.toFixed(2)}ms`);
      console.log(`    Complex: ${this.results.queries.joins.complex.time.toFixed(2)}ms`);
      
      console.log(`  Concurrent Load: ${this.results.queries.concurrent.time.toFixed(2)}ms (10 queries)`);
    }
    
    // Recommendations
    console.log('\n💡 OPTIMIZATION RECOMMENDATIONS:');
    this.results.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
    
    console.log('\n='.repeat(60));
  }
}

// Run the database performance tests
const tester = new DatabasePerformanceTester();
tester.run().catch(console.error);