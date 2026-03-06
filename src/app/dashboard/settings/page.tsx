"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import Card from "@/components/ui/Card";

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: string;
  plan: string;
  downloadsThisMonth: number;
  createdAt: string;
  _count: { projects: number };
}

interface PlanLimits {
  downloads: number;
  projects: number;
  aiGenerations: number;
}

const PLAN_FEATURES: Record<string, { name: string; color: string; badge: string }> = {
  FREE: { name: "Free", color: "bg-gray-100 text-gray-700", badge: "bg-gray-100 text-gray-600" },
  PRO: { name: "Pro", color: "bg-blue-100 text-blue-700", badge: "bg-blue-100 text-blue-700" },
  BUSINESS: { name: "Business", color: "bg-purple-100 text-purple-700", badge: "bg-purple-100 text-purple-700" },
};

export default function UserSettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [limits, setLimits] = useState<PlanLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const getToken = () => localStorage.getItem("token") || "";

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/user/profile", {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setLimits(data.limits);
          setEditName(data.user.name || "");
        }
      } catch {} finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  const handleSaveName = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ name: editName }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(prev => prev ? { ...prev, name: data.user.name } : prev);
        setEditingName(false);
        setNameSuccess(true);
        setTimeout(() => setNameSuccess(false), 2000);
      }
    } catch {} finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    if (newPassword.length < 6) {
      setPasswordError("Minimum 6 characters");
      return;
    }
    setPasswordError("");
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setCurrentPassword("");
        setNewPassword("");
        setPasswordSuccess(true);
        setTimeout(() => setPasswordSuccess(false), 3000);
      } else {
        const data = await res.json();
        setPasswordError(data.error || "Failed");
      }
    } catch {
      setPasswordError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user || !limits) return null;

  const planInfo = PLAN_FEATURES[user.plan] || PLAN_FEATURES.FREE;

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>

        {/* Plan Card */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">Your Plan</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${planInfo.badge}`}>
              {planInfo.name}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-foreground">{user.downloadsThisMonth}</p>
              <p className="text-xs text-muted mt-1">/ {limits.downloads} downloads</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-foreground">{user._count.projects}</p>
              <p className="text-xs text-muted mt-1">/ {limits.projects} projects</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-foreground">0</p>
              <p className="text-xs text-muted mt-1">/ {limits.aiGenerations} AI gens</p>
            </div>
          </div>
          {user.plan === "FREE" && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm text-blue-800">
                Upgrade to <strong>Pro</strong> for more downloads, projects, and AI creative generation.
              </p>
            </div>
          )}
        </Card>

        {/* Profile */}
        <Card>
          <h2 className="text-base font-semibold text-foreground mb-4">Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-muted mb-1">Email</label>
              <p className="text-sm text-foreground bg-gray-50 px-3 py-2 rounded-lg">{user.email}</p>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Name</label>
              {editingName ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={saving}
                    className="px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setEditingName(false); setEditName(user.name || ""); }}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-foreground bg-gray-50 px-3 py-2 rounded-lg flex-1">
                    {user.name || "Not set"}
                  </p>
                  <button
                    onClick={() => setEditingName(true)}
                    className="px-3 py-2 text-sm text-primary hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                  {nameSuccess && <span className="text-xs text-green-600">Saved!</span>}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Member since</label>
              <p className="text-sm text-foreground bg-gray-50 px-3 py-2 rounded-lg">{formatDate(user.createdAt)}</p>
            </div>
          </div>
        </Card>

        {/* Change Password */}
        <Card>
          <h2 className="text-base font-semibold text-foreground mb-4">Change Password</h2>
          {passwordSuccess && (
            <div className="mb-4 px-3 py-2 bg-green-50 text-green-700 text-sm rounded-lg border border-green-100">
              Password changed successfully
            </div>
          )}
          {passwordError && (
            <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
              {passwordError}
            </div>
          )}
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-xs text-muted mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={!currentPassword || !newPassword || saving}
              className="px-4 py-2 bg-foreground text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              {saving ? "Saving..." : "Change Password"}
            </button>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
