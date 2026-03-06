/**
 * Shared scraping logic — used by both local scraper and live search API.
 * Extracts ads from a Puppeteer page that has FB Ad Library loaded.
 */
import type { Page } from 'puppeteer-core';

const VERTICAL_KW: Record<string, string[]> = {
  gambling: ['casino', 'slot machine', 'jackpot', 'roulette', 'blackjack', 'poker', 'gambling', 'казино', 'слот', 'рулетка', 'покер', 'игровые автоматы', 'азартн'],
  nutra: ['weight loss', 'diet pill', 'fat burner', 'keto diet', 'detox', 'anti-aging', 'supplement', 'skin care', 'hair growth', 'joint pain', 'blood sugar', 'похудение', 'жиросжигат', 'крем от', 'омолож'],
  crypto: ['bitcoin', 'cryptocurrency', 'crypto trading', 'blockchain', 'ethereum', 'btc', 'forex trading', 'trading platform', 'биткоин', 'криптовалют', 'трейдинг'],
  dating: ['dating app', 'dating site', 'meet singles', 'find love', 'hookup', 'знакомства', 'сайт знакомств'],
  ecom: ['free shipping', 'add to cart', 'order now', 'limited offer', 'shop now', 'buy now', 'интернет магазин', 'распродажа', 'купить сейчас'],
  finance: ['personal loan', 'credit card', 'payday loan', 'fast cash', 'insurance', 'mortgage', 'микрозайм', 'быстрый кредит'],
};

export function detectVertical(text: string): string {
  if (!text) return 'other';
  const lower = text.toLowerCase();
  let best = 'other', bestScore = 0;
  for (const [v, kws] of Object.entries(VERTICAL_KW)) {
    const score = kws.filter(k => lower.includes(k)).length;
    if (score > bestScore) { bestScore = score; best = v; }
  }
  return best;
}

export function buildFbUrl(keyword: string, country: string) {
  const params = new URLSearchParams({
    active_status: 'active',
    ad_type: 'all',
    country,
    q: keyword,
    search_type: 'keyword_unordered',
  });
  return `https://www.facebook.com/ads/library/?${params}`;
}

