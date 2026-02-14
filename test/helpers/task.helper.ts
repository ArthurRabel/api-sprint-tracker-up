import { Status } from '@prisma/client';

import { getPrismaClient } from './database.helper';

export interface TestTask {
  id: string;
  listId: string;
  creatorId: string | null;
  title: string;
  description: string | null;
  status: Status;
  position: number;
  assignedToId: string | null;
  isArchived: boolean;
  dueDate: Date | null;
  completedAt: Date | null;
}

export async function createTestTask(
  listId: string,
  overrides?: Partial<TestTask>,
): Promise<TestTask> {
  const prisma = getPrismaClient();
  const timestamp = Date.now();

  // Get max position to append
  const lastTask = await prisma.task.findFirst({
    where: { listId },
    orderBy: { position: 'desc' },
  });
  const position =
    overrides?.position !== undefined ? overrides.position : (lastTask?.position ?? 0) + 1;

  const defaultTask = {
    listId,
    title: `Test Task ${timestamp}`,
    status: Status.TODO,
    isArchived: false,
    position,
    creatorId: overrides?.creatorId, // Add this
    ...overrides,
  };

  type CreateTaskData = Parameters<typeof prisma.task.create>[0]['data'];

  const task = await prisma.task.create({
    data: defaultTask as unknown as CreateTaskData,
  });

  return task as unknown as TestTask;
}
