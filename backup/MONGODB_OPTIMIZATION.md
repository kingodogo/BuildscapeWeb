# MongoDB Performance Optimization Guide

This document explains the optimizations implemented to improve MongoDB query performance from 3000ms+ to much faster response times.

## Optimizations Implemented

### 1. **Connection Pool Optimization** (`api/db.ts`)
   - **Increased `maxPoolSize`**: From 1 to 10 connections
     - Allows multiple concurrent queries
     - Reduces connection wait time
   - **Added `minPoolSize`**: Set to 2
     - Keeps connections alive for faster response
     - Reduces connection establishment overhead
   - **Reduced Timeouts**:
     - `serverSelectionTimeoutMS`: 20s → 5s
     - `connectTimeoutMS`: 20s → 10s
     - `socketTimeoutMS`: 45s → 30s
   - **Added Connection Health Monitoring**:
     - `maxIdleTimeMS`: 30s (closes idle connections)
     - `heartbeatFrequencyMS`: 10s (checks connection health)

### 2. **Parallel Query Execution** (`api/data.ts`)
   - **Before**: Queries executed sequentially (one after another)
   - **After**: All queries execute in parallel using `Promise.all()`
   - **Impact**: If each query takes 500ms, sequential = 2000ms, parallel = ~500ms

### 3. **In-Memory Caching** (`api/cache.ts`)
   - **Simple TTL-based cache** for frequently accessed data
   - **Cache Duration**: 30 seconds (configurable)
   - **Automatic Cleanup**: Expired entries removed every minute
   - **Cache Invalidation**: Automatically cleared on write/delete operations
   - **Impact**: Cached requests return in <10ms instead of 3000ms+

## Expected Performance Improvements

| Scenario | Before | After | Improvement |
|----------|--------|-------|-------------|
| First Request (Cold) | ~3000ms | ~500-800ms | 4-6x faster |
| Cached Request | ~3000ms | <10ms | 300x faster |
| Concurrent Requests | Queued (slow) | Parallel (fast) | 4x faster |

## How It Works

### Connection Pooling
```
Before: [Request] → [Wait for connection] → [Query] → [Close] → [Next request waits]
After:  [Request] → [Use existing connection] → [Query] → [Keep connection] → [Next request uses pool]
```

### Parallel Queries
```
Before:
Query 1 (500ms) → Query 2 (500ms) → Query 3 (500ms) → Query 4 (500ms) = 2000ms total

After:
Query 1 (500ms) ┐
Query 2 (500ms) ├─ All run simultaneously = ~500ms total
Query 3 (500ms) ┘
Query 4 (500ms) ┘
```

### Caching
```
Request 1: Database query (500ms) → Cache result
Request 2: Cache hit (<10ms) ← No database query!
Request 3: Cache hit (<10ms) ← No database query!
... (after 30 seconds)
Request N: Cache expired → Database query (500ms) → Cache result
```

## Database Indexes (Recommended)

To further improve performance, create indexes on frequently queried fields:

```javascript
// In MongoDB Atlas or MongoDB Shell
db.reports.createIndex({ timestamp: -1 });
db.suggestions.createIndex({ timestamp: -1 });
db.changelogs.createIndex({ fileDate: -1 });
db.config.createIndex({ id: 1 });
db.wiki_features.createIndex({ categories: 1, title: 1 });
db.redeem_codes.createIndex({ code: 1 });
db.user_rewards.createIndex({ userId: 1 });
```

## Monitoring Performance

You can monitor the improvements by:

1. **Browser DevTools**: Check Network tab for API response times
2. **Vercel Analytics**: View function execution times
3. **MongoDB Atlas**: Monitor query performance in the Performance Advisor

## Cache Configuration

To adjust cache duration, modify the TTL in `api/data.ts`:

```typescript
// Current: 30 seconds
cache.set(cacheKey, data, 30000);

// For longer cache (e.g., 5 minutes):
cache.set(cacheKey, data, 300000);

// For shorter cache (e.g., 10 seconds):
cache.set(cacheKey, data, 10000);
```

## Additional Optimization Tips

1. **Use Projections**: Only fetch fields you need
   ```typescript
   db.collection("reports").find({}, { projection: { title: 1, status: 1 } })
   ```

2. **Limit Results**: Use `.limit()` for large collections
   ```typescript
   db.collection("reports").find({}).limit(100)
   ```

3. **Use Aggregation Pipeline**: For complex queries
   ```typescript
   db.collection("reports").aggregate([...])
   ```

4. **Consider Pagination**: For large datasets
   ```typescript
   db.collection("reports").find({}).skip(page * limit).limit(limit)
   ```

## Troubleshooting

### Still Slow?
1. Check MongoDB Atlas cluster tier (free tier is slower)
2. Verify indexes are created
3. Check network latency to MongoDB Atlas
4. Review query patterns in MongoDB Atlas Performance Advisor

### Cache Not Working?
1. Ensure `api/cache.ts` is imported correctly
2. Check that cache invalidation is called on writes
3. Verify TTL is appropriate for your use case

### Connection Issues?
1. Verify `MONGODB_URI` is correct
2. Check MongoDB Atlas IP whitelist
3. Ensure connection pool settings are appropriate for your tier

## Next Steps

For even better performance, consider:
- **Redis Cache**: For distributed caching across multiple serverless functions
- **CDN**: For static assets
- **Database Read Replicas**: For read-heavy workloads
- **Query Optimization**: Analyze slow queries in MongoDB Atlas

