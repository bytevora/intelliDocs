import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock guards
const mockRequireAuth = vi.fn();
const mockRequireDocumentOwner = vi.fn();
vi.mock("@/lib/api/guards", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  requireDocumentOwner: (...args: unknown[]) => mockRequireDocumentOwner(...args),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
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
    update: () => ({
      set: () => ({
        where: () => ({
          run: mockRun,
        }),
      }),
    }),
  },
}));

import { POST } from "@/app/api/documents/[id]/share/route";

const authUser = { sub: "u1", username: "owner", email: "owner@t.com", role: "user" };
const mockParams = Promise.resolve({ id: "doc-1" });

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/documents/doc-1/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/documents/[id]/share", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(authUser);
    mockRequireDocumentOwner.mockReturnValue({ id: "doc-1", ownerId: "u1" });
  });

  it("returns 400 when identifier is missing", async () => {
    const res = await POST(makeRequest({}), { params: mockParams });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid permission", async () => {
    const res = await POST(
      makeRequest({ identifier: "user2", permission: "admin" }),
      { params: mockParams }
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when target user not found", async () => {
    mockGet.mockReturnValue(undefined);

    const res = await POST(
      makeRequest({ identifier: "nobody@t.com" }),
      { params: mockParams }
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when sharing with yourself", async () => {
    mockGet.mockReturnValueOnce({
      id: "u1",
      username: "owner",
      email: "owner@t.com",
    });

    const res = await POST(
      makeRequest({ identifier: "owner@t.com" }),
      { params: mockParams }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/yourself/i);
  });

  it("creates new share and returns 201", async () => {
    // Target user lookup
    mockGet.mockReturnValueOnce({
      id: "u2",
      username: "user2",
      email: "user2@t.com",
    });
    // Existing share check — none
    mockGet.mockReturnValueOnce(undefined);

    const res = await POST(
      makeRequest({ identifier: "user2@t.com", permission: "editor" }),
      { params: mockParams }
    );
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.sharedWith).toBe("u2");
    expect(body.permission).toBe("editor");
    expect(body.user.username).toBe("user2");
  });

  it("updates existing share permission", async () => {
    // Target user lookup
    mockGet.mockReturnValueOnce({
      id: "u2",
      username: "user2",
      email: "user2@t.com",
    });
    // Existing share — found
    mockGet.mockReturnValueOnce({
      id: "share-1",
      documentId: "doc-1",
      sharedWith: "u2",
      permission: "viewer",
    });

    const res = await POST(
      makeRequest({ identifier: "user2@t.com", permission: "editor" }),
      { params: mockParams }
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.permission).toBe("editor");
  });
});
