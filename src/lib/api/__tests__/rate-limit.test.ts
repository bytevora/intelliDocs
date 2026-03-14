import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { checkRateLimit, rateLimit, _resetStore, _store } from "../rate-limit";
import { ApiError } from "../guards";
import { NextRequest } from "next/server";

function makeRequest(ip = "127.0.0.1"): NextRequest {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
}

describe("rate-limit", () => {
  beforeEach(() => {
    _resetStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("checkRateLimit", () => {
    it("allows requests under the limit", () => {
      const config = { windowMs: 60_000, maxRequests: 3 };
      for (let i = 0; i < 3; i++) {
        const result = checkRateLimit("test-key", config);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2 - i);
      }
    });

    it("blocks requests over the limit", () => {
      const config = { windowMs: 60_000, maxRequests: 2 };
      checkRateLimit("test-key", config);
      checkRateLimit("test-key", config);
      const result = checkRateLimit("test-key", config);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("resets after window expires", () => {
      const config = { windowMs: 60_000, maxRequests: 1 };
      checkRateLimit("test-key", config);

      // Second request in same window should be blocked
      let result = checkRateLimit("test-key", config);
      expect(result.allowed).toBe(false);

      // Advance past the window
      vi.advanceTimersByTime(60_001);

      result = checkRateLimit("test-key", config);
      expect(result.allowed).toBe(true);
    });

    it("tracks independent keys separately", () => {
      const config = { windowMs: 60_000, maxRequests: 1 };
      const r1 = checkRateLimit("key-a", config);
      const r2 = checkRateLimit("key-b", config);
      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);

      // Both are now at limit
      expect(checkRateLimit("key-a", config).allowed).toBe(false);
      expect(checkRateLimit("key-b", config).allowed).toBe(false);
    });
  });

  describe("rateLimit", () => {
    it("throws ApiError with 429 when limit exceeded", () => {
      const config = { windowMs: 60_000, maxRequests: 1 };
      const req = makeRequest();

      // First request should pass
      expect(() => rateLimit(req, config, "test")).not.toThrow();

      // Second should throw 429
      try {
        rateLimit(req, config, "test");
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(429);
        expect(apiErr.headers).toBeDefined();
        expect(apiErr.headers!["Retry-After"]).toBeDefined();
        expect(apiErr.headers!["X-RateLimit-Limit"]).toBe("1");
        expect(apiErr.headers!["X-RateLimit-Remaining"]).toBe("0");
      }
    });

    it("uses different keys for different IPs", () => {
      const config = { windowMs: 60_000, maxRequests: 1 };
      const req1 = makeRequest("1.2.3.4");
      const req2 = makeRequest("5.6.7.8");

      expect(() => rateLimit(req1, config, "test")).not.toThrow();
      expect(() => rateLimit(req2, config, "test")).not.toThrow();
    });
  });

  describe("cleanup", () => {
    it("removes expired entries on cleanup interval", () => {
      const config = { windowMs: 60_000, maxRequests: 5 };
      checkRateLimit("cleanup-test", config);
      expect(_store.size).toBeGreaterThan(0);

      // Advance past window + cleanup interval
      vi.advanceTimersByTime(60_001 + 60_001);

      expect(_store.size).toBe(0);
    });
  });
});
