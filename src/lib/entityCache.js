// Light in-memory cache for entity list/filter results so revisiting a page
// shows the previous data instantly while a fresh fetch runs in the background.
const cache = new Map();
const TTL = 90000; // 90s

export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL) return null;
  return entry.data;
}

export function setCached(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

export function invalidate(key) {
  cache.delete(key);
}

export function invalidateAll() {
  cache.clear();
}

// Helper: run an async fetch, seeding state from cache first (no spinner on repeat
// visits). Returns the fresh result and caches it under `key`.
export async function loadCached(key, fetcher, apply) {
  const cached = getCached(key);
  if (cached) apply(cached);
  try {
    const fresh = await fetcher();
    setCached(key, fresh);
    apply(fresh);
    return fresh;
  } finally {
    // caller controls loading flag
  }
}
