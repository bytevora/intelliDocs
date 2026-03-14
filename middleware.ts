import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const publicPaths = [
  "/login",
  "/signup",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/refresh",
];

function generateCspHeaders(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss:",
    "frame-ancestors 'none'",
  ].join("; ");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Generate CSP nonce
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // Set nonce in request header so the layout can read it
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  const csp = generateCspHeaders(nonce);

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  // API routes: verify Bearer token
  if (pathname.startsWith("/api/")) {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      await jwtVerify(token, secret);
      const response = NextResponse.next({
        request: { headers: requestHeaders },
      });
      response.headers.set("Content-Security-Policy", csp);
      return response;
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Page routes: check for refresh_token cookie
  const refreshToken = req.cookies.get("refresh_token")?.value;
  if (!refreshToken) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|socket\\.io).*)"],
};
