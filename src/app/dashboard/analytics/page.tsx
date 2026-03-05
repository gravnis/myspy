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

function truncate(str: string | null, len: number): string {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "..." : str;
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
    <Card className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${cls}`}>
          {label}
        </span>
      </div>
      <p className="text-3xl font-bold text-foreground mt-1">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {subValue && <div className="text-sm text-muted">{subValue}</div>}
    </Card>
  );
}

function AdCard({ ad }: { ad: AdItem }) {
  const creative = ad.creatives?.[0];
  const thumbnailUrl = creative?.thumbnailB2Key || creative?.originalUrl;

  return (
    <Link
      href={`/dashboard/ads/${ad.id}`}
      className="block p-4 rounded-lg border border-card-border bg-white hover:shadow-md transition-shadow group"
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        {thumbnailUrl ? (
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
            <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
            <span className="text-muted text-[10px]">No img</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate group-hover:text-blue-600 transition-colors">
            {ad.advertiserName || "Unknown"}
          </p>
          <p className="text-xs text-muted truncate mt-0.5">{truncate(ad.adText, 80)}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {ad.vertical && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-100">
                {ad.vertical.name}
              </span>
            )}
            <span className="text-[10px] text-muted font-medium">{ad.daysActive}d active</span>
            {ad.countries.slice(0, 3).map((c) => (
              <span key={c} className="text-[10px] text-muted bg-gray-100 px-1 rounded">{c}</span>
            ))}
            {ad.countries.length > 3 && (
              <span className="text-[10px] text-muted">+{ad.countries.length - 3}</span>
            )}
          </div>
        </div>
        {ad.savesCount > 0 && (
          <div className="flex items-center gap-0.5 text-muted flex-shrink-0 mt-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <span className="text-xs font-medium">{ad.savesCount}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function HorizontalBar({
  label,
  value,
  maxValue,
  color = "bg-blue-500",
  suffix = "",
}: {
  label: string;
  value: number;
  maxValue: number;
  color?: string;
  suffix?: string;
}) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground font-medium truncate">{label}</span>
        <span className="text-muted flex-shrink-0 ml-2">
          {value.toLocaleString()}{suffix}
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div
          className={`${color} h-full rounded-full transition-all duration-500`}
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>
    </div>
  );
}

// ---- Main Page ----

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch("/api/analytics");
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Аналитика</h1>
          {data && (
            <span className="text-xs text-muted">
              Обновлено: {new Date().toLocaleTimeString("ru-RU")}
            </span>
          )}
        </div>

        {loading ? (
          <LoadingSkeleton />
        ) : !data ? (
          <Card className="text-center py-16">
            <p className="text-lg text-muted">Данные аналитики недоступны</p>
            <p className="text-muted text-sm mt-1">Проверьте позже, когда будет собрано больше данных</p>
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
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card-bg border border-card-border rounded-lg p-6">
            <div className="h-3 bg-gray-200 rounded w-16 mb-3" />
            <div className="h-8 bg-gray-200 rounded w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card-bg border border-card-border rounded-lg p-6 space-y-3">
            <div className="h-5 bg-gray-200 rounded w-32" />
            {Array.from({ length: 4 }).map((__, j) => (
              <div key={j} className="h-12 bg-gray-200 rounded" />
            ))}
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
      {/* ---- Stats Row (6 cards) ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Всего" value={data.totalAds} color="primary" />
        <StatCard
          label="Активные"
          value={data.activeAds}
          subValue={`${data.inactiveAds.toLocaleString()} неакт.`}
          color="success"
        />
        <StatCard label="Сегодня" value={data.newToday} color="warning" />
        <StatCard label="За неделю" value={data.newThisWeek} color="purple" />
        <StatCard
          label="Avg дней"
          value={data.avgDaysActive}
          subValue="среднее время жизни"
          color="neutral"
        />
        <StatCard
          label="WoW"
          value={`${data.weekOverWeekChange >= 0 ? "+" : ""}${data.weekOverWeekChange}%`}
          subValue={
            <WeekChange
              change={data.weekOverWeekChange}
              thisWeek={data.thisWeekCount}
              lastWeek={data.lastWeekCount}
            />
          }
          color={data.weekOverWeekChange > 0 ? "success" : data.weekOverWeekChange < 0 ? "danger" : "neutral"}
        />
      </div>

      {/* ---- Two column layout ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Trending Now */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <h2 className="text-lg font-bold text-foreground">Trending Now</h2>
              <span className="text-xs text-muted ml-auto">недавние, 3+ дней активны</span>
            </div>
            {data.trending.length === 0 ? (
              <p className="text-muted text-sm py-4 text-center">Нет трендовых объявлений</p>
            ) : (
              <div className="space-y-2">
                {data.trending.map((ad) => (
                  <AdCard key={ad.id} ad={ad} />
                ))}
              </div>
            )}
          </Card>

          {/* Longest Running */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <h2 className="text-lg font-bold text-foreground">Longest Running</h2>
              <span className="text-xs text-muted ml-auto">= самые прибыльные</span>
            </div>
            {data.longestRunningAds.length === 0 ? (
              <p className="text-muted text-sm py-4 text-center">Нет данных</p>
            ) : (
              <div className="space-y-2">
                {data.longestRunningAds.map((ad) => (
                  <AdCard key={ad.id} ad={ad} />
                ))}
              </div>
            )}
          </Card>

          {/* Top Saved */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <h2 className="text-lg font-bold text-foreground">Top Saved</h2>
              <span className="text-xs text-muted ml-auto">популярные у пользователей</span>
            </div>
            {data.topSaved.length === 0 ? (
              <p className="text-muted text-sm py-4 text-center">Никто ещё не сохранял</p>
            ) : (
              <div className="space-y-2">
                {data.topSaved.map((ad) => (
                  <AdCard key={ad.id} ad={ad} />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Top Advertisers */}
          <Card>
            <h2 className="text-lg font-bold text-foreground mb-4">Top Advertisers</h2>
            {data.topAdvertisers.length === 0 ? (
              <p className="text-muted text-sm py-4 text-center">Нет данных</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border text-muted text-xs uppercase tracking-wider">
                      <th className="text-left py-2 pr-2">#</th>
                      <th className="text-left py-2 pr-2">Рекламодатель</th>
                      <th className="text-right py-2 pr-2">Ads</th>
                      <th className="text-right py-2 pr-2">Avg d</th>
                      <th className="text-left py-2">GEO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topAdvertisers.map((adv, i) => (
                      <tr key={adv.name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-2 pr-2 text-muted font-medium">{i + 1}</td>
                        <td className="py-2 pr-2 font-medium text-foreground truncate max-w-[200px]">
                          {truncate(adv.name, 30)}
                        </td>
                        <td className="py-2 pr-2 text-right font-semibold">{adv.adCount}</td>
                        <td className="py-2 pr-2 text-right text-muted">{adv.avgDaysActive}d</td>
                        <td className="py-2">
                          <div className="flex gap-1 flex-wrap">
                            {adv.countries.slice(0, 3).map((c) => (
                              <span key={c} className="text-[10px] bg-gray-100 text-muted px-1 rounded">{c}</span>
                            ))}
                            {adv.countries.length > 3 && (
                              <span className="text-[10px] text-muted">+{adv.countries.length - 3}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Verticals Bar Chart */}
          <Card>
            <h2 className="text-lg font-bold text-foreground mb-4">Вертикали</h2>
            {data.adsByVertical.length === 0 ? (
              <p className="text-muted text-sm py-4 text-center">Нет данных</p>
            ) : (
              <div className="space-y-3">
                {data.adsByVertical.map((v) => (
                  <HorizontalBar
                    key={v.slug}
                    label={`${v.name} (${v.activeCount} act, avg ${v.avgDays}d)`}
                    value={v.count}
                    maxValue={maxVertical}
                    color="bg-purple-500"
                  />
                ))}
              </div>
            )}
          </Card>

          {/* Top GEOs Bar Chart */}
          <Card>
            <h2 className="text-lg font-bold text-foreground mb-4">Top GEOs</h2>
            {data.topCountries.length === 0 ? (
              <p className="text-muted text-sm py-4 text-center">Нет данных</p>
            ) : (
              <div className="space-y-3">
                {data.topCountries.map((c) => (
                  <HorizontalBar
                    key={c.country}
                    label={c.country}
                    value={c.count}
                    maxValue={maxCountry}
                    color="bg-blue-500"
                  />
                ))}
              </div>
            )}
          </Card>

          {/* Top Domains */}
          <Card>
            <h2 className="text-lg font-bold text-foreground mb-4">Top Domains</h2>
            {data.topDomains.length === 0 ? (
              <p className="text-muted text-sm py-4 text-center">Нет данных</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border text-muted text-xs uppercase tracking-wider">
                      <th className="text-left py-2">#</th>
                      <th className="text-left py-2">Домен</th>
                      <th className="text-right py-2">Кол-во</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topDomains.map((d, i) => (
                      <tr key={d.domain} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-1.5 text-muted">{i + 1}</td>
                        <td className="py-1.5 font-mono text-xs text-foreground">{d.domain}</td>
                        <td className="py-1.5 text-right font-semibold">{d.count.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ---- Full-width: Daily Activity ---- */}
      <Card>
        <h2 className="text-lg font-bold text-foreground mb-4">Активность за 30 дней</h2>
        {data.dailyActivity.length === 0 ? (
          <p className="text-muted text-sm py-4 text-center">Нет данных</p>
        ) : (
          <div className="flex items-end gap-[3px] h-48">
            {data.dailyActivity.map((day, i) => {
              const pct = maxDaily > 0 ? (day.count / maxDaily) * 100 : 0;
              const isToday = i === data.dailyActivity.length - 1;
              const isWeekend = [0, 6].includes(new Date(day.date).getDay());
              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center justify-end group relative"
                  style={{ height: "100%" }}
                >
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10">
                    <div className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
                      {formatShortDate(day.date)}: {day.count.toLocaleString()}
                    </div>
                    <div className="w-1.5 h-1.5 bg-gray-900 rotate-45 -mt-0.5" />
                  </div>
                  <div
                    className={`w-full rounded-t transition-all duration-300 ${
                      isToday
                        ? "bg-blue-600"
                        : isWeekend
                          ? "bg-blue-300"
                          : "bg-blue-400"
                    } hover:opacity-80`}
                    style={{ height: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              );
            })}
          </div>
        )}
        {data.dailyActivity.length > 0 && (
          <div className="flex justify-between mt-2 text-[10px] text-muted">
            <span>{formatShortDate(data.dailyActivity[0].date)}</span>
            <span>{formatShortDate(data.dailyActivity[data.dailyActivity.length - 1].date)}</span>
          </div>
        )}
      </Card>

      {/* ---- Full-width: Recent Ads ---- */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">Недавно добавленные</h2>
          <Link href="/dashboard/ads" className="text-sm text-blue-600 hover:underline">
            Все объявления
          </Link>
        </div>
        {data.recentAds.length === 0 ? (
          <p className="text-muted text-sm py-4 text-center">Нет данных</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2">
            {data.recentAds.map((ad) => {
              const creative = ad.creatives?.[0];
              const thumb = creative?.thumbnailB2Key || creative?.originalUrl;
              return (
                <Link
                  key={ad.id}
                  href={`/dashboard/ads/${ad.id}`}
                  className="flex-shrink-0 w-56 rounded-lg border border-card-border bg-white hover:shadow-md transition-shadow p-3 group"
                >
                  {thumb ? (
                    <div className="w-full h-28 rounded-md overflow-hidden bg-gray-100 mb-2">
                      <img src={thumb} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-full h-28 rounded-md bg-gray-100 flex items-center justify-center mb-2">
                      <span className="text-muted text-xs">No image</span>
                    </div>
                  )}
                  <p className="text-xs font-semibold text-foreground truncate group-hover:text-blue-600 transition-colors">
                    {ad.advertiserName || "Unknown"}
                  </p>
                  <p className="text-[10px] text-muted truncate mt-0.5">{truncate(ad.adText, 60)}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {ad.vertical && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100">
                        {ad.vertical.name}
                      </span>
                    )}
                    <span className="text-[10px] text-muted ml-auto">{formatRelativeDate(ad.createdAt)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      {/* ---- Parse Health ---- */}
      <Card>
        <h2 className="text-lg font-bold text-foreground mb-3">Parse Health</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-muted uppercase tracking-wider">Последний парсинг</span>
            <span className="text-sm font-semibold text-foreground mt-1">
              {data.lastParseTime ? formatRelativeDate(data.lastParseTime) : "Никогда"}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted uppercase tracking-wider">Всего парсингов</span>
            <span className="text-sm font-semibold text-foreground mt-1">{data.totalParses.toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted uppercase tracking-wider">Успешность</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-semibold text-foreground">{data.parseSuccessRate}%</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden max-w-[120px]">
                <div
                  className={`h-full rounded-full ${
                    data.parseSuccessRate >= 90
                      ? "bg-green-500"
                      : data.parseSuccessRate >= 70
                        ? "bg-amber-500"
                        : "bg-red-500"
                  }`}
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

function WeekChange({
  change,
  thisWeek,
  lastWeek,
}: {
  change: number;
  thisWeek: number;
  lastWeek: number;
}) {
  if (change > 0) {
    return (
      <span className="flex items-center gap-1 text-green-600">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
        </svg>
        {thisWeek} vs {lastWeek}
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="flex items-center gap-1 text-red-600">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
        </svg>
        {thisWeek} vs {lastWeek}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-gray-500">
      <span className="text-lg leading-none">--</span>
      {thisWeek} vs {lastWeek}
    </span>
  );
}
