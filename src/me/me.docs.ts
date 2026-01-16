import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

export function GetProfileDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get user profile',
      description: 'Returns the authenticated user profile information.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Profile loaded successfully',
    }),
    ApiNotFoundResponse({ description: 'Profile not found' }),
  );
}

export function UpdateProfileDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update user profile',
      description: 'Updates the authenticated user profile information.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Profile updated successfully',
    }),
    ApiNotFoundResponse({ description: 'Profile not found' }),
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
    ApiNotFoundResponse({ description: 'Profile not found' }),
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
    ApiNotFoundResponse({ description: 'Profile not found' }),
  );
}
