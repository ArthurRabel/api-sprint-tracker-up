export interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
  userName: string;

  iat?: number;
  exp?: number;
}
