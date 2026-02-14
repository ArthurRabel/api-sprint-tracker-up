import { getPrismaClient } from './database.helper';

export interface TestList {
  id: string;
  boardId: string;
  title: string;
  position: number;
  isArchived: boolean;
}

export async function createTestList(
  boardId: string,
  overrides?: Partial<TestList>,
): Promise<TestList> {
  const prisma = getPrismaClient();
  const timestamp = Date.now();

  const defaultList = {
    boardId,
    title: `Test List ${timestamp}`,
    position: 1,
    isArchived: false,
    ...overrides,
  };

  const list = await prisma.list.create({
    data: defaultList,
  });

  return list as TestList;
}
