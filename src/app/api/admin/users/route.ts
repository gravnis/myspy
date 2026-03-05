import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

async function getUser(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7));
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    const where = q
      ? { email: { contains: q, mode: 'insensitive' as const } }
      : {};

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { projects: true } },
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('GET /api/admin/users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
