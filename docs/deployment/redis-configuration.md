# Redis Configuration for Audio Processing

## 🚨 Issue: Redis Command Timeouts During Long Audio Jobs

### Problem
Workers fail during long-running audio processing jobs with:
```
Redis command timeout
```

### Root Cause
Default Redis `commandTimeout` of 10 seconds is insufficient for:
- Audio file combination operations
- Large audio file processing
- Complex FFmpeg operations
- Multiple paragraph audio merging

### Solution
Increase Redis `commandTimeout` to 30 seconds:

```typescript
// apps/workers/src/main.ts
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  commandTimeout: 30000, // 30 seconds instead of 10
};
```

### Configuration Details
- **Before**: 10,000ms (10 seconds)
- **After**: 30,000ms (30 seconds)
- **Applies to**: Both production and local development
- **Environment**: All Redis connections in workers service

### Why 30 Seconds?
- Audio processing can take 15-25 seconds for large files
- FFmpeg operations are CPU-intensive
- Multiple paragraph combination requires time
- Provides buffer for system load variations

### Implementation Locations
1. **Workers main.ts**: Primary Redis connection
2. **Queue configuration**: BullMQ Redis settings
3. **Local development**: Docker Redis setup
4. **Production**: Railway Redis configuration

### Testing
Verify timeout works with:
```bash
# Test long-running audio job
# Should complete without Redis timeout errors
```

### Prevention
- Monitor audio processing job durations
- Set timeouts based on 95th percentile processing times
- Consider breaking very large jobs into smaller chunks
- Implement job progress tracking for long operations

### Related Issues
- Export functionality failures
- Worker job processing errors
- BullMQ queue management problems

---
**Status**: ✅ Fixed in production
**Date**: 2025-07-29
**Impact**: High - Long audio jobs would fail randomly
