import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@/generated/prisma/client';
import { scrapeAdLibrary, mapScrapedAdToDb } from '@/lib/meta-api';
import { detectVertical, hashText } from '@/lib/utils';

async function saveAdsToDB(ads: ReturnType<typeof mapScrapedAdToDb>[]) {
  const verticals = await prisma.vertical.findMany();
  const verticalSlugMap = new Map(verticals.map((v) => [v.slug, v.id]));

  let saved = 0;
  for (const mapped of ads) {
    try {
      const daysActive = mapped.startedAt
        ? Math.max(1, Math.floor((Date.now() - mapped.startedAt.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      const detectedSlug = detectVertical(mapped.adText || '');
      const verticalId = (detectedSlug && detectedSlug !== 'other')
        ? verticalSlugMap.get(detectedSlug) || null
        : null;
      const textHash = mapped.adText ? hashText(mapped.adText) : null;

      const existing = await prisma.ad.findUnique({
        where: { fbAdId: mapped.fbAdId },
      });

      if (existing) {
        await prisma.ad.update({
          where: { fbAdId: mapped.fbAdId },
          data: { lastSeenAt: mapped.lastSeenAt, isActive: mapped.isActive, daysActive },
        });
      } else {
        await prisma.ad.create({
          data: { ...mapped, daysActive, verticalId, textHash },
        });
        saved++;
      }
    } catch {
      // skip individual ad errors
    }
  }
  return saved;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const country = searchParams.get('country');
    const vertical = searchParams.get('vertical');
    const minDays = searchParams.get('minDays');
    const sort = searchParams.get('sort') || 'date';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '24', 10)));
    const skip = (page - 1) * limit;
    // source=live forces a fresh scrape; source=db uses only DB
    const source = searchParams.get('source') || 'live';

    // If there's a search query and source is live, scrape FB Ad Library first
    if (q && source === 'live') {
      try {
        const scrapeResult = await scrapeAdLibrary({
          keyword: q,
          country: country || 'US',
          maxAds: 50,
        });

        if (scrapeResult.ads.length > 0) {
          const mapped = scrapeResult.ads.map(mapScrapedAdToDb);
          // Save to DB in background (don't await for speed, but catch errors)
          saveAdsToDB(mapped).catch((err) =>
            console.error('Background save error:', err)
          );

          // Return scraped results directly — fast path
          // Apply client-side-like filtering and sorting
          let results = scrapeResult.ads.map((ad) => {
            const daysActive = ad.startedAt
              ? Math.max(1, Math.floor((Date.now() - ad.startedAt.getTime()) / (1000 * 60 * 60 * 24)))
              : 0;
            return {
              id: ad.fbAdId,
              fbAdId: ad.fbAdId,
              advertiserName: ad.advertiserName,
              adText: [ad.adText, ad.linkTitle, ad.linkDescription].filter(Boolean).join(' '),
              linkTitle: ad.linkTitle,
              linkDescription: ad.linkDescription,
              landingUrl: ad.landingUrl,
              countries: [ad.country],
              platforms: ad.platforms,
              daysActive,
              isActive: ad.isActive,
              startedAt: ad.startedAt?.toISOString() || null,
              savesCount: 0,
              vertical: null as { name: string; slug: string } | null,
              creatives: ad.imageUrls.length > 0
                ? [{ id: ad.fbAdId, type: 'IMAGE' as const, originalUrl: ad.imageUrls[0], b2Key: null, thumbnailB2Key: null }]
                : ad.videoThumbnailUrl
                  ? [{ id: ad.fbAdId, type: 'VIDEO' as const, originalUrl: ad.videoThumbnailUrl, b2Key: null, thumbnailB2Key: null }]
                  : [],
            };
          });

          // Apply vertical filter on scraped results
          if (vertical) {
            results = results.filter((ad) => {
              const detected = detectVertical(ad.adText || '');
              return detected === vertical;
            });
          }

          if (minDays) {
            results = results.filter((ad) => ad.daysActive >= parseInt(minDays, 10));
          }

          // Sort
          if (sort === 'duration') {
            results.sort((a, b) => b.daysActive - a.daysActive);
          } else {
            // date desc by default
            results.sort((a, b) => {
              const da = a.startedAt ? new Date(a.startedAt).getTime() : 0;
              const db = b.startedAt ? new Date(b.startedAt).getTime() : 0;
              return db - da;
            });
          }

          const total = results.length;
          const paged = results.slice(skip, skip + limit);

          return NextResponse.json({
            ads: paged,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            source: 'live',
          });
        }
      } catch (err) {
        const scrapeError = err instanceof Error ? err.message : String(err);
        console.error('Live scrape failed, falling back to DB:', scrapeError);
        // Fall through to DB query below, include error in response for debugging
        const where: Prisma.AdWhereInput = {};
        if (q) {
          where.OR = [
            { adText: { contains: q, mode: 'insensitive' } },
            { advertiserName: { contains: q, mode: 'insensitive' } },
            { linkTitle: { contains: q, mode: 'insensitive' } },
            { linkDescription: { contains: q, mode: 'insensitive' } },
            { landingUrl: { contains: q, mode: 'insensitive' } },
          ];
        }
        if (country) where.countries = { has: country };
        if (vertical) where.vertical = { slug: vertical };
        if (minDays) where.daysActive = { gte: parseInt(minDays, 10) };

        const [ads, total] = await Promise.all([
          prisma.ad.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: { creatives: { take: 1 }, vertical: true } }),
          prisma.ad.count({ where }),
        ]);

        return NextResponse.json({
          ads, total, page,
          totalPages: Math.ceil(total / limit),
          source: 'db',
          scrapeError,
        });
      }
    }

    // DB fallback / browse mode (no query, or source=db, or scrape returned nothing)
    const where: Prisma.AdWhereInput = {};

    if (q) {
      where.OR = [
        { adText: { contains: q, mode: 'insensitive' } },
        { advertiserName: { contains: q, mode: 'insensitive' } },
        { linkTitle: { contains: q, mode: 'insensitive' } },
        { linkDescription: { contains: q, mode: 'insensitive' } },
        { landingUrl: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (country) {
      where.countries = { has: country };
    }

    if (vertical) {
      where.vertical = { slug: vertical };
    }

    if (minDays) {
      where.daysActive = { gte: parseInt(minDays, 10) };
    }

    let orderBy: Prisma.AdOrderByWithRelationInput;
    switch (sort) {
      case 'duration':
        orderBy = { daysActive: 'desc' };
        break;
      case 'saves':
        orderBy = { savesCount: 'desc' };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    const [ads, total] = await Promise.all([
      prisma.ad.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          creatives: { take: 1 },
          vertical: true,
        },
      }),
      prisma.ad.count({ where }),
    ]);

    return NextResponse.json({
      ads,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      source: 'db',
    });
  } catch (error) {
    console.error('GET /api/ads error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
