import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiQuery,
} from '@nestjs/swagger';

export function GetCompletedTasksSummaryDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Completed tasks summary',
      description: 'Gets a summary of completed tasks in a specific period, with optional filters.',
    }),
    ApiQuery({
      name: 'startDate',
      required: true,
      type: String,
      description: 'Start date of the period (ISO 8601 format)',
      example: '2025-01-01',
    }),
    ApiQuery({
      name: 'endDate',
      required: true,
      type: String,
      description: 'End date of the period (ISO 8601 format)',
      example: '2025-12-31',
    }),
    ApiQuery({
      name: 'userId',
      required: false,
      type: String,
      description: 'User UUID to filter tasks',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Completed tasks summary retrieved successfully',
    }),
    ApiBadRequestResponse({ description: 'Error fetching summary' }),
    ApiUnauthorizedResponse({ description: 'User not authenticated' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function GetBasicSummaryDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Basic tasks summary',
      description: 'Gets basic task statistics for a board: count and percentage by status.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Basic summary retrieved successfully',
    }),
    ApiUnauthorizedResponse({ description: 'User not authenticated' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}
