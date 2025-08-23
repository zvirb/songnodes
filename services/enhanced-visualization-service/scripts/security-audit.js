#!/usr/bin/env node

/**
 * Security Audit Script for Enhanced Visualization Service
 * Validates security configuration and identifies potential vulnerabilities
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SecurityAuditor {
  constructor() {
    this.findings = [];
    this.criticalCount = 0;
    this.highCount = 0;
    this.mediumCount = 0;
    this.lowCount = 0;
  }

  /**
   * Add a security finding
   */
  addFinding(severity, category, description, recommendation) {
    const finding = {
      severity,
      category,
      description,
      recommendation,
      timestamp: new Date().toISOString()
    };

    this.findings.push(finding);

    switch (severity.toLowerCase()) {
      case 'critical':
        this.criticalCount++;
        break;
      case 'high':
        this.highCount++;
        break;
      case 'medium':
        this.mediumCount++;
        break;
      case 'low':
        this.lowCount++;
        break;
    }
  }

  /**
   * Audit environment configuration
   */
  auditEnvironment() {
    console.log('🔍 Auditing environment configuration...');

    // Check for .env file in repository
    if (fs.existsSync('.env')) {
      this.addFinding(
        'CRITICAL',
        'Configuration',
        '.env file found in repository',
        'Remove .env file from repository and add to .gitignore'
      );
    }

    // Check for .env.template
    if (!fs.existsSync('.env.template')) {
      this.addFinding(
        'MEDIUM',
        'Configuration',
        'Missing .env.template file',
        'Create .env.template with example configuration'
      );
    }

    // Check required environment variables
    const requiredVars = [
      'JWT_SECRET',
      'DB_PASSWORD'
    ];

    const productionVars = [
      'REDIS_PASSWORD',
      'DB_SSL'
    ];

    requiredVars.forEach(varName => {
      if (!process.env[varName]) {
        this.addFinding(
          'CRITICAL',
          'Authentication',
          `Required environment variable ${varName} is not set`,
          `Set ${varName} environment variable with a secure value`
        );
      }
    });

    if (process.env.NODE_ENV === 'production') {
      productionVars.forEach(varName => {
        if (!process.env[varName]) {
          this.addFinding(
            'HIGH',
            'Configuration',
            `Production environment variable ${varName} is not set`,
            `Set ${varName} environment variable for production security`
          );
        }
      });
    }
  }

  /**
   * Audit JWT configuration
   */
  auditJWT() {
    console.log('🔐 Auditing JWT configuration...');

    const jwtSecret = process.env.JWT_SECRET;
    
    if (jwtSecret) {
      // Check secret length
      if (jwtSecret.length < 32) {
        this.addFinding(
          'HIGH',
          'Authentication',
          'JWT secret is too short',
          'Use a JWT secret with at least 32 characters'
        );
      }

      // Check for weak patterns
      if (/^(.)\1+$/.test(jwtSecret)) {
        this.addFinding(
          'CRITICAL',
          'Authentication',
          'JWT secret uses repeated characters',
          'Generate a cryptographically secure JWT secret'
        );
      }

      if (/^(secret|password|jwt|key|test|dev)/i.test(jwtSecret)) {
        this.addFinding(
          'CRITICAL',
          'Authentication',
          'JWT secret contains common insecure patterns',
          'Generate a cryptographically secure JWT secret'
        );
      }

      // Check entropy
      const uniqueChars = new Set(jwtSecret).size;
      if (uniqueChars < 16) {
        this.addFinding(
          'HIGH',
          'Authentication',
          'JWT secret has low entropy',
          'Generate a JWT secret with higher entropy (more unique characters)'
        );
      }
    }
  }

  /**
   * Audit source code for security issues
   */
  auditSourceCode() {
    console.log('📝 Auditing source code...');

    const sourceFiles = this.getSourceFiles('src');
    
    sourceFiles.forEach(filePath => {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for hardcoded secrets (excluding environment variable usage)
      const secretPatterns = [
        /password\s*[:=]\s*['"][a-zA-Z0-9]{8,}['"]/i,
        /secret\s*[:=]\s*['"][a-zA-Z0-9]{16,}['"]/i,
        /key\s*[:=]\s*['"][a-zA-Z0-9]{16,}['"]/i,
        /token\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/i
      ];

      secretPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches && !content.includes('process.env') && !matches[0].includes('process.env')) {
          this.addFinding(
            'HIGH',
            'Code Security',
            `Potential hardcoded secret in ${filePath}`,
            'Remove hardcoded secrets and use environment variables'
          );
        }
      });

      // Check for console.log with sensitive data (excluding sanitized logging)
      const sensitiveLogging = /console\.log.*(?:password|secret|token)(?!.*\*\*\*)/i;
      if (sensitiveLogging.test(content) && !content.includes('***configured***')) {
        this.addFinding(
          'MEDIUM',
          'Information Disclosure',
          `Potential sensitive data logging in ${filePath}`,
          'Remove or sanitize sensitive data from console output'
        );
      }

      // Check for SQL injection vulnerabilities
      if (/query.*\+|query.*\$\{/.test(content) && !content.includes('pool.query')) {
        this.addFinding(
          'HIGH',
          'SQL Injection',
          `Potential SQL injection vulnerability in ${filePath}`,
          'Use parameterized queries instead of string concatenation'
        );
      }

      // Check for missing input validation
      if (/req\.(body|query|params)/.test(content) && !content.includes('zod') && !content.includes('validate')) {
        this.addFinding(
          'MEDIUM',
          'Input Validation',
          `Missing input validation in ${filePath}`,
          'Add input validation using Zod schemas'
        );
      }
    });
  }

  /**
   * Audit dependencies for known vulnerabilities
   */
  auditDependencies() {
    console.log('📦 Auditing dependencies...');

    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      // Check for potentially vulnerable packages
      const vulnerablePackages = [
        'lodash', // Often has vulnerabilities
        'moment', // Deprecated, should use date-fns or dayjs
        'request', // Deprecated
        'nodemailer' // Often misconfigured
      ];

      Object.keys(packageJson.dependencies || {}).forEach(dep => {
        if (vulnerablePackages.includes(dep)) {
          this.addFinding(
            'MEDIUM',
            'Dependencies',
            `Potentially vulnerable package: ${dep}`,
            `Review ${dep} for known vulnerabilities and consider alternatives`
          );
        }
      });

      // Check for missing security headers middleware
      const securityDeps = ['helmet', '@fastify/helmet'];
      const hasSecurityMiddleware = securityDeps.some(dep => 
        packageJson.dependencies[dep] || packageJson.devDependencies[dep]
      );

      if (!hasSecurityMiddleware) {
        this.addFinding(
          'HIGH',
          'Security Headers',
          'Missing security headers middleware',
          'Install and configure @fastify/helmet for security headers'
        );
      }

    } catch (error) {
      this.addFinding(
        'LOW',
        'Dependencies',
        'Could not read package.json',
        'Ensure package.json exists and is readable'
      );
    }
  }

  /**
   * Audit Docker configuration
   */
  auditDocker() {
    console.log('🐳 Auditing Docker configuration...');

    if (fs.existsSync('Dockerfile')) {
      const dockerfile = fs.readFileSync('Dockerfile', 'utf8');

      // Check for running as root
      if (!dockerfile.includes('USER ') || dockerfile.includes('USER root')) {
        this.addFinding(
          'HIGH',
          'Container Security',
          'Docker container runs as root user',
          'Create and use a non-root user in Dockerfile'
        );
      }

      // Check for COPY vs ADD
      if (dockerfile.includes('ADD ') && !dockerfile.includes('ADD --chown=')) {
        this.addFinding(
          'MEDIUM',
          'Container Security',
          'Using ADD instead of COPY in Dockerfile',
          'Use COPY instead of ADD unless you need ADD specific features'
        );
      }

      // Check for .dockerignore
      if (!fs.existsSync('.dockerignore')) {
        this.addFinding(
          'MEDIUM',
          'Container Security',
          'Missing .dockerignore file',
          'Create .dockerignore to exclude sensitive files from Docker context'
        );
      }
    }
  }

  /**
   * Get all source files recursively
   */
  getSourceFiles(dir) {
    const files = [];
    
    function traverse(currentPath) {
      const items = fs.readdirSync(currentPath);
      
      items.forEach(item => {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && item !== 'node_modules') {
          traverse(fullPath);
        } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.js'))) {
          files.push(fullPath);
        }
      });
    }
    
    if (fs.existsSync(dir)) {
      traverse(dir);
    }
    
    return files;
  }

  /**
   * Generate audit report
   */
  generateReport() {
    console.log('\n📊 SECURITY AUDIT REPORT');
    console.log('========================\n');

    // Summary
    console.log('📈 SUMMARY:');
    console.log(`  🔴 Critical: ${this.criticalCount}`);
    console.log(`  🟠 High:     ${this.highCount}`);
    console.log(`  🟡 Medium:   ${this.mediumCount}`);
    console.log(`  🟢 Low:      ${this.lowCount}`);
    console.log(`  📋 Total:    ${this.findings.length}\n`);

    // Risk assessment
    let riskLevel = 'LOW';
    if (this.criticalCount > 0) {
      riskLevel = 'CRITICAL';
    } else if (this.highCount > 3) {
      riskLevel = 'HIGH';
    } else if (this.highCount > 0 || this.mediumCount > 5) {
      riskLevel = 'MEDIUM';
    }

    console.log(`🎯 OVERALL RISK LEVEL: ${riskLevel}\n`);

    // Detailed findings
    if (this.findings.length > 0) {
      console.log('🔍 DETAILED FINDINGS:\n');
      
      ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].forEach(severity => {
        const severityFindings = this.findings.filter(f => f.severity === severity);
        
        if (severityFindings.length > 0) {
          console.log(`${this.getSeverityIcon(severity)} ${severity} (${severityFindings.length})`);
          console.log('─'.repeat(50));
          
          severityFindings.forEach((finding, index) => {
            console.log(`${index + 1}. ${finding.description}`);
            console.log(`   Category: ${finding.category}`);
            console.log(`   Recommendation: ${finding.recommendation}\n`);
          });
        }
      });
    } else {
      console.log('✅ No security issues found!\n');
    }

    // Recommendations
    console.log('💡 SECURITY RECOMMENDATIONS:');
    console.log('─'.repeat(50));
    console.log('1. Regularly update dependencies and scan for vulnerabilities');
    console.log('2. Use strong, unique passwords and secrets');
    console.log('3. Enable SSL/TLS for all connections in production');
    console.log('4. Implement proper logging and monitoring');
    console.log('5. Regular security audits and penetration testing');
    console.log('6. Follow principle of least privilege');
    console.log('7. Implement proper error handling (don\'t expose stack traces)');
    console.log('8. Use security headers and CORS properly');
    console.log('9. Validate and sanitize all inputs');
    console.log('10. Keep secrets in secure secret management systems\n');

    return {
      riskLevel,
      totalFindings: this.findings.length,
      criticalCount: this.criticalCount,
      highCount: this.highCount,
      mediumCount: this.mediumCount,
      lowCount: this.lowCount,
      findings: this.findings
    };
  }

  /**
   * Get severity icon
   */
  getSeverityIcon(severity) {
    const icons = {
      'CRITICAL': '🔴',
      'HIGH': '🟠',
      'MEDIUM': '🟡',
      'LOW': '🟢'
    };
    return icons[severity] || '⚪';
  }

  /**
   * Run complete security audit
   */
  async runAudit() {
    console.log('🛡️  ENHANCED VISUALIZATION SERVICE - SECURITY AUDIT');
    console.log('==================================================\n');

    this.auditEnvironment();
    this.auditJWT();
    this.auditSourceCode();
    this.auditDependencies();
    this.auditDocker();

    const report = this.generateReport();

    // Exit with error code if critical issues found
    if (this.criticalCount > 0) {
      console.log('❌ Audit failed due to critical security issues!');
      process.exit(1);
    } else if (this.highCount > 0) {
      console.log('⚠️  Audit completed with high-priority security issues!');
      process.exit(1);
    } else {
      console.log('✅ Security audit completed successfully!');
      process.exit(0);
    }
  }
}

// Run audit if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const auditor = new SecurityAuditor();
  auditor.runAudit();
}

export default SecurityAuditor;