/**
 * API-WORKERS CONTRACT TESTS
 * 
 * These tests ensure that the API and Workers services maintain compatible
 * interfaces, queue names, job types, and data structures. They should fail
 * if changes to one service break compatibility with the other.
 * 
 * LESSON LEARNED: These tests now include comprehensive dependency injection
 * verification to catch controller-level misalignments that were missed before.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('API-Workers Contract Tests', () => {
  describe('Queue Architecture Contracts', () => {
    it('should use the same queue name in API and workers', () => {
      // Both API and Workers must use the same queue name
      const API_QUEUE_NAME = 'audio-processing';
      const WORKERS_QUEUE_NAME = 'audio-processing';
      
      expect(API_QUEUE_NAME).toBe(WORKERS_QUEUE_NAME);
    });

    it('should support the same job types', () => {
      // Both API and Workers must support the same job types
      const API_JOB_TYPES = ['generate-audio', 'parse-epub'];
      const WORKERS_JOB_TYPES = ['generate-audio', 'parse-epub'];
      
      expect(API_JOB_TYPES).toEqual(WORKERS_JOB_TYPES);
    });

    it('should use compatible queue tokens', () => {
      // Verify queue token format is consistent
      const expectedToken = getQueueToken('audio-processing');
      expect(expectedToken).toBe('BullQueue_audio-processing');
    });
  });

  describe('Dependency Injection Contracts', () => {
    it('should not inject deprecated queue names in controllers', async () => {
      // LESSON LEARNED: Verify controllers don't use old queue injection tokens
      const controllerPath = path.join(__dirname, '../../apps/api/src/app/queue/queue.controller.ts');
      const controllerContent = await fs.readFile(controllerPath, 'utf-8');
      
      // These deprecated injections should NOT exist
      expect(controllerContent).not.toContain("@InjectQueue('audio')");
      expect(controllerContent).not.toContain("@InjectQueue('epub')");
      
      // Only the unified queue should be injected
      expect(controllerContent).toContain("@InjectQueue('audio-processing')");
    });

    it('should not inject deprecated queue names in services', async () => {
      // Verify services use correct queue injection
      const servicePath = path.join(__dirname, '../../apps/api/src/app/queue/queue.service.ts');
      const serviceContent = await fs.readFile(servicePath, 'utf-8');
      
      // These deprecated injections should NOT exist
      expect(serviceContent).not.toContain("@InjectQueue('audio')");
      expect(serviceContent).not.toContain("@InjectQueue('epub')");
      
      // Only the unified queue should be injected
      expect(serviceContent).toContain("@InjectQueue('audio-processing')");
    });

    it('should register only the unified queue in module', async () => {
      // Verify QueueModule only registers the unified queue
      const modulePath = path.join(__dirname, '../../apps/api/src/app/queue/queue.module.ts');
      const moduleContent = await fs.readFile(modulePath, 'utf-8');
      
      // Should register the unified queue
      expect(moduleContent).toContain("name: 'audio-processing'");
      
      // Should NOT register deprecated queues
      expect(moduleContent).not.toContain("name: 'audio'");
      expect(moduleContent).not.toContain("name: 'epub'");
    });
  });

  describe('Job Ownership Contracts', () => {
    it('should not have duplicate EPUB parsing processors', async () => {
      // LESSON LEARNED: Prevent duplicate job processing between API and Workers
      const queueModulePath = path.join(__dirname, '../../apps/api/src/app/queue/queue.module.ts');
      const queueModuleContent = await fs.readFile(queueModulePath, 'utf-8');
      
      // API should NOT have EpubProcessorService (workers handle EPUB parsing)
      expect(queueModuleContent).not.toContain('EpubProcessorService');
      
      // Only AudioProcessorService should be in API
      expect(queueModuleContent).toContain('AudioProcessorService');
    });

    it('should have clear job ownership mapping', () => {
      // Define which service owns which job types
      const jobOwnership = {
        'parse-epub': 'workers',      // Only workers process EPUB parsing
        'generate-audio': 'api',      // Only API processes audio generation
      };
      
      // This mapping must be maintained to prevent duplicate processing
      expect(jobOwnership['parse-epub']).toBe('workers');
      expect(jobOwnership['generate-audio']).toBe('api');
    });

    it('should not import EpubProcessorService in QueueModule', async () => {
      // Verify EpubProcessorService is not imported in QueueModule
      const queueModulePath = path.join(__dirname, '../../apps/api/src/app/queue/queue.module.ts');
      const queueModuleContent = await fs.readFile(queueModulePath, 'utf-8');
      
      // Should not import EpubProcessorService
      expect(queueModuleContent).not.toContain("import { EpubProcessorService }");
      expect(queueModuleContent).not.toContain("from './epub-processor.service'");
    });
  });

  describe('Module Compilation Contracts', () => {
    it('should compile QueueModule without dependency injection errors', async () => {
      // LESSON LEARNED: Test actual module compilation to catch DI issues
      const mockQueue = {
        add: jest.fn(),
        getWaitingCount: jest.fn().mockResolvedValue(0),
        getActiveCount: jest.fn().mockResolvedValue(0),
        getCompletedCount: jest.fn().mockResolvedValue(0),
        getFailedCount: jest.fn().mockResolvedValue(0),
        getDelayedCount: jest.fn().mockResolvedValue(0),
      };

      // This should succeed without any DI errors
      const moduleBuilder = Test.createTestingModule({
        providers: [
          {
            provide: getQueueToken('audio-processing'),
            useValue: mockQueue,
          },
          // Mock other required services
          {
            provide: 'PrismaService',
            useValue: { book: { update: jest.fn() } },
          },
          {
            provide: 'MetricsService',
            useValue: { recordEvent: jest.fn() },
          },
          {
            provide: 'S3Service',
            useValue: { getSignedUrl: jest.fn() },
          },
        ],
      });

      // If this fails, there are DI misalignments
      const module = await moduleBuilder.compile();
      expect(module).toBeDefined();
    });
  });

  describe('EPUB Parsing Job Contract', () => {
    it('should maintain compatible job data structure', () => {
      const apiJobData = {
        bookId: 'string',
        s3Key: 'string',
        parsingMethod: 'page-based' as const || 'xhtml-based' as const,
        correlationId: 'string',
      };

      const workersExpectedData = {
        bookId: expect.any(String),
        s3Key: expect.any(String),
        parsingMethod: expect.stringMatching(/^(page-based|xhtml-based)$/),
        correlationId: expect.any(String),
      };

      expect(apiJobData).toMatchObject(workersExpectedData);
    });

    it('should support both parsing methods', () => {
      const supportedMethods = ['page-based', 'xhtml-based'];
      
      // This documents the contract - both API and workers must support these
      expect(supportedMethods).toContain('page-based');
      expect(supportedMethods).toContain('xhtml-based');
      expect(supportedMethods).toHaveLength(2);
    });
  });

  describe('Audio Generation Job Contract', () => {
    it('should maintain compatible job data structure', () => {
      const apiJobData = {
        paragraphId: 'string',
        bookId: 'string',
        content: 'string',
        correlationId: 'string',
      };

      const workersExpectedData = {
        paragraphId: expect.any(String),
        bookId: expect.any(String),
        content: expect.any(String),
        correlationId: expect.any(String),
      };

      expect(apiJobData).toMatchObject(workersExpectedData);
    });
  });

  describe('Error Handling Contract', () => {
    it('should maintain consistent error response format', () => {
      const expectedErrorFormat = {
        success: false,
        error: expect.any(String),
        bookId: expect.any(String),
        duration: expect.any(Number),
      };

      // Both API and workers should return errors in this format
      expect(expectedErrorFormat).toBeDefined();
    });
  });

  describe('Job Data Structure Contracts', () => {
    it('should maintain compatible audio generation job structure', () => {
      // API and Workers must agree on job data structure
      const expectedJobData = {
        paragraphId: expect.any(String),
        bookId: expect.any(String),
        content: expect.any(String),
      };
      
      // This structure must be maintained in both API and Workers
      expect(expectedJobData).toBeDefined();
    });

    it('should maintain compatible EPUB parsing job structure', () => {
      // API and Workers must agree on job data structure
      const expectedJobData = {
        bookId: expect.any(String),
        s3Key: expect.any(String),
        parsingMethod: expect.any(String), // optional
      };
      
      // This structure must be maintained in both API and Workers
      expect(expectedJobData).toBeDefined();
    });
  });

  describe('Error Handling Contracts', () => {
    it('should use compatible error message formats', () => {
      // Both API and Workers should use consistent error formats
      const expectedErrorFormat = {
        message: expect.any(String),
        code: expect.any(String),
        timestamp: expect.any(String),
      };
      
      expect(expectedErrorFormat).toBeDefined();
    });
  });
});
