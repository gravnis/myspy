"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import Card from "@/components/ui/Card";

// ---- Types ----

interface AdCreative {
  id: string;
  type: string;
  originalUrl: string | null;
  b2Key: string | null;
  thumbnailB2Key: string | null;
}

interface AdItem {
  id: string;
  fbAdId: string;
  advertiserName: string | null;
  adText: string | null;
  landingUrl: string | null;
  countries: string[];
  daysActive: number;
  isActive: boolean;
  savesCount: number;
  createdAt: string;
  startedAt: string | null;
  vertical: { name: string; slug: string } | null;
  creatives: AdCreative[];
}

interface AnalyticsData {
  totalAds: number;
  activeAds: number;
  inactiveAds: number;
  newToday: number;
  newThisWeek: number;
  avgDaysActive: number;
  longestRunningAds: AdItem[];
  topAdvertisers: { name: string; adCount: number; avgDaysActive: number; countries: string[] }[];
  adsByVertical: { name: string; slug: string; count: number; activeCount: number; avgDays: number }[];
  topCountries: { country: string; count: number }[];
  trending: AdItem[];
  recentAds: AdItem[];
  dailyActivity: { date: string; count: number }[];
  thisWeekCount: number;
  lastWeekCount: number;
  weekOverWeekChange: number;
  topSaved: AdItem[];
  topDomains: { domain: string; count: number }[];
  lastParseTime: string | null;
  totalParses: number;
  parseSuccessRate: number;
}

// ---- Helpers ----

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Только что";
  if (diffMins < 60) return `${diffMins} мин. назад`;
  if (diffHours < 24) return `${diffHours} ч. назад`;
  if (diffDays === 0) return "Сегодня";
  if (diffDays === 1) return "Вчера";
  if (diffDays < 7) return `${diffDays} дн. назад`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} нед. назад`;
  return `${Math.floor(diffDays / 30)} мес. назад`;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

// ---- Components ----

function StatCard({
  label,
  value,
  subValue,
  color = "primary",
}: {
  label: string;
  value: string | number;
  subValue?: React.ReactNode;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    primary: "bg-blue-50 text-blue-600",
    success: "bg-green-50 text-green-600",
    warning: "bg-amber-50 text-amber-600",
    danger: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
    neutral: "bg-gray-50 text-gray-600",
  };
  const cls = colorMap[color] || colorMap.primary;

  return (
    <div className="bg-card-bg border border-card-border rounded-lg p-4">
      <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${cls}`}>
        {label}
      </span>
      <p className="text-2xl font-bold text-foreground mt-1.5">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {subValue && <div className="text-xs text-muted mt-0.5">{subValue}</div>}
    </div>
  );
}

