import { Status } from '@/common/enums/task-status.enum';

export interface Task {
  id: string;
  externalId: string | null;
  listId: string;
  creatorId: string;
  assignedToId: string | null;
  title: string;
  description: string | null;
  position: number;
  status: Status;
  dueDate: Date | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface TaskWithListBoardId extends Task {
  list: {
    boardId: string;
  };
}

export interface Board {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface List {
  id: string;
  boardId: string;
  title: string;
  position: number;
}

export interface TaskOverdue extends Task {
  list: List & {
    board: Board;
  };
}
