import { EventEmitter } from 'events';
import { Readable, Transform } from 'stream';

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import * as Chain from 'stream-chain';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { streamArray } from 'stream-json/streamers/StreamArray';

import { TaskStatus } from '@/common/enums/task-status.enum';
import { CreateListDto } from '@/list/dto/create-list.dto';
import { ListService } from '@/list/list.service';
import { StorageService } from '@/storage/storage.service';
import { CreateTaskDto } from '@/task/dto/create-task.dto';
import { TaskService } from '@/task/task.service';

interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
}

interface TrelloCard {
  id: string;
  idList: string;
  name: string;
  desc: string;
  due: string | null;
  closed: boolean;
}

interface StreamData<T> {
  value: T;
}

interface StreamPipeline extends EventEmitter {
  pause(): void;
  resume(): void;
}

interface ImportFileData {
  fileKey: string;
  boardId: string;
  userId: string;
}

interface ImportResult {
  status: 'completed' | 'failed';
}

@Processor('import-queue')
export class ImportsProcessor extends WorkerHost {
  private logger = new Logger('ImportsProcessor');
  private readonly isDebug: boolean;
  constructor(
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    private readonly listService: ListService,
    private readonly taskService: TaskService,
  ) {
    super();
    this.isDebug = this.configService.get<string>('DEBUG') === 'true';
  }

  async process(job: Job<ImportFileData, ImportResult, 'process-json-job'>): Promise<ImportResult> {
    const { fileKey, boardId, userId } = job.data;
    this.logger.log(`[Worker] Process, Trello JSON: ${fileKey}`);
    const bucket = this.configService.getOrThrow<string>('S3_BUCKET_NAME');

    this.logger.log(`[Worker] 1/2: Processing lists...`);

    const listStreamS3 = await this.storageService.getFileStream(bucket, fileKey);
    await this.processLists(listStreamS3, boardId);

    this.logger.log(`[Worker] 2/2: Processing tasks...`);

    const cardStreamS3 = await this.storageService.getFileStream(bucket, fileKey);
    await this.processTasks(cardStreamS3, boardId, userId);

    return { status: 'completed' };
  }

  private async processLists(inputStream: Readable, boardId: string) {
    return new Promise<boolean>((resolve, reject) => {
      let batch: CreateListDto[] = [];

      const chainElements = [inputStream, parser(), pick({ filter: 'lists' }), streamArray()];
      const pipeline = Chain.chain(chainElements) as unknown as StreamPipeline;

      const handleData = (data: StreamData<TrelloList>): void => {
        const list: CreateListDto = {
          boardId: boardId,
          externalId: data.value.id,
          title: data.value.name,
          isArchived: data.value.closed,
        };

        batch.push(list);

        if (batch.length >= 100) {
          pipeline.pause();
          const currentBatch = [...batch];
          batch = [];

          this.listService
            .createMultipleSameBoard(currentBatch)
            .then(() => {
              pipeline.resume();
            })
            .catch((error: Error) => {
              this.logger.error(`[Worker] Error creating lists: ${error.message}`);
              reject(new Error(`Error creating lists: ${error.message}`));
            });
        }
      };

      const handleEnd = (): void => {
        if (batch.length > 0) {
          this.listService
            .createMultipleSameBoard(batch)
            .then(() => {
              this.logger.log(`[Worker] All lists processed successfully`);
              resolve(true);
            })
            .catch((error: Error) => {
              this.logger.error(`[Worker] Error creating final lists: ${error.message}`);
              reject(new Error(`Error creating final lists: ${error.message}`));
            });
        } else {
          this.logger.log(`[Worker] All lists processed successfully`);
          resolve(true);
        }
      };

      const handleError = (error: Error): void => {
        this.logger.error(`[Worker] Error processing lists: ${error.message}`);
        reject(new Error(`Error processing lists: ${error.message}`));
      };

      pipeline.on('data', handleData);
      pipeline.on('end', handleEnd);
      pipeline.on('error', handleError);
    });
  }

  private async buildListIdMap(boardId: string): Promise<Map<string, string>> {
    const lists = await this.listService.findListsForMapping(boardId);

    const map = new Map<string, string>();
    lists.forEach((list) => {
      if (list.externalId) {
        map.set(list.externalId, list.id);
      }
    });
    return map;
  }

  private async processTasks(inputStream: Readable, boardId: string, userId: string) {
    const listIdMap = await this.buildListIdMap(boardId);
    this.logger.log(`[Worker] Building list ID map...`);
    this.logger.log(`[Worker] List ID map built with ${listIdMap.size} lists`);

    return new Promise<boolean>((resolve, reject) => {
      const tasksByList = new Map<string, CreateTaskDto[]>();

      const pipeline = Chain.chain([
        inputStream,
        parser(),
        pick({ filter: 'cards' }),
        streamArray(),
      ]) as unknown as Transform;

      const handleData = (data: StreamData<TrelloCard>): void => {
        const mappedListId = listIdMap.get(data.value.idList);
        if (!mappedListId) {
          return;
        }

        const task: CreateTaskDto = {
          listId: mappedListId,
          externalId: data.value.id,
          title: data.value.name,
          status: data.value.due ? TaskStatus.TODO : TaskStatus.DONE,
          description: data.value.desc,
          isArchived: data.value.closed,
        };

        if (!tasksByList.has(mappedListId)) {
          tasksByList.set(mappedListId, []);
        }
        tasksByList.get(mappedListId)!.push(task);

        for (const [listId, tasks] of tasksByList.entries()) {
          if (tasks.length >= 100) {
            pipeline.pause();
            const tasksToCreate = [...tasks];
            tasksByList.delete(listId);

            this.taskService
              .createMultipleSameList(userId, listId, tasksToCreate)
              .then(() => {
                pipeline.resume();
              })
              .catch((error: Error) => {
                this.logger.error(`[Worker] Error creating tasks: ${error.message}`);
                reject(new Error(`Error creating tasks: ${error.message}`));
              });
            break;
          }
        }
      };

      const handleEnd = (): void => {
        const promises: Promise<void>[] = [];

        for (const [listId, tasks] of tasksByList.entries()) {
          if (tasks.length > 0) {
            promises.push(
              this.taskService.createMultipleSameList(userId, listId, tasks).then(() => undefined),
            );
          }
        }

        if (promises.length > 0) {
          Promise.all(promises)
            .then(() => {
              this.logger.log(`[Worker] All tasks processed successfully`);
              resolve(true);
            })
            .catch((error: Error) => {
              this.logger.error(`[Worker] Error creating final tasks: ${error.message}`);
              reject(new Error(`Error creating final tasks: ${error.message}`));
            });
        } else {
          this.logger.log(`[Worker] All tasks processed successfully`);
          resolve(true);
        }
      };

      const handleError = (error: Error): void => {
        this.logger.error(`[Worker] Error processing tasks: ${error.message}`);
        reject(new Error(`Error processing tasks: ${error.message}`));
      };

      pipeline.on('data', handleData);
      pipeline.on('end', handleEnd);
      pipeline.on('error', handleError);
    });
  }
}
