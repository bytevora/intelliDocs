import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock guards
const mockRequireAdmin = vi.fn();
vi.mock("@/lib/api/guards", () => {
  class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
    ApiError,
    handleApiError: (err: unknown) => {
    if (err && typeof err === "object" && "status" in err) {
      const { NextResponse } = require("next/server");
      return NextResponse.json(
        { error: (err as Error).message },
        { status: (err as { status: number }).status }
      );
    }
    throw err;
  },
  };
});

// Mock db — supports chained queries with limit/offset and count
const mockAll = vi.fn();
const mockGet = vi.fn();
const mockRun = vi.fn();
vi.mock("@/lib/db", () => {
  const chainable = () => {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.where = () => chain;
    chain.limit = () => chain;
    chain.offset = () => chain;
    chain.all = mockAll;
    chain.get = mockGet;
    return chain;
  };
  return {
    db: {
      select: chainable,
      insert: () => ({ values: () => ({ run: mockRun }) }),
    },
  };
});

vi.mock("@/lib/auth/passwords", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed"),
}));

import { GET, POST } from "../users/route";

const adminUser = { sub: "a1", username: "admin", email: "a@t.com", role: "admin" };

describe("GET /api/admin/users", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for non-admin", async () => {
    mockRequireAdmin.mockRejectedValue(
      Object.assign(new Error("Admin access required"), { status: 403 })
    );

    const req = new NextRequest("http://localhost:3000/api/admin/users");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns paginated users for admin", async () => {
    mockRequireAdmin.mockResolvedValue(adminUser);
    // First select call is for count, second is for data
    mockGet.mockReturnValueOnce({ count: 2 });
    mockAll.mockReturnValueOnce([
      { id: "u1", username: "user1", email: "u1@t.com", role: "user", isActive: true },
      { id: "a1", username: "admin", email: "a@t.com", role: "admin", isActive: true },
    ]);

    const req = new NextRequest("http://localhost:3000/api/admin/users");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    });
  });

  it("respects page and limit params", async () => {
    mockRequireAdmin.mockResolvedValue(adminUser);
    mockGet.mockReturnValueOnce({ count: 50 });
    mockAll.mockReturnValueOnce([]);

    const req = new NextRequest("http://localhost:3000/api/admin/users?page=3&limit=10");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.pagination).toEqual({
      page: 3,
      limit: 10,
      total: 50,
      totalPages: 5,
    });
  });
});

describe("POST /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(adminUser);
  });

  it("returns 400 when fields are missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "test" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for short password", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "test",
        email: "test@t.com",
        password: "short",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid role", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "test",
        email: "test@t.com",
        password: "password123",
        role: "superadmin",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 409 for duplicate email", async () => {
    mockGet.mockReturnValueOnce({ id: "existing" });

    const req = new NextRequest("http://localhost:3000/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "new",
        email: "taken@t.com",
        password: "password123",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("creates user and returns 201", async () => {
    mockGet.mockReturnValue(undefined);

    const req = new NextRequest("http://localhost:3000/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "newuser",
        email: "new@t.com",
        password: "password123",
        role: "user",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.username).toBe("newuser");
    expect(body.email).toBe("new@t.com");
    expect(body.role).toBe("user");
    expect(body.password).toBeUndefined();
  });
});
