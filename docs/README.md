# Audibook Studio - Knowledge Base

This folder contains lessons learned, best practices, and troubleshooting guides for the Audibook Studio project.

## 📚 Documentation Structure

- **[deployment/](./deployment/)** - Deployment and infrastructure lessons
- **[development/](./development/)** - Development best practices and patterns
- **[testing/](./testing/)** - Testing strategies and common issues
- **[troubleshooting/](./troubleshooting/)** - Common issues and their solutions
- **[architecture/](./architecture/)** - System design decisions and patterns

## 🎯 Purpose

This knowledge base serves as:
- **Prevention Guide**: Avoid repeating past mistakes
- **Onboarding Resource**: Help new developers understand the system
- **Troubleshooting Reference**: Quick solutions to common problems
- **Decision Log**: Context behind architectural and technical decisions

## 🔍 Quick Reference

### Most Critical Lessons
1. **FFmpeg Installation**: Always include FFmpeg in worker Docker images
2. **Redis Timeouts**: Use 30s timeout for long-running audio jobs
3. **Type Safety**: Regenerate API client types after schema changes
4. **Testing**: Use real audio files for integration tests, not generated ones

### Emergency Fixes
- [Production FFmpeg Missing](./troubleshooting/ffmpeg-missing.md)
- [Redis Command Timeouts](./troubleshooting/redis-timeouts.md)
- [API Client Type Mismatches](./troubleshooting/api-client-types.md)

---

*This documentation is maintained as we learn and grow. Always update when encountering new issues or solutions.*
