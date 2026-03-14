import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock guards
const mockRequireAuth = vi.fn();
const mockRequireDocumentAccess = vi.fn();
const mockRequireDocumentOwner = vi.fn();
vi.mock("@/lib/api/guards", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  requireDocumentAccess: (...args: unknown[]) => mockRequireDocumentAccess(...args),
  requireDocumentOwner: (...args: unknown[]) => mockRequireDocumentOwner(...args),
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

// Mock db
const mockRun = vi.fn();
const mockGet = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    update: () => ({
      set: () => ({
        where: () => ({
          run: mockRun,
        }),
      }),
    }),
    delete: () => ({
      where: () => ({
        run: mockRun,
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          get: mockGet,
        }),
      }),
    }),
  },
}));

import { GET, PUT, DELETE } from "@/app/api/documents/[id]/route";

const authUser = { sub: "u1", username: "test", email: "t@t.com", role: "user" };
const mockParams = Promise.resolve({ id: "doc-1" });

describe("GET /api/documents/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns document with permission", async () => {
    mockRequireAuth.mockResolvedValue(authUser);
    mockRequireDocumentAccess.mockReturnValue({
      doc: { id: "doc-1", title: "Test Doc", content: "{}", ownerId: "u1" },
      permission: "owner",
    });

    const req = new NextRequest("http://localhost:3000/api/documents/doc-1");
    const res = await GET(req, { params: mockParams });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe("doc-1");
    expect(body.permission).toBe("owner");
  });

  it("returns 403 when access denied", async () => {
    mockRequireAuth.mockResolvedValue(authUser);
    mockRequireDocumentAccess.mockImplementation(() => {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    });

    const req = new NextRequest("http://localhost:3000/api/documents/doc-1");
    const res = await GET(req, { params: mockParams });
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/documents/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates document title", async () => {
    mockRequireAuth.mockResolvedValue(authUser);
    mockRequireDocumentAccess.mockReturnValue({
      doc: { id: "doc-1", title: "Old", ownerId: "u1" },
      permission: "editor",
    });
    mockGet.mockReturnValue({ id: "doc-1", title: "New Title", ownerId: "u1" });

    const req = new NextRequest("http://localhost:3000/api/documents/doc-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Title" }),
    });

    const res = await PUT(req, { params: mockParams });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.title).toBe("New Title");
  });
});

describe("DELETE /api/documents/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes document when owner", async () => {
    mockRequireAuth.mockResolvedValue(authUser);
    mockRequireDocumentOwner.mockReturnValue({ id: "doc-1", ownerId: "u1" });

    const req = new NextRequest("http://localhost:3000/api/documents/doc-1", {
      method: "DELETE",
    });

    const res = await DELETE(req, { params: mockParams });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 403 when not owner", async () => {
    mockRequireAuth.mockResolvedValue(authUser);
    mockRequireDocumentOwner.mockImplementation(() => {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    });

    const req = new NextRequest("http://localhost:3000/api/documents/doc-1", {
      method: "DELETE",
    });

    const res = await DELETE(req, { params: mockParams });
    expect(res.status).toBe(403);
  });
});
