import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, documentShares } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth/get-user";
import { JWTPayload } from "@/lib/auth/jwt";
import { eq, and } from "drizzle-orm";

// ── Error class ──────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

// ── Guards ───────────────────────────────────────────────

/** Extract and validate the authenticated user from the request. Throws 401. */
export async function requireAuth(req: NextRequest): Promise<JWTPayload> {
  const user = await getAuthUser(req);
  if (!user) throw new ApiError(401, "Unauthorized");
  return user;
}

/** Require the authenticated user to have the admin role. Throws 401/403. */
export async function requireAdmin(req: NextRequest): Promise<JWTPayload> {
  const user = await requireAuth(req);
  if (user.role !== "admin") throw new ApiError(403, "Admin access required");
  return user;
}

/** Fetch a document by ID. Throws 404 if not found. */
export function requireDocument(documentId: string) {
  const doc = db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .get();
  if (!doc) throw new ApiError(404, "Document not found");
  return doc;
}

/** Fetch a document and verify the user is the owner. Throws 404 / 403. */
export function requireDocumentOwner(documentId: string, userId: string) {
  const doc = requireDocument(documentId);
  if (doc.ownerId !== userId) throw new ApiError(403, "Forbidden");
  return doc;
}

/** Look up the share permission a user has on a document. Returns null if none. */
export function getSharePermission(
  documentId: string,
  userId: string,
): "viewer" | "editor" | null {
  const share = db
    .select()
    .from(documentShares)
    .where(
      and(
        eq(documentShares.documentId, documentId),
        eq(documentShares.sharedWith, userId),
      ),
    )
    .get();
  return (share?.permission as "viewer" | "editor") ?? null;
}

/**
 * Fetch a document and verify the user has at least the given access level.
 * - "viewer" — owner or any share permission
 * - "editor" — owner or editor share permission
 * - "owner"  — owner only
 *
 * Returns the document and the effective permission.
 * Throws 404 / 403.
 */
export function requireDocumentAccess(
  documentId: string,
  userId: string,
  minPermission: "viewer" | "editor" | "owner" = "viewer",
) {
  const doc = requireDocument(documentId);

  if (doc.ownerId === userId) {
    return { doc, permission: "owner" as const };
  }

  if (minPermission === "owner") {
    throw new ApiError(403, "Forbidden");
  }

  const permission = getSharePermission(documentId, userId);

  if (!permission) {
    throw new ApiError(403, "Forbidden");
  }

  if (minPermission === "editor" && permission !== "editor") {
    throw new ApiError(403, "Forbidden");
  }

  return { doc, permission };
}

// ── Error handler ────────────────────────────────────────

/** Convert an ApiError into a NextResponse. Re-throws unknown errors. */
export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    const res = NextResponse.json({ error: err.message }, { status: err.status });
    if (err.headers) {
      for (const [key, value] of Object.entries(err.headers)) {
        res.headers.set(key, value);
      }
    }
    return res;
  }
  throw err;
}
