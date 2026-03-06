import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://chrome.browserless.io?token=2U6IEsdkRTzx0PMec82d13ba1e30182a32a3136edb9ef8e3e`,
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('Loading FB Ad Library...');
  await page.goto('https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=casino&search_type=keyword_unordered', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  await new Promise(r => setTimeout(r, 4000));

  // Cookie consent
  try {
    const btns = await page.$$('button');
    for (const btn of btns) {
      const text = await btn.evaluate(b => b.textContent || '');
      if (text.toLowerCase().includes('allow') || text.toLowerCase().includes('accept')) {
        await btn.click();
        console.log('Clicked cookie:', text.trim().substring(0, 40));
        await new Promise(r => setTimeout(r, 2000));
        break;
      }
    }
  } catch (e: any) { console.log('Cookie err:', e.message); }

  await new Promise(r => setTimeout(r, 3000));

  console.log('URL:', page.url());
  const hasResults = await page.evaluate(() => {
    const t = document.body.innerText || '';
    return t.includes('Library ID') || t.includes('ID Библиотеки');
  });
  console.log('Has results:', hasResults);

  if (!hasResults) {
    const text = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log('Page text:', text);
  }

  if (hasResults) {
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(r => setTimeout(r, 2500));
    }
    const count = await page.evaluate(() => {
      const t = document.body.innerText;
      return (t.match(/Library ID/g) || []).length + (t.match(/ID Библиотеки/g) || []).length;
    });
    console.log('Ads found:', count);
  }

  await browser.disconnect();
  console.log('Done!');
}

main().catch(console.error);
