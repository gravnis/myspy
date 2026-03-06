/**
 * Local scraper — runs Puppeteer on your machine, writes to Neon DB.
 * Usage: npx tsx scripts/scrape.ts
 *
 * This same script works on Oracle VM and GitHub Actions.
 */
import 'dotenv/config';
import puppeteer from 'puppeteer';

const DATABASE_URL = process.env.DATABASE_URL!;
// Keywords grouped by vertical for better coverage
const KEYWORD_GROUPS: Record<string, string[]> = {
  gambling: [
    'gambling', 'casino', 'online casino', 'slots', 'slot machine', 'poker', 'roulette', 'blackjack',
    'казино', 'игровые автоматы', 'слоты', 'покер', 'рулетка', 'азартные игры',
  ],
  betting: [
    'betting', 'sports betting', 'bet', 'sportsbook', 'odds', 'live betting', 'football bet',
    'ставки', 'букмекер', 'ставки на спорт', 'прогнозы на спорт', 'тотализатор',
  ],
  nutra: [
    'nutra', 'weight loss', 'diet pills', 'fat burner', 'keto', 'detox', 'anti aging', 'supplement',
    'skin care', 'hair growth', 'joint pain', 'blood sugar',
    'похудение', 'диета', 'жиросжигатель', 'кето', 'детокс', 'омоложение', 'добавки',
  ],
  crypto: [
    'crypto trading', 'bitcoin', 'forex', 'binary options', 'trading platform', 'investment',
    'passive income', 'earn money online', 'financial freedom',
    'крипто', 'биткоин', 'трейдинг', 'инвестиции', 'заработок', 'пассивный доход', 'форекс',
  ],
  dating: [
    'dating app', 'dating site', 'meet singles', 'find love', 'hookup', 'relationship',
    'знакомства', 'сайт знакомств', 'найти пару',
  ],
  finance: [
    'loan', 'credit card', 'personal loan', 'fast cash', 'payday loan', 'insurance',
    'кредит', 'займ', 'быстрый кредит', 'микрозайм', 'страховка',
  ],
  ecommerce: [
    'ecommerce store', 'dropshipping', 'online shop', 'free shipping', 'sale', 'discount',
    'buy now', 'limited offer', 'интернет магазин', 'скидки', 'распродажа',
  ],
  sweepstakes: [
    'sweepstakes', 'giveaway', 'win prize', 'free iphone', 'spin wheel', 'lucky winner',
    'розыгрыш', 'конкурс', 'выиграй', 'приз', 'бесплатный айфон',
  ],
  gaming: [
    'mobile game', 'play now', 'free game', 'strategy game', 'RPG', 'online game',
    'мобильная игра', 'играть бесплатно', 'стратегия',
  ],
};

const ALL_KEYWORDS = Object.values(KEYWORD_GROUPS).flat();

const COUNTRIES = [
  'US', 'GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'CH',  // Tier 1
  'UA', 'RU', 'PL', 'CZ', 'RO', 'HU', 'BG',                     // Eastern Europe
  'BR', 'MX', 'AR', 'CO',                                          // LATAM
  'IN', 'PH', 'TH', 'VN', 'ID',                                   // Asia
  'AU', 'CA', 'NZ', 'ZA', 'NG', 'KE',                            // Other
];

// Shuffle array (Fisher-Yates)
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build work items — each run takes a random batch
const MAX_COMBOS = parseInt(process.env.MAX_COMBOS || '0', 10);  // 0 = all

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function buildUrl(keyword: string, country: string) {
  const params = new URLSearchParams({
    active_status: 'active',
    ad_type: 'all',
    country,
    q: keyword,
    search_type: 'keyword_unordered',
  });
  return `https://www.facebook.com/ads/library/?${params}`;
}

