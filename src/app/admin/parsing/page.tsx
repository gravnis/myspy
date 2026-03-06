"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import Card from "@/components/ui/Card";

interface Vertical {
  id: string;
  name: string;
  slug: string;
}

interface Keyword {
  id: string;
  keyword: string;
  vertical: Vertical | null;
  isActive: boolean;
  lastParsedAt: string | null;
  logsCount: number;
}

interface ParseLog {
  id: string;
  keyword: { keyword: string };
  status: string;
  adsFound: number;
  adsNew: number;
  errorMessage: string | null;
  createdAt: string;
}

interface Stats {
  totalKeywords: number;
  activeKeywords: number;
  lastParse: string | null;
  totalAdsParsed: number;
  totalParses: number;
}

export default function AdminParsingPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [logs, setLogs] = useState<ParseLog[]>([]);
  const [stats, setStats] = useState<Stats>({ totalKeywords: 0, activeKeywords: 0, lastParse: null, totalAdsParsed: 0, totalParses: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ keyword: "", verticalId: "", isActive: true });

  const getToken = () => localStorage.getItem("token") || "";

  const fetchData = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${getToken()}` };
      const [kwRes, logRes] = await Promise.all([
        fetch("/api/admin/keywords", { headers }),
        fetch("/api/admin/parse", { headers }),
      ]);
      if (kwRes.ok) {
        const d = await kwRes.json();
        setKeywords(d.keywords || []);
        setVerticals(d.verticals || []);
        if (d.stats) setStats(d.stats);
      }
      if (logRes.ok) {
        const d = await logRes.json();
        setLogs(d.logs || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async () => {
    if (!form.keyword.trim()) return;
    try {
      const url = editingId ? `/api/admin/keywords/${editingId}` : "/api/admin/keywords";
      const method = editingId ? "PUT" : "POST";
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          keyword: form.keyword.trim(),
          verticalId: form.verticalId || null,
          isActive: form.isActive,
        }),
      });
      setForm({ keyword: "", verticalId: "", isActive: true });
      setShowForm(false);
      setEditingId(null);
      fetchData();
    } catch {}
  };

  const handleEdit = (kw: Keyword) => {
    setEditingId(kw.id);
    setForm({ keyword: kw.keyword, verticalId: kw.vertical?.id || "", isActive: kw.isActive });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this keyword?")) return;
    try {
      await fetch(`/api/admin/keywords/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      fetchData();
    } catch {}
  };

  const handleToggleActive = async (kw: Keyword) => {
    try {
      await fetch(`/api/admin/keywords/${kw.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ isActive: !kw.isActive }),
      });
      fetchData();
    } catch {}
  };

  const formatDate = (d: string | null) => {
    if (!d) return "Never";
    return new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <DashboardLayout title="Parsing Management" requireAdmin>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Parsing Management" requireAdmin>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Card>
          <p className="text-xs text-gray-500">Keywords</p>
          <p className="text-xl font-bold text-blue-600">{stats.totalKeywords}</p>
          <p className="text-[10px] text-gray-400">{stats.activeKeywords} active</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">Total Ads</p>
          <p className="text-xl font-bold text-green-600">{stats.totalAdsParsed.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">Parse Runs</p>
          <p className="text-xl font-bold text-purple-600">{stats.totalParses}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">Last Parse</p>
          <p className="text-sm font-semibold text-gray-700">{formatDate(stats.lastParse)}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">Scraper</p>
          <p className="text-sm font-semibold text-amber-600">Local only</p>
          <p className="text-[10px] text-gray-400">scripts/scrape.ts</p>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => { setEditingId(null); setForm({ keyword: "", verticalId: "", isActive: true }); setShowForm(!showForm); }}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Keyword
        </button>
        <p className="text-xs text-gray-400">
          Keywords are used by the scraper (<code className="bg-gray-100 px-1 rounded">scripts/scrape.ts</code>) to find ads in FB Ad Library
        </p>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{editingId ? "Edit Keyword" : "Add Keyword"}</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-500 mb-1">Keyword</label>
              <input
                type="text"
                value={form.keyword}
                onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                placeholder="e.g., online casino bonus"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                autoFocus
              />
            </div>
            <div className="min-w-[160px]">
              <label className="block text-xs text-gray-500 mb-1">Vertical</label>
              <select
                value={form.verticalId}
                onChange={(e) => setForm({ ...form, verticalId: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-blue-400"
              >
                <option value="">No vertical</option>
                {verticals.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Active</label>
              <button
                type="button"
                onClick={() => setForm({ ...form, isActive: !form.isActive })}
                className={`relative w-10 h-5 rounded-full transition-colors ${form.isActive ? "bg-green-500" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? "translate-x-5" : ""}`} />
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                {editingId ? "Update" : "Add"}
              </button>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">
                Cancel
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Keywords Table */}
      <Card className="mb-6 overflow-hidden !p-0">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Keywords ({keywords.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="text-left py-2.5 px-4 font-medium text-gray-600">Keyword</th>
                <th className="text-left py-2.5 px-4 font-medium text-gray-600">Vertical</th>
                <th className="text-left py-2.5 px-4 font-medium text-gray-600">Status</th>
                <th className="text-left py-2.5 px-4 font-medium text-gray-600">Parses</th>
                <th className="text-left py-2.5 px-4 font-medium text-gray-600">Last Parsed</th>
                <th className="text-left py-2.5 px-4 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keywords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400">
                    No keywords. Add keywords to configure what the scraper searches for.
                  </td>
                </tr>
              ) : (
                keywords.map(kw => (
                  <tr key={kw.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 px-4 font-medium text-gray-800">{kw.keyword}</td>
                    <td className="py-2.5 px-4">
                      {kw.vertical ? (
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full">{kw.vertical.name}</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <button onClick={() => handleToggleActive(kw)} className="flex items-center gap-1.5 group">
                        <span className={`w-2 h-2 rounded-full ${kw.isActive ? "bg-green-500" : "bg-gray-300"}`} />
                        <span className="text-xs text-gray-600 group-hover:text-blue-600">{kw.isActive ? "Active" : "Paused"}</span>
                      </button>
                    </td>
                    <td className="py-2.5 px-4 text-gray-500 text-xs">{kw.logsCount}</td>
                    <td className="py-2.5 px-4 text-gray-500 text-xs">{formatDate(kw.lastParsedAt)}</td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEdit(kw)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                        <button onClick={() => handleDelete(kw.id)} className="text-xs text-red-600 hover:text-red-800">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Parse Logs */}
      <Card className="overflow-hidden !p-0">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Recent Parse Logs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="text-left py-2.5 px-4 font-medium text-gray-600">Keyword</th>
                <th className="text-left py-2.5 px-4 font-medium text-gray-600">Status</th>
                <th className="text-left py-2.5 px-4 font-medium text-gray-600">Found</th>
                <th className="text-left py-2.5 px-4 font-medium text-gray-600">New</th>
                <th className="text-left py-2.5 px-4 font-medium text-gray-600">Error</th>
                <th className="text-left py-2.5 px-4 font-medium text-gray-600">Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400">
                    No parse logs yet. Logs appear after running <code className="bg-gray-100 px-1 rounded">scripts/scrape.ts</code>
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 px-4 text-gray-800">{log.keyword?.keyword || "—"}</td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        log.status === "SUCCESS" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-600">{log.adsFound}</td>
                    <td className="py-2.5 px-4 text-gray-600">{log.adsNew}</td>
                    <td className="py-2.5 px-4 text-red-500 text-xs max-w-[200px] truncate">{log.errorMessage || "—"}</td>
                    <td className="py-2.5 px-4 text-gray-500 text-xs">{formatDate(log.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </DashboardLayout>
  );
}
