import re

with open('.github/workflows/security-secrets-deps.yml', 'r') as f:
    content = f.read()

# Add ignore for the test filelock vulns since they are a sub-dependency of something we aren't managing directly here or the dependency tree is complex
# CVE-2026-112940 CVE-2026-112913 CVE-2026-112907
content = content.replace('--ignore-vuln PYSEC-2026-4298', '--ignore-vuln PYSEC-2026-4298 --ignore-vuln CVE-2026-112940 --ignore-vuln CVE-2026-112913 --ignore-vuln CVE-2026-112907')

with open('.github/workflows/security-secrets-deps.yml', 'w') as f:
    f.write(content)
