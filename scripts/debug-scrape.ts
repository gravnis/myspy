import 'dotenv/config';
import puppeteer from 'puppeteer';

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1920, height: 1080 });

  // Block heavy resources
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (['font', 'stylesheet', 'media'].includes(req.resourceType())) req.abort();
    else req.continue();
  });

  const url = 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=casino&search_type=keyword_unordered';
  console.log('Navigating to:', url);

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
  console.log('Page loaded, waiting for content...');

  // Dismiss cookie banner first
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
    console.log('Cookie banner handled');
  } catch {}

  // Wait longer for content - try multiple times
  for (let attempt = 0; attempt < 6; attempt++) {
    console.log(`  Waiting for ads to load... attempt ${attempt + 1}/6`);
    await new Promise(r => setTimeout(r, 5000));

    const text = await page.evaluate(() => document.body.innerText);
    const hasLibraryId = text.includes('Library ID') || text.includes('Идентификатор');
    const count = (text.match(/Library ID|Идентификатор/g) || []).length;
    console.log(`  Found ${count} Library ID mentions`);

    if (count > 0) {
      console.log('Content loaded!');
      break;
    }

    // Scroll to trigger lazy loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }

  await page.screenshot({ path: '/tmp/fb-adlib-debug2.png', fullPage: true });
  console.log('Screenshot saved to /tmp/fb-adlib-debug2.png');

  const finalText = await page.evaluate(() => document.body.innerText);
  console.log('\nPage text (first 3000 chars):');
  console.log(finalText.slice(0, 3000));

  const idCount = (finalText.match(/Library ID|Идентификатор/g) || []).length;
  console.log(`\nTotal Library ID mentions: ${idCount}`);

  await browser.close();
}

main().catch(console.error);
