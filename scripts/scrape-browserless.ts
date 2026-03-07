/**
 * Background scraper via Browserless.io
 * Runs through keyword+country combos, saves to DB.
 * Usage: npx tsx scripts/scrape-browserless.ts [maxCombos]
 *
 * Each combo uses ~1 Browserless unit (30 sec).
 * Free tier: 1000 units/month. Concurrency limit: 2.
 */
import 'dotenv/config';
import puppeteer from 'puppeteer-core';
import { buildFbUrl, extractAdsFromPage, detectVertical } from '../src/lib/scraper';

const DATABASE_URL = process.env.DATABASE_URL!;
const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN!;
const MAX_COMBOS = parseInt(process.argv[2] || process.env.MAX_COMBOS || '30', 10);

// Massive keyword list for maximum coverage
const KEYWORDS = [
  // Gambling
  'casino', 'online casino', 'slots', 'slot machine', 'poker', 'roulette', 'blackjack',
  'jackpot', 'gambling', 'casino bonus', 'free spins', 'live casino', 'baccarat',
  // Betting
  'betting', 'sports betting', 'bet', 'sportsbook', 'football bet', 'live betting',
  'odds', 'bet365', '1xbet', 'bookmaker', 'accumulator bet', 'horse racing bet',
  // Nutra / Health
  'weight loss', 'diet pills', 'fat burner', 'keto', 'detox', 'anti aging',
  'supplement', 'skin care', 'hair growth', 'joint pain', 'blood sugar', 'cbd oil',
  'testosterone booster', 'muscle supplement', 'collagen', 'probiotics', 'eye health',
  'hearing aid', 'brain supplement', 'energy boost', 'metabolism booster',
  // Crypto / Finance
  'crypto trading', 'bitcoin', 'forex', 'trading platform', 'investment',
  'passive income', 'earn money online', 'financial freedom', 'ethereum', 'nft',
  'binary options', 'stock trading', 'crypto wallet', 'defi', 'mining bitcoin',
  // Finance / Loans
  'loan', 'personal loan', 'credit card', 'fast cash', 'payday loan', 'insurance',
  'mortgage', 'debt relief', 'credit score', 'refinance', 'business loan',
  // Dating
  'dating app', 'dating site', 'meet singles', 'find love', 'hookup', 'relationship',
  'mature dating', 'senior dating', 'christian dating', 'asian dating', 'local singles',
  // Ecommerce
  'dropshipping', 'online shop', 'free shipping', 'sale', 'discount', 'buy now',
  'limited offer', 'flash sale', 'shopify store', 'amazon deals', 'aliexpress',
  'gadget', 'smart watch', 'wireless earbuds', 'phone case', 'led lights',
  // Sweepstakes
  'free iphone', 'win prize', 'giveaway', 'sweepstakes', 'spin wheel', 'lucky winner',
  'gift card', 'free samsung', 'contest', 'reward',
  // Gaming / Apps
  'mobile game', 'play now', 'free game', 'strategy game', 'RPG game', 'online game',
  'puzzle game', 'action game', 'simulation game', 'idle game',
  // VPN / Software
  'vpn', 'antivirus', 'password manager', 'cloud storage', 'photo editor',
  'video editor', 'ai tool', 'chatbot', 'productivity app',
  // Education / Courses
  'online course', 'learn english', 'coding bootcamp', 'certification', 'masterclass',
  'make money', 'side hustle', 'freelancing', 'work from home', 'affiliate marketing',
  // Real Estate
  'real estate', 'property investment', 'house for sale', 'apartment rent',
  // Insurance
  'car insurance', 'life insurance', 'health insurance', 'travel insurance',
  // Russian keywords
  'казино', 'ставки', 'букмекер', 'похудение', 'крипто', 'биткоин', 'трейдинг',
  'знакомства', 'кредит', 'займ', 'заработок', 'игра', 'скидки', 'распродажа',
  'форекс', 'инвестиции', 'vpn скачать', 'курсы', 'обучение',
];

