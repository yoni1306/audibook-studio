import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { HeadObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get('S3_ENDPOINT');

    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
      ...(endpoint && {
        endpoint,
        forcePathStyle: true, // Required for MinIO
      }),
    });

    this.bucketName = this.configService.get(
      'S3_BUCKET_NAME',
      'audibook-storage'
    );
    this.initializeBucket();
  }

  private async initializeBucket() {
    try {
      await this.s3Client.send(
        new HeadBucketCommand({ Bucket: this.bucketName })
      );
      this.logger.log(`Bucket ${this.bucketName} exists`);
    } catch (error) {
      this.logger.log(`Creating bucket ${this.bucketName}`);
      try {
        await this.s3Client.send(
          new CreateBucketCommand({ Bucket: this.bucketName })
        );
        this.logger.log(`Bucket ${this.bucketName} created`);
      } catch (createError) {
        this.logger.error('Failed to create bucket', createError);
      }
    }
  }

  async getPresignedUploadUrl(key: string, contentType: string) {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600, // 1 hour
    });

    return { url, key };
  }

  async waitForFile(
    key: string,
    maxAttempts = 20,
    delayMs = 500
  ): Promise<boolean> {
    this.logger.log(`Waiting for file ${key} to be available in S3...`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.s3Client.send(
          new HeadObjectCommand({
            Bucket: this.bucketName,
            Key: key,
          })
        );
        this.logger.log(`File ${key} is available after ${attempt} attempts`);
        return true;
      } catch (error) {
        if (error.name === 'NotFound' && attempt < maxAttempts) {
          this.logger.debug(
            `Attempt ${attempt}/${maxAttempts}: File not yet available, waiting ${delayMs}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else if (attempt === maxAttempts) {
          this.logger.error(
            `File ${key} not available after ${maxAttempts} attempts`
          );
          return false;
        } else {
          throw error;
        }
      }
    }

    return false;
  }
}
