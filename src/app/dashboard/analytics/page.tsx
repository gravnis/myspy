"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import Card from "@/components/ui/Card";

interface AnalyticsData {
  stats: {
    totalAds: number;
    activeAds: number;
    newToday: number;
    topVertical: string;
  };
  topCreatives: {
    id: string;
    advertiserName: string;
    adText: string;
    thumbnailUrl: string | null;
    vertical: string;
    savesCount: number;
    daysActive: number;
  }[];
  adsByVertical: {
    vertical: string;
    count: number;
  }[];
  dailyActivity: {
    date: string;
    count: number;
  }[];
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <Card className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{typeof value === "number" ? value.toLocaleString() : value}</p>
        <p className="text-sm text-muted">{label}</p>
      </div>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/analytics", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  const maxVerticalCount = data?.adsByVertical
    ? Math.max(...data.adsByVertical.map((v) => v.count), 1)
    : 1;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>

        {loading ? (
          <div className="space-y-8 animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-card-bg border border-card-border rounded-lg p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-xl" />
                    <div className="space-y-2">
                      <div className="h-6 bg-gray-200 rounded w-16" />
                      <div className="h-3 bg-gray-200 rounded w-20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-card-bg border border-card-border rounded-lg p-6 space-y-4">
              <div className="h-5 bg-gray-200 rounded w-32" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded" />
              ))}
            </div>
          </div>
        ) : !data ? (
          <Card className="text-center py-16">
            <p className="text-lg text-muted">Analytics data unavailable</p>
            <p className="text-muted text-sm mt-1">Check back later when more data has been collected</p>
          </Card>
        ) : (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                label="Total Ads"
                value={data.stats.totalAds}
                icon={
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                }
              />
              <StatCard
                label="Active Ads"
                value={data.stats.activeAds}
                icon={
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                }
              />
              <StatCard
                label="New Today"
                value={data.stats.newToday}
                icon={
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                }
              />
              <StatCard
                label="Top Vertical"
                value={data.stats.topVertical || "N/A"}
                icon={
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
              />
            </div>

            {/* Top Creatives */}
            <Card>
              <h2 className="text-lg font-bold text-foreground mb-6">Top Creatives</h2>
              {data.topCreatives.length === 0 ? (
                <p className="text-muted text-sm">No data yet</p>
              ) : (
                <div className="space-y-3">
                  {data.topCreatives.map((ad, index) => (
                    <Link
                      key={ad.id}
                      href={`/dashboard/ads/${ad.id}`}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      {/* Rank */}
                      <span className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-muted flex-shrink-0">
                        {index + 1}
                      </span>

                      {/* Thumbnail */}
                      {ad.thumbnailUrl ? (
                        <div className="w-16 h-10 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                          <img src={ad.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-16 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-muted text-[10px]">No img</span>
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {ad.advertiserName}
                        </p>
                        <p className="text-xs text-muted truncate">{ad.adText}</p>
                      </div>

                      {/* Badges */}
                      <div className="hidden sm:flex items-center gap-2">
                        {ad.vertical && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                            {ad.vertical}
                          </span>
                        )}
                        <span className="text-xs text-muted">{ad.daysActive}d</span>
                      </div>

                      {/* Saves count */}
                      <div className="flex items-center gap-1 text-muted flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                        <span className="text-sm font-medium">{ad.savesCount}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            {/* Ads by Vertical */}
            <Card>
              <h2 className="text-lg font-bold text-foreground mb-6">Ads by Vertical</h2>
              {data.adsByVertical.length === 0 ? (
                <p className="text-muted text-sm">No data yet</p>
              ) : (
                <div className="space-y-4">
                  {data.adsByVertical.map((item) => (
                    <div key={item.vertical} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground capitalize">
                          {item.vertical}
                        </span>
                        <span className="text-sm text-muted">{item.count.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all duration-500"
                          style={{ width: `${(item.count / maxVerticalCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Daily Activity */}
            <Card>
              <h2 className="text-lg font-bold text-foreground mb-6">Daily Activity</h2>
              {data.dailyActivity.length === 0 ? (
                <p className="text-muted text-sm">No data yet</p>
              ) : (
                <div className="space-y-3">
                  {data.dailyActivity.map((day) => {
                    const maxDaily = Math.max(...data.dailyActivity.map((d) => d.count), 1);
                    return (
                      <div key={day.date} className="flex items-center gap-4">
                        <span className="text-sm text-muted w-36 flex-shrink-0">
                          {formatDate(day.date)}
                        </span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-success h-full rounded-full transition-all duration-500"
                            style={{ width: `${(day.count / maxDaily) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-foreground w-16 text-right flex-shrink-0">
                          {day.count.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
