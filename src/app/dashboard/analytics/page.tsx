"use client";

import { useState, useEffect } from "react";
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

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getCreativeUrl(ad: AdItem): string | null {
  const c = ad.creatives?.[0];
  if (!c) return null;
  const url = c.originalUrl;
  return url ? proxyUrl(url) : null;
}

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
        <h1 className="text-2xl font-bold text-foreground">Insights</h1>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
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

function AnalyticsContent({ data }: { data: AnalyticsData }) {
  const maxDaily = Math.max(...data.dailyActivity.map((d) => d.count), 1);
  const activePct = data.totalAds > 0 ? Math.round((data.activeAds / data.totalAds) * 100) : 0;

  return (
    <>
      {/* Key Metrics — only the ones that matter */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card-bg border border-card-border rounded-lg p-4">
          <p className="text-xs text-muted mb-1">Всего объявлений</p>
          <p className="text-2xl font-bold text-foreground">{data.totalAds.toLocaleString()}</p>
          <p className="text-xs text-green-600 mt-0.5">+{data.newToday} сегодня</p>
        </div>
        <div className="bg-card-bg border border-card-border rounded-lg p-4">
          <p className="text-xs text-muted mb-1">Активных</p>
          <p className="text-2xl font-bold text-green-600">{activePct}%</p>
          <p className="text-xs text-muted mt-0.5">{data.activeAds.toLocaleString()} из {data.totalAds.toLocaleString()}</p>
        </div>
        <div className="bg-card-bg border border-card-border rounded-lg p-4">
          <p className="text-xs text-muted mb-1">Сред. время жизни</p>
          <p className="text-2xl font-bold text-foreground">{data.avgDaysActive} дн.</p>
          <p className="text-xs text-muted mt-0.5">активных объявлений</p>
        </div>
        <div className="bg-card-bg border border-card-border rounded-lg p-4">
          <p className="text-xs text-muted mb-1">За неделю</p>
          <p className="text-2xl font-bold text-foreground">+{data.newThisWeek}</p>
          <p className={`text-xs mt-0.5 ${data.weekOverWeekChange >= 0 ? "text-green-600" : "text-red-500"}`}>
            {data.weekOverWeekChange >= 0 ? "+" : ""}{data.weekOverWeekChange}% vs прошлая
          </p>
        </div>
      </div>

      {/* Activity Chart */}
      {data.dailyActivity.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-foreground mb-3">Новые объявления за 30 дней</h2>
          <div className="flex items-end gap-px h-24">
            {data.dailyActivity.map((day, i) => {
              const pct = (day.count / maxDaily) * 100;
              const isToday = i === data.dailyActivity.length - 1;
              return (
                <div
                  key={day.date}
                  className="flex-1 group relative"
                  title={`${formatShortDate(day.date)}: ${day.count} ads`}
                >
                  <div
                    className={`w-full rounded-t-sm ${isToday ? "bg-blue-600" : "bg-blue-300"} hover:bg-blue-500 transition-colors`}
                    style={{ height: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-muted">
            <span>{formatShortDate(data.dailyActivity[0].date)}</span>
            <span>{formatShortDate(data.dailyActivity[data.dailyActivity.length - 1].date)}</span>
          </div>
        </Card>
      )}

      {/* Two columns: Insights left, Hot Ads right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column — Market insights */}
        <div className="space-y-6">
          {/* Hot Verticals */}
          <Card>
            <h2 className="text-sm font-semibold text-foreground mb-1">Горячие вертикали</h2>
            <p className="text-[10px] text-muted mb-3">Больше объявлений = больше конкуренция и спрос</p>
            {data.adsByVertical.length === 0 ? (
              <p className="text-muted text-sm py-4 text-center">Нет данных</p>
            ) : (
              <div className="space-y-2.5">
                {data.adsByVertical.map((v) => {
                  const maxV = Math.max(...data.adsByVertical.map(x => x.count), 1);
                  const pct = (v.count / maxV) * 100;
                  return (
                    <div key={v.slug}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{v.name}</span>
                          <span className="text-[10px] text-muted">{v.avgDays}d avg life</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-green-600">{v.activeCount} act</span>
                          <span className="text-sm font-semibold text-muted">{v.count}</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-purple-500 h-full rounded-full" style={{ width: `${Math.max(pct, 1)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Top GEOs */}
          <Card>
            <h2 className="text-sm font-semibold text-foreground mb-1">Top GEO</h2>
            <p className="text-[10px] text-muted mb-3">Где больше всего рекламы крутят</p>
            {data.topCountries.length === 0 ? (
              <p className="text-muted text-sm py-4 text-center">Нет данных</p>
            ) : (
              <div className="space-y-1.5">
                {data.topCountries.slice(0, 12).map((c, i) => {
                  const maxC = data.topCountries[0].count;
                  const pct = (c.count / maxC) * 100;
                  return (
                    <div key={c.country} className="flex items-center gap-2">
                      <span className="text-xs text-muted w-4 text-right">{i + 1}</span>
                      <span className="text-sm text-foreground w-8">{c.country}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-blue-400 h-full rounded-full" style={{ width: `${Math.max(pct, 1)}%` }} />
                      </div>
                      <span className="text-xs text-muted w-12 text-right">{c.count.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Top Advertisers */}
          <Card>
            <h2 className="text-sm font-semibold text-foreground mb-1">Top рекламодатели</h2>
            <p className="text-[10px] text-muted mb-3">Крупные игроки — у них можно подсмотреть подходы</p>
            {data.topAdvertisers.length === 0 ? (
              <p className="text-muted text-sm py-4 text-center">Нет данных</p>
            ) : (
              <div className="space-y-2">
                {data.topAdvertisers.slice(0, 10).map((adv, i) => (
                  <div key={adv.name} className="flex items-center gap-2 py-1">
                    <span className="text-xs text-muted w-4 text-right">{i + 1}</span>
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
          {data.topDomains.length > 0 && (
            <Card>
              <h2 className="text-sm font-semibold text-foreground mb-1">Top лендинги</h2>
              <p className="text-[10px] text-muted mb-3">Домены куда ведет реклама</p>
              <div className="space-y-1.5">
                {data.topDomains.slice(0, 10).map((d, i) => (
                  <div key={d.domain} className="flex items-center justify-between py-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted w-4 text-right">{i + 1}</span>
                      <span className="text-sm text-foreground truncate">{d.domain}</span>
                    </div>
                    <span className="text-xs font-semibold text-muted ml-2">{d.count}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right column — Ad lists with creatives */}
        <div className="space-y-6">
          {/* Profitable Ads (longest running) */}
          <Card>
            <h2 className="text-sm font-semibold text-foreground mb-1">Прибыльные объявления</h2>
            <p className="text-[10px] text-muted mb-3">Долго крутят = зарабатывают. Изучай подходы</p>
            {data.longestRunningAds.length === 0 ? (
              <p className="text-muted text-sm py-4 text-center">Нет данных</p>
            ) : (
              <div className="space-y-1">
                {data.longestRunningAds.slice(0, 8).map((ad) => (
                  <AdCard key={ad.id} ad={ad} badge={`${ad.daysActive}d`} badgeColor="bg-green-50 text-green-700" />
                ))}
              </div>
            )}
          </Card>

          {/* Trending */}
          <Card>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <h2 className="text-sm font-semibold text-foreground">Trending</h2>
            </div>
            <p className="text-[10px] text-muted mb-3">Свежие объявления которые уже набрали обороты</p>
            {data.trending.length === 0 ? (
              <p className="text-muted text-sm py-4 text-center">Нет трендовых объявлений</p>
            ) : (
              <div className="space-y-1">
                {data.trending.slice(0, 8).map((ad) => (
                  <AdCard key={ad.id} ad={ad} badge={`${ad.daysActive}d`} badgeColor="bg-orange-50 text-orange-700" />
                ))}
              </div>
            )}
          </Card>

          {/* Recent */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Свежие</h2>
                <p className="text-[10px] text-muted">Только что появились в FB Ad Library</p>
              </div>
              <Link href="/dashboard" className="text-xs text-blue-600 hover:underline">Все</Link>
            </div>
            {data.recentAds.length === 0 ? (
              <p className="text-muted text-sm py-4 text-center">Нет данных</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {data.recentAds.slice(0, 6).map((ad) => {
                  const imgUrl = getCreativeUrl(ad);
                  return (
                    <Link
                      key={ad.id}
                      href={`/dashboard/ads/${ad.id}`}
                      className="rounded-lg border border-card-border bg-white hover:shadow transition-shadow p-1.5 group"
                    >
                      {imgUrl ? (
                        <div className="w-full aspect-video rounded overflow-hidden bg-gray-100 mb-1">
                          <img src={imgUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      ) : (
                        <div className="w-full aspect-video rounded bg-gray-100 mb-1 flex items-center justify-center">
                          <span className="text-[10px] text-gray-400">No preview</span>
                        </div>
                      )}
                      <p className="text-[11px] font-medium text-foreground truncate group-hover:text-blue-600">
                        {ad.advertiserName || "Unknown"}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {ad.vertical && (
                          <span className="text-[9px] px-1 rounded bg-purple-50 text-purple-700">{ad.vertical.name}</span>
                        )}
                        {ad.countries.slice(0, 2).map((c) => (
                          <span key={c} className="text-[9px] text-muted bg-gray-100 px-1 rounded">{c}</span>
                        ))}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function AdCard({ ad, badge, badgeColor }: { ad: AdItem; badge: string; badgeColor: string }) {
  const imgUrl = getCreativeUrl(ad);
  return (
    <Link
      href={`/dashboard/ads/${ad.id}`}
      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
    >
      {imgUrl ? (
        <div className="w-12 h-12 rounded overflow-hidden bg-gray-100 flex-shrink-0">
          <img src={imgUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
      ) : (
        <div className="w-12 h-12 rounded bg-gray-100 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate group-hover:text-blue-600">
          {ad.advertiserName || "Unknown"}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {ad.vertical && (
            <span className="text-[10px] px-1 py-px rounded bg-purple-50 text-purple-700">{ad.vertical.name}</span>
          )}
          {ad.countries.slice(0, 2).map((c) => (
            <span key={c} className="text-[10px] text-muted bg-gray-100 px-1 rounded">{c}</span>
          ))}
        </div>
      </div>
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeColor} flex-shrink-0`}>
        {badge}
      </span>
    </Link>
  );
}
