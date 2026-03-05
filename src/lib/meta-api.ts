// ---------------------------------------------------------------------------
// Types (shared between client scraper and server)
// ---------------------------------------------------------------------------

export interface ScrapedAd {
  fbAdId: string;
  advertiserName: string | null;
  advertiserId: string | null;
  adText: string | null;
  linkTitle: string | null;
  linkDescription: string | null;
  landingUrl: string | null;
  imageUrls: string[];
  videoThumbnailUrl: string | null;
  startedAt: string | null;
  isActive: boolean;
  platforms: string[];
  country: string;
}

export interface ScrapeResult {
  ads: ScrapedAd[];
  totalFound: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// DB mapping helper (used server-side)
// ---------------------------------------------------------------------------

export function mapScrapedAdToDb(ad: ScrapedAd) {
  const text = [ad.adText, ad.linkTitle, ad.linkDescription]
    .filter(Boolean)
    .join(' ');

  return {
    fbAdId: ad.fbAdId,
    advertiserName: ad.advertiserName,
    advertiserId: ad.advertiserId,
    adText: text || null,
    linkTitle: ad.linkTitle || null,
    linkDescription: ad.linkDescription || null,
    landingUrl: ad.landingUrl,
    countries: [ad.country],
    platforms: ad.platforms,
    startedAt: ad.startedAt ? new Date(ad.startedAt) : null,
    lastSeenAt: new Date(),
    isActive: ad.isActive,
  };
}
