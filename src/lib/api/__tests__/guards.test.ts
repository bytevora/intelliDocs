import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock database
vi.mock("@/lib/db", () => {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    get: vi.fn(),
  };
  return {
    db: {
      select: vi.fn(() => mockChain),
      _chain: mockChain,
    },
  };
});

// Mock auth
vi.mock("@/lib/auth/get-user", () => ({
  getAuthUser: vi.fn(),
}));

import {
  ApiError,
  requireAuth,
  requireAdmin,
  requireDocument,
  requireDocumentOwner,
  getSharePermission,
  requireDocumentAccess,
  handleApiError,
} from "../guards";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/get-user";

const mockDb = db as unknown as {
  select: ReturnType<typeof vi.fn>;
  _chain: {
    from: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };
};

function makeRequest(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers["authorization"] = `Bearer ${token}`;
  return new NextRequest("http://localhost:3000/api/test", { headers });
}

describe("ApiError", () => {
  it("stores status and message", () => {
    const err = new ApiError(404, "Not found");
    expect(err.status).toBe(404);
    expect(err.message).toBe("Not found");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("requireAuth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns user when authenticated", async () => {
    const user = { sub: "u1", username: "test", email: "t@t.com", role: "user" };
    vi.mocked(getAuthUser).mockResolvedValue(user);

    const result = await requireAuth(makeRequest("token"));
    expect(result).toEqual(user);
  });

  it("throws 401 when not authenticated", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);

    await expect(requireAuth(makeRequest())).rejects.toThrow(ApiError);
    try {
      await requireAuth(makeRequest());
    } catch (err) {
      expect((err as ApiError).status).toBe(401);
    }
  });
});

describe("requireAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns admin user", async () => {
    const admin = { sub: "a1", username: "admin", email: "a@t.com", role: "admin" };
    vi.mocked(getAuthUser).mockResolvedValue(admin);

    const result = await requireAdmin(makeRequest("token"));
    expect(result).toEqual(admin);
  });

  it("throws 403 for non-admin", async () => {
    const user = { sub: "u1", username: "test", email: "t@t.com", role: "user" };
    vi.mocked(getAuthUser).mockResolvedValue(user);

    try {
      await requireAdmin(makeRequest("token"));
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as ApiError).status).toBe(403);
    }
  });
});

describe("requireDocument", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns document when found", () => {
    const doc = { id: "d1", title: "Test", ownerId: "u1" };
    mockDb._chain.get.mockReturnValue(doc);

    const result = requireDocument("d1");
    expect(result).toEqual(doc);
  });

  it("throws 404 when not found", () => {
    mockDb._chain.get.mockReturnValue(undefined);

    try {
      requireDocument("nonexistent");
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as ApiError).status).toBe(404);
    }
  });
});

describe("requireDocumentOwner", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns document when user is owner", () => {
    const doc = { id: "d1", title: "Test", ownerId: "u1" };
    mockDb._chain.get.mockReturnValue(doc);

    const result = requireDocumentOwner("d1", "u1");
    expect(result).toEqual(doc);
  });

  it("throws 403 when user is not owner", () => {
    const doc = { id: "d1", title: "Test", ownerId: "u1" };
    mockDb._chain.get.mockReturnValue(doc);

    try {
      requireDocumentOwner("d1", "u2");
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as ApiError).status).toBe(403);
    }
  });
});

describe("getSharePermission", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns permission when share exists", () => {
    mockDb._chain.get.mockReturnValue({ permission: "editor" });
    expect(getSharePermission("d1", "u1")).toBe("editor");
  });

  it("returns null when no share exists", () => {
    mockDb._chain.get.mockReturnValue(undefined);
    expect(getSharePermission("d1", "u1")).toBeNull();
  });
});

describe("requireDocumentAccess", () => {
  beforeEach(() => vi.clearAllMocks());

  it("grants owner access for any permission level", () => {
    const doc = { id: "d1", title: "Test", ownerId: "u1" };
    mockDb._chain.get.mockReturnValue(doc);

    const result = requireDocumentAccess("d1", "u1", "owner");
    expect(result.permission).toBe("owner");
  });

  it("denies non-owner when owner permission required", () => {
    const doc = { id: "d1", title: "Test", ownerId: "u1" };
    mockDb._chain.get.mockReturnValue(doc);

    try {
      requireDocumentAccess("d1", "u2", "owner");
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as ApiError).status).toBe(403);
    }
  });

  it("grants editor access via share", () => {
    const doc = { id: "d1", title: "Test", ownerId: "u1" };
    // First call: requireDocument, second call: getSharePermission
    mockDb._chain.get
      .mockReturnValueOnce(doc)
      .mockReturnValueOnce({ permission: "editor" });

    const result = requireDocumentAccess("d1", "u2", "editor");
    expect(result.permission).toBe("editor");
  });

  it("denies viewer when editor permission required", () => {
    const doc = { id: "d1", title: "Test", ownerId: "u1" };
    mockDb._chain.get
      .mockReturnValueOnce(doc)
      .mockReturnValueOnce({ permission: "viewer" });

    try {
      requireDocumentAccess("d1", "u2", "editor");
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as ApiError).status).toBe(403);
    }
  });

  it("denies user with no share", () => {
    const doc = { id: "d1", title: "Test", ownerId: "u1" };
    mockDb._chain.get
      .mockReturnValueOnce(doc)
      .mockReturnValueOnce(undefined);

    try {
      requireDocumentAccess("d1", "u2", "viewer");
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as ApiError).status).toBe(403);
    }
  });
});

describe("handleApiError", () => {
  it("converts ApiError to JSON response", () => {
    const response = handleApiError(new ApiError(404, "Not found"));
    expect(response.status).toBe(404);
  });

  it("re-throws unknown errors", () => {
    expect(() => handleApiError(new Error("unknown"))).toThrow("unknown");
  });
});
