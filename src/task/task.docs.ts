import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

export function CreateTaskDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Creates a new task',
      description:
        'Creates a new task for the authenticated user. Authorized for administrators and members.',
    }),
    ApiResponse({ status: 201, description: 'Task created successfully' }),
    ApiResponse({ status: 400, description: 'Error creating task' }),
    ApiResponse({ status: 401, description: 'User not authenticated' }),
    ApiResponse({ status: 403, description: 'Access denied' }),
  );
}

export function FindOneTaskDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Retrieves a specific task',
      description: 'Retrieves a specific task by taskId. Authorized for all users.',
    }),
    ApiResponse({ status: 200, description: 'Task found successfully' }),
    ApiResponse({ status: 400, description: 'Error fetching task' }),
    ApiResponse({ status: 401, description: 'User not authenticated' }),
    ApiResponse({ status: 403, description: 'Access denied' }),
  );
}

export function UpdateTaskDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Updates a task',
      description: 'Updates a specific task by taskId. Authorized for administrators and members.',
    }),
    ApiResponse({ status: 200, description: 'Task updated successfully' }),
    ApiResponse({ status: 400, description: 'Error updating task' }),
    ApiResponse({ status: 401, description: 'User not authenticated' }),
    ApiResponse({ status: 403, description: 'Access denied' }),
  );
}

export function UpdateTaskPositionDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Updates task position',
      description:
        'Updates the position of a specific task by taskId. Authorized for administrators and members.',
    }),
    ApiResponse({ status: 200, description: 'Task updated successfully' }),
    ApiResponse({ status: 400, description: 'Error updating task' }),
    ApiResponse({ status: 401, description: 'User not authenticated' }),
    ApiResponse({ status: 403, description: 'Access denied' }),
  );
}

export function RemoveTaskDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Removes a task',
      description: 'Removes a specific task by taskId. Authorized for administrators and members.',
    }),
    ApiResponse({ status: 200, description: 'Task removed successfully' }),
    ApiResponse({ status: 400, description: 'Error removing task' }),
    ApiResponse({ status: 401, description: 'User not authenticated' }),
    ApiResponse({ status: 403, description: 'Access denied' }),
  );
}

export function GetTodayOrOverdueTasksDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Retrieves overdue or due today tasks',
      description:
        'Retrieves all tasks that are overdue or due today for the authenticated user. Authorized for authenticated users.',
    }),
    ApiResponse({ status: 200, description: 'Tasks found successfully' }),
    ApiResponse({ status: 400, description: 'Error fetching tasks' }),
    ApiResponse({ status: 401, description: 'User not authenticated' }),
    ApiResponse({ status: 403, description: 'Access denied' }),
  );
}

export function MoveTaskDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Moves a task to another list',
      description:
        'Moves a specific task to a new list. Authorized for administrators and members.',
    }),
    ApiResponse({ status: 200, description: 'Task moved successfully' }),
    ApiResponse({ status: 400, description: 'Error moving task' }),
    ApiResponse({ status: 401, description: 'User not authenticated' }),
    ApiResponse({ status: 403, description: 'Access denied' }),
    ApiResponse({ status: 404, description: 'List not found' }),
    ApiResponse({ status: 404, description: 'Task not found' }),
  );
}
