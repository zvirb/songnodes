#!/usr/bin/env python3
"""
Complete SongNodes Music Data Upgrade and Scraping Pipeline
Executes the full workflow to upgrade database schema and collect comprehensive music data
"""
import asyncio
import asyncpg
import subprocess
import logging
import os
import sys
import time
import json
from datetime import datetime
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('music_data_upgrade.log')
    ]
)
logger = logging.getLogger(__name__)


class MusicDataUpgradeOrchestrator:
    """
    Orchestrates the complete music data upgrade process:
    1. Database schema upgrade
    2. Data clearing
    3. Enhanced scraper deployment
    4. Data validation and statistics
    """

    def __init__(self):
        self.database_config = {
            'host': 'localhost',
            'port': 5433,
            'database': 'musicdb',
            'user': 'musicdb_user',
            'password': 'musicdb_secure_pass'
        }
        self.start_time = datetime.utcnow()
        self.stats = {
            'schema_upgrade': False,
            'data_cleared': False,
            'scrapers_deployed': [],
            'tracks_collected': 0,
            'artists_collected': 0,
            'target_tracks_found': 0,
            'errors': []
        }

    async def run_complete_upgrade(self):
        """Execute the complete upgrade workflow"""
        try:
            logger.info("="*80)
            logger.info("🎵 SONGNODES COMPLETE MUSIC DATA UPGRADE STARTING")
            logger.info("="*80)

            # Phase 1: Database Schema Upgrade
            await self.upgrade_database_schema()

            # Phase 2: Clear Existing Data
            await self.clear_existing_data()

            # Phase 3: Validate Schema
            await self.validate_upgraded_schema()

            # Phase 4: Deploy Enhanced Scrapers
            await self.deploy_enhanced_scrapers()

            # Phase 5: Generate Final Statistics
            await self.generate_final_statistics()

            logger.info("="*80)
            logger.info("✅ SONGNODES MUSIC DATA UPGRADE COMPLETED SUCCESSFULLY")
            logger.info("="*80)

        except Exception as e:
            logger.error(f"❌ Upgrade failed: {e}")
            self.stats['errors'].append(str(e))
            raise

    async def upgrade_database_schema(self):
        """Upgrade database schema with enhanced music metadata fields"""
        logger.info("📊 Phase 1: Upgrading Database Schema...")

        try:
            # Execute schema upgrade SQL
            schema_file = Path(__file__).parent / 'sql' / 'upgrade_schema_for_complete_music_data.sql'

            if not schema_file.exists():
                raise FileNotFoundError(f"Schema upgrade file not found: {schema_file}")

            # Run schema upgrade via psql
            cmd = [
                'docker', 'exec', 'musicdb-postgres',
                'psql', '-U', self.database_config['user'],
                '-d', self.database_config['database'],
                '-f', '/docker-entrypoint-initdb.d/upgrade_schema_for_complete_music_data.sql'
            ]

            # Copy SQL file to container first
            subprocess.run([
                'docker', 'cp', str(schema_file),
                'musicdb-postgres:/docker-entrypoint-initdb.d/upgrade_schema_for_complete_music_data.sql'
            ], check=True)

            # Execute schema upgrade
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)

            logger.info("✅ Database schema upgraded successfully")
            logger.info(f"Schema upgrade output: {result.stdout}")

            self.stats['schema_upgrade'] = True

        except subprocess.CalledProcessError as e:
            logger.error(f"❌ Schema upgrade failed: {e}")
            logger.error(f"Error output: {e.stderr}")
            self.stats['errors'].append(f"Schema upgrade failed: {e}")
            raise

    async def clear_existing_data(self):
        """Clear existing incomplete data"""
        logger.info("🧹 Phase 2: Clearing Existing Incomplete Data...")

        try:
            connection_string = (
                f"postgresql://{self.database_config['user']}:{self.database_config['password']}@"
                f"{self.database_config['host']}:{self.database_config['port']}/"
                f"{self.database_config['database']}"
            )

            conn = await asyncpg.connect(connection_string)

            # Clear existing data (this is safe since database was empty anyway)
            await conn.execute("TRUNCATE TABLE track_artists CASCADE")
            await conn.execute("TRUNCATE TABLE tracks CASCADE")
            await conn.execute("TRUNCATE TABLE artists CASCADE")
            await conn.execute("TRUNCATE TABLE setlists CASCADE")
            await conn.execute("TRUNCATE TABLE venues CASCADE")

            await conn.close()

            logger.info("✅ Existing data cleared successfully")
            self.stats['data_cleared'] = True

        except Exception as e:
            logger.error(f"❌ Data clearing failed: {e}")
            self.stats['errors'].append(f"Data clearing failed: {e}")
            raise

    async def validate_upgraded_schema(self):
        """Validate that the schema upgrade was successful"""
        logger.info("🔍 Phase 3: Validating Upgraded Schema...")

        try:
            connection_string = (
                f"postgresql://{self.database_config['user']}:{self.database_config['password']}@"
                f"{self.database_config['host']}:{self.database_config['port']}/"
                f"{self.database_config['database']}"
            )

            conn = await asyncpg.connect(connection_string)

            # Check for key new columns
            tracks_columns = await conn.fetch("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'tracks'
                AND column_name IN ('bpm', 'musical_key', 'energy', 'genre', 'is_remix')
            """)

            artists_columns = await conn.fetch("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'artists'
                AND column_name IN ('spotify_id', 'genre_preferences', 'country')
            """)

            await conn.close()

            logger.info(f"✅ Schema validation successful")
            logger.info(f"   - Enhanced tracks columns: {len(tracks_columns)}")
            logger.info(f"   - Enhanced artists columns: {len(artists_columns)}")

            if len(tracks_columns) < 5:
                raise Exception(f"Schema upgrade incomplete: only {len(tracks_columns)} enhanced track columns found")

        except Exception as e:
            logger.error(f"❌ Schema validation failed: {e}")
            self.stats['errors'].append(f"Schema validation failed: {e}")
            raise

    async def deploy_enhanced_scrapers(self):
        """Deploy enhanced scrapers to collect comprehensive music data"""
        logger.info("🕷️ Phase 4: Deploying Enhanced Scrapers...")

        scrapers_to_run = [
            {
                'name': 'enhanced_1001tracklists',
                'spider': 'enhanced_1001tracklists',
                'settings': {
                    'DOWNLOAD_DELAY': 2.0,
                    'CONCURRENT_REQUESTS': 1
                }
            },
            {
                'name': 'enhanced_mixesdb',
                'spider': 'enhanced_mixesdb',
                'settings': {
                    'DOWNLOAD_DELAY': 2.5,
                    'CONCURRENT_REQUESTS': 1
                }
            }
        ]

        for scraper_config in scrapers_to_run:
            try:
                await self.run_single_scraper(scraper_config)
                self.stats['scrapers_deployed'].append(scraper_config['name'])
            except Exception as e:
                logger.error(f"❌ Scraper {scraper_config['name']} failed: {e}")
                self.stats['errors'].append(f"Scraper {scraper_config['name']} failed: {e}")

    async def run_single_scraper(self, scraper_config):
        """Run a single enhanced scraper"""
        logger.info(f"🚀 Starting {scraper_config['name']} scraper...")

        try:
            # Change to scrapers directory
            scrapers_dir = Path(__file__).parent / 'scrapers'
            os.chdir(scrapers_dir)

            # Build scrapy command
            cmd = [
                'scrapy', 'crawl', scraper_config['spider'],
                '-s', f"DATABASE_HOST={self.database_config['host']}",
                '-s', f"DATABASE_PORT={self.database_config['port']}",
                '-s', f"DATABASE_NAME={self.database_config['database']}",
                '-s', f"DATABASE_USER={self.database_config['user']}",
                '-s', f"DATABASE_PASSWORD={self.database_config['password']}"
            ]

            # Add custom settings
            for key, value in scraper_config['settings'].items():
                cmd.extend(['-s', f"{key}={value}"])

            # Run scraper with timeout
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            # Wait for completion with timeout (30 minutes per scraper)
            try:
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=1800)

                if process.returncode == 0:
                    logger.info(f"✅ {scraper_config['name']} completed successfully")
                    logger.info(f"Output: {stdout.decode()[-500:]}")  # Last 500 chars
                else:
                    logger.error(f"❌ {scraper_config['name']} failed with return code {process.returncode}")
                    logger.error(f"Error: {stderr.decode()}")

            except asyncio.TimeoutError:
                logger.warning(f"⏰ {scraper_config['name']} timed out after 30 minutes")
                process.kill()
                await process.wait()

        except Exception as e:
            logger.error(f"❌ Error running {scraper_config['name']}: {e}")
            raise

    async def generate_final_statistics(self):
        """Generate comprehensive final statistics"""
        logger.info("📈 Phase 5: Generating Final Statistics...")

        try:
            connection_string = (
                f"postgresql://{self.database_config['user']}:{self.database_config['password']}@"
                f"{self.database_config['host']}:{self.database_config['port']}/"
                f"{self.database_config['database']}"
            )

            conn = await asyncpg.connect(connection_string)

            # Get comprehensive statistics
            stats_queries = {
                'total_tracks': "SELECT COUNT(*) FROM tracks",
                'total_artists': "SELECT COUNT(*) FROM artists",
                'total_setlists': "SELECT COUNT(*) FROM setlists",
                'tracks_with_bpm': "SELECT COUNT(*) FROM tracks WHERE bpm IS NOT NULL",
                'tracks_with_genre': "SELECT COUNT(*) FROM tracks WHERE genre IS NOT NULL",
                'tracks_remixes': "SELECT COUNT(*) FROM tracks WHERE is_remix = TRUE",
                'tracks_mashups': "SELECT COUNT(*) FROM tracks WHERE is_mashup = TRUE",
                'artists_with_spotify': "SELECT COUNT(*) FROM artists WHERE spotify_id IS NOT NULL",
                'track_artist_relationships': "SELECT COUNT(*) FROM track_artists"
            }

            final_stats = {}
            for stat_name, query in stats_queries.items():
                result = await conn.fetchval(query)
                final_stats[stat_name] = result

            # Get genre distribution
            genre_dist = await conn.fetch("""
                SELECT genre, COUNT(*) as count
                FROM tracks
                WHERE genre IS NOT NULL
                GROUP BY genre
                ORDER BY count DESC
                LIMIT 10
            """)

            # Get top artists by track count
            top_artists = await conn.fetch("""
                SELECT a.name, COUNT(ta.track_id) as track_count
                FROM artists a
                JOIN track_artists ta ON a.id = ta.artist_id
                GROUP BY a.name
                ORDER BY track_count DESC
                LIMIT 10
            """)

            await conn.close()

            # Update internal stats
            self.stats.update({
                'tracks_collected': final_stats['total_tracks'],
                'artists_collected': final_stats['total_artists'],
                'target_tracks_found': final_stats['tracks_with_genre']  # Approximation
            })

            # Log comprehensive statistics
            end_time = datetime.utcnow()
            duration = (end_time - self.start_time).total_seconds()

            logger.info("="*80)
            logger.info("📊 FINAL SONGNODES MUSIC DATA STATISTICS")
            logger.info("="*80)
            logger.info(f"⏱️  Total Processing Time: {duration:.1f} seconds")
            logger.info("")
            logger.info("🎵 Data Collection Summary:")
            logger.info(f"   • Total Tracks: {final_stats['total_tracks']:,}")
            logger.info(f"   • Total Artists: {final_stats['total_artists']:,}")
            logger.info(f"   • Total Setlists: {final_stats['total_setlists']:,}")
            logger.info(f"   • Track-Artist Relationships: {final_stats['track_artist_relationships']:,}")
            logger.info("")
            logger.info("🎛️ Enhanced Metadata Coverage:")
            logger.info(f"   • Tracks with BPM: {final_stats['tracks_with_bpm']:,}")
            logger.info(f"   • Tracks with Genre: {final_stats['tracks_with_genre']:,}")
            logger.info(f"   • Remix Tracks: {final_stats['tracks_remixes']:,}")
            logger.info(f"   • Mashup Tracks: {final_stats['tracks_mashups']:,}")
            logger.info(f"   • Artists with Spotify ID: {final_stats['artists_with_spotify']:,}")
            logger.info("")
            logger.info("🎼 Top Genres:")
            for genre_row in genre_dist[:5]:
                logger.info(f"   • {genre_row['genre']}: {genre_row['count']} tracks")
            logger.info("")
            logger.info("🎤 Top Artists by Track Count:")
            for artist_row in top_artists[:5]:
                logger.info(f"   • {artist_row['name']}: {artist_row['track_count']} tracks")
            logger.info("")
            logger.info("🔧 System Status:")
            logger.info(f"   • Schema Upgraded: {'✅' if self.stats['schema_upgrade'] else '❌'}")
            logger.info(f"   • Data Cleared: {'✅' if self.stats['data_cleared'] else '❌'}")
            logger.info(f"   • Scrapers Deployed: {len(self.stats['scrapers_deployed'])}")
            logger.info(f"   • Errors Encountered: {len(self.stats['errors'])}")

            if self.stats['errors']:
                logger.info("")
                logger.info("⚠️ Errors Encountered:")
                for error in self.stats['errors']:
                    logger.info(f"   • {error}")

            logger.info("="*80)

            # Generate JSON report
            report = {
                'upgrade_timestamp': end_time.isoformat(),
                'duration_seconds': duration,
                'statistics': final_stats,
                'genre_distribution': [dict(row) for row in genre_dist],
                'top_artists': [dict(row) for row in top_artists],
                'system_status': self.stats,
                'success': len(self.stats['errors']) == 0
            }

            report_file = f"music_data_upgrade_report_{end_time.strftime('%Y%m%d_%H%M%S')}.json"
            with open(report_file, 'w') as f:
                json.dump(report, f, indent=2, default=str)

            logger.info(f"📄 Detailed report saved to: {report_file}")

        except Exception as e:
            logger.error(f"❌ Error generating statistics: {e}")
            self.stats['errors'].append(f"Statistics generation failed: {e}")


