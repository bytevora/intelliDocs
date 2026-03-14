import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-key-for-vitest-at-least-32-chars";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-for-vitest-at-least-32";
});

import { middleware } from "../../middleware";

function makeRequest(
  path: string,
  opts?: { token?: string; cookie?: string }
): NextRequest {
  const url = `http://localhost:3000${path}`;
  const headers: Record<string, string> = {};
  if (opts?.token) headers["authorization"] = `Bearer ${opts.token}`;

  const req = new NextRequest(url, { headers });
  if (opts?.cookie) {
    req.cookies.set("refresh_token", opts.cookie);
  }
  return req;
}

describe("middleware", () => {
  // ── Public paths ──
  it("allows /login without auth", async () => {
    const res = await middleware(makeRequest("/login"));
    // NextResponse.next() has no redirect
    expect(res.status).not.toBe(401);
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows /signup without auth", async () => {
    const res = await middleware(makeRequest("/signup"));
    expect(res.status).not.toBe(401);
  });

  it("allows /api/auth/login without auth", async () => {
    const res = await middleware(makeRequest("/api/auth/login"));
    expect(res.status).not.toBe(401);
  });

  it("allows /api/auth/signup without auth", async () => {
    const res = await middleware(makeRequest("/api/auth/signup"));
    expect(res.status).not.toBe(401);
  });

  it("allows /api/auth/refresh without auth", async () => {
    const res = await middleware(makeRequest("/api/auth/refresh"));
    expect(res.status).not.toBe(401);
  });

  // ── Protected API routes ──
  it("returns 401 for API route without token", async () => {
    const res = await middleware(makeRequest("/api/documents"));
    expect(res.status).toBe(401);
  });

  it("returns 401 for API route with invalid token", async () => {
    const res = await middleware(makeRequest("/api/documents", { token: "bad.token" }));
    expect(res.status).toBe(401);
  });

  it("allows API route with valid token", async () => {
    const { signAccessToken } = await import("@/lib/auth/jwt");
    const token = await signAccessToken({
      sub: "u1",
      username: "test",
      email: "t@t.com",
      role: "user",
    });

    const res = await middleware(makeRequest("/api/documents", { token }));
    expect(res.status).not.toBe(401);
  });

  // ── Protected page routes ──
  it("redirects to /login when no refresh_token cookie", async () => {
    const res = await middleware(makeRequest("/dashboard"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/login");
    expect(location).toContain("redirect=%2Fdashboard");
  });

  it("allows page route with refresh_token cookie", async () => {
    const res = await middleware(
      makeRequest("/dashboard", { cookie: "some-refresh-token" })
    );
    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });
});
