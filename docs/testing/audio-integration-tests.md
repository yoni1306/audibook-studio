# Audio Integration Testing Best Practices

## 🚨 Issue: Integration Tests Failing with Generated Audio Files

### Problem
Integration tests for audio processing fail with various FFmpeg errors:
- Missing lavfi input format
- Missing MP3 codec support
- Invalid audio file formats
- Codec compatibility issues

### Root Cause
Generated or synthetic audio files often lack:
- Proper audio headers
- Valid codec information
- Correct file structure
- Real-world audio characteristics

### Solution
Use real, pre-existing audio files for integration tests:

```typescript
// ✅ Use real MP3 files as test fixtures
const testAudioFiles = {
  hello: path.join(__dirname, 'fixtures', 'hello.mp3'),
  world: path.join(__dirname, 'fixtures', 'world.mp3'),
};

// Test audio combination with real files
const result = await combineAudioFiles([
  testAudioFiles.hello,
  testAudioFiles.world
], outputPath);
```

### Test File Requirements
- **Format**: MP3 (matches production requirements)
- **Codec**: Use `libmp3lame` for encoding
- **Size**: Small files (few seconds) for fast tests
- **Quality**: Valid, well-formed audio files
- **Source**: Real recordings or properly encoded files

### FFmpeg Codec Alignment
Ensure test and production use same codec:

```typescript
// Both test and production should use libmp3lame
ffmpeg()
  .input(inputFile)
  .audioCodec('libmp3lame')  // Not just 'mp3'
  .output(outputFile)
```

### Test Structure
```
apps/workers/src/
├── page-audio-combination.integration.spec.ts
├── fixtures/
│   ├── hello.mp3    # Real MP3 file
│   ├── world.mp3    # Real MP3 file
│   └── README.md    # Document test file sources
```

### Integration Test Pattern
```typescript
describe('Audio Integration Tests', () => {
  it('should combine real MP3 files', async () => {
    // Use real files, not generated ones
    const inputFiles = [
      path.join(__dirname, 'fixtures', 'hello.mp3'),
      path.join(__dirname, 'fixtures', 'world.mp3'),
    ];
    
    const outputFile = path.join(tmpDir, 'combined.mp3');
    
    // Test actual system services, not mocked FFmpeg
    await audioService.combineFiles(inputFiles, outputFile);
    
    // Verify output file exists and is valid
    expect(fs.existsSync(outputFile)).toBe(true);
    
    // Verify audio properties if needed
    const stats = fs.statSync(outputFile);
    expect(stats.size).toBeGreaterThan(0);
  });
});
```

### Prevention Guidelines
- **Never generate audio on-the-fly** in integration tests
- **Use real audio files** that match production format
- **Test with actual system services** not mocked FFmpeg
- **Verify codec compatibility** between test and production
- **Keep test files small** but valid
- **Document test file sources** and requirements

### Environment Considerations
- **Local Development**: Ensure FFmpeg supports libmp3lame
- **CI/CD**: Use Docker images with full FFmpeg support
- **Production**: Match test environment codec support

---
**Status**: ✅ Implemented with real MP3 test files
**Date**: 2025-07-29
**Impact**: High - Prevents false test failures and ensures production compatibility
