/**
 * Debug: check what fields GraphQL actually returns for ads
 */
import 'dotenv/config';
import puppeteer from 'puppeteer-core';

const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN!;

async function main() {
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://chrome.browserless.io?token=${BROWSERLESS_TOKEN}`,
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  await page.setViewport({ width: 1920, height: 1080 });

  let docId = '', lsd = '';

  await page.setRequestInterception(true);
  page.on('request', (req: any) => {
    if (req.url().includes('/api/graphql') && req.method() === 'POST') {
      if (!lsd) lsd = req.headers()['x-fb-lsd'] || '';
      const params = new URLSearchParams(req.postData() || '');
      if (params.get('fb_api_req_friendly_name') === 'AdLibrarySearchPaginationQuery') {
        docId = params.get('doc_id') || '';
      }
    }
    if (['font', 'stylesheet'].includes(req.resourceType())) req.abort();
    else req.continue();
  });

  await page.evaluateOnNewDocument('window.__name = (fn) => fn');
  await page.goto('https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=casino&search_type=keyword_unordered', {
    waitUntil: 'domcontentloaded', timeout: 25000,
  });
  await new Promise(r => setTimeout(r, 6000));

  try {
    const btns = await page.$$('button');
    for (const btn of btns) {
      const text = await btn.evaluate((b: any) => b.textContent || '');
      if (text.toLowerCase().includes('allow') || text.toLowerCase().includes('accept')) {
        await btn.click();
        await new Promise(r => setTimeout(r, 2000));
        break;
      }
    }
  } catch {}

  await new Promise(r => setTimeout(r, 2000));
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise(r => setTimeout(r, 3000));

  if (!docId) docId = '25987067537594875';

  // Get raw response
  const raw = await page.evaluate(async (params: { lsd: string; docId: string }) => {
    const variables = {
      activeStatus: 'active', adType: 'ALL', bylines: [], collationToken: null,
      contentLanguages: [], countries: ['US'], cursor: null, excludedIDs: null,
      first: 5, isTargetedCountry: false, location: null, mediaType: 'all',
      multiCountryFilterMode: null, pageIDs: [], potentialReachInput: null,
      publisherPlatforms: [], queryString: 'casino', regions: null,
      searchType: 'keyword_unordered', sessionID: crypto.randomUUID(),
      sortData: null, source: null, startDate: null, v: '5a5a19', viewAllPageID: '0',
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
    return res.text();
  }, { lsd, docId });

  await browser.disconnect();

  // Print first 2 ads in detail
  const json = JSON.parse(raw);
  const edges = json?.data?.ad_library_main?.search_results_connection?.edges || [];

  for (let i = 0; i < Math.min(2, edges.length); i++) {
    const node = edges[i].node;
    console.log(`\n=== Ad Group ${i + 1} ===`);
    console.log('Keys:', Object.keys(node));

    if (node.collated_results) {
      for (let j = 0; j < Math.min(2, node.collated_results.length); j++) {
        const ad = node.collated_results[j];
        console.log(`\n  --- Collated result ${j + 1} ---`);
        console.log('  Keys:', Object.keys(ad));
        console.log('  ad_archive_id:', ad.ad_archive_id);
        console.log('  is_active:', ad.is_active);
        console.log('  start_date:', ad.start_date);

        const snap = ad.snapshot || {};
        console.log('  Snapshot keys:', Object.keys(snap));
        console.log('  page_name:', snap.page_name);
        console.log('  body:', JSON.stringify(snap.body)?.substring(0, 200));
        console.log('  images:', JSON.stringify(snap.images)?.substring(0, 300));
        console.log('  videos:', JSON.stringify(snap.videos)?.substring(0, 300));
        console.log('  cards:', JSON.stringify(snap.cards)?.substring(0, 300));
        console.log('  link_url:', snap.link_url);
        console.log('  cta_text:', snap.cta_text);
        console.log('  link_description:', snap.link_description);
        console.log('  title:', snap.title);
      }
    }
  }
}

main().catch(console.error);
