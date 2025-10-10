# URGENT Security Fixes - Action Required

**Date**: 2025-10-10
**Priority**: HIGH
**Estimated Time**: 2-4 hours

---

## Summary

**1 CRITICAL vulnerability** requires immediate attention:
- **CVE-2025-50181** (urllib3): Redirect bypass vulnerability in PoolManager

**Impact**: If code uses `PoolManager(retries=False)` to prevent redirects, it WON'T WORK. Redirects will still occur, potentially allowing SSRF attacks.

---

## Immediate Actions Required

### Step 1: Code Audit (COMPLETED ✅)

**Result**: NO vulnerable patterns found in codebase.

**Analysis**:
- Codebase uses `requests.Session` with `urllib3.util.retry.Retry` configured at HTTPAdapter level
- Found in: `/mnt/my_external_drive/programming/songnodes/common/api_gateway/base_client.py`
- Pattern: `HTTPAdapter(max_retries=retry_strategy)` - **SAFE** (retries at adapter, not PoolManager)
- No direct `PoolManager` usage found
- No `redirect=False` at PoolManager level

**Vulnerable vs Safe Patterns**:
```python
# VULNERABLE (not found in codebase)
http = urllib3.PoolManager(retries=False)  # ❌ CVE-2025-50181

# SAFE (what we use)
session = requests.Session()
retry = Retry(total=3, backoff_factor=1)
adapter = HTTPAdapter(max_retries=retry)  # ✅ Safe - retries at adapter level
session.mount("https://", adapter)
```

**Conclusion**: CVE-2025-50181 NOT exploitable in current codebase, but upgrade still recommended for defense-in-depth.

### Step 2: Upgrade urllib3 (15 minutes)

**Affected Service**: api-gateway-internal

```bash
cd /mnt/my_external_drive/programming/songnodes/services/api-gateway-internal

# Update requirements.txt
sed -i 's/urllib3==2.1.0/urllib3==2.5.0/' requirements.txt

# Rebuild container
docker compose build api-gateway-internal

# Verify upgrade
docker compose run --rm api-gateway-internal pip show urllib3
# Expected: Version: 2.5.0
```

### Step 3: Test (60-90 minutes)

```bash
# Start updated service
docker compose up -d api-gateway-internal

# Check health
curl http://localhost:8084/health
# Expected: {"status": "healthy"}

# Monitor logs for errors
docker compose logs -f api-gateway-internal --tail=100

# Run integration tests
cd /mnt/my_external_drive/programming/songnodes
pytest tests/integration/test_api_gateway.py -v

# Check OpenTelemetry compatibility (urllib3 is used by grpc)
curl http://localhost:8084/metrics | grep -i error
# Expected: No urllib3 or grpc errors
```

### Step 4: Validate Fix (15 minutes)

```bash
# Re-scan for vulnerabilities
/tmp/security-scan-venv/bin/pip-audit -r services/api-gateway-internal/requirements.txt

# Expected output:
# Found 13 known vulnerabilities (down from 15)
# CVE-2025-50181 SHOULD NOT be listed

# Verify no new vulnerabilities introduced
diff <(cat /tmp/api-gateway-audit.json | jq '.dependencies[].vulns[].id' | sort) \
     <(pip-audit -r services/api-gateway-internal/requirements.txt --format json | jq '.dependencies[].vulns[].id' | sort)
```

---

## Rollback Plan

If issues arise:

```bash
# Revert requirements.txt
cd /mnt/my_external_drive/programming/songnodes/services/api-gateway-internal
git checkout requirements.txt

# Rebuild with old version
docker compose build --no-cache api-gateway-internal
docker compose up -d api-gateway-internal

# Verify rollback
docker compose exec api-gateway-internal pip show urllib3
# Expected: Version: 2.1.0
```

---

## Success Criteria

✅ Code audit complete - no vulnerable PoolManager patterns found
✅ urllib3 upgraded to 2.5.0
✅ Service health check passing
✅ No errors in logs for 30 minutes
✅ Integration tests passing
✅ CVE-2025-50181 not present in re-scan

---

## Next Steps

After urgent fix deployed:

1. **Document findings** in postmortem
2. **Implement prevention**: Add linter rule to catch vulnerable patterns
3. **Schedule full upgrade**: All services per SECURITY_ASSESSMENT_REPORT.md
4. **Enable Dependabot**: Automated vulnerability alerts

---

## Contact

**Issues**: Report to security@songnodes.local
**Escalation**: Page on-call if service degradation > 5 minutes
