import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

async function getAdmin(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const user = await verifyToken(auth.slice(7));
  if (!user || user.role !== 'ADMIN') return null;
  return user;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [keywords, verticals, totalAds, logsCount] = await Promise.all([
      prisma.searchKeyword.findMany({
        orderBy: { keyword: 'asc' },
        include: {
          vertical: { select: { name: true, slug: true, id: true } },
          _count: { select: { logs: true } },
        },
      }),
      prisma.vertical.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true },
      }),
      prisma.ad.count(),
      prisma.parseLog.count(),
    ]);

    const activeKeywords = keywords.filter(k => k.isActive).length;

    // Last parse time
    const lastLog = await prisma.parseLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    return NextResponse.json({
      keywords: keywords.map(k => ({
        id: k.id,
        keyword: k.keyword,
        vertical: k.vertical,
        isActive: k.isActive,
        lastParsedAt: k.lastParsedAt,
        logsCount: k._count.logs,
      })),
      verticals,
      stats: {
        totalKeywords: keywords.length,
        activeKeywords,
        lastParse: lastLog?.createdAt || null,
        totalAdsParsed: totalAds,
        totalParses: logsCount,
      },
    });
  } catch (error) {
    console.error('GET /api/admin/keywords error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { keyword, verticalId, isActive } = body;

    if (!keyword || typeof keyword !== 'string') {
      return NextResponse.json({ error: 'keyword is required' }, { status: 400 });
    }

    const created = await prisma.searchKeyword.create({
      data: {
        keyword: keyword.trim(),
        verticalId: verticalId || null,
        isActive: isActive !== undefined ? isActive : true,
      },
      include: {
        vertical: { select: { name: true, slug: true, id: true } },
      },
    });

    return NextResponse.json({ keyword: created }, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/keywords error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
