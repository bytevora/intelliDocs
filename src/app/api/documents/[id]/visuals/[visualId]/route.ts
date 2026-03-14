import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { visuals } from "@/lib/db/schema";
import { requireAuth, requireDocumentAccess, ApiError, handleApiError } from "@/lib/api/guards";
import { generateVisual } from "@/lib/ai/gemini";
import { eq } from "drizzle-orm";
import { VisualTheme, VisualType, ALL_VISUAL_TYPES } from "@/types";
import { validate } from "@/lib/api/validate";
import { updateVisualSchema } from "@/lib/api/schemas";

const VALID_THEMES: VisualTheme[] = [
  "default", "forest", "dark", "neutral", "ocean", "sunset", "monochrome",
];

function requireVisual(visualId: string, documentId: string) {
  const visual = db
    .select()
    .from(visuals)
    .where(eq(visuals.id, visualId))
    .get();
  if (!visual || visual.documentId !== documentId) {
    throw new ApiError(404, "Visual not found");
  }
  return visual;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; visualId: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id: documentId, visualId } = await params;

    requireDocumentAccess(documentId, user.sub, "viewer");
    const visual = requireVisual(visualId, documentId);

    return NextResponse.json(visual);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; visualId: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id: documentId, visualId } = await params;

    requireDocumentAccess(documentId, user.sub, "editor");
    const visual = requireVisual(visualId, documentId);

    const body = validate(updateVisualSchema, await req.json());

    // Regenerate visual (optionally with a new type for layout swap)
    if (body.action === "regenerate") {
      const result = await generateVisual(visual.sourceText, body.visualType);
      db.update(visuals)
        .set({
          customData: result.customData,
          visualType: result.visualType,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(visuals.id, visualId))
        .run();

      const updated = db
        .select()
        .from(visuals)
        .where(eq(visuals.id, visualId))
        .get();

      return NextResponse.json(updated);
    }

    // Update theme
    if (body.theme) {
      db.update(visuals)
        .set({
          theme: body.theme,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(visuals.id, visualId))
        .run();

      const updated = db
        .select()
        .from(visuals)
        .where(eq(visuals.id, visualId))
        .get();

      return NextResponse.json(updated);
    }

    // Update customData (inline edits to titles, labels, etc.)
    if (body.customData !== undefined) {
      db.update(visuals)
        .set({
          customData: body.customData,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(visuals.id, visualId))
        .run();

      const updated = db
        .select()
        .from(visuals)
        .where(eq(visuals.id, visualId))
        .get();

      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "No valid action" }, { status: 400 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; visualId: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id: documentId, visualId } = await params;

    requireDocumentAccess(documentId, user.sub, "editor");
    requireVisual(visualId, documentId);

    db.delete(visuals).where(eq(visuals.id, visualId)).run();

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
