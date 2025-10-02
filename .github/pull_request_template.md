## Summary

<!-- Provide a brief description of the changes in this PR -->

**Related Issue(s):** <!-- Link to related issues (e.g., Closes #123) -->

### What changed?
<!-- Describe WHAT was changed -->

### Why did it change?
<!-- Describe WHY it was changed - the business/technical rationale -->

### How was it changed?
<!-- Describe HOW it was implemented - key technical decisions -->

---

## Type of Change

<!-- Check all that apply -->

- [ ] 🎉 `feat`: New feature (non-breaking change which adds functionality)
- [ ] 🐛 `fix`: Bug fix (non-breaking change which fixes an issue)
- [ ] 📝 `docs`: Documentation update
- [ ] 🎨 `style`: Code style change (formatting, no functional changes)
- [ ] ♻️ `refactor`: Code refactoring (no functional changes)
- [ ] ⚡ `perf`: Performance improvement
- [ ] ✅ `test`: Adding or updating tests
- [ ] 🔧 `chore`: Build process or tooling changes
- [ ] 🔒 `security`: Security fix or improvement
- [ ] 💥 **BREAKING CHANGE**: Breaking API/behavior change (requires major version bump)

---

## Testing Checklist

<!-- All items must be checked before merging -->

### Backend Testing
- [ ] Unit tests added/updated (`pytest tests/unit/`)
- [ ] Integration tests pass (`pytest tests/integration/`)
- [ ] All backend tests pass (`docker compose exec [service] pytest`)

### Frontend Testing
- [ ] Unit/component tests added/updated (`npm test`)
- [ ] E2E tests pass **with zero console errors** (`npm run test:e2e`) - **MANDATORY**
- [ ] Graph tests pass (if PIXI.js changes: `npm run test:graph`)
- [ ] Performance tests pass (if optimization: `npm run test:performance`)

### Manual Testing
- [ ] Tested locally with `docker compose up -d`
- [ ] Verified all affected services restart successfully
- [ ] Tested edge cases and error scenarios
- [ ] Verified no memory leaks (checked Docker stats, Prometheus metrics)

---

## Code Quality Checklist

<!-- All items must be checked before merging -->

### Code Standards
- [ ] Code follows project style guide (Black for Python, ESLint/Prettier for TypeScript)
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) format
- [ ] All commits include proper scope (e.g., `feat(api):`, `fix(frontend):`)
- [ ] No hardcoded credentials or secrets
- [ ] Uses `common.secrets_manager` for all credential access

### Documentation
- [ ] Code includes clear comments for complex logic
- [ ] API changes documented (OpenAPI/Swagger updated)
- [ ] README updated (if public API changed)
- [ ] CLAUDE.md updated (if workflow/architecture changed)

### Resource Management
- [ ] Database connections use connection pooling with limits
- [ ] Redis connections use connection pooling
- [ ] WebSocket connections have cleanup logic
- [ ] PIXI.js components have proper cleanup in `useEffect` return
- [ ] Memory leak prevention verified (no unbounded collections)

### Security
- [ ] Input validation implemented (Pydantic models for backend)
- [ ] XSS prevention (sanitized user input in frontend)
- [ ] SQL injection prevention (parameterized queries only)
- [ ] CORS configured properly
- [ ] Rate limiting applied (for public endpoints)

---

## Database Changes

<!-- Check if applicable -->

- [ ] N/A - No database changes
- [ ] Migration script included (`sql/migrations/XXX_*.sql`)
- [ ] Rollback script included (`sql/migrations/XXX_*_down.sql`)
- [ ] Migration tested on development database
- [ ] Indexes added for performance (if new queries)
- [ ] Foreign key constraints verified
- [ ] Data validation rules documented

---

## API Changes

<!-- Check if applicable -->

- [ ] N/A - No API changes
- [ ] OpenAPI/Swagger spec updated
- [ ] Breaking changes documented in commit message (`BREAKING CHANGE:` footer)
- [ ] API versioning strategy followed (v1, v2, etc.)
- [ ] Backward compatibility maintained (or migration plan documented)
- [ ] Rate limiting configured (if new public endpoint)

---

## Screenshots/Videos

<!-- If UI changes, provide before/after screenshots or demo video -->

### Before
<!-- Screenshot or description of old behavior -->

### After
<!-- Screenshot or description of new behavior -->

---

## Deployment Notes

<!-- Information for deployment -->

### Environment Variables
<!-- List any new environment variables needed -->
- [ ] N/A - No new environment variables
- [ ] `.env.example` updated with new variables
- [ ] Production secrets documented in secure location

### Infrastructure Changes
<!-- List any infrastructure changes -->
- [ ] N/A - No infrastructure changes
- [ ] Docker Compose updated
- [ ] Kubernetes manifests updated
- [ ] Resource limits adjusted
- [ ] New service added (requires deployment coordination)

### Data Migration
<!-- List any data migration steps -->
- [ ] N/A - No data migration needed
- [ ] Migration plan documented
- [ ] Rollback plan documented
- [ ] Estimated downtime: _____ minutes

---

## Reviewer Guidance

<!-- Help reviewers focus their attention -->

### Key Files to Review
<!-- List the most important files for review -->
1.
2.
3.

### Areas of Concern
<!-- Highlight any areas where you'd like specific feedback -->

### Testing Instructions
<!-- Step-by-step instructions for reviewers to test the changes -->
1.
2.
3.

---

## Pre-Merge Checklist

<!-- Final checks before merging - ALL must be checked -->

- [ ] All CI/CD checks passed (tests, linting, security scans)
- [ ] At least 1 approval from code reviewer
- [ ] No merge conflicts with target branch
- [ ] Branch is up-to-date with target branch
- [ ] E2E tests passed with zero console errors (**MANDATORY** for frontend changes)
- [ ] Docker images build successfully
- [ ] Documentation updated
- [ ] Breaking changes communicated to team (if applicable)

---

## Post-Merge Actions

<!-- Actions to take after merging -->

- [ ] Monitor production metrics for 24 hours (if deployed to prod)
- [ ] Update project board/tickets
- [ ] Notify stakeholders (if user-facing change)
- [ ] Close related issues

---

**Note:** This PR will be merged using **Squash and Merge** to maintain a clean commit history on the target branch. Ensure your PR title follows Conventional Commits format (it will become the squashed commit message).
