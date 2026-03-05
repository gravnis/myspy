import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { getPlanLimits } from '@/lib/utils';

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

    const projects = await prisma.project.findMany({
      where: { userId: user.sub },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { items: true } },
      },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('GET /api/projects error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Check plan limits
    const dbUser = await prisma.user.findUnique({
      where: { id: user.sub },
      select: { plan: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const limits = getPlanLimits(dbUser.plan);

    if (limits.maxProjects !== Infinity) {
      const projectCount = await prisma.project.count({
        where: { userId: user.sub },
      });

      if (projectCount >= limits.maxProjects) {
        return NextResponse.json(
          { error: `Plan limit reached: maximum ${limits.maxProjects} projects` },
          { status: 403 }
        );
      }
    }

    const project = await prisma.project.create({
      data: {
        name,
        description: description || null,
        userId: user.sub,
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
