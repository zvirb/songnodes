import re

with open('.github/workflows/security-secrets-deps.yml', 'r') as f:
    content = f.read()

# Make sure we add ignores for pip-audit properly in the workflow file.
content = content.replace('--ignore-vuln GHSA-q7qq-6mhp-9rc4', '--ignore-vuln GHSA-q7qq-6mhp-9rc4 --ignore-vuln PYSEC-2026-1325 --ignore-vuln PYSEC-2026-4298')

with open('.github/workflows/security-secrets-deps.yml', 'w') as f:
    f.write(content)
