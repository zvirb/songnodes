"""Path setup for the scraper unit tests."""
import sys
from pathlib import Path

# Scraper modules import each other from the scrapers directory (the image's /app),
# for example `from items import ...` and `from utils.processors import ...`.
_SCRAPERS_DIR = str(Path(__file__).resolve().parents[3] / "scrapers")
if _SCRAPERS_DIR not in sys.path:
    sys.path.insert(0, _SCRAPERS_DIR)
