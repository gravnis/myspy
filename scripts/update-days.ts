/**
 * Updates days_active for existing ads by checking FB Ad Library.
 * Goes through ads in DB, fetches their FB Ad Library page, parses "Started running on" date.
 * Usage: npx tsx scripts/update-days.ts
 */
import 'dotenv/config';
import puppeteer from 'puppeteer';

const DATABASE_URL = process.env.DATABASE_URL!;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '50', 10);

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function main() {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  // Get ads that need date updates (started_at IS NULL)
  const res = await client.query(
    'SELECT id, fb_ad_id FROM ads WHERE started_at IS NULL ORDER BY created_at DESC LIMIT $1',
    [BATCH_SIZE]
  );

  console.log(`Found ${res.rows.length} ads to update`);
  if (res.rows.length === 0) { await client.end(); return; }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  let updated = 0, failed = 0;

  // Process in mini-batches of 5 (one page, multiple ads)
  for (let i = 0; i < res.rows.length; i++) {
    const ad = res.rows[i];
    try {
      console.log(`[${i + 1}/${res.rows.length}] Checking ad ${ad.fb_ad_id}...`);

      const page = await browser.newPage();
      await page.setUserAgent(USER_AGENT);

      // Block heavy resources
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (['font', 'stylesheet', 'image', 'media'].includes(req.resourceType())) req.abort();
        else req.continue();
      });

      await page.evaluateOnNewDocument('window.__name = (fn) => fn');

      const url = `https://www.facebook.com/ads/library/?id=${ad.fb_ad_id}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });

      // Dismiss cookies
      try {
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const btn = buttons.find(b => {
            const t = (b.textContent || '').toLowerCase();
            return t.includes('allow') || t.includes('accept');
          });
          if (btn) btn.click();
        });
        await new Promise(r => setTimeout(r, 1500));
      } catch {}

      // Wait for content
      try {
        await page.waitForFunction(
          () => document.body.innerText.includes('Started running') || document.body.innerText.includes('Показ начат'),
          { timeout: 15000 }
        );
      } catch {
        // No date found — might be inactive/removed
        console.log(`  No date found for ${ad.fb_ad_id}`);
        await page.close();
        failed++;
        continue;
      }

      // Extract date
      const dateInfo = await page.evaluate(() => {
        const text = document.body.innerText;
        const patterns = [
          /[Ss]tarted running on\s+(\w+\s+\d{1,2},?\s+\d{4})/,
          /[Ss]tarted running on\s+(\d{1,2}\s+\w+\s+\d{4})/,
          /Показ начат\s+(\d{1,2}\s+\S+\s+\d{4})/,
          /Started\s+(\w+\s+\d{1,2},?\s+\d{4})/,
        ];
        for (const pat of patterns) {
          const m = text.match(pat);
          if (m) {
            try {
              const d = new Date(m[1]);
              if (!isNaN(d.getTime())) return d.toISOString();
            } catch {}
          }
        }
        return null;
      });

      await page.close();

      if (dateInfo) {
        const startedAt = new Date(dateInfo);
        const daysActive = Math.max(1, Math.floor((Date.now() - startedAt.getTime()) / 86400000));
        await client.query(
          'UPDATE ads SET started_at = $1, days_active = $2 WHERE id = $3',
          [startedAt, daysActive, ad.id]
        );
        console.log(`  Updated: started ${startedAt.toISOString().split('T')[0]}, ${daysActive} days active`);
        updated++;
      } else {
        failed++;
      }

      // Small delay
      await new Promise(r => setTimeout(r, 1000));
    } catch (err: any) {
      console.error(`  Error: ${err.message}`);
      failed++;
    }
  }

  await browser.close();
  await client.end();
  console.log(`\nDone! Updated: ${updated}, Failed: ${failed}`);
}

main().catch(console.error);
