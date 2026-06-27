import { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

class RateLimiterMemory {
  private store = new Map<string, number[]>();
  private windowMs: number;
  private max: number;

  constructor(windowMs: number, max: number) {
    this.windowMs = windowMs;
    this.max = max;
  }

  public check(key: string): RateLimitResult {
    const now = Date.now();
    
    // Memory Optimization: Prune older entries if size gets large
    if (this.store.size > 5000) {
      for (const [k, timestamps] of this.store.entries()) {
        const filtered = timestamps.filter(t => now - t < this.windowMs);
        if (filtered.length === 0) {
          this.store.delete(k);
        } else {
          this.store.set(k, filtered);
        }
      }
    }

    const timestamps = this.store.get(key) || [];
    const valid = timestamps.filter(t => now - t < this.windowMs);

    if (valid.length >= this.max) {
      const oldest = valid[0];
      const reset = Math.ceil((oldest + this.windowMs) / 1000); // Reset time as Unix timestamp (seconds)
      return {
        success: false,
        limit: this.max,
        remaining: 0,
        reset
      };
    }

    valid.push(now);
    this.store.set(key, valid);

    return {
      success: true,
      limit: this.max,
      remaining: this.max - valid.length,
      reset: Math.ceil((now + this.windowMs) / 1000)
    };
  }
}

// Global registry of memory limiters & Upstash instances to prevent re-instantiation across dev reloads
const globalForLimiter = globalThis as unknown as {
  limiters: Record<string, RateLimiterMemory>;
  upstashLimiters: Record<string, Ratelimit>;
};

if (!globalForLimiter.limiters) {
  globalForLimiter.limiters = {};
}
if (!globalForLimiter.upstashLimiters) {
  globalForLimiter.upstashLimiters = {};
}

// Initialize Upstash Redis if env vars are present
const isUpstashConfigured = 
  !!process.env.UPSTASH_REDIS_REST_URL && 
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

let redisClient: Redis | null = null;
if (isUpstashConfigured) {
  try {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL || "",
      token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
    });
  } catch (err) {
    console.error("Failed to initialize Upstash Redis:", err);
  }
}

/**
 * Checks rate limit using Upstash if configured, otherwise falls back to memory.
 */
export async function checkRateLimit(
  name: string,
  key: string,
  windowMs: number,
  max: number
): Promise<RateLimitResult> {
  const fullKey = `${name}:${key}`;

  if (isUpstashConfigured && redisClient) {
    try {
      const cacheKey = `${name}:${windowMs}:${max}`;
      if (!globalForLimiter.upstashLimiters[cacheKey]) {
        globalForLimiter.upstashLimiters[cacheKey] = new Ratelimit({
          redis: redisClient,
          limiter: Ratelimit.slidingWindow(max, `${windowMs} ms`),
          analytics: true,
          prefix: `@upstash/ratelimit:${name}`,
        });
      }

      const ratelimit = globalForLimiter.upstashLimiters[cacheKey];
      const result = await ratelimit.limit(fullKey);

      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: Math.ceil(result.reset / 1000), // convert to Unix timestamp in seconds
      };
    } catch (err) {
      console.warn("Upstash Rate Limiting failed, falling back to Memory:", err);
    }
  }

  // Memory Fallback
  const memoryLimiterKey = `${name}:${windowMs}:${max}`;
  if (!globalForLimiter.limiters[memoryLimiterKey]) {
    globalForLimiter.limiters[memoryLimiterKey] = new RateLimiterMemory(windowMs, max);
  }
  return globalForLimiter.limiters[memoryLimiterKey].check(key);
}

/**
 * Resolves the client IP address from request headers.
 */
export function getClientIp(req: NextRequest | Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}
