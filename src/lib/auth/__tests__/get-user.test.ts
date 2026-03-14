import { describe, it, expect, vi, beforeAll } from "vitest";
import { NextRequest } from "next/server";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-key-for-vitest-at-least-32-chars";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-for-vitest-at-least-32";
});

describe("getAuthUser", () => {
  it("returns payload for valid token", async () => {
    const { signAccessToken } = await import("../jwt");
    const { getAuthUser } = await import("../get-user");

    const token = await signAccessToken({
      sub: "user-1",
      username: "testuser",
      email: "test@example.com",
      role: "user",
    });

    const req = new NextRequest("http://localhost:3000/api/test", {
      headers: { authorization: `Bearer ${token}` },
    });

    const user = await getAuthUser(req);
    expect(user).not.toBeNull();
    expect(user!.sub).toBe("user-1");
    expect(user!.username).toBe("testuser");
  });

  it("returns null when no authorization header", async () => {
    const { getAuthUser } = await import("../get-user");

    const req = new NextRequest("http://localhost:3000/api/test");
    const user = await getAuthUser(req);
    expect(user).toBeNull();
  });

  it("returns null for non-Bearer header", async () => {
    const { getAuthUser } = await import("../get-user");

    const req = new NextRequest("http://localhost:3000/api/test", {
      headers: { authorization: "Basic abc123" },
    });

    const user = await getAuthUser(req);
    expect(user).toBeNull();
  });

  it("returns null for invalid token", async () => {
    const { getAuthUser } = await import("../get-user");

    const req = new NextRequest("http://localhost:3000/api/test", {
      headers: { authorization: "Bearer invalid.token.here" },
    });

    const user = await getAuthUser(req);
    expect(user).toBeNull();
  });
});
