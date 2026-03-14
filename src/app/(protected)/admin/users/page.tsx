"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { AdminUser } from "@/types";
import {
  ArrowLeft,
  Plus,
  MoreHorizontal,
  Shield,
  ShieldOff,
  UserCheck,
  UserX,
  Trash2,
  KeyRound,
  Search,
  Users,
} from "lucide-react";

export default function AdminUsersPage() {
  const { user, authFetch } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const pageRef = useRef(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalUsers, setTotalUsers] = useState(0);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "user" as "admin" | "user",
    isActive: false,
  });
  const [creating, setCreating] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reset password dialog
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const fetchUsers = useCallback(async (page = 1, append = false) => {
    try {
      const res = await authFetch(`/api/admin/users?page=${page}&limit=20`);
      if (res.ok) {
        const json = await res.json();
        if (append) {
          setUsers((prev) => [...prev, ...json.data]);
        } else {
          setUsers(json.data);
        }
        setTotalUsers(json.pagination.total);
        setHasMore(page < json.pagination.totalPages);
      } else if (res.status === 403) {
        router.replace("/dashboard");
        toast.error("Admin access required");
      }
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [authFetch, router]);

  useEffect(() => {
    if (user?.role !== "admin") {
      router.replace("/dashboard");
      return;
    }
    fetchUsers();
  }, [user, router, fetchUsers]);

  function loadMoreUsers() {
    setLoadingMore(true);
    pageRef.current += 1;
    fetchUsers(pageRef.current, true);
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await authFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      const newUser = await res.json();
      setUsers((prev) => [...prev, newUser]);
      setCreateOpen(false);
      setCreateForm({ username: "", email: "", password: "", role: "user", isActive: false });
      toast.success("User created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(target: AdminUser) {
    try {
      const res = await authFetch(`/api/admin/users/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !target.isActive }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      const updated = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === target.id ? updated : u)));
      toast.success(`User ${updated.isActive ? "activated" : "deactivated"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    }
  }

  async function toggleRole(target: AdminUser) {
    const newRole = target.role === "admin" ? "user" : "admin";
    try {
      const res = await authFetch(`/api/admin/users/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      const updated = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === target.id ? updated : u)));
      toast.success(`Role changed to ${newRole}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    }
  }

  async function handleResetPassword() {
    if (!resetTarget || !newPassword) return;
    setResetting(true);
    try {
      const res = await authFetch(`/api/admin/users/${resetTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast.success("Password reset successfully");
      setResetTarget(null);
      setNewPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setResetting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authFetch(`/api/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      toast.success("User deleted");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  }

  const filtered = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (user?.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-background text-foreground relative selection:bg-primary/20 selection:text-primary">
      {/* Background Glowing Accents */}
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[50%] bg-primary/8 blur-[150px] rounded-full pointer-events-none" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/60 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between h-14 px-6 md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-base font-bold tracking-tight">
                User Management
              </span>
            </div>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="rounded-xl shadow-lg shadow-primary/20 font-bold gap-2"
          >
            <Plus className="h-4 w-4" />
            Create User
          </Button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-12 relative z-10">
        {/* Search & Stats */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl h-10"
            />
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground font-medium">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span>{totalUsers} total</span>
            </div>
            <div className="flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>{users.filter((u) => u.isActive).length} active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <UserX className="h-3.5 w-3.5 text-red-500" />
              <span>{users.filter((u) => !u.isActive).length} inactive</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-2xl border border-border/50 bg-background/40 p-4 flex items-center gap-4"
              >
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="min-h-[300px] flex flex-col items-center justify-center rounded-3xl border border-dashed border-primary/20 bg-primary/5 p-12 text-center">
            <Users className="h-12 w-12 text-primary/40 mb-4" />
            <h3 className="text-xl font-bold mb-2">No users found</h3>
            <p className="text-muted-foreground text-sm">
              {search ? "Try a different search term." : "Create your first user to get started."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((u) => (
              <div
                key={u.id}
                className={`group relative flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 ${
                  u.isActive
                    ? "border-border/50 bg-background/60 backdrop-blur-xl hover:shadow-lg hover:shadow-primary/5"
                    : "border-border/30 bg-muted/30 opacity-70 hover:opacity-90"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shadow-inner shrink-0 ${
                    u.isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {u.username.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm truncate">{u.username}</p>
                    {u.role === "admin" && (
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md">
                        Admin
                      </span>
                    )}
                    {!u.isActive && (
                      <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-md">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>

                {/* Created date */}
                <p className="text-xs text-muted-foreground hidden md:block shrink-0">
                  Joined {new Date(u.createdAt).toLocaleDateString()}
                </p>

                {/* Actions */}
                {u.id !== user?.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 transition-all hover:bg-secondary hover:text-foreground shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/50 shadow-xl p-1 backdrop-blur-xl bg-background/95">
                      <DropdownMenuItem
                        className="cursor-pointer rounded-lg gap-2 font-medium"
                        onClick={() => toggleActive(u)}
                      >
                        {u.isActive ? (
                          <>
                            <UserX className="h-4 w-4" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-4 w-4" />
                            Activate
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer rounded-lg gap-2 font-medium"
                        onClick={() => toggleRole(u)}
                      >
                        {u.role === "admin" ? (
                          <>
                            <ShieldOff className="h-4 w-4" />
                            Remove Admin
                          </>
                        ) : (
                          <>
                            <Shield className="h-4 w-4" />
                            Make Admin
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer rounded-lg gap-2 font-medium"
                        onClick={() => {
                          setResetTarget(u);
                          setNewPassword("");
                        }}
                      >
                        <KeyRound className="h-4 w-4" />
                        Reset Password
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer rounded-lg gap-2 font-semibold"
                        onClick={() => setDeleteTarget(u)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {u.id === user?.id && (
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    You
                  </span>
                )}
              </div>
            ))}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={loadMoreUsers}
                  disabled={loadingMore}
                  className="rounded-xl font-semibold px-8"
                >
                  {loadingMore ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-3xl border border-border/50 shadow-2xl overflow-hidden sm:max-w-md backdrop-blur-xl bg-background/95">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl font-extrabold flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Create New User
            </DialogTitle>
            <DialogDescription className="text-sm pt-2 text-muted-foreground font-medium">
              The user will be created as <span className="font-bold text-foreground">{createForm.isActive ? "active" : "inactive"}</span> by default.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 space-y-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Username
              </label>
              <Input
                placeholder="johndoe"
                value={createForm.username}
                onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
                className="rounded-xl h-10"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Email
              </label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                className="rounded-xl h-10"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Password
              </label>
              <Input
                type="password"
                placeholder="Min 8 characters"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                className="rounded-xl h-10"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Role
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCreateForm((f) => ({ ...f, role: "user" }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all border ${
                      createForm.role === "user"
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-transparent text-muted-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    User
                  </button>
                  <button
                    onClick={() => setCreateForm((f) => ({ ...f, role: "admin" }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all border ${
                      createForm.role === "admin"
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-transparent text-muted-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    Admin
                  </button>
                </div>
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Status
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCreateForm((f) => ({ ...f, isActive: false }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all border ${
                      !createForm.isActive
                        ? "bg-red-500/10 text-red-500 border-red-500/30"
                        : "bg-transparent text-muted-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    Inactive
                  </button>
                  <button
                    onClick={() => setCreateForm((f) => ({ ...f, isActive: true }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all border ${
                      createForm.isActive
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                        : "bg-transparent text-muted-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    Active
                  </button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 pt-4 border-t border-border/50 gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              className="rounded-xl border-border bg-transparent hover:bg-secondary shadow-sm font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !createForm.username || !createForm.email || !createForm.password}
              className="rounded-xl shadow-lg shadow-primary/20 font-bold"
            >
              {creating ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent className="rounded-3xl border border-border/50 shadow-2xl overflow-hidden sm:max-w-md backdrop-blur-xl bg-background/95">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl font-extrabold flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Reset Password
            </DialogTitle>
            <DialogDescription className="text-sm pt-2 text-muted-foreground font-medium">
              Set a new password for <span className="font-bold text-foreground">{resetTarget?.username}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              New Password
            </label>
            <Input
              type="password"
              placeholder="Min 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="rounded-xl h-10"
            />
          </div>
          <DialogFooter className="p-6 pt-4 border-t border-border/50 gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => setResetTarget(null)}
              className="rounded-xl border-border bg-transparent hover:bg-secondary shadow-sm font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={resetting || !newPassword}
              className="rounded-xl shadow-lg shadow-primary/20 font-bold"
            >
              {resetting ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="rounded-3xl border border-border/50 shadow-2xl overflow-hidden sm:max-w-md backdrop-blur-xl bg-background/95">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl font-extrabold flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete User
            </DialogTitle>
            <DialogDescription className="text-sm pt-2 text-muted-foreground font-medium">
              Are you sure you want to permanently delete{" "}
              <span className="font-bold text-foreground px-1 bg-secondary rounded mx-0.5">
                {deleteTarget?.username}
              </span>
              ? This will also delete all their documents. This action cannot be undone.
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
