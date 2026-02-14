import { Status } from '@/common/enums/task-status.enum';

export function mockCreateTaskDto(listId: string, overrides?: Record<string, unknown>) {
  const timestamp = Date.now();
  return {
    listId,
    title: `Test Task ${timestamp}`,
    status: Status.TODO,
    description: 'Test description',
    ...overrides,
  };
}

export function mockUpdateTaskDto(overrides?: Record<string, unknown>) {
  return {
    title: 'Updated Task Title',
    status: Status.IN_PROGRESS,
    ...overrides,
  };
}

export function mockUpdateTaskPositionDto(newPosition: number) {
  return {
    newPosition,
  };
}

export function mockMoveTaskDto(newListId: string, newPosition: number) {
  return {
    newListId,
    newPosition,
  };
}
