const request = require('supertest');
const express = require('express');
const childProcess = require('child_process');
const fs = require('fs').promises;

jest.mock('child_process');

const backupRouter = require('./backup');

const app = express();
app.use(express.json());
app.use('/', backupRouter);

describe('Backup API Router', () => {
  let readFileSpy;
  let unlinkSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    readFileSpy = jest.spyOn(fs, 'readFile').mockImplementation();
    unlinkSpy = jest.spyOn(fs, 'unlink').mockImplementation();
  });

  afterEach(() => {
    readFileSpy.mockRestore();
    unlinkSpy.mockRestore();
  });

  describe('POST /backup', () => {
    it('should invoke execFile with pg_dump and array arguments', async () => {
      childProcess.execFile.mockImplementation((file, args, options, callback) => {
        expect(file).toBe('pg_dump');
        expect(Array.isArray(args)).toBe(true);
        expect(args).toContain('-d');
        expect(args).toContain('musicdb');
        expect(options.env.PGPASSWORD).toBe('musicpass');
        callback(null, 'backup stdout', '');
      });

      readFileSpy.mockResolvedValue(Buffer.from('dummy sql backup data'));
      unlinkSpy.mockResolvedValue();

      const response = await request(app).post('/backup');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/octet-stream');
      expect(childProcess.execFile).toHaveBeenCalledTimes(1);
      expect(readFileSpy).toHaveBeenCalledTimes(1);
      expect(unlinkSpy).toHaveBeenCalledTimes(1);
    });

    it('should return 500 error if execFile fails', async () => {
      childProcess.execFile.mockImplementation((file, args, options, callback) => {
        callback(new Error('pg_dump failed'), '', 'Error details');
      });

      const response = await request(app).post('/backup');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Backup failed');
    });
  });

  describe('POST /restore', () => {
    it('should return 400 if no file is provided', async () => {
      const response = await request(app).post('/restore');
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No backup file provided');
    });

    it('should invoke execFile with psql and pg_restore safely', async () => {
      let execCalls = 0;
      childProcess.execFile.mockImplementation((file, args, options, callback) => {
        execCalls++;
        expect(Array.isArray(args)).toBe(true);
        expect(options.env.PGPASSWORD).toBe('musicpass');
        if (execCalls === 1) {
          expect(file).toBe('psql');
          expect(args).toContain('-d');
          expect(args).toContain('postgres');
        } else if (execCalls === 2) {
          expect(file).toBe('pg_restore');
          expect(args).toContain('-d');
          expect(args).toContain('musicdb');
        }
        callback(null, 'success', '');
      });

      unlinkSpy.mockResolvedValue();

      const response = await request(app)
        .post('/restore')
        .attach('backup', Buffer.from('mock sql backup content'), 'backup.sql');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(execCalls).toBe(2);
      expect(unlinkSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /status', () => {
    it('should invoke execFile with psql to check size and table count', async () => {
      let callCount = 0;
      childProcess.execFile.mockImplementation((file, args, options, callback) => {
        callCount++;
        expect(file).toBe('psql');
        expect(Array.isArray(args)).toBe(true);
        expect(options.env.PGPASSWORD).toBe('musicpass');
        if (callCount === 1) {
          callback(null, '  15 MB  ', '');
        } else {
          callback(null, '  42  ', '');
        }
      });

      const response = await request(app).get('/status');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        database: 'musicdb',
        size: '15 MB',
        tables: 42,
        ready: true
      });
      expect(callCount).toBe(2);
    });

    it('should handle status check failures gracefully', async () => {
      childProcess.execFile.mockImplementation((file, args, options, callback) => {
        callback(new Error('Connection failed'), '', 'Error');
      });

      const response = await request(app).get('/status');

      expect(response.status).toBe(500);
      expect(response.body.ready).toBe(false);
      expect(response.body.error).toBe('Status check failed');
    });
  });
});
