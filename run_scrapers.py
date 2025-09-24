#!/usr/bin/env python3
"""
Unified Scraper Runner
Orchestrates execution of all music data scrapers with proper configuration
"""

import os
import sys
import logging
import asyncio
import argparse
from datetime import datetime
import json
import subprocess
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add the scrapers directory to Python path
scrapers_dir = Path(__file__).parent / 'scrapers'
sys.path.insert(0, str(scrapers_dir))

# Environment variables for database connection
DEFAULT_ENV = {
    'POSTGRES_HOST': 'localhost',
    'POSTGRES_PORT': '5432',
    'POSTGRES_DB': 'musicdb',
    'POSTGRES_USER': 'musicdb_app',
    'POSTGRES_PASSWORD': 'musicdb_pass',
    'SETLISTFM_API_KEY': '8xTq8eBNbEZCWKg1ZrGpgsRQlU9GlNYNZVtG',
    'SCRAPY_SETTINGS_MODULE': 'scrapers.settings'
}

class ScraperRunner:
    """Manages execution of all music scrapers"""

    def __init__(self):
        self.scrapers = {
            '1001tracklists': {
                'name': '1001tracklists',
                'description': 'DJ tracklists from 1001tracklists.com',
                'enabled': True,
                'delay': 1.5
            },
            'mixesdb': {
                'name': 'mixesdb',
                'description': 'Mix metadata from mixesdb.com',
                'enabled': True,
                'delay': 2.0
            },
            'setlistfm_api': {
                'name': 'setlistfm_api',
                'description': 'Live performance data from setlist.fm API',
                'enabled': True,
                'delay': 1.0
            }
        }

        self.results = {}

    def setup_environment(self):
        """Setup environment variables for scrapers"""
        for key, value in DEFAULT_ENV.items():
            if key not in os.environ:
                os.environ[key] = value

        logger.info("Environment configured for scrapers")

    def run_scraper(self, scraper_name, output_dir=None):
        """Run a single scraper"""
        if scraper_name not in self.scrapers:
            raise ValueError(f"Unknown scraper: {scraper_name}")

        config = self.scrapers[scraper_name]
        if not config['enabled']:
            logger.warning(f"Scraper {scraper_name} is disabled")
            return False

        logger.info(f"Starting scraper: {scraper_name}")
        start_time = datetime.now()

        try:
            # Build scrapy command
            cmd = [
                str(scrapers_dir / 'venv/bin/scrapy'), 'crawl', scraper_name,
                '-L', 'INFO',
                '--loglevel=INFO'
            ]

            # Add output directory if specified
            if output_dir:
                output_file = os.path.join(output_dir, f"{scraper_name}_output.json")
                cmd.extend(['-o', output_file, '-t', 'jsonlines'])

            # Set working directory to scrapers folder and add project root to PYTHONPATH
            cwd = scrapers_dir
            env = os.environ.copy()
            env['PYTHONPATH'] = str(Path(__file__).parent) + os.pathsep + env.get('PYTHONPATH', '')

            # Run the scraper
            logger.info(f"Executing: {' '.join(cmd)} in {cwd}")
            result = subprocess.run(
                cmd,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=1800,  # 30 minute timeout
                env=env
            )

            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()

            if result.returncode == 0:
                logger.info(f"Scraper {scraper_name} completed successfully in {duration:.1f} seconds")
                self.results[scraper_name] = {
                    'status': 'success',
                    'duration': duration,
                    'start_time': start_time.isoformat(),
                    'end_time': end_time.isoformat(),
                    'output': result.stdout,
                    'error': result.stderr
                }
                return True
            else:
                logger.error(f"Scraper {scraper_name} failed with return code {result.returncode}")
                logger.error(f"STDOUT: {result.stdout}")
                logger.error(f"STDERR: {result.stderr}")
                self.results[scraper_name] = {
                    'status': 'failed',
                    'duration': duration,
                    'start_time': start_time.isoformat(),
                    'end_time': end_time.isoformat(),
                    'return_code': result.returncode,
                    'output': result.stdout,
                    'error': result.stderr
                }
                return False

        except subprocess.TimeoutExpired:
            logger.error(f"Scraper {scraper_name} timed out after 30 minutes")
            self.results[scraper_name] = {
                'status': 'timeout',
                'duration': 1800,
                'start_time': start_time.isoformat(),
                'end_time': datetime.now().isoformat(),
                'error': 'Timeout after 30 minutes'
            }
            return False

        except Exception as e:
            logger.error(f"Error running scraper {scraper_name}: {e}")
            self.results[scraper_name] = {
                'status': 'error',
                'start_time': start_time.isoformat(),
                'end_time': datetime.now().isoformat(),
                'error': str(e)
            }
            return False

    def run_all_scrapers(self, output_dir=None, scrapers=None):
        """Run all enabled scrapers"""
        if scrapers is None:
            scrapers = list(self.scrapers.keys())

        successful = 0
        failed = 0

        logger.info(f"Starting scraper run for: {', '.join(scrapers)}")

        for scraper_name in scrapers:
            if self.run_scraper(scraper_name, output_dir):
                successful += 1
            else:
                failed += 1

            # Add delay between scrapers
            if scraper_name != scrapers[-1]:  # Don't delay after last scraper
                config = self.scrapers[scraper_name]
                delay = config.get('delay', 2.0)
                logger.info(f"Waiting {delay} seconds before next scraper...")
                import time
                time.sleep(delay)

        logger.info(f"Scraper run completed: {successful} successful, {failed} failed")
        return self.results

    def print_status(self):
        """Print status of all scrapers"""
        print("\n=== Scraper Status ===")
        for name, config in self.scrapers.items():
            status = "ENABLED" if config['enabled'] else "DISABLED"
            print(f"{name:15} - {status:8} - {config['description']}")
        print()

    def print_results(self):
        """Print results of scraper run"""
        if not self.results:
            print("No scraper results to display")
            return

        print("\n=== Scraper Results ===")
        for scraper, result in self.results.items():
            status = result['status'].upper()
            duration = result.get('duration', 0)
            print(f"{scraper:15} - {status:8} - {duration:.1f}s")

            if result['status'] != 'success' and result.get('error'):
                print(f"  Error: {result['error'][:100]}...")
        print()

    def save_results(self, output_file):
        """Save results to JSON file"""
        try:
            with open(output_file, 'w') as f:
                json.dump(self.results, f, indent=2)
            logger.info(f"Results saved to {output_file}")
        except Exception as e:
            logger.error(f"Failed to save results: {e}")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Run music data scrapers')
    parser.add_argument(
        '--scrapers', '-s',
        nargs='+',
        choices=['1001tracklists', 'mixesdb', 'setlistfm_api', 'all'],
        default=['all'],
        help='Scrapers to run (default: all)'
    )
    parser.add_argument(
        '--output-dir', '-o',
        type=str,
        help='Output directory for scraper results'
    )
    parser.add_argument(
        '--results-file', '-r',
        type=str,
        default='scraper_results.json',
        help='File to save execution results (default: scraper_results.json)'
    )
    parser.add_argument(
        '--status',
        action='store_true',
        help='Show scraper status and exit'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose logging'
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    runner = ScraperRunner()

    if args.status:
        runner.print_status()
        return

    # Setup environment
    runner.setup_environment()

    # Create output directory if specified
    if args.output_dir:
        os.makedirs(args.output_dir, exist_ok=True)

    # Determine which scrapers to run
    if 'all' in args.scrapers:
        scrapers_to_run = list(runner.scrapers.keys())
    else:
        scrapers_to_run = args.scrapers

    try:
        # Run scrapers
        results = runner.run_all_scrapers(args.output_dir, scrapers_to_run)

        # Print results
        runner.print_results()

        # Save results
        if args.results_file:
            runner.save_results(args.results_file)

        # Exit with error code if any scrapers failed
        failed_count = sum(1 for r in results.values() if r['status'] != 'success')
        if failed_count > 0:
            logger.error(f"{failed_count} scrapers failed")
            sys.exit(1)
        else:
            logger.info("All scrapers completed successfully")

    except KeyboardInterrupt:
        logger.info("Scraper run interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()