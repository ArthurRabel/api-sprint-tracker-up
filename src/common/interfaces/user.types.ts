export enum AuthProvider {
  LOCAL = 'LOCAL',
  GOOGLE = 'GOOGLE',
  MICROSOFT = 'MICROSOFT',
  LDAP = 'LDAP',
}

export enum Role {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  OBSERVER = 'OBSERVER',
}

export interface User {
  id: string;
  email: string;
  userName: string;
  providerId: string | null;
  authProvider: AuthProvider;
  createdAt: Date;
  isVerified: boolean;
  name: string;
  passwordHash: string | null;
  resetToken: string | null;
  resetTokenExpiresAt: Date | null;
  role: Role;
  updatedAt: Date;
  image: string | null;
}
