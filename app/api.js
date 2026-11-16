// make.fun's public API, read-only GET, CORS open to any origin.
// Every answer is cached in memory and revalidated with its ETag: a repeat
// fetch inside the same minute sends If-None-Match and the API answers 304
// with no body, so a view that is re-opened costs one tiny round trip instead
// of a full download. The cache also answers instantly for 60 seconds.

const API = 'https://make.fun/api';

/** path -> { etag, body, at } */
const cache = new Map();

export function cacheStats() {
  return { entries: cache.size };
}

/**
 * GET a public API path. Returns { data, fromCache, revalidated, ageMs }.
 * fromCache is true when the body came from the cache (fresh or 304);
 * revalidated is true when the server answered 304 to our If-None-Match.
 */
export async function get(path) {
  const now = Date.now();
  const hit = cache.get(path);
  if (hit && now - hit.at < 60000) {
    return { data: hit.body, fromCache: true, revalidated: false, ageMs: now - hit.at };
  }
  const headers = {};
  if (hit && hit.etag) headers['If-None-Match'] = hit.etag;
  const res = await fetch(API + path, { headers });
  if (res.status === 304 && hit) {
    hit.at = now;
    return { data: hit.body, fromCache: true, revalidated: true, ageMs: 0 };
  }
  if (!res.ok) {
    const error = new Error(`make.fun API ${res.status} for ${path}`);
    error.status = res.status;
    throw error;
  }
  const body = await res.json();
  cache.set(path, { etag: res.headers.get('ETag'), body, at: now });
  return { data: body, fromCache: false, revalidated: false, ageMs: 0 };
}

/** The board: live competitions, with pot, fee and deadline on each item. */
export const getBoard = () => get('/competitions?status=open&activity=times');

/** One bounty, by slug. */
export const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

/** A bounty's leaderboard: columns plus ranked entries. */
export const getLeaderboard = (slug) => get(`/competitions/${encodeURIComponent(slug)}/leaderboard`);

/** An account's public profile, by handle. */
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);

/** Top accounts by prizes won. */
export const getRankings = () => get('/rankings');

/** A one-line cache note for a view, e.g. "Served from cache · revalidated". */
export function cacheNote(result) {
  if (!result) return '';
  if (result.revalidated) return 'Served from cache · revalidated with the server (304)';
  if (result.fromCache) return `Served from cache · ${Math.round(result.ageMs / 1000)}s old`;
  return 'Live from the API';
}
