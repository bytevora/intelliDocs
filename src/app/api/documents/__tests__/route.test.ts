import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock guards
const mockRequireAuth = vi.fn();
vi.mock("@/lib/api/guards", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
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
}));

// Mock db — supports chained .where().orderBy().limit().offset().all() and .where().get()
const mockAll = vi.fn().mockReturnValue([]);
const mockGet = vi.fn().mockReturnValue({ count: 0 });
const mockRun = vi.fn();
vi.mock("@/lib/db", () => {
  const chainable = () => {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.where = () => chain;
    chain.orderBy = () => chain;
    chain.limit = () => chain;
    chain.offset = () => chain;
    chain.innerJoin = () => chain;
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

import { GET, POST } from "../route";

const authUser = { sub: "u1", username: "test", email: "t@t.com", role: "user" };

describe("GET /api/documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue({ count: 0 });
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(
      Object.assign(new Error("Unauthorized"), { status: 401 })
    );

    const req = new NextRequest("http://localhost:3000/api/documents");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns own and shared documents with pagination", async () => {
    mockRequireAuth.mockResolvedValue(authUser);
    mockGet.mockReturnValue({ count: 0 });
    mockAll.mockReturnValue([]);

    const req = new NextRequest("http://localhost:3000/api/documents");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("own");
    expect(body).toHaveProperty("shared");
    expect(body).toHaveProperty("pagination");
    expect(body.pagination.own).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
    expect(body.pagination.shared).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it("respects page and limit params", async () => {
    mockRequireAuth.mockResolvedValue(authUser);
    mockGet.mockReturnValue({ count: 50 });
    mockAll.mockReturnValue([]);

    const req = new NextRequest("http://localhost:3000/api/documents?page=2&limit=10");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.pagination.own).toEqual({
      page: 2,
      limit: 10,
      total: 50,
      totalPages: 5,
    });
  });
});

describe("POST /api/documents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates document with default title", async () => {
    mockRequireAuth.mockResolvedValue(authUser);

    const req = new NextRequest("http://localhost:3000/api/documents", {
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.title).toBe("Untitled");
    expect(body.ownerId).toBe("u1");
    expect(body.id).toBeDefined();
  });

  it("creates document with custom title", async () => {
    mockRequireAuth.mockResolvedValue(authUser);

    const req = new NextRequest("http://localhost:3000/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "My Document" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.title).toBe("My Document");
  });
});
