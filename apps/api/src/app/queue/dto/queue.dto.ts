import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsArray, IsObject } from 'class-validator';

export class JobDto {
  @ApiProperty({ description: 'Job ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Job name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Job data', type: 'object', additionalProperties: true })
  @IsObject()
  data: Record<string, unknown>;

  @ApiProperty({ description: 'Job options', type: 'object', additionalProperties: true, nullable: true })
  @IsOptional()
  @IsObject()
  opts?: Record<string, unknown>;

  @ApiProperty({ description: 'Job progress', nullable: true })
  @IsOptional()
  @IsNumber()
  progress?: number;

  @ApiProperty({ description: 'Job delay', nullable: true })
  @IsOptional()
  @IsNumber()
  delay?: number;

  @ApiProperty({ description: 'Job timestamp' })
  @IsString()
  timestamp: string;

  @ApiProperty({ description: 'Job attempts made' })
  @IsNumber()
  attemptsMade: number;

  @ApiProperty({ description: 'Job processed on', nullable: true })
  @IsOptional()
  @IsString()
  processedOn?: string;

  @ApiProperty({ description: 'Job finished on', nullable: true })
  @IsOptional()
  @IsString()
  finishedOn?: string;

  @ApiProperty({ description: 'Job failed reason', nullable: true })
  @IsOptional()
  @IsString()
  failedReason?: string;

  @ApiProperty({ description: 'Job stacktrace', type: [String], nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stacktrace?: string[];

  @ApiProperty({ description: 'Job return value', nullable: true })
  @IsOptional()
  returnvalue?: unknown;
}

export class GetJobsByStatusResponseDto {
  @ApiProperty({ description: 'List of jobs', type: [JobDto] })
  @IsArray()
  jobs: JobDto[];

  @ApiProperty({ description: 'Job status filter' })
  @IsString()
  status: string;

  @ApiProperty({ description: 'Total number of jobs' })
  @IsNumber()
  total: number;

  @ApiProperty({ description: 'Response timestamp' })
  @IsString()
  timestamp: string;
}
