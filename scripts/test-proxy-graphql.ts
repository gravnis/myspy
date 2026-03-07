/**
 * Test: FB GraphQL through SOCKS5 proxy — no browser at all
 * Single test, minimal requests
 */
import 'dotenv/config';
import { SocksProxyAgent } from 'socks-proxy-agent';
import https from 'https';

const PROXY = 'socks5://u1141:AoKctJjZ@31.43.60.37:11114';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

function httpsGet(url: string, headers: Record<string, string>, agent: any): Promise<{ status: number; headers: any; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      agent,
      headers: { ...headers, Host: parsed.hostname },
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function httpsPost(url: string, headers: Record<string, string>, data: string, agent: any): Promise<{ status: number; headers: any; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      agent,
      headers: { ...headers, Host: parsed.hostname, 'Content-Length': Buffer.byteLength(data).toString() },
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

function extractCookies(headers: any): string[] {
  const sc = headers['set-cookie'];
  if (!sc) return [];
  return Array.isArray(sc) ? sc : [sc];
}

async function main() {
  const agent = new SocksProxyAgent(PROXY);

  // Step 1: Get FB page (will get challenge)
  console.log('Step 1: Loading FB Ad Library...');
  const r1 = await httpsGet(
    'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=casino&search_type=keyword_unordered',
    { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
    agent
  );
  console.log('Status:', r1.status, 'Size:', r1.body.length);
  const cookies1 = extractCookies(r1.headers);
  console.log('Cookies:', cookies1.map(c => c.split(';')[0]));

  // Check for challenge
  const challengeMatch = r1.body.match(/fetch\('([^']+)'/);
  if (!challengeMatch) {
    console.log('No challenge! Checking for LSD...');
    const lsd = r1.body.match(/"LSD",\[\],\{"token":"([^"]+)/);
    console.log('LSD:', lsd ? lsd[1].substring(0, 20) : 'not found');
    console.log('Snippet:', r1.body.substring(0, 500));
    return;
  }

  // Step 2: Solve challenge
  console.log('\nStep 2: Solving challenge...');
  const challengeUrl = 'https://www.facebook.com' + challengeMatch[1];
  const cookieStr = cookies1.map(c => c.split(';')[0]).join('; ');

  const r2 = await httpsPost(challengeUrl, { 'User-Agent': UA, 'Cookie': cookieStr }, '', agent);
  console.log('Challenge status:', r2.status);
  const cookies2 = extractCookies(r2.headers);
  console.log('New cookies:', cookies2.map(c => c.split(';')[0]));

  // Step 3: Reload with cookies
  console.log('\nStep 3: Reloading...');
  const allCookieStr = [...cookies1, ...cookies2].map(c => c.split(';')[0]).join('; ');

  const r3 = await httpsGet(
    'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=casino&search_type=keyword_unordered',
    { 'User-Agent': UA, 'Cookie': allCookieStr, 'Accept-Language': 'en-US,en;q=0.9' },
    agent
  );
  console.log('Size:', r3.body.length, 'bytes');
  const cookies3 = extractCookies(r3.headers);

  const lsdMatch = r3.body.match(/"LSD",\[\],\{"token":"([^"]+)/);
  if (!lsdMatch) {
    console.log('No LSD found.');
    // Check if another challenge
    if (r3.body.includes('executeChallenge')) {
      console.log('Got another challenge. May need more rounds.');
    }
    console.log('Snippet:', r3.body.substring(0, 500));
    return;
  }

  const lsd = lsdMatch[1];
  console.log('LSD:', lsd.substring(0, 20) + '...');

  // Step 4: ONE GraphQL request
  console.log('\nStep 4: GraphQL test (1 request)...');
  const finalCookies = [...cookies1, ...cookies2, ...cookies3].map(c => c.split(';')[0]).join('; ');

  const variables = JSON.stringify({
    activeStatus: 'active', adType: 'ALL', bylines: [], collationToken: null,
    contentLanguages: [], countries: ['US'], cursor: null, excludedIDs: null,
    first: 5, isTargetedCountry: false, location: null, mediaType: 'all',
    multiCountryFilterMode: null, pageIDs: [], potentialReachInput: null,
    publisherPlatforms: [], queryString: 'casino', regions: null,
    searchType: 'keyword_unordered', sessionID: crypto.randomUUID(),
    sortData: null, source: null, startDate: null, v: '5a5a19', viewAllPageID: '0',
  });

  const postData = new URLSearchParams({
    av: '0', __user: '0', __a: '1', lsd,
    fb_api_req_friendly_name: 'AdLibrarySearchPaginationQuery',
    variables,
    doc_id: '25987067537594875',
    fb_api_caller_class: 'RelayModern',
  }).toString();

  const r4 = await httpsPost('https://www.facebook.com/api/graphql/', {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': UA,
    'Cookie': finalCookies,
    'X-FB-LSD': lsd,
    'X-FB-Friendly-Name': 'AdLibrarySearchPaginationQuery',
    'Origin': 'https://www.facebook.com',
    'Referer': 'https://www.facebook.com/ads/library/',
  }, postData, agent);

  console.log('GraphQL status:', r4.status);
  console.log('Response size:', r4.body.length);

  try {
    const json = JSON.parse(r4.body);
    const edges = json?.data?.ad_library_main?.search_results_connection?.edges;
    if (edges) {
      console.log(`\n*** SUCCESS! ${edges.length} ad groups via proxy + GraphQL — NO BROWSER! ***`);
      const firstAd = edges[0]?.node?.collated_results?.[0];
      if (firstAd) {
        console.log(`First: ${firstAd.ad_archive_id} — ${firstAd.snapshot?.page_name}`);
      }
    } else if (json.errors) {
      console.log('GraphQL errors:', JSON.stringify(json.errors).substring(0, 300));
    } else {
      console.log('Unexpected:', r4.body.substring(0, 300));
    }
  } catch {
    console.log('Not JSON:', r4.body.substring(0, 300));
  }
}

main().catch(console.error);
