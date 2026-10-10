import { cached, currentMonth, json } from '../_lib/util.js';

// Freeze the top 5 of every finished month / year. Votes only ever count for the current
// month, so a finished month can't change anymore. This runs lazily on request (Pages
// Functions have no cron), is idempotent, and stores ONLY the top 5 (with a score > 0).
async function finalize(db, month) {
  const year = month.slice(0, 4);
  const stmts = [];

  const { results: months } = await db.prepare(
    `SELECT DISTINCT month FROM scores WHERE month < ?1
       AND month NOT IN (SELECT period FROM history WHERE kind = 'month')`).bind(month).all();
  for (const { month: m } of months) {
    stmts.push(db.prepare(
      `INSERT OR IGNORE INTO history (kind, period, rank, restaurant_id, score)
       SELECT 'month', ?1, ROW_NUMBER() OVER (ORDER BY s.score DESC, r.name COLLATE NOCASE), s.restaurant_id, s.score
       FROM scores s JOIN restaurants r ON r.id = s.restaurant_id
       WHERE s.month = ?1 AND s.score > 0
       ORDER BY s.score DESC, r.name COLLATE NOCASE LIMIT 5`).bind(m));
  }

  const { results: years } = await db.prepare(
    `SELECT DISTINCT substr(month, 1, 4) AS y FROM scores WHERE substr(month, 1, 4) < ?1
       AND substr(month, 1, 4) NOT IN (SELECT period FROM history WHERE kind = 'year')`).bind(year).all();
  for (const { y } of years) {
    stmts.push(db.prepare(
      `INSERT OR IGNORE INTO history (kind, period, rank, restaurant_id, score)
       SELECT 'year', ?1, ROW_NUMBER() OVER (ORDER BY t.total DESC, r.name COLLATE NOCASE), t.restaurant_id, t.total
       FROM (SELECT restaurant_id, SUM(score) AS total FROM scores WHERE substr(month, 1, 4) = ?1
             GROUP BY restaurant_id HAVING SUM(score) > 0) t
       JOIN restaurants r ON r.id = t.restaurant_id
       ORDER BY t.total DESC, r.name COLLATE NOCASE LIMIT 5`).bind(y));
  }
  if (stmts.length) await db.batch(stmts);
}

// GET /api/history -> read-only top 5 of every finished month and year, newest first
export async function onRequestGet({ request, env }) {
  return cached(request, 'history', 300, async () => {
    await finalize(env.DB, currentMonth());
    const { results } = await env.DB.prepare(
      `SELECT h.kind, h.period, h.rank, h.score, r.name, r.address, r.website
       FROM history h JOIN restaurants r ON r.id = h.restaurant_id
       ORDER BY h.period DESC, h.rank`).all();
    const group = (kind) => {
      const map = new Map();
      for (const { kind: k, period, ...row } of results) {
        if (k !== kind) continue;
        if (!map.has(period)) map.set(period, []);
        map.get(period).push(row);
      }
      return [...map].map(([period, items]) => ({ period, items }));
    };
    return { months: group('month'), years: group('year') };
  });
}
