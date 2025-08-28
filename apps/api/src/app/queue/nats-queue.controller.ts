import { Controller, Post, Get, Body, Param, Logger, InternalServerErrorException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { NatsQueueService } from './nats-queue.service';

@Controller('queue')
export class NatsQueueController {
  private readonly logger = new Logger(NatsQueueController.name);

  constructor(private natsQueueService: NatsQueueService) {}

  @Post('parse-epub')
  @ApiOperation({ summary: 'Parse EPUB file', description: 'Add EPUB parsing job to the queue' })
  @ApiResponse({ status: 200, description: 'EPUB parsing job added successfully' })
  @ApiBody({
    description: 'EPUB parsing job data',
    schema: {
      type: 'object',
      properties: {
        bookId: { type: 'string', description: 'Book ID' },
        s3Key: { type: 'string', description: 'S3 key for the EPUB file' }
      },
      required: ['bookId', 's3Key']
    }
  })
  async parseEpub(@Body() body: { bookId: string; s3Key: string }) {
    try {
      const result = await this.natsQueueService.addEpubParsingJob(body);
      this.logger.log(`📚 EPUB parsing job added: ${result.jobId}`);
      return result;
    } catch (error) {
      this.logger.error('❌ Failed to add EPUB parsing job', error);
      throw new InternalServerErrorException('Failed to add EPUB parsing job');
    }
  }

  @Post('generate-audio')
  @ApiOperation({ summary: 'Generate audio', description: 'Add audio generation job to the queue' })
  @ApiResponse({ status: 200, description: 'Audio generation job added successfully' })
  @ApiBody({
    description: 'Audio generation job data',
    schema: {
      type: 'object',
      properties: {
        paragraphId: { type: 'string', description: 'Paragraph ID' },
        bookId: { type: 'string', description: 'Book ID' },
        content: { type: 'string', description: 'Text content to convert to audio' }
      },
      required: ['paragraphId', 'bookId', 'content']
    }
  })
  async generateAudio(@Body() body: { paragraphId: string; bookId: string; content: string }) {
    try {
      const result = await this.natsQueueService.addAudioGenerationJob(body);
      this.logger.log(`🔊 Audio generation job added: ${result.jobId}`);
      return result;
    } catch (error) {
      this.logger.error('❌ Failed to add audio generation job', error);
      throw new InternalServerErrorException('Failed to add audio generation job');
    }
  }

  @Post('combine-page-audio')
  @ApiOperation({ summary: 'Combine page audio', description: 'Add page audio combination job to the queue' })
  @ApiResponse({ status: 200, description: 'Page audio combination job added successfully' })
  @ApiBody({
    description: 'Page audio combination job data',
    schema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID' },
        bookId: { type: 'string', description: 'Book ID' },
        audioFileKeys: { type: 'array', items: { type: 'string' }, description: 'Array of audio file S3 keys' }
      },
      required: ['pageId', 'bookId', 'audioFileKeys']
    }
  })
  async combinePageAudio(@Body() body: { pageId: string; bookId: string; audioFileKeys: string[] }) {
    try {
      const result = await this.natsQueueService.addPageAudioCombinationJob(body);
      this.logger.log(`🎵 Page audio combination job added: ${result.jobId}`);
      return result;
    } catch (error) {
      this.logger.error('❌ Failed to add page audio combination job', error);
      throw new InternalServerErrorException('Failed to add page audio combination job');
    }
  }

  @Post('add-diacritics')
  @ApiOperation({ summary: 'Add Hebrew diacritics', description: 'Add diacritics processing job to the queue' })
  @ApiResponse({ status: 200, description: 'Diacritics processing job added successfully' })
  @ApiBody({
    description: 'Diacritics processing job data',
    schema: {
      type: 'object',
      properties: {
        bookId: { type: 'string', description: 'Book ID' },
        paragraphIds: { type: 'array', items: { type: 'string' }, description: 'Optional array of paragraph IDs to process' }
      },
      required: ['bookId']
    }
  })
  async addDiacritics(@Body() body: { bookId: string; paragraphIds?: string[] }) {
    try {
      const result = await this.natsQueueService.addDiacriticsProcessingJob(body);
      this.logger.log(`🔤 Diacritics processing job added: ${result.jobId}`);
      return result;
    } catch (error) {
      this.logger.error('❌ Failed to add diacritics processing job', error);
      throw new InternalServerErrorException('Failed to add diacritics processing job');
    }
  }

  @Get('status')
  @ApiOperation({ summary: 'Get queue status', description: 'Get current queue status and statistics' })
  @ApiResponse({ status: 200, description: 'Queue status retrieved successfully' })
  async getQueueStatus() {
    try {
      const status = await this.natsQueueService.getQueueStatus();
      return status;
    } catch (error) {
      this.logger.error('❌ Failed to get queue status', error);
      throw new InternalServerErrorException('Failed to get queue status');
    }
  }

  @Get('jobs/:status')
  @ApiOperation({ summary: 'Get jobs by status', description: 'Get jobs filtered by status' })
  @ApiResponse({ status: 200, description: 'Jobs retrieved successfully' })
  @ApiParam({ name: 'status', description: 'Job status to filter by' })
  async getJobsByStatus(@Param('status') status: string) {
    try {
      const jobs = await this.natsQueueService.getJobsByStatus(status);
      return jobs;
    } catch (error) {
      this.logger.error(`❌ Failed to get jobs by status: ${status}`, error);
      throw new InternalServerErrorException(`Failed to get jobs by status: ${status}`);
    }
  }

  @Post('clean/:status')
  @ApiOperation({ summary: 'Clean jobs', description: 'Clean completed or failed jobs' })
  @ApiResponse({ status: 200, description: 'Jobs cleaned successfully' })
  @ApiParam({ name: 'status', description: 'Status of jobs to clean (completed or failed)' })
  async cleanJobs(@Param('status') status: 'completed' | 'failed') {
    try {
      const result = await this.natsQueueService.cleanJobs(status);
      this.logger.log(`🧹 Cleaned ${status} jobs`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Failed to clean ${status} jobs`, error);
      throw new InternalServerErrorException(`Failed to clean ${status} jobs`);
    }
  }
}
