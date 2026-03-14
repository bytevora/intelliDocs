import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documentShares, users } from "@/lib/db/schema";
import { requireAuth, requireDocumentAccess, handleApiError } from "@/lib/api/guards";
import { eq, and } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id: documentId } = await params;

    // Owner or anyone with share access can view collaborators
    requireDocumentAccess(documentId, user.sub, "viewer");

    const shares = db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        permission: documentShares.permission,
        sharedAt: documentShares.createdAt,
      })
      .from(documentShares)
      .innerJoin(users, eq(documentShares.sharedWith, users.id))
      .where(
        and(
          eq(documentShares.documentId, documentId),
          eq(users.isActive, true)
        )
      )
      .all();

    return NextResponse.json(shares);
  } catch (err) {
    return handleApiError(err);
  }
}
