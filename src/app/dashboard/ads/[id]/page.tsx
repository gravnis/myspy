"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import Card from "@/components/ui/Card";

function proxyUrl(url: string) {
  return `/api/proxy/image?u=${btoa(unescape(encodeURIComponent(url)))}`;
}

interface AdCreative {
  id: string;
  type: string;
  originalUrl: string | null;
  b2Key: string | null;
  thumbnailB2Key: string | null;
}

interface AdDetail {
  id: string;
  fbAdId: string;
  advertiserName: string | null;
  advertiserId: string | null;
  adText: string | null;
  linkTitle: string | null;
  linkDescription: string | null;
  landingUrl: string | null;
  countries: string[];
  platforms: string[];
  vertical: { name: string; slug: string } | null;
  daysActive: number;
  isActive: boolean;
  startedAt: string | null;
  lastSeenAt: string | null;
  savesCount: number;
  creatives: AdCreative[];
}

export default function AdDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [ad, setAd] = useState<AdDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchAd() {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/ads/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setAd(data.ad);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchAd();
  }, [id]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <DashboardLayout>
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Search
      </Link>

      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="aspect-video max-w-3xl bg-gray-200 rounded-xl" />
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-full max-w-2xl" />
          <div className="h-4 bg-gray-200 rounded w-2/3 max-w-2xl" />
        </div>
      ) : error || !ad ? (
        <Card className="text-center py-16">
          <p className="text-lg text-muted">Ad not found</p>
          <Link href="/dashboard" className="text-primary hover:underline text-sm mt-2 inline-block">
            Go back to search
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column — creative + text */}
          <div className="lg:col-span-2 space-y-6">
            {/* Creative */}
            <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden">
              {ad.creatives && ad.creatives.filter(c => c.originalUrl).length > 0 ? (
                <div className="space-y-2">
                  {(() => {
                    const creatives = ad.creatives.filter(c => c.originalUrl);
                    const videoCreative = creatives.find(c => c.type === 'VIDEO');
                    const imageCreatives = creatives.filter(c => c.type !== 'VIDEO');

                    if (videoCreative) {
                      // Video ad: show video player with first image as poster
                      const posterUrl = imageCreatives[0]?.originalUrl;
                      return (
                        <div className="relative bg-black rounded-lg overflow-hidden">
                          <video
                            key={videoCreative.id}
                            src={proxyUrl(videoCreative.originalUrl!)}
                            poster={posterUrl ? proxyUrl(posterUrl) : undefined}
                            controls
                            playsInline
                            preload="metadata"
                            className="w-full max-h-[600px] object-contain"
                            onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; }}
                          />
                        </div>
                      );
                    }

                    // Image-only ad: show all images
                    return imageCreatives.map((c) => (
                      <img
                        key={c.id}
                        src={c.b2Key || proxyUrl(c.originalUrl!)}
                        alt="Ad creative"
                        className="w-full object-contain max-h-[600px] bg-gray-50"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ));
                  })()}
                </div>
              ) : (
                <div className="aspect-video bg-gray-100 flex items-center justify-center">
                  <span className="text-muted text-lg">No creative available</span>
                </div>
              )}
            </div>

            {/* Ad Text */}
            <Card>
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Ad Text</h3>
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                {ad.adText || "No text available"}
              </p>
            </Card>

            {/* Landing URL */}
            {ad.landingUrl && (
              <Card>
                <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Landing Page</h3>
                <a
                  href={ad.landingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm break-all inline-flex items-center gap-1"
                >
                  {ad.landingUrl}
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </Card>
            )}
          </div>

          {/* Right column — details + actions */}
          <div className="space-y-6">
            {/* Actions */}
            <Card className="space-y-3">
              <button className="w-full py-2.5 px-4 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                Save to Project
              </button>
              <button
                onClick={() => {
                  if (ad.creatives && ad.creatives.length > 0) {
                    const creative = ad.creatives[0];
                    const url = creative.b2Key || creative.originalUrl;
                    if (url) {
                      const ext = creative.type === 'VIDEO' ? 'mp4' : 'jpg';
                      const a = document.createElement("a");
                      a.href = proxyUrl(url) + "&download=1";
                      a.download = `creative-${ad.fbAdId}.${ext}`;
                      a.click();
                    }
                  }
                }}
                disabled={!ad.creatives || ad.creatives.length === 0}
                className="w-full py-2.5 px-4 bg-white border border-card-border text-foreground rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Creative
              </button>
              <button className="w-full py-2.5 px-4 bg-white border border-card-border text-foreground rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Similar
              </button>
            </Card>

            {/* Advertiser */}
            <Card>
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Advertiser</h3>
              <p className="text-foreground font-medium">{ad.advertiserName}</p>
              {ad.advertiserId && (
                <p className="text-xs text-muted mt-1">ID: {ad.advertiserId}</p>
              )}
            </Card>

            {/* Details */}
            <Card>
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">Details</h3>
              <div className="space-y-4">
                {/* Countries */}
                <div>
                  <p className="text-xs text-muted mb-1.5">Countries</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ad.countries.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Vertical */}
                <div>
                  <p className="text-xs text-muted mb-1.5">Vertical</p>
                  <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                    {ad.vertical?.name || "Unknown"}
                  </span>
                </div>

                {/* Platforms */}
                {ad.platforms && ad.platforms.length > 0 && (
                  <div>
                    <p className="text-xs text-muted mb-1.5">Platforms</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ad.platforms.map((p) => (
                        <span key={p} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* FB Ad Library Link */}
                <div>
                  <p className="text-xs text-muted mb-1.5">FB Ad Library</p>
                  <a
                    href={`https://www.facebook.com/ads/library/?id=${ad.fbAdId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-xs"
                  >
                    ID: {ad.fbAdId}
                  </a>
                </div>

                {/* Active Period */}
                <div>
                  <p className="text-xs text-muted mb-1.5">Active Period</p>
                  <p className="text-sm text-foreground">
                    {ad.startedAt ? formatDate(ad.startedAt) : "Unknown"} — {ad.lastSeenAt ? formatDate(ad.lastSeenAt) : "Now"}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {ad.daysActive} days active
                  </p>
                </div>

                {/* Saves */}
                <div>
                  <p className="text-xs text-muted mb-1.5">Saves</p>
                  <p className="text-sm text-foreground">{ad.savesCount}</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
