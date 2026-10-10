-- Dönerrangliste Aachen – D1 schema
CREATE TABLE IF NOT EXISTS restaurants (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL,
  address TEXT NOT NULL,
  website TEXT
);

-- One row per device per restaurant per month. The device hash is an HMAC of a random
-- device UUID + month, so it rotates monthly and voters can't be linked across months.
-- IP addresses are not used or stored.
CREATE TABLE IF NOT EXISTS votes (
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
  month         TEXT    NOT NULL,           -- 'YYYY-MM' (Europe/Berlin)
  device_hash   TEXT    NOT NULL,
  value         INTEGER NOT NULL CHECK (value IN (-1, 1))
);
CREATE UNIQUE INDEX IF NOT EXISTS votes_dev ON votes (restaurant_id, month, device_hash);
CREATE INDEX IF NOT EXISTS votes_month ON votes (month);

-- Running REAL score per restaurant per month (can go below -1; clamped only for display).
CREATE TABLE IF NOT EXISTS scores (
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
  month         TEXT    NOT NULL,
  score         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (restaurant_id, month)
);

-- Frozen top 5 of every finished month / year (filled automatically, see functions/api/history.js).
CREATE TABLE IF NOT EXISTS history (
  kind          TEXT    NOT NULL CHECK (kind IN ('month', 'year')),
  period        TEXT    NOT NULL,           -- 'YYYY-MM' or 'YYYY'
  rank          INTEGER NOT NULL,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
  score         INTEGER NOT NULL,
  PRIMARY KEY (kind, period, rank)
);
