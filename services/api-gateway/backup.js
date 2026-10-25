const express = require('express');
const router = express.Router();
const { execFile } = require('child_process');
const fs = require('fs').promises;
const multer = require('multer');

// Configure multer for file uploads
const upload = multer({
  dest: '/tmp/uploads/',
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// Database connection settings
const DB_HOST = process.env.DB_HOST || 'postgres';
const DB_PORT = process.env.DB_PORT || '5432';
const DB_NAME = process.env.DB_NAME || 'musicdb';
const DB_USER = process.env.DB_USER || 'musicuser';
const DB_PASSWORD = process.env.DB_PASSWORD || 'musicpass';

// Create database backup
router.post('/backup', async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `/tmp/musicdb_backup_${timestamp}.sql`;

    const env = { ...process.env, PGPASSWORD: DB_PASSWORD };
    const pgDumpArgs = [
      '-h', DB_HOST,
      '-p', String(DB_PORT),
      '-U', DB_USER,
      '-d', DB_NAME,
      '-F', 'c',
      '-b',
      '-v',
      '-f', backupFile
    ];

    // Execute backup using execFile to prevent command injection
    await new Promise((resolve, reject) => {
      execFile('pg_dump', pgDumpArgs, { env, maxBuffer: 1024 * 1024 * 100 }, (error, stdout, stderr) => {
        if (error) {
          console.error('Backup error:', error);
          console.error('Stderr:', stderr);
          reject(error);
        } else {
          console.log('Backup stdout:', stdout);
          resolve(stdout);
        }
      });
    });

    // Read backup file
    const backupData = await fs.readFile(backupFile);

    // Clean up temp file
    await fs.unlink(backupFile);

    // Send backup file to client
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="musicdb_backup_${timestamp}.sql"`,
      'Content-Length': backupData.length
    });

    res.send(backupData);
  } catch (error) {
    console.error('Backup failed:', error);
    res.status(500).json({
      error: 'Backup failed',
      message: error.message
    });
  }
});

// Restore database from backup
router.post('/restore', upload.single('backup'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No backup file provided' });
    }

    const backupFile = req.file.path;
    const env = { ...process.env, PGPASSWORD: DB_PASSWORD };

    // First, drop and recreate the database using execFile
    const safeDbIdentifier = DB_NAME.replace(/"/g, '""');
    const dropSql = `DROP DATABASE IF EXISTS "${safeDbIdentifier}"; CREATE DATABASE "${safeDbIdentifier}";`;
    const dropArgs = [
      '-h', DB_HOST,
      '-p', String(DB_PORT),
      '-U', DB_USER,
      '-d', 'postgres',
      '-c', dropSql
    ];

    await new Promise((resolve, reject) => {
      execFile('psql', dropArgs, { env }, (error, stdout, stderr) => {
        if (error && !stderr.includes('does not exist')) {
          console.error('Drop/create error:', error);
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });

    // Restore from backup using execFile
    const restoreArgs = [
      '-h', DB_HOST,
      '-p', String(DB_PORT),
      '-U', DB_USER,
      '-d', DB_NAME,
      '-v', backupFile
    ];

    await new Promise((resolve, reject) => {
      execFile('pg_restore', restoreArgs, { env, maxBuffer: 1024 * 1024 * 100 }, (error, stdout, stderr) => {
        if (error) {
          // pg_restore often returns warnings as errors, check if critical
          if (stderr && stderr.includes('ERROR')) {
            console.error('Restore error:', error);
            reject(error);
          } else {
            console.log('Restore completed with warnings');
            resolve(stdout);
          }
        } else {
          resolve(stdout);
        }
      });
    });

    // Clean up uploaded file
    await fs.unlink(backupFile);

    res.json({
      success: true,
      message: 'Database restored successfully'
    });
  } catch (error) {
    console.error('Restore failed:', error);

    // Clean up file if it exists
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    res.status(500).json({
      error: 'Restore failed',
      message: error.message
    });
  }
});

// Get backup status/info
router.get('/status', async (req, res) => {
  try {
    const env = { ...process.env, PGPASSWORD: DB_PASSWORD };
    const safeDbNameLiteral = DB_NAME.replace(/'/g, "''");

    // Check database connection and size
    const sizeArgs = [
      '-h', DB_HOST,
      '-p', String(DB_PORT),
      '-U', DB_USER,
      '-d', DB_NAME,
      '-t',
      '-c', `SELECT pg_size_pretty(pg_database_size('${safeDbNameLiteral}'));`
    ];

    const dbSize = await new Promise((resolve, reject) => {
      execFile('psql', sizeArgs, { env }, (error, stdout, _stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });

    // Get table count
    const tableCountArgs = [
      '-h', DB_HOST,
      '-p', String(DB_PORT),
      '-U', DB_USER,
      '-d', DB_NAME,
      '-t',
      '-c', "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
    ];

    const tableCount = await new Promise((resolve, reject) => {
      execFile('psql', tableCountArgs, { env }, (error, stdout, _stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(parseInt(stdout.trim(), 10));
        }
      });
    });

    res.json({
      database: DB_NAME,
      size: dbSize,
      tables: tableCount,
      ready: true
    });
  } catch (error) {
    console.error('Status check failed:', error);
    res.status(500).json({
      error: 'Status check failed',
      message: error.message,
      ready: false
    });
  }
});

module.exports = router;
