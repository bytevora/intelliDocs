import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, documentShares, users } from "@/lib/db/schema";
import { requireAuth, handleApiError } from "@/lib/api/guards";
import { eq, desc, count } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { parsePagination, paginationMeta } from "@/lib/api/pagination";
import { createDocumentSchema } from "@/lib/api/schemas";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { page, limit, offset } = parsePagination(req.nextUrl.searchParams);

    // Own documents (paginated)
    const ownTotal = db
      .select({ count: count() })
      .from(documents)
      .where(eq(documents.ownerId, user.sub))
      .get()!.count;

    const ownDocs = db
      .select({
        id: documents.id,
        title: documents.title,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(eq(documents.ownerId, user.sub))
      .orderBy(desc(documents.updatedAt))
      .limit(limit)
      .offset(offset)
      .all()
      .map((d) => ({ ...d, isShared: false as const }));

    // Shared with me (paginated)
    const sharedTotal = db
      .select({ count: count() })
      .from(documentShares)
      .where(eq(documentShares.sharedWith, user.sub))
      .get()!.count;

    const sharedDocs = db
      .select({
        id: documents.id,
        title: documents.title,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        permission: documentShares.permission,
        ownerName: users.username,
      })
      .from(documentShares)
      .innerJoin(documents, eq(documentShares.documentId, documents.id))
      .innerJoin(users, eq(documents.ownerId, users.id))
      .where(eq(documentShares.sharedWith, user.sub))
      .orderBy(desc(documents.updatedAt))
      .limit(limit)
      .offset(offset)
      .all()
      .map((d) => ({ ...d, isShared: true as const }));

    return NextResponse.json({
      own: ownDocs,
      shared: sharedDocs,
      pagination: {
        own: paginationMeta(page, limit, ownTotal),
        shared: paginationMeta(page, limit, sharedTotal),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    let title = "Untitled";
    try {
      const body = createDocumentSchema.parse(await req.json());
      if (body.title) title = body.title;
    } catch {
      // empty body is fine, use defaults
    }

    const now = new Date().toISOString();
    const newDoc = {
      id: uuidv4(),
      title,
      content: JSON.stringify({
        type: "doc",
        content: [{ type: "paragraph" }],
      }),
      ownerId: user.sub,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(documents).values(newDoc).run();

    return NextResponse.json(newDoc, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
