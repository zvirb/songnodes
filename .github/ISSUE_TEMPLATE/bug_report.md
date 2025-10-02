---
name: Bug Report
about: Report a bug or unexpected behavior
title: '[BUG] '
labels: bug
assignees: ''
---

## Bug Description

<!-- A clear and concise description of what the bug is -->

**Expected Behavior:**
<!-- What you expected to happen -->

**Actual Behavior:**
<!-- What actually happened -->

---

## Reproduction Steps

<!-- Steps to reproduce the behavior -->

1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

**Reproducibility:**
- [ ] Always reproducible
- [ ] Intermittent (happens sometimes)
- [ ] One-time occurrence

---

## Environment

**Service/Component:**
- [ ] Frontend (React/TypeScript)
- [ ] REST API (FastAPI)
- [ ] Graph API
- [ ] WebSocket API
- [ ] NLP Processor
- [ ] Scraper Orchestrator
- [ ] Database (PostgreSQL)
- [ ] Redis
- [ ] RabbitMQ
- [ ] Other: _______

**Environment:**
- [ ] Local Development (Docker Compose)
- [ ] Staging
- [ ] Production

**Browser (if frontend):**
- Browser: [e.g., Chrome, Firefox, Safari]
- Version: [e.g., 118]
- OS: [e.g., macOS, Windows, Linux]

**Docker/System Info (if backend):**
```bash
# Paste output of:
docker compose version
docker --version
python --version  # if relevant
node --version    # if relevant
```

---

## Logs & Error Messages

### Console Output
```
<!-- Paste browser console errors or terminal output here -->
```

### Backend Logs
```bash
# Paste output of: docker compose logs [service-name]
```

### Stack Trace
```
<!-- If available, paste the full stack trace -->
```

---

## Screenshots/Videos

<!-- If applicable, add screenshots or screen recordings to help explain the problem -->

---

## Database State (if relevant)

<!-- If the bug is data-related, provide relevant database queries/state -->

```sql
-- Example query that shows the problematic state
SELECT * FROM tracks WHERE ...;
```

**Affected Data:**
- Number of records affected: _______
- Data corruption: Yes / No
- Data loss: Yes / No

---

## Network Requests (if relevant)

<!-- For API/network issues, provide request/response details -->

**Request:**
```bash
curl -X POST http://localhost:8082/api/v1/tracks \
  -H "Content-Type: application/json" \
  -d '{"title": "...", ...}'
```

**Response:**
```json
{
  "error": "...",
  "status": 500
}
```

---

## Impact Assessment

**Severity:**
- [ ] Critical (system down, data loss, security vulnerability)
- [ ] High (major feature broken, affects many users)
- [ ] Medium (feature partially broken, workaround exists)
- [ ] Low (minor issue, cosmetic)

**User Impact:**
- [ ] All users affected
- [ ] Specific user group: _______
- [ ] Single user
- [ ] No user impact (development only)

**Business Impact:**
- [ ] Revenue impact
- [ ] Data integrity issue
- [ ] Performance degradation
- [ ] User experience issue
- [ ] No business impact

---

## Possible Cause

<!-- If you have investigated, share your findings -->

**Suspected Component:**
<!-- What part of the system do you think is causing this? -->

**Related Changes:**
<!-- Any recent commits/PRs that might be related? -->
- Commit: <!-- paste commit SHA or PR link -->

**Additional Context:**
<!-- Any other context about the problem -->

---

## Workaround

<!-- If you've found a temporary workaround, describe it here -->

- [ ] No workaround available
- [ ] Workaround available:

<!-- Describe the workaround -->

---

## Acceptance Criteria

<!-- What needs to happen for this bug to be considered fixed? -->

- [ ] Bug no longer reproducible
- [ ] All existing tests pass
- [ ] New regression test added
- [ ] No new console errors
- [ ] Performance not degraded
- [ ] Documentation updated (if behavior changed)

---

## Related Issues

<!-- Link to related issues or PRs -->

- Related to: #
- Duplicate of: #
- Blocks: #
- Blocked by: #
