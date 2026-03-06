"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import Card from "@/components/ui/Card";

interface Keyword {
  id: string;
  text: string;
  vertical: string;
  active: boolean;
  lastParsedAt: string | null;
}

interface ParseLog {
  id: string;
  keyword: string;
  status: "success" | "error";
  adsFound: number;
  adsNew: number;
  duration: string;
  error: string | null;
  createdAt: string;
}

interface ParsingStats {
  totalKeywords: number;
  activeKeywords: number;
  lastParse: string | null;
  totalAdsParsed: number;
}

const VERTICALS = [
  "Gambling",
  "Betting",
  "Nutra",
  "Dating",
  "Crypto",
  "Finance",
  "E-commerce",
  "Gaming",
  "Sweepstakes",
  "Other",
];

export default function AdminParsingPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [parseLogs, setParseLogs] = useState<ParseLog[]>([]);
  const [stats, setStats] = useState<ParsingStats>({
    totalKeywords: 0,
    activeKeywords: 0,
    lastParse: null,
    totalAdsParsed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ text: "", vertical: "Gambling", active: true });

  const getToken = () => localStorage.getItem("token") || "";

  const fetchData = useCallback(async () => {
    try {
      const [kwRes, logRes] = await Promise.all([
        fetch("/api/admin/keywords", {
          headers: { Authorization: `Bearer ${getToken()}` },
        }),
        fetch("/api/admin/parse-logs", {
          headers: { Authorization: `Bearer ${getToken()}` },
        }),
      ]);
      if (kwRes.ok) {
        const kwData = await kwRes.json();
        setKeywords(kwData.keywords || []);
        setStats(kwData.stats || stats);
      }
      if (logRes.ok) {
        const logData = await logRes.json();
        setParseLogs(logData.logs || []);
      }
    } catch {
      console.error("Failed to fetch parsing data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmitKeyword = async () => {
    if (!formData.text.trim()) return;
    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId
        ? { id: editingId, ...formData }
        : formData;
      await fetch("/api/admin/keywords", {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
      });
      setFormData({ text: "", vertical: "Gambling", active: true });
      setShowForm(false);
      setEditingId(null);
      fetchData();
    } catch {
      console.error("Failed to save keyword");
    }
  };

  const handleEditKeyword = (kw: Keyword) => {
    setEditingId(kw.id);
    setFormData({ text: kw.text, vertical: kw.vertical, active: kw.active });
    setShowForm(true);
  };

  const handleDeleteKeyword = async (id: string) => {
    if (!confirm("Delete this keyword?")) return;
    try {
      await fetch("/api/admin/keywords", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ id }),
      });
      fetchData();
    } catch {
      console.error("Failed to delete keyword");
    }
  };

  const handleRunSingle = async (keywordId: string) => {
    try {
      await fetch("/api/admin/parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ keywordId }),
      });
      fetchData();
    } catch {
      console.error("Failed to run parse");
    }
  };

  const handleRunAll = async () => {
    setParsing(true);
    try {
      await fetch("/api/admin/parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ all: true }),
      });
      fetchData();
    } catch {
      console.error("Failed to run parse");
    } finally {
      setParsing(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statItems = [
    { label: "Total Keywords", value: stats.totalKeywords, color: "text-blue-600" },
    { label: "Active Keywords", value: stats.activeKeywords, color: "text-green-600" },
    { label: "Last Parse", value: formatDate(stats.lastParse), color: "text-gray-700", isText: true },
    { label: "Total Ads Parsed", value: stats.totalAdsParsed, color: "text-purple-600" },
  ];

  if (loading) {
    return (
      <DashboardLayout title="Parsing Management" requireAdmin>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Parsing Management" requireAdmin>
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statItems.map((item) => (
          <Card key={item.label}>
            <p className="text-sm text-gray-500 mb-1">{item.label}</p>
            <p className={`${item.isText ? "text-sm" : "text-2xl"} font-bold ${item.color}`}>
              {item.value}
            </p>
          </Card>
        ))}
      </div>

      {/* Actions Bar */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ text: "", vertical: "Gambling", active: true });
            setShowForm(!showForm);
          }}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Keyword
        </button>
        <button
          onClick={handleRunAll}
          disabled={parsing}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {parsing && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          )}
          Run Parse Now
        </button>
      </div>

      {/* Add/Edit Keyword Form */}
      {showForm && (
        <Card className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            {editingId ? "Edit Keyword" : "Add New Keyword"}
          </h3>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-500 mb-1">Keyword</label>
              <input
                type="text"
                value={formData.text}
                onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                placeholder="Enter keyword..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-400 transition-colors"
              />
            </div>
            <div className="min-w-[160px]">
              <label className="block text-xs text-gray-500 mb-1">Vertical</label>
              <select
                value={formData.vertical}
                onChange={(e) => setFormData({ ...formData, vertical: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white outline-none focus:border-blue-400 transition-colors"
              >
                {VERTICALS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Active</label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, active: !formData.active })}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  formData.active ? "bg-green-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    formData.active ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSubmitKeyword}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingId ? "Update" : "Add"}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Keywords Table */}
      <Card className="mb-6 overflow-hidden !p-0">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Keywords</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Keyword</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Vertical</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Active</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Last Parsed</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keywords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-400">
                    No keywords yet. Add one to start parsing.
                  </td>
                </tr>
              ) : (
                keywords.map((kw) => (
                  <tr key={kw.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-gray-800 font-medium">{kw.text}</td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                        {kw.vertical}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          kw.active ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                      <span className="ml-2 text-gray-600 text-xs">
                        {kw.active ? "Active" : "Paused"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{formatDate(kw.lastParsedAt)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditKeyword(kw)}
                          className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          Edit
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={() => handleDeleteKeyword(kw.id)}
                          className="text-xs text-red-600 hover:text-red-800 transition-colors"
                        >
                          Delete
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={() => handleRunSingle(kw.id)}
                          className="text-xs text-green-600 hover:text-green-800 transition-colors"
                        >
                          Run Now
                        </button>
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
                <th className="text-left py-3 px-4 font-medium text-gray-600">Keyword</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Ads Found</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Ads New</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Duration</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Error</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Time</th>
              </tr>
            </thead>
            <tbody>
              {parseLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">
                    No parse logs yet.
                  </td>
                </tr>
              ) : (
                parseLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-gray-800">{log.keyword}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                          log.status === "success"
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{log.adsFound}</td>
                    <td className="py-3 px-4 text-gray-600">{log.adsNew}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{log.duration}</td>
                    <td className="py-3 px-4 text-red-500 text-xs max-w-[200px] truncate">
                      {log.error || "—"}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{formatDate(log.createdAt)}</td>
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
