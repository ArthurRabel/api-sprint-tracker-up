import { StorageService } from '@/storage/storage.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Readable } from 'stream';

@Injectable()
export class ImportsService {
    constructor(
        private readonly storageService: StorageService,
        private readonly configService: ConfigService,
        @InjectQueue('import-queue') private importQueue: Queue,
    ) { }
    async importFromTrello(userId: string, boardId: string, file: Express.Multer.File) {
        const fileKey = `imports/boards/${boardId}/${Date.now()}-${file.originalname}`;
        const fileStream = Readable.from(file.buffer);
        const bucket = this.configService.get<string>('S3_BUCKET_NAME') || 'default-bucket';

        await this.storageService.uploadFile(
            bucket,
            fileKey,
            fileStream,
            file.mimetype
        );

        await this.importQueue.add('process-json-job', {
            fileKey: fileKey,
            boardId: boardId,
            userId: userId,
        });
    }
}
