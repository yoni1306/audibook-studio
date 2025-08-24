# Startup Logic Module

This module manages startup logic that runs when the API service initializes. It provides a structured way to execute one-time setup tasks, data migrations, and system initialization.

## Structure

```
startup/
├── base/                           # Base classes and interfaces
│   ├── startup-logic.base.ts      # Abstract base class for all startup logic
│   └── startup-logic.base.spec.ts # Tests for the base class
├── logic/                          # Individual startup logic implementations
│   ├── audio-timestamp-backfill.startup.ts      # Backfill audio timestamps
│   ├── audio-timestamp-backfill.startup.spec.ts # Tests
│   ├── tts-model-corrections-backfill.startup.ts # Backfill TTS model corrections
│   ├── tts-model-default.startup.ts              # Set default TTS models
│   └── tts-model-default.startup.spec.ts         # Tests
├── startup.service.ts              # Main service that orchestrates startup logic
├── startup.service.spec.ts         # Tests for the service
├── startup.module.ts               # NestJS module definition
├── startup.module.spec.ts          # Tests for the module
├── startup.integration.spec.ts     # Integration tests
└── index.ts                        # Public API exports
```

## Usage

### Creating New Startup Logic

1. Create a new class in the `logic/` directory that extends `StartupLogicBase`
2. Implement the required abstract methods:
   - `getName()`: Return a descriptive name for the startup logic
   - `shouldRun()`: Return whether this logic should execute
   - `execute()`: Implement the actual startup logic
3. Add the new class to the `StartupService` constructor
4. Export it from `index.ts` if needed externally

### Example

```typescript
import { Injectable } from '@nestjs/common';
import { StartupLogicBase } from '../base/startup-logic.base';

@Injectable()
export class MyStartupLogic extends StartupLogicBase {
  getName(): string {
    return 'My Custom Startup Logic';
  }

  async shouldRun(): Promise<boolean> {
    // Check if this logic should run
    return true;
  }

  async execute(): Promise<void> {
    // Implement your startup logic here
    this.logger.log('Executing my startup logic...');
  }
}
```

## Features

- **Conditional Execution**: Each startup logic can decide whether it should run
- **Error Handling**: Automatic error handling with proper logging
- **Performance Monitoring**: Execution time tracking
- **Dependency Injection**: Full NestJS DI support
- **Testing**: Comprehensive test coverage with mocking support

## Testing

Run startup logic tests:
```bash
npm test -- --testPathPattern=startup
```

Run integration tests:
```bash
npm test -- startup.integration.spec.ts
```
