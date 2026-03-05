import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const ad = await prisma.ad.findUnique({
      where: { id },
      include: {
        creatives: true,
        vertical: true,
      },
    });

    if (!ad) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 });
    }

    return NextResponse.json({ ad });
  } catch (error) {
    console.error('GET /api/ads/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
