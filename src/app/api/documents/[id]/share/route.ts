import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documentShares, users } from "@/lib/db/schema";
import { requireAuth, requireDocumentOwner, ApiError, handleApiError } from "@/lib/api/guards";
import { eq, and, or } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { SharePermission } from "@/types";

const VALID_PERMISSIONS: SharePermission[] = ["viewer", "editor"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id: documentId } = await params;

    // Only owner can share
    requireDocumentOwner(documentId, user.sub);

    const body = await req.json();
    const { identifier, permission = "viewer" } = body;

    if (!identifier || typeof identifier !== "string") {
      throw new ApiError(400, "identifier (username or email) is required");
    }

    if (!VALID_PERMISSIONS.includes(permission)) {
      throw new ApiError(400, "Permission must be 'viewer' or 'editor'");
    }

    // Find target user by email or username
    const targetUser = db
      .select()
      .from(users)
      .where(or(eq(users.email, identifier), eq(users.username, identifier)))
      .get();

    if (!targetUser) {
      throw new ApiError(404, "User not found");
    }

    if (targetUser.id === user.sub) {
      throw new ApiError(400, "Cannot share with yourself");
    }

    // Check if already shared
    const existing = db
      .select()
      .from(documentShares)
      .where(
        and(
          eq(documentShares.documentId, documentId),
          eq(documentShares.sharedWith, targetUser.id)
        )
      )
      .get();

    if (existing) {
      // Update permission
      db.update(documentShares)
        .set({ permission })
        .where(eq(documentShares.id, existing.id))
        .run();

      return NextResponse.json({
        id: existing.id,
        documentId,
        sharedWith: targetUser.id,
        permission,
        user: {
          id: targetUser.id,
          username: targetUser.username,
          email: targetUser.email,
        },
      });
    }

    const share = {
      id: uuidv4(),
      documentId,
      sharedWith: targetUser.id,
      permission,
      createdAt: new Date().toISOString(),
    };

    db.insert(documentShares).values(share).run();

    return NextResponse.json(
      {
        ...share,
        user: {
          id: targetUser.id,
          username: targetUser.username,
          email: targetUser.email,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