/**
 * Extract ads from a loaded FB Ad Library page.
 * The page must already be navigated and scrolled.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function extractAdsFromPage(page: Page, country: string): Promise<any[]> {
  return page.evaluate((c: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [];
    const processedIds = new Set<string>();

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const t = node.textContent || '';
        return (t.includes('Library ID') || t.includes('ID Библиотеки')) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });

    const libIdElements: HTMLElement[] = [];
    while (walker.nextNode()) {
      const el = walker.currentNode.parentElement;
      if (el) libIdElements.push(el);
    }

    function findCard(el: HTMLElement): HTMLElement {
      let cur = el;
      for (let i = 0; i < 15; i++) {
        const p = cur.parentElement;
        if (!p) break;
        const siblings = Array.from(p.children);
        if (siblings.filter(s => { const t = s.textContent || ''; return t.includes('Library ID') || t.includes('ID Библиотеки'); }).length > 1) return cur;
        cur = p;
      }
      return el.parentElement?.parentElement?.parentElement || el;
    }

    for (const libEl of libIdElements) {
      try {
        const card = findCard(libEl);
        const text = card.textContent || '';

        const idMatch = text.match(/(?:Library ID|ID Библиотеки)[:\s]*(\d+)/i);
        const fbAdId = idMatch?.[1] || '';
        if (!fbAdId || processedIds.has(fbAdId)) continue;
        processedIds.add(fbAdId);

        let advertiserName: string | null = null;
        let advertiserId: string | null = null;
        const links = Array.from(card.querySelectorAll('a[href]'));
        for (const link of links) {
          const href = link.getAttribute('href') || '';
          if (href.includes('view_all_page_id=') || (href.includes('facebook.com/') && !href.includes('/ads/library/?'))) {
            advertiserName = (link.textContent || '').trim() || null;
            const pidMatch = href.match(/view_all_page_id=(\d+)/) || href.match(/\/(\d{5,})\/?/);
            if (pidMatch) advertiserId = pidMatch[1];
            break;
          }
        }

        let startedAt: string | null = null;
        const datePatterns = [
          /[Ss]tarted running on\s+(\w+\s+\d{1,2},?\s+\d{4})/,
          /[Ss]tarted running on\s+(\d{1,2}\s+\w+\s+\d{4})/,
          /Показ начат\s+(\d{1,2}\s+\S+\s+\d{4})/,
          /Started\s+(\w+\s+\d{1,2},?\s+\d{4})/,
          /(\w{3,}\s+\d{1,2},?\s+\d{4})\s*-/,
          /(\d{1,2}\s+\w{3,}\s+\d{4})\s*-/,
        ];
        for (const pat of datePatterns) {
          const m = text.match(pat);
          if (m) {
            try { const d = new Date(m[1]); if (!isNaN(d.getTime())) { startedAt = d.toISOString(); break; } } catch {}
          }
        }

        let platforms: string[] = [];
        const platMatch = text.match(/(?:[Rr]unning on|[Pp]latforms?:?)\s*([A-Za-z, &]+?)(?:\.|$|\n)/);
        if (platMatch) {
          platforms = platMatch[1].split(/[,&]/).map(p => p.trim()).filter(p =>
            ['facebook', 'instagram', 'messenger', 'audience network', 'meta', 'whatsapp'].includes(p.toLowerCase())
          );
        }

        const isActive = text.toLowerCase().includes('active') && !text.toLowerCase().includes('inactive');

        const videoUrls: string[] = [];
        let videoThumbnailUrl: string | null = null;
        card.querySelectorAll('video').forEach(video => {
          const src = video.getAttribute('src') || '';
          if (src && src.startsWith('http')) videoUrls.push(src);
          video.querySelectorAll('source').forEach(source => {
            const ssrc = source.getAttribute('src') || '';
            if (ssrc && ssrc.startsWith('http')) videoUrls.push(ssrc);
          });
          const poster = video.getAttribute('poster') || '';
          if (poster && poster.startsWith('http')) videoThumbnailUrl = poster;
        });
        card.querySelectorAll('[data-video-url], [data-src]').forEach(el => {
          const vurl = el.getAttribute('data-video-url') || el.getAttribute('data-src') || '';
          if (vurl && vurl.startsWith('http') && (vurl.includes('.mp4') || vurl.includes('video'))) {
            videoUrls.push(vurl);
          }
        });

        const imageUrls: string[] = [];
        card.querySelectorAll('img').forEach(img => {
          const src = img.getAttribute('src') || '';
          if (!src || src.startsWith('data:')) return;
          if (src.includes('cdninstagram.com')) return;
          if (src.includes('profile_pic') || src.includes('t51.2885-19') || src.includes('t51.82787-19')) return;
          const sizeMatch = src.match(/[_&?](s|p)(\d+)x(\d+)/);
          if (sizeMatch) {
            const dim = Math.max(parseInt(sizeMatch[2]), parseInt(sizeMatch[3]));
            if (dim < 200) return;
          }
          const w = img.width || img.naturalWidth || 0;
          const h = img.height || img.naturalHeight || 0;
          if (w < 100 && h < 100) return;
          const parent = img.parentElement;
          const parentStyle = parent ? getComputedStyle(parent) : null;
          if (parentStyle?.borderRadius === '50%') return;
          imageUrls.push(src);
        });

        if (videoUrls.length > 0 && imageUrls.length === 0 && videoThumbnailUrl) {
          imageUrls.push(videoThumbnailUrl);
        }

        let adText: string | null = null;
        const textDivs = Array.from(card.querySelectorAll('div[style*="webkit-line-clamp"], div[dir="auto"], span[dir="auto"]'));
        const candidates: string[] = [];
        for (const td of textDivs) {
          const t = (td.textContent || '').trim();
          if (t.length > 20 && !t.includes('Library ID') && !t.includes('ID Библиотеки') && !t.includes('Started running') && !t.includes('Показ начат')) candidates.push(t);
        }
        if (candidates.length > 0) adText = candidates.sort((a, b) => b.length - a.length)[0];

        let landingUrl: string | null = null;
        for (const link of links) {
          const href = link.getAttribute('href') || '';
          if (href && !href.includes('facebook.com') && !href.includes('fb.com') && href.startsWith('http')) {
            landingUrl = href; break;
          }
        }
        if (!landingUrl) {
          for (const link of links) {
            const href = link.getAttribute('href') || '';
            if (href.includes('l.facebook.com/l.php')) {
              try { const u = new URL(href).searchParams.get('u'); if (u) landingUrl = decodeURIComponent(u); } catch {}
            }
          }
        }

        results.push({
          fbAdId, advertiserName, advertiserId, adText,
          linkTitle: null, linkDescription: null,
          landingUrl, imageUrls, videoUrls, videoThumbnailUrl,
          startedAt, isActive, platforms, country: c,
        });
      } catch { continue; }
    }
    return results;
  }, country);
}
