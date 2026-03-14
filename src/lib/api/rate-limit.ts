import { NextRequest } from "next/server";
import { ApiError } from "./guards";
import { logger } from "@/lib/logger";

const log = logger.create("rate-limit");

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface WindowEntry {
  count: number;
  windowId: number;
}

const store = new Map<string, WindowEntry>();

// Cleanup expired entries every 60 seconds
const CLEANUP_INTERVAL = 60_000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      // Entry is expired if its window has passed
      const windowMs = parseWindowMs(key);
      if (entry.windowId < Math.floor(now / windowMs)) {
        store.delete(key);
      }
    }
    if (store.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL);
  // Don't block process exit
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

function parseWindowMs(key: string): number {
  // Window size is encoded as last segment: "prefix:ip:windowMs"
  const parts = key.split(":");
  return parseInt(parts[parts.length - 1], 10) || 60_000;
}

export function checkRateLimit(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetAt: number } {
  const windowId = Math.floor(Date.now() / config.windowMs);
  const storeKey = `${key}:${config.windowMs}`;
  const entry = store.get(storeKey);

  if (!entry || entry.windowId !== windowId) {
    store.set(storeKey, { count: 1, windowId });
    ensureCleanup();
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: (windowId + 1) * config.windowMs };
  }

  entry.count++;
  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const resetAt = (windowId + 1) * config.windowMs;

  return { allowed, remaining, resetAt };
}

function getClientIp(req: NextRequest): string {
  // Only trust proxy headers when explicitly configured (i.e. behind a reverse proxy/load balancer)
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;

    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp;
  }

  // In non-proxy setups, use the direct connection IP from Next.js
  const ip = req.ip;
  if (ip) return ip;

  // Final fallback — use a per-request unique key so "unknown" clients
  // don't all share a single rate-limit bucket
  return `unknown-${req.headers.get("user-agent") ?? "no-ua"}`;
}

export function rateLimit(req: NextRequest, config: RateLimitConfig, prefix: string): void {
  const ip = getClientIp(req);
  const key = `${prefix}:${ip}`;
  const result = checkRateLimit(key, config);

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    log.warn(`Rate limit exceeded for ${prefix}`, { ip, retryAfter });
    throw new ApiError(429, "Too many requests, please try again later", {
      "Retry-After": String(retryAfter),
      "X-RateLimit-Limit": String(config.maxRequests),
      "X-RateLimit-Remaining": "0",
    });
  }
}

// Presets
export const AUTH_LOGIN_LIMIT: RateLimitConfig = { windowMs: 60_000, maxRequests: 10 };
export const AUTH_SIGNUP_LIMIT: RateLimitConfig = { windowMs: 60_000, maxRequests: 5 };
export const AUTH_REFRESH_LIMIT: RateLimitConfig = { windowMs: 60_000, maxRequests: 10 };

// Exported for testing
export function _resetStore() {
  store.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
export { store as _store };
