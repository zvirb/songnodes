"""
One-command Master Pipeline Rebuilder for SongNodes Architectural Investigation.
Regenerates:
findings.json -> SVGs -> Markdown Reports -> Web Report (HTML) -> Printable PDF
"""
import os
import subprocess
import sys

SCRIPTS = [
    ("1/6: Generating findings.json single source of truth...", ["python", "documentation/data-flow-analysis/build/build_findings.py"]),
    ("2/6: Generating standalone SVG architecture diagrams...", ["python", "documentation/data-flow-analysis/build/build_svgs.py"]),
    ("3/6: Generating canonical Markdown reports...", ["python", "documentation/data-flow-analysis/build/build_reports.py"]),
    ("4/6: Compiling self-contained web report (HTML)...", ["python", "documentation/data-flow-analysis/build/build_html.py"]),
    ("5/6: Exporting high-fidelity printable PDF via Headless Chrome...", ["python", "documentation/data-flow-analysis/build/generate_pdf.py"]),
    ("6/6: Running Phase 6d automated verification gates...", ["python", "documentation/data-flow-analysis/build/verify_gates.py"])
]

print("=" * 70)
print("SONGNODES ARCHITECTURAL INVESTIGATION PIPELINE REBUILD")
print("=" * 70)

for desc, cmd in SCRIPTS:
    print(f"\n--> {desc}")
    res = subprocess.run(cmd, capture_output=False)
    if res.returncode != 0:
        print(f"FAILED: Step failed with return code {res.returncode}")
        sys.exit(res.returncode)

print("\n" + "=" * 70)
print("PIPELINE REBUILD COMPLETE! All deliverables up-to-date.")
print("=" * 70)
