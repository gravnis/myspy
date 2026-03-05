import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

async function getUser(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const project = await prisma.project.findUnique({ where: { id } });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.userId !== user.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { adId, note, tags } = body;

    if (!adId) {
      return NextResponse.json({ error: 'adId is required' }, { status: 400 });
    }

    const ad = await prisma.ad.findUnique({ where: { id: adId } });
    if (!ad) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 });
    }

    const item = await prisma.projectItem.create({
      data: {
        projectId: id,
        adId,
        note: note || null,
        tags: tags || [],
      },
    });

    // Increment saves count on the ad
    await prisma.ad.update({
      where: { id: adId },
      data: { savesCount: { increment: 1 } },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/items error:', error);
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

    const { id } = await params;

    const project = await prisma.project.findUnique({ where: { id } });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.userId !== user.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { itemId } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }

    const item = await prisma.projectItem.findUnique({ where: { id: itemId } });

    if (!item || item.projectId !== id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    await prisma.projectItem.delete({ where: { id: itemId } });

    // Decrement saves count on the ad
    await prisma.ad.update({
      where: { id: item.adId },
      data: { savesCount: { decrement: 1 } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/projects/[id]/items error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
