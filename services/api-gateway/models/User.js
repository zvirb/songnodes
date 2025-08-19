const { v4: uuidv4 } = require('uuid');
const { redisClient } = require('../config/redis');
const logger = require('../utils/logger');

class UserModel {
  constructor() {
    this.redisPrefix = 'user:';
    this.emailIndexPrefix = 'email_index:';
  }

  // Generate user ID
  generateId() {
    return uuidv4();
  }

  // Create user
  async create(userData) {
    const userId = this.generateId();
    const user = {
      id: userId,
      email: userData.email.toLowerCase(),
      password: userData.password,
      name: userData.name,
      role: userData.role || 'user',
      permissions: userData.permissions || ['read'],
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      emailVerified: userData.emailVerified || false,
      failedLoginAttempts: 0,
      lastFailedLogin: null,
      lastLogin: null,
      createdAt: userData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      // Store user data
      await redisClient.hSet(`${this.redisPrefix}${userId}`, user);
      
      // Create email index for quick lookups
      await redisClient.set(`${this.emailIndexPrefix}${user.email}`, userId);
      
      logger.info(`User created: ${user.email} (${userId})`);
      return user;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }

  // Find user by ID
  async findById(userId) {
    try {
      const userData = await redisClient.hGetAll(`${this.redisPrefix}${userId}`);
      
      if (Object.keys(userData).length === 0) {
        return null;
      }

      // Convert string booleans back to actual booleans
      userData.isActive = userData.isActive === 'true';
      userData.emailVerified = userData.emailVerified === 'true';
      userData.failedLoginAttempts = parseInt(userData.failedLoginAttempts) || 0;
      
      // Parse permissions array
      if (userData.permissions) {
        userData.permissions = JSON.parse(userData.permissions);
      }

      return userData;
    } catch (error) {
      logger.error(`Error finding user by ID ${userId}:`, error);
      return null;
    }
  }

  // Find user by email
  async findByEmail(email) {
    try {
      const normalizedEmail = email.toLowerCase();
      const userId = await redisClient.get(`${this.emailIndexPrefix}${normalizedEmail}`);
      
      if (!userId) {
        return null;
      }

      return await this.findById(userId);
    } catch (error) {
      logger.error(`Error finding user by email ${email}:`, error);
      return null;
    }
  }

  // Update user
  async update(userId, updateData) {
    try {
      const existingUser = await this.findById(userId);
      if (!existingUser) {
        throw new Error('User not found');
      }

      const updatedUser = {
        ...existingUser,
        ...updateData,
        updatedAt: new Date().toISOString()
      };

      // Ensure permissions is stringified for Redis storage
      if (updatedUser.permissions && Array.isArray(updatedUser.permissions)) {
        updatedUser.permissions = JSON.stringify(updatedUser.permissions);
      }

      await redisClient.hSet(`${this.redisPrefix}${userId}`, updatedUser);
      
      // Update email index if email changed
      if (updateData.email && updateData.email !== existingUser.email) {
        await redisClient.del(`${this.emailIndexPrefix}${existingUser.email}`);
        await redisClient.set(`${this.emailIndexPrefix}${updateData.email.toLowerCase()}`, userId);
      }

      logger.info(`User updated: ${updatedUser.email} (${userId})`);
      return updatedUser;
    } catch (error) {
      logger.error(`Error updating user ${userId}:`, error);
      throw error;
    }
  }

  // Update password
  async updatePassword(userId, hashedPassword) {
    try {
      await redisClient.hSet(`${this.redisPrefix}${userId}`, {
        password: hashedPassword,
        updatedAt: new Date().toISOString()
      });
      
      logger.info(`Password updated for user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Error updating password for user ${userId}:`, error);
      throw new Error('Failed to update password');
    }
  }

  // Update last login
  async updateLastLogin(userId) {
    try {
      await redisClient.hSet(`${this.redisPrefix}${userId}`, {
        lastLogin: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      return true;
    } catch (error) {
      logger.error(`Error updating last login for user ${userId}:`, error);
      return false;
    }
  }

  // Increment failed login attempts
  async incrementFailedLogins(userId) {
    try {
      const user = await this.findById(userId);
      if (!user) return false;

      const failedAttempts = (user.failedLoginAttempts || 0) + 1;
      
      await redisClient.hSet(`${this.redisPrefix}${userId}`, {
        failedLoginAttempts: failedAttempts.toString(),
        lastFailedLogin: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      logger.warn(`Failed login attempt ${failedAttempts} for user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Error incrementing failed logins for user ${userId}:`, error);
      return false;
    }
  }

  // Reset failed login attempts
  async resetFailedLogins(userId) {
    try {
      await redisClient.hSet(`${this.redisPrefix}${userId}`, {
        failedLoginAttempts: '0',
        lastFailedLogin: null,
        updatedAt: new Date().toISOString()
      });

      return true;
    } catch (error) {
      logger.error(`Error resetting failed logins for user ${userId}:`, error);
      return false;
    }
  }

  // Delete user (soft delete by setting isActive to false)
  async delete(userId) {
    try {
      const user = await this.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      await this.update(userId, { 
        isActive: false,
        deletedAt: new Date().toISOString()
      });

      logger.info(`User soft deleted: ${user.email} (${userId})`);
      return true;
    } catch (error) {
      logger.error(`Error deleting user ${userId}:`, error);
      throw error;
    }
  }

  // Hard delete user (completely remove from Redis)
  async hardDelete(userId) {
    try {
      const user = await this.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Delete user data
      await redisClient.del(`${this.redisPrefix}${userId}`);
      
      // Delete email index
      await redisClient.del(`${this.emailIndexPrefix}${user.email}`);

      logger.info(`User hard deleted: ${user.email} (${userId})`);
      return true;
    } catch (error) {
      logger.error(`Error hard deleting user ${userId}:`, error);
      throw error;
    }
  }

  // Verify email
  async verifyEmail(userId) {
    try {
      await redisClient.hSet(`${this.redisPrefix}${userId}`, {
        emailVerified: 'true',
        updatedAt: new Date().toISOString()
      });

      logger.info(`Email verified for user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Error verifying email for user ${userId}:`, error);
      return false;
    }
  }

  // Update user role
  async updateRole(userId, newRole) {
    try {
      await redisClient.hSet(`${this.redisPrefix}${userId}`, {
        role: newRole,
        updatedAt: new Date().toISOString()
      });

      logger.info(`Role updated to ${newRole} for user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Error updating role for user ${userId}:`, error);
      return false;
    }
  }

  // Update user permissions
  async updatePermissions(userId, permissions) {
    try {
      await redisClient.hSet(`${this.redisPrefix}${userId}`, {
        permissions: JSON.stringify(permissions),
        updatedAt: new Date().toISOString()
      });

      logger.info(`Permissions updated for user ${userId}:`, permissions);
      return true;
    } catch (error) {
      logger.error(`Error updating permissions for user ${userId}:`, error);
      return false;
    }
  }

  // Get all users (admin function)
  async findAll(options = {}) {
    try {
      const { limit = 100, offset = 0, active = true } = options;
      
      // This is a simple implementation - in production, you might want pagination
      const keys = await redisClient.keys(`${this.redisPrefix}*`);
      const users = [];

      for (const key of keys.slice(offset, offset + limit)) {
        const userData = await redisClient.hGetAll(key);
        
        if (Object.keys(userData).length > 0) {
          // Filter by active status if specified
          if (active !== undefined && userData.isActive !== active.toString()) {
            continue;
          }

          // Convert string booleans back to actual booleans
          userData.isActive = userData.isActive === 'true';
          userData.emailVerified = userData.emailVerified === 'true';
          userData.failedLoginAttempts = parseInt(userData.failedLoginAttempts) || 0;
          
          // Parse permissions array
          if (userData.permissions) {
            userData.permissions = JSON.parse(userData.permissions);
          }

          // Don't include password in results
          delete userData.password;
          users.push(userData);
        }
      }

      return users;
    } catch (error) {
      logger.error('Error finding all users:', error);
      return [];
    }
  }

  // User exists check
  async exists(email) {
    try {
      const normalizedEmail = email.toLowerCase();
      const userId = await redisClient.get(`${this.emailIndexPrefix}${normalizedEmail}`);
      return !!userId;
    } catch (error) {
      logger.error(`Error checking if user exists ${email}:`, error);
      return false;
    }
  }

  // Get user count
  async count() {
    try {
      const keys = await redisClient.keys(`${this.redisPrefix}*`);
      return keys.length;
    } catch (error) {
      logger.error('Error getting user count:', error);
      return 0;
    }
  }
}

module.exports = new UserModel();