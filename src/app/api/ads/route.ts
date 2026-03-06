import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@/generated/prisma/client';

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

    const where: Prisma.AdWhereInput = {
      // Only show ads that have at least one creative with a URL
      creatives: { some: { originalUrl: { not: null } } },
    };

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
          creatives: { take: 3 },
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
    });
  } catch (error) {
    console.error('GET /api/ads error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
