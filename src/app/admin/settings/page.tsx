"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import Card from "@/components/ui/Card";

interface DashboardData {
  overview: {
    totalAds: number;
    totalCreatives: number;
    imageCreatives: number;
    videoCreatives: number;
    totalUsers: number;
    totalProjects: number;
    totalProjectItems: number;
    proUsers: number;
    businessUsers: number;
  };
  growth: {
    adsToday: number;
    adsWeek: number;
    adsMonth: number;
    usersThisWeek: number;
  };
  health: {
    adsWithoutCreatives: number;
    expiredCreatives: number;
    dbSizeBytes: number;
    metaApiConfigured: boolean;
    b2Configured: boolean;
  };
  verticals: { name: string; slug: string; count: number }[];
  topCountries: { country: string; count: number }[];
  topAdvertisers: { name: string; count: number }[];
  recentAds: {
    id: string;
    advertiser: string | null;
    vertical: string | null;
    countries: string[];
    creatives: number;
    createdAt: string;
  }[];
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function StatBox({ label, value, sub, color = "text-foreground" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{typeof value === "number" ? value.toLocaleString() : value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function BarRow({ label, value, max, color = "bg-blue-500" }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700 truncate">{label}</span>
        <span className="text-gray-500 ml-2 flex-shrink-0">{value.toLocaleString()}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div className={`${color} h-full rounded-full`} style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem("token") || "";
        const res = await fetch("/api/admin/settings", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setData(await res.json());
      } catch {} finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <DashboardLayout title="Admin Dashboard" requireAdmin>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout title="Admin Dashboard" requireAdmin>
        <Card className="text-center py-12">
          <p className="text-gray-500">Failed to load dashboard data</p>
        </Card>
      </DashboardLayout>
    );
  }

  const { overview, growth, health, verticals, topCountries, topAdvertisers, recentAds } = data;
  const maxVertical = Math.max(...verticals.map(v => v.count), 1);
  const maxCountry = Math.max(...topCountries.map(c => c.count), 1);

  return (
    <DashboardLayout title="Admin Dashboard" requireAdmin>
      <div className="space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatBox label="Total Ads" value={overview.totalAds} color="text-blue-600" />
          <StatBox label="Creatives" value={overview.totalCreatives} sub={`${overview.imageCreatives} img / ${overview.videoCreatives} vid`} />
          <StatBox label="Users" value={overview.totalUsers} sub={`${overview.proUsers} PRO / ${overview.businessUsers} BIZ`} color="text-green-600" />
          <StatBox label="Projects" value={overview.totalProjects} sub={`${overview.totalProjectItems} saved ads`} />
          <StatBox label="Today" value={`+${growth.adsToday}`} sub="new ads" color="text-amber-600" />
          <StatBox label="This Week" value={`+${growth.adsWeek}`} sub={`users: +${growth.usersThisWeek}`} color="text-purple-600" />
        </div>

        {/* Health + Growth */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* System Health */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">System Health</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-600">DB Size</span>
                <span className="text-sm font-semibold text-gray-800">{formatBytes(health.dbSizeBytes)}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-600">Ads w/o Creatives</span>
                <span className={`text-sm font-semibold ${health.adsWithoutCreatives > 0 ? "text-red-600" : "text-green-600"}`}>
                  {health.adsWithoutCreatives}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-600">Expired Creatives</span>
                <span className="text-sm font-semibold text-gray-800">{health.expiredCreatives}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-600">Meta API</span>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${health.metaApiConfigured ? "bg-green-500" : "bg-red-500"}`} />
                  <span className="text-sm text-gray-600">{health.metaApiConfigured ? "Configured" : "Missing"}</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-600">B2 Storage</span>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${health.b2Configured ? "bg-green-500" : "bg-gray-400"}`} />
                  <span className="text-sm text-gray-600">{health.b2Configured ? "Configured" : "Not set"}</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-600">Month Ads</span>
                <span className="text-sm font-semibold text-gray-800">+{growth.adsMonth.toLocaleString()}</span>
              </div>
            </div>
          </Card>

          {/* Verticals */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Verticals</h3>
            <div className="space-y-2">
              {verticals.map(v => (
                <BarRow key={v.slug} label={v.name} value={v.count} max={maxVertical} color="bg-purple-500" />
              ))}
            </div>
          </Card>

          {/* Top GEOs */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Top GEOs</h3>
            <div className="space-y-2">
              {topCountries.slice(0, 10).map(c => (
                <BarRow key={c.country} label={c.country} value={c.count} max={maxCountry} color="bg-blue-500" />
              ))}
            </div>
          </Card>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Advertisers */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Top Advertisers</h3>
            <div className="space-y-1.5">
              {topAdvertisers.map((a, i) => (
                <div key={a.name} className="flex items-center gap-2 py-1">
                  <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                  <span className="text-sm text-gray-700 truncate flex-1">{a.name}</span>
                  <span className="text-sm font-semibold text-gray-500">{a.count}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent Ads */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Recent Ads</h3>
            <div className="space-y-2">
              {recentAds.map(ad => (
                <div key={ad.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{ad.advertiser || "Unknown"}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {ad.vertical && (
                        <span className="text-[10px] px-1 py-px bg-purple-50 text-purple-700 rounded">{ad.vertical}</span>
                      )}
                      {ad.countries.map(c => (
                        <span key={c} className="text-[10px] text-gray-500 bg-gray-100 px-1 rounded">{c}</span>
                      ))}
                      <span className="text-[10px] text-gray-400">{ad.creatives} creo</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatTimeAgo(ad.createdAt)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
