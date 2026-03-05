"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import Card from "@/components/ui/Card";

interface Project {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
  createdAt: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/projects", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() || null }),
      });
      if (res.ok) {
        setNewName("");
        setNewDescription("");
        setShowModal(false);
        fetchProjects();
      }
    } catch {
      // silently fail
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">My Projects</h1>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Project
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card-bg border border-card-border rounded-lg p-6 animate-pulse space-y-3">
                <div className="h-5 bg-gray-200 rounded w-2/3" />
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-4/5" />
                <div className="flex justify-between pt-2">
                  <div className="h-3 bg-gray-200 rounded w-20" />
                  <div className="h-3 bg-gray-200 rounded w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <Card className="text-center py-16">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="text-muted text-lg">No projects yet</p>
            <p className="text-muted text-sm mt-1">Create your first project!</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium"
            >
              Create Project
            </button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Link key={project.id} href={`/dashboard/projects/${project.id}`} className="block group">
                <Card className="hover:shadow-lg hover:border-primary/30 transition-all duration-200 h-full flex flex-col">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                      {project.name}
                    </h3>
                    {project.description && (
                      <p className="text-sm text-muted mt-2 line-clamp-2 leading-relaxed">
                        {project.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-card-border">
                    <span className="text-xs text-muted flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      {project.itemCount} {project.itemCount === 1 ? "ad" : "ads"}
                    </span>
                    <span className="text-xs text-muted">
                      {formatDate(project.createdAt)}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-foreground">Create Project</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-muted transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Gambling GEO Tier-1"
                  className="w-full px-4 py-2.5 border border-card-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Description
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What is this project about?"
                  rows={3}
                  className="w-full px-4 py-2.5 border border-card-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 px-4 border border-card-border rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim() || creating}
                  className="flex-1 py-2.5 px-4 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
