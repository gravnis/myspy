/**
 * Smart GraphQL scraper: Browserless → GraphQL pagination → thousands of ads
 *
 * 1 Browserless session (~30 sec) = get tokens + paginate
 * Auto-reconnects for more pages. Each reconnect = 1 more unit.
 *
 * Usage: npx tsx scripts/scrape-graphql.ts [keyword] [country] [maxAds]
 * Example: npx tsx scripts/scrape-graphql.ts casino US 500
 */
import 'dotenv/config';
import puppeteer from 'puppeteer-core';
import { detectVertical } from '../src/lib/scraper';

const DATABASE_URL = process.env.DATABASE_URL!;
const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN!;

const KEYWORD = process.argv[2] || 'casino';
const COUNTRY = process.argv[3] || 'US';
const MAX_ADS = parseInt(process.argv[4] || '1000', 10);

interface SessionResult {
  ads: any[];
  lastCursor: string | null;
  hasMore: boolean;
  pagesScraped: number;
}

async function scrapeSession(keyword: string, country: string, startCursor: string | null): Promise<SessionResult> {
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://chrome.browserless.io?token=${BROWSERLESS_TOKEN}`,
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  await page.setViewport({ width: 1920, height: 1080 });

  let lsd = '';
  let docId = '';

  await page.setRequestInterception(true);
  page.on('request', (req: any) => {
    if (req.url().includes('/api/graphql') && req.method() === 'POST') {
      if (!lsd) lsd = req.headers()['x-fb-lsd'] || '';
      const params = new URLSearchParams(req.postData() || '');
      if (params.get('fb_api_req_friendly_name') === 'AdLibrarySearchPaginationQuery') {
        docId = params.get('doc_id') || '';
      }
    }
    if (['font', 'stylesheet', 'image', 'media'].includes(req.resourceType())) req.abort();
    else req.continue();
  });

  await page.evaluateOnNewDocument('window.__name = (fn) => fn');

  // Quick load to get tokens — block images/media for speed
  await page.goto(`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}&q=${encodeURIComponent(keyword)}&search_type=keyword_unordered`, {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  });

  await new Promise(r => setTimeout(r, 4000));

  // Cookie consent (quick)
  try {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => {
        const t = (b.textContent || '').toLowerCase();
        return t.includes('allow') || t.includes('accept');
      });
      if (btn) (btn as HTMLElement).click();
    });
    await new Promise(r => setTimeout(r, 1000));
  } catch {}

  // Quick scroll to trigger pagination query (get doc_id)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise(r => setTimeout(r, 2000));

  if (!docId) docId = '25987067537594875';

  // Paginate via GraphQL from browser context
  const allAds: any[] = [];
  let cursor = startCursor;
  let hasMore = true;
  let pagesScraped = 0;

  while (hasMore) {
    try {
      const result = await page.evaluate(async (params: { keyword: string; country: string; cursor: string | null; lsd: string; docId: string }) => {
        const variables = {
          activeStatus: 'active',
          adType: 'ALL',
          bylines: [],
          collationToken: null,
          contentLanguages: [],
          countries: [params.country],
          cursor: params.cursor,
          excludedIDs: null,
          first: 50,
          isTargetedCountry: false,
          location: null,
          mediaType: 'all',
          multiCountryFilterMode: null,
          pageIDs: [],
          potentialReachInput: null,
          publisherPlatforms: [],
          queryString: params.keyword,
          regions: null,
          searchType: 'keyword_unordered',
          sessionID: crypto.randomUUID(),
          sortData: null,
          source: null,
          startDate: null,
          v: '5a5a19',
          viewAllPageID: '0',
        };

        const body = new URLSearchParams({
          av: '0', __user: '0', __a: '1', lsd: params.lsd,
          fb_api_req_friendly_name: 'AdLibrarySearchPaginationQuery',
          variables: JSON.stringify(variables),
          doc_id: params.docId,
          fb_api_caller_class: 'RelayModern',
        });

        const res = await fetch('/api/graphql/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-FB-LSD': params.lsd,
          },
          body: body.toString(),
        });

        if (res.status !== 200) return { error: `HTTP ${res.status}`, ads: [], cursor: null, hasNext: false };

        const json = JSON.parse(await res.text());
        const results = json?.data?.ad_library_main?.search_results_connection;
        if (!results) return { error: 'no results', ads: [], cursor: null, hasNext: false };

        const ads: any[] = [];
        for (const edge of (results.edges || [])) {
          const node = edge.node;
          if (!node?.collated_results) continue;
          for (const ad of node.collated_results) {
            const snap = ad.snapshot || {};
            const images: string[] = [];
            const videos: string[] = [];

            for (const img of (snap.images || [])) {
              const url = img.original_image_url || img.resized_image_url;
              if (url) images.push(url);
            }
            for (const vid of (snap.videos || [])) {
              const url = vid.video_hd_url || vid.video_sd_url;
              if (url) videos.push(url);
              if (vid.video_preview_image_url) images.push(vid.video_preview_image_url);
            }
            for (const card of (snap.cards || [])) {
              if (card.original_image_url) images.push(card.original_image_url);
              else if (card.resized_image_url) images.push(card.resized_image_url);
              if (card.video_hd_url) videos.push(card.video_hd_url);
              else if (card.video_sd_url) videos.push(card.video_sd_url);
              if (card.video_preview_image_url) images.push(card.video_preview_image_url);
            }
            for (const img of (snap.extra_images || [])) {
              const url = img.original_image_url || img.resized_image_url;
              if (url) images.push(url);
            }
            for (const vid of (snap.extra_videos || [])) {
              const url = vid.video_hd_url || vid.video_sd_url;
              if (url) videos.push(url);
            }

            const countries = (ad.targeted_or_reached_countries || []).map((c: any) => c.country_code || c).filter(Boolean);

            ads.push({
              fbAdId: ad.ad_archive_id,
              pageId: ad.page_id,
              pageName: snap.page_name || ad.page_name,
              isActive: ad.is_active,
              startDate: ad.start_date,
              endDate: ad.end_date,
              publisherPlatforms: ad.publisher_platform || [],
              bodyText: snap.body?.markup?.__html || snap.body?.text || null,
              linkTitle: snap.title || snap.cta_text || null,
              linkDescription: snap.link_description || null,
              linkUrl: snap.link_url || null,
              images: Array.from(new Set(images)),
              videos: Array.from(new Set(videos)),
              countries,
            });
          }
        }

        return {
          ads,
          cursor: results.page_info?.end_cursor || null,
          hasNext: results.page_info?.has_next_page || false,
        };
      }, { keyword, country, cursor, lsd, docId });

      if (result.error) {
        // Session might be dying, save what we have
        break;
      }

      allAds.push(...result.ads);
      cursor = result.cursor;
      hasMore = result.hasNext;
      pagesScraped++;

      // Minimal delay
      await new Promise(r => setTimeout(r, 300));
    } catch {
      // Session disconnected — normal after ~30 sec
      break;
    }
  }

  try { await browser.disconnect(); } catch {}

  return { ads: allAds, lastCursor: cursor, hasMore, pagesScraped };
}

