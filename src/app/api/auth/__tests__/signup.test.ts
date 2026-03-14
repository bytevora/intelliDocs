import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock db
const mockGet = vi.fn();
const mockRun = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          get: mockGet,
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        run: mockRun,
      }),
    }),
  },
}));

vi.mock("@/lib/auth/passwords", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-password"),
}));

// Mock rate limit
vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: vi.fn(),
  AUTH_SIGNUP_LIMIT: {},
}));

import { POST } from "../../auth/signup/route";

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/signup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when fields are missing", async () => {
    const res = await POST(makeRequest({ username: "test" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is too short", async () => {
    const res = await POST(
      makeRequest({ username: "test", email: "t@t.com", password: "short" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/password/i);
  });

  it("returns 409 when email exists", async () => {
    // First call checks email — found
    mockGet.mockReturnValueOnce({ id: "existing" });

    const res = await POST(
      makeRequest({ username: "new", email: "taken@t.com", password: "password123" })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/email/i);
  });

  it("returns 409 when username exists", async () => {
    // First call checks email — not found; second checks username — found
    mockGet.mockReturnValueOnce(undefined).mockReturnValueOnce({ id: "existing" });

    const res = await POST(
      makeRequest({ username: "taken", email: "new@t.com", password: "password123" })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/username/i);
  });

  it("creates user and returns 201 on success", async () => {
    mockGet.mockReturnValue(undefined);

    const res = await POST(
      makeRequest({ username: "newuser", email: "new@t.com", password: "password123" })
    );
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.username).toBe("newuser");
    expect(body.email).toBe("new@t.com");
    expect(body.role).toBe("user");
    expect(body.id).toBeDefined();
    // Password should not be in response
    expect(body.password).toBeUndefined();
  });
});
