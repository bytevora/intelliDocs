"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collaborator, SharePermission } from "@/types";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
}

interface SearchResult {
  id: string;
  username: string;
  email: string;
}

export function ShareDialog({
  open,
  onOpenChange,
  documentId,
  authFetch,
}: ShareDialogProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [permission, setPermission] = useState<SharePermission>("viewer");
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchCollaborators = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(
        `/api/documents/${documentId}/collaborators`
      );
      if (res.ok) {
        setCollaborators(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [documentId, authFetch]);

  useEffect(() => {
    if (open) {
      fetchCollaborators();
      setQuery("");
      setSearchResults([]);
      setError(null);
    }
  }, [open, fetchCollaborators]);

  useEffect(() => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await authFetch(
          `/api/users/search?q=${encodeURIComponent(query)}`
        );
        if (res.ok) {
          const results = await res.json();
          // Filter out already shared users
          const sharedIds = new Set(collaborators.map((c) => c.id));
          setSearchResults(results.filter((r: SearchResult) => !sharedIds.has(r.id)));
        }
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout.current);
  }, [query, authFetch, collaborators]);

  const handleShare = async (user: SearchResult) => {
    setSharing(true);
    setError(null);
    try {
      const res = await authFetch(`/api/documents/${documentId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: user.email, permission }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to share");
        return;
      }

      setQuery("");
      setSearchResults([]);
      fetchCollaborators();
    } finally {
      setSharing(false);
    }
  };

  const handleRevoke = async (userId: string) => {
    await authFetch(`/api/documents/${documentId}/share/${userId}`, {
      method: "DELETE",
    });
    setCollaborators((prev) => prev.filter((c) => c.id !== userId));
  };

  const handlePermissionChange = async (
    userId: string,
    newPermission: SharePermission
  ) => {
    const collab = collaborators.find((c) => c.id === userId);
    if (!collab) return;

    await authFetch(`/api/documents/${documentId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: collab.email,
        permission: newPermission,
      }),
    });

    setCollaborators((prev) =>
      prev.map((c) =>
        c.id === userId ? { ...c, permission: newPermission } : c
      )
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share document</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search + permission */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="Search by username or email..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {/* Search dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-background shadow-lg max-h-48 overflow-auto">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleShare(u)}
                      disabled={sharing}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent text-sm"
                    >
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-medium text-primary">
                          {u.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{u.username}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {u.email}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {searching && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-background shadow-lg p-3 text-sm text-muted-foreground text-center">
                  Searching...
                </div>
              )}
            </div>
            <select
              value={permission}
              onChange={(e) =>
                setPermission(e.target.value as SharePermission)
              }
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Collaborators list */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              People with access
            </p>
            {loading ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : collaborators.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Not shared with anyone yet
              </div>
            ) : (
              <div className="space-y-1 max-h-60 overflow-auto">
                {collaborators.map((collab) => (
                  <div
                    key={collab.id}
                    className="flex items-center justify-between rounded-md p-2 hover:bg-accent/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-medium text-primary">
                          {collab.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {collab.username}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {collab.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={collab.permission}
                        onChange={(e) =>
                          handlePermissionChange(
                            collab.id,
                            e.target.value as SharePermission
                          )
                        }
                        className="h-7 rounded border-none bg-transparent px-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                      </select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(collab.id)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
