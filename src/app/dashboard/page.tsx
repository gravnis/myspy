"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import Card from "@/components/ui/Card";

interface Ad {
  id: string;
  advertiserName: string;
  adText: string;
  thumbnailUrl: string | null;
  countries: string[];
  vertical: string;
  daysActive: number;
  startedAt: string;
  lastSeenAt: string;
  savesCount: number;
}

interface AdsResponse {
  ads: Ad[];
  total: number;
  page: number;
  totalPages: number;
}

const COUNTRIES = [
  { value: "", label: "All Countries" },
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "BR", label: "Brazil" },
  { value: "IN", label: "India" },
  { value: "RU", label: "Russia" },
  { value: "UA", label: "Ukraine" },
  { value: "PL", label: "Poland" },
  { value: "ES", label: "Spain" },
];

const VERTICALS = [
  { value: "", label: "All Verticals" },
  { value: "gambling", label: "Gambling" },
  { value: "betting", label: "Betting" },
  { value: "nutra", label: "Nutra" },
  { value: "dating", label: "Dating" },
  { value: "crypto", label: "Crypto" },
  { value: "finance", label: "Finance" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "gaming", label: "Gaming" },
  { value: "sweepstakes", label: "Sweepstakes" },
];

const DURATIONS = [
  { value: "", label: "All Durations" },
  { value: "1", label: "1d+" },
  { value: "3", label: "3d+" },
  { value: "7", label: "7d+" },
  { value: "14", label: "14d+" },
  { value: "30", label: "30d+" },
];

const SORTS = [
  { value: "date", label: "Date" },
  { value: "duration", label: "Duration" },
  { value: "saves", label: "Saves" },
];

function SkeletonCard() {
  return (
    <div className="bg-card-bg border border-card-border rounded-lg overflow-hidden animate-pulse">
      <div className="aspect-video bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-5/6" />
        <div className="flex gap-2">
          <div className="h-5 bg-gray-200 rounded w-10" />
          <div className="h-5 bg-gray-200 rounded w-16" />
        </div>
        <div className="flex justify-between items-center">
          <div className="h-3 bg-gray-200 rounded w-24" />
          <div className="h-8 bg-gray-200 rounded w-8" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [vertical, setVertical] = useState("");
  const [minDays, setMinDays] = useState("");
  const [sort, setSort] = useState("date");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (country) params.set("country", country);
      if (vertical) params.set("vertical", vertical);
      if (minDays) params.set("minDays", minDays);
      params.set("sort", sort);
      params.set("page", String(page));

      const token = localStorage.getItem("token");
      const res = await fetch(`/api/ads?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data: AdsResponse = await res.json();
        setAds(data.ads);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [query, country, vertical, minDays, sort, page]);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchAds();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Search Ads</h1>
          <span className="text-sm text-muted">
            {total > 0 && `${total.toLocaleString()} ads found`}
          </span>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch}>
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search ads by text, advertiser, keyword..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-card-border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>
        </form>

        {/* Filters Row */}
        <div className="flex flex-wrap gap-3">
          <select
            value={country}
            onChange={(e) => { setCountry(e.target.value); setPage(1); }}
            className="px-4 py-2.5 border border-card-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          >
            {COUNTRIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <select
            value={vertical}
            onChange={(e) => { setVertical(e.target.value); setPage(1); }}
            className="px-4 py-2.5 border border-card-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          >
            {VERTICALS.map((v) => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>

          <select
            value={minDays}
            onChange={(e) => { setMinDays(e.target.value); setPage(1); }}
            className="px-4 py-2.5 border border-card-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          >
            {DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
            className="px-4 py-2.5 border border-card-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Ads Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : ads.length === 0 ? (
          <Card className="text-center py-16">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-muted text-lg">No ads found</p>
            <p className="text-muted text-sm mt-1">Try adjusting your search or filters</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ads.map((ad) => (
              <Link key={ad.id} href={`/dashboard/ads/${ad.id}`} className="block group">
                <div className="bg-card-bg border border-card-border rounded-lg overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-200">
                  {/* Thumbnail */}
                  {ad.thumbnailUrl ? (
                    <div className="aspect-video bg-gray-100 overflow-hidden">
                      <img
                        src={ad.thumbnailUrl}
                        alt="Ad creative"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gray-100 flex items-center justify-center">
                      <span className="text-muted text-sm">No image</span>
                    </div>
                  )}

                  <div className="p-4 space-y-3">
                    {/* Advertiser */}
                    <p className="text-sm font-semibold text-foreground truncate">
                      {ad.advertiserName}
                    </p>

                    {/* Ad text */}
                    <p className="text-sm text-muted line-clamp-2 leading-relaxed">
                      {ad.adText}
                    </p>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {ad.countries.slice(0, 3).map((c) => (
                        <span
                          key={c}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"
                        >
                          {c}
                        </span>
                      ))}
                      {ad.countries.length > 3 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-600 border border-gray-100">
                          +{ad.countries.length - 3}
                        </span>
                      )}
                      {ad.vertical && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                          {ad.vertical}
                        </span>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-muted flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Active {ad.daysActive} days
                      </span>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // TODO: save to project
                        }}
                        className="p-2 rounded-lg hover:bg-gray-100 text-muted hover:text-primary transition-colors"
                        title="Save to project"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 pt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-card-border bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-muted">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-card-border bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
