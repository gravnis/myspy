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

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 86400000);
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);

    const [
      totalUsers,
      totalAds,
      totalCreatives,
      totalProjects,
      totalProjectItems,
      imageCreatives,
      videoCreatives,
      adsToday,
      adsWeek,
      adsMonth,
      usersThisWeek,
      proUsers,
      businessUsers,
      verticalStats,
      countryStats,
      recentAds,
      topAdvertisers,
      adsWithoutCreatives,
      expiredCreatives,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.ad.count(),
      prisma.adCreative.count(),
      prisma.project.count(),
      prisma.projectItem.count(),
      prisma.adCreative.count({ where: { type: 'IMAGE' } }),
      prisma.adCreative.count({ where: { type: 'VIDEO' } }),
      prisma.ad.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.ad.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.ad.count({ where: { createdAt: { gte: monthAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.user.count({ where: { plan: 'PRO' } }),
      prisma.user.count({ where: { plan: 'BUSINESS' } }),
      prisma.vertical.findMany({
        select: {
          name: true,
          slug: true,
          _count: { select: { ads: true } },
        },
        orderBy: { ads: { _count: 'desc' } },
      }),
      // Top countries - raw query since countries is an array
      prisma.$queryRaw`
        SELECT unnest(countries) as country, count(*) as cnt
        FROM ads
        GROUP BY country
        ORDER BY cnt DESC
        LIMIT 15
      ` as Promise<Array<{ country: string; cnt: bigint }>>,
      prisma.ad.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          advertiserName: true,
          createdAt: true,
          countries: true,
          vertical: { select: { name: true } },
          _count: { select: { creatives: true } },
        },
      }),
      prisma.$queryRaw`
        SELECT advertiser_name, count(*) as cnt
        FROM ads
        WHERE advertiser_name IS NOT NULL
        GROUP BY advertiser_name
        ORDER BY cnt DESC
        LIMIT 10
      ` as Promise<Array<{ advertiser_name: string; cnt: bigint }>>,
      prisma.ad.count({
        where: { creatives: { none: {} } },
      }),
      prisma.adCreative.count({
        where: { originalUrl: null },
      }),
    ]);

    // DB size estimate
    const dbSize = await prisma.$queryRaw`
      SELECT pg_database_size(current_database()) as size
    ` as Array<{ size: bigint }>;

    return NextResponse.json({
      overview: {
        totalAds,
        totalCreatives,
        imageCreatives,
        videoCreatives,
        totalUsers,
        totalProjects,
        totalProjectItems,
        proUsers,
        businessUsers,
      },
      growth: {
        adsToday,
        adsWeek,
        adsMonth,
        usersThisWeek,
      },
      health: {
        adsWithoutCreatives,
        expiredCreatives,
        dbSizeBytes: Number(dbSize[0]?.size || 0),
        metaApiConfigured: !!process.env.META_ACCESS_TOKEN,
        b2Configured: !!(process.env.B2_APPLICATION_KEY_ID && process.env.B2_APPLICATION_KEY),
      },
      verticals: verticalStats.map(v => ({
        name: v.name,
        slug: v.slug,
        count: v._count.ads,
      })),
      topCountries: countryStats.map(c => ({
        country: c.country,
        count: Number(c.cnt),
      })),
      topAdvertisers: topAdvertisers.map(a => ({
        name: a.advertiser_name,
        count: Number(a.cnt),
      })),
      recentAds: recentAds.map(a => ({
        id: a.id,
        advertiser: a.advertiserName,
        vertical: a.vertical?.name,
        countries: a.countries.slice(0, 3),
        creatives: a._count.creatives,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    console.error('GET /api/admin/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
