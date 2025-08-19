#!/usr/bin/env python3
"""
Database Performance Testing Script for MusicDB
Tests connection pooling, query performance, and throughput for 20,000+ tracks/hour target
"""

import asyncio
import asyncpg
import time
import statistics
import json
import random
import string
from datetime import datetime, timedelta
from typing import List, Dict, Any
import argparse
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DatabasePerformanceTester:
    def __init__(self, connection_string: str, pool_size: int = 20):
        self.connection_string = connection_string
        self.pool_size = pool_size
        self.pool = None
        
    async def initialize(self):
        """Initialize connection pool"""
        try:
            self.pool = await asyncpg.create_pool(
                self.connection_string,
                min_size=5,
                max_size=self.pool_size,
                command_timeout=30
            )
            logger.info(f"Initialized connection pool with {self.pool_size} connections")
        except Exception as e:
            logger.error(f"Failed to initialize connection pool: {e}")
            raise
    
    async def close(self):
        """Close connection pool"""
        if self.pool:
            await self.pool.close()
            logger.info("Connection pool closed")
    
    def generate_test_track(self) -> Dict[str, Any]:
        """Generate a test track record"""
        return {
            'title': f"Test Track {''.join(random.choices(string.ascii_letters, k=10))}",
            'normalized_title': f"test track {''.join(random.choices(string.ascii_letters, k=10))}",
            'spotify_id': f"spotify_{''.join(random.choices(string.ascii_letters + string.digits, k=22))}",
            'genre': random.choice(['Electronic', 'House', 'Techno', 'Trance', 'Progressive']),
            'duration_ms': random.randint(120000, 480000),
            'bpm': round(random.uniform(100.0, 150.0), 2),
            'release_date': datetime.now() - timedelta(days=random.randint(0, 3650)),
            'metadata': json.dumps({'test': True, 'batch_id': int(time.time())})
        }
    
    async def test_connection_pool(self) -> Dict[str, Any]:
        """Test connection pool performance"""
        logger.info("Testing connection pool performance...")
        
        async def get_connection_time():
            start = time.time()
            async with self.pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            return time.time() - start
        
        # Test concurrent connections
        tasks = [get_connection_time() for _ in range(self.pool_size * 2)]
        connection_times = await asyncio.gather(*tasks)
        
        return {
            'avg_connection_time': statistics.mean(connection_times),
            'max_connection_time': max(connection_times),
            'min_connection_time': min(connection_times),
            'p95_connection_time': statistics.quantiles(connection_times, n=20)[18],  # 95th percentile
            'total_connections_tested': len(connection_times)
        }
    
    async def test_query_performance(self) -> Dict[str, Any]:
        """Test query performance with various query types"""
        logger.info("Testing query performance...")
        
        query_tests = [
            {
                'name': 'simple_select',
                'query': 'SELECT id, title FROM tracks LIMIT 100',
                'iterations': 100
            },
            {
                'name': 'indexed_search',
                'query': 'SELECT * FROM tracks WHERE normalized_title = $1 LIMIT 10',
                'params': ['test track'],
                'iterations': 50
            },
            {
                'name': 'complex_join',
                'query': '''
                    SELECT t.title, a.name, COUNT(st.id) as play_count
                    FROM tracks t
                    JOIN track_artists ta ON t.id = ta.track_id
                    JOIN artists a ON ta.artist_id = a.id
                    LEFT JOIN setlist_tracks st ON t.id = st.track_id
                    WHERE t.genre = $1
                    GROUP BY t.id, t.title, a.name
                    LIMIT 20
                ''',
                'params': ['Electronic'],
                'iterations': 20
            },
            {
                'name': 'full_text_search',
                'query': 'SELECT * FROM tracks WHERE search_vector @@ plainto_tsquery($1) LIMIT 10',
                'params': ['electronic music'],
                'iterations': 30
            },
            {
                'name': 'aggregation_query',
                'query': '''
                    SELECT genre, COUNT(*) as track_count, AVG(duration_ms) as avg_duration
                    FROM tracks
                    WHERE release_date > $1
                    GROUP BY genre
                    ORDER BY track_count DESC
                ''',
                'params': [datetime.now() - timedelta(days=365)],
                'iterations': 20
            }
        ]
        
        results = {}
        
        for test in query_tests:
            logger.info(f"Running {test['name']} test...")
            times = []
            
            for _ in range(test['iterations']):
                start = time.time()
                async with self.pool.acquire() as conn:
                    if 'params' in test:
                        await conn.fetch(test['query'], *test['params'])
                    else:
                        await conn.fetch(test['query'])
                times.append(time.time() - start)
            
            results[test['name']] = {
                'avg_time': statistics.mean(times),
                'max_time': max(times),
                'min_time': min(times),
                'p95_time': statistics.quantiles(times, n=20)[18] if len(times) >= 20 else max(times),
                'iterations': test['iterations']
            }
        
        return results
    
    async def test_bulk_insert_performance(self, batch_size: int = 1000, batches: int = 10) -> Dict[str, Any]:
        """Test bulk insert performance to simulate high-volume processing"""
        logger.info(f"Testing bulk insert performance ({batches} batches of {batch_size} records)...")
        
        batch_times = []
        total_inserted = 0
        
        for batch_num in range(batches):
            test_tracks = [self.generate_test_track() for _ in range(batch_size)]
            
            start = time.time()
            async with self.pool.acquire() as conn:
                async with conn.transaction():
                    for track in test_tracks:
                        await conn.execute('''
                            INSERT INTO tracks (title, normalized_title, spotify_id, genre, 
                                              duration_ms, bpm, release_date, metadata)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        ''', track['title'], track['normalized_title'], track['spotify_id'],
                             track['genre'], track['duration_ms'], track['bpm'],
                             track['release_date'], track['metadata'])
            
            batch_time = time.time() - start
            batch_times.append(batch_time)
            total_inserted += batch_size
            
            records_per_second = batch_size / batch_time
            logger.info(f"Batch {batch_num + 1}: {batch_size} records in {batch_time:.2f}s "
                       f"({records_per_second:.1f} records/sec)")
        
        avg_batch_time = statistics.mean(batch_times)
        avg_records_per_second = batch_size / avg_batch_time
        records_per_hour = avg_records_per_second * 3600
        
        return {
            'total_records_inserted': total_inserted,
            'avg_batch_time': avg_batch_time,
            'avg_records_per_second': avg_records_per_second,
            'projected_records_per_hour': records_per_hour,
            'target_met': records_per_hour >= 20000,
            'batch_times': batch_times
        }
    
    async def test_concurrent_operations(self, concurrent_users: int = 50) -> Dict[str, Any]:
        """Test concurrent database operations"""
        logger.info(f"Testing concurrent operations with {concurrent_users} simulated users...")
        
        async def simulate_user_operations():
            operations = []
            start = time.time()
            
            async with self.pool.acquire() as conn:
                # Simulate typical user operations
                # 1. Search for tracks
                search_start = time.time()
                await conn.fetch("SELECT * FROM tracks WHERE genre = $1 LIMIT 10", 'Electronic')
                operations.append(('search', time.time() - search_start))
                
                # 2. Get track details
                detail_start = time.time()
                tracks = await conn.fetch("SELECT id FROM tracks LIMIT 5")
                if tracks:
                    await conn.fetchrow("SELECT * FROM tracks WHERE id = $1", tracks[0]['id'])
                operations.append(('detail', time.time() - detail_start))
                
                # 3. Get artist information
                artist_start = time.time()
                await conn.fetch('''
                    SELECT a.*, COUNT(ta.track_id) as track_count
                    FROM artists a
                    LEFT JOIN track_artists ta ON a.id = ta.artist_id
                    GROUP BY a.id
                    LIMIT 10
                ''')
                operations.append(('artist_info', time.time() - artist_start))
            
            return time.time() - start, operations
        
        # Run concurrent user simulations
        tasks = [simulate_user_operations() for _ in range(concurrent_users)]
        results = await asyncio.gather(*tasks)
        
        total_times = [result[0] for result in results]
        all_operations = [op for result in results for op in result[1]]
        
        # Analyze operation types
        operation_stats = {}
        for op_type, op_time in all_operations:
            if op_type not in operation_stats:
                operation_stats[op_type] = []
            operation_stats[op_type].append(op_time)
        
        for op_type in operation_stats:
            times = operation_stats[op_type]
            operation_stats[op_type] = {
                'avg_time': statistics.mean(times),
                'max_time': max(times),
                'p95_time': statistics.quantiles(times, n=20)[18] if len(times) >= 20 else max(times),
                'count': len(times)
            }
        
        return {
            'concurrent_users': concurrent_users,
            'avg_total_time': statistics.mean(total_times),
            'max_total_time': max(total_times),
            'operation_stats': operation_stats,
            'all_operations_under_100ms': all([op[1] < 0.1 for result in results for op in result[1]])
        }
    
    async def test_index_performance(self) -> Dict[str, Any]:
        """Test index usage and performance"""
        logger.info("Testing index performance...")
        
        async with self.pool.acquire() as conn:
            # Test various index-based queries
            index_tests = [
                {
                    'name': 'normalized_title_lookup',
                    'query': 'SELECT * FROM tracks WHERE normalized_title = $1',
                    'params': ['test track']
                },
                {
                    'name': 'genre_filter',
                    'query': 'SELECT * FROM tracks WHERE genre = $1 LIMIT 100',
                    'params': ['Electronic']
                },
                {
                    'name': 'spotify_id_lookup',
                    'query': 'SELECT * FROM tracks WHERE spotify_id = $1',
                    'params': ['spotify_test123']
                },
                {
                    'name': 'date_range_query',
                    'query': 'SELECT * FROM tracks WHERE release_date BETWEEN $1 AND $2',
                    'params': [datetime.now() - timedelta(days=365), datetime.now()]
                }
            ]
            
            results = {}
            for test in index_tests:
                start = time.time()
                await conn.fetch(test['query'], *test['params'])
                execution_time = time.time() - start
                
                # Get query execution plan
                explain_query = f"EXPLAIN (ANALYZE, BUFFERS) {test['query']}"
                plan = await conn.fetch(explain_query, *test['params'])
                
                results[test['name']] = {
                    'execution_time': execution_time,
                    'uses_index': any('Index' in str(row) for row in plan),
                    'execution_plan': [str(row) for row in plan]
                }
        
        return results
    
    async def cleanup_test_data(self):
        """Clean up test data"""
        logger.info("Cleaning up test data...")
        async with self.pool.acquire() as conn:
            deleted = await conn.execute('''
                DELETE FROM tracks 
                WHERE metadata::jsonb @> '{"test": true}'
            ''')
            logger.info(f"Deleted {deleted} test records")
    
    async def run_comprehensive_test(self) -> Dict[str, Any]:
        """Run all performance tests"""
        logger.info("Starting comprehensive database performance test...")
        
        start_time = time.time()
        results = {
            'test_start_time': datetime.now().isoformat(),
            'database_config': {
                'pool_size': self.pool_size,
                'connection_string': self.connection_string.replace(self.connection_string.split('@')[0].split('//')[-1], '***')
            }
        }
        
        try:
            # Test 1: Connection Pool Performance
            results['connection_pool'] = await self.test_connection_pool()
            
            # Test 2: Query Performance
            results['query_performance'] = await self.test_query_performance()
            
            # Test 3: Bulk Insert Performance (critical for 20k+ tracks/hour)
            results['bulk_insert'] = await self.test_bulk_insert_performance()
            
            # Test 4: Concurrent Operations
            results['concurrent_operations'] = await self.test_concurrent_operations()
            
            # Test 5: Index Performance
            results['index_performance'] = await self.test_index_performance()
            
            # Cleanup
            await self.cleanup_test_data()
            
        except Exception as e:
            logger.error(f"Test failed: {e}")
            results['error'] = str(e)
        
        results['total_test_time'] = time.time() - start_time
        results['test_end_time'] = datetime.now().isoformat()
        
        return results

