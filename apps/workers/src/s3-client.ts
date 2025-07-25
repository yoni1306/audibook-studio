import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = new Logger('S3Client');

const s3Client = new S3Client({
  region: process.env['AWS_REGION'] || 'eu-central-1',
  credentials: {
    accessKeyId: process.env['AWS_ACCESS_KEY_ID'] || 'test-access-key',
    secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] || 'test-secret-key',
  },
  ...(process.env['S3_ENDPOINT'] && {
    endpoint: process.env['S3_ENDPOINT'],
    forcePathStyle: true,
  }),
});

export async function downloadFromS3(s3Key: string): Promise<string> {
  try {
    logger.log(`Downloading ${s3Key} from S3`);

    const command = new GetObjectCommand({
      Bucket: process.env['S3_BUCKET_NAME'] || 'audibook-storage',
      Key: s3Key,
    });

    const response = await s3Client.send(command);
    const tempPath = path.join('/tmp', path.basename(s3Key));

    // Save to temp file
    const data = await response.Body?.transformToByteArray();
    if (!data) throw new Error('No data received from S3');

    await fs.writeFile(tempPath, data);
    logger.log(`Downloaded to ${tempPath}`);

    return tempPath;
  } catch (error) {
    logger.error(`Failed to download from S3: ${error}`);
    throw error;
  }
}

export async function uploadToS3(
  localPath: string,
  s3Key: string,
  contentType = 'audio/mpeg'
): Promise<void> {
  try {
    logger.log(`Uploading ${localPath} to S3 as ${s3Key}`);

    const fileContent = await fs.readFile(localPath);

    const command = new PutObjectCommand({
      Bucket: process.env['S3_BUCKET_NAME'] || 'audibook-storage',
      Key: s3Key,
      Body: fileContent,
      ContentType: contentType,
    });

    await s3Client.send(command);
    logger.log(`Successfully uploaded to S3: ${s3Key}`);
  } catch (error) {
    logger.error(`Failed to upload to S3: ${error}`);
    throw error;
  }
}

export async function deleteFromS3(s3Key: string): Promise<void> {
  try {
    logger.log(`Deleting ${s3Key} from S3`);

    const command = new DeleteObjectCommand({
      Bucket: process.env['S3_BUCKET_NAME'] || 'audibook-storage',
      Key: s3Key,
    });

    await s3Client.send(command);
    logger.log(`Successfully deleted from S3: ${s3Key}`);
  } catch (error) {
    logger.error(`Failed to delete from S3: ${error}`);
    throw error;
  }
}

export async function deleteOldAudioFiles(bookId: string, paragraphId: string): Promise<void> {
  try {
    logger.log(`Cleaning up old audio files for paragraph ${paragraphId}`);

    const prefix = `audio/${bookId}/${paragraphId}_`;
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env['S3_BUCKET_NAME'] || 'audibook-storage',
      Prefix: prefix,
    });

    const response = await s3Client.send(listCommand);
    if (response.Contents && response.Contents.length > 0) {
      logger.log(`Found ${response.Contents.length} old audio files to delete`);
      
      for (const object of response.Contents) {
        if (object.Key) {
          await deleteFromS3(object.Key);
        }
      }
    } else {
      logger.log('No old audio files found to delete');
    }
  } catch (error) {
    logger.error(`Failed to cleanup old audio files: ${error}`);
    // Don't throw error here - cleanup failure shouldn't stop audio generation
  }
}
