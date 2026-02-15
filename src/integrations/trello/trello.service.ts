import { Readable } from 'stream';

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import { AwsS3Service } from '@/infrastructure/awsS3/awsS3.service';

@Injectable()
export class TrelloService {
  constructor(
    private readonly AwsS3Service: AwsS3Service,
    private readonly configService: ConfigService,
    @InjectQueue('import-queue') private importQueue: Queue,
  ) {}
  async importFromTrello(userId: string, boardId: string, file: Express.Multer.File) {
    const fileKey = `imports/boards/${boardId}/${Date.now()}-${file.originalname}`;
    const fileStream = Readable.from(file.buffer);
    const bucket = this.configService.get<string>('S3_BUCKET_NAME') || 'default-bucket';

    await this.AwsS3Service.uploadFile(bucket, fileKey, fileStream, file.mimetype);

    await this.importQueue.add('process-json-job', {
      fileKey: fileKey,
      boardId: boardId,
      userId: userId,
    });
  }
}
