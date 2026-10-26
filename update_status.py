import re
from datetime import datetime

with open('STATUS.md', 'r') as f:
    content = f.read()

today = datetime.now().strftime("%Y-%m-%d")
slot_content = f"""### U13: Upgrade services/data-validator to Python 3.15 and latest requirements
- Start: {today}
- Built: Upgraded services/data-validator base image to python:3.15-slim. Updated pinned versions for pytest-asyncio (1.4.1) and starlette (1.10.0). Added build step to remove build-essential after PyYAML compilation.
- Checks run: `docker build` (success). `python -m pytest` (success). `import main` (success).
- Checks not run: None.
- End: {today} - Completed changes"""

pattern = r"(<!-- SLOT:U13 BEGIN -->\n)(.*?)(\n<!-- SLOT:U13 END -->)"
new_content = re.sub(pattern, r"\g<1>" + slot_content + r"\g<3>", content, flags=re.DOTALL)

with open('STATUS.md', 'w') as f:
    f.write(new_content)
