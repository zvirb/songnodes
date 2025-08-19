const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // HSTS - Force HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy
  res.setHeader('Permissions-Policy', 
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()');

  // Remove server information
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  next();
};

// Request correlation ID
const correlationId = (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
};

// Request sanitization
const sanitizeInput = (req, res, next) => {
  // Remove null bytes and other dangerous characters
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj.replace(/\x00/g, '').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        obj[key] = sanitize(obj[key]);
      }
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  
  if (req.query) {
    req.query = sanitize(req.query);
  }

  next();
};

// Request size limits
const requestSizeLimit = (req, res, next) => {
  const contentLength = parseInt(req.headers['content-length']) || 0;
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (contentLength > maxSize) {
    return res.status(413).json({
      error: 'Payload Too Large',
      message: 'Request entity too large'
    });
  }

  next();
};

// Detect and prevent common attacks
const attackDetection = (req, res, next) => {
  const suspicious = [];
  
  // SQL Injection patterns
  const sqlPatterns = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
    /(\'|\"|;|--|\/\*|\*\/)/g,
    /(\bor\b|\band\b)\s*(\d+\s*=\s*\d+)/gi
  ];

  // XSS patterns
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript\s*:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi
  ];

  // Path traversal patterns
  const pathTraversalPatterns = [
    /\.\.\//g,
    /\.\.\\\/g,
    /%2e%2e%2f/gi,
    /%252e%252e%252f/gi
  ];

  // Check URL, query parameters, and body
  const checkString = JSON.stringify({ url: req.url, query: req.query, body: req.body });

  // Check for SQL injection
  sqlPatterns.forEach((pattern, index) => {
    if (pattern.test(checkString)) {
      suspicious.push(`SQL_INJECTION_${index}`);
    }
  });

  // Check for XSS
  xssPatterns.forEach((pattern, index) => {
    if (pattern.test(checkString)) {
      suspicious.push(`XSS_${index}`);
    }
  });

  // Check for path traversal
  pathTraversalPatterns.forEach((pattern, index) => {
    if (pattern.test(checkString)) {
      suspicious.push(`PATH_TRAVERSAL_${index}`);
    }
  });

  if (suspicious.length > 0) {
    logger.warn(`Suspicious request detected from ${req.ip}: ${suspicious.join(', ')}`, {
      ip: req.ip,
      url: req.url,
      userAgent: req.headers['user-agent'],
      suspicious: suspicious
    });

    return res.status(400).json({
      error: 'Bad Request',
      message: 'Request contains potentially malicious content'
    });
  }

  next();
};

// IP allowlist/blocklist
const ipFilter = (req, res, next) => {
  const clientIp = req.ip;
  
  // Check for explicitly blocked IPs
  const blockedIPs = (process.env.BLOCKED_IPS || '').split(',').filter(ip => ip.trim());
  if (blockedIPs.includes(clientIp)) {
    logger.warn(`Blocked IP attempted access: ${clientIp}`);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied'
    });
  }

  // If allowlist is configured, check if IP is allowed
  const allowedIPs = (process.env.ALLOWED_IPS || '').split(',').filter(ip => ip.trim());
  if (allowedIPs.length > 0 && !allowedIPs.includes(clientIp)) {
    logger.warn(`Non-allowlisted IP attempted access: ${clientIp}`);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied'
    });
  }

  next();
};

// Audit logging for sensitive operations
const auditLog = (req, res, next) => {
  const sensitiveEndpoints = [
    '/auth/login',
    '/auth/register',
    '/auth/logout',
    '/auth/refresh',
    '/admin',
    '/api/v1/admin'
  ];

  const isSensitive = sensitiveEndpoints.some(endpoint => req.path.includes(endpoint));

  if (isSensitive) {
    logger.info('Sensitive endpoint access', {
      ip: req.ip,
      url: req.url,
      method: req.method,
      userAgent: req.headers['user-agent'],
      user: req.user?.email || 'anonymous',
      correlationId: req.correlationId
    });
  }

  next();
};

// Request timeout
const requestTimeout = (req, res, next) => {
  const timeout = parseInt(process.env.REQUEST_TIMEOUT || 30000); // 30 seconds

  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({
        error: 'Request Timeout',
        message: 'Request took too long to process'
      });
    }
  }, timeout);

  res.on('finish', () => {
    clearTimeout(timer);
  });

  next();
};

// Response time tracking
const responseTime = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    res.setHeader('X-Response-Time', `${duration}ms`);
    
    if (duration > 5000) { // Log slow requests (>5 seconds)
      logger.warn(`Slow request detected: ${req.method} ${req.url} took ${duration}ms`, {
        method: req.method,
        url: req.url,
        duration: duration,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
    }
  });

  next();
};

// Content Security Policy for API responses
const apiCSP = (req, res, next) => {
  if (req.path.includes('/api/')) {
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");
  }
  next();
};

// Combine all security middleware
const securityMiddleware = [
  correlationId,
  securityHeaders,
  requestSizeLimit,
  sanitizeInput,
  attackDetection,
  ipFilter,
  auditLog,
  requestTimeout,
  responseTime,
  apiCSP
];

module.exports = securityMiddleware;