import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock JWT verification
const mockVerifyAccessToken = vi.fn();
vi.mock("@/lib/auth/jwt", () => ({
  verifyAccessToken: (...args: unknown[]) => mockVerifyAccessToken(...args),
}));

import { GET } from "../me/route";

describe("GET /api/auth/me", () => {
  it("returns 401 without authorization header", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/me");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 with non-Bearer header", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/me", {
      headers: { authorization: "Basic abc" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid token", async () => {
    mockVerifyAccessToken.mockRejectedValue(new Error("invalid"));

    const req = new NextRequest("http://localhost:3000/api/auth/me", {
      headers: { authorization: "Bearer invalid.token.here" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns user data with valid token", async () => {
    mockVerifyAccessToken.mockResolvedValue({
      sub: "user-1",
      username: "testuser",
      email: "test@example.com",
      role: "user",
    });

    const req = new NextRequest("http://localhost:3000/api/auth/me", {
      headers: { authorization: "Bearer valid-token" },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe("user-1");
    expect(body.username).toBe("testuser");
    expect(body.email).toBe("test@example.com");
    expect(body.role).toBe("user");
  });
});
