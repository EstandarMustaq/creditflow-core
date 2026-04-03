import jwt from 'jsonwebtoken';

export interface AccessTokenPayload {
  sub: string;
  role: 'ADMIN' | 'MANAGER' | 'OFFICER';
  name?: string;
}

export function signAccessToken(payload: AccessTokenPayload) {
  const secret = process.env.JWT_SECRET ?? 'dev-secret';
  return jwt.sign(payload, secret, { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' });
}

export function verifyAccessToken(token: string) {
  const secret = process.env.JWT_SECRET ?? 'dev-secret';
  return jwt.verify(token, secret) as AccessTokenPayload;
}
