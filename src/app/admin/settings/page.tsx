"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import Card from "@/components/ui/Card";

interface DashData {
  users: { total: number; free: number; pro: number; business: number; thisWeek: number; thisMonth: number };
  revenue: { mrr: number; planBreakdown: { plan: string; count: number; mrr: number }[] };
  ads: { total: number; active: number; today: number; week: number; month: number };
  creatives: { total: number; images: number; videos: number };
  projects: { total: number; savedAds: number };
  parsing: { totalParses: number; successParses: number; successRate: number; totalKeywords: number; activeKeywords: number; lastParse: string | null };
  health: { adsWithoutCreatives: number; expiredCreatives: number; dbSizeBytes: number; metaApiConfigured: boolean; b2Configured: boolean; downloadsTotal: number };
  verticals: { name: string; slug: string; count: number }[];
  topCountries: { country: string; count: number }[];
  topAdvertisers: { name: string; count: number }[];
  recentAds: { id: string; advertiser: string | null; vertical: string | null; countries: string[]; creatives: number; createdAt: string }[];
  recentUsers: { id: string; email: string; name: string | null; plan: string; role: string; createdAt: string }[];
}

function formatBytes(b: number) {
  if (b === 0) return "0 B";
  const k = 1024;
  const s = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(1)) + " " + s[i];
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem("token") || "";
        const res = await fetch("/api/admin/settings", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setData(await res.json());
      } catch {} finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return (
    <DashboardLayout title="Admin Dashboard" requireAdmin>
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    </DashboardLayout>
  );

  if (!data) return (
    <DashboardLayout title="Admin Dashboard" requireAdmin>
      <Card className="text-center py-12"><p className="text-gray-500">Failed to load</p></Card>
    </DashboardLayout>
  );

  const { users, revenue, ads, creatives, projects, parsing, health, verticals, topCountries, topAdvertisers, recentAds, recentUsers } = data;
  const maxV = Math.max(...verticals.map(v => v.count), 1);
  const maxC = Math.max(...topCountries.map(c => c.count), 1);

  return (
    <DashboardLayout title="Admin Dashboard" requireAdmin>
      <div className="space-y-6">

        {/* Row 1: Revenue + Users */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPI label="MRR" value={`$${revenue.mrr}`} color="text-green-600" sub="monthly revenue" />
          <KPI label="Users" value={users.total} color="text-blue-600" sub={`+${users.thisWeek} this week`} />
          <KPI label="FREE" value={users.free} color="text-gray-600" sub={`${users.total > 0 ? Math.round(users.free/users.total*100) : 0}%`} />
          <KPI label="PRO" value={users.pro} color="text-purple-600" sub={`$${revenue.planBreakdown.find(p=>p.plan==='PRO')?.mrr||0}/mo`} />
          <KPI label="BUSINESS" value={users.business} color="text-amber-600" sub={`$${revenue.planBreakdown.find(p=>p.plan==='BUSINESS')?.mrr||0}/mo`} />
          <KPI label="New Users" value={`+${users.thisMonth}`} color="text-green-600" sub="this month" />
        </div>

        {/* Row 2: Content KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPI label="Total Ads" value={ads.total.toLocaleString()} color="text-blue-600" sub={`+${ads.today} today`} />
          <KPI label="Active Ads" value={ads.active.toLocaleString()} color="text-green-600" sub={`${ads.total>0?Math.round(ads.active/ads.total*100):0}% active`} />
          <KPI label="Creatives" value={creatives.total.toLocaleString()} color="text-purple-600" sub={`${creatives.images} img / ${creatives.videos} vid`} />
          <KPI label="Projects" value={projects.total} color="text-blue-600" sub={`${projects.savedAds} saved ads`} />
          <KPI label="Week Ads" value={`+${ads.week.toLocaleString()}`} color="text-amber-600" sub="new this week" />
          <KPI label="Month Ads" value={`+${ads.month.toLocaleString()}`} color="text-purple-600" sub="new this month" />
        </div>

        {/* Row 3: Three columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* System Health + Parsing */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">System Health</h3>
            <div className="space-y-2">
              <HealthRow label="DB Size" value={formatBytes(health.dbSizeBytes)} />
              <HealthRow label="Ads w/o Creatives" value={String(health.adsWithoutCreatives)} warn={health.adsWithoutCreatives > 0} />
              <HealthRow label="Expired Creatives" value={String(health.expiredCreatives)} warn={health.expiredCreatives > 100} />
              <HealthRow label="Downloads (month)" value={String(health.downloadsTotal)} />
              <StatusRow label="Meta API" ok={health.metaApiConfigured} />
              <StatusRow label="B2 Storage" ok={health.b2Configured} />
              <div className="border-t border-gray-100 pt-2 mt-2">
                <h4 className="text-xs font-semibold text-gray-600 mb-2">Parsing</h4>
                <HealthRow label="Keywords" value={`${parsing.activeKeywords}/${parsing.totalKeywords} active`} />
                <HealthRow label="Total Parses" value={String(parsing.totalParses)} />
                <HealthRow label="Success Rate" value={`${parsing.successRate}%`} warn={parsing.successRate < 80} />
                <HealthRow label="Last Parse" value={parsing.lastParse ? timeAgo(parsing.lastParse) : "Never"} />
              </div>
            </div>
          </Card>

          {/* Verticals */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Ads by Vertical</h3>
            <div className="space-y-2">
              {verticals.map(v => (
                <div key={v.slug}>
                  <div className="flex justify-between text-sm mb-0.5">
                    <span className="text-gray-700">{v.name}</span>
                    <span className="text-gray-500">{v.count.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-purple-500 h-full rounded-full" style={{ width: `${(v.count/maxV)*100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Top GEOs */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Top GEOs</h3>
            <div className="space-y-2">
              {topCountries.slice(0, 10).map(c => (
                <div key={c.country}>
                  <div className="flex justify-between text-sm mb-0.5">
                    <span className="text-gray-700">{c.country}</span>
                    <span className="text-gray-500">{c.count.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-blue-400 h-full rounded-full" style={{ width: `${(c.count/maxC)*100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Row 4: Two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Recent Users */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800">Recent Users</h3>
              <Link href="/admin/users" className="text-xs text-blue-600 hover:underline">All users</Link>
            </div>
            <div className="space-y-2">
              {recentUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{u.email}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-px rounded font-medium ${
                        u.plan === 'BUSINESS' ? 'bg-purple-50 text-purple-700' :
                        u.plan === 'PRO' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>{u.plan}</span>
                      {u.role === 'ADMIN' && <span className="text-[10px] px-1.5 py-px rounded bg-red-50 text-red-700 font-medium">ADMIN</span>}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{formatDate(u.createdAt)}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Top Advertisers + Recent Ads */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Top Advertisers</h3>
            <div className="space-y-1.5 mb-4">
              {topAdvertisers.slice(0, 8).map((a, i) => (
                <div key={a.name} className="flex items-center gap-2 py-0.5">
                  <span className="text-xs text-gray-400 w-4 text-right">{i+1}</span>
                  <span className="text-sm text-gray-700 truncate flex-1">{a.name}</span>
                  <span className="text-sm font-semibold text-gray-500">{a.count}</span>
                </div>
              ))}
            </div>

            <h3 className="text-sm font-semibold text-gray-800 mb-3 pt-3 border-t border-gray-100">Recent Ads</h3>
            <div className="space-y-2">
              {recentAds.map(ad => (
                <div key={ad.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{ad.advertiser || "Unknown"}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {ad.vertical && <span className="text-[10px] px-1 py-px bg-purple-50 text-purple-700 rounded">{ad.vertical}</span>}
                      {ad.countries.map(c => <span key={c} className="text-[10px] text-gray-500 bg-gray-100 px-1 rounded">{c}</span>)}
                      <span className="text-[10px] text-gray-400">{ad.creatives} creo</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(ad.createdAt)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Revenue Breakdown */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Revenue Breakdown</h3>
          <div className="grid grid-cols-3 gap-4">
            {revenue.planBreakdown.map(p => (
              <div key={p.plan} className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">{p.plan}</p>
                <p className="text-lg font-bold text-gray-800">{p.count} users</p>
                <p className="text-sm font-semibold text-green-600">${p.mrr}/mo</p>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-600">Total MRR</span>
            <span className="text-lg font-bold text-green-600">${revenue.mrr}/mo</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Based on PRO=$29/mo, BUSINESS=$99/mo pricing</p>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function KPI({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function HealthRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-semibold ${warn ? 'text-red-600' : 'text-gray-800'}`}>{value}</span>
    </div>
  );
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm text-gray-600">{ok ? 'OK' : 'Missing'}</span>
      </div>
    </div>
  );
}
