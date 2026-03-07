"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import Card from "@/components/ui/Card";

function proxyUrl(url: string, hq = false) {
  const base = `/api/proxy/image?u=${btoa(unescape(encodeURIComponent(url)))}`;
  return hq ? `${base}&hq=1` : base;
}

interface AdCreative {
  id: string;
  type: string;
  originalUrl: string | null;
  b2Key: string | null;
  thumbnailB2Key: string | null;
}

interface Ad {
  id: string;
  advertiserName: string | null;
  adText: string | null;
  countries: string[];
  vertical: { name: string; slug: string } | null;
  daysActive: number;
  isActive: boolean;
  startedAt: string | null;
  lastSeenAt: string | null;
  savesCount: number;
  landingUrl: string | null;
  creatives: AdCreative[];
}

interface AdsResponse {
  ads: Ad[];
  total: number;
  page: number;
  totalPages: number;
}

const COUNTRIES = [
  { value: "", label: "All Countries" },
  // Tier 1
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "ES", label: "Spain" },
  { value: "IT", label: "Italy" },
  { value: "NL", label: "Netherlands" },
  { value: "BE", label: "Belgium" },
  { value: "AT", label: "Austria" },
  { value: "CH", label: "Switzerland" },
  { value: "AU", label: "Australia" },
  { value: "CA", label: "Canada" },
  { value: "NZ", label: "New Zealand" },
  // Eastern Europe
  { value: "UA", label: "Ukraine" },
  { value: "RU", label: "Russia" },
  { value: "PL", label: "Poland" },
  { value: "CZ", label: "Czech Republic" },
  { value: "RO", label: "Romania" },
  { value: "HU", label: "Hungary" },
  { value: "BG", label: "Bulgaria" },
  // LATAM
  { value: "BR", label: "Brazil" },
  { value: "MX", label: "Mexico" },
  { value: "AR", label: "Argentina" },
  { value: "CO", label: "Colombia" },
  // Asia
  { value: "IN", label: "India" },
  { value: "PH", label: "Philippines" },
  { value: "TH", label: "Thailand" },
  { value: "VN", label: "Vietnam" },
  { value: "ID", label: "Indonesia" },
  // Africa
  { value: "ZA", label: "South Africa" },
  { value: "NG", label: "Nigeria" },
  { value: "KE", label: "Kenya" },
];

const VERTICALS = [
  { value: "", label: "All Verticals" },
  { value: "gambling", label: "Gambling" },
  { value: "nutra", label: "Nutra" },
  { value: "crypto", label: "Crypto" },
  { value: "finance", label: "Finance" },
  { value: "dating", label: "Dating" },
  { value: "ecom", label: "E-commerce" },
];

const DURATIONS = [
  { value: "", label: "All Durations" },
  { value: "1", label: "1d+" },
  { value: "3", label: "3d+" },
  { value: "7", label: "7d+" },
  { value: "14", label: "14d+" },
  { value: "30", label: "30d+" },
];

const CREATIVE_TYPES = [
  { value: "", label: "All Creatives" },
  { value: "IMAGE", label: "Image" },
  { value: "VIDEO", label: "Video" },
];

