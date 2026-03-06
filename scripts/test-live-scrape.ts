/**
 * Full test: Browserless → FB Ad Library → parse ads → save to Neon DB
 */
import 'dotenv/config';
import puppeteer from 'puppeteer-core';
import { buildFbUrl, extractAdsFromPage, detectVertical } from '../src/lib/scraper';

const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN!;

async function main() {
  const keyword = process.argv[2] || 'casino';
  const country = process.argv[3] || 'US';

  console.log(`Scraping "${keyword}" in ${country} via Browserless...`);

  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://chrome.browserless.io?token=${BROWSERLESS_TOKEN}`,
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (['font', 'stylesheet'].includes(req.resourceType())) req.abort();
    else req.continue();
  });

  await page.evaluateOnNewDocument('window.__name = (fn) => fn');
  await page.goto(buildFbUrl(keyword, country), { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));

  // Cookie consent
  try {
    const btns = await page.$$('button');
    for (const btn of btns) {
      const text = await btn.evaluate(b => b.textContent || '');
      if (text.toLowerCase().includes('allow') || text.toLowerCase().includes('accept')) {
        await btn.click();
        await new Promise(r => setTimeout(r, 2000));
        break;
      }
    }
  } catch {}

  await new Promise(r => setTimeout(r, 2000));

  // Check for results
  const hasResults = await page.evaluate(() => {
    const t = document.body.innerText || '';
    return t.includes('Library ID') || t.includes('ID Библиотеки');
  });

  if (!hasResults) {
    console.log('No results found');
    await browser.disconnect();
    return;
  }

  // Scroll to load more
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 2500));
  }

  // Extract ads
  let ads = await extractAdsFromPage(page, country);
  await browser.disconnect();

  // Filter: only ads with creatives
  ads = ads.filter((ad: any) =>
    (ad.imageUrls && ad.imageUrls.length > 0) || (ad.videoUrls && ad.videoUrls.length > 0)
  );

  console.log(`Found ${ads.length} ads with creatives`);

  if (ads.length === 0) return;

  // Save to DB
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const vres = await client.query('SELECT id, slug FROM verticals');
  const verticalMap = new Map(vres.rows.map((v: any) => [v.slug, v.id]));

  let saved = 0, updated = 0;

  for (const ad of ads) {
    try {
      const text = [ad.adText, ad.linkTitle, ad.linkDescription].filter(Boolean).join(' ') || null;
      const daysActive = ad.startedAt ? Math.max(1, Math.floor((Date.now() - new Date(ad.startedAt).getTime()) / 86400000)) : 1;
      const vertSlug = detectVertical(text || '');
      const verticalId = vertSlug !== 'other' ? verticalMap.get(vertSlug) || null : null;

      const existing = await client.query('SELECT id, created_at, started_at FROM ads WHERE fb_ad_id = $1', [ad.fbAdId]);

      let adId: string;
      if (existing.rows.length > 0) {
        adId = existing.rows[0].id;
        const refDate = ad.startedAt ? new Date(ad.startedAt) : (existing.rows[0].started_at || existing.rows[0].created_at);
        const calcDays = Math.max(1, Math.floor((Date.now() - new Date(refDate).getTime()) / 86400000));
        await client.query(
          'UPDATE ads SET last_seen_at = NOW(), is_active = $1, days_active = $2, vertical_id = COALESCE(vertical_id, $3), started_at = COALESCE(started_at, $5) WHERE fb_ad_id = $4',
          [ad.isActive, calcDays, verticalId, ad.fbAdId, ad.startedAt ? new Date(ad.startedAt) : null]
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

      // Save creatives
      const existingCreatives = await client.query('SELECT original_url FROM ad_creatives WHERE ad_id = $1', [adId]);
      const existingUrls = new Set(existingCreatives.rows.map((r: any) => r.original_url));

      for (const url of (ad.imageUrls || [])) {
        if (!existingUrls.has(url)) {
          await client.query('INSERT INTO ad_creatives (id, ad_id, type, original_url, created_at) VALUES (gen_random_uuid(), $1, \'IMAGE\', $2, NOW())', [adId, url]);
        }
      }
      for (const url of (ad.videoUrls || [])) {
        if (!existingUrls.has(url)) {
          await client.query('INSERT INTO ad_creatives (id, ad_id, type, original_url, created_at) VALUES (gen_random_uuid(), $1, \'VIDEO\', $2, NOW())', [adId, url]);
        }
      }
    } catch (err: any) {
      if (!err.message?.includes('duplicate')) console.error('DB error:', err.message);
    }
  }

  await client.end();
  console.log(`Saved: ${saved} new, ${updated} updated`);
}

main().catch(console.error);
