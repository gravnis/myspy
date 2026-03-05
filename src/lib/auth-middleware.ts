import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './auth';

export interface AuthUser {
  id: string;
  role: string;
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const payload = await verifyToken(token);
  if (!payload) return null;

  return { id: payload.sub, role: payload.role };
}

export function requireAuth(handler: (req: NextRequest, user: AuthUser) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(req, user);
  };
}

export function requireAdmin(handler: (req: NextRequest, user: AuthUser) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return handler(req, user);
  };
}
