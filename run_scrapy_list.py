import os
import subprocess

os.chdir('scrapers')
subprocess.run(['venv/bin/scrapy', 'list'])
