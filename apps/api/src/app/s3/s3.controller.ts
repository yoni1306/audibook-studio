import { Controller, Post, Body } from '@nestjs/common';
import { S3Service } from './s3.service';

@Controller('s3')
export class S3Controller {
  constructor(private s3Service: S3Service) {}

  @Post('presigned-upload')
  async getPresignedUploadUrl(
    @Body() body: { filename: string; contentType: string }
  ) {
    const { filename, contentType } = body;
    const key = `raw/${Date.now()}-${filename}`;
    
    const result = await this.s3Service.getPresignedUploadUrl(key, contentType);
    
    return {
      uploadUrl: result.url,
      key: result.key,
    };
  }
}