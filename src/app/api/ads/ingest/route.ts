import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapScrapedAdToDb } from '@/lib/meta-api';
import type { ScrapedAd } from '@/lib/meta-api';
import { detectVertical, hashText } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const { ads } = (await request.json()) as { ads: ScrapedAd[] };

    if (!ads || !Array.isArray(ads) || ads.length === 0) {
      return NextResponse.json({ error: 'No ads provided' }, { status: 400 });
    }

    const verticals = await prisma.vertical.findMany();
    const verticalSlugMap = new Map(verticals.map((v) => [v.slug, v.id]));

    let saved = 0;
    let updated = 0;

    for (const ad of ads) {
      try {
        if (!ad.fbAdId) continue;

        const mapped = mapScrapedAdToDb(ad);

        const daysActive = mapped.startedAt
          ? Math.max(1, Math.floor((Date.now() - mapped.startedAt.getTime()) / (1000 * 60 * 60 * 24)))
          : 0;

        const detectedSlug = detectVertical(mapped.adText || '');
        const verticalId =
          detectedSlug && detectedSlug !== 'other'
            ? verticalSlugMap.get(detectedSlug) || null
            : null;
        const textHash = mapped.adText ? hashText(mapped.adText) : null;

        const existing = await prisma.ad.findUnique({
          where: { fbAdId: mapped.fbAdId },
        });

        if (existing) {
          await prisma.ad.update({
            where: { fbAdId: mapped.fbAdId },
            data: {
              lastSeenAt: mapped.lastSeenAt,
              isActive: mapped.isActive,
              daysActive,
            },
          });
          updated++;
        } else {
          await prisma.ad.create({
            data: {
              ...mapped,
              daysActive,
              verticalId,
              textHash,
            },
          });
          saved++;
        }
      } catch {
        // skip individual ad errors
      }
    }

    return NextResponse.json({ saved, updated, total: ads.length });
  } catch (error) {
    console.error('Ingest error:', error);
    return NextResponse.json({ error: 'Ingest failed' }, { status: 500 });
  }
}
