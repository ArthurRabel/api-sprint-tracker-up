import { Request } from 'express';

export const jwtFromCookie = (req: Request, cookieName: string = 'sprinttacker-session') => {
  let token: string | null = null;
  if (req && req.cookies) {
    token = (req.cookies as Record<string, string>)[cookieName];
  }
  return token;
};
