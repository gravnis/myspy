"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import Card from "@/components/ui/Card";

interface SavedAd {
  id: string;
  adId: string;
  note: string | null;
  tags: string[];
  ad: {
    id: string;
    advertiserName: string;
    adText: string;
    thumbnailUrl: string | null;
    countries: string[];
    vertical: string;
    daysActive: number;
  };
}

interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  items: SavedAd[];
  createdAt: string;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [noteModal, setNoteModal] = useState<SavedAd | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const fetchProject = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/projects/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProject(data.project);
      setEditName(data.project.name);
      setEditDescription(data.project.description || "");
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [id]);

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
        }),
      });
      if (res.ok) {
        setEditing(false);
        fetchProject();
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAd = async (savedAdId: string) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`/api/projects/${id}/items/${savedAdId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchProject();
      }
    } catch {
      // silently fail
    }
  };

  const handleSaveNote = async () => {
    if (!noteModal) return;
    setSavingNote(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/projects/${id}/items/${noteModal.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ note: noteText.trim() || null }),
      });
      if (res.ok) {
        setNoteModal(null);
        setNoteText("");
        fetchProject();
      }
    } catch {
      // silently fail
    } finally {
      setSavingNote(false);
    }
  };

  const openNoteModal = (item: SavedAd) => {
    setNoteModal(item);
    setNoteText(item.note || "");
  };

  return (
    <DashboardLayout>
      {/* Back link */}
      <Link
        href="/dashboard/projects"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Projects
      </Link>

      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card-bg border border-card-border rounded-lg overflow-hidden">
                <div className="aspect-video bg-gray-200" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : error || !project ? (
        <Card className="text-center py-16">
          <p className="text-lg text-muted">Project not found</p>
          <Link href="/dashboard/projects" className="text-primary hover:underline text-sm mt-2 inline-block">
            Go back to projects
          </Link>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Project Header */}
          {editing ? (
            <Card>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Project Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-card-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 border border-card-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 border border-card-border rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={!editName.trim() || saving}
                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-40 transition-colors"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </Card>
          ) : (
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
                {project.description && (
                  <p className="text-muted mt-1">{project.description}</p>
                )}
                <p className="text-xs text-muted mt-2">
                  {project.items.length} {project.items.length === 1 ? "ad" : "ads"} saved
                </p>
              </div>
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 border border-card-border rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            </div>
          )}

          {/* Ads Grid */}
          {project.items.length === 0 ? (
            <Card className="text-center py-16">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-muted text-lg">No ads saved yet</p>
              <p className="text-muted text-sm mt-1">Go to Search to find ads!</p>
              <Link
                href="/dashboard"
                className="mt-4 inline-block px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium"
              >
                Go to Search
              </Link>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {project.items.map((item) => (
                <div
                  key={item.id}
                  className="bg-card-bg border border-card-border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-200"
                >
                  <Link href={`/dashboard/ads/${item.ad.id}`}>
                    {/* Thumbnail */}
                    {item.ad.thumbnailUrl ? (
                      <div className="aspect-video bg-gray-100 overflow-hidden">
                        <img
                          src={item.ad.thumbnailUrl}
                          alt="Ad creative"
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-gray-100 flex items-center justify-center">
                        <span className="text-muted text-sm">No image</span>
                      </div>
                    )}
                  </Link>

                  <div className="p-4 space-y-3">
                    <Link href={`/dashboard/ads/${item.ad.id}`}>
                      <p className="text-sm font-semibold text-foreground truncate hover:text-primary transition-colors">
                        {item.ad.advertiserName}
                      </p>
                    </Link>

                    <p className="text-sm text-muted line-clamp-2 leading-relaxed">
                      {item.ad.adText}
                    </p>

                    {/* Note */}
                    {item.note && (
                      <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-2.5">
                        <p className="text-xs text-yellow-800 leading-relaxed">{item.note}</p>
                      </div>
                    )}

                    {/* Tags */}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-100"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {item.ad.countries.slice(0, 3).map((c) => (
                        <span
                          key={c}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"
                        >
                          {c}
                        </span>
                      ))}
                      {item.ad.vertical && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                          {item.ad.vertical}
                        </span>
                      )}
                    </div>

                    {/* Footer actions */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-muted">
                        Active {item.ad.daysActive} days
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openNoteModal(item)}
                          className="p-2 rounded-lg hover:bg-gray-100 text-muted hover:text-primary transition-colors"
                          title="Add note"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleRemoveAd(item.id)}
                          className="p-2 rounded-lg hover:bg-red-50 text-muted hover:text-danger transition-colors"
                          title="Remove from project"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Note Modal */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setNoteModal(null)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-foreground">Edit Note</h2>
              <button
                onClick={() => setNoteModal(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-muted transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-muted mb-4 truncate">{noteModal.ad.advertiserName}</p>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add your notes about this ad..."
              rows={4}
              className="w-full px-4 py-2.5 border border-card-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none"
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setNoteModal(null)}
                className="flex-1 py-2.5 px-4 border border-card-border rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNote}
                disabled={savingNote}
                className="flex-1 py-2.5 px-4 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-40 transition-colors"
              >
                {savingNote ? "Saving..." : "Save Note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
