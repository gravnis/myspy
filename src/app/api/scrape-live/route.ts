/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import { prisma } from '@/lib/db';
import { buildFbUrl, extractAdsFromPage, detectVertical } from '@/lib/scraper';

const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Simple in-memory lock to prevent parallel scrapes for same query
const activeScrapes = new Set<string>();

export async function GET(request: NextRequest) {
  if (!BROWSERLESS_TOKEN) {
    return NextResponse.json({ error: 'Browserless not configured' }, { status: 503 });
  }

  const q = request.nextUrl.searchParams.get('q');
  const country = request.nextUrl.searchParams.get('country') || 'US';

  if (!q || q.length < 2) {
    return NextResponse.json({ error: 'q param required (min 2 chars)' }, { status: 400 });
  }

  const lockKey = `${q}:${country}`;
  if (activeScrapes.has(lockKey)) {
    return NextResponse.json({ status: 'already_running' });
  }

  activeScrapes.add(lockKey);

  try {
    const browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${BROWSERLESS_TOKEN}`,
    });

    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1920, height: 1080 });

    // Block heavy resources for speed
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['font', 'stylesheet'].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    const url = buildFbUrl(q, country);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });

    // Dismiss cookies
    try {
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => {
          const t = (b.textContent || '').toLowerCase();
          return t.includes('allow') || t.includes('accept');
        });
        if (btn) (btn as HTMLElement).click();
      });
      await new Promise(r => setTimeout(r, 1500));
    } catch {}

    // Wait for results
    try {
      await page.waitForFunction(
        () => {
          const t = document.body.innerText || '';
          return t.includes('Library ID') || t.includes('ID Библиотеки');
        },
        { timeout: 15000 }
      );
    } catch {
      await browser.disconnect();
      return NextResponse.json({ status: 'no_results', saved: 0 });
    }

    // Wait for content + scroll once
    await new Promise(r => setTimeout(r, 2000));
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(r => setTimeout(r, 2000));
    }

    // Extract ads
    let ads = await extractAdsFromPage(page, country);
    await browser.disconnect();

    // Filter: only ads with creatives
    ads = ads.filter((ad: any) =>
      (ad.imageUrls && ad.imageUrls.length > 0) || (ad.videoUrls && ad.videoUrls.length > 0)
    );

    // Save to DB
    const verticals = await prisma.vertical.findMany();
    const verticalMap = new Map(verticals.map(v => [v.slug, v.id]));

    let saved = 0, updated = 0;

    for (const ad of ads) {
      try {
        const text = [ad.adText, ad.linkTitle, ad.linkDescription].filter(Boolean).join(' ') || null;
        const daysActive = ad.startedAt
          ? Math.max(1, Math.floor((Date.now() - new Date(ad.startedAt).getTime()) / 86400000))
          : 1;
        const vertSlug = detectVertical(text || '');
        const verticalId = vertSlug !== 'other' ? verticalMap.get(vertSlug) || null : null;

        const existing = await prisma.ad.findFirst({ where: { fbAdId: ad.fbAdId } });

        let adId: string;
        if (existing) {
          adId = existing.id;
          const refDate = ad.startedAt ? new Date(ad.startedAt) : (existing.startedAt || existing.createdAt);
          const calcDays = Math.max(1, Math.floor((Date.now() - new Date(refDate).getTime()) / 86400000));
          await prisma.ad.update({
            where: { id: adId },
            data: {
              lastSeenAt: new Date(),
              isActive: ad.isActive,
              daysActive: calcDays,
              verticalId: existing.verticalId || verticalId,
              startedAt: existing.startedAt || (ad.startedAt ? new Date(ad.startedAt) : null),
            },
          });
          updated++;
        } else {
          const created = await prisma.ad.create({
            data: {
              fbAdId: ad.fbAdId,
              advertiserName: ad.advertiserName,
              advertiserId: ad.advertiserId,
              adText: text,
              landingUrl: ad.landingUrl,
              countries: [ad.country],
              platforms: ad.platforms || [],
              startedAt: ad.startedAt ? new Date(ad.startedAt) : null,
              lastSeenAt: new Date(),
              isActive: ad.isActive,
              daysActive,
              verticalId,
            },
          });
          adId = created.id;
          saved++;
        }

        // Save creatives
        const existingCreatives = await prisma.adCreative.findMany({
          where: { adId },
          select: { originalUrl: true },
        });
        const existingUrls = new Set(existingCreatives.map(c => c.originalUrl));

        for (const imgUrl of (ad.imageUrls || [])) {
          if (!existingUrls.has(imgUrl)) {
            await prisma.adCreative.create({
              data: { adId, type: 'IMAGE', originalUrl: imgUrl },
            });
          }
        }
        for (const vidUrl of (ad.videoUrls || [])) {
          if (!existingUrls.has(vidUrl)) {
            await prisma.adCreative.create({
              data: { adId, type: 'VIDEO', originalUrl: vidUrl },
            });
          }
        }
      } catch (err: any) {
        if (!err.message?.includes('Unique')) {
          console.error('Live scrape DB error:', err.message);
        }
      }
    }

    // Auto-save keyword for future background scraping
    try {
      const existing = await prisma.searchKeyword.findFirst({ where: { keyword: q } });
      if (!existing) {
        const vertSlug = detectVertical(q);
        const vert = vertSlug !== 'other' ? verticals.find(v => v.slug === vertSlug) : null;
        await prisma.searchKeyword.create({
          data: { keyword: q, verticalId: vert?.id || null, isActive: true },
        });
      }
    } catch {}

    return NextResponse.json({
      status: 'ok',
      found: ads.length,
      saved,
      updated,
    });
  } catch (error: any) {
    console.error('Live scrape error:', error.message);
    return NextResponse.json({ error: 'Scrape failed', message: error.message }, { status: 500 });
  } finally {
    activeScrapes.delete(lockKey);
  }
}
