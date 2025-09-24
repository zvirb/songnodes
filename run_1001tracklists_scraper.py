import os
import subprocess

os.chdir('scrapers')
subprocess.run(['venv/bin/scrapy', 'crawl', '1001tracklists', '--settings', 'settings', '-o', '../scraper_output/1001tracklists_output.json', '-t', 'jsonlines'])