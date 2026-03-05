import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

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

    const [totalUsers, totalAds, totalCreatives, totalProjects] = await Promise.all([
      prisma.user.count(),
      prisma.ad.count(),
      prisma.adCreative.count(),
      prisma.project.count(),
    ]);

    // Estimate storage: sum of fileSizeBytes from creatives, fallback to count * avg
    const storageAgg = await prisma.adCreative.aggregate({
      _sum: { fileSizeBytes: true },
    });
    const storageEstimate = storageAgg._sum.fileSizeBytes || totalCreatives * 500_000; // ~500KB avg estimate

    const metaApiConfigured = !!(process.env.META_ACCESS_TOKEN);
    const b2Configured = !!(process.env.B2_APPLICATION_KEY_ID && process.env.B2_APPLICATION_KEY);

    return NextResponse.json({
      totalUsers,
      totalAds,
      totalCreatives,
      totalProjects,
      storageEstimate,
      metaApiConfigured,
      b2Configured,
    });
  } catch (error) {
    console.error('GET /api/admin/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
