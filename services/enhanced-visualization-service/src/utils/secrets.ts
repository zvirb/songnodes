/**
 * Secure Secret Management System
 * Provides centralized secret handling with validation and rotation support
 */

import crypto from 'crypto';
import { logger } from './logger.js';

interface SecretConfig {
  name: string;
  required: boolean;
  minLength?: number;
  pattern?: RegExp;
  description: string;
}

interface SecretStore {
  [key: string]: string | undefined;
}

export class SecretManager {
  private secrets: SecretStore = {};
  private secretConfigs: SecretConfig[] = [
    {
      name: 'JWT_SECRET',
      required: true,
      minLength: 32,
      description: 'JWT signing secret key - must be cryptographically secure'
    },
    {
      name: 'DB_PASSWORD',
      required: true,
      minLength: 8,
      description: 'Database password'
    },
    {
      name: 'REDIS_PASSWORD',
      required: false,
      minLength: 8,
      description: 'Redis password (required in production)'
    },
    {
      name: 'DB_SSL_CA',
      required: false,
      description: 'Database SSL CA certificate'
    },
    {
      name: 'DB_SSL_CERT',
      required: false,
      description: 'Database SSL client certificate'
    },
    {
      name: 'DB_SSL_KEY',
      required: false,
      description: 'Database SSL client private key'
    },
    {
      name: 'ENCRYPTION_KEY',
      required: false,
      minLength: 32,
      description: 'Data encryption key for sensitive data at rest'
    }
  ];

  constructor() {
    this.loadSecrets();
    this.validateSecrets();
  }

  /**
   * Load secrets from environment variables
   */
  private loadSecrets(): void {
    for (const config of this.secretConfigs) {
      const value = process.env[config.name];
      if (value) {
        this.secrets[config.name] = value;
      }
    }
  }

  /**
   * Validate all loaded secrets
   */
  private validateSecrets(): void {
    const errors: string[] = [];
    const isProduction = process.env.NODE_ENV === 'production';

    for (const config of this.secretConfigs) {
      const value = this.secrets[config.name];

      // Check if required secret is missing
      if (config.required && !value) {
        errors.push(`Required secret ${config.name} is missing: ${config.description}`);
        continue;
      }

      // Production-specific requirements
      if (isProduction && config.name === 'REDIS_PASSWORD' && !value) {
        errors.push(`${config.name} is required in production environment`);
        continue;
      }

      // Skip validation if secret is not set and not required
      if (!value) continue;

      // Validate minimum length
      if (config.minLength && value.length < config.minLength) {
        errors.push(`Secret ${config.name} must be at least ${config.minLength} characters long`);
      }

      // Validate pattern
      if (config.pattern && !config.pattern.test(value)) {
        errors.push(`Secret ${config.name} does not match required pattern`);
      }

      // Special validation for JWT secret
      if (config.name === 'JWT_SECRET') {
        this.validateJWTSecret(value, errors);
      }
    }

    if (errors.length > 0) {
      logger.error('Secret validation failed:', errors);
      throw new Error(`Secret validation failed: ${errors.join('; ')}`);
    }

    logger.info('✅ All secrets validated successfully');
  }

  /**
   * Validate JWT secret strength
   */
  private validateJWTSecret(secret: string, errors: string[]): void {
    // Check entropy (basic check)
    const uniqueChars = new Set(secret).size;
    if (uniqueChars < 16) {
      errors.push('JWT_SECRET has insufficient entropy (too few unique characters)');
    }

    // Check for common patterns
    if (/^(.)\1+$/.test(secret)) {
      errors.push('JWT_SECRET cannot be a repeated character');
    }

    if (/^(abc|123|qwe|password|secret)/i.test(secret)) {
      errors.push('JWT_SECRET contains common insecure patterns');
    }
  }

  /**
   * Get a secret value
   */
  getSecret(name: string): string | undefined {
    return this.secrets[name];
  }

  /**
   * Get a required secret (throws if missing)
   */
  getRequiredSecret(name: string): string {
    const value = this.secrets[name];
    if (!value) {
      throw new Error(`Required secret ${name} is not available`);
    }
    return value;
  }

  /**
   * Check if secret exists
   */
  hasSecret(name: string): boolean {
    return this.secrets[name] !== undefined;
  }

  /**
   * Generate a cryptographically secure secret
   */
  generateSecret(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url');
  }

  /**
   * Hash a secret for storage (one-way)
   */
  hashSecret(secret: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(secret, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verify a secret against a hash
   */
  verifySecret(secret: string, hash: string): boolean {
    try {
      const [salt, storedHash] = hash.split(':');
      const verifyHash = crypto.pbkdf2Sync(secret, salt, 100000, 64, 'sha512').toString('hex');
      return storedHash === verifyHash;
    } catch (error) {
      logger.error('Secret verification failed:', error);
      return false;
    }
  }

  /**
   * Encrypt sensitive data using the encryption key
   */
  encrypt(data: string): string {
    const encryptionKey = this.getSecret('ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY not available for data encryption');
    }

    const key = crypto.scryptSync(encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', key);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data using the encryption key
   */
  decrypt(encryptedData: string): string {
    const encryptionKey = this.getSecret('ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY not available for data decryption');
    }

    const [ivHex, encrypted] = encryptedData.split(':');
    const key = crypto.scryptSync(encryptionKey, 'salt', 32);
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Get secret configuration for documentation
   */
  getSecretConfigs(): SecretConfig[] {
    return this.secretConfigs.map(config => ({
      ...config,
      // Don't expose patterns for security
      pattern: undefined
    }));
  }

  /**
   * Rotate JWT secret (for advanced secret rotation)
   */
  rotateJWTSecret(): string {
    const newSecret = this.generateSecret(64);
    logger.warn('JWT secret rotation requested - this requires application restart');
    return newSecret;
  }

  /**
   * Validate environment setup
   */
  validateEnvironment(): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const isProduction = process.env.NODE_ENV === 'production';

    // Check for .env file in development
    if (!isProduction) {
      try {
        // This will throw if .env file doesn't exist
        const fs = require('fs');
        if (!fs.existsSync('.env')) {
          warnings.push('No .env file found - ensure environment variables are set');
        }
      } catch (error) {
        // Ignore error if fs is not available
      }
    }

    // Check for secure transport in production
    if (isProduction) {
      if (!this.hasSecret('DB_SSL_CA') && process.env.DB_SSL === 'true') {
        warnings.push('Database SSL enabled but no CA certificate provided');
      }

      if (!process.env.HTTPS && !process.env.SSL_CERT) {
        warnings.push('HTTPS should be enabled in production');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// Export singleton instance
export const secretManager = new SecretManager();