async def main():
    parser = argparse.ArgumentParser(description='Database Performance Testing for MusicDB')
    parser.add_argument('--connection-string', required=True, help='Database connection string')
    parser.add_argument('--pool-size', type=int, default=20, help='Connection pool size')
    parser.add_argument('--output', help='Output file for results (JSON)')
    
    args = parser.parse_args()
    
    tester = DatabasePerformanceTester(args.connection_string, args.pool_size)
    
    try:
        await tester.initialize()
        results = await tester.run_comprehensive_test()
        
        # Print summary
        print("\n" + "="*60)
        print("DATABASE PERFORMANCE TEST RESULTS")
        print("="*60)
        
        if 'bulk_insert' in results:
            bi = results['bulk_insert']
            print(f"Bulk Insert Performance:")
            print(f"  - Records/hour: {bi['projected_records_per_hour']:.0f}")
            print(f"  - Target (20,000+/hour): {'✓ PASS' if bi['target_met'] else '✗ FAIL'}")
            print(f"  - Records/second: {bi['avg_records_per_second']:.1f}")
        
        if 'query_performance' in results:
            qp = results['query_performance']
            print(f"\nQuery Performance:")
            for query_name, stats in qp.items():
                avg_ms = stats['avg_time'] * 1000
                p95_ms = stats['p95_time'] * 1000
                status = "✓ PASS" if avg_ms < 50 else "✗ FAIL"
                print(f"  - {query_name}: {avg_ms:.1f}ms avg, {p95_ms:.1f}ms p95 {status}")
        
        if 'concurrent_operations' in results:
            co = results['concurrent_operations']
            print(f"\nConcurrent Operations:")
            print(f"  - {co['concurrent_users']} users: {co['avg_total_time']*1000:.1f}ms avg")
            print(f"  - All ops <100ms: {'✓ PASS' if co['all_operations_under_100ms'] else '✗ FAIL'}")
        
        print(f"\nTotal test time: {results['total_test_time']:.1f} seconds")
        
        # Save results if output file specified
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(results, f, indent=2, default=str)
            print(f"\nDetailed results saved to: {args.output}")
        
    finally:
        await tester.close()

if __name__ == "__main__":
    asyncio.run(main())