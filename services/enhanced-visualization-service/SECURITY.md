# 🛡️ Enhanced Visualization Service - Security Documentation

## 🚨 Critical Security Features Implemented

This service has been hardened with critical security fixes to address production-ready security requirements:

### ✅ Implemented Security Features

1. **JWT Authentication for WebSocket Connections**
   - All WebSocket connections require valid JWT tokens
   - Role-based access control (RBAC) for different user types
   - Session management with automatic cleanup
   - Rate limiting and message size validation

2. **Environment-Based Secret Management**
   - No default passwords in code
   - All credentials loaded from environment variables
   - Secret validation and strength checking
   - Cryptographically secure secret generation

3. **Input Validation with Zod Schemas**
   - All database queries use parameterized statements
   - Comprehensive input validation for API endpoints
   - SQL injection prevention
   - XSS and injection attack prevention

4. **Proper SSL Certificate Validation**
   - SSL certificate verification enabled by default
   - Support for custom CA certificates
   - Client certificate authentication
   - TLS configuration for Redis connections

5. **Comprehensive Security Monitoring**
   - Security audit script for configuration validation
   - Automated vulnerability scanning
   - Security headers via Helmet middleware
   - CORS protection with configurable origins

---

## 🔧 Security Setup Instructions

### 1. Environment Configuration

Copy the environment template and configure secrets:

```bash
cp .env.template .env
```

**CRITICAL**: Edit `.env` with secure values:

```bash
# Generate secure JWT secret (64 characters)
openssl rand -base64 64

# Generate encryption key (32 characters)  
openssl rand -base64 32

# Generate secure passwords
openssl rand -base64 16
```

### 2. Required Environment Variables

**Critical security variables that MUST be set:**

```env
# JWT Authentication - REQUIRED
JWT_SECRET=your_64_character_cryptographically_secure_secret_here

# Database Credentials - REQUIRED  
DB_PASSWORD=your_secure_database_password_here

# Production Requirements
REDIS_PASSWORD=your_secure_redis_password_here  # Required in production
DB_SSL=true                                     # Required in production
```

### 3. Security Validation

Run the security audit to validate configuration:

```bash
npm run security:audit
```

The audit will fail if critical security issues are found.

### 4. Production Security Checklist

- [ ] All secrets generated with cryptographically secure methods
- [ ] JWT_SECRET is at least 32 characters with high entropy
- [ ] Database SSL enabled (`DB_SSL=true`)
- [ ] Redis password set in production
- [ ] CORS origins limited to trusted domains only
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] No .env files committed to version control
- [ ] Security audit passes without critical/high issues

---

## 🔐 Authentication & Authorization

### JWT Token Structure

```json
{
  "userId": "user123",
  "username": "john_doe", 
  "roles": ["user", "premium"],
  "sessionId": "session_uuid",
  "iat": 1640995200,
  "exp": 1641081600
}
```

### User Roles and Permissions

| Role | WebSocket Access | Visualization Access | Modification Rights |
|------|------------------|---------------------|-------------------|
| `viewer` | ✅ | ✅ (read-only) | ❌ |
| `user` | ✅ | ✅ | ✅ |
| `premium` | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | ✅ |

### WebSocket Authentication

WebSocket connections require JWT authentication via:

1. **Authorization Header** (preferred):
   ```
   Authorization: Bearer <jwt_token>
   ```

2. **Query Parameter** (fallback):
   ```
   ws://localhost:8085/ws?token=<jwt_token>
   ```

---

## 🚨 Security Incidents & Response

### Monitoring & Alerts

The service logs security events including:
- Authentication failures
- Authorization violations  
- Rate limit exceeded
- Suspicious message patterns
- SSL/TLS connection issues

### Incident Response

If security issues are detected:

1. **Immediate**: Review logs for suspicious activity
2. **Rotate secrets**: Generate new JWT secrets if compromise suspected
3. **Update dependencies**: Check for known vulnerabilities
4. **Audit configuration**: Run security audit script
5. **Monitor**: Increase logging verbosity temporarily

---

## 🔧 Security Configuration Details

### SSL/TLS Configuration

```env
# Database SSL
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
DB_SSL_CA=/path/to/ca-certificate.crt
DB_SSL_CERT=/path/to/client-certificate.crt  
DB_SSL_KEY=/path/to/client-private-key.key

# Redis TLS
REDIS_TLS=true
REDIS_TLS_REJECT_UNAUTHORIZED=true
```

### Rate Limiting

```env
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX=100           # 100 requests per window
```

### CORS Configuration

```env
CORS_ORIGINS=https://app.songnodes.com,https://admin.songnodes.com
```

### WebSocket Security

```env
WS_MAX_CONNECTIONS=10000     # Maximum concurrent connections
WS_MAX_MESSAGE_SIZE=1048576  # 1MB message size limit
WS_AUTH_REQUIRED=true        # Require authentication
```

---

## 🧪 Security Testing

### Manual Testing

1. **Authentication Test**:
   ```bash
   # Should fail without token
   wscat -c ws://localhost:8085
   
   # Should succeed with valid token
   wscat -c ws://localhost:8085 -H "Authorization: Bearer <token>"
   ```

2. **Input Validation Test**:
   ```bash
   # Test SQL injection prevention
   curl -X POST http://localhost:8085/api/visualization \
     -H "Content-Type: application/json" \
     -d '{"filters": {"artist": "test\"; DROP TABLE nodes; --"}}'
   ```

3. **Rate Limiting Test**:
   ```bash
   # Test rate limiting
   for i in {1..200}; do
     curl http://localhost:8085/health &
   done
   ```

### Automated Security Testing

```bash
# Run all security checks
npm run security:check

# Dependencies vulnerability scan
npm audit

# Custom security audit
npm run security:audit
```

---

## 📋 Security Maintenance

### Regular Tasks

- **Weekly**: Run `npm audit` and update vulnerable dependencies
- **Monthly**: Rotate JWT secrets and database passwords
- **Quarterly**: Full security audit and penetration testing
- **As needed**: Update SSL certificates before expiration

### Dependency Updates

```bash
# Check for vulnerable dependencies
npm audit

# Fix automatically fixable vulnerabilities  
npm audit fix

# Manual review required for breaking changes
npm audit fix --force
```

---

## 🆘 Emergency Procedures

### Suspected Security Breach

1. **Immediate Actions**:
   ```bash
   # Rotate all secrets immediately
   openssl rand -base64 64 > new_jwt_secret.txt
   
   # Block suspicious IPs at firewall level
   # Increase logging verbosity
   export LOG_LEVEL=debug
   
   # Disconnect all active sessions
   # (Manual database cleanup if needed)
   ```

2. **Investigation**:
   - Review authentication logs
   - Check for unusual database queries
   - Analyze WebSocket connection patterns
   - Verify SSL certificate integrity

3. **Recovery**:
   - Update all secrets across environments
   - Force re-authentication for all users
   - Deploy with new security configuration
   - Monitor for 24-48 hours

### Contact Information

- **Security Team**: security@songnodes.com
- **Emergency**: security-emergency@songnodes.com
- **Bug Bounty**: security-bug-bounty@songnodes.com

---

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [JWT Security Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
- [WebSocket Security Guide](https://devcenter.heroku.com/articles/websocket-security)

---

**⚠️ SECURITY NOTICE**: This documentation contains security-sensitive information. Limit access to authorized personnel only.