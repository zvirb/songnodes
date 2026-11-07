"""
Headless PDF generator for SongNodes Architectural Investigation.
Generates DATA_FLOW_AND_PAGE_INTERACTION_REPORT.pdf from report/index.html
"""
import os
import subprocess
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML_PATH = os.path.join(BASE_DIR, "report", "index.html")
PDF_PATH = os.path.join(BASE_DIR, "DATA_FLOW_AND_PAGE_INTERACTION_REPORT.pdf")

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
]

browser_exe = None
for c in CHROME_CANDIDATES:
    if os.path.exists(c):
        browser_exe = c
        break

if not browser_exe:
    print("ERROR: No Chromium browser (Chrome / Edge) found for headless PDF generation.")
    sys.exit(1)

print(f"Using browser executable: {browser_exe}")
print(f"Converting {HTML_PATH} -> {PDF_PATH}...")

cmd = [
    browser_exe,
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    "--no-pdf-header-footer",
    f"--print-to-pdf={PDF_PATH}",
    f"file:///{os.path.abspath(HTML_PATH).replace(os.sep, '/')}"
]

res = subprocess.run(cmd, capture_output=True, text=True)

if os.path.exists(PDF_PATH) and os.path.getsize(PDF_PATH) > 0:
    size_kb = os.path.getsize(PDF_PATH) // 1024
    print(f"SUCCESS: Generated PDF successfully at {PDF_PATH} ({size_kb} KB)")
else:
    print(f"ERROR: PDF generation failed. Return code: {res.returncode}")
    print(f"stdout: {res.stdout}")
    print(f"stderr: {res.stderr}")
    sys.exit(1)
