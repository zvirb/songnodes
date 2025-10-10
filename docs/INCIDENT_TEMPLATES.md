# Incident Communication Templates

## Overview

This document provides standardized templates for incident communication across all severity levels. Consistent communication during incidents ensures:
- Clear stakeholder awareness
- Proper escalation paths
- Complete incident documentation
- Effective post-mortem analysis

---

## Incident Severity Quick Reference

| Severity | Response Time | Update Frequency | Authorization |
|----------|---------------|------------------|---------------|
| P0 | 15 minutes | Every 15 minutes | On-call (immediate) |
| P1 | 1 hour | Every 30 minutes | Eng Lead |
| P2 | 4 hours | Daily | Team consensus |
| P3 | Next business day | As needed | Standard workflow |

---

## Template: P0 Incident Declaration

**Channel:** `#incidents` (Slack/Discord)
**When:** Immediately upon discovering P0 issue
**Who:** First responder or on-call engineer

```
🚨 P0 INCIDENT DECLARED

Service: [Specific service(s) affected - e.g., "All Services" or "Database"]
Issue: [One-line description - e.g., "Complete system outage - all services unreachable"]
Impact: [Specific user impact - e.g., "All 1,500 active users cannot access system"]
Started: [Timestamp - e.g., "2025-10-10 14:32 UTC"]
Status: Investigating

Incident Lead: @oncall-engineer
War Room: #incident-20251010-1432
Stakeholders: @engineering-manager @cto

Updates every 15 minutes in thread 👇

ACTIONS TAKEN:
- [ ] Maintenance mode enabled
- [ ] Scrapers stopped
- [ ] On-call team paged
- [ ] Logs captured
```

**Example:**
```
🚨 P0 INCIDENT DECLARED

Service: PostgreSQL Database
Issue: Database unresponsive - connection pool exhausted
Impact: All users (1,200 active) unable to load tracks or search
Started: 2025-10-10 14:32 UTC
Status: Investigating

Incident Lead: @jane-oncall
War Room: #incident-20251010-1432
Stakeholders: @eng-manager @devops-lead

Updates every 15 minutes in thread 👇

ACTIONS TAKEN:
- [x] Maintenance mode enabled
- [x] Scrapers stopped to reduce DB load
- [x] DBA paged
- [x] Logs captured to /tmp/incident-20251010-1432/
```

---

## Template: P1 Incident Declaration

**Channel:** `#incidents`
**When:** Within 1 hour of detection
**Who:** Engineer investigating the issue

```
⚠️ P1 INCIDENT DECLARED

Service: [Service name]
Issue: [Description]
Impact: [User/system impact]
Started: [Timestamp]
Status: Investigating

Incident Lead: @engineer
Stakeholders: @team-lead

Updates every 30 minutes in thread 👇

INITIAL FINDINGS:
- [Finding 1]
- [Finding 2]

ACTIONS IN PROGRESS:
- [ ] [Action 1]
- [ ] [Action 2]
```

**Example:**
```
⚠️ P1 INCIDENT DECLARED

Service: Metadata Enrichment Service
Issue: Circuit breakers stuck OPEN - Spotify and MusicBrainz APIs unreachable
Impact: 80% of tracks failing enrichment, DLQ growing at 50 msg/min
Started: 2025-10-10 09:15 UTC
Status: Investigating

Incident Lead: @john-eng
Stakeholders: @api-team-lead

Updates every 30 minutes in thread 👇

INITIAL FINDINGS:
- Spotify API returning 503 errors (possible outage)
- MusicBrainz timing out (>30s response time)
- Circuit breakers auto-reset failing

ACTIONS IN PROGRESS:
- [ ] Checking Spotify status page
- [ ] Temporarily disabling MusicBrainz provider
- [ ] Monitoring circuit breaker auto-recovery
```

---

## Template: Status Update (All Severities)

**Channel:** Thread under incident declaration
**Frequency:** Per severity SLA (P0: 15min, P1: 30min, P2: daily)
**Who:** Incident lead

```
⏱️ UPDATE - T+{X} minutes

Current Status: [Investigating/Mitigating/Monitoring/Resolved]

Actions Taken:
- [Action 1 - Result/Status]
- [Action 2 - Result/Status]
- [Action 3 - Result/Status]

Current State:
- Service A: {✅ Healthy / ⚠️ Degraded / ❌ Down} [Details if degraded/down]
- Service B: {✅ Healthy / ⚠️ Degraded / ❌ Down} [Details]
- Metric X: [Current value vs normal value]

Next Steps:
- [Next step 1] - Owner: @person - ETA: [time]
- [Next step 2] - Owner: @person - ETA: [time]

ETA to Resolution: [Specific time or "Under investigation"]

Questions/Blockers: [Any blockers or questions for stakeholders]
```

