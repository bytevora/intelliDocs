import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock db
const mockGet = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          get: mockGet,
        }),
      }),
    }),
  },
}));

// Mock JWT — includes revokeRefreshToken for token rotation
const mockVerifyRefreshToken = vi.fn();
vi.mock("@/lib/auth/jwt", () => ({
  verifyRefreshToken: (...args: unknown[]) => mockVerifyRefreshToken(...args),
  signAccessToken: vi.fn().mockResolvedValue("new-access-token"),
  signRefreshToken: vi.fn().mockResolvedValue("new-refresh-token"),
  revokeRefreshToken: vi.fn(),
}));

import { POST } from "../refresh/route";

function makeRequest(refreshToken?: string): NextRequest {
  const req = new NextRequest("http://localhost:3000/api/auth/refresh", {
    method: "POST",
  });
  if (refreshToken) {
    req.cookies.set("refresh_token", refreshToken);
  }
  return req;
}

describe("POST /api/auth/refresh", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no refresh token cookie", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/no refresh token/i);
  });

  it("returns 401 for invalid refresh token", async () => {
    mockVerifyRefreshToken.mockRejectedValue(new Error("invalid"));

    const res = await POST(makeRequest("invalid-token"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/invalid refresh token/i);
  });

  it("returns 401 when user not found", async () => {
    mockVerifyRefreshToken.mockResolvedValue({ sub: "nonexistent", jti: "jti-1" });
    mockGet.mockReturnValue(undefined);

    const res = await POST(makeRequest("valid-token"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/user not found/i);
  });

  it("returns 403 when account is deactivated", async () => {
    mockVerifyRefreshToken.mockResolvedValue({ sub: "u1", jti: "jti-1" });
    mockGet.mockReturnValue({
      id: "u1",
      username: "test",
      email: "test@t.com",
      role: "user",
      isActive: false,
    });

    const res = await POST(makeRequest("valid-token"));
    expect(res.status).toBe(403);
  });

  it("returns new access token on success", async () => {
    mockVerifyRefreshToken.mockResolvedValue({ sub: "u1", jti: "jti-1" });
    mockGet.mockReturnValue({
      id: "u1",
      username: "testuser",
      email: "test@t.com",
      role: "user",
      isActive: true,
    });

    const res = await POST(makeRequest("valid-token"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.accessToken).toBe("new-access-token");

    // Should set new refresh_token cookie
    const cookies = res.cookies.getAll();
    const refreshCookie = cookies.find((c) => c.name === "refresh_token");
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie!.value).toBe("new-refresh-token");
  });
});
