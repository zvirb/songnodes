/**
 * Minimal Enhanced Visualization Service for Integration Testing
 * This is a simplified JavaScript version to test the core integration
 */

import Fastify from 'fastify';
import { Pool } from 'pg';
import Redis from 'ioredis';
import websocket from '@fastify/websocket';
import jwt from 'jsonwebtoken';

// Configuration from environment variables
const config = {
  port: parseInt(process.env.PORT || '8085', 10),
  host: process.env.HOST || '0.0.0.0',
  database: {
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'db-connection-pool',
    port: parseInt(process.env.DB_PORT || '6432', 10),
    database: process.env.DB_NAME || 'musicdb',
    user: process.env.DB_USER || 'musicdb_user',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'musicdb_secure_pass',
    ssl: process.env.DB_SSL === 'true',
    max: 20,
    min: 5,
  },
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    issuer: process.env.JWT_ISSUER || 'songnodes-enhanced-visualization'
  }
};

console.log('Configuration:', {
  database: {
    connectionString: config.database.connectionString ? 'SET' : 'NOT_SET',
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user
  },
  redis: {
    host: config.redis.host,
    port: config.redis.port
  }
});

// JWT Authentication helpers
function verifyToken(token) {
  try {
    const payload = jwt.verify(token, config.jwt.secret, {
      issuer: config.jwt.issuer,
      algorithms: ['HS256']
    });
    return {
      userId: payload.userId,
      username: payload.username,
      roles: payload.roles || [],
      sessionId: payload.sessionId
    };
  } catch (error) {
    console.warn('JWT verification failed:', error.message);
    return null;
  }
}

function extractTokenFromRequest(url, headers) {
  // Check Authorization header first
  const authHeader = headers.authorization || headers.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check query parameter as fallback for WebSocket connections
  try {
    const urlObj = new URL(url, 'http://localhost');
    const token = urlObj.searchParams.get('token');
    return token;
  } catch (error) {
    console.warn('Failed to parse URL for token extraction:', error);
    return null;
  }
}

