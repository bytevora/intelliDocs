import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAuth, handleApiError } from "@/lib/api/guards";
import { or, like, ne, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    const q = req.nextUrl.searchParams.get("q");
    if (!q || q.length < 2) {
      return NextResponse.json([]);
    }

    const pattern = `%${q}%`;

    const results = db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
      })
      .from(users)
      .where(
        and(
          ne(users.id, user.sub),
          or(like(users.username, pattern), like(users.email, pattern))
        )
      )
      .limit(10)
      .all();

    return NextResponse.json(results);
  } catch (err) {
    return handleApiError(err);
  }
}
