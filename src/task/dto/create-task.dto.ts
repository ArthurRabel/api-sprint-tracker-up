import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString } from 'class-validator';

import { TaskStatus } from '@/common/enums/task-status.enum';

export class CreateTaskDto {
  @ApiProperty({
    description: 'ID of the list to which the task belongs',
    example: '1234567890abcdef12345678',
  })
  @IsString()
  listId: string;

  @ApiProperty({
    description: 'ID of external system (e.g., Trello)',
    example: 'cardId123',
    required: false,
  })
  @IsString()
  @IsOptional()
  externalId?: string;

  @ApiProperty({
    description: 'Task title',
    example: 'Implement authentication functionality',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Task description',
    example: 'Implement authentication functionality with JWT',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Task status',
    example: 'TODO',
  })
  @IsString()
  status: TaskStatus;

  @ApiProperty({
    description: 'Task creation date',
    example: '2023-10-01T12:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dueDate?: Date;

  @ApiProperty({
    description: 'ID of the user responsible for the task',
    example: '1234567890abcdef12345678',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  assignedToId?: string | null;

  @ApiProperty({
    description: 'Indicates if the task is archived',
    example: false,
    required: false,
  })
  @IsOptional()
  isArchived?: boolean;
}
