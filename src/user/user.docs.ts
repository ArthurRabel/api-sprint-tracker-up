import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiNotFoundResponse,
  ApiConsumes,
  ApiBody,
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

export function UploadAvatarDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Upload profile picture',
      description:
        'Uploads an image file as the authenticated user profile picture. Stores the file in AWS S3 and saves the path in the database.',
    }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['file'],
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description: 'Image file (jpeg, png, webp)',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Avatar uploaded successfully',
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'No file provided or invalid file type',
    }),
  );
}
