import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { scrapeAdLibrary, mapScrapedAdToDb } from '@/lib/meta-api';
import { detectVertical, hashText } from '@/lib/utils';

async function getUser(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const logs = await prisma.parseLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        keyword: { select: { keyword: true } },
      },
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('GET /api/admin/parse error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const country = body?.country || 'US';

    const activeKeywords = await prisma.searchKeyword.findMany({
      where: { isActive: true },
      include: { vertical: true },
    });

    if (activeKeywords.length === 0) {
      return NextResponse.json({ success: true, results: [], message: 'No active keywords' });
    }

    // Load all verticals for detection
    const verticals = await prisma.vertical.findMany();
    const verticalSlugMap = new Map(verticals.map((v) => [v.slug, v.id]));

    const results: { keyword: string; adsFound: number; adsNew: number; errors: string[] }[] = [];

    for (let i = 0; i < activeKeywords.length; i++) {
      const kw = activeKeywords[i];
      let adsFound = 0;
      let adsNew = 0;
      const errors: string[] = [];

      try {
        const scrapeResult = await scrapeAdLibrary({
          keyword: kw.keyword,
          country,
          maxAds: 50,
        });

        if (scrapeResult.errors.length > 0) {
          errors.push(...scrapeResult.errors);
        }

        adsFound = scrapeResult.ads.length;

        for (const ad of scrapeResult.ads) {
          try {
            const mapped = mapScrapedAdToDb(ad);

            // Compute daysActive
            const daysActive = mapped.startedAt
              ? Math.max(1, Math.floor((Date.now() - mapped.startedAt.getTime()) / (1000 * 60 * 60 * 24)))
              : 0;

            // Detect vertical
            const detectedSlug = kw.verticalId
              ? null
              : detectVertical(mapped.adText || '');

            const verticalId = kw.verticalId || (detectedSlug ? verticalSlugMap.get(detectedSlug) : null) || null;

            // Compute text hash
            const textHash = mapped.adText ? hashText(mapped.adText) : null;

            const existing = await prisma.ad.findUnique({
              where: { fbAdId: mapped.fbAdId },
            });

            if (existing) {
              // Update existing ad
              await prisma.ad.update({
                where: { fbAdId: mapped.fbAdId },
                data: {
                  lastSeenAt: mapped.lastSeenAt,
                  isActive: mapped.isActive,
                  daysActive,
                },
              });
            } else {
              // Create new ad
              await prisma.ad.create({
                data: {
                  ...mapped,
                  daysActive,
                  verticalId,
                  textHash,
                },
              });
              adsNew++;
            }
          } catch (adErr) {
            const msg = adErr instanceof Error ? adErr.message : 'Unknown error processing ad';
            console.error(`Error processing ad from keyword "${kw.keyword}":`, msg);
            errors.push(msg);
          }
        }

        // Update keyword last parsed time
        await prisma.searchKeyword.update({
          where: { id: kw.id },
          data: { lastParsedAt: new Date() },
        });

        // Create parse log
        await prisma.parseLog.create({
          data: {
            keywordId: kw.id,
            status: errors.length > 0 && adsFound === 0 ? 'ERROR' : 'SUCCESS',
            adsFound,
            adsNew,
            errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
          },
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Scrape failed for keyword "${kw.keyword}":`, errorMessage);
        await prisma.parseLog.create({
          data: {
            keywordId: kw.id,
            status: 'ERROR',
            adsFound: 0,
            adsNew: 0,
            errorMessage,
          },
        });
      }

      results.push({ keyword: kw.keyword, adsFound, adsNew, errors });

      // Delay between keywords to avoid launching too many browser instances
      if (i < activeKeywords.length - 1) {
        await sleep(1000);
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('POST /api/admin/parse error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