const DATE_RANGES = [
  { value: "", label: "Any Date" },
  { value: "1", label: "Last 24h" },
  { value: "3", label: "Last 3 days" },
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const SORTS = [
  { value: "date", label: "Newest" },
  { value: "duration", label: "Longest Running" },
  { value: "saves", label: "Most Saved" },
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

interface ProjectOption {
  id: string;
  name: string;
}

export default function DashboardPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [vertical, setVertical] = useState("");
  const [minDays, setMinDays] = useState("");
  const [creativeType, setCreativeType] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [advertiser, setAdvertiser] = useState("");
  const [sort, setSort] = useState("date");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [saveModalAdId, setSaveModalAdId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [savingToProject, setSavingToProject] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const loadProjects = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/projects", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch {}
  };

  const handleSaveToProject = async (projectId: string) => {
    if (!saveModalAdId) return;
    setSavingToProject(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`/api/projects/${projectId}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ adId: saveModalAdId }),
      });
      if (res.ok) {
        setSaveSuccess(projects.find(p => p.id === projectId)?.name || "Project");
        setSaveModalAdId(null);
        setTimeout(() => setSaveSuccess(null), 3000);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save");
      }
    } catch {
      alert("Failed to save to project");
    } finally {
      setSavingToProject(false);
    }
  };

  const [liveScraping, setLiveScraping] = useState(false);
  const [liveResult, setLiveResult] = useState<string | null>(null);

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (country) params.set("country", country);
      if (vertical) params.set("vertical", vertical);
      if (minDays) params.set("minDays", minDays);
      if (creativeType) params.set("creativeType", creativeType);
      if (dateRange) params.set("dateRange", dateRange);
      if (advertiser.trim()) params.set("advertiser", advertiser.trim());
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

      // If user searched a query, fire live scrape in background to fetch fresh ads from FB
      if (query && query.length >= 2 && page === 1) {
        setLiveScraping(true);
        setLiveResult(null);
        const scrapeParams = new URLSearchParams({ q: query, country: country || 'US' });
        fetch(`/api/scrape-live?${scrapeParams}`)
          .then(r => r.json())
          .then(data => {
            if (data.saved > 0 || data.updated > 0) {
              setLiveResult(`+${data.saved} new, ${data.updated} updated from FB`);
              // Re-fetch ads to show new results
              setTimeout(() => {
                fetch(`/api/ads?${params.toString()}`, {
                  headers: { Authorization: `Bearer ${token}` },
                })
                  .then(r => r.json())
                  .then(freshData => {
                    setAds(freshData.ads);
                    setTotalPages(freshData.totalPages);
                    setTotal(freshData.total);
                  })
                  .catch(() => {});
              }, 500);
            } else if (data.status === 'no_results') {
              setLiveResult('No new ads found on FB');
            } else if (data.error) {
              setLiveResult(null);
            }
          })
          .catch(() => setLiveResult(null))
          .finally(() => setLiveScraping(false));
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [query, country, vertical, minDays, creativeType, dateRange, advertiser, sort, page]);

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
          <span className="text-sm text-muted flex items-center gap-3">
            {loading && query && (
              <span className="flex items-center gap-1.5 text-primary">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Searching FB Ad Library...
              </span>
            )}
            {!loading && total > 0 && (
              <>
                {total.toLocaleString()} ads found
                <button
                  onClick={() => {
                    const csvRows = [
                      ["Advertiser", "Text", "Countries", "Vertical", "Days Active", "Landing URL", "FB Ad ID"].join(","),
                      ...ads.map(ad => [
                        `"${(ad.advertiserName || "").replace(/"/g, '""')}"`,
                        `"${(ad.adText || "").replace(/"/g, '""').replace(/\n/g, ' ').slice(0, 200)}"`,
                        `"${ad.countries.join('; ')}"`,
                        `"${ad.vertical?.name || ''}"`,
                        ad.daysActive,
                        `"${ad.landingUrl || ''}"`,
                        ad.creatives?.[0]?.id || "",
                      ].join(","))
                    ].join("\n");
                    const blob = new Blob(["\uFEFF" + csvRows], { type: "text/csv;charset=utf-8" });
                    const u = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = u; a.download = `myspy-${new Date().toISOString().slice(0,10)}.csv`; a.click();
                    URL.revokeObjectURL(u);
                  }}
                  className="px-2 py-1 text-[10px] border border-card-border rounded hover:bg-gray-50 text-muted hover:text-foreground transition-colors"
                  title="Export current page to CSV"
                >
                  CSV
                </button>
              </>
            )}
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
            value={creativeType}
            onChange={(e) => { setCreativeType(e.target.value); setPage(1); }}
            className="px-4 py-2.5 border border-card-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          >
            {CREATIVE_TYPES.map((ct) => (
              <option key={ct.value} value={ct.value}>{ct.label}</option>
            ))}
          </select>

          <select
            value={dateRange}
            onChange={(e) => { setDateRange(e.target.value); setPage(1); }}
            className="px-4 py-2.5 border border-card-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          >
            {DATE_RANGES.map((d) => (
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

        {/* Second filter row — advertiser search */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <input
              type="text"
              placeholder="Filter by advertiser name..."
              value={advertiser}
              onChange={(e) => { setAdvertiser(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-card-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
          </div>
          {(country || vertical || minDays || creativeType || dateRange || advertiser) && (
            <button
              onClick={() => { setCountry(""); setVertical(""); setMinDays(""); setCreativeType(""); setDateRange(""); setAdvertiser(""); setPage(1); }}
              className="px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Live scraping indicator */}
        {(liveScraping || liveResult) && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${liveScraping ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
            {liveScraping ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600" />
                <span>Searching FB Ad Library live...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                <span>{liveResult}</span>
              </>
            )}
          </div>
        )}

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
            <p className="text-muted text-sm mt-1">
              {query || country || vertical || minDays
                ? 'Try adjusting your search or filters'
                : 'No ads in the database yet. Run a parse from the Admin panel to collect ads.'}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ads.map((ad) => (
              <Link key={ad.id} href={`/dashboard/ads/${ad.id}`} className="block group">
                <div className="bg-card-bg border border-card-border rounded-lg overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-200">
                  {/* Thumbnail */}
                  {ad.creatives?.[0]?.originalUrl ? (
                    <div className="aspect-video bg-gray-100 overflow-hidden relative">
                      {(() => {
                        const imageCreative = ad.creatives.find(c => c.type === 'IMAGE' && c.originalUrl);
                        const videoCreative = ad.creatives.find(c => c.type === 'VIDEO');
                        const thumbUrl = imageCreative?.originalUrl || ad.creatives[0].originalUrl;
                        return (
                          <>
                            <img
                              src={proxyUrl(thumbUrl!, true)}
                              alt="Ad creative"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              onError={(e) => {
                                const img = e.target as HTMLImageElement;
                                img.style.display = 'none';
                                if (img.parentElement) {
                                  img.parentElement.innerHTML = '<span class="text-muted text-sm flex items-center justify-center h-full">Image expired</span>';
                                }
                              }}
                            />
                            {videoCreative && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm">
                                  <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="aspect-video bg-gray-100 flex items-center justify-center">
                      <span className="text-muted text-sm">No image</span>
                    </div>
                  )}

                  <div className="p-4 space-y-3">
                    {/* Advertiser */}
                    <p className="text-sm font-semibold text-foreground truncate">
                      {ad.advertiserName || 'Unknown advertiser'}
                    </p>

                    {/* Ad text */}
                    <p className="text-sm text-muted line-clamp-2 leading-relaxed">
                      {ad.adText || 'No text'}
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
                          {ad.vertical.name}
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
                          loadProjects();
                          setSaveModalAdId(ad.id);
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

      {/* Save success toast */}
      {saveSuccess && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-200 shadow-lg">
          Saved to {saveSuccess}
        </div>
      )}

      {/* Save to Project Modal */}
      {saveModalAdId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSaveModalAdId(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Save to Project</h3>
              <button onClick={() => setSaveModalAdId(null)} className="text-muted hover:text-foreground">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {projects.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No projects yet. Create one in the Projects tab.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSaveToProject(p.id)}
                    disabled={savingToProject}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 border border-card-border text-sm text-foreground transition-colors disabled:opacity-50"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