async function createServer() {
  const app = Fastify({ logger: true });

  // Register WebSocket plugin
  await app.register(websocket);

  // Initialize database connection
  let dbPool;
  if (config.database.connectionString) {
    dbPool = new Pool({
      connectionString: config.database.connectionString,
      max: config.database.max,
      min: config.database.min,
    });
  } else {
    dbPool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
      max: config.database.max,
      min: config.database.min,
    });
  }

  // Initialize Redis connection
  const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
    lazyConnect: true,
  });

  // Test database connection
  try {
    const client = await dbPool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }

  // Test Redis connection
  try {
    await redis.ping();
    console.log('Redis connected successfully');
  } catch (error) {
    console.error('Redis connection failed:', error);
    throw error;
  }

  // Health check endpoint
  app.get('/health', async (request, reply) => {
    try {
      // Test database
      const dbClient = await dbPool.connect();
      await dbClient.query('SELECT 1');
      dbClient.release();
      
      // Test Redis
      await redis.ping();
      
      reply.send({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: true,
          redis: true
        },
        uptime: process.uptime(),
        memory: process.memoryUsage()
      });
    } catch (error) {
      console.error('Health check failed:', error);
      reply.code(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
        services: {
          database: false,
          redis: false
        }
      });
    }
  });

  // WebSocket endpoint with authentication
  app.register(async function (app) {
    app.get('/ws', { websocket: true }, (connection, request) => {
      const connectionId = `ws_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      
      // Extract authentication token from request
      const token = extractTokenFromRequest(
        request.url || '',
        request.headers
      );
      
      console.log(`WebSocket connection attempt: ${connectionId}`);
      
      if (!token) {
        console.warn(`WebSocket connection ${connectionId} rejected: No authentication token provided`);
        connection.socket.close(1008, 'Authentication required');
        return;
      }

      const user = verifyToken(token);
      if (!user) {
        console.warn(`WebSocket connection ${connectionId} rejected: Invalid or expired token`);
        connection.socket.close(1008, 'Invalid authentication token');
        return;
      }

      console.log(`Authenticated WebSocket connection established for user ${user.username} (${user.userId})`);

      // Send welcome message
      connection.socket.send(JSON.stringify({
        type: 'connected',
        connectionId,
        user: {
          id: user.userId,
          username: user.username
        },
        timestamp: Date.now(),
      }));

      // Handle incoming messages
      connection.socket.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          
          console.log(`Received message from ${connectionId}:`, data.type);
          
          switch (data.type) {
            case 'pong':
              // Handle pong response - connection is alive
              console.log(`Received pong from connection ${connectionId}`);
              break;
              
            case 'subscribe':
              // Handle channel subscriptions
              console.log(`Connection ${connectionId} subscribing to channel: ${data.channel}`);
              connection.socket.send(JSON.stringify({
                type: 'subscription_confirmed',
                channel: data.channel,
                timestamp: Date.now(),
              }));
              break;
              
            case 'visualization_request':
              // Handle visualization data requests
              console.log(`Visualization request from ${connectionId}`, data.params);
              connection.socket.send(JSON.stringify({
                type: 'visualization_data',
                requestId: data.requestId,
                data: { 
                  nodes: [
                    { id: 'test_node_1', type: 'track', name: 'Test Track 1', x: 100, y: 100 },
                    { id: 'test_node_2', type: 'artist', name: 'Test Artist 1', x: 200, y: 150 }
                  ], 
                  edges: [
                    { source: 'test_node_1', target: 'test_node_2', type: 'performed_by' }
                  ] 
                },
                timestamp: Date.now(),
              }));
              break;
              
            case 'user_interaction':
              // Handle user interactions (zoom, pan, etc.)
              console.log(`User interaction from ${connectionId}:`, data.interaction);
              // Echo back the interaction
              connection.socket.send(JSON.stringify({
                type: 'user_interaction_broadcast',
                connectionId,
                user: {
                  id: user.userId,
                  username: user.username
                },
                interaction: data.interaction,
                timestamp: Date.now(),
              }));
              break;
              
            default:
              console.warn(`Unknown WebSocket message type: ${data.type} from connection ${connectionId}`);
              connection.socket.send(JSON.stringify({
                type: 'error',
                message: `Unknown message type: ${data.type}`,
                timestamp: Date.now(),
              }));
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
          connection.socket.send(JSON.stringify({
            type: 'error',
            message: 'Failed to process message',
            timestamp: Date.now(),
          }));
        }
      });

      // Handle connection close
      connection.socket.on('close', (code, reason) => {
        console.log(`WebSocket connection ${connectionId} closed: ${code} - ${reason || 'unknown'}`);
      });

      // Handle connection error
      connection.socket.on('error', (error) => {
        console.error(`WebSocket connection ${connectionId} error:`, error);
      });
    });
  });

  // Basic graph data endpoint - return prepared visualization data
  app.get('/api/v1/graph', async (request, reply) => {
    try {
      // Query nodes from viz_nodes table - prioritize nodes that have edges
      const nodesQuery = `
        SELECT DISTINCT
          vn.id,
          vn.track_id,
          vn.x_position,
          vn.y_position,
          vn.metadata,
          vn.created_at
        FROM musicdb.viz_nodes vn
        INNER JOIN musicdb.viz_edges ve ON (vn.id = ve.source_id OR vn.id = ve.target_id)
        ORDER BY vn.created_at DESC
        LIMIT 100
      `;

      // Query edges from viz_edges table
      const edgesQuery = `
        SELECT
          ve.id,
          ve.source_id,
          ve.target_id,
          ve.weight,
          ve.edge_type,
          ve.metadata
        FROM musicdb.viz_edges ve
        ORDER BY ve.created_at DESC
        LIMIT 500
      `;

      const [nodesResult, edgesResult] = await Promise.all([
        dbPool.query(nodesQuery),
        dbPool.query(edgesQuery)
      ]);

      // Transform nodes to expected format
      const nodes = nodesResult.rows.map(row => ({
        id: row.id,
        trackId: row.track_id,
        title: row.metadata?.title || 'Unknown Track',
        artist: row.metadata?.artist || 'Unknown Artist',
        position: {
          x: row.x_position || Math.random() * 800,
          y: row.y_position || Math.random() * 600
        },
        metadata: row.metadata || {}
      }));

      // Transform edges to expected format
      const edges = edgesResult.rows.map(row => ({
        id: row.id,
        source_id: row.source_id,
        target_id: row.target_id,
        source: row.source_id,
        target: row.target_id,
        weight: row.weight || 1.0,
        type: row.edge_type,
        metadata: row.metadata || {}
      }));

      reply.send({
        nodes: nodes,
        edges: edges,
        metadata: {
          total_nodes: nodes.length,
          total_edges: edges.length,
          generated_at: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Graph data query failed:', error);
      reply.code(500).send({
        error: 'Failed to fetch graph data',
        message: error.message
      });
    }
  });

  // Visualization graph endpoint (used by frontend)
  app.post('/api/v1/visualization/graph', async (request, reply) => {
    try {
      const { max_nodes = 100, max_depth = 3, center_node_id, filters = {} } = request.body || {};

      // Build nodes query - prioritize nodes that have edges
      let nodesQuery = `
        SELECT DISTINCT
          vn.id,
          vn.track_id,
          vn.x_position,
          vn.y_position,
          vn.metadata,
          vn.created_at
        FROM musicdb.viz_nodes vn
        INNER JOIN musicdb.viz_edges ve ON (vn.id = ve.source_id OR vn.id = ve.target_id)
      `;

      let nodesParams = [];

      // Add center node filter if specified
      if (center_node_id) {
        nodesQuery += ` WHERE vn.id = $1`;
        nodesParams.push(center_node_id);
      }

      nodesQuery += ` ORDER BY vn.created_at DESC LIMIT $${nodesParams.length + 1}`;
      nodesParams.push(max_nodes);

      // Build edges query - get edges related to the selected nodes
      let edgesQuery = `
        SELECT
          ve.id,
          ve.source_id,
          ve.target_id,
          ve.weight,
          ve.edge_type,
          ve.metadata
        FROM musicdb.viz_edges ve
      `;

      let edgesParams = [];

      // If we have a center node, focus on edges connected to those nodes
      if (center_node_id) {
        edgesQuery += ` WHERE ve.source_id = $1 OR ve.target_id = $1`;
        edgesParams.push(center_node_id);
      }

      edgesQuery += ` ORDER BY ve.weight DESC LIMIT 500`;

      // Execute both queries in parallel
      const [nodesResult, edgesResult] = await Promise.all([
        dbPool.query(nodesQuery, nodesParams),
        dbPool.query(edgesQuery, edgesParams)
      ]);

      // Transform nodes to expected format
      const nodes = nodesResult.rows.map(row => ({
        id: row.id,
        trackId: row.track_id,
        title: row.metadata?.title || 'Unknown Track',
        artist: row.metadata?.artist || 'Unknown Artist',
        position: {
          x: row.x_position || Math.random() * 800,
          y: row.y_position || Math.random() * 600
        },
        metadata: row.metadata || {}
      }));

      // Create a set of node IDs for edge filtering
      const nodeIds = new Set(nodes.map(n => n.id));

      // Transform and filter edges to only include those between our nodes
      const edges = edgesResult.rows
        .filter(row => nodeIds.has(row.source_id) && nodeIds.has(row.target_id))
        .map(row => ({
          id: row.id,
          source_id: row.source_id,
          target_id: row.target_id,
          source: row.source_id,
          target: row.target_id,
          weight: row.weight || 1.0,
          type: row.edge_type,
          metadata: row.metadata || {}
        }));

      reply.send({
        nodes: nodes,
        edges: edges,
        metadata: {
          total_nodes: nodes.length,
          total_edges: edges.length,
          center_node: center_node_id,
          max_depth: max_depth,
          generated_at: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Visualization graph query failed:', error);
      reply.code(500).send({
        error: 'Failed to fetch visualization graph data',
        message: error.message
      });
    }
  });

  // Metrics endpoint
  app.get('/metrics', async (request, reply) => {
    reply.type('text/plain').send(`
# HELP enhanced_viz_health Service health status
# TYPE enhanced_viz_health gauge
enhanced_viz_health{service="enhanced-visualization-service"} 1

# HELP enhanced_viz_uptime Service uptime in seconds
# TYPE enhanced_viz_uptime counter
enhanced_viz_uptime ${process.uptime()}

# HELP enhanced_viz_memory_usage Memory usage in bytes
# TYPE enhanced_viz_memory_usage gauge
enhanced_viz_memory_usage{type="rss"} ${process.memoryUsage().rss}
enhanced_viz_memory_usage{type="heapUsed"} ${process.memoryUsage().heapUsed}
`);
  });

  return app;
}

async function start() {
  try {
    const app = await createServer();
    
    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      console.log(`Received ${signal}, shutting down gracefully`);
      process.exit(0);
    };
    
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
    
    await app.listen({
      port: config.port,
      host: config.host
    });
    
    console.log(`Enhanced Visualization Service (minimal) started on ${config.host}:${config.port}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();