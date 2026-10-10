import { cached, clamp, currentMonth, json } from '../_lib/util.js';

const SQL = {
  month: `SELECT r.id, r.name, r.address, r.website, COALESCE(s.score, 0) AS raw
          FROM restaurants r
          LEFT JOIN scores s ON s.restaurant_id = r.id AND s.month = ?1`,
  year: `SELECT r.id, r.name, r.address, r.website, COALESCE(s.score, 0) AS raw
         FROM restaurants r
         LEFT JOIN (SELECT restaurant_id, SUM(score) AS score FROM scores
                    WHERE month LIKE ?1 GROUP BY restaurant_id) s ON s.restaurant_id = r.id`,
  all: `SELECT r.id, r.name, r.address, r.website, COALESCE(s.score, 0) AS raw
        FROM restaurants r
        LEFT JOIN (SELECT restaurant_id, SUM(score) AS score FROM scores
                   GROUP BY restaurant_id) s ON s.restaurant_id = r.id`,
};

// GET /api/ranking?period=month|year|all   -> live ranking for the CURRENT month / year / all time
export async function onRequestGet({ request, env }) {
  const period = new URL(request.url).searchParams.get('period');
  if (!SQL[period]) return json({ error: 'bad period' }, 400);

  return cached(request, `ranking-${period}`, 30, async () => {
    const month = currentMonth();
    const bind = period === 'month' ? month : period === 'year' ? `${month.slice(0, 4)}-%` : null;
    const stmt = env.DB.prepare(SQL[period]);
    const { results } = await (bind === null ? stmt : stmt.bind(bind)).all();

    results.sort((a, b) => b.raw - a.raw || a.name.localeCompare(b.name, 'de'));
    return {
      period,
      month,
      items: results.map(({ raw, ...r }) => ({
        ...r,
        score: clamp(raw),
        deep: raw < -1, // true score is hidden below the -1 floor (used for the voter's own display)
      })),
    };
  });
}