**Example (P0):**
```
⏱️ UPDATE - T+15 minutes

Current Status: Mitigating

Actions Taken:
- Identified root cause: Disk space exhausted (98% full) ✅
- Stopped all scrapers to prevent further writes ✅
- Emergency cleanup recovered 15GB space ✅
- Database restarted successfully ✅

Current State:
- Database: ✅ Healthy (connection pool 5/50 used)
- REST API: ✅ Healthy (response time 150ms, normal)
- Scrapers: ⏸️ Paused (will re-enable gradually)
- Disk Space: 78% used (was 98%)

Next Steps:
- Re-enable scraper-mixesdb (low volume) - Owner: @jane - ETA: 5 min
- Monitor disk space growth - Owner: @john - ETA: Ongoing
- Implement log rotation - Owner: @devops - ETA: 2 hours

ETA to Resolution: 30 minutes (full service restoration)

Questions/Blockers: None
```

**Example (P1):**
```
⏱️ UPDATE - T+30 minutes

Current Status: Monitoring recovery

Actions Taken:
- Confirmed Spotify API outage (https://status.spotify.com) ✅
- Disabled Spotify provider in waterfall config ✅
- Configuration reloaded successfully ✅
- Circuit breakers for MusicBrainz auto-recovered ✅

Current State:
- Enrichment Service: ⚠️ Degraded (60% success rate, normal 85%)
- Circuit Breakers: MusicBrainz ✅ CLOSED, LastFM ✅ CLOSED, Spotify ❌ DISABLED
- DLQ: 1,250 messages (was 3,500, decreasing)
- Cache Hit Rate: 72% (normal)

Next Steps:
- Continue monitoring success rate - Owner: @john - ETA: 30 min
- Replay DLQ once success rate > 70% - Owner: @john - ETA: 1 hour
- Re-enable Spotify when API recovers - Owner: @jane - ETA: TBD (waiting on Spotify)

ETA to Resolution: 1 hour (service degraded but functional)

Questions/Blockers: Waiting on Spotify API recovery (no ETA from their status page)
```

---

## Template: Resolution Announcement

**Channel:** Thread under incident declaration + summary in main channel
**When:** After verification of full resolution
**Who:** Incident lead

```
✅ RESOLVED - Total Duration: {X} minutes/hours

Root Cause: [Detailed explanation of what caused the incident]

Fix Applied: [Specific fix that resolved the issue]

Verification:
- [Verification check 1] ✅
- [Verification check 2] ✅
- [Verification check 3] ✅

Impact Summary:
- Duration: [Total time]
- Affected Users: [Number/percentage of users]
- Data Loss: {None / Minimal / Significant - details}
- Services Impacted: [List]

Timeline:
- T+0: [Incident detected]
- T+X: [Key event 1]
- T+Y: [Key event 2]
- T+Z: [Resolution]

Post-Mortem:
- Scheduled: [Date/Time]
- Document: [Link when available - create in Google Docs/Notion]
- Attendees: @team-lead @stakeholders

Action Items (Immediate):
- [ ] [Immediate action 1] - Owner: @person - Due: [date]
- [ ] [Immediate action 2] - Owner: @person - Due: [date]

Thank you to: @person1 @person2 @person3 for rapid response
```

**Example (P0):**
```
✅ RESOLVED - Total Duration: 47 minutes

Root Cause: Log files filled disk to 98% capacity, causing PostgreSQL to refuse new connections and crash. Logs were not being rotated due to misconfigured logrotate for Docker containers.

Fix Applied:
1. Emergency log cleanup (truncated logs to last 100MB per service)
2. Removed old backups older than 7 days
3. Implemented Docker log rotation (max-size: 10m, max-file: 3)
4. Database restarted and verified healthy

Verification:
- All services report healthy status ✅
- Database connection pool normal (5/50 connections) ✅
- Disk space at 78% (safe threshold) ✅
- No data corruption detected (integrity check passed) ✅
- Error rates < 1% (normal) ✅
- 30 minutes of stable operation ✅

Impact Summary:
- Duration: 47 minutes (14:32 - 15:19 UTC)
- Affected Users: 1,200 active users (100% - complete outage)
- Data Loss: None (database intact, no scrapers running during outage)
- Services Impacted: All (database dependency)

Timeline:
- T+0 (14:32): Database unresponsive, alerts fired
- T+5 (14:37): Incident declared, root cause identified (disk space)
- T+15 (14:47): Emergency cleanup completed, 15GB recovered
- T+20 (14:52): Database restarted successfully
- T+25 (14:57): REST API verified healthy
- T+35 (15:07): Scrapers re-enabled gradually
- T+47 (15:19): All systems stable for 15 minutes, incident resolved

Post-Mortem:
- Scheduled: 2025-10-11 10:00 AM UTC
- Document: https://docs.company.com/incidents/20251010-disk-space
- Attendees: @eng-team @devops-lead @cto

Action Items (Immediate):
- [x] Implement Docker log rotation (COMPLETED)
- [ ] Add disk space alerting at 80% threshold - Owner: @devops - Due: 2025-10-12
- [ ] Automate old backup cleanup (>7 days) - Owner: @backend - Due: 2025-10-13
- [ ] Review all log configurations - Owner: @sre - Due: 2025-10-15

Thank you to: @jane-oncall @john-dba @sarah-devops for rapid response and mitigation
```

