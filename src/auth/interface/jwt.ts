export interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
  userName: string;
  image: string | null;

  iat?: number;
  exp?: number;
}
