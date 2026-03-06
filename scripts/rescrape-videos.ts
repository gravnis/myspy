/**
 * Re-scrape existing ads to find video creatives.
 * Visits each ad's FB Ad Library page and matches the video by DOM Y-position.
 *
 * Usage: npx tsx scripts/rescrape-videos.ts [--limit 100]
 */
import 'dotenv/config';
import puppeteer, { Page } from 'puppeteer';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL!;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : 100;

async function extractVideoForAd(page: Page, fbAdId: string): Promise<{ videoUrl: string | null; posterUrl: string | null }> {
  try {
    await page.goto(`https://www.facebook.com/ads/library/?id=${fbAdId}`, {
      waitUntil: 'networkidle2',
      timeout: 25000,
    });
  } catch {}

  await new Promise(r => setTimeout(r, 2500));

  const result = await page.evaluate((targetId: string) => {
    // Step 1: Find the Y-position of our target Library ID
    let targetY: number | null = null;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode.textContent || '';
      if (t.includes(targetId)) {
        const el = walker.currentNode.parentElement;
        if (el) {
          targetY = el.getBoundingClientRect().top;
          break;
        }
      }
    }

    if (targetY === null) return { videoUrl: null, posterUrl: null };

    // Step 2: Find ALL videos with their Y-positions
    const videos = Array.from(document.querySelectorAll('video'));
    if (videos.length === 0) return { videoUrl: null, posterUrl: null };

    // Step 3: Find the video CLOSEST to our target ID (video should be ABOVE the ID text, within ~500px)
    let bestVideo: HTMLVideoElement | null = null;
    let bestDist = Infinity;

    for (const video of videos) {
      const videoY = video.getBoundingClientRect().top;
      // Video should be above or near the Library ID text (creative comes before ID text)
      const dist = Math.abs(targetY - videoY);
      if (dist < bestDist && videoY < targetY + 100) {
        bestDist = dist;
        bestVideo = video;
      }
    }

    if (!bestVideo || bestDist > 600) return { videoUrl: null, posterUrl: null };

    const src = bestVideo.getAttribute('src') || bestVideo.currentSrc || null;
    const poster = bestVideo.getAttribute('poster') || null;

    return {
      videoUrl: src && src.startsWith('http') ? src : null,
      posterUrl: poster && poster.startsWith('http') ? poster : null,
    };
  }, fbAdId);

  return result;
}

async function main() {
  console.log('Video Re-scraper (Y-position matched)');
  console.log(`Limit: ${LIMIT}`);

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  const res = await client.query(`
    SELECT a.id, a.fb_ad_id
    FROM ads a
    WHERE a.id NOT IN (SELECT ad_id FROM ad_creatives WHERE type = 'VIDEO')
    ORDER BY a.days_active DESC
    LIMIT $1
  `, [LIMIT]);

  console.log(`${res.rows.length} ads to check\n`);
  if (res.rows.length === 0) { await client.end(); return; }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);
  await page.setViewport({ width: 1920, height: 1080 });

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (['font', 'stylesheet'].includes(req.resourceType())) req.abort();
    else req.continue();
  });
  await page.evaluateOnNewDocument('window.__name = (fn) => fn');

  // Dismiss cookies
  try {
    await page.goto('https://www.facebook.com/ads/library/', { waitUntil: 'networkidle2', timeout: 15000 });
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => {
        const t = (b.textContent || '').toLowerCase();
        return t.includes('allow') || t.includes('accept') || t.includes('разрешить');
      });
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 2000));
  } catch {}

  let videosFound = 0, imageOnly = 0, checked = 0;

  for (const row of res.rows) {
    checked++;
    try {
      const result = await extractVideoForAd(page, row.fb_ad_id);

      if (result.videoUrl) {
        videosFound++;
        console.log(`[${checked}/${res.rows.length}] ${row.fb_ad_id}: VIDEO`);

        const existing = await client.query(
          'SELECT 1 FROM ad_creatives WHERE ad_id = $1 AND original_url = $2',
          [row.id, result.videoUrl]
        );
        if (existing.rows.length === 0) {
          await client.query(
            `INSERT INTO ad_creatives (id, ad_id, type, original_url, created_at) VALUES (gen_random_uuid(), $1, 'VIDEO', $2, NOW())`,
            [row.id, result.videoUrl]
          );
        }
      } else {
        imageOnly++;
        if (checked <= 5 || checked % 20 === 0) {
          console.log(`[${checked}/${res.rows.length}] ${row.fb_ad_id}: image only (${videosFound} vids / ${imageOnly} imgs)`);
        }
      }
    } catch (err: any) {
      console.error(`[${checked}] Error ${row.fb_ad_id}:`, err.message?.substring(0, 80));
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  await browser.close();
  await client.end();

  console.log(`\nDone! Checked: ${checked}, Videos: ${videosFound}, Image-only: ${imageOnly}`);
}

main().catch(console.error);
