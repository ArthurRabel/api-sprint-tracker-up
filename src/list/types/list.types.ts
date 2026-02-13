import { Status } from '@/common/enums/task-status.enum';

export interface List {
  id: string;
  externalId: string | null;
  boardId: string;
  title: string;
  position: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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

export interface ListWithTasks extends List {
  tasks: Task[];
}

export interface ListMapping {
  id: string;
  externalId: string | null;
}
