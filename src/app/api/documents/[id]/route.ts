import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, visuals, documentShares } from "@/lib/db/schema";
import {
  requireAuth,
  requireDocumentAccess,
  requireDocumentOwner,
  handleApiError,
} from "@/lib/api/guards";
import { eq } from "drizzle-orm";
import { validate } from "@/lib/api/validate";
import { updateDocumentSchema } from "@/lib/api/schemas";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const { doc, permission } = requireDocumentAccess(id, user.sub, "viewer");

    return NextResponse.json({ ...doc, permission });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    requireDocumentAccess(id, user.sub, "editor");

    const body = validate(updateDocumentSchema, await req.json());
    const updates: Record<string, string> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.title !== undefined) updates.title = body.title;
    if (body.content !== undefined) updates.content = body.content;

    db.update(documents).set(updates).where(eq(documents.id, id)).run();

    const updated = db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .get();

    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    requireDocumentOwner(id, user.sub);

    // Explicitly delete related records before the document
    db.delete(visuals).where(eq(visuals.documentId, id)).run();
    db.delete(documentShares).where(eq(documentShares.documentId, id)).run();
    db.delete(documents).where(eq(documents.id, id)).run();

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
