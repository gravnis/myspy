import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalAds, activeAds, newToday] = await Promise.all([
      prisma.ad.count(),
      prisma.ad.count({ where: { isActive: true } }),
      prisma.ad.count({ where: { createdAt: { gte: todayStart } } }),
    ]);

    // Top vertical (vertical with most ads)
    const verticalCounts = await prisma.ad.groupBy({
      by: ['verticalId'],
      _count: { id: true },
      where: { verticalId: { not: null } },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    });

    let topVertical = null;
    if (verticalCounts.length > 0 && verticalCounts[0].verticalId) {
      const v = await prisma.vertical.findUnique({
        where: { id: verticalCounts[0].verticalId },
      });
      topVertical = v ? { ...v, adCount: verticalCounts[0]._count.id } : null;
    }

    // Top 10 creatives by saves
    const topCreatives = await prisma.ad.findMany({
      orderBy: { savesCount: 'desc' },
      take: 10,
      include: {
        creatives: { take: 1 },
        vertical: true,
      },
    });

    // Ads by vertical
    const allVerticalCounts = await prisma.ad.groupBy({
      by: ['verticalId'],
      _count: { id: true },
      where: { verticalId: { not: null } },
      orderBy: { _count: { id: 'desc' } },
    });

    const verticalIds = allVerticalCounts
      .map((v) => v.verticalId)
      .filter((id): id is string => id !== null);

    const verticals = await prisma.vertical.findMany({
      where: { id: { in: verticalIds } },
    });

    const verticalMap = new Map(verticals.map((v) => [v.id, v]));

    const adsByVertical = allVerticalCounts
      .filter((v) => v.verticalId && verticalMap.has(v.verticalId))
      .map((v) => ({
        vertical: verticalMap.get(v.verticalId!)!,
        count: v._count.id,
      }));

    // Daily activity: last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dailyRaw = await prisma.$queryRaw<
      { day: Date; count: bigint }[]
    >`SELECT DATE("created_at") as day, COUNT(*)::bigint as count
      FROM "ads"
      WHERE "created_at" >= ${sevenDaysAgo}
      GROUP BY DATE("created_at")
      ORDER BY day ASC`;

    const dailyActivity = dailyRaw.map((row) => ({
      date: row.day,
      count: Number(row.count),
    }));

    return NextResponse.json({
      totalAds,
      activeAds,
      newToday,
      topVertical,
      topCreatives,
      adsByVertical,
      dailyActivity,
    });
  } catch (error) {
    console.error('GET /api/analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
