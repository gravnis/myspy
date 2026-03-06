import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyToken, hashPassword, verifyPassword } from '@/lib/auth';

async function getUser(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7));
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
        downloadsThisMonth: true,
        createdAt: true,
        _count: { select: { projects: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const planLimits = {
      FREE: { downloads: 10, projects: 3, aiGenerations: 0 },
      PRO: { downloads: 100, projects: 20, aiGenerations: 50 },
      BUSINESS: { downloads: 1000, projects: 100, aiGenerations: 500 },
    };

    return NextResponse.json({
      user,
      limits: planLimits[user.plan as keyof typeof planLimits] || planLimits.FREE,
    });
  } catch (error) {
    console.error('GET /api/user/profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await getUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, currentPassword, newPassword } = body;

    const data: Record<string, unknown> = {};

    if (name !== undefined) {
      data.name = name;
    }

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password required' }, { status: 400 });
      }
      const user = await prisma.user.findUnique({ where: { id: auth.sub } });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      const valid = await verifyPassword(currentPassword, user.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }
      data.passwordHash = await hashPassword(newPassword);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No changes' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: auth.sub },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
      },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error('PUT /api/user/profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  return PUT(request);
}
