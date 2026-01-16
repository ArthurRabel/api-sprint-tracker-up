import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';

export function SignUpDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Register a new User',
      description: 'Creates a new user and saves it to the database.',
    }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'User registered successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'User registered successfully' },
        },
      },
    }),
    ApiBadRequestResponse({ description: 'Invalid data provided' }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Email is already in use',
    }),
    ApiInternalServerErrorResponse({ description: 'Internal server error' }),
  );
}

export function SignInDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'User authentication',
      description: 'Authenticates the user and returns an access token for system usage.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'User authenticated successfully',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'User authenticated successfully',
          },
        },
      },
    }),
    ApiUnauthorizedResponse({ description: 'Invalid credentials' }),
    ApiBadRequestResponse({ description: 'Invalid login data' }),
    ApiInternalServerErrorResponse({ description: 'Internal server error' }),
  );
}

export function GoogleAuthDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Start authentication with Google' }),
    ApiResponse({
      status: HttpStatus.FOUND,
      description: 'Redirects to Google login page',
    }),
  );
}

export function ForgotPasswordDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Send password recovery email',
      description: 'Sends an email with instructions for password recovery to the user.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'If the email is registered, password recovery instructions have been sent.',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'Recovery email sent successfully',
          },
        },
      },
    }),
    ApiBadRequestResponse({ description: 'Invalid or missing email' }),
    ApiInternalServerErrorResponse({ description: 'Failed to send email' }),
  );
}

export function VerifyResetCodeDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Verify password recovery code and return JWT in cookie',
      description:
        'Verifies the code sent by email and, if valid, sets a reset JWT in an HTTP-only cookie.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Code verified successfully. JWT token set in cookie.',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'Code verified successfully. You can reset your password.',
          },
        },
      },
      headers: {
        'Set-Cookie': {
          description: 'HTTP-only cookie containing reset JWT token.',
          schema: { type: 'string' },
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid data or expired/invalid code',
    }),
  );
}

export function ResetPasswordDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Reset user password using the verification cookie/token',
      description:
        'Allows user to reset password using a JWT token generated after verifying the reset code.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Password reset successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Password reset successfully!' },
        },
      },
    }),
    ApiBadRequestResponse({ description: 'Invalid data provided' }),
    ApiUnauthorizedResponse({ description: 'Invalid verification code' }),
  );
}

export function ChangePasswordDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Change authenticated user password',
      description: 'Allows authenticated user to change their current password.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Password changed successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Password changed successfully' },
        },
      },
    }),
    ApiUnauthorizedResponse({ description: 'User not authenticated' }),
    ApiBadRequestResponse({ description: 'Invalid data provided' }),
    ApiInternalServerErrorResponse({ description: 'Internal server error' }),
  );
}

export function GoogleCallbackDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Google callback after authentication' }),
    ApiResponse({
      status: HttpStatus.FOUND,
      description: 'Google login successful',
    }),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
    ApiInternalServerErrorResponse({ description: 'Internal server error' }),
  );
}

export function MicrosoftAuthDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Start authentication with Microsoft' }),
    ApiResponse({
      status: HttpStatus.FOUND,
      description: 'Redirects to Microsoft login page',
    }),
  );
}

export function MicrosoftCallbackDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Microsoft callback after authentication' }),
    ApiResponse({
      status: HttpStatus.FOUND,
      description: 'Microsoft login successful',
    }),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
    ApiInternalServerErrorResponse({ description: 'Internal server error' }),
  );
}

export function LdapLoginDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'User authentication via LDAP',
      description: 'Authenticates user against the LDAP server.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'LDAP login successful',
    }),
    ApiUnauthorizedResponse({ description: 'Invalid LDAP credentials' }),
    ApiInternalServerErrorResponse({ description: 'LDAP communication error' }),
  );
}

export function LogoutDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'User logout',
      description: 'Logs out the user by removing the authentication token.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Logout successful',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Logout successful' },
        },
      },
    }),
    ApiUnauthorizedResponse({ description: 'User not authenticated' }),
  );
}
