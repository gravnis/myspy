/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import Card from "@/components/ui/Card";

interface ScraperConfig {
  id: string;
  type: string;
  name: string;
  isEnabled: boolean;
  config: any;
  schedule: string | null;
  lastRunAt: string | null;
  jobs: ScraperJob[];
}

interface ScraperJob {
  id: string;
  type: string;
  status: string;
  pid: number | null;
  config: any;
  progress: any;
  adsFound: number;
  adsNew: number;
  adsUpdated: number;
  unitsUsed: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface Stats {
  totalJobs: number;
  runningJobs: number;
  totalAdsScraped: number;
  totalUnitsUsed: number;
}

interface Keyword {
  id: string;
  keyword: string;
  vertical: { name: string } | null;
  isActive: boolean;
  lastParsedAt: string | null;
  logsCount: number;
}

const SCRAPER_TYPES = [
  { value: "GRAPHQL", label: "GraphQL", desc: "FB GraphQL API через Browserless — ~130 объявлений/юнит", color: "blue" },
  { value: "BROWSERLESS", label: "Browserless", desc: "Прокрутка страниц через Browserless — ~20 объявлений/юнит", color: "purple" },
  { value: "LOCAL", label: "Local", desc: "Локальный Puppeteer (не работает с FB)", color: "gray" },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  RUNNING: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500 animate-pulse" },
  COMPLETED: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  ERROR: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  STOPPED: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
};

export default function AdminParsingPage() {
  const [configs, setConfigs] = useState<ScraperConfig[]>([]);
  const [recentJobs, setRecentJobs] = useState<ScraperJob[]>([]);
  const [stats, setStats] = useState<Stats>({ totalJobs: 0, runningJobs: 0, totalAdsScraped: 0, totalUnitsUsed: 0 });
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"scrapers" | "jobs" | "keywords">("scrapers");
  const [showAddScraper, setShowAddScraper] = useState(false);
  const [showQuickRun, setShowQuickRun] = useState(false);
  const [newScraper, setNewScraper] = useState({ name: "", type: "GRAPHQL", schedule: "manual", config: { keyword: "casino", country: "US", maxAds: 500, maxCombos: 30 } });
  const [quickRun, setQuickRun] = useState({ type: "GRAPHQL", keyword: "casino", country: "US", maxAds: 500 });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showKwForm, setShowKwForm] = useState(false);
  const [kwForm, setKwForm] = useState({ keyword: "", isActive: true });

  const getToken = () => localStorage.getItem("token") || "";

