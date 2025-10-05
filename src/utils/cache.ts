import { logger } from './logger';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  set(key: string, value: T): void {
    const expiresAt = Date.now() + this.ttlMs;
    this.cache.set(key, { value, expiresAt });
    
    logger.debug({ key, ttlMs: this.ttlMs }, 'Cache entry set');
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      logger.debug({ key }, 'Cache miss - entry not found');
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      logger.debug({ key }, 'Cache miss - entry expired');
      return null;
    }

    logger.debug({ key }, 'Cache hit');
    return entry.value;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug({ key }, 'Cache entry deleted');
    }
    return deleted;
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.debug({ clearedEntries: size }, 'Cache cleared');
  }

  size(): number {
    return this.cache.size;
  }

  // Clean up expired entries
  cleanup(): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.debug({ removedCount }, 'Cache cleanup completed');
    }

    return removedCount;
  }
}

// Create cache instances
export const pairCache = new MemoryCache<any>(30 * 1000); // 30 seconds for pair cache

// Optional: Run periodic cleanup every 5 minutes
setInterval(() => {
  pairCache.cleanup();
}, 5 * 60 * 1000);