# CI Security Scanning

SongNodes uses a robust automated security scanning pipeline implemented through GitHub Actions to ensure vulnerabilities and secrets are not merged or deployed.

## What Runs When

The automated security scanning jobs are defined in `.github/workflows/` and run during the following events:

1. **Pull Requests (PRs)**: Scans run on PRs to `main` to catch issues before code is merged.
2. **Pushes to `main`**: Post-merge scans act as an additional safety net and record a baseline for the main branch.
3. **Weekly Scheduled Scans**: Scheduled runs catch new vulnerabilities reported in existing dependencies even if no code changes occurred.

### Key Workflows

- **Secret Scanning (`security-secrets-deps.yml`)**: Uses Gitleaks to detect hardcoded secrets (API keys, passwords, tokens) across the repository.
- **Dependency Scanning (`security-secrets-deps.yml`)**:
  - `npm audit` for frontend dependencies (fails on high/critical).
  - `pip-audit` for Python dependencies across all services.
- **Trivy Container & File Scanning (`trivy.yml`)**: Scans Dockerfiles, container images, and Kubernetes manifests for misconfigurations and vulnerabilities.
- **Semgrep SAST (`security.yml`)**: Static Application Security Testing for Python, FastAPI, and React code to identify security bugs.
- **CodeQL Advanced (`codeql.yml`)**: Deeper semantic code analysis provided by GitHub.

## How to Read Results

- **Action Logs**: When a PR check fails, navigate to the **Actions** tab on GitHub, select the failed run, and expand the failing step.
  - Gitleaks provides the file, line number, and a snippet of the identified secret.
  - `npm audit` and `pip-audit` list the vulnerable package, its current version, and the patched version.
- **Security Tab**: SARIF reports (like those from CodeQL and Trivy) are uploaded to the GitHub Security tab, providing an aggregated view of repository vulnerabilities.

## How to Suppress a False Positive Properly

If a security tool flags something that is intentionally harmless (e.g., a synthetic test fixture password or an API key used in dummy data), you must add an exception rather than disabling the scan.

### Gitleaks Allowlist

Gitleaks false positives (like test keys or database defaults used strictly in tests) can be ignored using `.gitleaksignore` in the repository root.

When adding an entry to `.gitleaksignore`, you must include:
- A descriptive comment explaining **why** it is a false positive (e.g., `dummy test data`).
- A precise regex rule that targets only the false positive without ignoring valid findings. Avoid ignoring entire files unless absolutely necessary.

Example:
```toml
[allowlist]
description = "Ignore synthetic password in test fixture"

[[rules]]
id = "ignore-docs-and-test-passwords"
description = "Ignore example generic API key in documentation"
regex = '''(?i)(securePassword123|test_password|your_password|musicdb_secure_pass|7D82_xqNs55tGyk|8xTq8eBNbEZCWKg1ZrGpgsRQlU9GlNYNZVtG|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9|K8Vabm2sn4gtgqIfex7u|your-setlistfm-api-key)'''
```

### Dependency Adisories
When `npm audit` or `pip-audit` fails and no patch is available (or the vulnerable path is completely inaccessible in our execution context), wait for an upstream patch or use standard tool-specific ignore configurations if supported (e.g., pip-audit's `--ignore-vuln`).
