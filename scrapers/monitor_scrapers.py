#!/usr/bin/env python3
"""
Enhanced Scrapers Monitoring Tool
Provides real-time monitoring and statistics for scraping operations
"""

import os
import sys
import time
import json
import redis
import psycopg2
from datetime import datetime, timedelta
from collections import defaultdict
import argparse
from typing import Dict, List, Tuple

# Configuration
REDIS_CONFIG = {
    'host': os.getenv('REDIS_HOST', 'localhost'),
    'port': int(os.getenv('REDIS_PORT', 6379)),
    'db': int(os.getenv('REDIS_DB', 0))
}

POSTGRES_CONFIG = {
    'host': os.getenv('POSTGRES_HOST', 'localhost'),
    'port': int(os.getenv('POSTGRES_PORT', 5432)),
    'dbname': os.getenv('POSTGRES_DB', 'musicdb'),
    'user': os.getenv('POSTGRES_USER', 'musicuser'),
    'password': os.getenv('POSTGRES_PASSWORD', 'musicpass')
}

SPIDERS = ['enhanced_1001tracklists', 'enhanced_mixesdb', 'setlistfm_api', 'enhanced_reddit']


class ScraperMonitor:
    """Monitor for scraping operations"""

    def __init__(self):
        self.redis_client = None
        self.postgres_conn = None
        self.connect_services()

    def connect_services(self):
        """Connect to Redis and PostgreSQL"""
        try:
            self.redis_client = redis.Redis(**REDIS_CONFIG, decode_responses=True)
            self.redis_client.ping()
            print("✓ Connected to Redis")
        except Exception as e:
            print(f"✗ Redis connection failed: {e}")
            self.redis_client = None

        try:
            self.postgres_conn = psycopg2.connect(**POSTGRES_CONFIG)
            print("✓ Connected to PostgreSQL")
        except Exception as e:
            print(f"✗ PostgreSQL connection failed: {e}")
            self.postgres_conn = None

    def get_redis_stats(self) -> Dict:
        """Get Redis statistics"""
        if not self.redis_client:
            return {"error": "Redis not connected"}

        try:
            stats = {
                'total_keys': 0,
                'by_spider': {},
                'deduplication_rate': 0
            }

            # Count keys by spider
            for spider in SPIDERS:
                spider_base = spider.replace('enhanced_', '').replace('_api', '')
                pattern = f"scraped:*:{spider_base}*"
                keys = self.redis_client.keys(pattern)
                stats['by_spider'][spider] = len(keys)
                stats['total_keys'] += len(keys)

            # Calculate deduplication rate
            if stats['total_keys'] > 0:
                # Get recent attempts vs successful
                info = self.redis_client.info('stats')
                total_commands = info.get('total_commands_processed', 0)
                if total_commands > 0:
                    # Rough estimate based on key operations
                    stats['deduplication_rate'] = min(
                        (stats['total_keys'] / max(total_commands / 100, 1)) * 100,
                        100
                    )

            # Add memory usage
            info = self.redis_client.info('memory')
            stats['memory_used_mb'] = round(info.get('used_memory', 0) / 1024 / 1024, 2)

            return stats

        except Exception as e:
            return {"error": str(e)}

    def get_database_stats(self) -> Dict:
        """Get database statistics"""
        if not self.postgres_conn:
            return {"error": "PostgreSQL not connected"}

        try:
            cursor = self.postgres_conn.cursor()
            stats = {}

            # Table counts
            tables = ['tracks', 'artists', 'setlists', 'track_artists', 'setlist_tracks']
            for table in tables:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                stats[f"{table}_count"] = cursor.fetchone()[0]

            # Recent activity
            cursor.execute("""
                SELECT COUNT(*)
                FROM tracks
                WHERE created_at > NOW() - INTERVAL '1 hour'
            """)
            stats['tracks_last_hour'] = cursor.fetchone()[0]

            cursor.execute("""
                SELECT COUNT(*)
                FROM tracks
                WHERE created_at > NOW() - INTERVAL '24 hours'
            """)
            stats['tracks_last_24h'] = cursor.fetchone()[0]

            # Top artists
            cursor.execute("""
                SELECT a.artist_name, COUNT(DISTINCT ta.track_id) as track_count
                FROM artists a
                JOIN track_artists ta ON a.id = ta.artist_id
                GROUP BY a.artist_name
                ORDER BY track_count DESC
                LIMIT 5
            """)
            stats['top_artists'] = cursor.fetchall()

            cursor.close()
            return stats

        except Exception as e:
            return {"error": str(e)}

    def get_spider_performance(self) -> Dict:
        """Get spider performance metrics"""
        if not self.redis_client:
            return {"error": "Redis not connected"}

        try:
            metrics = {}

            for spider in SPIDERS:
                spider_base = spider.replace('enhanced_', '').replace('_api', '')

                # Get last run time
                last_run_key = f"scraped:setlists:{spider_base}:last_run"
                last_run = self.redis_client.get(last_run_key)

                # Count processed sources
                pattern = f"scraped:*:{spider_base}*"
                processed = len(self.redis_client.keys(pattern))

                metrics[spider] = {
                    'last_run': last_run or 'Never',
                    'sources_processed': processed,
                    'status': 'Active' if last_run else 'Idle'
                }

                # Check if running (recent activity)
                if last_run:
                    try:
                        last_run_time = datetime.fromisoformat(last_run.replace('Z', '+00:00'))
                        if datetime.now() - last_run_time.replace(tzinfo=None) < timedelta(minutes=5):
                            metrics[spider]['status'] = 'Running'
                    except:
                        pass

            return metrics

        except Exception as e:
            return {"error": str(e)}

    def monitor_live(self, interval: int = 5):
        """Live monitoring with auto-refresh"""
        print("\nStarting live monitoring (Press Ctrl+C to stop)...")

        try:
            while True:
                # Clear screen
                os.system('clear' if os.name == 'posix' else 'cls')

                print("=" * 60)
                print(f"LIVE MONITORING - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                print("=" * 60)

                # Redis stats
                print("\n📊 Redis State Management:")
                redis_stats = self.get_redis_stats()
                if 'error' not in redis_stats:
                    print(f"  Total Keys: {redis_stats['total_keys']}")
                    print(f"  Memory Used: {redis_stats['memory_used_mb']} MB")
                    print(f"  Deduplication Rate: {redis_stats['deduplication_rate']:.1f}%")
                    print("  By Spider:")
                    for spider, count in redis_stats['by_spider'].items():
                        print(f"    {spider}: {count} keys")
                else:
                    print(f"  Error: {redis_stats['error']}")

                # Database stats
                print("\n💾 Database Statistics:")
                db_stats = self.get_database_stats()
                if 'error' not in db_stats:
                    print(f"  Tracks: {db_stats['tracks_count']}")
                    print(f"  Artists: {db_stats['artists_count']}")
                    print(f"  Setlists: {db_stats['setlists_count']}")
                    print(f"  Activity: {db_stats['tracks_last_hour']} tracks in last hour")
                    print(f"           {db_stats['tracks_last_24h']} tracks in last 24h")
                else:
                    print(f"  Error: {db_stats['error']}")

                # Spider performance
                print("\n🕷️ Spider Performance:")
                perf = self.get_spider_performance()
                if 'error' not in perf:
                    for spider, metrics in perf.items():
                        status_emoji = "🟢" if metrics['status'] == 'Running' else "🔵" if metrics['status'] == 'Active' else "⚫"
                        print(f"  {status_emoji} {spider}:")
                        print(f"      Status: {metrics['status']}")
                        print(f"      Sources: {metrics['sources_processed']}")
                        print(f"      Last Run: {metrics['last_run']}")
                else:
                    print(f"  Error: {perf['error']}")

                time.sleep(interval)

        except KeyboardInterrupt:
            print("\n\nMonitoring stopped.")

    def generate_report(self) -> str:
        """Generate comprehensive monitoring report"""
        report = []
        report.append("=" * 60)
        report.append(f"SCRAPER MONITORING REPORT")
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("=" * 60)

        # Redis Stats
        report.append("\n📊 REDIS STATE MANAGEMENT")
        redis_stats = self.get_redis_stats()
        if 'error' not in redis_stats:
            report.append(f"Total Keys: {redis_stats['total_keys']}")
            report.append(f"Memory Used: {redis_stats['memory_used_mb']} MB")
            report.append(f"Deduplication Rate: {redis_stats['deduplication_rate']:.1f}%")
            report.append("\nKeys by Spider:")
            for spider, count in redis_stats['by_spider'].items():
                report.append(f"  - {spider}: {count}")
        else:
            report.append(f"Error: {redis_stats['error']}")

        # Database Stats
        report.append("\n💾 DATABASE STATISTICS")
        db_stats = self.get_database_stats()
        if 'error' not in db_stats:
            report.append(f"Tracks: {db_stats['tracks_count']}")
            report.append(f"Artists: {db_stats['artists_count']}")
            report.append(f"Setlists: {db_stats['setlists_count']}")
            report.append(f"Track-Artist Relations: {db_stats['track_artists_count']}")
            report.append(f"Setlist-Track Relations: {db_stats['setlist_tracks_count']}")
            report.append(f"\nRecent Activity:")
            report.append(f"  - Last Hour: {db_stats['tracks_last_hour']} tracks")
            report.append(f"  - Last 24 Hours: {db_stats['tracks_last_24h']} tracks")

            if db_stats.get('top_artists'):
                report.append(f"\nTop 5 Artists by Track Count:")
                for artist, count in db_stats['top_artists']:
                    report.append(f"  - {artist}: {count} tracks")
        else:
            report.append(f"Error: {db_stats['error']}")

        # Spider Performance
        report.append("\n🕷️ SPIDER PERFORMANCE")
        perf = self.get_spider_performance()
        if 'error' not in perf:
            for spider, metrics in perf.items():
                report.append(f"\n{spider}:")
                report.append(f"  Status: {metrics['status']}")
                report.append(f"  Sources Processed: {metrics['sources_processed']}")
                report.append(f"  Last Run: {metrics['last_run']}")
        else:
            report.append(f"Error: {perf['error']}")

        report.append("\n" + "=" * 60)
        return "\n".join(report)

    def check_health(self) -> Tuple[int, str]:
        """Check overall system health"""
        health_score = 0
        max_score = 5
        issues = []

        # Check Redis
        if self.redis_client:
            try:
                self.redis_client.ping()
                health_score += 1
            except:
                issues.append("Redis is not responding")
        else:
            issues.append("Redis is not connected")

        # Check PostgreSQL
        if self.postgres_conn:
            try:
                cursor = self.postgres_conn.cursor()
                cursor.execute("SELECT 1")
                cursor.close()
                health_score += 1
            except:
                issues.append("PostgreSQL is not responding")
        else:
            issues.append("PostgreSQL is not connected")

        # Check spider activity
        perf = self.get_spider_performance()
        if 'error' not in perf:
            active_spiders = sum(1 for s in perf.values() if s['status'] != 'Idle')
            if active_spiders > 0:
                health_score += 1
            else:
                issues.append("No spiders have run recently")

        # Check data flow
        db_stats = self.get_database_stats()
        if 'error' not in db_stats:
            if db_stats.get('tracks_last_24h', 0) > 0:
                health_score += 1
            else:
                issues.append("No tracks scraped in last 24 hours")

        # Check deduplication
        redis_stats = self.get_redis_stats()
        if 'error' not in redis_stats:
            if redis_stats.get('deduplication_rate', 0) > 0:
                health_score += 1

        health_status = "HEALTHY" if health_score == max_score else \
                       "WARNING" if health_score >= max_score - 1 else \
                       "CRITICAL"

        return health_score, health_status, issues


def main():
    parser = argparse.ArgumentParser(description='Monitor Enhanced Scrapers')
    parser.add_argument('command', choices=['live', 'report', 'health', 'stats'],
                      help='Monitoring command to run')
    parser.add_argument('--interval', type=int, default=5,
                      help='Refresh interval for live monitoring (seconds)')
    parser.add_argument('--json', action='store_true',
                      help='Output in JSON format')

    args = parser.parse_args()

    monitor = ScraperMonitor()

    if args.command == 'live':
        monitor.monitor_live(args.interval)

    elif args.command == 'report':
        report = monitor.generate_report()
        print(report)

    elif args.command == 'health':
        score, status, issues = monitor.check_health()

        if args.json:
            print(json.dumps({
                'score': score,
                'max_score': 5,
                'status': status,
                'issues': issues
            }))
        else:
            print(f"\nHealth Check Results:")
            print(f"Score: {score}/5")
            print(f"Status: {status}")
            if issues:
                print("\nIssues found:")
                for issue in issues:
                    print(f"  - {issue}")
            else:
                print("\nNo issues found!")

    elif args.command == 'stats':
        redis_stats = monitor.get_redis_stats()
        db_stats = monitor.get_database_stats()
        spider_perf = monitor.get_spider_performance()

        if args.json:
            print(json.dumps({
                'redis': redis_stats,
                'database': db_stats,
                'spiders': spider_perf
            }, indent=2))
        else:
            print("\n=== Scraping Statistics ===\n")
            print("Redis:", json.dumps(redis_stats, indent=2))
            print("\nDatabase:", json.dumps(db_stats, indent=2))
            print("\nSpiders:", json.dumps(spider_perf, indent=2))


if __name__ == '__main__':
    main()