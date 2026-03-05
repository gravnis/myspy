import puppeteer, { type Browser, type Page } from 'puppeteer-core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScrapedAd {
  fbAdId: string;
  advertiserName: string | null;
  advertiserId: string | null;
  adText: string | null;
  linkTitle: string | null;
  linkDescription: string | null;
  landingUrl: string | null;
  imageUrls: string[];
  videoThumbnailUrl: string | null;
  startedAt: Date | null;
  isActive: boolean;
  platforms: string[];
  country: string;
}

export interface ScrapeResult {
  ads: ScrapedAd[];
  totalFound: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const AD_LIBRARY_BASE = 'https://www.facebook.com/ads/library/';

function buildSearchUrl(keyword: string, country: string): string {
  const params = new URLSearchParams({
    active_status: 'active',
    ad_type: 'all',
    country,
    q: keyword,
    search_type: 'keyword_unordered',
  });
  return `${AD_LIBRARY_BASE}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Cookie / consent handler
// ---------------------------------------------------------------------------

async function dismissCookieConsent(page: Page): Promise<void> {
  try {
    // FB shows various consent buttons — try common selectors
    const selectors = [
      'button[data-cookiebanner="accept_button"]',
      'button[data-testid="cookie-policy-manage-dialog-accept-button"]',
      'button[title="Allow all cookies"]',
      'button[title="Accept All"]',
      'button[title="Allow essential and optional cookies"]',
      '[aria-label="Allow all cookies"]',
      '[aria-label="Accept All"]',
    ];

    for (const sel of selectors) {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        await new Promise((r) => setTimeout(r, 1000));
        return;
      }
    }

    // Fallback: look for any button whose text suggests acceptance
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const acceptBtn = buttons.find((b) => {
        const t = (b.textContent || '').toLowerCase();
        return (
          t.includes('allow all') ||
          t.includes('accept all') ||
          t.includes('accept cookies') ||
          t.includes('allow essential and optional')
        );
      });
      if (acceptBtn) (acceptBtn as HTMLElement).click();
    });

    await new Promise((r) => setTimeout(r, 500));
  } catch {
    // Consent dialog might not appear — that's fine
  }
}

// ---------------------------------------------------------------------------
// "See more" expander
// ---------------------------------------------------------------------------

async function expandSeeMoreButtons(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      // FB uses various "See more" / "See More" links or divs
      const candidates = Array.from(
        document.querySelectorAll(
          'div[role="button"], span[role="button"], a, span',
        ),
      );
      candidates.forEach((el) => {
        const text = (el.textContent || '').trim().toLowerCase();
        if (text === 'see more' || text === 'see more...') {
          (el as HTMLElement).click();
        }
      });
    });
    await new Promise((r) => setTimeout(r, 500));
  } catch {
    // Non-critical
  }
}

// ---------------------------------------------------------------------------
// Main extraction logic (runs inside page.evaluate)
// ---------------------------------------------------------------------------

function extractAdsFromPage(country: string): ScrapedAd[] {
  const ads: ScrapedAd[] = [];

  // FB Ad Library renders ad cards inside a container. Each card is typically
  // a direct child div with class _7jvw or similar. The structure has changed
  // over time, so we use a broader approach: look for elements containing
  // "Library ID:" text, or find the repeated card container.

  // Strategy 1: find ad card containers
  // The ad library search results area usually has a collection of divs that
  // share a common data attribute or a repeated structure.
  // Each card roughly looks like:
  //   [Advertiser link]
  //   [Library ID: ...]
  //   [Started running on ...]
  //   [Running on ...]
  //   [Creative text]
  //   [Media]
  //   [Link preview area with title + description + CTA]

  // We'll identify cards by looking for elements that contain "Library ID"
  // and then walking up to find the card boundary.

  // Find all "Library ID" mentions to identify card boundaries
  const libraryIdElements: HTMLElement[] = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) =>
        (node.textContent || '').includes('Library ID')
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT,
    },
  );

  while (walker.nextNode()) {
    const el = walker.currentNode.parentElement;
    if (el) libraryIdElements.push(el);
  }

  // For each Library ID element, find the enclosing card
  // We'll walk up until we find a container that is a sibling of other cards
  function findCardContainer(el: HTMLElement): HTMLElement {
    let current = el;
    for (let i = 0; i < 15; i++) {
      const parent = current.parentElement;
      if (!parent) break;
      // Check if parent has multiple children that also contain "Library ID"
      const siblings = Array.from(parent.children);
      const cardsInParent = siblings.filter((s) =>
        (s.textContent || '').includes('Library ID'),
      );
      if (cardsInParent.length > 1) {
        // This parent holds multiple cards — current is the card
        return current;
      }
      current = parent;
    }
    // Fallback: return a reasonable ancestor
    return el.parentElement?.parentElement?.parentElement || el;
  }

  const processedIds = new Set<string>();

  for (const libIdEl of libraryIdElements) {
    try {
      const card = findCardContainer(libIdEl);
      const cardText = card.textContent || '';
      // --- Ad ID ---
      const idMatch = cardText.match(/Library ID[:\s]*(\d+)/i);
      const fbAdId = idMatch ? idMatch[1] : '';
      if (!fbAdId || processedIds.has(fbAdId)) continue;
      processedIds.add(fbAdId);

      // --- Advertiser name & ID ---
      const links = Array.from(card.querySelectorAll('a[href]'));
      let advertiserName: string | null = null;
      let advertiserId: string | null = null;
      let landingUrl: string | null = null;

      // The first meaningful link in the card is usually the advertiser
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        if (
          href.includes('/ads/library/?view_all_page_id=') ||
          href.includes('facebook.com/') && !href.includes('/ads/library/?')
        ) {
          advertiserName = (link.textContent || '').trim() || null;
          // Extract page ID
          const pidMatch = href.match(/view_all_page_id=(\d+)/);
          if (pidMatch) {
            advertiserId = pidMatch[1];
          } else {
            const numMatch = href.match(/\/(\d{5,})\/?/);
            if (numMatch) advertiserId = numMatch[1];
          }
          break;
        }
      }

      // If we didn't find advertiser from links, try first link
      if (!advertiserName && links.length > 0) {
        const firstLink = links[0];
        const firstText = (firstLink.textContent || '').trim();
        if (firstText && firstText.length < 200) {
          advertiserName = firstText;
          advertiserId =
            extractPageIdInner(firstLink.getAttribute('href'));
        }
      }

      // --- Start date ---
      let startedAt: Date | null = null;
      const dateMatch = cardText.match(
        /[Ss]tarted running on\s+(\w+\s+\d{1,2},?\s+\d{4})/,
      );
      if (dateMatch) {
        try {
          const d = new Date(dateMatch[1]);
          if (!isNaN(d.getTime())) startedAt = d;
        } catch {}
      }

      // --- Platforms ---
      let platforms: string[] = [];
      const platMatch = cardText.match(
        /(?:[Rr]unning on|[Pp]latforms?:?)\s*([A-Za-z, &]+?)(?:\.|$|\n)/,
      );
      if (platMatch) {
        platforms = platMatch[1]
          .split(/[,&]/)
          .map((p: string) => p.trim())
          .filter((p: string) => {
            const lower = p.toLowerCase();
            return (
              lower === 'facebook' ||
              lower === 'instagram' ||
              lower === 'messenger' ||
              lower === 'audience network' ||
              lower === 'meta' ||
              lower === 'whatsapp'
            );
          });
      }

      // --- Status ---
      const isActive =
        cardText.toLowerCase().includes('active') &&
        !cardText.toLowerCase().includes('inactive');

      // --- Images ---
      const images = Array.from(card.querySelectorAll('img'));
      const imageUrls: string[] = [];
      let videoThumbnailUrl: string | null = null;

      for (const img of images) {
        const src = img.getAttribute('src') || '';
        if (!src || src.startsWith('data:')) continue;
        // Skip tiny icons / avatars (likely profile pics)
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        if (w > 0 && w < 40 && h > 0 && h < 40) continue;
        imageUrls.push(src);
      }

      // Check for video indicators
      const hasVideo =
        card.querySelector('video') !== null ||
        cardText.includes('Video') ||
        card.querySelector('[aria-label*="video" i]') !== null;

      if (hasVideo && imageUrls.length > 0) {
        // The largest image is likely the video thumbnail
        videoThumbnailUrl = imageUrls[imageUrls.length - 1];
      }

      // --- Ad creative text ---
      // The ad body text is usually between the metadata area and the media.
      // We'll try to extract it by looking at text content areas.
      let adText: string | null = null;
      const textDivs = Array.from(
        card.querySelectorAll('div[style*="webkit-line-clamp"], div[dir="auto"], span[dir="auto"]'),
      );
      const textCandidates: string[] = [];
      for (const td of textDivs) {
        const t = (td.textContent || '').trim();
        if (
          t.length > 20 &&
          !t.includes('Library ID') &&
          !t.includes('Started running') &&
          !t.includes('Running on')
        ) {
          textCandidates.push(t);
        }
      }
      if (textCandidates.length > 0) {
        // Pick the longest candidate as the ad body text
        adText =
          textCandidates.sort((a, b) => b.length - a.length)[0] || null;
      }

      // --- Link title & description (link preview area) ---
      let linkTitle: string | null = null;
      let linkDescription: string | null = null;

      // The link preview is often at the bottom of the card, after the media.
      // It usually contains a headline in a bold/strong style and a description.
      // Look for elements that appear after images.
      const allDivs = Array.from(card.querySelectorAll('div'));
      let foundMedia = false;
      for (const div of allDivs) {
        if (div.querySelector('img') || div.querySelector('video')) {
          foundMedia = true;
          continue;
        }
        if (foundMedia) {
          const t = (div.textContent || '').trim();
          if (t.length > 5 && t.length < 300) {
            // First short text after media is likely the link title
            if (!linkTitle && t !== adText) {
              linkTitle = t;
            } else if (linkTitle && !linkDescription && t !== adText && t !== linkTitle) {
              linkDescription = t;
              break;
            }
          }
        }
      }

      // --- Landing URL ---
      // The CTA link or the link preview usually points to the landing page
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        if (
          href &&
          !href.includes('facebook.com') &&
          !href.includes('fb.com') &&
          !href.includes('#') &&
          (href.startsWith('http') || href.startsWith('//'))
        ) {
          landingUrl = href;
          break;
        }
      }

      // Also check for l.facebook.com redirect links
      if (!landingUrl) {
        for (const link of links) {
          const href = link.getAttribute('href') || '';
          if (href.includes('l.facebook.com/l.php')) {
            try {
              const url = new URL(href);
              const u = url.searchParams.get('u');
              if (u) landingUrl = decodeURIComponent(u);
            } catch {}
          }
        }
      }

      ads.push({
        fbAdId,
        advertiserName,
        advertiserId,
        adText,
        linkTitle,
        linkDescription,
        landingUrl,
        imageUrls,
        videoThumbnailUrl,
        startedAt: startedAt ? startedAt.toISOString() : null,
        isActive,
        platforms,
        country,
      } as unknown as ScrapedAd);
    } catch {
      // Skip this card on error
      continue;
    }
  }

  // Helper used inside evaluate context
  function extractPageIdInner(href: string | null): string | null {
    if (!href) return null;
    const m = href.match(/view_all_page_id=(\d+)/);
    if (m) return m[1];
    const n = href.match(/\/(\d{5,})\/?/);
    if (n) return n[1];
    return null;
  }

  return ads;
}

// ---------------------------------------------------------------------------
// Main scraper function
// ---------------------------------------------------------------------------

export async function scrapeAdLibrary(params: {
  keyword: string;
  country?: string;
  maxAds?: number;
}): Promise<ScrapeResult> {
  const country = params.country || 'US';
  const maxAds = Math.min(params.maxAds || 25, 100);
  const errors: string[] = [];

  let browser: Browser | null = null;

  try {
    // Use system chromium (installed via Dockerfile) or env var
    const executablePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser' ;

    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });

    const page = await browser.newPage();

    // Configure page
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1920, height: 1080 });

    // Block unnecessary resources to speed up loading
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['font', 'stylesheet'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Navigate to the Ad Library
    const url = buildSearchUrl(params.keyword, country);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30_000,
    });

    // Handle cookie consent
    await dismissCookieConsent(page);

    // Wait for results to appear
    // The ad library renders results in the main content area.
    // We wait for any content that looks like search results.
    try {
      await page.waitForFunction(
        () => (document.body.innerText || '').includes('Library ID'),
        { timeout: 15_000 },
      );
    } catch {
      // Maybe no results or page structure changed
      errors.push('Timeout waiting for ad results — page may have no results or structure changed');

      // Check if there's a "no results" message
      const bodyText = await page.evaluate(() => document.body.innerText);
      if (
        bodyText.includes('No ads match') ||
        bodyText.includes('no results') ||
        bodyText.includes('0 results')
      ) {
        return { ads: [], totalFound: 0, errors };
      }
    }

    // Scroll to load more ads
    const scrollCount = Math.ceil(maxAds / 5); // ~5 ads per viewport
    for (let i = 0; i < scrollCount; i++) {
      // Expand any "See more" buttons before scrolling
      await expandSeeMoreButtons(page);

      await page.evaluate(() =>
        window.scrollTo(0, document.body.scrollHeight),
      );
      await new Promise((r) => setTimeout(r, 2000));

      // Check if we already have enough ads visible
      const currentCount = await page.evaluate(
        () => ((document.body.textContent || '').match(/Library ID/g) || []).length,
      );
      if (currentCount >= maxAds) break;
    }

    // Final expand of "See more" buttons
    await expandSeeMoreButtons(page);

    // Small delay to let content settle
    await new Promise((r) => setTimeout(r, 1000));

    // Extract total results count if available
    let totalFound = 0;
    try {
      totalFound = await page.evaluate(() => {
        const text = document.body.innerText || '';
        // Look for patterns like "About 1,234 results" or "1,234 ads"
        const match = text.match(
          /(?:about\s+)?([\d,]+)\s*(?:results|ads)/i,
        );
        if (match) return parseInt(match[1].replace(/,/g, ''), 10);
        // Count Library IDs as fallback
        return (text.match(/Library ID/g) || []).length;
      });
    } catch {
      errors.push('Could not determine total result count');
    }

    // Extract ads
    const rawAds = await page.evaluate(extractAdsFromPage, country);

    // Post-process: convert date strings back to Date objects and cap count
    // page.evaluate serializes Dates to strings, so we reconstruct them
    const ads: ScrapedAd[] = rawAds.slice(0, maxAds).map((ad) => ({
      ...ad,
      startedAt: ad.startedAt ? new Date(ad.startedAt as unknown as string) : null,
    }));

    if (totalFound === 0) {
      totalFound = ads.length;
    }

    return { ads, totalFound, errors };
  } catch (err: unknown) {
    errors.push(`Scraper error: ${err instanceof Error ? err.message : String(err)}`);
    return { ads: [], totalFound: 0, errors };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Browser may already be closed
      }
    }
  }
}

// ---------------------------------------------------------------------------
// DB mapping helper
// ---------------------------------------------------------------------------

export function mapScrapedAdToDb(ad: ScrapedAd) {
  const text = [ad.adText, ad.linkTitle, ad.linkDescription]
    .filter(Boolean)
    .join(' ');

  return {
    fbAdId: ad.fbAdId,
    advertiserName: ad.advertiserName,
    advertiserId: ad.advertiserId,
    adText: text || null,
    landingUrl: ad.landingUrl,
    countries: [ad.country],
    startedAt: ad.startedAt,
    lastSeenAt: new Date(),
    isActive: ad.isActive,
  };
}

/**
 * @deprecated Use mapScrapedAdToDb instead. Kept for backward compatibility.
 */
export function mapMetaAdToDb(
  ad: {
    id: string;
    page_name?: string;
    bylines?: string;
    page_id?: string;
    ad_creative_bodies?: string[];
    ad_creative_link_titles?: string[];
    ad_creative_link_descriptions?: string[];
    ad_delivery_start_time?: string;
    ad_delivery_stop_time?: string;
    ad_snapshot_url?: string;
  },
  countries: string[],
) {
  const text = [
    ...(ad.ad_creative_bodies || []),
    ...(ad.ad_creative_link_titles || []),
    ...(ad.ad_creative_link_descriptions || []),
  ].join(' ');

  return {
    fbAdId: ad.id,
    advertiserName: ad.page_name || ad.bylines || null,
    advertiserId: ad.page_id || null,
    adText: text || null,
    landingUrl: null as string | null,
    countries,
    startedAt: ad.ad_delivery_start_time
      ? new Date(ad.ad_delivery_start_time)
      : null,
    lastSeenAt: new Date(),
    isActive: !ad.ad_delivery_stop_time,
    snapshotUrl: ad.ad_snapshot_url || null,
  };
}
