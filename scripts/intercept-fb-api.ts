/**
 * Intercept FB Ad Library GraphQL — capture full request/response data
 */
import 'dotenv/config';
import puppeteer from 'puppeteer-core';
import * as fs from 'fs';

const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN!;

async function main() {
  console.log('Intercepting FB Ad Library GraphQL...\n');

  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://chrome.browserless.io?token=${BROWSERLESS_TOKEN}`,
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  await page.setViewport({ width: 1920, height: 1080 });

  const captured: any[] = [];

  await page.setRequestInterception(true);
  page.on('request', req => {
    const url = req.url();
    if (url.includes('/api/graphql') && req.method() === 'POST') {
      captured.push({
        url,
        method: req.method(),
        postData: req.postData(),
        headers: req.headers(),
      });
    }
    if (['font', 'stylesheet'].includes(req.resourceType())) req.abort();
    else req.continue();
  });

  // Capture full responses
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/api/graphql')) {
      try {
        const body = await res.text();
        const idx = captured.findIndex(c => !c.responseBody && c.url === url);
        if (idx >= 0) {
          captured[idx].responseBody = body;
          captured[idx].status = res.status();
        }
      } catch {}
    }
  });

  await page.evaluateOnNewDocument('window.__name = (fn) => fn');

  await page.goto('https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=casino&search_type=keyword_unordered', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  await new Promise(r => setTimeout(r, 6000));

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

  await new Promise(r => setTimeout(r, 3000));

  // Scroll once to get pagination query
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise(r => setTimeout(r, 4000));

  await browser.disconnect();

  // Save captured data
  console.log(`Captured ${captured.length} GraphQL calls\n`);

  for (let i = 0; i < captured.length; i++) {
    const c = captured[i];
    const friendlyName = c.headers['x-fb-friendly-name'] || 'unknown';
    console.log(`\n--- Call ${i + 1}: ${friendlyName} ---`);
    console.log(`LSD: ${c.headers['x-fb-lsd']}`);
    console.log(`Cookie: ${c.headers['cookie']?.substring(0, 200)}`);

    // Parse post data as URL params
    if (c.postData) {
      const params = new URLSearchParams(c.postData);
      console.log('\nKey POST params:');
      for (const key of ['fb_api_req_friendly_name', 'variables', 'doc_id', 'fb_api_caller_class']) {
        const val = params.get(key);
        if (val) console.log(`  ${key}: ${val.substring(0, 500)}`);
      }

      // Save full variables for analysis
      const variables = params.get('variables');
      if (variables) {
        try {
          const parsed = JSON.parse(variables);
          console.log('\nParsed variables:');
          console.log(JSON.stringify(parsed, null, 2).substring(0, 1000));
        } catch {}
      }
    }

    // Response summary
    if (c.responseBody) {
      try {
        const json = JSON.parse(c.responseBody);
        const results = json?.data?.ad_library_main?.search_results_connection;
        if (results) {
          console.log(`\nResults: ${results.edges?.length} ads`);
          if (results.edges?.[0]) {
            const firstAd = results.edges[0].node?.collated_results?.[0];
            if (firstAd) {
              console.log('First ad sample:', JSON.stringify(firstAd, null, 2).substring(0, 800));
            }
          }
          // Check for pagination cursor
          const pageInfo = results.page_info;
          if (pageInfo) {
            console.log('Page info:', JSON.stringify(pageInfo));
          }
        }
      } catch {}
    }
  }

  // Save everything to file for analysis
  fs.writeFileSync('/tmp/fb-graphql-capture.json', JSON.stringify(captured, null, 2));
  console.log('\n\nFull capture saved to /tmp/fb-graphql-capture.json');
}

main().catch(console.error);
