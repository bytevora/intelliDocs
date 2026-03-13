import { describe, it, expect, beforeAll } from "vitest";

// Set env vars before importing jwt module
beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-key-for-vitest-at-least-32-chars";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-for-vitest-at-least-32";
});

describe("jwt", () => {
  it("signs and verifies an access token", async () => {
    const { signAccessToken, verifyAccessToken } = await import("../jwt");

    const payload = {
      sub: "user-123",
      username: "testuser",
      email: "test@example.com",
      role: "user",
    };

    const token = await signAccessToken(payload);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);

    const verified = await verifyAccessToken(token);
    expect(verified.sub).toBe("user-123");
    expect(verified.username).toBe("testuser");
    expect(verified.email).toBe("test@example.com");
    expect(verified.role).toBe("user");
  });

  it("signs and verifies a refresh token", async () => {
    const { signRefreshToken, verifyRefreshToken } = await import("../jwt");

    const token = await signRefreshToken("user-456");
    expect(typeof token).toBe("string");

    const verified = await verifyRefreshToken(token);
    expect(verified.sub).toBe("user-456");
  });

  it("rejects a tampered access token", async () => {
    const { signAccessToken, verifyAccessToken } = await import("../jwt");

    const token = await signAccessToken({
      sub: "user-789",
      username: "hacker",
      email: "h@x.com",
      role: "admin",
    });

    // Tamper with the token payload
    const parts = token.split(".");
    parts[1] = parts[1] + "x";
    const tampered = parts.join(".");

    await expect(verifyAccessToken(tampered)).rejects.toThrow();
  });
});
