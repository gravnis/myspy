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

    const [logs, keywords] = await Promise.all([
      prisma.parseLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          keyword: { select: { keyword: true } },
        },
      }),
      prisma.searchKeyword.findMany({
        where: { isActive: true },
        include: { vertical: { select: { name: true, slug: true } } },
      }),
    ]);

    return NextResponse.json({ logs, keywords });
  } catch (error) {
    console.error('GET /api/admin/parse error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
