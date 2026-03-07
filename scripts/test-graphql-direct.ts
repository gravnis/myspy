/**
 * Get fresh tokens from Browserless session, then immediately
 * test direct GraphQL calls to FB Ad Library.
 */
import 'dotenv/config';
import puppeteer from 'puppeteer-core';

const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN!;
const DOC_ID_SEARCH = '25987067537594875'; // AdLibrarySearchPaginationQuery

interface FbTokens {
  lsd: string;
  cookies: string;
  hsi: string;
  rev: string;
  s: string;
}

async function getTokens(): Promise<FbTokens> {
  console.log('Step 1: Getting fresh tokens via Browserless...');

  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://chrome.browserless.io?token=${BROWSERLESS_TOKEN}`,
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  await page.setViewport({ width: 1920, height: 1080 });

  let tokens: FbTokens = { lsd: '', cookies: '', hsi: '', rev: '', s: '' };

  await page.setRequestInterception(true);
  page.on('request', req => {
    const url = req.url();
    if (url.includes('/api/graphql') && req.method() === 'POST') {
      const headers = req.headers();
      const postData = req.postData() || '';
      const params = new URLSearchParams(postData);

      tokens.lsd = headers['x-fb-lsd'] || '';
      tokens.cookies = headers['cookie'] || '';
      tokens.hsi = params.get('__hsi') || '';
      tokens.rev = params.get('__rev') || '';
      tokens.s = params.get('__s') || '';
    }
    if (['font', 'stylesheet'].includes(req.resourceType())) req.abort();
    else req.continue();
  });

  await page.evaluateOnNewDocument('window.__name = (fn) => fn');

  await page.goto('https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=test&search_type=keyword_unordered', {
    waitUntil: 'domcontentloaded',
    timeout: 25000,
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

  await new Promise(r => setTimeout(r, 2000));
  await browser.disconnect();

  console.log(`  LSD: ${tokens.lsd.substring(0, 20)}...`);
  console.log(`  Cookie: ${tokens.cookies.substring(0, 80)}...`);
  return tokens;
}

async function fetchAdsGraphQL(tokens: FbTokens, keyword: string, country: string, cursor: string | null = null, count = 30) {
  const variables = {
    activeStatus: 'active',
    adType: 'ALL',
    bylines: [],
    collationToken: null,
    contentLanguages: [],
    countries: [country],
    cursor,
    excludedIDs: null,
    first: count,
    isTargetedCountry: false,
    location: null,
    mediaType: 'all',
    multiCountryFilterMode: null,
    pageIDs: [],
    potentialReachInput: null,
    publisherPlatforms: [],
    queryString: keyword,
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
    av: '0',
    __user: '0',
    __a: '1',
    __req: '2',
    __hs: '20518.HYP:comet_plat_default_pkg.2.1...0',
    dpr: '2',
    __ccg: 'EXCELLENT',
    __rev: tokens.rev || '1034662339',
    __hsi: tokens.hsi || '7614284371688871833',
    __s: tokens.s || '',
    lsd: tokens.lsd,
    fb_api_req_friendly_name: 'AdLibrarySearchPaginationQuery',
    variables: JSON.stringify(variables),
    doc_id: DOC_ID_SEARCH,
    fb_api_caller_class: 'RelayModern',
  });

  const res = await fetch('https://www.facebook.com/api/graphql/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
      'Cookie': tokens.cookies,
      'X-FB-LSD': tokens.lsd,
      'X-FB-Friendly-Name': 'AdLibrarySearchPaginationQuery',
      'X-ASBD-ID': '359341',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://www.facebook.com',
      'Referer': 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=' + country + '&q=' + encodeURIComponent(keyword) + '&search_type=keyword_unordered',
    },
    body: body.toString(),
  });

  const text = await res.text();

  if (res.status !== 200) {
    return { ads: [], cursor: null, hasNext: false, error: `HTTP ${res.status}: ${text.substring(0, 200)}` };
  }

  try {
    const json = JSON.parse(text);
    const results = json?.data?.ad_library_main?.search_results_connection;
    if (results) {
      return {
        ads: results.edges || [],
        cursor: results.page_info?.end_cursor || null,
        hasNext: results.page_info?.has_next_page || false,
      };
    }
    return { ads: [], cursor: null, hasNext: false, error: 'No results in response' };
  } catch {
    return { ads: [], cursor: null, hasNext: false, error: `Parse error: ${text.substring(0, 200)}` };
  }
}

async function main() {
  const tokens = await getTokens();

  if (!tokens.lsd) {
    console.log('Failed to get tokens!');
    return;
  }

  console.log('\nStep 2: Direct GraphQL calls...\n');

  // Wait a beat
  await new Promise(r => setTimeout(r, 2000));

  // Test 1: casino in US
  console.log('=== "casino" in US ===');
  const r1 = await fetchAdsGraphQL(tokens, 'casino', 'US', null, 30);
  if (r1.error) {
    console.log('Error:', r1.error);
  } else {
    console.log(`Got ${r1.ads.length} ads, hasNext: ${r1.hasNext}`);
    if (r1.ads[0]) {
      const ad = r1.ads[0].node?.collated_results?.[0];
      console.log(`  First: ${ad?.ad_archive_id} — ${ad?.snapshot?.page_name}`);
    }
  }

  await new Promise(r => setTimeout(r, 1000));

  // Test 2: different keyword
  console.log('\n=== "weight loss" in GB ===');
  const r2 = await fetchAdsGraphQL(tokens, 'weight loss', 'GB', null, 30);
  if (r2.error) {
    console.log('Error:', r2.error);
  } else {
    console.log(`Got ${r2.ads.length} ads, hasNext: ${r2.hasNext}`);
  }

  // Test 3: paginate
  if (r1.ads.length > 0 && r1.hasNext) {
    console.log('\n=== Paginating "casino" US ===');
    let total = r1.ads.length;
    let cursor = r1.cursor;
    for (let p = 2; p <= 5; p++) {
      await new Promise(r => setTimeout(r, 1000));
      const next = await fetchAdsGraphQL(tokens, 'casino', 'US', cursor, 30);
      if (next.error) { console.log(`  Page ${p}: ${next.error}`); break; }
      total += next.ads.length;
      cursor = next.cursor;
      console.log(`  Page ${p}: +${next.ads.length} (total: ${total})`);
      if (!next.hasNext) break;
    }
    console.log(`Total: ${total} ads without browser!`);
  }
}

main().catch(console.error);
