import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

export function GetUserDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get user',
      description: 'Returns the authenticated user information.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'User loaded successfully',
    }),
    ApiNotFoundResponse({ description: 'User not found' }),
  );
}

export function UpdateUserDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update user',
      description: 'Updates the authenticated user information.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'User updated successfully',
    }),
    ApiNotFoundResponse({ description: 'User not found' }),
  );
}

export function DeleteAccountDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete user account',
      description: 'Deletes the authenticated user account.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Account deleted successfully',
    }),
    ApiNotFoundResponse({ description: 'User not found' }),
  );
}

export function GetNotificationsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get user notifications',
      description: 'Returns the authenticated user notifications.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Notifications loaded successfully',
    }),
    ApiNotFoundResponse({ description: 'User not found' }),
  );
}
