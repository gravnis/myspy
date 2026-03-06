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
  updatedAt: string;
  _count?: { projects: number };
}

interface UsersStats {
  total: number;
  activeToday: number;
  proUsers: number;
  businessUsers: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UsersStats>({ total: 0, activeToday: 0, proUsers: 0, businessUsers: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", password: "", name: "", role: "USER", plan: "FREE" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit modal
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ email: "", name: "", password: "", role: "", plan: "" });
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState("");

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
      if (data.stats) setStats(data.stats);
    } catch {} finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleRoleChange = async (userId: string, role: string) => {
    await fetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ role }),
    });
    fetchUsers();
  };

  const handlePlanChange = async (userId: string, plan: string) => {
    await fetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ plan }),
    });
    fetchUsers();
  };

  const handleDelete = async (userId: string, email: string) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) fetchUsers();
    else { const d = await res.json(); alert(d.error || "Failed to delete"); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.email || !createForm.password) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(createForm),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setCreateForm({ email: "", password: "", name: "", role: "USER", plan: "FREE" });
        fetchUsers();
      } else {
        const d = await res.json();
        setCreateError(d.error || "Failed to create");
      }
    } catch { setCreateError("Network error"); } finally { setCreating(false); }
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setEditForm({ email: user.email, name: user.name || "", password: "", role: user.role, plan: user.plan });
    setEditError("");
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setEditing(true);
    setEditError("");
    try {
      const body: Record<string, string> = {};
      if (editForm.email !== editUser.email) body.email = editForm.email;
      if (editForm.name !== (editUser.name || "")) body.name = editForm.name;
      if (editForm.password) body.password = editForm.password;
      if (editForm.role !== editUser.role) body.role = editForm.role;
      if (editForm.plan !== editUser.plan) body.plan = editForm.plan;
      if (Object.keys(body).length === 0) { setEditUser(null); return; }

      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      });
      if (res.ok) { setEditUser(null); fetchUsers(); }
      else { const d = await res.json(); setEditError(d.error || "Failed to update"); }
    } catch { setEditError("Network error"); } finally { setEditing(false); }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

  const planColors: Record<string, string> = {
    FREE: "bg-gray-100 text-gray-600",
    PRO: "bg-blue-50 text-blue-700",
    BUSINESS: "bg-purple-50 text-purple-700",
  };

  return (
    <DashboardLayout title="User Management" requireAdmin>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card>
          <p className="text-xs text-gray-500">Total Users</p>
          <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">Active Today</p>
          <p className="text-2xl font-bold text-green-600">{stats.activeToday}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">PRO</p>
          <p className="text-2xl font-bold text-purple-600">{stats.proUsers}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">BUSINESS</p>
          <p className="text-2xl font-bold text-amber-600">{stats.businessUsers}</p>
        </Card>
      </div>

      {/* Search + Create */}
      <div className="flex items-center gap-3 mb-6">
        <Card className="flex-1 !p-0">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by email or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400"
            />
          </div>
        </Card>
        <button onClick={() => setShowCreateModal(true)} className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 whitespace-nowrap">
          + Create User
        </button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden !p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
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
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Projects</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Downloads</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Registered</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400">No users found</td></tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-800">{user.email}</td>
                      <td className="py-3 px-4 text-gray-600">{user.name || "—"}</td>
                      <td className="py-3 px-4">
                        <select value={user.role} onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className="text-xs border border-gray-200 rounded px-2 py-1 bg-white cursor-pointer">
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <select value={user.plan} onChange={(e) => handlePlanChange(user.id, e.target.value)}
                          className={`text-xs border rounded px-2 py-1 cursor-pointer ${planColors[user.plan] || ""}`}>
                          <option value="FREE">FREE</option>
                          <option value="PRO">PRO</option>
                          <option value="BUSINESS">BUSINESS</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{user._count?.projects ?? 0}</td>
                      <td className="py-3 px-4 text-gray-600">{user.downloadsCount}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{formatDate(user.createdAt)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(user)} className="text-xs font-medium px-3 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100">
                            Edit
                          </button>
                          <button onClick={() => handleDelete(user.id, user.email)} className="text-xs font-medium px-3 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Modal */}
      {showCreateModal && (
        <Modal title="Create User" onClose={() => setShowCreateModal(false)}>
          {createError && <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded-lg">{createError}</div>}
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Email *" type="email" value={createForm.email} onChange={(v) => setCreateForm({ ...createForm, email: v })} autoFocus required />
            <Field label="Password *" value={createForm.password} onChange={(v) => setCreateForm({ ...createForm, password: v })} required />
            <Field label="Name" value={createForm.name} onChange={(v) => setCreateForm({ ...createForm, name: v })} />
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Role" value={createForm.role} options={["USER", "ADMIN"]} onChange={(v) => setCreateForm({ ...createForm, role: v })} />
              <SelectField label="Plan" value={createForm.plan} options={["FREE", "PRO", "BUSINESS"]} onChange={(v) => setCreateForm({ ...createForm, plan: v })} />
            </div>
            <ModalButtons onCancel={() => setShowCreateModal(false)} loading={creating} label="Create" />
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editUser && (
        <Modal title={`Edit: ${editUser.email}`} onClose={() => setEditUser(null)}>
          {editError && <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded-lg">{editError}</div>}
          <form onSubmit={handleEdit} className="space-y-4">
            <Field label="Email" type="email" value={editForm.email} onChange={(v) => setEditForm({ ...editForm, email: v })} />
            <Field label="Name" value={editForm.name} onChange={(v) => setEditForm({ ...editForm, name: v })} />
            <Field label="New Password" value={editForm.password} onChange={(v) => setEditForm({ ...editForm, password: v })} placeholder="Leave empty to keep current" />
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Role" value={editForm.role} options={["USER", "ADMIN"]} onChange={(v) => setEditForm({ ...editForm, role: v })} />
              <SelectField label="Plan" value={editForm.plan} options={["FREE", "PRO", "BUSINESS"]} onChange={(v) => setEditForm({ ...editForm, plan: v })} />
            </div>
            <ModalButtons onCancel={() => setEditUser(null)} loading={editing} label="Save Changes" />
          </form>
        </Modal>
      )}
    </DashboardLayout>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder, autoFocus, required }: {
  label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
        autoFocus={autoFocus} required={required} />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function ModalButtons({ onCancel, loading, label }: { onCancel: () => void; loading: boolean; label: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
      <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
        {loading ? "Saving..." : label}
      </button>
    </div>
  );
}
