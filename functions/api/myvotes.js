import { currentMonth, identify, idHeaders, json } from '../_lib/util.js';

// GET /api/myvotes -> this device's votes of the current month: { votes: { "<restaurantId>": 1 | -1 } }
export async function onRequestGet({ request, env }) {
  const month = currentMonth();
  const who = await identify(request, env, month);
  const { results } = await env.DB
    .prepare('SELECT restaurant_id, value FROM votes WHERE month = ?1 AND device_hash = ?2')
    .bind(month, who.deviceHash).all();
  const votes = {};
  for (const r of results) votes[r.restaurant_id] = r.value;
  return json({ month, votes }, 200, idHeaders(who));
}
