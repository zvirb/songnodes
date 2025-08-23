/**
 * Database Service for Enhanced Visualization
 */

import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

export interface DatabaseConfig {
  url?: string | undefined;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
  max: number;
  min: number;
}

export class DatabaseService {
  private pool: Pool | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      // Use DATABASE_URL if provided, otherwise use individual config values
      const poolConfig = this.config.url ? {
        connectionString: this.config.url,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis,
        idleTimeoutMillis: this.config.idleTimeoutMillis,
        max: this.config.max,
        min: this.config.min,
      } : {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password,
        ssl: this.config.ssl ? { 
          rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false', // Default to true for security
          ca: process.env.DB_SSL_CA, // SSL CA certificate
          cert: process.env.DB_SSL_CERT, // SSL client certificate
          key: process.env.DB_SSL_KEY // SSL client key
        } : false,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis,
        idleTimeoutMillis: this.config.idleTimeoutMillis,
        max: this.config.max,
        min: this.config.min,
      };

      logger.info('Attempting database connection with config:', { 
        url: this.config.url ? '***' : undefined,
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        username: this.config.username
      });

      this.pool = new Pool(poolConfig);

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Database disconnected');
    }
  }

  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    // Validate query parameters to prevent SQL injection
    this.validateQuerySafety(text, params);

    try {
      const result = await this.pool.query(text, params);
      return result.rows;
    } catch (error) {
      logger.error('Database query error:', { 
        text: text.substring(0, 200) + (text.length > 200 ? '...' : ''), // Truncate for security
        paramCount: params?.length || 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const results = await this.query<T>(text, params);
    return results.length > 0 ? results[0] || null : null;
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      if (!this.pool) return false;
      
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Validate query safety to prevent SQL injection
   */
  private validateQuerySafety(text: string, params?: any[]): void {
    // Check for dangerous SQL patterns
    const dangerousPatterns = [
      /;\s*(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE)\s+/i,
      /UNION\s+SELECT/i,
      /--\s*$/m,
      /\/\*.*\*\//,
      /exec\s*\(/i,
      /sp_\w+/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(text)) {
        logger.error('Potentially dangerous SQL pattern detected:', text.substring(0, 100));
        throw new Error('Query contains potentially dangerous patterns');
      }
    }

    // Validate parameters
    if (params) {
      for (let i = 0; i < params.length; i++) {
        const param = params[i];
        if (typeof param === 'string' && param.length > 10000) {
          throw new Error(`Parameter ${i} is too long (max 10000 characters)`);
        }
      }
    }
  }

  // Visualization specific queries with input validation
  async getGraphData(filters?: any): Promise<{ nodes: any[], edges: any[] }> {
    try {
      // Validate input filters
      const filtersSchema = z.object({
        genre: z.string().max(50).optional(),
        artist: z.string().max(100).optional(),
        year: z.number().min(1900).max(2100).optional(),
        nodeType: z.enum(['track', 'artist', 'album', 'mix']).optional(),
        limit: z.number().min(1).max(50000).optional(),
        offset: z.number().min(0).optional()
      }).optional();

      const validatedFilters = filters ? filtersSchema.parse(filters) : undefined;
      // Build WHERE clause based on validated filters
      const whereClauses: string[] = ['n.active = true'];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (validatedFilters?.genre) {
        whereClauses.push(`n.genre = $${paramIndex}`);
        queryParams.push(validatedFilters.genre);
        paramIndex++;
      }

      if (validatedFilters?.artist) {
        whereClauses.push(`n.artist ILIKE $${paramIndex}`);
        queryParams.push(`%${validatedFilters.artist}%`);
        paramIndex++;
      }

      if (validatedFilters?.year) {
        whereClauses.push(`n.year = $${paramIndex}`);
        queryParams.push(validatedFilters.year);
        paramIndex++;
      }

      const limit = Math.min(validatedFilters?.limit || 10000, 50000);
      const offset = validatedFilters?.offset || 0;

      // Get nodes with visualization metadata
      const nodes = await this.query(`
        SELECT 
          n.id,
          n.title,
          n.artist,
          n.genre,
          n.year,
          n.bpm,
          n.energy,
          n.valence,
          n.danceability,
          vm.x_position,
          vm.y_position,
          vm.cluster_id,
          vm.centrality_score,
          vm.community_id
        FROM nodes n
        LEFT JOIN visualization_metadata vm ON n.id = vm.node_id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY vm.centrality_score DESC NULLS LAST
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...queryParams, limit, offset]);

      // Get edges with weights
      const edges = await this.query(`
        SELECT 
          e.source_id,
          e.target_id,
          e.weight,
          e.relationship_type,
          e.confidence_score
        FROM edges e
        INNER JOIN nodes n1 ON e.source_id = n1.id
        INNER JOIN nodes n2 ON e.target_id = n2.id
        WHERE n1.active = true AND n2.active = true
        AND e.weight > 0.1
        ORDER BY e.weight DESC
        LIMIT 50000
      `);

      return { nodes, edges };
    } catch (error) {
      logger.error('Failed to get graph data:', error);
      throw error;
    }
  }

  async updateNodePosition(nodeId: string, x: number, y: number): Promise<void> {
    // Validate input parameters
    const updateSchema = z.object({
      nodeId: z.string().min(1).max(100),
      x: z.number().min(-1000000).max(1000000),
      y: z.number().min(-1000000).max(1000000)
    });

    const validated = updateSchema.parse({ nodeId, x, y });

    await this.query(`
      INSERT INTO visualization_metadata (node_id, x_position, y_position, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (node_id) 
      DO UPDATE SET 
        x_position = $2,
        y_position = $3,
        updated_at = NOW()
    `, [validated.nodeId, validated.x, validated.y]);
  }

  async getNodesByViewport(x: number, y: number, width: number, height: number, limit?: number): Promise<any[]> {
    // Validate viewport parameters
    const viewportSchema = z.object({
      x: z.number().min(-1000000).max(1000000),
      y: z.number().min(-1000000).max(1000000),
      width: z.number().min(1).max(100000),
      height: z.number().min(1).max(100000),
      limit: z.number().min(1).max(10000).optional()
    });

    const validated = viewportSchema.parse({ x, y, width, height, limit });
    const queryLimit = Math.min(validated.limit || 1000, 10000);

    return await this.query(`
      SELECT 
        n.id,
        n.title,
        n.artist,
        vm.x_position,
        vm.y_position
      FROM nodes n
      INNER JOIN visualization_metadata vm ON n.id = vm.node_id
      WHERE vm.x_position BETWEEN $1 AND $2
        AND vm.y_position BETWEEN $3 AND $4
        AND n.active = true
      ORDER BY vm.centrality_score DESC
      LIMIT $5
    `, [validated.x, validated.x + validated.width, validated.y, validated.y + validated.height, queryLimit]);
  }

  /**
   * Get node details by ID with validation
   */
  async getNodeById(nodeId: string): Promise<any | null> {
    const nodeIdSchema = z.string().min(1).max(100);
    const validatedNodeId = nodeIdSchema.parse(nodeId);

    return await this.queryOne(`
      SELECT 
        n.id,
        n.title,
        n.artist,
        n.genre,
        n.year,
        n.bpm,
        n.energy,
        n.valence,
        n.danceability,
        vm.x_position,
        vm.y_position,
        vm.cluster_id,
        vm.centrality_score,
        vm.community_id
      FROM nodes n
      LEFT JOIN visualization_metadata vm ON n.id = vm.node_id
      WHERE n.id = $1 AND n.active = true
    `, [validatedNodeId]);
  }

  /**
   * Search nodes with validation
   */
  async searchNodes(query: string, limit?: number): Promise<any[]> {
    const searchSchema = z.object({
      query: z.string().min(1).max(200),
      limit: z.number().min(1).max(1000).optional()
    });

    const validated = searchSchema.parse({ query, limit });
    const queryLimit = Math.min(validated.limit || 100, 1000);

    return await this.query(`
      SELECT 
        n.id,
        n.title,
        n.artist,
        n.genre,
        n.year,
        vm.x_position,
        vm.y_position,
        vm.centrality_score,
        ts_rank(to_tsvector('english', n.title || ' ' || n.artist), plainto_tsquery('english', $1)) as rank
      FROM nodes n
      LEFT JOIN visualization_metadata vm ON n.id = vm.node_id
      WHERE n.active = true
        AND (n.title ILIKE $2 OR n.artist ILIKE $2)
      ORDER BY rank DESC, vm.centrality_score DESC NULLS LAST
      LIMIT $3
    `, [validated.query, `%${validated.query}%`, queryLimit]);
  }

  /**
   * Get edges for specific nodes with validation
   */
  async getEdgesForNodes(nodeIds: string[], limit?: number): Promise<any[]> {
    const edgesSchema = z.object({
      nodeIds: z.array(z.string().min(1).max(100)).min(1).max(1000),
      limit: z.number().min(1).max(50000).optional()
    });

    const validated = edgesSchema.parse({ nodeIds, limit });
    const queryLimit = Math.min(validated.limit || 10000, 50000);

    // Create parameterized query for IN clause
    const placeholders = validated.nodeIds.map((_, index) => `$${index + 1}`).join(',');
    
    return await this.query(`
      SELECT 
        e.source_id,
        e.target_id,
        e.weight,
        e.relationship_type,
        e.confidence_score
      FROM edges e
      INNER JOIN nodes n1 ON e.source_id = n1.id
      INNER JOIN nodes n2 ON e.target_id = n2.id
      WHERE n1.active = true AND n2.active = true
        AND (e.source_id IN (${placeholders}) OR e.target_id IN (${placeholders}))
        AND e.weight > 0.1
      ORDER BY e.weight DESC
      LIMIT $${validated.nodeIds.length * 2 + 1}
    `, [...validated.nodeIds, ...validated.nodeIds, queryLimit]);
  }
}