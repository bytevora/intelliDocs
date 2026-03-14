import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/passwords";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { REFRESH_TOKEN_MAX_AGE } from "@/lib/auth/constants";
import { eq } from "drizzle-orm";
import { handleApiError } from "@/lib/api/guards";
import { rateLimit, AUTH_LOGIN_LIMIT } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validate";
import { loginSchema } from "@/lib/api/schemas";

export async function POST(req: NextRequest) {
  try {
    rateLimit(req, AUTH_LOGIN_LIMIT, "auth:login");
    const { email, password } = validate(loginSchema, await req.json());

    const user = db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.password);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Your account has been deactivated. Please contact an administrator." },
        { status: 403 }
      );
    }

    const accessToken = await signAccessToken({
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    });

    const refreshToken = await signRefreshToken(user.id);

    const response = NextResponse.json({
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" && req.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    return response;
  } catch (err) {
    try { return handleApiError(err); } catch {}
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
