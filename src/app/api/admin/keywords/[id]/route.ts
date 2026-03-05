import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

async function getUser(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.searchKeyword.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Keyword not found' }, { status: 404 });
    }

    const body = await request.json();
    const { keyword, verticalId, isActive } = body;

    const updated = await prisma.searchKeyword.update({
      where: { id },
      data: {
        ...(keyword !== undefined && { keyword }),
        ...(verticalId !== undefined && { verticalId: verticalId || null }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        vertical: { select: { name: true, slug: true } },
      },
    });

    return NextResponse.json({ keyword: updated });
  } catch (error) {
    console.error('PUT /api/admin/keywords/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.searchKeyword.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Keyword not found' }, { status: 404 });
    }

    await prisma.searchKeyword.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/admin/keywords/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
