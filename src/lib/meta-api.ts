const META_API_BASE = "https://graph.facebook.com/v21.0";

interface MetaAdSearchParams {
  searchTerms?: string;
  adReachedCountries?: string[];
  adType?: "ALL" | "POLITICAL_AND_ISSUE_ADS";
  limit?: number;
  after?: string;
}

interface MetaAdResult {
  id: string;
  ad_creation_time?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_captions?: string[];
  ad_creative_link_descriptions?: string[];
  ad_creative_link_titles?: string[];
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_snapshot_url?: string;
  bylines?: string;
  currency?: string;
  languages?: string[];
  page_id?: string;
  page_name?: string;
  publisher_platforms?: string[];
  estimated_audience_size?: { lower_bound: number; upper_bound: number };
}

interface MetaAdResponse {
  data: MetaAdResult[];
  paging?: {
    cursors?: { after?: string; before?: string };
    next?: string;
  };
}

export async function searchMetaAds(params: MetaAdSearchParams): Promise<MetaAdResponse> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN not set");

  const searchParams = new URLSearchParams({
    access_token: token,
    ad_type: params.adType || "ALL",
    ad_reached_countries: JSON.stringify(params.adReachedCountries || ["US"]),
    search_terms: params.searchTerms || "",
    limit: String(params.limit || 25),
    fields: [
      "id",
      "ad_creation_time",
      "ad_creative_bodies",
      "ad_creative_link_captions",
      "ad_creative_link_descriptions",
      "ad_creative_link_titles",
      "ad_delivery_start_time",
      "ad_delivery_stop_time",
      "ad_snapshot_url",
      "bylines",
      "languages",
      "page_id",
      "page_name",
      "publisher_platforms",
    ].join(","),
  });

  if (params.after) {
    searchParams.set("after", params.after);
  }

  const url = `${META_API_BASE}/ads_archive?${searchParams.toString()}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "MySpy/1.0" },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Meta API error ${res.status}: ${error}`);
  }

  return res.json();
}

export function mapMetaAdToDb(ad: MetaAdResult, countries: string[]) {
  const text = [
    ...(ad.ad_creative_bodies || []),
    ...(ad.ad_creative_link_titles || []),
    ...(ad.ad_creative_link_descriptions || []),
  ].join(" ");

  return {
    fbAdId: ad.id,
    advertiserName: ad.page_name || ad.bylines || null,
    advertiserId: ad.page_id || null,
    adText: text || null,
    landingUrl: null as string | null,
    countries,
    startedAt: ad.ad_delivery_start_time ? new Date(ad.ad_delivery_start_time) : null,
    lastSeenAt: new Date(),
    isActive: !ad.ad_delivery_stop_time,
    snapshotUrl: ad.ad_snapshot_url || null,
  };
}

export type { MetaAdResult, MetaAdResponse, MetaAdSearchParams };
