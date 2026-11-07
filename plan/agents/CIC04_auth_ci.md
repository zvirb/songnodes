# CIC04: Repair auth CI findings

## One job
Repair the concrete CI blockers in PR 578's authentication router: committed
fallback credentials, weak SHA256 password verification, open redirect and an
undeclared test mocking dependency.

## Owned paths
- `plan/agents/CIC04_auth_ci.md`
- `STATUS.md` (CIC04 slot only)
- `services/rest_api/routers/user_auth.py`
- `tests/rest_api/test_user_auth.py`

## Checks
Auth unit tests, common no-hardcoded-secrets tests, compilation and whitespace.
CodeQL and full unit/common suites run in CI.

## Behavioural check
With auth variables absent, admin/admin fails. Without JWT signing configuration,
session configuration returns 503. Weak legacy SHA256 credentials fail. Callback
redirects accept only the fixed local destinations and reject external URLs.

## Follow-ups
Rebase PR 578 on repaired main and check full CI before merging.