async function scrapeKeyword(keyword: string, country: string): Promise<any[]> {
  console.log(`  Scraping "${keyword}" in ${country}...`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1920, height: 1080 });

    // Block fonts/styles for speed
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['font', 'stylesheet'].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    // Define __name helper that tsx/esbuild injects but doesn't exist in browser context
    await page.evaluateOnNewDocument('window.__name = (fn) => fn');

    await page.goto(buildUrl(keyword, country), { waitUntil: 'networkidle2', timeout: 30000 });

    // Dismiss cookie consent
    try {
      const selectors = [
        'button[data-cookiebanner="accept_button"]',
        'button[title="Allow all cookies"]',
        'button[title="Accept All"]',
        '[aria-label="Allow all cookies"]',
      ];
      for (const sel of selectors) {
        const btn = await page.$(sel);
        if (btn) { await btn.click(); await new Promise(r => setTimeout(r, 1000)); break; }
      }
    } catch {}

    // Dismiss cookie banner
    try {
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => {
          const t = (b.textContent || '').toLowerCase();
          return t.includes('allow') || t.includes('accept') || t.includes('разрешить') || t.includes('принять');
        });
        if (btn) btn.click();
      });
      await new Promise(r => setTimeout(r, 2000));
    } catch {}

    // Wait for results (supports both English and Russian UI)
    try {
      await page.waitForFunction(
        () => {
          const t = document.body.innerText || '';
          return t.includes('Library ID') || t.includes('ID Библиотеки') || t.includes('Идентификатор');
        },
        { timeout: 30000 }
      );
    } catch {
      console.log(`    No results for "${keyword}" in ${country}`);
      return [];
    }

    // Wait a bit more for initial content
    await new Promise(r => setTimeout(r, 3000));

    // Scroll to load more
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(r => setTimeout(r, 3000));
    }

    // Expand "See more" buttons
    await page.evaluate(() => {
      document.querySelectorAll('div[role="button"], span[role="button"], a, span').forEach((el) => {
        if ((el.textContent || '').trim().toLowerCase() === 'see more') (el as HTMLElement).click();
      });
    });
    await new Promise(r => setTimeout(r, 500));

    // Extract ads
    const ads = await page.evaluate((c: string) => {
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

          // Advertiser
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

          // Date
          let startedAt: string | null = null;
          const dateMatch = text.match(/[Ss]tarted running on\s+(\w+\s+\d{1,2},?\s+\d{4})/) || text.match(/Показ начат\s+(\d{1,2}\s+\S+\s+\d{4})/);

          if (dateMatch) {
            try { const d = new Date(dateMatch[1]); if (!isNaN(d.getTime())) startedAt = d.toISOString(); } catch {}
          }

          // Platforms
          let platforms: string[] = [];
          const platMatch = text.match(/(?:[Rr]unning on|[Pp]latforms?:?)\s*([A-Za-z, &]+?)(?:\.|$|\n)/);
          if (platMatch) {
            platforms = platMatch[1].split(/[,&]/).map(p => p.trim()).filter(p =>
              ['facebook','instagram','messenger','audience network','meta','whatsapp'].includes(p.toLowerCase())
            );
          }

          const isActive = text.toLowerCase().includes('active') && !text.toLowerCase().includes('inactive');

          // Images — only real ad creatives (not avatars/logos/icons)
          const imageUrls: string[] = [];
          card.querySelectorAll('img').forEach(img => {
            const src = img.getAttribute('src') || '';
            if (!src || src.startsWith('data:')) return;
            // Skip tiny FB CDN thumbnails (avatars: s60x60, s100x100, p50x50, p75x75)
            // But keep real creatives (s600x600, s1080x1080 etc)
            const sizeMatch = src.match(/[_&?](s|p)(\d+)x(\d+)/);
            if (sizeMatch) {
              const dim = Math.max(parseInt(sizeMatch[2]), parseInt(sizeMatch[3]));
              if (dim < 200) return; // Skip anything under 200px in URL
            }
            // Skip small rendered images
            const w = img.width || img.naturalWidth || 0;
            const h = img.height || img.naturalHeight || 0;
            if (w < 100 && h < 100) return;
            // Skip profile pictures (circular containers)
            const parent = img.parentElement;
            const parentStyle = parent ? getComputedStyle(parent) : null;
            if (parentStyle?.borderRadius === '50%') return;
            imageUrls.push(src);
          });

          // Ad text
          let adText: string | null = null;
          const textDivs = Array.from(card.querySelectorAll('div[style*="webkit-line-clamp"], div[dir="auto"], span[dir="auto"]'));
          const candidates: string[] = [];
          for (const td of textDivs) {
            const t = (td.textContent || '').trim();
            if (t.length > 20 && !t.includes('Library ID') && !t.includes('ID Библиотеки') && !t.includes('Started running') && !t.includes('Показ начат')) candidates.push(t);
          }
          if (candidates.length > 0) adText = candidates.sort((a, b) => b.length - a.length)[0];

          // Landing URL
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
            landingUrl, imageUrls, videoThumbnailUrl: null,
            startedAt, isActive, platforms, country: c,
          });
        } catch { continue; }
      }
      return results;
    }, country);

    console.log(`    Found ${ads.length} ads`);
    return ads;
  } finally {
    await browser.close();
  }
}

// Vertical detection (same logic as src/lib/utils.ts)
const VERTICAL_KW: Record<string, string[]> = {
  gambling: ['casino', 'slot machine', 'jackpot', 'roulette', 'blackjack', 'poker', 'gambling', 'казино', 'слот', 'рулетка', 'покер', 'игровые автоматы', 'азартн'],
  nutra: ['weight loss', 'diet pill', 'fat burner', 'keto diet', 'detox', 'anti-aging', 'supplement', 'skin care', 'hair growth', 'joint pain', 'blood sugar', 'похудение', 'жиросжигат', 'крем от', 'омолож'],
  crypto: ['bitcoin', 'cryptocurrency', 'crypto trading', 'blockchain', 'ethereum', 'btc', 'forex trading', 'trading platform', 'биткоин', 'криптовалют', 'трейдинг'],
  dating: ['dating app', 'dating site', 'meet singles', 'find love', 'hookup', 'знакомства', 'сайт знакомств'],
  ecom: ['free shipping', 'add to cart', 'order now', 'limited offer', 'shop now', 'buy now', 'интернет магазин', 'распродажа', 'купить сейчас'],
  finance: ['personal loan', 'credit card', 'payday loan', 'fast cash', 'insurance', 'mortgage', 'микрозайм', 'быстрый кредит'],
};

