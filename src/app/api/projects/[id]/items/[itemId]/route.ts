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
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, itemId } = await params;

    const project = await prisma.project.findUnique({ where: { id } });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.userId !== user.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const item = await prisma.projectItem.findUnique({ where: { id: itemId } });

    if (!item || item.projectId !== id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const body = await request.json();
    const { note, tags } = body;

    const updated = await prisma.projectItem.update({
      where: { id: itemId },
      data: {
        ...(note !== undefined && { note }),
        ...(tags !== undefined && { tags }),
      },
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('PUT /api/projects/[id]/items/[itemId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  return PUT(request, context);
}
