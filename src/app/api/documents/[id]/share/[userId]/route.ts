import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documentShares } from "@/lib/db/schema";
import { requireAuth, requireDocumentOwner, handleApiError } from "@/lib/api/guards";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id: documentId, userId } = await params;

    // Only owner can manage sharing
    requireDocumentOwner(documentId, user.sub);

    db.delete(documentShares)
      .where(
        and(
          eq(documentShares.documentId, documentId),
          eq(documentShares.sharedWith, userId)
        )
      )
      .run();

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
