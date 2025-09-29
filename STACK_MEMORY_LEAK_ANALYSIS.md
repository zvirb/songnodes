# SongNodes Stack Memory Leak Analysis Report
**Generated:** September 28, 2025
**Focus:** Backend services, database connections, caching, and container infrastructure

## 🚨 Critical Memory Leak Issues Found

### 1. **Database Connection Pool Issues**

#### **REST API Service** (`services/rest-api/main.py`)
- **⚠️ Line 26**: Database pool configuration may cause connection leaks
  ```python
  db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=5, max_size=20)
  ```
- **Issue**: No explicit connection timeout or idle timeout configuration
- **Risk**: Connections may stay open indefinitely during low activity periods
- **Fix**: Add pool configuration:
  ```python
  db_pool = await asyncpg.create_pool(
      DATABASE_URL,
      min_size=5,
      max_size=20,
      command_timeout=60,
      server_settings={'jit': 'off'},
      init=lambda conn: conn.set_builtin_type_codec('json', codec_name='ujson')
  )
  ```

#### **Graph Visualization API** (`services/graph-visualization-api/main.py`)
- **⚠️ Lines 59-67**: SQLAlchemy engine with potential pool exhaustion
  ```python
  engine = create_async_engine(
      DATABASE_URL,
      poolclass=QueuePool,
      pool_size=20,
      max_overflow=30,  # Total 50 connections possible
      pool_pre_ping=True,
      pool_recycle=3600
  )
  ```
- **Issue**: High connection limits without proper cleanup tracking
- **Risk**: Under heavy load, connection pool may exhaust database resources

### 2. **Redis Connection Management**

#### **Graph Visualization API**
- **⚠️ Line 672**: Redis connection created without connection pool management
  ```python
  redis_pool = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)
  ```
- **Issue**: Single Redis instance instead of connection pool
- **Risk**: Connection exhaustion under concurrent requests
- **Fix**: Use Redis connection pool:
  ```python
  redis_pool = redis.ConnectionPool(
      host=REDIS_HOST,
      port=REDIS_PORT,
      db=0,
      decode_responses=True,
      max_connections=100,
      retry_on_timeout=True
  )
  redis_client = redis.Redis(connection_pool=redis_pool)
  ```

### 3. **WebSocket Connection Memory Leaks**

#### **ConnectionManager Class** (`services/graph-visualization-api/main.py:75-132`)
- **⚠️ Lines 77-78**: Potential memory leak in connection tracking
  ```python
  self.active_connections: Dict[str, set] = {}
  self.connection_metadata: Dict[WebSocket, dict] = {}
  ```
- **Issues**:
  - No automatic cleanup of stale connections
  - WebSocket objects kept in memory after disconnect
  - No size limits on connection dictionaries
- **Risk**: Memory grows indefinitely with connection churn

#### **Dead Connection Cleanup** (Lines 112-122)
- **Partial Fix**: Cleanup exists but may not catch all edge cases
- **Missing**: Periodic cleanup of stale connections, connection age limits

### 4. **Caching Layer Memory Issues**

#### **Cache Decorator** (`services/graph-visualization-api/main.py:233-262`)
- **⚠️ Missing**: Cache size limits and TTL enforcement
- **Issue**: Redis cache can grow indefinitely without LRU eviction
- **Risk**: Redis memory exhaustion

#### **Docker Redis Configuration** (`docker-compose.yml:80`)
```yaml
command: redis-server --appendonly yes --maxmemory 2048mb --maxmemory-policy allkeys-lru --maxclients 10000 --tcp-keepalive 60
```
- **✅ Good**: Proper maxmemory and LRU policy configured
- **⚠️ Concern**: Very high maxclients (10000) may overwhelm connection handling

### 5. **Container Resource Limits**

#### **Docker Compose Resource Allocation**
```yaml
# PostgreSQL
limits:
  cpus: '4.0'
  memory: 6G
reservations:
  cpus: '2.0'
  memory: 3G

# Redis
limits:
  memory: 2G
reservations:
  memory: 1G
```
- **✅ Good**: Proper memory limits set for core services
- **⚠️ Missing**: Memory limits for application services (APIs)

