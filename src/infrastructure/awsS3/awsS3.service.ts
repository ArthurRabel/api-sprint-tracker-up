import { Readable } from 'stream';

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AwsS3Service {
  private client: S3Client;

  constructor(private configService: ConfigService) {
    this.client = new S3Client({
      region: this.configService.get<string>('S3_REGION') || 'us-east-1',
      endpoint: this.configService.get<string>('S3_ENDPOINT'),
      credentials: {
        accessKeyId: this.configService.get<string>('S3_ACCESS_KEY_ID') || '',
        secretAccessKey: this.configService.get<string>('S3_SECRET_ACCESS_KEY') || '',
      },
      forcePathStyle: true,
    });
  }

  async uploadFile(bucket: string, key: string, fileStream: Readable, mimeType: string) {
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: fileStream,
        ContentType: mimeType,
      },
    });

    return upload.done();
  }

  async getFileStream(bucket: string, key: string) {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await this.client.send(command);
    return response.Body as Readable;
  }
}
