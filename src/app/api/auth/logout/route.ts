import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api/guards";
import { revokeAllUserRefreshTokens } from "@/lib/auth/jwt";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    revokeAllUserRefreshTokens(user.sub);

    const response = NextResponse.json({ message: "Logged out" });

    response.cookies.set("refresh_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (err) {
    return handleApiError(err);
  }
}
