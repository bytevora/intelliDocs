import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { visuals, visualCache } from "@/lib/db/schema";
import { requireAuth, requireDocumentAccess, handleApiError } from "@/lib/api/guards";
import { generateVisual, generateMindmapForTemplate } from "@/lib/ai/gemini";
import { HORIZONTAL_MINDMAP_TEMPLATES, VERTICAL_MINDMAP_TEMPLATES, LEFT_MINDMAP_TEMPLATES, RIGHT_MINDMAP_TEMPLATES } from "@/components/visuals/mindmap-templates";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { VisualType, ALL_VISUAL_TYPES } from "@/types";

async function computeHash(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id: documentId } = await params;

    requireDocumentAccess(documentId, user.sub, "editor");

    const body = await req.json();
    const { sourceText, visualType, templateId, forceRefresh } = body;

    if (!sourceText || typeof sourceText !== "string") {
      return NextResponse.json(
        { error: "sourceText is required" },
        { status: 400 }
      );
    }

    if (visualType && !(ALL_VISUAL_TYPES as string[]).includes(visualType)) {
      return NextResponse.json(
        { error: "Invalid visual type" },
        { status: 400 }
      );
    }

    // Build cache key from normalized text + type + template
    const normalizedText = sourceText.trim().replace(/\s+/g, " ").toLowerCase();
    const cacheInput = `${normalizedText}||${visualType || "auto"}||${templateId || ""}`;
    const contentHash = await computeHash(cacheInput);

    // Check cache (skip if forceRefresh)
    const cached = forceRefresh
      ? null
      : db
          .select()
          .from(visualCache)
          .where(eq(visualCache.contentHash, contentHash))
          .get();

    let result: {
      visualType: string;
      renderMode: string;
      mermaidSyntax: string;
      customData: string | null;
    };

    if (cached) {
      // Cache hit — bump hit count
      db.update(visualCache)
        .set({ hitCount: sql`${visualCache.hitCount} + 1` })
        .where(eq(visualCache.contentHash, contentHash))
        .run();

      result = {
        visualType: cached.visualType,
        renderMode: cached.renderMode,
        mermaidSyntax: cached.mermaidSyntax,
        customData: cached.customData,
      };
    } else {
      // Cache miss or forceRefresh — generate with AI
      let aiResult;
      if (templateId) {
        const template =
          HORIZONTAL_MINDMAP_TEMPLATES.find((t) => t.id === templateId) ||
          VERTICAL_MINDMAP_TEMPLATES.find((t) => t.id === templateId) ||
          LEFT_MINDMAP_TEMPLATES.find((t) => t.id === templateId) ||
          RIGHT_MINDMAP_TEMPLATES.find((t) => t.id === templateId);
        if (!template) {
          return NextResponse.json({ error: "Invalid template ID" }, { status: 400 });
        }
        const templateLayout = VERTICAL_MINDMAP_TEMPLATES.some((t) => t.id === templateId) ? "vertical" as const
          : LEFT_MINDMAP_TEMPLATES.some((t) => t.id === templateId) ? "left" as const
          : RIGHT_MINDMAP_TEMPLATES.some((t) => t.id === templateId) ? "right" as const
          : "horizontal" as const;
        aiResult = await generateMindmapForTemplate(
          sourceText,
          template.structure,
          templateLayout
        );
      } else {
        aiResult = await generateVisual(sourceText, visualType as VisualType | undefined);
      }

      result = {
        visualType: aiResult.visualType,
        renderMode: aiResult.renderMode,
        mermaidSyntax: aiResult.mermaidSyntax,
        customData: aiResult.customData,
      };

      // Upsert cache (replace if forceRefresh, insert if new)
      if (forceRefresh) {
        const existing = db
          .select()
          .from(visualCache)
          .where(eq(visualCache.contentHash, contentHash))
          .get();
        if (existing) {
          db.update(visualCache)
            .set({
              visualType: result.visualType as typeof visualCache.$inferInsert.visualType,
              renderMode: result.renderMode as typeof visualCache.$inferInsert.renderMode,
              mermaidSyntax: result.mermaidSyntax,
              customData: result.customData,
              hitCount: 0,
            })
            .where(eq(visualCache.contentHash, contentHash))
            .run();
        } else {
          db.insert(visualCache)
            .values({
              contentHash,
              visualType: result.visualType as typeof visualCache.$inferInsert.visualType,
              renderMode: result.renderMode as typeof visualCache.$inferInsert.renderMode,
              mermaidSyntax: result.mermaidSyntax,
              customData: result.customData,
              hitCount: 0,
            })
            .run();
        }
      } else {
        db.insert(visualCache)
          .values({
            contentHash,
            visualType: result.visualType as typeof visualCache.$inferInsert.visualType,
            renderMode: result.renderMode as typeof visualCache.$inferInsert.renderMode,
            mermaidSyntax: result.mermaidSyntax,
            customData: result.customData,
            hitCount: 0,
          })
          .run();
      }
    }

    const now = new Date().toISOString();

    const visual = {
      id: uuidv4(),
      documentId,
      sourceText,
      visualType: result.visualType as typeof visuals.$inferInsert.visualType,
      renderMode: result.renderMode as typeof visuals.$inferInsert.renderMode,
      mermaidSyntax: result.mermaidSyntax,
      customData: result.customData,
      theme: "default" as const,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(visuals).values(visual).run();

    return NextResponse.json(visual, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