function AdRow({ ad }: { ad: AdItem }) {
  const creative = ad.creatives?.[0];
  const thumb = creative?.thumbnailB2Key || creative?.originalUrl;

  return (
    <Link
      href={`/dashboard/ads/${ad.id}`}
      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
    >
      {thumb ? (
        <div className="w-10 h-10 rounded overflow-hidden bg-gray-100 flex-shrink-0">
          <img src={thumb} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-10 h-10 rounded bg-gray-100 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate group-hover:text-blue-600 transition-colors">
          {ad.advertiserName || "Unknown"}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {ad.vertical && (
            <span className="text-[10px] px-1 py-px rounded bg-purple-50 text-purple-700">{ad.vertical.name}</span>
          )}
          <span className="text-[10px] text-muted">{ad.daysActive}d</span>
          {ad.countries.slice(0, 2).map((c) => (
            <span key={c} className="text-[10px] text-muted bg-gray-100 px-1 rounded">{c}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}

function HorizontalBar({
  label,
  value,
  maxValue,
  color = "bg-blue-500",
}: {
  label: string;
  value: number;
  maxValue: number;
  color?: string;
}) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground font-medium truncate">{label}</span>
        <span className="text-muted flex-shrink-0 ml-2">{value.toLocaleString()}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={`${color} h-full rounded-full transition-all duration-500`}
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>
    </div>
  );
}

// ---- Main ----

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch("/api/analytics");
        if (res.ok) setData(await res.json());
      } catch {}
      finally { setLoading(false); }
    }
    fetchAnalytics();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6 overflow-x-hidden">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Аналитика</h1>
          {data && (
            <span className="text-xs text-muted">
              {new Date().toLocaleTimeString("ru-RU")}
            </span>
          )}
        </div>

        {loading ? (
          <LoadingSkeleton />
        ) : !data ? (
          <Card className="text-center py-16">
            <p className="text-lg text-muted">Данные недоступны</p>
          </Card>
        ) : (
          <AnalyticsContent data={data} />
        )}
      </div>
    </DashboardLayout>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card-bg border border-card-border rounded-lg p-4">
            <div className="h-3 bg-gray-200 rounded w-12 mb-2" />
            <div className="h-7 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsContent({ data }: { data: AnalyticsData }) {
  const maxVertical = Math.max(...data.adsByVertical.map((v) => v.count), 1);
  const maxCountry = Math.max(...data.topCountries.map((c) => c.count), 1);
  const maxDaily = Math.max(...data.dailyActivity.map((d) => d.count), 1);

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Всего" value={data.totalAds} color="primary" />
        <StatCard label="Активные" value={data.activeAds} subValue={`${data.inactiveAds} неакт.`} color="success" />
        <StatCard label="Сегодня" value={data.newToday} color="warning" />
        <StatCard label="За неделю" value={data.newThisWeek} color="purple" />
        <StatCard label="Avg дней" value={data.avgDaysActive} subValue="время жизни" color="neutral" />
        <StatCard
          label="WoW"
          value={`${data.weekOverWeekChange >= 0 ? "+" : ""}${data.weekOverWeekChange}%`}
          subValue={`${data.thisWeekCount} vs ${data.lastWeekCount}`}
          color={data.weekOverWeekChange > 0 ? "success" : data.weekOverWeekChange < 0 ? "danger" : "neutral"}
        />
      </div>

      {/* Daily Activity Chart — full width */}
      <Card>
        <h2 className="text-base font-bold text-foreground mb-3">Активность за 30 дней</h2>
        {data.dailyActivity.length === 0 ? (
          <p className="text-muted text-sm py-4 text-center">Нет данных</p>
        ) : (
          <>
            <div className="flex items-end gap-px h-32">
              {data.dailyActivity.map((day, i) => {
                const pct = maxDaily > 0 ? (day.count / maxDaily) * 100 : 0;
                const isToday = i === data.dailyActivity.length - 1;
                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center justify-end group relative"
                    style={{ height: "100%" }}
                    title={`${formatShortDate(day.date)}: ${day.count}`}
                  >
                    <div
                      className={`w-full rounded-sm transition-all ${isToday ? "bg-blue-600" : "bg-blue-400"} hover:bg-blue-500`}
                      style={{ height: `${Math.max(pct, 3)}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-muted">
              <span>{formatShortDate(data.dailyActivity[0].date)}</span>
              <span>{formatShortDate(data.dailyActivity[data.dailyActivity.length - 1].date)}</span>
            </div>
          </>
        )}
      </Card>

      {/* Two columns: charts left, lists right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Charts */}
        <div className="space-y-6">
          {/* GEOs */}
          <Card>
            <h2 className="text-base font-bold text-foreground mb-3">Top GEOs</h2>
            {data.topCountries.length === 0 ? (
              <p className="text-muted text-sm py-4 text-center">Нет данных</p>
            ) : (
              <div className="space-y-2.5">
                {data.topCountries.slice(0, 10).map((c) => (
                  <HorizontalBar key={c.country} label={c.country} value={c.count} maxValue={maxCountry} color="bg-blue-500" />
                ))}
              </div>
            )}
          </Card>

          {/* Verticals */}
          <Card>
            <h2 className="text-base font-bold text-foreground mb-3">Вертикали</h2>
            {data.adsByVertical.length === 0 ? (
              <p className="text-muted text-sm py-4 text-center">Нет данных</p>
            ) : (
              <div className="space-y-2.5">
                {data.adsByVertical.map((v) => (
                  <HorizontalBar
                    key={v.slug}
                    label={`${v.name} (${v.avgDays}d avg)`}
                    value={v.count}
                    maxValue={maxVertical}
                    color="bg-purple-500"
                  />
                ))}
              </div>
            )}
          </Card>

          {/* Top Advertisers */}
          <Card>
            <h2 className="text-base font-bold text-foreground mb-3">Top Рекламодатели</h2>
            {data.topAdvertisers.length === 0 ? (
              <p className="text-muted text-sm py-4 text-center">Нет данных</p>
            ) : (
              <div className="space-y-2">
                {data.topAdvertisers.slice(0, 10).map((adv, i) => (
                  <div key={adv.name} className="flex items-center gap-2">
                    <span className="text-xs text-muted w-5 text-right flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{adv.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted">{adv.adCount} ads</span>
                        <span className="text-[10px] text-muted">{adv.avgDaysActive}d avg</span>
                        {adv.countries.slice(0, 3).map((c) => (
                          <span key={c} className="text-[10px] text-muted bg-gray-100 px-1 rounded">{c}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Top Domains */}
          <Card>
            <h2 className="text-base font-bold text-foreground mb-3">Top Домены</h2>
            {data.topDomains.length === 0 ? (
              <p className="text-muted text-sm py-4 text-center">Нет данных</p>
            ) : (
              <div className="space-y-1.5">
                {data.topDomains.slice(0, 10).map((d, i) => (
                  <div key={d.domain} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted w-5 text-right flex-shrink-0">{i + 1}</span>
                      <span className="text-sm text-foreground truncate">{d.domain}</span>
                    </div>
                    <span className="text-sm font-semibold text-muted flex-shrink-0 ml-2">{d.count}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Ad lists */}
        <div className="space-y-6">
          {/* Trending */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <h2 className="text-base font-bold text-foreground">Trending</h2>
              <span className="text-[10px] text-muted ml-auto">3+ дней активны</span>
            </div>
            {data.trending.length === 0 ? (
              <p className="text-muted text-sm py-4 text-center">Нет трендов</p>
            ) : (
              <div className="space-y-0.5">
                {data.trending.slice(0, 8).map((ad) => <AdRow key={ad.id} ad={ad} />)}
              </div>
            )}
          </Card>

          {/* Longest Running */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <h2 className="text-base font-bold text-foreground">Longest Running</h2>
              <span className="text-[10px] text-muted ml-auto">= прибыльные</span>
            </div>
            {data.longestRunningAds.length === 0 ? (
              <p className="text-muted text-sm py-4 text-center">Нет данных</p>
            ) : (
              <div className="space-y-0.5">
                {data.longestRunningAds.slice(0, 8).map((ad) => <AdRow key={ad.id} ad={ad} />)}
              </div>
            )}
          </Card>

          {/* Recent */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-foreground">Недавние</h2>
              <Link href="/dashboard" className="text-xs text-blue-600 hover:underline">Все</Link>
            </div>
            {data.recentAds.length === 0 ? (
              <p className="text-muted text-sm py-4 text-center">Нет данных</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {data.recentAds.slice(0, 8).map((ad) => {
                  const creative = ad.creatives?.[0];
                  const thumb = creative?.thumbnailB2Key || creative?.originalUrl;
                  return (
                    <Link
                      key={ad.id}
                      href={`/dashboard/ads/${ad.id}`}
                      className="rounded-lg border border-card-border bg-white hover:shadow transition-shadow p-2 group"
                    >
                      {thumb ? (
                        <div className="w-full aspect-video rounded overflow-hidden bg-gray-100 mb-1.5">
                          <img src={thumb} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-full aspect-video rounded bg-gray-100 mb-1.5" />
                      )}
                      <p className="text-[11px] font-medium text-foreground truncate group-hover:text-blue-600">
                        {ad.advertiserName || "Unknown"}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-muted">{ad.daysActive}d</span>
                        {ad.vertical && (
                          <span className="text-[9px] px-1 rounded bg-purple-50 text-purple-700">{ad.vertical.name}</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Parse Health — compact */}
      <Card>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h2 className="text-base font-bold text-foreground">Парсинг</h2>
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-muted text-xs">Последний: </span>
              <span className="font-medium">{data.lastParseTime ? formatRelativeDate(data.lastParseTime) : "Никогда"}</span>
            </div>
            <div>
              <span className="text-muted text-xs">Всего: </span>
              <span className="font-medium">{data.totalParses}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted text-xs">Успех: </span>
              <span className="font-medium">{data.parseSuccessRate}%</span>
              <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${data.parseSuccessRate >= 90 ? "bg-green-500" : data.parseSuccessRate >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${data.parseSuccessRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}
