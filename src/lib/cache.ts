import Redis from "ioredis";

let redis: Redis | null = null;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, { lazyConnect: true });
  redis.on("error", () => { redis = null; });
}

const TTL = 300; // 5 minutes

export async function getCached<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const val = await redis.get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch {
    return null;
  }
}

export async function setCached(key: string, data: unknown): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(data), "EX", TTL);
  } catch {
    // silently fail — cache is optional
  }
}
