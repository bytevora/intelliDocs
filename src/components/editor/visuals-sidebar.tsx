"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

// ── Types ────────────────────────────────────────────────
interface SidebarDoc {
  id: string;
  title: string;
  updatedAt: string;
  isShared: boolean;
  ownerName?: string;
  permission?: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Sidebar component ────────────────────────────────────
interface VisualsSidebarProps {
  documentId: string;
  authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  collapsed: boolean;
  onToggle: () => void;
}

export function VisualsSidebar({ documentId, authFetch, collapsed, onToggle }: VisualsSidebarProps) {
  const router = useRouter();
  const [docs, setDocs] = useState<SidebarDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await authFetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        const own: SidebarDoc[] = (data.own || []).map((d: any) => ({ ...d, isShared: false }));
        const shared: SidebarDoc[] = (data.shared || []).map((d: any) => ({ ...d, isShared: true }));
        setDocs([...own, ...shared]);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [authFetch]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  // Collapsed state
  if (collapsed) {
    return (
      <div className="flex-shrink-0 flex flex-col items-center pt-4 border-r border-border bg-card/50">
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="Show documents"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </button>
        {docs.length > 0 && (
          <span className="mt-1 text-[10px] font-semibold text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
            {docs.length}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 w-64 border-r border-border bg-card/50 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
          </svg>
          <span className="text-sm font-semibold text-foreground">Documents</span>
          <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
            {docs.length}
          </span>
        </div>
        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="Collapse panel"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {loading && docs.length === 0 && (
          <div className="space-y-2 px-1 py-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {!loading && docs.length === 0 && (
          <div className="text-center py-8 px-2">
            <svg className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <p className="text-xs text-muted-foreground">No documents yet</p>
          </div>
        )}

        {docs.map((d) => {
          const isActive = d.id === documentId;
          return (
            <button
              key={d.id}
              onClick={() => { if (!isActive) router.push(`/documents/${d.id}`); }}
              className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors group flex items-start gap-2.5 ${
                isActive
                  ? "bg-primary/10 border border-primary/20"
                  : "hover:bg-muted/80"
              }`}
            >
              {/* Doc icon */}
              <div className={`flex-shrink-0 mt-0.5 transition-colors ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate leading-tight ${isActive ? "text-primary" : "text-foreground"}`}>
                  {d.title || "Untitled"}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-muted-foreground/60">
                    {formatDate(d.updatedAt)}
                  </span>
                  {d.isShared && (
                    <>
                      <span className="text-[10px] text-muted-foreground/40">·</span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {d.ownerName ? `by ${d.ownerName}` : "Shared"}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
