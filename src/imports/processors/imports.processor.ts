import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { StorageService } from '@/storage/storage.service';

import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { pick } from 'stream-json/filters/Pick';
import { chain } from 'stream-chain';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { Logger } from '@nestjs/common';
import { ListService } from '@/list/list.service';
import { CreateListDto } from '@/list/dto/create-list.dto';
import { CreateTaskDto } from '@/task/dto/create-task.dto';
import { TaskStatus } from '@/common/enums/task-status.enum';
import { TaskService } from '@/task/task.service';

interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  idList: string;
  closed: boolean;
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
    return new Promise((resolve, reject) => {
      let batch: CreateListDto[] = [];
      
      const pipeline = chain([
        inputStream,
        parser(),
        pick({ filter: 'lists' }), 
        streamArray(),
      ]);

      pipeline.on('data', async (data) => {
        const list: CreateListDto = {
          boardId: boardId,
          externalId: data.value.id as string,
          title: data.value.name as string,
          isArchived: data.value.closed as boolean,
        };
        
        batch.push(list);

        if (batch.length >= 100) {
          pipeline.pause();
          await this.listService.createMultipleSameBoard(batch);
          batch = [];
          pipeline.resume();
        }
      });

      pipeline.on('end', async () => {
        if (batch.length > 0) {
          await this.listService.createMultipleSameBoard(batch);
        } 
        this.logger.log(`[Worker] All lists processed successfully`);
        resolve(true);
      });
      
      pipeline.on('error', (error) => {
        this.logger.error(`[Worker] Error processing lists: ${error.message}`);
        reject(error);
      });
    });
  }

  private async buildListIdMap(boardId: string): Promise<Map<string, string>> {
    const lists = await this.listService.findListsForMapping(boardId); 
    
    const map = new Map<string, string>();
    lists.forEach(list => {
      if (list.externalId) {
        map.set(list.externalId, list.id);
      }
    });
    return map;
  }
    
  private async processTasks(inputStream: Readable, boardId: string, userId: string) {
    return new Promise(async (resolve, reject) => {
      this.logger.log(`[Worker] Building list ID map...`);
      const listIdMap = await this.buildListIdMap(boardId);
      this.logger.log(`[Worker] List ID map built with ${listIdMap.size} lists`);
      
      const tasksByList = new Map<string, CreateTaskDto[]>();

      const pipeline = chain([
        inputStream,
        parser(),
        pick({ filter: 'cards' }),
        streamArray(),
      ]);

      pipeline.on('data', async (data) => {
        const mappedListId = listIdMap.get(data.value.idList as string);
        if (!mappedListId) {
          return;
        }

        const task: CreateTaskDto = {
          listId: mappedListId,
          externalId: data.value.id as string,
          title: data.value.name as string,
          status: data.value.due ? TaskStatus.TODO : TaskStatus.DONE,
          description: data.value.desc as string,
          isArchived: data.value.closed as boolean,
        };

        if (!tasksByList.has(mappedListId)) {
          tasksByList.set(mappedListId, []);
        }
        tasksByList.get(mappedListId)!.push(task);

        for (const [listId, tasks] of tasksByList.entries()) {
          if (tasks.length >= 100) {
            pipeline.pause();
            await this.taskService.createMultipleSameList(userId, listId, tasks);
            tasksByList.delete(listId);
            pipeline.resume();
            break;
          }
        }
      });

      pipeline.on('end', async () => {
        for (const [listId, tasks] of tasksByList.entries()) {
          if (tasks.length > 0) {
            await this.taskService.createMultipleSameList(userId, listId, tasks);
          }
        }
        this.logger.log(`[Worker] All tasks processed successfully`);
        resolve(true);
      });

      pipeline.on('error', (error) => {
        this.logger.error(`[Worker] Error processing tasks: ${error.message}`);
        reject(error);
      });
    });
  }
}