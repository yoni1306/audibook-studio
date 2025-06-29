import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl } from 'class-validator';

export class PresignedUploadResponseDto {
  @ApiProperty({ description: 'Presigned upload URL' })
  @IsUrl()
  uploadUrl: string;

  @ApiProperty({ description: 'S3 key for the uploaded file' })
  @IsString()
  key: string;

  @ApiProperty({ description: 'ID of the created book' })
  @IsString()
  bookId: string;

  @ApiProperty({ description: 'Original filename' })
  @IsString()
  filename: string;

  @ApiProperty({ description: 'Response timestamp' })
  @IsString()
  timestamp: string;
}
