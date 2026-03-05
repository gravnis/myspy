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

    const keywords = await prisma.searchKeyword.findMany({
      orderBy: { keyword: 'asc' },
      include: {
        vertical: { select: { name: true, slug: true } },
      },
    });

    return NextResponse.json({ keywords });
  } catch (error) {
    console.error('GET /api/admin/keywords error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { keyword, verticalId, isActive } = body;

    if (!keyword || typeof keyword !== 'string') {
      return NextResponse.json({ error: 'keyword is required' }, { status: 400 });
    }

    const created = await prisma.searchKeyword.create({
      data: {
        keyword,
        verticalId: verticalId || null,
        isActive: isActive !== undefined ? isActive : true,
      },
      include: {
        vertical: { select: { name: true, slug: true } },
      },
    });

    return NextResponse.json({ keyword: created }, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/keywords error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
