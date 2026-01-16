import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';

export function CreateListDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a new list',
      description:
        'Creates a new list for the authenticated user. Authorized for administrators and members.',
    }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'List created successfully',
    }),
    ApiBadRequestResponse({ description: 'Error creating list' }),
    ApiUnauthorizedResponse({ description: 'User not authenticated' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function FindAllListsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get all lists from a board',
      description:
        'Retrieves all lists from a specific board. Authorized for all board members.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Lists found successfully',
    }),
    ApiBadRequestResponse({ description: 'Error fetching lists' }),
    ApiUnauthorizedResponse({ description: 'User not authenticated' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function FindOneListDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get a specific list',
      description: 'Retrieves a specific list by listId. Authorized for all board members.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'List found successfully',
    }),
    ApiBadRequestResponse({ description: 'Error fetching list' }),
    ApiUnauthorizedResponse({ description: 'User not authenticated' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function UpdateListDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update a list',
      description:
        'Updates a specific list by listId. Authorized for administrators and members.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'List updated successfully',
    }),
    ApiBadRequestResponse({ description: 'Error updating list' }),
    ApiUnauthorizedResponse({ description: 'User not authenticated' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function UpdateListPositionDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update list position',
      description:
        'Updates the position of a specific list by listId. Authorized for administrators and members.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'List position updated successfully',
    }),
    ApiBadRequestResponse({ description: 'Error updating list position' }),
    ApiUnauthorizedResponse({ description: 'User not authenticated' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}

export function RemoveListDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Remove a list',
      description:
        'Removes a specific list by listId. Authorized for administrators and members.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'List removed successfully',
    }),
    ApiBadRequestResponse({ description: 'Error removing list' }),
    ApiUnauthorizedResponse({ description: 'User not authenticated' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
  );
}