async def main():
    """Main entry point"""
    try:
        orchestrator = MusicDataUpgradeOrchestrator()
        await orchestrator.run_complete_upgrade()
        return 0
    except KeyboardInterrupt:
        logger.info("🛑 Upgrade interrupted by user")
        return 130
    except Exception as e:
        logger.error(f"💥 Upgrade failed with error: {e}")
        return 1


if __name__ == "__main__":
    # Change to script directory
    os.chdir(Path(__file__).parent)

    # Check prerequisites
    logger.info("🔍 Checking prerequisites...")

    # Check if database is running
    try:
        result = subprocess.run(['docker', 'ps', '--filter', 'name=musicdb-postgres', '--format', 'table {{.Names}}'],
                              capture_output=True, text=True)
        if 'musicdb-postgres' not in result.stdout:
            logger.error("❌ PostgreSQL database container not running")
            logger.info("Please start the database with: docker compose up -d postgres")
            sys.exit(1)
    except subprocess.CalledProcessError:
        logger.error("❌ Docker not available")
        sys.exit(1)

    # Check if scrapy is available
    try:
        subprocess.run(['scrapy', 'version'], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        logger.error("❌ Scrapy not available")
        logger.info("Please install scrapy: pip install scrapy")
        sys.exit(1)

    logger.info("✅ Prerequisites check passed")

    # Run the upgrade
    exit_code = asyncio.run(main())
    sys.exit(exit_code)