import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { visuals } from "@/lib/db/schema";
import { requireAuth, requireDocumentAccess, handleApiError } from "@/lib/api/guards";
import { eq, desc, count } from "drizzle-orm";
import { parsePagination, paginationMeta } from "@/lib/api/pagination";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id: documentId } = await params;
    const { page, limit, offset } = parsePagination(req.nextUrl.searchParams);

    requireDocumentAccess(documentId, user.sub, "viewer");

    const total = db
      .select({ count: count() })
      .from(visuals)
      .where(eq(visuals.documentId, documentId))
      .get()!.count;

    const docVisuals = db
      .select()
      .from(visuals)
      .where(eq(visuals.documentId, documentId))
      .orderBy(desc(visuals.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    return NextResponse.json({
      data: docVisuals,
      pagination: paginationMeta(page, limit, total),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
