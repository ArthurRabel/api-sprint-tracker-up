import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';

export function CreateBoardDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a new board',
      description:
        'Creates a new board for the authenticated user. Authorized for authenticated users.',
    }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Board created successfully',
    }),
    ApiBadRequestResponse({ description: 'Error creating board' }),
    ApiUnauthorizedResponse({ description: 'User not authenticated' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
    ApiInternalServerErrorResponse({ description: 'Internal server error' }),
  );
}

export function FindAllBoardsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get all boards for authenticated user',
      description:
        'Retrieves all boards for the authenticated user. Authorized for authenticated users.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Boards found successfully',
    }),
    ApiBadRequestResponse({ description: 'Error fetching boards' }),
    ApiUnauthorizedResponse({ description: 'User not authenticated' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
    ApiInternalServerErrorResponse({ description: 'Internal server error' }),
  );
}

export function FindOneBoardDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get a specific board',
      description: 'Retrieves a specific board by ID. Authorized for all users.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Board found successfully',
    }),
    ApiBadRequestResponse({ description: 'Error fetching board' }),
    ApiUnauthorizedResponse({ description: 'User not authenticated' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
    ApiInternalServerErrorResponse({ description: 'Internal server error' }),
  );
}

export function UpdateBoardDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update a specific board',
      description:
        'Updates a specific board by ID. Authorized only for administrators.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Board updated successfully',
    }),
    ApiBadRequestResponse({ description: 'Error updating board' }),
    ApiUnauthorizedResponse({ description: 'User not authenticated' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
    ApiInternalServerErrorResponse({ description: 'Internal server error' }),
  );
}

export function RemoveBoardDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete a specific board',
      description:
        'Deletes a specific board by ID. Authorized only for administrators.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Board deleted successfully',
    }),
    ApiBadRequestResponse({ description: 'Error deleting board' }),
    ApiUnauthorizedResponse({ description: 'User not authenticated' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
    ApiInternalServerErrorResponse({ description: 'Internal server error' }),
  );
}

export function ListMembersDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List board members',
      description:
        'Returns all board members with basic user information. Authorized for all users.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Members listed successfully',
    }),
    ApiBadRequestResponse({ description: 'Error listing members' }),
    ApiUnauthorizedResponse({ description: 'User not authenticated' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
    ApiInternalServerErrorResponse({ description: 'Internal server error' }),
  );
}

export function RemoveMemberDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Remove a member from the board',
      description:
        'Removes a specific member from a board by user ID. Authorized only for administrators.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Member removed successfully',
    }),
    ApiBadRequestResponse({ description: 'Error removing member' }),
    ApiUnauthorizedResponse({ description: 'User not authenticated' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
    ApiInternalServerErrorResponse({ description: 'Internal server error' }),
  );
}

export function ChangeMemberRoleDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Change a member\'s role',
      description:
        'Allows a board ADMIN to change a member\'s role. Example: ADMIN -> MEMBER.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Role changed successfully',
    }),
    ApiBadRequestResponse({ description: 'Error changing role' }),
    ApiUnauthorizedResponse({ description: 'User not authenticated' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
    ApiInternalServerErrorResponse({ description: 'Internal server error' }),
  );
}

export function InviteBoardDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Invite a user to a board',
      description:
        'Invites a user to a specific board by UserName. Authorized only for administrators.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'User invited successfully',
    }),
    ApiBadRequestResponse({ description: 'Error inviting user' }),
    ApiUnauthorizedResponse({ description: 'User not authenticated' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
    ApiInternalServerErrorResponse({ description: 'Internal server error' }),
  );
}

export function ResponseInviteBoardDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Respond to a board invitation',
      description:
        'Accepts or declines an invitation to a specific board by invitation ID. Authorized for authenticated users.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Invitation responded successfully',
    }),
    ApiBadRequestResponse({ description: 'Error responding to invitation' }),
    ApiUnauthorizedResponse({ description: 'User not authenticated' }),
    ApiForbiddenResponse({ description: 'Access denied' }),
    ApiInternalServerErrorResponse({ description: 'Internal server error' }),
  );
}
