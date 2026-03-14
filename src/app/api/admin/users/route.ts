import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAdmin, handleApiError } from "@/lib/api/guards";
import { hashPassword } from "@/lib/auth/passwords";
import { eq, count } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { parsePagination, paginationMeta } from "@/lib/api/pagination";
import { validate } from "@/lib/api/validate";
import { createUserSchema } from "@/lib/api/schemas";

/** GET /api/admin/users — list all users (paginated) */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const { page, limit, offset } = parsePagination(req.nextUrl.searchParams);

    const total = db.select({ count: count() }).from(users).get()!.count;

    const allUsers = db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .limit(limit)
      .offset(offset)
      .all();

    return NextResponse.json({
      data: allUsers,
      pagination: paginationMeta(page, limit, total),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/** POST /api/admin/users — create a new user (optionally inactive) */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { username, email, password, role, isActive } = validate(
      createUserSchema,
      await req.json()
    );

    const existingEmail = db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();

    if (existingEmail) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 409 }
      );
    }

    const existingUsername = db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .get();

    if (existingUsername) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);
    const now = new Date().toISOString();

    const newUser = {
      id: uuidv4(),
      username,
      email,
      password: hashedPassword,
      role: role as "admin" | "user",
      isActive: Boolean(isActive),
      createdAt: now,
      updatedAt: now,
    };

    db.insert(users).values(newUser).run();

    return NextResponse.json(
      {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        isActive: newUser.isActive,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
