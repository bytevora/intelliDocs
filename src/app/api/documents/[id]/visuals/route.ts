import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { visuals } from "@/lib/db/schema";
import { requireAuth, requireDocumentOwner, handleApiError } from "@/lib/api/guards";
import { eq, desc } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id: documentId } = await params;

    requireDocumentOwner(documentId, user.sub);

    const docVisuals = db
      .select()
      .from(visuals)
      .where(eq(visuals.documentId, documentId))
      .orderBy(desc(visuals.createdAt))
      .all();

    return NextResponse.json(docVisuals);
  } catch (err) {
    return handleApiError(err);
  }
}
