const path = require('path');
const fs = require('fs');

class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    // Ensure logs directory exists
    this.logDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  shouldLog(level) {
    return this.logLevels[level] <= this.logLevels[this.logLevel];
  }

  formatMessage(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      service: 'api-gateway',
      ...data
    };

    return JSON.stringify(logEntry);
  }

  writeToFile(level, formattedMessage) {
    const filename = path.join(this.logDir, `${level}.log`);
    const logLine = formattedMessage + '\n';
    
    fs.appendFile(filename, logLine, (err) => {
      if (err) {
        console.error('Failed to write to log file:', err);
      }
    });
  }

  log(level, message, data = {}) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, data);
    
    // Always write to console
    console[level === 'debug' ? 'log' : level](formattedMessage);
    
    // Write to file in production
    if (process.env.NODE_ENV === 'production') {
      this.writeToFile(level, formattedMessage);
    }
  }

  error(message, data = {}) {
    this.log('error', message, data);
  }

  warn(message, data = {}) {
    this.log('warn', message, data);
  }

  info(message, data = {}) {
    this.log('info', message, data);
  }

  debug(message, data = {}) {
    this.log('debug', message, data);
  }

  // Security audit logging
  audit(action, user, details = {}) {
    this.info(`AUDIT: ${action}`, {
      action,
      user: user?.email || 'anonymous',
      userId: user?.id,
      ...details,
      audit: true
    });
  }

  // Performance logging
  performance(operation, duration, details = {}) {
    this.info(`PERFORMANCE: ${operation} took ${duration}ms`, {
      operation,
      duration,
      ...details,
      performance: true
    });
  }

  // Security incident logging
  security(incident, severity, details = {}) {
    this.error(`SECURITY: ${incident}`, {
      incident,
      severity,
      ...details,
      security: true
    });
  }
}

module.exports = new Logger();