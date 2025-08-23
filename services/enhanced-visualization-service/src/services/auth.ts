/**
 * JWT Authentication Service for WebSocket Connections
 */

import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

export interface JWTPayload {
  userId: string;
  username: string;
  roles: string[];
  sessionId: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedUser {
  userId: string;
  username: string;
  roles: string[];
  sessionId: string;
}

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly issuer: string;

  constructor() {
    // JWT secret is required for security
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required for authentication');
    }
    this.jwtSecret = jwtSecret;

    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.issuer = process.env.JWT_ISSUER || 'songnodes-enhanced-visualization';
  }

  /**
   * Verify JWT token and extract user information
   */
  verifyToken(token: string): AuthenticatedUser | null {
    try {
      const payload = jwt.verify(token, this.jwtSecret, {
        issuer: this.issuer,
        algorithms: ['HS256']
      }) as JWTPayload;

      return {
        userId: payload.userId,
        username: payload.username,
        roles: payload.roles || [],
        sessionId: payload.sessionId
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.warn('JWT token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger.warn('Invalid JWT token', { message: error.message });
      } else {
        logger.error('JWT verification failed', { error });
      }
      return null;
    }
  }

  /**
   * Extract token from WebSocket upgrade request
   */
  extractTokenFromRequest(url: string, headers: Record<string, string>): string | null {
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
      logger.warn('Failed to parse URL for token extraction:', error);
      return null;
    }
  }

  /**
   * Check if user has required role
   */
  hasRole(user: AuthenticatedUser, requiredRole: string): boolean {
    return user.roles.includes(requiredRole) || user.roles.includes('admin');
  }

  /**
   * Check if user has any of the required roles
   */
  hasAnyRole(user: AuthenticatedUser, requiredRoles: string[]): boolean {
    return requiredRoles.some(role => this.hasRole(user, role));
  }

  /**
   * Generate session tracking key for user
   */
  generateSessionKey(user: AuthenticatedUser): string {
    return `session:${user.userId}:${user.sessionId}`;
  }

  /**
   * Validate user permissions for visualization operations
   */
  canAccessVisualization(user: AuthenticatedUser): boolean {
    const allowedRoles = ['user', 'premium', 'admin', 'viewer'];
    return this.hasAnyRole(user, allowedRoles);
  }

  /**
   * Validate user permissions for modification operations
   */
  canModifyVisualization(user: AuthenticatedUser): boolean {
    const allowedRoles = ['user', 'premium', 'admin'];
    return this.hasAnyRole(user, allowedRoles);
  }
}

export const authService = new AuthService();