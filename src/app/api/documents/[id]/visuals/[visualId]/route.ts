import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { visuals } from "@/lib/db/schema";
import { requireAuth, requireDocumentOwner, ApiError, handleApiError } from "@/lib/api/guards";
import { generateVisual } from "@/lib/ai/gemini";
import { eq } from "drizzle-orm";
import { VisualTheme, VisualType, ALL_VISUAL_TYPES } from "@/types";

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

    requireDocumentOwner(documentId, user.sub);
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

    requireDocumentOwner(documentId, user.sub);
    const visual = requireVisual(visualId, documentId);

    const body = await req.json();

    // Regenerate visual (optionally with a new type for layout swap)
    if (body.action === "regenerate") {
      const requestedType = body.visualType as VisualType | undefined;
      if (requestedType && !(ALL_VISUAL_TYPES as string[]).includes(requestedType)) {
        throw new ApiError(400, "Invalid visual type");
      }
      const result = await generateVisual(visual.sourceText, requestedType);
      db.update(visuals)
        .set({
          mermaidSyntax: result.mermaidSyntax,
          customData: result.customData,
          visualType: result.visualType,
          renderMode: result.renderMode,
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
      if (!VALID_THEMES.includes(body.theme)) {
        throw new ApiError(400, "Invalid theme");
      }

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

    requireDocumentOwner(documentId, user.sub);
    requireVisual(visualId, documentId);

    db.delete(visuals).where(eq(visuals.id, visualId)).run();

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
