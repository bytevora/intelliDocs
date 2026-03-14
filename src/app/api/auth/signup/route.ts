import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/passwords";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { handleApiError } from "@/lib/api/guards";
import { rateLimit, AUTH_SIGNUP_LIMIT } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validate";
import { signupSchema } from "@/lib/api/schemas";

export async function POST(req: NextRequest) {
  try {
    rateLimit(req, AUTH_SIGNUP_LIMIT, "auth:signup");
    const { username, email, password } = validate(signupSchema, await req.json());

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
      role: "user" as const,
      isActive: true,
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
      },
      { status: 201 }
    );
  } catch (err) {
    try { return handleApiError(err); } catch {}
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
