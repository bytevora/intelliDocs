"use client";

import { Suspense, lazy, useEffect, useState, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useAutoSave } from "@/hooks/use-auto-save";
import { useCollaboration } from "@/hooks/use-collaboration";
import { DocumentProvider } from "@/components/editor/document-context";
import { EditorErrorBoundary } from "@/components/editor/editor-error-boundary";
import { OnlineUsers } from "@/components/editor/online-users";
import { Skeleton } from "@/components/ui/skeleton";

import { exportAsPdf } from "@/lib/export";

const TiptapEditor = lazy(() => import("@/components/editor/tiptap-editor").then(m => ({ default: m.TiptapEditor })));
const ShareDialog = lazy(() => import("@/components/sharing/share-dialog").then(m => ({ default: m.ShareDialog })));
const NewDocumentDialog = lazy(() => import("@/components/editor/new-document-dialog").then(m => ({ default: m.NewDocumentDialog })));
const VisualsSidebar = lazy(() => import("@/components/editor/visuals-sidebar").then(m => ({ default: m.VisualsSidebar })));

interface DocumentData {
  id: string;
  title: string;
  content: string;
  ownerId: string;
  permission?: string;
  createdAt: string;
  updatedAt: string;
}

export default function DocumentEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, authFetch } = useAuth();
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentData | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<object | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [categoriesPanelOpen, setCategoriesPanelOpen] = useState(false);
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const titleRef = useRef<HTMLTextAreaElement>(null);
  const { debouncedSave, status } = useAutoSave(id, authFetch);

  const { ydoc, provider, connected, synced, failed } = useCollaboration(
    id,
    user?.id ?? null,
    user?.username ?? null
  );

  // Only treat as collaborative if connected, synced, and not failed
  const collabReady = !!ydoc && !!provider && synced && !failed;
  const collabPending = !!ydoc && !!provider && !synced && !failed;
  const isCollaborative = !!ydoc && !!provider && !failed;

  // Auto-resize title textarea to fit content
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [title]);

  useEffect(() => {
    if (!provider) return;
    const handler = (newTitle: string) => setTitle(newTitle);
    provider.socket.on("title-update", handler);
    return () => { provider.socket.off("title-update", handler); };
  }, [provider]);

  useEffect(() => {
    async function fetchDoc() {
      try {
        const res = await authFetch(`/api/documents/${id}`);
        if (!res.ok) {
          setError(res.status === 404 ? "Document not found" : "Failed to load");
          return;
        }
        const data = await res.json();
        setDoc(data);
        setTitle(data.title);
        try {
          setContent(JSON.parse(data.content));
        } catch {
          setContent({ type: "doc", content: [{ type: "paragraph" }] });
        }
      } catch {
        setError("Failed to load document");
      } finally {
        setLoading(false);
      }
    }
    fetchDoc();
  }, [id, authFetch]);

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setTitle(newTitle);
      if (isCollaborative) {
        provider.socket.emit("title-update", newTitle);
      } else {
        debouncedSave({ title: newTitle });
      }
    },
    [isCollaborative, provider, debouncedSave]
  );

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await authFetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        // Navigate to the first remaining document, or dashboard if none left
        const listRes = await authFetch("/api/documents");
        if (listRes.ok) {
          const docs = await listRes.json();
          const list = Array.isArray(docs) ? docs : docs.documents ?? [];
          if (list.length > 0) {
            router.push(`/documents/${list[0].id}`);
            return;
          }
        }
        router.push("/dashboard");
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Failed to delete document");
        setDeleting(false);
        setDeleteConfirmOpen(false);
      }
    } catch {
      alert("Failed to delete document");
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  }, [id, authFetch, router]);

  const handleContentUpdate = useCallback(
    (json: object) => {
      setContent(json);
      debouncedSave({ content: json });
    },
    [debouncedSave]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 py-20 space-y-6">
          <div className="h-6 w-32 bg-muted rounded animate-pulse" />
          <div className="h-10 w-3/4 bg-muted rounded animate-pulse" />
          <div className="h-4 w-full bg-muted rounded animate-pulse" />
          <div className="h-64 w-full bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 text-sm text-foreground bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  const editable = doc?.permission !== "viewer";
  return (
    <div className="h-screen bg-background flex flex-col selection:bg-primary/20 overflow-hidden">
      {/* ── Top Navigation Bar ── */}
      <header className="flex-shrink-0 z-50 flex items-center justify-between h-12 px-4 bg-background/90 backdrop-blur-sm border-b border-border">
        {/* Left: Brand + Library + New */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="text-[10px] font-bold text-primary-foreground tracking-widest">ID</span>
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground">
              IntelliDocs
              <span className="ml-1.5 text-[9px] font-mono px-1 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/20 hidden sm:inline-block">
                Beta
              </span>
            </span>
          </button>

          <span className="text-border">|</span>

          <span className="text-sm font-semibold text-foreground truncate max-w-[200px]" title={title || "Untitled Document"}>
            {title || "Untitled Document"}
          </span>

          <button
            onClick={() => setNewDocOpen(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 border border-border rounded-lg px-3 py-1.5 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New
          </button>
        </div>

        {/* Center: Save status */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          {!isCollaborative && status === "saving" && (
            <span className="text-[11px] text-muted-foreground animate-pulse">Saving...</span>
          )}
          {!isCollaborative && status === "saved" && (
            <span className="text-[11px] text-muted-foreground/60">Saved</span>
          )}
          {!isCollaborative && status === "error" && (
            <span className="text-[11px] text-red-500">Save failed</span>
          )}
          {isCollaborative && (
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-red-500"}`} />
          )}
        </div>

        {/* Right: Collab + Share + Export + Avatar */}
        <div className="flex items-center gap-2">
          {isCollaborative && provider && user && (
            <OnlineUsers provider={provider} currentUserId={user.id} />
          )}

          {doc?.permission === "viewer" && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted rounded px-2 py-0.5">
              View only
            </span>
          )}

          {doc?.permission === "owner" && (
            <>
              <button
                onClick={() => setShareOpen(true)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.375 21c-2.331 0-4.512-.645-6.375-1.765Z" />
                </svg>
                Share
              </button>

              <button
                onClick={() => setDeleteConfirmOpen(true)}
                className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
                title="Delete document"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
                Delete
              </button>
            </>
          )}

          {editable && (
            <button
              onClick={() => setCategoriesPanelOpen(!categoriesPanelOpen)}
              className={`flex items-center gap-1.5 text-sm transition-colors ${
                categoriesPanelOpen
                  ? "text-violet-400 hover:text-violet-300"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Visual categories"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
              </svg>
              Visuals
            </button>
          )}

          <button
            onClick={exportAsPdf}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            title="Export as PDF"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            PDF
          </button>

          {/* User avatar */}
          <div className="ml-1 h-7 w-7 rounded-full bg-primary flex items-center justify-center text-[11px] font-bold text-primary-foreground shadow-sm">
            {user?.username?.charAt(0).toUpperCase() || "?"}
          </div>
        </div>
      </header>

      {/* ── Document Canvas with Sidebar ── */}
      <main className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: Visuals sidebar */}
        <div className="print:hidden">
          <Suspense fallback={<div className="w-10 border-r border-border" />}>
            <VisualsSidebar
              documentId={id}
              authFetch={authFetch}
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
          </Suspense>
        </div>

        {/* Right: Document editor */}
        <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-8 sm:py-10">
        <div className="w-full bg-card rounded-2xl min-h-[calc(100vh-5rem)] shadow-xl dark:shadow-2xl dark:shadow-black/25 border border-border dark:ring-1 dark:ring-white/[0.04] flex flex-col p-4 sm:p-6">
          {/* Ruled area inset from card edges */}
          <div className="doc-ruled-area flex-1 flex flex-col rounded-xl">
            {/* Title row — icon in left margin, title on lines 2-3 */}
            <div
              className="relative z-[2]"
              style={{
                paddingTop: "calc(var(--rule-spacing) * 1)",
                minHeight: "calc(var(--rule-spacing) * 4)",
              }}
            >
              {/* Document icon — positioned in the left margin gutter */}
              <div
                className="absolute flex items-center justify-center text-muted-foreground"
                style={{
                  right: "calc(100% - var(--margin-left) + 0.75rem)",
                  top: "calc(var(--rule-spacing) * 1)",
                  height: "calc(var(--rule-spacing) * 2)",
                }}
              >
                <div className="h-9 w-9 rounded-lg bg-muted border border-border flex items-center justify-center">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
              </div>
              {/* Title input — right of the margin line, spanning 2 ruled lines */}
              <div
                className="pr-8 sm:pr-12"
                style={{
                  marginLeft: "calc(var(--margin-left) + 1.5rem)",
                  paddingTop: "calc(var(--rule-spacing) * 1)",
                  minHeight: "calc(var(--rule-spacing) * 2)",
                }}
              >
                <textarea
                  ref={titleRef}
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Untitled Document"
                  readOnly={!editable}
                  rows={1}
                  className="w-full text-[2rem] sm:text-[2.5rem] font-bold tracking-tight bg-transparent border-none outline-none placeholder:text-muted-foreground text-foreground leading-tight resize-none overflow-hidden"
                />
              </div>
            </div>

            {/* Content sits to the right of the margin line */}
            <div className="pl-[calc(var(--margin-left)+1.5rem)] pr-8 sm:pr-12 pb-16 flex-1 flex flex-col relative z-[2]">
            {/* Editor */}
            <div className="flex-1 doc-editor-prose">
              <Suspense fallback={
                <div className="space-y-5 py-6 animate-pulse">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-32 w-full" />
                </div>
              }>
                {collabReady && ydoc && provider ? (
                  <EditorErrorBoundary
                    fallback={
                      content ? (
                        <DocumentProvider documentId={id} authFetch={authFetch}>
                          <TiptapEditor
                            content={content}
                            onUpdate={handleContentUpdate}
                            editable={editable}
                            showCategoriesPanel={categoriesPanelOpen}
                            onCloseCategoriesPanel={() => setCategoriesPanelOpen(false)}
                          />
                        </DocumentProvider>
                      ) : null
                    }
                  >
                    <DocumentProvider documentId={id} authFetch={authFetch}>
                      <TiptapEditor
                        key={ydoc.clientID}
                        ydoc={ydoc}
                        provider={provider}
                        editable={editable}
                      />
                    </DocumentProvider>
                  </EditorErrorBoundary>
                ) : collabPending ? (
                  <div className="space-y-5 py-6 animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                    <div className="h-4 bg-muted rounded w-5/6" />
                    <div className="h-4 bg-muted rounded w-2/3" />
                    <p className="text-xs text-muted-foreground pt-4">Syncing...</p>
                  </div>
                ) : content ? (
                  <DocumentProvider documentId={id} authFetch={authFetch}>
                    <TiptapEditor
                      content={content}
                      onUpdate={handleContentUpdate}
                      editable={editable}
                    />
                  </DocumentProvider>
                ) : null}
              </Suspense>
            </div>
          </div>
          </div>
        </div>
        </div>
        </div>
      </main>

      {doc?.permission === "owner" && (
        <Suspense fallback={null}>
          <ShareDialog
            open={shareOpen}
            onOpenChange={setShareOpen}
            documentId={id}
            authFetch={authFetch}
          />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <NewDocumentDialog open={newDocOpen} onOpenChange={setNewDocOpen} />
      </Suspense>

      {/* Delete confirmation dialog */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteConfirmOpen(false)}
          />
          <div className="relative bg-card border border-border rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Delete document</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This will permanently delete &quot;{title || "Untitled Document"}&quot; along with all its visuals and shared access. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
