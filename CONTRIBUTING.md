# Contributing to SongNodes

Thank you for your interest in contributing to SongNodes! This document provides guidelines and information for contributors.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Community](#community)

## Code of Conduct

### Our Pledge
We are committed to providing a welcoming and inspiring community for all. Please read and follow our code of conduct:

- **Be Respectful**: Treat all community members with respect and kindness
- **Be Inclusive**: Welcome and support people of all backgrounds and identities
- **Be Collaborative**: Work together constructively and openly
- **Be Professional**: Maintain professional standards in all interactions

### Unacceptable Behavior
- Harassment, discrimination, or offensive comments
- Personal attacks or inflammatory language
- Spamming or inappropriate promotional content
- Sharing private information without consent

## Getting Started

### Prerequisites
Before contributing, ensure you have:
- Read the [Developer Guide](docs/DEVELOPER_GUIDE.md)
- Set up the development environment
- Familiarized yourself with the project architecture

### First-Time Contributors
1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Set up development environment** following the [setup guide](SETUP.md)
4. **Find a good first issue** labeled `good first issue` or `help wanted`
5. **Join our community** discussions

### Types of Contributions
We welcome various types of contributions:
- **Bug fixes** and improvements
- **New features** and enhancements
- **Documentation** improvements
- **Testing** and test coverage
- **Performance** optimizations
- **Security** improvements

## Development Process

### Branching Strategy
```bash
# Main branches
main          # Production-ready code
develop       # Integration branch for features

# Feature branches
feature/issue-number-short-description
bugfix/issue-number-short-description
hotfix/critical-issue-description
docs/documentation-update
```

### Workflow Steps
1. **Create an issue** or find an existing one
2. **Fork and clone** the repository
3. **Create a feature branch** from `develop`
4. **Make your changes** with tests
5. **Test thoroughly** and ensure quality
6. **Submit a pull request** to `develop`
7. **Address review feedback** if needed
8. **Celebrate** when merged! 🎉

### Branch Naming Convention
```bash
# Examples
feature/123-add-playlist-sharing
bugfix/456-fix-auth-token-refresh
hotfix/789-critical-security-patch
docs/update-api-documentation
performance/optimize-database-queries
```

## Coding Standards

### JavaScript/Node.js
```javascript
// Use ESLint and Prettier configuration
// Follow airbnb style guide principles

// Example: Function naming and structure
const getUserPlaylists = async (userId, options = {}) => {
  try {
    const { page = 1, limit = 20 } = options;
    
    // Implementation with clear variable names
    const playlists = await playlistService.getByUserId(userId, {
      page,
      limit,
      includePrivate: false
    });
    
    return {
      data: playlists,
      pagination: calculatePagination(page, limit, playlists.total)
    };
  } catch (error) {
    logger.error('Failed to get user playlists:', error);
    throw new ServiceError('Unable to retrieve playlists', 500);
  }
};
```

### Python
```python
# Follow PEP 8 and use Black formatter
# Use type hints for better code clarity

from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

class PlaylistService:
    def __init__(self, db_connection: DatabaseConnection) -> None:
        self.db = db_connection
    
    async def get_user_playlists(
        self, 
        user_id: str, 
        page: int = 1, 
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        Retrieve user playlists with pagination.
        
        Args:
            user_id: The user's unique identifier
            page: Page number (1-based)
            limit: Number of items per page
            
        Returns:
            Dictionary containing playlists and pagination info
            
        Raises:
            ServiceError: If unable to retrieve playlists
        """
        try:
            offset = (page - 1) * limit
            playlists = await self.db.get_user_playlists(
                user_id=user_id,
                offset=offset,
                limit=limit
            )
            
            return {
                "data": playlists,
                "pagination": self._calculate_pagination(page, limit, playlists.total)
            }
            
        except Exception as error:
            logger.error(f"Failed to get playlists for user {user_id}: {error}")
            raise ServiceError("Unable to retrieve playlists") from error
```

### Database
```sql
-- Use consistent naming conventions
-- Tables: snake_case, plural nouns
-- Columns: snake_case
-- Indexes: table_column_idx

-- Example: Good table structure
CREATE TABLE user_playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    track_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add appropriate indexes
CREATE INDEX user_playlists_user_id_idx ON user_playlists(user_id);
CREATE INDEX user_playlists_public_idx ON user_playlists(is_public) WHERE is_public = true;
```

### API Design
```yaml
# Follow RESTful principles and OpenAPI 3.0 specification
# Use consistent response formats

# Good endpoint design
/api/v1/users/{userId}/playlists          # GET: List user playlists
/api/v1/users/{userId}/playlists          # POST: Create playlist
/api/v1/users/{userId}/playlists/{id}     # GET: Get specific playlist
/api/v1/users/{userId}/playlists/{id}     # PUT: Update playlist
/api/v1/users/{userId}/playlists/{id}     # DELETE: Delete playlist

# Consistent response format
{
  "data": {},           # Main response data
  "pagination": {},     # For paginated responses
  "meta": {},          # Additional metadata
  "errors": []         # Error details if applicable
}
```

### Documentation
```markdown
# Use clear headings and structure
# Include code examples
# Keep documentation up-to-date with code changes

## Function Documentation
- **Purpose**: What the function does
- **Parameters**: Input parameters with types
- **Returns**: Return value description
- **Examples**: Usage examples
- **Errors**: Possible error conditions
```

## Testing Guidelines

### Test Coverage Requirements
- **Minimum coverage**: 80% for new code
- **Critical paths**: 95% coverage required
- **Integration tests**: All API endpoints
- **E2E tests**: Main user workflows

### Testing Types

#### Unit Tests
```javascript
// Example: API Gateway authentication test
describe('Authentication Middleware', () => {
  describe('verifyToken', () => {
    it('should authenticate valid JWT token', async () => {
      const validToken = jwt.sign({ userId: '123' }, process.env.JWT_SECRET);
      const req = mockRequest({ headers: { authorization: `Bearer ${validToken}` } });
      const res = mockResponse();
      const next = jest.fn();

      await authMiddleware.verifyToken(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe('123');
      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid JWT token', async () => {
      const req = mockRequest({ headers: { authorization: 'Bearer invalid_token' } });
      const res = mockResponse();
      const next = jest.fn();

      await authMiddleware.verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid token'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
```

#### Integration Tests
```javascript
// Example: API endpoint integration test
describe('Playlists API', () => {
  beforeEach(async () => {
    await setupTestDatabase();
    await seedTestData();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  describe('GET /api/v1/playlists', () => {
    it('should return user playlists with pagination', async () => {
      const authToken = await createTestUserAndGetToken();
      
      const response = await request(app)
        .get('/api/v1/playlists?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 10);
    });
  });
});
```

#### Performance Tests
```bash
# Load testing with Artillery
npm install -g artillery

# Run performance tests
artillery run tests/performance/api-load-test.yml

# Performance test configuration example
config:
  target: 'http://localhost:8080'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "Get playlists"
    requests:
      - get:
          url: "/api/v1/playlists"
          headers:
            Authorization: "Bearer {{ $randomString() }}"
```

### Test Data Management
```javascript
// Use factories for consistent test data
const PlaylistFactory = {
  create: (overrides = {}) => ({
    name: 'Test Playlist',
    description: 'A test playlist',
    isPublic: false,
    tracks: [],
    ...overrides
  }),

  createMany: (count, overrides = {}) => {
    return Array.from({ length: count }, (_, index) => 
      PlaylistFactory.create({
        name: `Test Playlist ${index + 1}`,
        ...overrides
      })
    );
  }
};
```

## Pull Request Process

### Before Submitting
1. **Ensure tests pass**: Run full test suite
2. **Check code quality**: Lint and format code
3. **Update documentation**: Keep docs current
4. **Verify security**: No sensitive data in commits
5. **Test manually**: Verify functionality works

### PR Checklist
```markdown
- [ ] Tests added/updated and passing
- [ ] Code follows project style guidelines
- [ ] Documentation updated (if applicable)
- [ ] Breaking changes documented
- [ ] Security considerations addressed
- [ ] Performance impact assessed
- [ ] Accessibility considerations (if UI changes)
```

### PR Template
```markdown
## Description
Brief description of changes made.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
Describe the tests that you ran to verify your changes.

## Related Issues
Fixes #(issue number)

## Screenshots (if applicable)
Add screenshots to help explain your changes.
```

### Review Process
1. **Automated checks**: All CI/CD checks must pass
2. **Code review**: At least one maintainer approval required
3. **Testing verification**: Manual testing if needed
4. **Documentation review**: Ensure docs are updated
5. **Final approval**: Maintainer performs final review

## Issue Reporting

### Bug Reports
Use the bug report template:
```markdown
**Bug Description**
A clear and concise description of what the bug is.

**Steps to Reproduce**
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected Behavior**
A clear description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
- OS: [e.g. Ubuntu 20.04]
- Browser [e.g. Chrome, Safari]
- Version [e.g. 22]

**Additional Context**
Add any other context about the problem here.
```

### Feature Requests
Use the feature request template:
```markdown
**Is your feature request related to a problem? Please describe.**
A clear and concise description of what the problem is.

**Describe the solution you'd like**
A clear and concise description of what you want to happen.

**Describe alternatives you've considered**
A clear and concise description of any alternative solutions.

**Additional context**
Add any other context or screenshots about the feature request here.
```

### Security Issues
For security vulnerabilities:
1. **DO NOT** create a public issue
2. **Email security concerns** to security@songnodes.com
3. **Include details** about the vulnerability
4. **Wait for response** before public disclosure

## Community

### Communication Channels
- **GitHub Discussions**: General questions and discussions
- **Issues**: Bug reports and feature requests
- **Discord**: Real-time chat (link in README)
- **Email**: security@songnodes.com for security issues

### Getting Help
1. **Check documentation** first
2. **Search existing issues** for similar problems
3. **Join community discussions** for general questions
4. **Create detailed issues** for bugs or feature requests

### Recognition
Contributors are recognized through:
- **GitHub contributors graph**
- **Release notes acknowledgments**
- **Community highlights**
- **Maintainer nominations** for long-term contributors

## Release Process

### Versioning
We follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Schedule
- **Minor releases**: Monthly (feature releases)
- **Patch releases**: As needed (bug fixes)
- **Major releases**: Quarterly (breaking changes)

Thank you for contributing to SongNodes! Your efforts help make this project better for everyone. 🎵