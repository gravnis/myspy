"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import Card from "@/components/ui/Card";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  plan: string;
  downloadsCount: number;
  blocked: boolean;
  createdAt: string;
}

interface UsersStats {
  total: number;
  activeToday: number;
  proUsers: number;
  businessUsers: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UsersStats>({
    total: 0,
    activeToday: 0,
    proUsers: 0,
    businessUsers: 0,
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const getToken = () => localStorage.getItem("token") || "";

  const fetchUsers = useCallback(async () => {
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/admin/users${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUsers(data.users || []);
      setStats(data.stats || stats);
    } catch {
      console.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await fetch(`/api/admin/users`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ userId, field: "role", value: role }),
      });
      fetchUsers();
    } catch {
      console.error("Failed to update role");
    }
  };

  const handlePlanChange = async (userId: string, plan: string) => {
    try {
      await fetch(`/api/admin/users`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ userId, field: "plan", value: plan }),
      });
      fetchUsers();
    } catch {
      console.error("Failed to update plan");
    }
  };

  const handleBlockToggle = async (userId: string, blocked: boolean) => {
    try {
      await fetch(`/api/admin/users`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ userId, field: "blocked", value: !blocked }),
      });
      fetchUsers();
    } catch {
      console.error("Failed to toggle block");
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const statItems = [
    { label: "Total Users", value: stats.total, color: "text-blue-600" },
    { label: "Active Today", value: stats.activeToday, color: "text-green-600" },
    { label: "Pro Users", value: stats.proUsers, color: "text-purple-600" },
    { label: "Business Users", value: stats.businessUsers, color: "text-amber-600" },
  ];

  return (
    <DashboardLayout title="User Management">
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statItems.map((item) => (
          <Card key={item.label}>
            <p className="text-sm text-gray-500 mb-1">{item.label}</p>
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
          </Card>
        ))}
      </div>

      {/* Search */}
      <Card className="mb-6">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search users by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400"
          />
        </div>
      </Card>

      {/* Users Table */}
      <Card className="overflow-hidden !p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Plan</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Downloads</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Registered</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {user.blocked && (
                            <span className="inline-block w-2 h-2 rounded-full bg-red-500" title="Blocked" />
                          )}
                          <span className={user.blocked ? "text-gray-400 line-through" : "text-gray-800"}>
                            {user.email}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{user.name || "—"}</td>
                      <td className="py-3 px-4">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 cursor-pointer hover:border-gray-400 transition-colors"
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={user.plan}
                          onChange={(e) => handlePlanChange(user.id, e.target.value)}
                          className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 cursor-pointer hover:border-gray-400 transition-colors"
                        >
                          <option value="FREE">FREE</option>
                          <option value="PRO">PRO</option>
                          <option value="BUSINESS">BUSINESS</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{user.downloadsCount}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{formatDate(user.createdAt)}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleBlockToggle(user.id, user.blocked)}
                          className={`text-xs font-medium px-3 py-1 rounded transition-colors ${
                            user.blocked
                              ? "bg-green-50 text-green-700 hover:bg-green-100"
                              : "bg-red-50 text-red-700 hover:bg-red-100"
                          }`}
                        >
                          {user.blocked ? "Unblock" : "Block"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </DashboardLayout>
  );
}