async function main() {
  console.log('MySpy GraphQL Scraper');
  console.log('=====================');
  console.log(`"${KEYWORD}" in ${COUNTRY}, max ${MAX_ADS} ads`);
  console.log('');

  const { default: pg } = await import('pg');

  // Load verticals once
  const tmpClient = new pg.Client({ connectionString: DATABASE_URL });
  await tmpClient.connect();
  const vres = await tmpClient.query('SELECT id, slug FROM verticals');
  const verticalMap = new Map(vres.rows.map((v: any) => [v.slug, v.id]));
  await tmpClient.end();

  let totalAds = 0, totalSaved = 0, totalUpdated = 0;
  let cursor: string | null = null;
  let hasMore = true;
  let sessions = 0;

  while (hasMore && totalAds < MAX_ADS) {
    sessions++;
    console.log(`Session ${sessions} (cursor: ${cursor ? cursor.substring(0, 20) + '...' : 'start'})...`);

    try {
      const result = await scrapeSession(KEYWORD, COUNTRY, cursor);
      cursor = result.lastCursor;
      hasMore = result.hasMore;

      // Filter ads with creatives
      const withCreatives = result.ads.filter((a: any) => (a.images?.length > 0) || (a.videos?.length > 0));
      totalAds += result.ads.length;
      console.log(`  +${result.ads.length} ads (${withCreatives.length} with creatives) in ${result.pagesScraped} pages (total: ${totalAds})`);

      // Save this batch to DB immediately (fresh connection each time to avoid Neon timeout)
      if (withCreatives.length > 0) {
        const dbClient = new pg.Client({ connectionString: DATABASE_URL });
        await dbClient.connect();

        let saved = 0, updated = 0;
        for (const ad of withCreatives) {
          try {
            const text = [ad.bodyText, ad.linkTitle, ad.linkDescription].filter(Boolean).join(' ') || null;
            const startedAt = ad.startDate ? new Date(ad.startDate * 1000) : null;
            const daysActive = startedAt ? Math.max(1, Math.floor((Date.now() - startedAt.getTime()) / 86400000)) : 1;
            const vertSlug = detectVertical(text || '');
            const verticalId = vertSlug !== 'other' ? verticalMap.get(vertSlug) || null : null;
            const adCountries = ad.countries?.length > 0 ? ad.countries : [COUNTRY];

            const existing = await dbClient.query('SELECT id, created_at, started_at FROM ads WHERE fb_ad_id = $1', [ad.fbAdId]);

            let adId: string;
            if (existing.rows.length > 0) {
              adId = existing.rows[0].id;
              const refDate = startedAt || existing.rows[0].started_at || existing.rows[0].created_at;
              const calcDays = Math.max(1, Math.floor((Date.now() - new Date(refDate).getTime()) / 86400000));
              await dbClient.query(
                'UPDATE ads SET last_seen_at = NOW(), is_active = $1, days_active = $2, vertical_id = COALESCE(vertical_id, $3), started_at = COALESCE(started_at, $5), countries = $6 WHERE fb_ad_id = $4',
                [ad.isActive !== false, calcDays, verticalId, ad.fbAdId, startedAt, adCountries]
              );
              updated++;
            } else {
              const insertResult = await dbClient.query(
                `INSERT INTO ads (id, fb_ad_id, advertiser_name, advertiser_id, ad_text, landing_url, countries, platforms, started_at, last_seen_at, is_active, days_active, vertical_id, created_at)
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, $11, NOW()) RETURNING id`,
                [ad.fbAdId, ad.pageName, ad.pageId, text, ad.linkUrl, adCountries, ad.publisherPlatforms || [], startedAt, ad.isActive !== false, daysActive, verticalId]
              );
              adId = insertResult.rows[0].id;
              saved++;
            }

            const existingCreatives = await dbClient.query('SELECT original_url FROM ad_creatives WHERE ad_id = $1', [adId]);
            const existingUrls = new Set(existingCreatives.rows.map((r: any) => r.original_url));

            for (const url of (ad.images || [])) {
              if (url && !existingUrls.has(url)) {
                await dbClient.query('INSERT INTO ad_creatives (id, ad_id, type, original_url, created_at) VALUES (gen_random_uuid(), $1, \'IMAGE\', $2, NOW())', [adId, url]);
                existingUrls.add(url);
              }
            }
            for (const url of (ad.videos || [])) {
              if (url && !existingUrls.has(url)) {
                await dbClient.query('INSERT INTO ad_creatives (id, ad_id, type, original_url, created_at) VALUES (gen_random_uuid(), $1, \'VIDEO\', $2, NOW())', [adId, url]);
                existingUrls.add(url);
              }
            }
          } catch (err: any) {
            if (!err.message?.includes('duplicate')) console.error('  DB error:', err.message);
          }
        }

        await dbClient.end();
        totalSaved += saved;
        totalUpdated += updated;
        console.log(`  Saved: ${saved} new, ${updated} updated (total: ${totalSaved} new, ${totalUpdated} upd)`);
      }

      if (hasMore && totalAds < MAX_ADS) {
        console.log('  Reconnecting in 5s...');
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (err: any) {
      console.error(`  Session error: ${err.message}`);
      if (err.message?.includes('429')) {
        console.log('  Rate limited, waiting 30s...');
        await new Promise(r => setTimeout(r, 30000));
      } else {
        break;
      }
    }
  }

  console.log(`\nDone! ${totalSaved} new, ${totalUpdated} updated from ${totalAds} total ads (${sessions} units used)`);
}

main().catch(console.error);
