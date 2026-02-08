export function mockSignUpDto(overrides?: Record<string, unknown>) {
  const timestamp = Date.now();
  return {
    name: `Test User ${timestamp}`,
    userName: `user${timestamp}`,
    email: `user${timestamp}@test.com`,
    password: 'Password123!',
    ...overrides,
  };
}

export function mockSignInDto(email: string, password: string, rememberMe = false) {
  return {
    email,
    password,
    rememberMe,
  };
}

export function mockForgotPasswordDto(email: string) {
  return {
    email,
  };
}

export function mockVerifyResetCodeDto(code: string) {
  return {
    code,
  };
}

export function mockResetPasswordDto(newPassword: string, confirmNewPassword: string) {
  return {
    newPassword,
    confirmNewPassword,
  };
}

export function mockChangePasswordDto(
  oldPassword: string,
  newPassword: string,
  confirmNewPassword: string,
) {
  return {
    oldPassword,
    newPassword,
    confirmNewPassword,
  };
}

export function mockLdapLoginDto(enrollment: string, password: string) {
  return {
    enrollment,
    password,
  };
}

export function mockUserData(overrides?: Record<string, unknown>) {
  const timestamp = Date.now();
  return {
    name: `Test User ${timestamp}`,
    userName: `user${timestamp}`,
    email: `user${timestamp}@test.com`,
    password: 'Password123!',
    ...overrides,
  };
}
