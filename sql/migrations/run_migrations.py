#!/usr/bin/env python3
"""
Migration Runner for SongNodes PostgreSQL Database
Handles forward and backward migration execution with safety checks
"""

import os
import sys
import time
import hashlib
import argparse
import psycopg2
import psycopg2.extras
from pathlib import Path
from typing import List, Dict, Optional, Tuple


class MigrationRunner:
    """Handles database migration execution and tracking"""
    
    def __init__(self, db_config: Dict[str, str]):
        self.db_config = db_config
        self.migrations_dir = Path(__file__).parent
        self.connection = None
        
    def connect(self) -> None:
        """Establish database connection"""
        try:
            self.connection = psycopg2.connect(**self.db_config)
            self.connection.autocommit = False
            print(f"✓ Connected to database: {self.db_config['host']}:{self.db_config['port']}/{self.db_config['database']}")
        except Exception as e:
            print(f"✗ Failed to connect to database: {e}")
            sys.exit(1)
    
    def disconnect(self) -> None:
        """Close database connection"""
        if self.connection:
            self.connection.close()
            print("✓ Database connection closed")
    
    def ensure_migrations_table(self) -> None:
        """Create schema_migrations table if it doesn't exist"""
        try:
            with self.connection.cursor() as cursor:
                # Check if migrations table exists
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'musicdb' 
                        AND table_name = 'schema_migrations'
                    );
                """)
                
                if not cursor.fetchone()[0]:
                    print("Creating schema_migrations table...")
                    migration_sql = self.migrations_dir / "000_schema_migrations_up.sql"
                    self.execute_migration_file(migration_sql)
                    print("✓ Schema migrations table created")
                
            self.connection.commit()
        except Exception as e:
            self.connection.rollback()
            print(f"✗ Failed to ensure migrations table: {e}")
            raise
    
    def get_applied_migrations(self) -> List[str]:
        """Get list of already applied migrations"""
        try:
            with self.connection.cursor() as cursor:
                cursor.execute("""
                    SELECT version FROM musicdb.schema_migrations 
                    ORDER BY applied_at
                """)
                return [row[0] for row in cursor.fetchall()]
        except Exception as e:
            print(f"✗ Failed to get applied migrations: {e}")
            return []
    
    def get_available_migrations(self, direction: str = "up") -> List[Path]:
        """Get list of available migration files"""
        pattern = f"*_{direction}.sql"
        migrations = sorted(self.migrations_dir.glob(pattern))
        return [m for m in migrations if not m.name.startswith("000_")]
    
    def calculate_checksum(self, file_path: Path) -> str:
        """Calculate SHA-256 checksum of migration file"""
        return hashlib.sha256(file_path.read_bytes()).hexdigest()
    
    def execute_migration_file(self, file_path: Path) -> int:
        """Execute a migration file and return execution time in ms"""
        start_time = time.time()
        
        try:
            sql_content = file_path.read_text()
            
            with self.connection.cursor() as cursor:
                cursor.execute(sql_content)
            
            execution_time = int((time.time() - start_time) * 1000)
            return execution_time
            
        except Exception as e:
            print(f"✗ Failed to execute {file_path.name}: {e}")
            raise
    
    def record_migration(self, version: str, file_path: Path, execution_time: int) -> None:
        """Record migration in schema_migrations table"""
        try:
            checksum = self.calculate_checksum(file_path)
            rollback_file = file_path.parent / file_path.name.replace("_up.sql", "_down.sql")
            rollback_sql = rollback_file.read_text() if rollback_file.exists() else None
            
            with self.connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO musicdb.schema_migrations 
                    (version, checksum, execution_time_ms, rollback_sql, description)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (version) DO UPDATE SET
                        checksum = EXCLUDED.checksum,
                        execution_time_ms = EXCLUDED.execution_time_ms,
                        applied_at = CURRENT_TIMESTAMP
                """, (
                    version,
                    checksum,
                    execution_time,
                    rollback_sql,
                    f"Migration: {version}"
                ))
                
        except Exception as e:
            print(f"✗ Failed to record migration {version}: {e}")
            raise
    
    def remove_migration_record(self, version: str) -> None:
        """Remove migration record from schema_migrations table"""
        try:
            with self.connection.cursor() as cursor:
                cursor.execute("""
                    DELETE FROM musicdb.schema_migrations 
                    WHERE version = %s
                """, (version,))
                
        except Exception as e:
            print(f"✗ Failed to remove migration record {version}: {e}")
            raise
    
    def migrate_up(self, target_version: Optional[str] = None) -> None:
        """Run forward migrations"""
        print("🚀 Starting forward migration...")
        
        applied_migrations = set(self.get_applied_migrations())
        available_migrations = self.get_available_migrations("up")
        
        migrations_to_run = []
        for migration_file in available_migrations:
            version = migration_file.stem.replace("_up", "")
            
            if version not in applied_migrations:
                migrations_to_run.append((version, migration_file))
                
            if target_version and version == target_version:
                break
        
        if not migrations_to_run:
            print("✓ No migrations to run - database is up to date")
            return
        
        print(f"Found {len(migrations_to_run)} migration(s) to apply:")
        for version, _ in migrations_to_run:
            print(f"  • {version}")
        
        for version, migration_file in migrations_to_run:
            try:
                print(f"\n📋 Applying migration: {version}")
                execution_time = self.execute_migration_file(migration_file)
                self.record_migration(version, migration_file, execution_time)
                self.connection.commit()
                print(f"✓ Applied {version} in {execution_time}ms")
                
            except Exception as e:
                self.connection.rollback()
                print(f"✗ Failed to apply migration {version}: {e}")
                print("⚠️ Rolling back transaction...")
                raise
        
        print(f"\n🎉 Successfully applied {len(migrations_to_run)} migration(s)")
    
    def migrate_down(self, target_version: str) -> None:
        """Run rollback migrations"""
        print(f"⬇️ Starting rollback to version: {target_version}")
        
        applied_migrations = self.get_applied_migrations()
        
        # Find migrations to rollback (in reverse order)
        migrations_to_rollback = []
        for version in reversed(applied_migrations):
            if version == target_version:
                break
            migrations_to_rollback.append(version)
        
        if not migrations_to_rollback:
            print("✓ No migrations to rollback")
            return
        
        print(f"Found {len(migrations_to_rollback)} migration(s) to rollback:")
        for version in migrations_to_rollback:
            print(f"  • {version}")
        
        for version in migrations_to_rollback:
            try:
                print(f"\n📋 Rolling back migration: {version}")
                
                rollback_file = self.migrations_dir / f"{version}_down.sql"
                if not rollback_file.exists():
                    print(f"⚠️ Rollback file not found: {rollback_file}")
                    continue
                
                execution_time = self.execute_migration_file(rollback_file)
                self.remove_migration_record(version)
                self.connection.commit()
                print(f"✓ Rolled back {version} in {execution_time}ms")
                
            except Exception as e:
                self.connection.rollback()
                print(f"✗ Failed to rollback migration {version}: {e}")
                print("⚠️ Rolling back transaction...")
                raise
        
        print(f"\n🎉 Successfully rolled back {len(migrations_to_rollback)} migration(s)")
    
    def show_status(self) -> None:
        """Show migration status"""
        print("📊 Migration Status:")
        
        applied_migrations = set(self.get_applied_migrations())
        available_up = self.get_available_migrations("up")
        available_down = self.get_available_migrations("down")
        
        print(f"\nApplied migrations ({len(applied_migrations)}):")
        for version in sorted(applied_migrations):
            print(f"  ✓ {version}")
        
        pending_migrations = []
        for migration_file in available_up:
            version = migration_file.stem.replace("_up", "")
            if version not in applied_migrations:
                pending_migrations.append(version)
        
        if pending_migrations:
            print(f"\nPending migrations ({len(pending_migrations)}):")
            for version in pending_migrations:
                rollback_exists = (self.migrations_dir / f"{version}_down.sql").exists()
                rollback_indicator = "↕️" if rollback_exists else "⬆️"
                print(f"  {rollback_indicator} {version}")
        else:
            print("\n✓ All migrations applied - database is up to date")
    
    def validate_migrations(self) -> bool:
        """Validate migration files and checksums"""
        print("🔍 Validating migrations...")
        
        applied_migrations = self.get_applied_migrations()
        issues_found = False
        
        # Check for applied migrations with changed checksums
        with self.connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute("""
                SELECT version, checksum FROM musicdb.schema_migrations
                WHERE version != '000_schema_migrations'
                ORDER BY applied_at
            """)
            
            for row in cursor.fetchall():
                version = row['version']
                stored_checksum = row['checksum']
                
                migration_file = self.migrations_dir / f"{version}_up.sql"
                if migration_file.exists():
                    current_checksum = self.calculate_checksum(migration_file)
                    if current_checksum != stored_checksum:
                        print(f"⚠️ Checksum mismatch for {version}")
                        print(f"   Stored:  {stored_checksum}")
                        print(f"   Current: {current_checksum}")
                        issues_found = True
                else:
                    print(f"⚠️ Migration file missing: {migration_file}")
                    issues_found = True
        
        # Check for orphaned rollback files
        available_down = self.get_available_migrations("down")
        for rollback_file in available_down:
            version = rollback_file.stem.replace("_down", "")
            up_file = self.migrations_dir / f"{version}_up.sql"
            if not up_file.exists():
                print(f"⚠️ Orphaned rollback file: {rollback_file}")
                issues_found = True
        
        if not issues_found:
            print("✓ All migrations are valid")
        
        return not issues_found


