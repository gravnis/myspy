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
      usersThisMonth,
      proUsers,
      businessUsers,
      freeUsers,
      verticalStats,
      countryStats,
      recentAds,
      topAdvertisers,
      adsWithoutCreatives,
      expiredCreatives,
      totalParses,
      successParses,
      totalKeywords,
      activeKeywords,
      recentUsers,
      planChanges,
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
      prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
      prisma.user.count({ where: { plan: 'PRO' } }),
      prisma.user.count({ where: { plan: 'BUSINESS' } }),
      prisma.user.count({ where: { plan: 'FREE' } }),
      prisma.vertical.findMany({
        select: { name: true, slug: true, _count: { select: { ads: true } } },
        orderBy: { ads: { _count: 'desc' } },
      }),
      prisma.$queryRaw`
        SELECT unnest(countries) as country, count(*) as cnt
        FROM ads GROUP BY country ORDER BY cnt DESC LIMIT 15
      ` as Promise<Array<{ country: string; cnt: bigint }>>,
      prisma.ad.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true, advertiserName: true, createdAt: true, countries: true,
          vertical: { select: { name: true } },
          _count: { select: { creatives: true } },
        },
      }),
      prisma.$queryRaw`
        SELECT advertiser_name, count(*) as cnt
        FROM ads WHERE advertiser_name IS NOT NULL
        GROUP BY advertiser_name ORDER BY cnt DESC LIMIT 10
      ` as Promise<Array<{ advertiser_name: string; cnt: bigint }>>,
      prisma.ad.count({ where: { creatives: { none: {} } } }),
      prisma.adCreative.count({ where: { originalUrl: null } }),
      prisma.parseLog.count(),
      prisma.parseLog.count({ where: { status: 'SUCCESS' } }),
      prisma.searchKeyword.count(),
      prisma.searchKeyword.count({ where: { isActive: true } }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, email: true, name: true, plan: true, role: true, createdAt: true },
      }),
      // Users by plan
      prisma.user.groupBy({
        by: ['plan'],
        _count: { id: true },
      }),
    ]);

    // DB size
    let dbSizeBytes = 0;
    try {
      const dbSize = await prisma.$queryRaw`SELECT pg_database_size(current_database()) as size` as Array<{ size: bigint }>;
      dbSizeBytes = Number(dbSize[0]?.size || 0);
    } catch {}

    // Last parse time
    const lastLog = await prisma.parseLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    // Active ads (running)
    const activeAds = await prisma.ad.count({ where: { isActive: true } });

    // Downloads this month total
    const downloadsRaw = await prisma.$queryRaw`
      SELECT COALESCE(SUM(downloads_this_month), 0)::int as total FROM users
    ` as Array<{ total: number }>;

    // Revenue estimate based on plan distribution
    const planPrices: Record<string, number> = { FREE: 0, PRO: 29, BUSINESS: 99 };
    const monthlyRevenue = planChanges.reduce((sum, p) => {
      return sum + (planPrices[p.plan] || 0) * p._count.id;
    }, 0);

    return NextResponse.json({
      // Core KPIs
      users: {
        total: totalUsers,
        free: freeUsers,
        pro: proUsers,
        business: businessUsers,
        thisWeek: usersThisWeek,
        thisMonth: usersThisMonth,
      },
      revenue: {
        mrr: monthlyRevenue,
        planBreakdown: planChanges.map(p => ({ plan: p.plan, count: p._count.id, mrr: (planPrices[p.plan] || 0) * p._count.id })),
      },
      ads: {
        total: totalAds,
        active: activeAds,
        today: adsToday,
        week: adsWeek,
        month: adsMonth,
      },
      creatives: {
        total: totalCreatives,
        images: imageCreatives,
        videos: videoCreatives,
      },
      projects: {
        total: totalProjects,
        savedAds: totalProjectItems,
      },
      parsing: {
        totalParses,
        successParses,
        successRate: totalParses > 0 ? Math.round((successParses / totalParses) * 100) : 0,
        totalKeywords,
        activeKeywords,
        lastParse: lastLog?.createdAt || null,
      },
      health: {
        adsWithoutCreatives,
        expiredCreatives,
        dbSizeBytes,
        metaApiConfigured: !!process.env.META_ACCESS_TOKEN,
        b2Configured: !!(process.env.B2_APPLICATION_KEY_ID && process.env.B2_APPLICATION_KEY),
        downloadsTotal: downloadsRaw[0]?.total || 0,
      },
      verticals: verticalStats.map(v => ({ name: v.name, slug: v.slug, count: v._count.ads })),
      topCountries: countryStats.map(c => ({ country: c.country, count: Number(c.cnt) })),
      topAdvertisers: topAdvertisers.map(a => ({ name: a.advertiser_name, count: Number(a.cnt) })),
      recentAds: recentAds.map(a => ({
        id: a.id, advertiser: a.advertiserName, vertical: a.vertical?.name,
        countries: a.countries.slice(0, 3), creatives: a._count.creatives, createdAt: a.createdAt,
      })),
      recentUsers: recentUsers.map(u => ({
        id: u.id, email: u.email, name: u.name, plan: u.plan, role: u.role, createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    console.error('GET /api/admin/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