const COUNTRIES = [
  'US', 'GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'UA', 'PL', 'BR', 'IN', 'AU', 'CA',
  'AT', 'CH', 'BE', 'CZ', 'RO', 'MX', 'PH', 'TH', 'ZA', 'NG', 'AR', 'CO',
  'SE', 'NO', 'DK', 'FI', 'PT', 'IE', 'NZ',
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function connectWithRetry(token: string, maxRetries = 3): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const browser = await puppeteer.connect({
        browserWSEndpoint: `wss://chrome.browserless.io?token=${token}`,
      });
      return browser;
    } catch (err: any) {
      if (err.message?.includes('429') && attempt < maxRetries) {
        const delay = attempt * 15000; // 15s, 30s, 45s
        console.log(`  429 rate limit, retry ${attempt}/${maxRetries} in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

async function main() {
  console.log('MySpy Browserless Scraper');
  console.log('========================');
  console.log(`Started: ${new Date().toLocaleString()}`);

  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  // Get keywords from DB (user searches) + merge with hardcoded
  const kwRes = await client.query('SELECT keyword FROM search_keywords WHERE is_active = true');
  const dbKeywords = kwRes.rows.map((r: any) => r.keyword);
  const allKeywords = Array.from(new Set([...KEYWORDS, ...dbKeywords]));

  // Build combos
  let combos: { keyword: string; country: string }[] = [];
  for (const keyword of allKeywords) {
    for (const country of COUNTRIES) {
      combos.push({ keyword, country });
    }
  }
  combos = shuffle(combos).slice(0, MAX_COMBOS);

  console.log(`Keywords: ${allKeywords.length}, Countries: ${COUNTRIES.length}`);
  console.log(`Total possible combos: ${allKeywords.length * COUNTRIES.length}`);
  console.log(`Combos this run: ${combos.length} (max ${MAX_COMBOS})`);
  console.log('');

  // Load verticals
  const vres = await client.query('SELECT id, slug FROM verticals');
  const verticalMap = new Map(vres.rows.map((v: any) => [v.slug, v.id]));

  let totalSaved = 0, totalUpdated = 0, errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < combos.length; i++) {
    const { keyword, country } = combos[i];
    const elapsed = (Date.now() - startTime) / 1000;
    const avgPerCombo = i > 0 ? elapsed / i : 60;
    const remaining = Math.round(avgPerCombo * (combos.length - i) / 60);
    console.log(`[${i + 1}/${combos.length}] "${keyword}" in ${country} | +${totalSaved} new, ${totalUpdated} upd | ETA: ~${remaining}min`);

    try {
      const browser = await connectWithRetry(BROWSERLESS_TOKEN);

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setRequestInterception(true);
      page.on('request', (req: any) => {
        if (['font', 'stylesheet'].includes(req.resourceType())) req.abort();
        else req.continue();
      });
      await page.evaluateOnNewDocument('window.__name = (fn) => fn');

      await page.goto(buildFbUrl(keyword, country), { waitUntil: 'domcontentloaded', timeout: 25000 });
      await new Promise(r => setTimeout(r, 4000));

      // Cookie consent
      try {
        const btns = await page.$$('button');
        for (const btn of btns) {
          const text = await btn.evaluate((b: any) => b.textContent || '');
          if (text.toLowerCase().includes('allow') || text.toLowerCase().includes('accept')) {
            await btn.click();
            await new Promise(r => setTimeout(r, 1500));
            break;
          }
        }
      } catch {}

      await new Promise(r => setTimeout(r, 2000));

      const hasResults = await page.evaluate(() => {
        const t = document.body.innerText || '';
        return t.includes('Library ID') || t.includes('ID Библиотеки');
      });

      if (!hasResults) {
        console.log('  No results');
        await browser.disconnect();
        // Wait before next combo to avoid 429
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }

      // Scroll aggressively to load more ads
      for (let s = 0; s < 12; s++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 2000));
      }

      let ads = await extractAdsFromPage(page, country);
      await browser.disconnect();

      ads = ads.filter((ad: any) =>
        (ad.imageUrls && ad.imageUrls.length > 0) || (ad.videoUrls && ad.videoUrls.length > 0)
      );

      if (ads.length === 0) {
        console.log('  No ads with creatives');
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }

      // Save to DB
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
          if (!err.message?.includes('duplicate')) console.error('  DB error:', err.message);
        }
      }

      totalSaved += saved;
      totalUpdated += updated;
      console.log(`  Found ${ads.length} → ${saved} new, ${updated} updated`);

      // Delay between combos to respect concurrency limit (2 max)
      await new Promise(r => setTimeout(r, 8000));
    } catch (err: any) {
      errors++;
      console.error(`  Error: ${err.message}`);
      // On error wait longer before retry
      await new Promise(r => setTimeout(r, 10000));
    }
  }

  await client.end();
  const totalMin = Math.round((Date.now() - startTime) / 60000);
  console.log(`\nDone in ${totalMin} min! Total: ${totalSaved} new, ${totalUpdated} updated, ${errors} errors`);
}

main().catch(console.error);
