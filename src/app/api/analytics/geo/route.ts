import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const country = request.nextUrl.searchParams.get('country');
    if (!country) {
      return NextResponse.json({ error: 'country param required' }, { status: 400 });
    }

    // Get vertical breakdown for this country
    const verticalBreakdown = await prisma.$queryRaw<
      { vertical_id: string | null; name: string | null; slug: string | null; count: bigint; active_count: bigint; avg_days: number }[]
    >`
      SELECT
        v.id as vertical_id,
        v.name,
        v.slug,
        COUNT(a.id)::bigint as count,
        COUNT(CASE WHEN a.is_active THEN 1 END)::bigint as active_count,
        AVG(a.days_active)::float as avg_days
      FROM ads a
      LEFT JOIN verticals v ON a.vertical_id = v.id
      WHERE ${country} = ANY(a.countries)
      GROUP BY v.id, v.name, v.slug
      ORDER BY count DESC
    `;

    const verticals = verticalBreakdown.map(row => ({
      name: row.name || 'Other',
      slug: row.slug || 'other',
      count: Number(row.count),
      activeCount: Number(row.active_count),
      avgDays: Math.round(row.avg_days || 0),
    }));

    const total = verticals.reduce((s, v) => s + v.count, 0);

    return NextResponse.json({ country, total, verticals });
  } catch (error) {
    console.error('GET /api/analytics/geo error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
