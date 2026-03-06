"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import Card from "@/components/ui/Card";

interface Settings {
  apiKeys: {
    metaAccessToken: string;
    metaTokenStatus: "active" | "expired" | "missing";
  };
  storage: {
    filesCount: number;
    totalSize: string;
  };
  parseSchedule: {
    intervalMinutes: number;
    autoParse: boolean;
  };
  system: {
    nextVersion: string;
    nodeVersion: string;
    dbStatus: "connected" | "disconnected" | "error";
  };
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem("token") || "";
        const res = await fetch("/api/admin/settings", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSettings(data.settings);
      } catch {
        console.error("Failed to fetch settings");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "connected":
        return "bg-green-500";
      case "expired":
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Active";
      case "expired":
        return "Expired";
      case "missing":
        return "Not Set";
      case "connected":
        return "Connected";
      case "disconnected":
        return "Disconnected";
      case "error":
        return "Error";
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="System Settings" requireAdmin>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="System Settings" requireAdmin>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Keys */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-800">API Keys</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">META_ACCESS_TOKEN</p>
                <p className="text-sm text-gray-700 font-mono">
                  {settings?.apiKeys.metaAccessToken || "Not configured"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${getStatusColor(
                    settings?.apiKeys.metaTokenStatus || "missing"
                  )}`}
                />
                <span className="text-xs text-gray-500">
                  {getStatusLabel(settings?.apiKeys.metaTokenStatus || "missing")}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Storage Stats */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-800">Storage Stats</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-xs text-gray-500">Files Count</span>
              <span className="text-sm font-semibold text-gray-800">
                {settings?.storage.filesCount?.toLocaleString() || "0"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-xs text-gray-500">Total Size</span>
              <span className="text-sm font-semibold text-gray-800">
                {settings?.storage.totalSize || "0 B"}
              </span>
            </div>
          </div>
        </Card>

        {/* Parse Schedule */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-800">Parse Schedule</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-xs text-gray-500">Parse Interval</span>
              <span className="text-sm font-semibold text-gray-800">
                Every {settings?.parseSchedule.intervalMinutes || 60} min
              </span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-xs text-gray-500">Auto-Parse</span>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    settings?.parseSchedule.autoParse ? "bg-green-500" : "bg-gray-400"
                  }`}
                />
                <span className="text-sm font-semibold text-gray-800">
                  {settings?.parseSchedule.autoParse ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* System Info */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-800">System Info</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-xs text-gray-500">Next.js Version</span>
              <span className="text-sm font-semibold text-gray-800 font-mono">
                {settings?.system.nextVersion || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-xs text-gray-500">Node.js Version</span>
              <span className="text-sm font-semibold text-gray-800 font-mono">
                {settings?.system.nodeVersion || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-xs text-gray-500">Database Status</span>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${getStatusColor(
                    settings?.system.dbStatus || "disconnected"
                  )}`}
                />
                <span className="text-sm font-semibold text-gray-800">
                  {getStatusLabel(settings?.system.dbStatus || "disconnected")}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
