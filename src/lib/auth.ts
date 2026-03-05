import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const SALT_ROUNDS = 10;

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createToken(userId: string, role: string): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifyToken(token: string): Promise<{ sub: string; role: string } | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub || !payload.role) return null;
    return { sub: payload.sub, role: payload.role as string };
  } catch {
    return null;
  }
}
