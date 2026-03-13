import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAdmin, handleApiError } from "@/lib/api/guards";
import { hashPassword } from "@/lib/auth/passwords";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

/** GET /api/admin/users — list all users */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

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
      .all();

    return NextResponse.json(allUsers);
  } catch (err) {
    return handleApiError(err);
  }
}

/** POST /api/admin/users — create a new user (optionally inactive) */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const body = await req.json();
    const { username, email, password, role = "user", isActive = false } = body;

    if (!username || !email || !password) {
      return NextResponse.json(
        { error: "Username, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (role !== "admin" && role !== "user") {
      return NextResponse.json(
        { error: "Role must be 'admin' or 'user'" },
        { status: 400 }
      );
    }

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
