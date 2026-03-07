/**
 * Test: without active_status filter + all approaches
 */
import 'dotenv/config';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function main() {
  console.log('Test 1: Without active_status filter...');

  const browser = await puppeteer.launch({
    headless: 'shell',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--lang=en-US'],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  await page.evaluateOnNewDocument('window.__name = (fn) => fn');

  // Try without active_status
  const url = 'https://www.facebook.com/ads/library/?ad_type=all&country=US&q=casino&search_type=keyword_unordered';
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 8000));

  // Cookie
  try {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => {
        const t = (b.textContent || '').toLowerCase();
        return t.includes('allow') || t.includes('accept');
      });
      if (btn) (btn as HTMLElement).click();
    });
    await new Promise(r => setTimeout(r, 3000));
  } catch {}

  await page.screenshot({ path: '/tmp/fb-test2.png', fullPage: false });

  const hasResults = await page.evaluate(() => {
    const t = document.body.innerText || '';
    return t.includes('Library ID') || t.includes('ID Библиотеки');
  });
  console.log('Without active_status - Has results:', hasResults);

  if (!hasResults) {
    // Test 2: try clicking the "Clear filters" button
    console.log('\nTest 2: Clearing filters...');
    try {
      await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a, button, span, div[role="button"]'));
        const clearBtn = links.find(el => (el.textContent || '').includes('Clear filters'));
        if (clearBtn) (clearBtn as HTMLElement).click();
      });
      await new Promise(r => setTimeout(r, 5000));
      await page.screenshot({ path: '/tmp/fb-test3.png', fullPage: false });

      const hasResults2 = await page.evaluate(() => {
        const t = document.body.innerText || '';
        return t.includes('Library ID') || t.includes('ID Библиотеки');
      });
      console.log('After clear filters - Has results:', hasResults2);
    } catch (e: any) {
      console.log('Clear filters error:', e.message);
    }

    // Test 3: Remove the Active status chip
    console.log('\nTest 3: Remove Active status chip...');
    try {
      await page.evaluate(() => {
        // Find the X button next to "Active status: Active ads"
        const closeButtons = Array.from(document.querySelectorAll('[aria-label*="Remove"], [role="button"]'));
        for (const btn of closeButtons) {
          const parent = btn.closest('[class]');
          if (parent && (parent.textContent || '').includes('Active status')) {
            (btn as HTMLElement).click();
            break;
          }
        }
      });
      await new Promise(r => setTimeout(r, 5000));
      await page.screenshot({ path: '/tmp/fb-test4.png', fullPage: false });

      const hasResults3 = await page.evaluate(() => {
        const t = document.body.innerText || '';
        return t.includes('Library ID') || t.includes('ID Библиотеки');
      });
      console.log('After remove chip - Has results:', hasResults3);

      const bodyText3 = await page.evaluate(() => document.body.innerText.substring(0, 500));
      console.log('Body:', bodyText3);
    } catch (e: any) {
      console.log('Remove chip error:', e.message);
    }
  }

  await browser.close();
}

main().catch(console.error);