**Example (P1):**
```
✅ RESOLVED - Total Duration: 2 hours 15 minutes

Root Cause: Spotify API experienced intermittent outages (confirmed on their status page). Circuit breakers opened correctly but auto-recovery failed due to a bug in the reset logic.

Fix Applied:
1. Temporarily disabled Spotify provider in waterfall configuration
2. Applied hotfix to circuit breaker auto-recovery logic
3. Re-enabled Spotify provider after API recovered
4. Replayed 3,500 messages from DLQ

Verification:
- All circuit breakers CLOSED ✅
- Enrichment success rate 84% (normal range) ✅
- DLQ empty (all messages replayed successfully) ✅
- No errors in last 30 minutes ✅

Impact Summary:
- Duration: 2 hours 15 minutes (09:15 - 11:30 UTC)
- Affected Users: None (background process)
- Data Loss: None (all tracks replayed from DLQ)
- Services Impacted: Metadata Enrichment (degraded to 60% success rate)

Timeline:
- T+0 (09:15): Circuit breakers opened due to Spotify API errors
- T+30 (09:45): Identified circuit breaker auto-recovery bug
- T+45 (10:00): Disabled Spotify provider, success rate improved to 60%
- T+90 (10:45): Spotify API recovered (per status page)
- T+105 (11:00): Applied hotfix, re-enabled Spotify
- T+120 (11:15): DLQ replay completed
- T+135 (11:30): System stable, incident resolved

Post-Mortem:
- Scheduled: 2025-10-12 2:00 PM UTC
- Document: https://docs.company.com/incidents/20251010-circuit-breaker
- Attendees: @api-team @backend-team

Action Items (Immediate):
- [x] Fix circuit breaker auto-recovery bug (COMPLETED)
- [ ] Add circuit breaker state to health endpoint - Owner: @backend - Due: 2025-10-11
- [ ] Improve circuit breaker monitoring/alerting - Owner: @sre - Due: 2025-10-13

Thank you to: @john-eng @api-team for quick diagnosis and fix
```

---

## Template: Post-Mortem Document

**Format:** Google Docs, Confluence, or Markdown
**When:** Within 48 hours of resolution
**Who:** Incident lead (primary author), all responders (contributors)

