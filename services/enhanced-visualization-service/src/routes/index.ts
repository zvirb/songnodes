/**
 * Route Setup for Enhanced Visualization Service
 */

import { FastifyInstance } from 'fastify';
import { logger } from '../utils/logger.js';

export function setupRoutes(fastify: FastifyInstance): void {
  // API v1 routes
  fastify.register(async function (fastify) {
    // Graph data endpoint
    fastify.get('/graph', async (request, reply) => {
      try {
        const graphData = await fastify.db.getGraphData();
        reply.send(graphData);
      } catch (error) {
        logger.error('Error fetching graph data:', error);
        reply.code(500).send({ error: 'Failed to fetch graph data' });
      }
    });

    // Viewport-based nodes
    fastify.get('/viewport/nodes', async (request, reply) => {
      const query = request.query as any;
      const { x = 0, y = 0, width = 1920, height = 1080 } = query;
      
      try {
        const nodes = await fastify.db.getNodesByViewport(
          parseFloat(x),
          parseFloat(y),
          parseFloat(width),
          parseFloat(height)
        );
        reply.send({ nodes });
      } catch (error) {
        logger.error('Error fetching viewport nodes:', error);
        reply.code(500).send({ error: 'Failed to fetch viewport nodes' });
      }
    });

    // Update node position
    fastify.post('/nodes/:id/position', async (request, reply) => {
      const { id } = request.params as any;
      const { x, y } = request.body as any;
      
      try {
        await fastify.db.updateNodePosition(id, x, y);
        
        // Broadcast update via WebSocket
        fastify.websocket.broadcast({
          type: 'node:position:update',
          nodeId: id,
          position: { x, y },
        });
        
        reply.send({ success: true });
      } catch (error) {
        logger.error('Error updating node position:', error);
        reply.code(500).send({ error: 'Failed to update node position' });
      }
    });

  }, { prefix: '/api/v1' });

  // WebSocket endpoint with authentication
  fastify.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (connection, request) => {
      const connectionId = `ws_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      
      // Extract authentication token from request
      const token = fastify.websocket.authService?.extractTokenFromRequest(
        request.url || '',
        request.headers as Record<string, string>
      );
      
      // Add connection with authentication
      fastify.websocket.addConnection(connectionId, connection.socket, token);
      
      // Note: All message handling is done by WebSocketService including authentication
    });
  });

  logger.info('Routes configured successfully');
}