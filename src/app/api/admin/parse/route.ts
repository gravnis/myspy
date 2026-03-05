import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { searchMetaAds, mapMetaAdToDb } from '@/lib/meta-api';
import { detectVertical, hashText } from '@/lib/utils';

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

    const results: { keyword: string; adsFound: number; adsNew: number }[] = [];

    for (const kw of activeKeywords) {
      let adsFound = 0;
      let adsNew = 0;

      try {
        const response = await searchMetaAds({
          searchTerms: kw.keyword,
          limit: 25,
        });

        adsFound = response.data.length;

        for (const metaAd of response.data) {
          const mapped = mapMetaAdToDb(metaAd, ['US']);

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
            status: 'SUCCESS',
            adsFound,
            adsNew,
          },
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
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

      results.push({ keyword: kw.keyword, adsFound, adsNew });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('POST /api/admin/parse error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