```markdown
# Post-Mortem: [Incident Title]

**Date:** [Date of incident]
**Duration:** [Total duration]
**Severity:** P{0/1/2/3}
**Incident Lead:** [Name]
**Responders:** [Names]
**Stakeholders:** [Names]

---

## Executive Summary

[2-3 sentence summary of what happened, impact, and resolution]

---

## Impact

### User Impact
- **Users Affected:** [Number/percentage]
- **Duration:** [Time users were impacted]
- **Functionality Lost:** [What users couldn't do]

### System Impact
- **Services Affected:** [List of services]
- **Data Loss:** [None/details]
- **Performance Degradation:** [Metrics]

### Business Impact
- **Revenue Impact:** [If applicable]
- **Reputation Impact:** [If applicable]
- **SLA Breach:** [Yes/No, details]

---

## Timeline

All times in UTC.

| Time | Event | Actor |
|------|-------|-------|
| T+0 (HH:MM) | [First sign of issue - e.g., "Alert fired: DatabaseDown"] | System |
| T+2 | [Detection - e.g., "Engineer noticed alert"] | @person |
| T+5 | [Incident declared] | @person |
| T+10 | [Root cause identified] | @person |
| T+15 | [Mitigation started] | @person |
| T+30 | [Partial recovery] | System |
| T+45 | [Full resolution] | System |
| T+60 | [Verification complete] | @person |

---

## Root Cause Analysis

### What Happened
[Detailed explanation of the technical root cause]

### Why It Happened
[Underlying causes - process failures, gaps in testing, configuration issues, etc.]

### Contributing Factors
- [Factor 1 - e.g., "No disk space monitoring"]
- [Factor 2 - e.g., "Log rotation not configured"]
- [Factor 3 - e.g., "No runbook for disk space emergencies"]

---

## Detection

### How We Found Out
[How the incident was detected - alert, user report, manual check, etc.]

### Detection Delay
[Time between first symptom and detection]

### What Worked
- [What went well in detection]

### What Didn't Work
- [Gaps in monitoring/alerting]

---

## Response

### What Went Well
- [Thing 1 - e.g., "Rapid identification of root cause"]
- [Thing 2 - e.g., "Effective communication in incident channel"]
- [Thing 3 - e.g., "Clear roles and ownership"]

### What Didn't Go Well
- [Thing 1 - e.g., "No runbook for this scenario"]
- [Thing 2 - e.g., "Unclear escalation path"]
- [Thing 3 - e.g., "Database restore procedure untested"]

### Luck
[Things that could have gone worse but didn't - to highlight risks]

---

## Action Items

### Immediate (Within 1 Week)

| Action | Owner | Due Date | Status | Priority |
|--------|-------|----------|--------|----------|
| [Action 1 - e.g., "Add disk space alerting"] | @person | YYYY-MM-DD | In Progress | P0 |
| [Action 2] | @person | YYYY-MM-DD | Not Started | P1 |

### Short-term (Within 1 Month)

| Action | Owner | Due Date | Status | Priority |
|--------|-------|----------|--------|----------|
| [Action 1] | @person | YYYY-MM-DD | Not Started | P1 |

### Long-term (Within 1 Quarter)

| Action | Owner | Due Date | Status | Priority |
|--------|-------|----------|--------|----------|
| [Action 1] | @person | YYYY-MM-DD | Not Started | P2 |

---

## Lessons Learned

### Technical
- [Lesson 1 - e.g., "Docker logs require explicit rotation configuration"]
- [Lesson 2 - e.g., "Connection pool exhaustion can crash database"]

### Process
- [Lesson 1 - e.g., "Need regular incident response drills"]
- [Lesson 2 - e.g., "Runbooks must be tested in staging"]

### Communication
- [Lesson 1 - e.g., "Status updates every 15 min kept stakeholders informed"]

---

## Appendix

### Related Incidents
- [Link to similar past incidents]

### References
- [Links to logs, metrics, documentation]

### Supporting Data
- [Graphs, charts, log snippets]
```

---

## Template: Stakeholder Communication (External)

**Channel:** Email, Status Page, or Customer Portal
**When:** For customer-facing incidents (P0/P1 with external impact)
**Who:** Customer support lead or engineering manager

**Subject:** `[Resolved] Service Disruption - [Date]`

```
Dear SongNodes Users,

We experienced a service disruption on [Date] from [Start Time] to [End Time] UTC ([Duration]).

WHAT HAPPENED:
[Non-technical explanation of the issue]

IMPACT:
[What functionality was affected]

RESOLUTION:
[What we did to fix it]

CURRENT STATUS:
All systems are now operating normally. We are continuing to monitor closely.

NEXT STEPS:
[What we're doing to prevent recurrence - high level]

We sincerely apologize for the inconvenience this caused.

If you have any questions, please contact support@songnodes.com.

Thank you for your patience,
The SongNodes Team

---
Technical Details (for interested users):
[Link to public post-mortem if appropriate]
```

---

## Template: Incident Summary (Weekly Report)

**Channel:** Email or internal wiki
**Frequency:** Weekly
**Who:** Engineering manager or on-call lead

```markdown
# Incident Summary - Week of [Date]

## Overview
- **Total Incidents:** [Number]
- **P0:** [Number]
- **P1:** [Number]
- **P2:** [Number]
- **P3:** [Number]
- **Total Downtime:** [Minutes/hours]

## Incidents This Week

### P0: [Brief Title]
- **Duration:** [Time]
- **Root Cause:** [One sentence]
- **Status:** Resolved
- **Post-Mortem:** [Link]

### P1: [Brief Title]
- **Duration:** [Time]
- **Root Cause:** [One sentence]
- **Status:** Resolved
- **Post-Mortem:** [Link]

## Trends
- [Trend 1 - e.g., "Disk space issues increasing"]
- [Trend 2 - e.g., "Circuit breaker false positives"]

## Action Items in Progress
- [Action 1] - Owner - Due [Date]
- [Action 2] - Owner - Due [Date]

## Recommendations
- [Recommendation 1]
- [Recommendation 2]
```

---

## Related Documentation

- [Emergency Response Playbook](EMERGENCY_RESPONSE.md)
- [Rollback Procedures](ROLLBACK_PROCEDURES.md)
- [Operations Runbooks](RUNBOOKS.md)
- [Disaster Recovery Plan](DISASTER_RECOVERY.md)