def main():
    parser = argparse.ArgumentParser(description="SongNodes Database Migration Runner")
    parser.add_argument("command", choices=["up", "down", "status", "validate"], 
                       help="Migration command to execute")
    parser.add_argument("--version", help="Target version for up/down migrations")
    parser.add_argument("--host", default="localhost", help="Database host")
    parser.add_argument("--port", default="5432", help="Database port")
    parser.add_argument("--database", default="musicdb", help="Database name")
    parser.add_argument("--user", default="musicdb_app", help="Database user")
    parser.add_argument("--password", help="Database password")
    
    args = parser.parse_args()
    
    # Get password from environment if not provided
    password = args.password or os.getenv("DB_PASSWORD")
    if not password:
        password = input("Database password: ")
    
    db_config = {
        "host": args.host,
        "port": args.port,
        "database": args.database,
        "user": args.user,
        "password": password
    }
    
    runner = MigrationRunner(db_config)
    
    try:
        runner.connect()
        runner.ensure_migrations_table()
        
        if args.command == "up":
            runner.migrate_up(args.version)
        elif args.command == "down":
            if not args.version:
                print("✗ --version is required for rollback")
                sys.exit(1)
            runner.migrate_down(args.version)
        elif args.command == "status":
            runner.show_status()
        elif args.command == "validate":
            if not runner.validate_migrations():
                sys.exit(1)
                
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        sys.exit(1)
    finally:
        runner.disconnect()


if __name__ == "__main__":
    main()