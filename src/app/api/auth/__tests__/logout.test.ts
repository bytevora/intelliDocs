import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../auth/logout/route";

vi.mock("@/lib/auth/get-user", () => ({
  getAuthUser: vi.fn(),
}));

vi.mock("@/lib/auth/jwt", () => ({
  revokeAllUserRefreshTokens: vi.fn(),
}));

import { getAuthUser } from "@/lib/auth/get-user";
import { revokeAllUserRefreshTokens } from "@/lib/auth/jwt";

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedRevoke = vi.mocked(revokeAllUserRefreshTokens);

function makeRequest(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers["authorization"] = `Bearer ${token}`;
  return new NextRequest("http://localhost/api/auth/logout", {
    method: "POST",
    headers,
  });
}

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockedGetAuthUser.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns success and revokes tokens when authenticated", async () => {
    mockedGetAuthUser.mockResolvedValue({
      sub: "user-1",
      username: "testuser",
      email: "test@example.com",
      role: "user",
    });

    const res = await POST(makeRequest("valid-token"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.message).toMatch(/logged out/i);
    expect(mockedRevoke).toHaveBeenCalledWith("user-1");
  });

  it("clears refresh_token cookie", async () => {
    mockedGetAuthUser.mockResolvedValue({
      sub: "user-1",
      username: "testuser",
      email: "test@example.com",
      role: "user",
    });

    const res = await POST(makeRequest("valid-token"));
    const cookies = res.cookies.getAll();
    const refreshCookie = cookies.find((c) => c.name === "refresh_token");
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie!.value).toBe("");
  });
});
