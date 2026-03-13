"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { DocumentListItem } from "@/types";
import { NewDocumentDialog } from "@/components/editor/new-document-dialog";
import {
  PlusCircle,
  FileText,
  Users,
  MoreHorizontal,
  LogOut,
  FolderOpen,
  ArrowRight,
  TrendingUp,
  Clock,
  Shield,
  Sparkles,
} from "lucide-react";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function DashboardPage() {
  const { user, logout, authFetch } = useAuth();
  const router = useRouter();
  const [ownDocs, setOwnDocs] = useState<DocumentListItem[]>([]);
  const [sharedDocs, setSharedDocs] = useState<DocumentListItem[]>([]);
  const [activeTab, setActiveTab] = useState<"own" | "shared">("own");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocumentListItem | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);
  const [newDocOpen, setNewDocOpen] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await authFetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setOwnDocs(data.own);
        setSharedDocs(data.shared);
      }
    } catch {
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  function handleCreateDocument() {
    setNewDocOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authFetch(`/api/documents/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setOwnDocs((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      toast.success("Document deleted");
    } catch {
      toast.error("Failed to delete document");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const activeDocs = activeTab === "own" ? ownDocs : sharedDocs;
  const recentDoc = ownDocs.length > 0 ? ownDocs[0] : null;

  return (
    <div className="min-h-screen bg-background text-foreground relative selection:bg-primary/20 selection:text-primary overflow-x-hidden">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between h-14 px-6 md:px-8">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="text-xs font-bold text-primary-foreground tracking-widest">
                ID
              </span>
            </div>
            <span className="text-base font-bold tracking-tight text-foreground">
              IntelliDocs
              <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary hidden sm:inline-block border border-primary/20">
                Beta
              </span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex flex-col items-end">
                <p className="text-sm font-semibold leading-none">
                  {user?.username}
                </p>
                {user?.role === "admin" && (
                  <span className="text-[10px] font-bold text-primary mt-1 uppercase tracking-wider">
                    Admin
                  </span>
                )}
              </div>
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shadow-sm ring-2 ring-background">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <button
              onClick={logout}
              className="text-muted-foreground hover:text-destructive transition-colors group p-1"
              title="Sign out"
            >
              <LogOut className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout Grid */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left Sidebar / Quick Actions */}
          <div className="lg:col-span-3 space-y-6">
            <div className="sticky top-24 space-y-6">
              {/* Primary Action Card */}
              <div className="group relative overflow-hidden rounded-3xl bg-primary p-6 shadow-2xl shadow-primary/15 transition-transform hover:-translate-y-1 duration-300 border border-white/10 dark:border-white/5">
                <div className="absolute -top-4 -right-4 p-4 opacity-15 group-hover:opacity-25 group-hover:rotate-12 transition-all duration-500">
                  <FileText className="h-32 w-32 text-primary-foreground" />
                </div>
                <div className="relative z-10 flex flex-col h-full justify-between min-h-[160px]">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="h-4 w-4 text-primary-foreground/70" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/50">
                        Quick Start
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-primary-foreground tracking-tight">
                      Create
                    </h2>
                    <p className="text-primary-foreground/60 text-sm mt-1 mb-6 font-medium">
                      Start capturing your brilliant ideas immediately.
                    </p>
                  </div>
                  <Button
                    onClick={handleCreateDocument}
                    disabled={creating}
                    className="w-full justify-between bg-white text-primary hover:bg-neutral-50 dark:bg-white/10 dark:text-primary-foreground dark:hover:bg-white/20 rounded-xl h-12 shadow-lg shadow-black/10 group-hover:shadow-xl transition-all"
                  >
                    <span className="font-bold text-base">
                      {creating ? "Initializing..." : "New Document"}
                    </span>
                    {creating ? (
                      <span className="animate-pulse h-5 w-5 rounded-full bg-primary/30" />
                    ) : (
                      <PlusCircle className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Navigation Card */}
              <nav className="flex flex-col gap-1.5 bg-card backdrop-blur-sm border border-border/50 p-2.5 rounded-2xl shadow-sm">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 pt-2 pb-2">
                  Library
                </h3>
                <button
                  onClick={() => setActiveTab("own")}
                  className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    activeTab === "own"
                      ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FolderOpen className="h-4 w-4" />
                    My Workspace
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-md font-mono ${activeTab === 'own' ? 'bg-primary/20' : 'bg-muted'}`}>
                    {loading ? "..." : ownDocs.length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab("shared")}
                  className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    activeTab === "shared"
                      ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4" />
                    Shared with me
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-md font-mono ${activeTab === 'shared' ? 'bg-primary/20' : 'bg-muted'}`}>
                    {loading ? "..." : sharedDocs.length}
                  </span>
                </button>
                {user?.role === "admin" && (
                  <button
                    onClick={() => router.push("/admin/users")}
                    className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="h-4 w-4" />
                      Manage Users
                    </div>
                  </button>
                )}
              </nav>

              {/* Recent Activity Card */}
              {!loading && recentDoc && activeTab === "own" && (
                <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-primary mb-3">
                    <TrendingUp className="h-4 w-4" />
                    <h3 className="text-[10px] font-bold uppercase tracking-widest">
                      Recent Activity
                    </h3>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-bold text-foreground truncate">
                      {recentDoc.title || "Untitled Document"}
                    </p>
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      Edited {timeAgo(recentDoc.updatedAt)}
                    </p>
                  </div>
                  <Button
                    variant="link"
                    className="px-0 h-auto mt-3 text-xs text-primary flex items-center gap-1 font-semibold group/link"
                    onClick={() => router.push(`/documents/${recentDoc.id}`)}
                  >
                    Jump back in
                    <ArrowRight className="h-3 w-3 group-hover/link:translate-x-1 transition-transform" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Right Content Area */}
          <div className="lg:col-span-9 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                {activeTab === "own" ? "My Workspace" : "Shared Documents"}
              </h1>
            </div>

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="h-[140px] rounded-2xl border border-border/50 bg-card p-6 flex flex-col justify-between shadow-sm"
                  >
                    <Skeleton className="h-6 w-2/3" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                ))}
              </div>
            ) : activeDocs.length === 0 ? (
              <div className="min-h-[400px] flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center relative overflow-hidden">
                <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 shadow-inner relative group border border-primary/15">
                  <div className="absolute inset-0 bg-primary/10 rounded-2xl animate-ping opacity-20" />
                  {activeTab === "own" ? (
                    <FileText className="h-10 w-10 text-primary group-hover:scale-110 transition-transform duration-300" />
                  ) : (
                    <Users className="h-10 w-10 text-primary group-hover:scale-110 transition-transform duration-300" />
                  )}
                </div>
                <h3 className="text-2xl font-bold mb-2 tracking-tight text-foreground">
                  {activeTab === "own" ? "No documents found" : "No shared documents"}
                </h3>
                <p className="text-muted-foreground max-w-sm mx-auto mb-8 font-medium">
                  {activeTab === "own"
                    ? "Your workspace is empty. Create a new document to start collaborating."
                    : "When someone shares a document with you, it will neatly appear right here."}
                </p>
                {activeTab === "own" && (
                  <Button
                    onClick={handleCreateDocument}
                    disabled={creating}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-8 shadow-lg shadow-primary/25"
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Create First Document
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {activeDocs.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => router.push(`/documents/${doc.id}`)}
                    className="group relative cursor-pointer rounded-2xl border border-border/50 bg-card p-5 shadow-sm hover:shadow-lg hover:border-primary/25 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between min-h-[150px] overflow-hidden"
                  >
                    {/* Top accent line on hover */}
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-primary/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors duration-200">
                            <FileText className="h-3.5 w-3.5 text-primary/80" />
                          </div>
                          <h3 className="text-base font-bold tracking-tight text-foreground truncate group-hover:text-primary transition-colors duration-200">
                            {doc.title || "Untitled Document"}
                          </h3>
                        </div>
                        {doc.isShared && doc.ownerName && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium pl-9">
                            <div className="h-4 w-4 rounded-full bg-secondary flex items-center justify-center border border-border/50 shadow-sm">
                              <span className="font-bold text-[8px] uppercase text-foreground">
                                {doc.ownerName.charAt(0)}
                              </span>
                            </div>
                            <span className="truncate">by {doc.ownerName}</span>
                          </div>
                        )}
                      </div>

                      {!doc.isShared && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="inline-flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 transition-all hover:bg-secondary hover:text-foreground shrink-0 -mr-2 -mt-2"
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 rounded-xl border-border/50 shadow-xl p-1 backdrop-blur-xl bg-background/95">
                            <DropdownMenuItem
                              className="text-destructive focus:bg-destructive/10 focus:text-destructive font-semibold cursor-pointer rounded-lg"
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                setDeleteTarget(doc);
                              }}
                            >
                              Move to Trash
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-6">
                      <p className="text-xs font-semibold text-muted-foreground/70">
                        Edited {timeAgo(doc.updatedAt)}
                      </p>
                      {doc.isShared && doc.permission && (
                        <span className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-2.5 py-1 text-[10px] font-bold text-primary uppercase tracking-widest shadow-sm">
                          {doc.permission}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* New Document Dialog */}
      <NewDocumentDialog open={newDocOpen} onOpenChange={setNewDocOpen} />

      {/* Delete Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="rounded-3xl border border-border/50 shadow-2xl overflow-hidden sm:max-w-md backdrop-blur-xl bg-background/95">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl font-extrabold flex items-center gap-2 text-destructive">
              <LogOut className="h-5 w-5" />
              Delete Document
            </DialogTitle>
            <DialogDescription className="text-sm pt-2 text-muted-foreground font-medium">
              The document <span className="font-bold text-foreground px-1 bg-secondary rounded mx-0.5">&quot;{deleteTarget?.title || "Untitled"}&quot;</span> will be permanently deleted. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="p-6 pt-4 border-t border-border/50 gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="rounded-xl border-border bg-transparent hover:bg-secondary shadow-sm font-semibold"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl shadow-lg shadow-destructive/20 font-bold"
            >
              {deleting ? "Deleting..." : "Permanently Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
