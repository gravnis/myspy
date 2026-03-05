import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const adSelect = {
      id: true,
      fbAdId: true,
      advertiserName: true,
      adText: true,
      landingUrl: true,
      countries: true,
      daysActive: true,
      isActive: true,
      savesCount: true,
      createdAt: true,
      startedAt: true,
      vertical: { select: { name: true, slug: true } },
      creatives: { take: 1 },
    };

    // ---- Batch 1: Simple counts + key queries ----
    const [
      totalAds,
      activeAds,
      inactiveAds,
      newToday,
      newThisWeek,
      thisWeekCount,
      lastWeekCount,
      longestRunningAds,
      trending,
      recentAds,
      topSaved,
      topCountriesRaw,
      dailyActivityRaw,
      avgDaysRaw,
      lastParseLog,
      totalParses,
      successParses,
      adsWithLandingUrls,
    ] = await Promise.all([
      // totalAds
      prisma.ad.count(),
      // activeAds
      prisma.ad.count({ where: { isActive: true } }),
      // inactiveAds
      prisma.ad.count({ where: { isActive: false } }),
      // newToday
      prisma.ad.count({ where: { createdAt: { gte: todayStart } } }),
      // newThisWeek
      prisma.ad.count({ where: { createdAt: { gte: weekStart } } }),
      // thisWeekCount
      prisma.ad.count({ where: { createdAt: { gte: weekStart } } }),
      // lastWeekCount
      prisma.ad.count({
        where: {
          createdAt: { gte: lastWeekStart, lt: weekStart },
        },
      }),
      // longestRunningAds — top 10 by daysActive
      prisma.ad.findMany({
        orderBy: { daysActive: 'desc' },
        take: 10,
        select: adSelect,
      }),
      // trending — recent ads (created in last 14 days) with daysActive >= 3
      prisma.ad.findMany({
        where: {
          daysActive: { gte: 3 },
          createdAt: {
            gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: adSelect,
      }),
      // recentAds
      prisma.ad.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: adSelect,
      }),
      // topSaved
      prisma.ad.findMany({
        where: { savesCount: { gt: 0 } },
        orderBy: { savesCount: 'desc' },
        take: 10,
        select: adSelect,
      }),
      // topCountries — raw SQL with unnest
      prisma.$queryRaw<{ country: string; count: bigint }[]>`
        SELECT unnest(countries) as country, COUNT(*) as count
        FROM "ads"
        GROUP BY country
        ORDER BY count DESC
        LIMIT 20
      `,
      // dailyActivity — last 30 days
      prisma.$queryRaw<{ day: Date; count: bigint }[]>`
        SELECT DATE("created_at") as day, COUNT(*)::bigint as count
        FROM "ads"
        WHERE "created_at" >= ${thirtyDaysAgo}
        GROUP BY DATE("created_at")
        ORDER BY day ASC
      `,
      // avgDaysActive
      prisma.$queryRaw<{ avg: number | null }[]>`
        SELECT AVG("days_active")::float as avg FROM "ads" WHERE "is_active" = true
      `,
      // lastParseLog
      prisma.parseLog.findFirst({
        orderBy: { createdAt: 'desc' },
      }),
      // totalParses
      prisma.parseLog.count(),
      // successParses
      prisma.parseLog.count({ where: { status: 'SUCCESS' } }),
      // adsWithLandingUrls (for domain extraction)
      prisma.ad.findMany({
        where: {
          landingUrl: { not: null },
        },
        select: { landingUrl: true },
      }),
    ]);

    // ---- Batch 2: Vertical breakdown + top advertisers ----
    const [allVerticalCounts, activeVerticalCounts, verticals] = await Promise.all([
      prisma.ad.groupBy({
        by: ['verticalId'],
        _count: { id: true },
        _avg: { daysActive: true },
        where: { verticalId: { not: null } },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.ad.groupBy({
        by: ['verticalId'],
        _count: { id: true },
        where: { verticalId: { not: null }, isActive: true },
      }),
      prisma.vertical.findMany(),
    ]);

    // Build vertical map
    const verticalMap = new Map(verticals.map((v) => [v.id, v]));
    const activeVerticalMap = new Map(
      activeVerticalCounts.map((v) => [v.verticalId, v._count.id])
    );

    const adsByVertical = allVerticalCounts
      .filter((v) => v.verticalId && verticalMap.has(v.verticalId))
      .map((v) => {
        const vert = verticalMap.get(v.verticalId!)!;
        return {
          name: vert.name,
          slug: vert.slug,
          count: v._count.id,
          activeCount: activeVerticalMap.get(v.verticalId!) || 0,
          avgDays: Math.round(v._avg.daysActive || 0),
        };
      });

    // ---- Top advertisers (raw SQL for efficiency) ----
    const topAdvertisersRaw = await prisma.$queryRaw<
      { advertiser_name: string; ad_count: bigint; avg_days: number; countries: string[] }[]
    >`
      SELECT
        "advertiser_name",
        COUNT(*)::bigint as ad_count,
        AVG("days_active")::float as avg_days,
        ARRAY_AGG(DISTINCT unnested_country) as countries
      FROM "ads",
        LATERAL unnest(CASE WHEN array_length(countries, 1) > 0 THEN countries ELSE ARRAY['unknown'] END) as unnested_country
      WHERE "advertiser_name" IS NOT NULL
      GROUP BY "advertiser_name"
      ORDER BY ad_count DESC
      LIMIT 15
    `;

    const topAdvertisers = topAdvertisersRaw.map((row) => ({
      name: row.advertiser_name,
      adCount: Number(row.ad_count),
      avgDaysActive: Math.round(row.avg_days || 0),
      countries: (row.countries || []).filter((c) => c !== 'unknown'),
    }));

    // ---- Top countries ----
    const topCountries = topCountriesRaw.map((row) => ({
      country: row.country,
      count: Number(row.count),
    }));

    // ---- Daily activity ----
    const dailyActivity = dailyActivityRaw.map((row) => ({
      date: row.day instanceof Date ? row.day.toISOString().split('T')[0] : String(row.day),
      count: Number(row.count),
    }));

    // ---- Week over week change ----
    const weekOverWeekChange =
      lastWeekCount > 0
        ? Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100)
        : thisWeekCount > 0
          ? 100
          : 0;

    // ---- Top domains ----
    const domainCounts = new Map<string, number>();
    for (const ad of adsWithLandingUrls) {
      if (!ad.landingUrl) continue;
      try {
        const hostname = new URL(ad.landingUrl).hostname;
        domainCounts.set(hostname, (domainCounts.get(hostname) || 0) + 1);
      } catch {
        // skip invalid URLs
      }
    }
    const topDomains = Array.from(domainCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([domain, count]) => ({ domain, count }));

    // ---- Avg days active ----
    const avgDaysActive = Math.round(avgDaysRaw[0]?.avg || 0);

    // ---- Parse stats ----
    const lastParseTime = lastParseLog ? lastParseLog.createdAt.toISOString() : null;
    const parseSuccessRate = totalParses > 0 ? Math.round((successParses / totalParses) * 100) : 0;

    return NextResponse.json({
      // Overview stats
      totalAds,
      activeAds,
      inactiveAds,
      newToday,
      newThisWeek,

      // Longevity insights
      avgDaysActive,
      longestRunningAds,

      // Top advertisers
      topAdvertisers,

      // Vertical breakdown
      adsByVertical,

      // Country/GEO breakdown
      topCountries,

      // Trending
      trending,

      // Recently added
      recentAds,

      // Daily activity chart — last 30 days
      dailyActivity,

      // Weekly comparison
      thisWeekCount,
      lastWeekCount,
      weekOverWeekChange,

      // Top saved
      topSaved,

      // Landing page domains
      topDomains,

      // Parse stats
      lastParseTime,
      totalParses,
      parseSuccessRate,
    });
  } catch (error) {
    console.error('GET /api/analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
