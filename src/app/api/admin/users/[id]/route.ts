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
    const body = await request.json();
    const { role, plan } = body;

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const data: Record<string, string> = {};
    if (role !== undefined) {
      if (!['USER', 'ADMIN'].includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      data.role = role;
    }
    if (plan !== undefined) {
      if (!['FREE', 'PRO', 'BUSINESS'].includes(plan)) {
        return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
      }
      data.plan = plan;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error('PUT /api/admin/users/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
