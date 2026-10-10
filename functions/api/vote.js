import { clamp, currentMonth, identify, idHeaders, json, purge } from '../_lib/util.js';

// POST /api/vote  { restaurantId: number, value: 1 | -1 | 0 }
//   value is the voter's DESIRED state (0 = take the vote back), exactly like Reddit.
//   One vote per restaurant per month per device (UUID). Votes always count for the current month.
export async function onRequestPost({ request, env }) {
  // Basic CSRF protection: same-origin JSON only.
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return json({ error: 'forbidden' }, 403);
  if (!(request.headers.get('content-type') || '').includes('application/json')) {
    return json({ error: 'bad content type' }, 415);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  const id = Number(body.restaurantId);
  const value = Number(body.value);
  if (!Number.isInteger(id) || ![1, -1, 0].includes(value)) return json({ error: 'bad input' }, 400);

  const exists = await env.DB.prepare('SELECT 1 FROM restaurants WHERE id = ?1').bind(id).first();
  if (!exists) return json({ error: 'unknown restaurant' }, 404);

  const month = currentMonth();
  const who = await identify(request, env, month);
  const db = env.DB;

  // The voter's existing row for this restaurant+month.
  const mine = `SELECT rowid FROM votes WHERE restaurant_id = ?1 AND month = ?2 AND device_hash = ?3`;

  // Everything below runs as ONE atomic batch (a transaction), so the score can never drift
  // from the votes, even with concurrent requests.
  const batch = [
    // 1) score += new vote - old vote (old vote read BEFORE it is changed)
    db.prepare(
      `INSERT INTO scores (restaurant_id, month, score)
       VALUES (?1, ?2, ?4 - COALESCE((SELECT value FROM votes WHERE rowid = (${mine})), 0))
       ON CONFLICT (restaurant_id, month) DO UPDATE SET score = score + excluded.score`
    ).bind(id, month, who.deviceHash, value),
  ];
  if (value === 0) {
    batch.push(db.prepare(`DELETE FROM votes WHERE rowid = (${mine})`).bind(id, month, who.deviceHash));
  } else {
    // 2) change an existing vote ...
    batch.push(db.prepare(`UPDATE votes SET value = ?4 WHERE rowid = (${mine})`)
      .bind(id, month, who.deviceHash, value));
    // 3) ... or create the first one
    batch.push(db.prepare(
      `INSERT INTO votes (restaurant_id, month, device_hash, value)
       SELECT ?1, ?2, ?3, ?4
       WHERE NOT EXISTS (SELECT 1 FROM votes WHERE restaurant_id = ?1 AND month = ?2 AND device_hash = ?3)`
    ).bind(id, month, who.deviceHash, value));
  }
  // housekeeping: old voter rows are only needed during their month
  if (Math.random() < 0.02) batch.push(db.prepare('DELETE FROM votes WHERE month < ?1').bind(month));

  try {
    await db.batch(batch);
  } catch (e) {
    return json({ error: 'conflict, please retry' }, 409);
  }

  const row = await db.prepare(
    `SELECT COALESCE(SUM(CASE WHEN month = ?1 THEN score END), 0) AS m,
            COALESCE(SUM(CASE WHEN month LIKE ?2 THEN score END), 0) AS y,
            COALESCE(SUM(score), 0) AS a
     FROM scores WHERE restaurant_id = ?3`
  ).bind(month, `${month.slice(0, 4)}-%`, id).first();

  await purge(request, ['ranking-month', 'ranking-year', 'ranking-all']);

  const shape = (raw) => ({ score: clamp(raw), deep: raw < -1 });
  return json({ ok: true, id, value, scores: { month: shape(row.m), year: shape(row.y), all: shape(row.a) } }, 200, idHeaders(who));
}
