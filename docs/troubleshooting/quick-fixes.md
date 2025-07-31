# Quick Fixes for Common Issues

## 🚨 Production Emergency Fixes

### Export Jobs Failing - "Cannot find ffprobe"
**Symptom**: Worker jobs fail with FFmpeg errors
**Quick Fix**: 
```bash
# Add to apps/workers/Dockerfile
RUN apk add --no-cache ffmpeg

# Deploy workers
pnpm deploy:push:workers
```

### Redis Command Timeouts During Audio Processing
**Symptom**: Long audio jobs fail with timeout errors
**Quick Fix**:
```typescript
// apps/workers/src/main.ts
commandTimeout: 30000, // Increase from 10000 to 30000
```

### TypeScript Errors in API Client
**Symptom**: Type mismatch errors after API changes
**Quick Fix**:
```bash
# Regenerate API client types
pnpm generate:api-client

# Remove explicit return types, let TypeScript infer
getMethod: (id: string) => client.GET('/endpoint', ...)
```

## 🔧 Development Issues

### Integration Tests Failing with Audio Files
**Symptom**: FFmpeg errors in tests with generated audio
**Quick Fix**: Use real MP3 files in test fixtures

### UI Color Issues in Modals
**Symptom**: Overwhelming red/green colors
**Quick Fix**: Use subtle color variants (-50/-200)

### Button Styling Inconsistencies  
**Symptom**: Buttons don't match design system
**Quick Fix**: Always use `.btn` base class

## 📋 Deployment Checklist

Before deploying workers service:
- [ ] FFmpeg installed in Dockerfile
- [ ] Redis timeout set to 30s
- [ ] Integration tests pass with real audio files
- [ ] API client types are up-to-date

Before deploying API service:
- [ ] OpenAPI schema matches implementation
- [ ] Database migrations applied
- [ ] Environment variables configured

Before deploying web service:
- [ ] API client types regenerated
- [ ] Build passes without TypeScript errors
- [ ] UI components use design system classes

---
**Last Updated**: 2025-07-29
**Critical Path**: FFmpeg → Redis → Types → Deploy
