import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
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
    // Forward Range header for video seeking
    const fetchHeaders: Record<string, string> = {};
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }

    const res = await fetch(url, { headers: fetchHeaders });
    if (!res.ok && res.status !== 206) {
      return NextResponse.json({ error: 'Failed to fetch media' }, { status: 502 });
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const isVideo = contentType.startsWith('video/');
    const buffer = await res.arrayBuffer();

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': isVideo ? 'public, max-age=3600' : 'public, max-age=86400',
      'Accept-Ranges': 'bytes',
    };

    // Forward content-range for partial responses (video seeking)
    const contentRange = res.headers.get('content-range');
    if (contentRange) {
      headers['Content-Range'] = contentRange;
    }

    if (download) {
      let ext = 'bin';
      if (contentType.includes('png')) ext = 'png';
      else if (contentType.includes('webp')) ext = 'webp';
      else if (contentType.includes('mp4')) ext = 'mp4';
      else if (contentType.includes('webm')) ext = 'webm';
      else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
      headers['Content-Disposition'] = `attachment; filename="creative.${ext}"`;
    }

    return new NextResponse(buffer, {
      status: res.status === 206 ? 206 : 200,
      headers,
    });
  } catch {
    return NextResponse.json({ error: 'Proxy failed' }, { status: 500 });
  }
}
