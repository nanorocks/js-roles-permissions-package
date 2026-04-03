import type { PermissionCache } from './types';

interface CacheEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  expiry?: number;
}

/**
 * Simple in-memory cache implementation.
 *
 * All entries can optionally expire after a TTL (in seconds).
 * Call `cleanup()` periodically to remove stale entries from memory.
 */
export class InMemoryCache implements PermissionCache {
  private store = new Map<string, CacheEntry>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async get(key: string): Promise<any | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiry !== undefined && Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const expiry = ttl !== undefined ? Date.now() + ttl * 1000 : undefined;
    this.store.set(key, { value, expiry });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  /**
   * Remove all expired entries from memory.
   * Can be called periodically to keep memory usage low.
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiry !== undefined && now > entry.expiry) {
        this.store.delete(key);
      }
    }
  }
}
