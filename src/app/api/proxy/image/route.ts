import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // URL passed as base64 to avoid query param encoding issues
  const b64 = request.nextUrl.searchParams.get('u');
  const download = request.nextUrl.searchParams.get('download') === '1';

  if (!b64) {
    return NextResponse.json({ error: 'URL param "u" is required (base64)' }, { status: 400 });
  }

  let url: string;
  try {
    url = Buffer.from(b64, 'base64').toString('utf-8');
  } catch {
    return NextResponse.json({ error: 'Invalid base64' }, { status: 400 });
  }

  // Only allow Facebook CDN domains
  try {
    const parsed = new URL(url);
    if (
      !parsed.hostname.endsWith('.fbcdn.net') &&
      !parsed.hostname.endsWith('.facebook.com')
    ) {
      return NextResponse.json({ error: 'Only Facebook CDN URLs allowed' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 });
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = await res.arrayBuffer();

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    };

    if (download) {
      const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      headers['Content-Disposition'] = `attachment; filename="creative.${ext}"`;
    }

    return new NextResponse(buffer, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: 'Proxy failed' }, { status: 500 });
  }
}