  const fetchData = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${getToken()}` };
      const [scrapersRes, kwRes] = await Promise.all([
        fetch("/api/admin/scrapers", { headers }),
        fetch("/api/admin/keywords", { headers }),
      ]);
      if (scrapersRes.ok) {
        const d = await scrapersRes.json();
        setConfigs(d.configs || []);
        setRecentJobs(d.recentJobs || []);
        if (d.stats) setStats(d.stats);
      }
      if (kwRes.ok) {
        const d = await kwRes.json();
        setKeywords(d.keywords || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh when jobs are running
  useEffect(() => {
    if (stats.runningJobs > 0) {
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [stats.runningJobs, fetchData]);

  const handleCreateConfig = async () => {
    try {
      await fetch("/api/admin/scrapers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ action: "create_config", ...newScraper }),
      });
      setShowAddScraper(false);
      fetchData();
    } catch {}
  };

  const handleUpdateConfig = async (id: string, data: Partial<ScraperConfig>) => {
    try {
      await fetch(`/api/admin/scrapers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(data),
      });
      fetchData();
    } catch {}
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm("Удалить этот парсер и все его логи?")) return;
    try {
      await fetch(`/api/admin/scrapers/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      fetchData();
    } catch {}
  };

  const handleStartJob = async (configId: string, config?: any, type?: string) => {
    setActionLoading(configId);
    try {
      await fetch("/api/admin/scrapers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ action: "start", configId, config, type }),
      });
      fetchData();
    } catch {} finally {
      setActionLoading(null);
    }
  };

  const handleStopJob = async (jobId: string) => {
    setActionLoading(jobId);
    try {
      await fetch("/api/admin/scrapers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ action: "stop", jobId }),
      });
      fetchData();
    } catch {} finally {
      setActionLoading(null);
    }
  };

  const handleQuickRun = async () => {
    setActionLoading("quick");
    try {
      await fetch("/api/admin/scrapers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          action: "start",
          type: quickRun.type,
          config: quickRun.type === "GRAPHQL"
            ? { keyword: quickRun.keyword, country: quickRun.country, maxAds: quickRun.maxAds }
            : { maxCombos: quickRun.maxAds },
        }),
      });
      setShowQuickRun(false);
      fetchData();
    } catch {} finally {
      setActionLoading(null);
    }
  };

  const handleAddKeyword = async () => {
    if (!kwForm.keyword.trim()) return;
    try {
      await fetch("/api/admin/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ keyword: kwForm.keyword.trim(), isActive: kwForm.isActive }),
      });
      setKwForm({ keyword: "", isActive: true });
      setShowKwForm(false);
      fetchData();
    } catch {}
  };

  const handleToggleKeyword = async (kw: Keyword) => {
    try {
      await fetch(`/api/admin/keywords/${kw.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ isActive: !kw.isActive }),
      });
      fetchData();
    } catch {}
  };

  const handleDeleteKeyword = async (id: string) => {
    if (!confirm("Удалить ключевое слово?")) return;
    try {
      await fetch(`/api/admin/keywords/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      fetchData();
    } catch {}
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const formatDuration = (start: string, end: string | null) => {
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const diff = Math.round((e - s) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  };

  if (loading) {
    return (
      <DashboardLayout title="Scraper Management" requireAdmin>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Scraper Management" requireAdmin>
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Card>
          <p className="text-xs text-gray-500">Running Now</p>
          <p className={`text-2xl font-bold ${stats.runningJobs > 0 ? "text-green-600" : "text-gray-400"}`}>
            {stats.runningJobs}
          </p>
          {stats.runningJobs > 0 && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block" />}
        </Card>
        <Card>
          <p className="text-xs text-gray-500">Total Runs</p>
          <p className="text-2xl font-bold text-blue-600">{stats.totalJobs}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">Ads Scraped</p>
          <p className="text-2xl font-bold text-green-600">{stats.totalAdsScraped.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">Units Used</p>
          <p className="text-2xl font-bold text-purple-600">{stats.totalUnitsUsed}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">Scrapers</p>
          <p className="text-2xl font-bold text-gray-700">{configs.length}</p>
          <p className="text-[10px] text-gray-400">{configs.filter(c => c.isEnabled).length} enabled</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
        {[
          { key: "scrapers", label: "Scrapers", count: configs.length },
          { key: "jobs", label: "Job History", count: recentJobs.length },
          { key: "keywords", label: "Keywords", count: keywords.length },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">{t.count}</span>
          </button>
        ))}
      </div>

      {/* ===== SCRAPERS TAB ===== */}
      {tab === "scrapers" && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setShowAddScraper(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              + Add Scraper
            </button>
            <button
              onClick={() => setShowQuickRun(true)}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
            >
              Quick Run
            </button>
          </div>

          {/* Quick Run Modal */}
          {showQuickRun && (
            <Card className="mb-4 border-2 border-green-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Run — запустить без сохранения конфига</h3>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Type</label>
                  <select value={quickRun.type} onChange={e => setQuickRun({ ...quickRun, type: e.target.value })}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                    <option value="GRAPHQL">GraphQL (~130 ads/unit)</option>
                    <option value="BROWSERLESS">Browserless (~20 ads/unit)</option>
                  </select>
                </div>
                {quickRun.type === "GRAPHQL" && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Keyword</label>
                      <input value={quickRun.keyword} onChange={e => setQuickRun({ ...quickRun, keyword: e.target.value })}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-40" placeholder="casino" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Country</label>
                      <input value={quickRun.country} onChange={e => setQuickRun({ ...quickRun, country: e.target.value })}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-20" placeholder="US" />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{quickRun.type === "GRAPHQL" ? "Max Ads" : "Max Combos"}</label>
                  <input type="number" value={quickRun.maxAds} onChange={e => setQuickRun({ ...quickRun, maxAds: parseInt(e.target.value) || 100 })}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-24" />
                </div>
                <button onClick={handleQuickRun} disabled={actionLoading === "quick"}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {actionLoading === "quick" ? "Starting..." : "Run"}
                </button>
                <button onClick={() => setShowQuickRun(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">Cancel</button>
              </div>
            </Card>
          )}

          {/* Add Scraper Form */}
          {showAddScraper && (
            <Card className="mb-4 border-2 border-blue-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">New Scraper Configuration</h3>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-xs text-gray-500 mb-1">Name</label>
                  <input value={newScraper.name} onChange={e => setNewScraper({ ...newScraper, name: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Casino US Parser" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Type</label>
                  <select value={newScraper.type} onChange={e => setNewScraper({ ...newScraper, type: e.target.value })}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                    {SCRAPER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Keyword</label>
                  <input value={newScraper.config.keyword} onChange={e => setNewScraper({ ...newScraper, config: { ...newScraper.config, keyword: e.target.value } })}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Country</label>
                  <input value={newScraper.config.country} onChange={e => setNewScraper({ ...newScraper, config: { ...newScraper.config, country: e.target.value } })}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-16" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max Ads</label>
                  <input type="number" value={newScraper.config.maxAds} onChange={e => setNewScraper({ ...newScraper, config: { ...newScraper.config, maxAds: parseInt(e.target.value) || 500 } })}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-20" />
                </div>
                <button onClick={handleCreateConfig} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Create</button>
                <button onClick={() => setShowAddScraper(false)} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">Cancel</button>
              </div>
            </Card>
          )}

          {/* Scraper Cards */}
          {configs.length === 0 ? (
            <Card>
              <p className="text-center text-gray-400 py-8">Нет сохранённых парсеров. Нажми &quot;Add Scraper&quot; или &quot;Quick Run&quot;.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {configs.map(sc => {
                const latestJob = sc.jobs[0];
                const isRunning = latestJob?.status === "RUNNING";
                const typeInfo = SCRAPER_TYPES.find(t => t.value === sc.type);
                const cfg = sc.config as any;

                return (
                  <Card key={sc.id} className={`${isRunning ? "border-2 border-green-300 bg-green-50/30" : ""}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-800">{sc.name}</h3>
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium bg-${typeInfo?.color || "gray"}-100 text-${typeInfo?.color || "gray"}-700`}>
                            {sc.type}
                          </span>
                          <span className={`w-2 h-2 rounded-full ${sc.isEnabled ? "bg-green-500" : "bg-gray-300"}`} />
                          <span className="text-xs text-gray-400">{sc.isEnabled ? "Enabled" : "Disabled"}</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{typeInfo?.desc}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                          {cfg?.keyword && <span>Keyword: <b>{cfg.keyword}</b></span>}
                          {cfg?.country && <span>Country: <b>{cfg.country}</b></span>}
                          {cfg?.maxAds && <span>Max: <b>{cfg.maxAds}</b></span>}
                          {cfg?.maxCombos && <span>Combos: <b>{cfg.maxCombos}</b></span>}
                          <span>Schedule: <b>{sc.schedule || "manual"}</b></span>
                          {sc.lastRunAt && <span>Last run: <b>{formatDate(sc.lastRunAt)}</b></span>}
                        </div>

                        {/* Latest job status */}
                        {latestJob && (
                          <div className={`mt-2 p-2 rounded-lg ${STATUS_COLORS[latestJob.status]?.bg || "bg-gray-50"} flex items-center gap-3 text-xs`}>
                            <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[latestJob.status]?.dot}`} />
                            <span className={`font-medium ${STATUS_COLORS[latestJob.status]?.text}`}>{latestJob.status}</span>
                            <span>Ads: <b>{latestJob.adsNew}</b> new, <b>{latestJob.adsUpdated}</b> upd</span>
                            <span>Units: <b>{latestJob.unitsUsed}</b></span>
                            <span>Time: {formatDuration(latestJob.startedAt, latestJob.completedAt)}</span>
                            {latestJob.errorMessage && <span className="text-red-600">{latestJob.errorMessage}</span>}
                            {latestJob.progress?.lastOutput && (
                              <span className="text-gray-500 truncate max-w-[300px]" title={latestJob.progress.lastOutput}>
                                {latestJob.progress.lastOutput.split("\n").pop()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 ml-4">
                        {isRunning ? (
                          <button
                            onClick={() => handleStopJob(latestJob.id)}
                            disabled={actionLoading === latestJob.id}
                            className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                          >
                            {actionLoading === latestJob.id ? "..." : "Stop"}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStartJob(sc.id)}
                            disabled={!!actionLoading}
                            className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            {actionLoading === sc.id ? "..." : "Start"}
                          </button>
                        )}
                        <button
                          onClick={() => handleUpdateConfig(sc.id, { isEnabled: !sc.isEnabled })}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
                            sc.isEnabled ? "border-yellow-300 text-yellow-700 hover:bg-yellow-50" : "border-green-300 text-green-700 hover:bg-green-50"
                          }`}
                        >
                          {sc.isEnabled ? "Disable" : "Enable"}
                        </button>
                        <button
                          onClick={() => handleDeleteConfig(sc.id)}
                          className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===== JOBS TAB ===== */}
      {tab === "jobs" && (
        <Card className="overflow-hidden !p-0">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">Job History ({recentJobs.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50">
                  <th className="text-left py-2.5 px-4 font-medium text-gray-600">Type</th>
                  <th className="text-left py-2.5 px-4 font-medium text-gray-600">Status</th>
                  <th className="text-left py-2.5 px-4 font-medium text-gray-600">Config</th>
                  <th className="text-right py-2.5 px-4 font-medium text-gray-600">New</th>
                  <th className="text-right py-2.5 px-4 font-medium text-gray-600">Updated</th>
                  <th className="text-right py-2.5 px-4 font-medium text-gray-600">Units</th>
                  <th className="text-left py-2.5 px-4 font-medium text-gray-600">Duration</th>
                  <th className="text-left py-2.5 px-4 font-medium text-gray-600">Started</th>
                  <th className="text-left py-2.5 px-4 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-gray-400">Нет запусков</td></tr>
                ) : recentJobs.map(job => {
                  const cfg = job.config as any;
                  return (
                    <tr key={job.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 font-medium">{job.type}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[job.status]?.dot || "bg-gray-400"}`} />
                          <span className={`text-xs font-medium ${STATUS_COLORS[job.status]?.text || "text-gray-600"}`}>{job.status}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-gray-600">
                        {cfg?.keyword && `"${cfg.keyword}" ${cfg.country || ""}`}
                        {cfg?.maxCombos && `${cfg.maxCombos} combos`}
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium text-green-600">{job.adsNew || 0}</td>
                      <td className="py-2.5 px-4 text-right text-gray-600">{job.adsUpdated || 0}</td>
                      <td className="py-2.5 px-4 text-right text-purple-600">{job.unitsUsed || 0}</td>
                      <td className="py-2.5 px-4 text-xs text-gray-500">{formatDuration(job.startedAt, job.completedAt)}</td>
                      <td className="py-2.5 px-4 text-xs text-gray-500">{formatDate(job.startedAt)}</td>
                      <td className="py-2.5 px-4">
                        {job.status === "RUNNING" && (
                          <button onClick={() => handleStopJob(job.id)} className="text-xs text-red-600 hover:text-red-800 font-medium">Stop</button>
                        )}
                        {job.errorMessage && (
                          <span className="text-xs text-red-500" title={job.errorMessage}>error</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ===== KEYWORDS TAB ===== */}
      {tab === "keywords" && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setShowKwForm(true)} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
              + Add Keyword
            </button>
            <p className="text-xs text-gray-400">Keywords используются Browserless scraper и live search</p>
          </div>

          {showKwForm && (
            <Card className="mb-4">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Keyword</label>
                  <input value={kwForm.keyword} onChange={e => setKwForm({ ...kwForm, keyword: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="casino bonus" autoFocus />
                </div>
                <button onClick={handleAddKeyword} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Add</button>
                <button onClick={() => setShowKwForm(false)} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg">Cancel</button>
              </div>
            </Card>
          )}

          <Card className="overflow-hidden !p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-2.5 px-4 font-medium text-gray-600">Keyword</th>
                    <th className="text-left py-2.5 px-4 font-medium text-gray-600">Vertical</th>
                    <th className="text-left py-2.5 px-4 font-medium text-gray-600">Status</th>
                    <th className="text-left py-2.5 px-4 font-medium text-gray-600">Parses</th>
                    <th className="text-left py-2.5 px-4 font-medium text-gray-600">Last</th>
                    <th className="text-left py-2.5 px-4 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keywords.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-400">Нет ключевых слов</td></tr>
                  ) : keywords.map(kw => (
                    <tr key={kw.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2.5 px-4 font-medium text-gray-800">{kw.keyword}</td>
                      <td className="py-2.5 px-4">
                        {kw.vertical ? <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full">{kw.vertical.name}</span> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-2.5 px-4">
                        <button onClick={() => handleToggleKeyword(kw)} className="flex items-center gap-1.5 group">
                          <span className={`w-2 h-2 rounded-full ${kw.isActive ? "bg-green-500" : "bg-gray-300"}`} />
                          <span className="text-xs text-gray-600 group-hover:text-blue-600">{kw.isActive ? "Active" : "Paused"}</span>
                        </button>
                      </td>
                      <td className="py-2.5 px-4 text-gray-500 text-xs">{kw.logsCount}</td>
                      <td className="py-2.5 px-4 text-gray-500 text-xs">{formatDate(kw.lastParsedAt)}</td>
                      <td className="py-2.5 px-4">
                        <button onClick={() => handleDeleteKeyword(kw.id)} className="text-xs text-red-600 hover:text-red-800">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </DashboardLayout>
  );
}
