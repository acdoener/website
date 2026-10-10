// Shared helpers for the Pages Functions.

export const TZ = 'Europe/Berlin';

export function currentMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' })
    .formatToParts(date);
  const y = parts.find((p) => p.type === 'year').value;
  const m = parts.find((p) => p.type === 'month').value;
  return `${y}-${m}`;
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Identify the voter by a random device UUID. The browser keeps it in a cookie AND in
 * localStorage (sent as X-Device-Id), so clearing only one of them doesn't reset the voter.
 * The stored hash includes the month, so it changes monthly (= the monthly reset).
 * IP addresses are not used at all.
 */
export async function identify(request, env, month) {
  if (!env.VOTE_SECRET) throw new Error('VOTE_SECRET is not configured');
  const fromCookie = readCookie(request, 'dv');
  const fromHeader = (request.headers.get('x-device-id') || '').toLowerCase();
  let token = [fromCookie, fromHeader].find((v) => v && UUID_RE.test(v));
  if (!token) token = crypto.randomUUID();
  const setCookie = fromCookie === token ? null
    : `dv=${token}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`;
  return { token, deviceHash: await hmac(env.VOTE_SECRET, `dev|${month}|${token}`), setCookie };
}

/** Response headers: no-store + (re)set cookie + echo the effective device id for localStorage. */
export function idHeaders({ token, setCookie }) {
  const h = { 'cache-control': 'no-store', 'x-device-id': token };
  if (setCookie) h['set-cookie'] = setCookie;
  return h;
}

/** Reddit-style display: everyone sees at least -1. */
export const clamp = (n) => Math.max(-1, n);

// ---- tiny edge cache (per data centre) to save D1 reads on the free tier ----
const cacheKey = (request, name) => new Request(new URL(`/__cache/${name}`, request.url).toString());

export async function cached(request, name, ttl, producer) {
  const cache = caches.default;
  const key = cacheKey(request, name);
  const hit = await cache.match(key);
  if (hit) return hit;
  const body = await producer();
  const res = json(body, 200, { 'cache-control': `public, max-age=0, s-maxage=${ttl}` });
  await cache.put(key, res.clone());
  return res;
}

export async function purge(request, names) {
  await Promise.all(names.map((n) => caches.default.delete(cacheKey(request, n))));
}
