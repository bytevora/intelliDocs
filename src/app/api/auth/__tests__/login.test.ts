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

// Mock password verification
const mockVerifyPassword = vi.fn();
vi.mock("@/lib/auth/passwords", () => ({
  verifyPassword: (...args: unknown[]) => mockVerifyPassword(...args),
}));

// Mock JWT
vi.mock("@/lib/auth/jwt", () => ({
  signAccessToken: vi.fn().mockResolvedValue("mock-access-token"),
  signRefreshToken: vi.fn().mockResolvedValue("mock-refresh-token"),
}));

// Mock rate limit
vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: vi.fn(),
  AUTH_LOGIN_LIMIT: {},
}));

import { POST } from "../login/route";

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when email missing", async () => {
    const res = await POST(makeRequest({ password: "pass" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when password missing", async () => {
    const res = await POST(makeRequest({ email: "test@test.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid email format", async () => {
    const res = await POST(makeRequest({ email: "not-an-email", password: "pass" }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when user not found", async () => {
    mockGet.mockReturnValue(undefined);
    const res = await POST(makeRequest({ email: "no@user.com", password: "password123" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/invalid credentials/i);
  });

  it("returns 401 when password is wrong", async () => {
    mockGet.mockReturnValue({
      id: "u1",
      username: "test",
      email: "test@test.com",
      password: "hashed",
      role: "user",
      isActive: true,
    });
    mockVerifyPassword.mockResolvedValue(false);

    const res = await POST(makeRequest({ email: "test@test.com", password: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when account is deactivated", async () => {
    mockGet.mockReturnValue({
      id: "u1",
      username: "test",
      email: "test@test.com",
      password: "hashed",
      role: "user",
      isActive: false,
    });
    mockVerifyPassword.mockResolvedValue(true);

    const res = await POST(makeRequest({ email: "test@test.com", password: "correct" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/deactivated/i);
  });

  it("returns access token and user on success", async () => {
    mockGet.mockReturnValue({
      id: "u1",
      username: "testuser",
      email: "test@test.com",
      password: "hashed",
      role: "user",
      isActive: true,
    });
    mockVerifyPassword.mockResolvedValue(true);

    const res = await POST(makeRequest({ email: "test@test.com", password: "correct" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.accessToken).toBe("mock-access-token");
    expect(body.user.id).toBe("u1");
    expect(body.user.username).toBe("testuser");
  });

  it("sets refresh_token cookie on success", async () => {
    mockGet.mockReturnValue({
      id: "u1",
      username: "testuser",
      email: "test@test.com",
      password: "hashed",
      role: "user",
      isActive: true,
    });
    mockVerifyPassword.mockResolvedValue(true);

    const res = await POST(makeRequest({ email: "test@test.com", password: "correct" }));
    const cookies = res.cookies.getAll();
    const refreshCookie = cookies.find((c) => c.name === "refresh_token");
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie!.value).toBe("mock-refresh-token");
  });
});
