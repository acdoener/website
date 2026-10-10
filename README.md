# Aachen Dönerliste

Cloudflare Pages (static site in `public/`) + Pages Functions (`functions/api/`) + D1 database. DE (default) / EN.

## Local test
```
cp .dev.vars.example .dev.vars
npm install
npm run db:local        # creates tables + loads the 58 Dönerläden
npm run dev             # http://localhost:8788 (uses .dev.vars for VOTE_SECRET)
```

## Deploy (all free tier)
1. `npx wrangler login`
2. `npx wrangler d1 create acdoener` → copy the `database_id` into `wrangler.toml`
3. `npm run db:remote` (tables + seed)
4. `npx wrangler pages project create acdoener --production-branch main`
5. `npx wrangler pages secret put VOTE_SECRET --project-name acdoener` (paste any long random string)
6. (Tally form is already set in `public/app.js`: `TALLY_FORM_ID`)
7. `npm run deploy`, then attach `acdoener.de` under Pages → Custom domains.

## Notes
- Votes always count for the current month (Europe/Berlin); monthly = that month, yearly = sum of months, total = sum of all.
- Top 5 of each finished month/year is frozen into the `history` table automatically the first time someone opens the history page after the period ended.
- Shops live in the `restaurants` table; add one with `INSERT INTO restaurants (name,address,website) VALUES (...)`.
- Recommended: add a free Cloudflare WAF rate-limiting rule for `POST /api/vote` (or Turnstile) to protect the daily write quota.