## 📊 Memory Monitoring & Alerting Issues

### 1. **Prometheus Metrics** (Graph Visualization API)
- **✅ Good**: Basic metrics collection implemented
- **⚠️ Missing**: Memory-specific metrics:
  - Database connection pool usage
  - Redis memory utilization
  - WebSocket connection count by room
  - Cache hit/miss ratios by endpoint

### 2. **Health Checks**
- **⚠️ Insufficient**: Health checks test connectivity but not memory usage
- **Missing**: Memory pressure detection in health endpoints

## 🔧 Recommended Memory Leak Fixes

### **Immediate Actions (High Priority)**

1. **Add Connection Pool Monitoring**:
   ```python
   # Add to Graph Visualization API
   POOL_CONNECTIONS = Gauge('db_pool_connections_active', 'Active DB connections')
   POOL_CONNECTIONS_MAX = Gauge('db_pool_connections_max', 'Max DB connections')

   async def update_pool_metrics():
       POOL_CONNECTIONS.set(engine.pool.checkedout())
       POOL_CONNECTIONS_MAX.set(engine.pool.size() + engine.pool.overflow())
   ```

2. **WebSocket Connection Limits**:
   ```python
   class ConnectionManager:
       def __init__(self, max_connections_per_room=100, max_total_connections=1000):
           self.max_connections_per_room = max_connections_per_room
           self.max_total_connections = max_total_connections
           # Add connection limiting logic
   ```

3. **Periodic Cleanup Tasks**:
   ```python
   @app.on_event("startup")
   async def start_cleanup_tasks():
       asyncio.create_task(cleanup_stale_connections())
       asyncio.create_task(cleanup_expired_cache())
   ```

### **Medium Priority**

4. **Database Query Optimization**:
   - Add query result size limits
   - Implement streaming for large datasets
   - Add query timeout enforcement

5. **Cache Optimization**:
   - Implement cache warming strategies
   - Add cache compression for large objects
   - Monitor cache memory usage per endpoint

### **Long-term Improvements**

6. **Circuit Breaker Enhancement**:
   - Add memory pressure detection
   - Implement graceful degradation
   - Add adaptive timeout adjustment

7. **Container Memory Management**:
   - Add memory limits to all service containers
   - Implement memory usage alerting
   - Add automated container restart on memory pressure

## 📈 Memory Monitoring Dashboard

### **Key Metrics to Track**
1. **Database Connections**: Active/Max pool connections per service
2. **Redis Memory**: Used memory, keyspace size, connection count
3. **WebSocket Connections**: Active connections per room, total connections
4. **API Memory**: Heap usage, garbage collection frequency
5. **Container Memory**: RSS, virtual memory, swap usage

### **Alerting Thresholds**
- DB connection pool >80% utilization
- Redis memory >85% of maxmemory
- WebSocket connections >500 per room
- Container memory >80% of limit

## ✅ Positive Findings

1. **Redis Configuration**: Proper LRU eviction and memory limits
2. **Database Health Checks**: Connection validation implemented
3. **Error Handling**: Graceful fallbacks in most endpoints
4. **Resource Limits**: Core services have memory constraints
5. **Connection Cleanup**: Partial cleanup logic exists for WebSockets

## 🎯 Implementation Priority

### **Week 1: Critical Fixes**
- [ ] Fix Redis connection pooling
- [ ] Add WebSocket connection limits
- [ ] Implement database connection monitoring

### **Week 2: Monitoring & Alerting**
- [ ] Add memory-specific Prometheus metrics
- [ ] Create Grafana dashboard for memory monitoring
- [ ] Set up memory pressure alerts

### **Week 3: Optimization**
- [ ] Optimize database queries
- [ ] Implement cache size management
- [ ] Add periodic cleanup tasks

This analysis identifies several critical memory leak vectors that should be addressed to ensure stable long-term operation of the SongNodes stack.