function detectVertical(text: string): string {
  if (!text) return 'other';
  const lower = text.toLowerCase();
  let best = 'other', bestScore = 0;
  for (const [v, kws] of Object.entries(VERTICAL_KW)) {
    const score = kws.filter(k => lower.includes(k)).length;
    if (score > bestScore) { bestScore = score; best = v; }
  }
  return best;
}

let verticalMap: Map<string, string> | null = null;

async function saveToDb(ads: any[]) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  // Load vertical IDs once
  if (!verticalMap) {
    const vres = await client.query('SELECT id, slug FROM verticals');
    verticalMap = new Map(vres.rows.map((v: any) => [v.slug, v.id]));
  }

  let saved = 0, updated = 0;

  for (const ad of ads) {
    try {
      const text = [ad.adText, ad.linkTitle, ad.linkDescription].filter(Boolean).join(' ') || null;
      const daysActive = ad.startedAt ? Math.max(1, Math.floor((Date.now() - new Date(ad.startedAt).getTime()) / 86400000)) : 0;
      const vertSlug = detectVertical(text || '');
      const verticalId = vertSlug !== 'other' ? verticalMap.get(vertSlug) || null : null;

      const existing = await client.query('SELECT id FROM ads WHERE fb_ad_id = $1', [ad.fbAdId]);

      let adId: string;
      if (existing.rows.length > 0) {
        adId = existing.rows[0].id;
        await client.query(
          'UPDATE ads SET last_seen_at = NOW(), is_active = $1, days_active = $2, vertical_id = COALESCE(vertical_id, $3) WHERE fb_ad_id = $4',
          [ad.isActive, daysActive, verticalId, ad.fbAdId]
        );
        updated++;
      } else {
        const insertResult = await client.query(
          `INSERT INTO ads (id, fb_ad_id, advertiser_name, advertiser_id, ad_text, landing_url, countries, platforms, started_at, last_seen_at, is_active, days_active, vertical_id, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, $11, NOW()) RETURNING id`,
          [ad.fbAdId, ad.advertiserName, ad.advertiserId, text, ad.landingUrl, [ad.country], ad.platforms || [], ad.startedAt ? new Date(ad.startedAt) : null, ad.isActive, daysActive, verticalId]
        );
        adId = insertResult.rows[0].id;
        saved++;
      }

      // Save image creatives
      if (ad.imageUrls && ad.imageUrls.length > 0) {
        const existingCreatives = await client.query('SELECT original_url FROM ad_creatives WHERE ad_id = $1', [adId]);
        const existingUrls = new Set(existingCreatives.rows.map((r: any) => r.original_url));
        for (const url of ad.imageUrls) {
          if (!existingUrls.has(url)) {
            await client.query(
              `INSERT INTO ad_creatives (id, ad_id, type, original_url, created_at) VALUES (gen_random_uuid(), $1, 'IMAGE', $2, NOW())`,
              [adId, url]
            );
          }
        }
      }
    } catch (err: any) {
      if (!err.message?.includes('duplicate')) console.error('    DB error:', err.message);
    }
  }

  await client.end();
  return { saved, updated };
}

async function main() {
  console.log('MySpy Local Scraper');
  console.log('===================');
  console.log(`DB: ${DATABASE_URL.replace(/:[^@]+@/, ':***@')}`);

  // Build all keyword-country combos
  let combos: { keyword: string; country: string }[] = [];
  for (const keyword of ALL_KEYWORDS) {
    for (const country of COUNTRIES) {
      combos.push({ keyword, country });
    }
  }

  // Shuffle for randomness
  combos = shuffle(combos);

  // Limit if MAX_COMBOS is set (for GitHub Actions 30-min runs)
  if (MAX_COMBOS > 0) {
    combos = combos.slice(0, MAX_COMBOS);
  }

  console.log(`Total keywords: ${ALL_KEYWORDS.length}, Countries: ${COUNTRIES.length}`);
  console.log(`Combos this run: ${combos.length} / ${ALL_KEYWORDS.length * COUNTRIES.length}`);
  console.log('');

  let totalSaved = 0, totalUpdated = 0;

  for (let i = 0; i < combos.length; i++) {
    const { keyword, country } = combos[i];
    console.log(`[${i + 1}/${combos.length}]`);
    try {
      const ads = await scrapeKeyword(keyword, country);
      if (ads.length > 0) {
        const { saved, updated } = await saveToDb(ads);
        totalSaved += saved;
        totalUpdated += updated;
        console.log(`    Saved: ${saved} new, ${updated} updated`);
      }
      // Delay between requests
      await new Promise(r => setTimeout(r, 2000));
    } catch (err: any) {
      console.error(`  Error scraping "${keyword}" in ${country}:`, err.message);
    }
  }

  console.log('');
  console.log(`Done! Total: ${totalSaved} new ads, ${totalUpdated} updated`);
}

main().catch(console.error);
