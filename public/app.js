'use strict';

// ---- configuration ----------------------------------------------------------
// Tally: take the ID from your form URL (https://tally.so/r/<ID>) and paste it here.
const TALLY_FORM_ID = '44WkRB';

// ---- translations -----------------------------------------------------------
const I18N = {
  de: {
    tagline: 'Die besten Döner der Kaiserstadt',
    tab_month: 'Monat', tab_year: 'Jahr', tab_all: 'Gesamt', tab_history: 'Historie', tab_request: 'Anfragen',
    h_month: (m) => `Ranking ${m}`, h_year: (y) => `Ranking ${y}`, h_all: 'Gesamtranking',
    s_month: 'Startet am 1. jedes Monats neu. Jetzt wieder abstimmen, wenn ein neuer Monat beginnt.',
    s_year: 'Summe aller Monatswertungen dieses Jahres. Deine Stimme gilt für den aktuellen Monat.',
    s_all: 'Summe aller Stimmen seit Beginn. Deine Stimme gilt für den aktuellen Monat.',
    search: 'Dönerladen oder Straße suchen …', shops: (n, t) => (n === t ? `${t} Läden` : `${n} von ${t} Läden`),
    none: 'Nichts gefunden. Fehlt ein Laden? Schick uns eine Anfrage.', loading: 'Lädt …', error: 'Konnte nicht geladen werden. Bitte später erneut versuchen.',
    up: (n) => `Hochwählen: ${n}`, down: (n) => `Runterwählen: ${n}`, website: 'Webseite',
    vote_err: 'Stimme konnte nicht gespeichert werden. Bitte nochmal versuchen.',
    h_hist: 'Historie', s_hist: 'Die Top 5 jedes abgeschlossenen Monats und Jahres.',
    months: 'Monate', years: 'Jahre', hist_empty_m: 'Noch kein Monat abgeschlossen. Die ersten Sieger erscheinen nach dem Monatswechsel.',
    hist_empty_y: 'Noch kein Jahr abgeschlossen.', pts: (n) => `${n > 0 ? '+' : ''}${n}`,
    h_request: 'Anfragen', s_request: 'Dönerladen fehlt, falsche Adresse oder geschlossen? Gib uns Bescheid.',
    tally_missing: 'Das Formular ist noch nicht verknüpft (Tally-ID in app.js eintragen).',
    how_title: 'So funktioniert die Abstimmung',
    how: [
      'Kein Konto nötig. Pro Dönerladen und Monat gibt es eine Stimme pro Person (▲ hoch, ▼ runter). Du kannst sie ändern oder zurücknehmen.',
      'Jeden Monat wird zurückgesetzt: Am 1. darfst du bei jedem Laden neu abstimmen.',
      'Monatsranking = Stimmen dieses Monats. Jahresranking = Summe der Monate. Gesamt = Summe aller Stimmen. Jede Stimme zählt für alle drei.',
    ],
    contact_title: 'Kontakt', missing: 'Laden fehlt oder stimmt etwas nicht?', missing_link: 'Zum Anfrageformular',
    privacy: 'Datenschutz: Dein Gerät bekommt eine zufällige Geräte-ID (UUID), gespeichert als technisch nötiges Cookie und im lokalen Speicher. Auf dem Server liegt nur ein monatlich wechselnder Hash davon. Keine IP-Adressen, keine Konten.',
    privacy_link: 'Datenschutzerklärung',
  },
  en: {
    tagline: 'The best döner of the Kaiserstadt',
    tab_month: 'Month', tab_year: 'Year', tab_all: 'All time', tab_history: 'History', tab_request: 'Requests',
    h_month: (m) => `Ranking ${m}`, h_year: (y) => `Ranking ${y}`, h_all: 'All-time ranking',
    s_month: 'Resets on the 1st of every month. Vote again when a new month starts.',
    s_year: "Sum of all monthly scores this year. Your vote counts for the current month.",
    s_all: 'Sum of all votes ever. Your vote counts for the current month.',
    search: 'Search döner shop or street …', shops: (n, t) => (n === t ? `${t} shops` : `${n} of ${t} shops`),
    none: 'Nothing found. Missing a shop? Send us a request.', loading: 'Loading …', error: 'Could not load. Please try again later.',
    up: (n) => `Upvote ${n}`, down: (n) => `Downvote ${n}`, website: 'Website',
    vote_err: 'Could not save your vote. Please try again.',
    h_hist: 'History', s_hist: 'The top 5 of every finished month and year.',
    months: 'Months', years: 'Years', hist_empty_m: 'No month finished yet. The first winners appear after the month changes.',
    hist_empty_y: 'No year finished yet.', pts: (n) => `${n > 0 ? '+' : ''}${n}`,
    h_request: 'Requests', s_request: 'Shop missing, wrong address or closed? Let us know.',
    tally_missing: 'The form is not connected yet (set the Tally ID in app.js).',
    how_title: 'How voting works',
    how: [
      'No account needed. You get one vote per döner shop and month per person (▲ up, ▼ down). You can change or withdraw it.',
      'Everything resets monthly: on the 1st you can vote on every shop again.',
      'Monthly ranking = votes of this month. Yearly ranking = sum of the months. All time = sum of all votes. Each vote counts towards all three.',
    ],
    contact_title: 'Contact', missing: 'Shop missing or something wrong?', missing_link: 'Open the request form',
    privacy: 'Privacy: your device gets a random device ID (UUID), kept as a strictly necessary cookie and in local storage. The server only stores a hash of it that changes every month. No IP addresses, no accounts.',
    privacy_link: 'Privacy Policy',
  },
};

// ---- state ------------------------------------------------------------------
const PERIODS = ['month', 'year', 'all'];
const ROUTES = [...PERIODS, 'history', 'request', 'privacy', 'datenschutz'];
let lang = 'de';
try { const s = localStorage.getItem('lang'); if (s === 'de' || s === 'en') lang = s; } catch { }
const t = (k, ...a) => { const v = I18N[lang][k]; return typeof v === 'function' ? v(...a) : v; };

const data = { month: null, year: null, all: null, history: null };
let myVotes = {};            // restaurantId -> 1 | -1 (current month)
let query = '';
let histKind = 'months';
let renderToken = 0;

const $ = (sel) => document.querySelector(sel);
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}
const svg = (d) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'currentColor'); s.setAttribute('aria-hidden', 'true'); const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); s.append(p); return s; };
const ARROW_UP = 'M12 3 3 14h5.5v7h7v-7H21z';
const ARROW_DOWN = 'M12 21 21 10h-5.5V3h-7v7H3z';
const SEARCH = 'M10 2a8 8 0 0 1 6.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1 1 10 2zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z';

const fold = (s) => s.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '');
const monthName = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 15).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { month: 'long', year: 'numeric' }); };

function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 3200);
}

// Random device UUID, kept in localStorage (and mirrored by the server in a cookie).
let deviceId = null;
try { deviceId = localStorage.getItem('deviceId'); } catch { }
if (!deviceId) { deviceId = crypto.randomUUID(); try { localStorage.setItem('deviceId', deviceId); } catch { } }

async function api(path, opts = {}) {
  const res = await fetch(path, { cache: 'no-store', credentials: 'same-origin', ...opts, headers: { 'x-device-id': deviceId, ...(opts.headers || {}) } });
  if (!res.ok) throw new Error(String(res.status));
  const effective = res.headers.get('x-device-id');   // the server may know this device under its cookie id
  if (effective && effective !== deviceId) { deviceId = effective; try { localStorage.setItem('deviceId', effective); } catch { } }
  return res.json();
}

// ---- static text ------------------------------------------------------------
function applyStaticText() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  const how = $('#how'); how.replaceChildren(...I18N[lang].how.map((x) => h('li', {}, x)));
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
}

// ---- ranking ----------------------------------------------------------------
// What the viewer sees: everybody sees max(score, -1); a voter who downvoted a shop whose
// true score is below -1 sees -2 (Reddit-like).
const shownScore = (item) => (myVotes[item.id] === -1 && item.deep ? -2 : item.score);

function voteButtons(item) {
  const mine = myVotes[item.id] || 0;
  const score = shownScore(item);
  return h('div', { class: 'vote' },
    h('button', { class: 'up', type: 'button', 'aria-pressed': String(mine === 1), 'aria-label': t('up', item.name), onclick: () => castVote(item, 1) }, svg(ARROW_UP)),
    h('div', { class: 'score' + (score < 0 ? ' neg' : ''), 'aria-live': 'polite' }, String(score)),
    h('button', { class: 'down', type: 'button', 'aria-pressed': String(mine === -1), 'aria-label': t('down', item.name), onclick: () => castVote(item, -1) }, svg(ARROW_DOWN)));
}

async function castVote(item, dir) {
  const desired = (myVotes[item.id] || 0) === dir ? 0 : dir;
  const prev = myVotes[item.id];
  const setMine = (v) => { if (v) myVotes[item.id] = v; else delete myVotes[item.id]; };
  setMine(desired); refreshRows();
  try {
    const r = await api('/api/vote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ restaurantId: item.id, value: desired }) });
    for (const p of PERIODS) {
      const it = data[p] && data[p].items.find((x) => x.id === item.id);
      if (it) { it.score = r.scores[p].score; it.deep = r.scores[p].deep; }
    }
  } catch {
    setMine(prev); toast(t('vote_err'));
  }
  refreshRows();
}

function refreshRows() {
  document.querySelectorAll('.row[data-id]').forEach((row) => {
    const id = Number(row.dataset.id);
    const item = (data[currentRoute()] || { items: [] }).items.find((x) => x.id === id);
    if (item) row.querySelector('.vote').replaceWith(voteButtons(item));
  });
}

function rankingRow(item, rank) {
  return h('li', { class: 'row' + (rank <= 3 ? ' top3' : ''), 'data-id': item.id },
    h('div', { class: 'rank' }, String(rank)),
    h('div', { class: 'who' },
      h('div', { class: 'name' }, item.name,
        item.website ? h('a', { href: item.website, target: '_blank', rel: 'noopener noreferrer nofollow', 'aria-label': `${t('website')}: ${item.name}` }, '↗') : null),
      h('div', { class: 'addr' }, `${item.address}, Aachen`)),
    voteButtons(item));
}

function drawList(period) {
  const box = $('#rows'); const count = $('#count');
  const items = data[period].items;
  const q = fold(query.trim());
  const rows = items.map((it, i) => ({ it, rank: i + 1 }))
    .filter(({ it }) => !q || fold(it.name).includes(q) || fold(it.address).includes(q));
  count.textContent = t('shops', rows.length, items.length);
  box.replaceChildren(...(rows.length ? rows.map(({ it, rank }) => rankingRow(it, rank)) : [h('li', { class: 'empty' }, t('none'))]));
}

async function viewRanking(period, token) {
  const main = $('#main');
  main.replaceChildren(h('div', { class: 'loading' }, t('loading')));
  try {
    const [rank, mine] = await Promise.all([api(`/api/ranking?period=${period}`), api('/api/myvotes')]);
    if (token !== renderToken) return;
    data[period] = rank; myVotes = mine.votes;
  } catch {
    if (token !== renderToken) return;
    main.replaceChildren(h('div', { class: 'empty' }, t('error'))); return;
  }
  const m = data[period].month;
  const heading = period === 'month' ? t('h_month', monthName(m)) : period === 'year' ? t('h_year', m.slice(0, 4)) : t('h_all');
  const input = h('input', { type: 'search', placeholder: t('search'), 'aria-label': t('search'), autocomplete: 'off', value: query, oninput: (e) => { query = e.target.value; drawList(period); } });
  main.replaceChildren(
    h('div', { class: 'heading' }, h('h1', {}, heading), h('p', {}, t('s_' + period))),
    h('div', { class: 'search' }, svg(SEARCH), input),
    h('p', { class: 'count', id: 'count' }),
    h('ul', { class: 'list', id: 'rows' }));
  drawList(period);
}

// ---- history ----------------------------------------------------------------
async function viewHistory(token) {
  const main = $('#main');
  main.replaceChildren(h('div', { class: 'loading' }, t('loading')));
  try { data.history = await api('/api/history'); } catch {
    if (token !== renderToken) return;
    main.replaceChildren(h('div', { class: 'empty' }, t('error'))); return;
  }
  if (token !== renderToken) return;
  const draw = () => {
    const list = histKind === 'months' ? data.history.months : data.history.years;
    const cards = list.map(({ period, items }) => h('section', { class: 'hcard' },
      h('h3', {}, histKind === 'months' ? monthName(period) : period),
      h('ol', {}, items.map((r) => h('li', {},
        h('div', { class: 'rank' + '' }, String(r.rank)),
        h('div', { class: 'who' }, h('div', { class: 'name' }, r.name), h('div', { class: 'addr' }, `${r.address}, Aachen`)),
        h('div', { class: 'pts' }, t('pts', r.score)))))));
    $('#hist').replaceChildren(...(cards.length ? cards : [h('div', { class: 'empty' }, t(histKind === 'months' ? 'hist_empty_m' : 'hist_empty_y'))]));
    document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === histKind)));
  };
  main.replaceChildren(
    h('div', { class: 'heading' }, h('h1', {}, t('h_hist')), h('p', {}, t('s_hist'))),
    h('div', { class: 'seg', role: 'group' },
      h('button', { type: 'button', 'data-k': 'months', onclick: () => { histKind = 'months'; draw(); } }, t('months')),
      h('button', { type: 'button', 'data-k': 'years', onclick: () => { histKind = 'years'; draw(); } }, t('years'))),
    h('div', { class: 'hist', id: 'hist' }));
  draw();
}

// ---- Tally request form -----------------------------------------------------
function viewRequest() {
  const main = $('#main');
  const configured = TALLY_FORM_ID && !TALLY_FORM_ID.startsWith('REPLACE');
  const box = h('div', { class: 'embed' });
  if (configured) {
    const src = `https://tally.so/embed/${encodeURIComponent(TALLY_FORM_ID)}?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1`;
    box.append(h('iframe', { 'data-tally-src': src, src, loading: 'lazy', title: t('h_request') }));
    if (!document.getElementById('tally-js')) {
      const s = h('script', { id: 'tally-js', src: 'https://tally.so/widgets/embed.js', async: true });
      s.onload = () => window.Tally && window.Tally.loadEmbeds();
      document.body.append(s);
    }
  } else box.append(h('p', { class: 'notice' }, t('tally_missing')));
  main.replaceChildren(h('div', { class: 'heading' }, h('h1', {}, t('h_request')), h('p', {}, t('s_request'))), box);
}

// ---- privacy / datenschutz --------------------------------------------------
function viewPrivacy() {
  const main = $('#main');
  const isDe = lang === 'de';
  const content = isDe ? [
    h('h2', {}, '1. Verantwortliche Stelle & Kontakt'),
    h('p', {}, 'Verantwortlich für die Datenverarbeitung auf dieser Webseite ist der Betreiber von acdoener.de. Bei Fragen zum Datenschutz erreichen Sie uns unter:'),
    h('p', {}, h('strong', {}, 'E-Mail: '), h('a', { href: 'mailto:info@acdoener.de' }, 'info@acdoener.de')),

    h('h2', {}, '2. Hosting & Content Delivery Network (Cloudflare)'),
    h('p', {}, 'Diese Webseite wird über Cloudflare Pages gehostet. Anbieter ist die Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA.'),
    h('p', {}, 'Cloudflare erbringt ein weltweit verteiltes Content Delivery Network (CDN) sowie Sicherheitsfunktionen (z. B. DDoS-Schutz). Beim Aufruf dieser Webseite werden technisch erforderliche Verbindungsdaten (u. a. Ihre IP-Adresse, Zugriffszeitpunkt, aufgerufene URL, Browser-Informationen) über Server von Cloudflare übertragen.'),
    h('p', {}, 'Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer schnellen, stabilen und sicheren Auslieferung der Webseite). Die Datenübermittlung in die USA erfolgt auf Grundlage des EU-U.S. Data Privacy Frameworks sowie Standardvertragsklauseln der EU-Kommission.'),

    h('h2', {}, '3. Abstimmungssystem & Anonyme Geräte-ID'),
    h('p', {}, 'Um eine faire Rangliste ohne Registrierungszwang zu ermöglichen (1 Stimme pro Laden und Monat), wird bei Ihrem ersten Besuch eine zufällig erzeugte Geräte-ID (UUID) generiert und in Ihrem Browser gespeichert.'),
    h('ul', {},
      h('li', {}, h('strong', {}, 'Keine Klartext-Speicherung: '), 'Auf unseren Servern wird Ihre Geräte-ID niemals im Klartext gespeichert. Die ID wird zusammen mit einem monatlich wechselnden kryptografischen Geheimnis (Salt) gehasht.'),
      h('li', {}, h('strong', {}, 'Keine Zuordnung zu Personen: '), 'Wir speichern weder IP-Adressen noch Namen oder Benutzerkonten in Verbindung mit Ihren abgegebenen Stimmen.'),
      h('li', {}, h('strong', {}, 'Monatlicher Reset: '), 'Durch den monatlichen Salt-Wechsel kann eine Stimme des Vormonats nicht mehr mit einer Stimme des Folgemonats verknüpft werden.')
    ),
    h('p', {}, 'Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Manipulationssicherheit des Abstimmungssystems) sowie § 25 Abs. 2 Nr. 2 TDDDG.'),

    h('h2', {}, '4. Lokale Speicherung (Cookies & localStorage)'),
    h('p', {}, 'Wir verwenden keine Tracking-, Analyse- oder Marketing-Cookies (kein Google Analytics, keine Werbe-Pixel). Ein Cookie-Banner ist daher nicht erforderlich.'),
    h('p', {}, 'Es werden lediglich folgende technisch notwendige Werte lokal in Ihrem Browser gespeichert:'),
    h('ul', {},
      h('li', {}, h('strong', {}, 'deviceId: '), 'Zufällige UUID zur Zählung der Stimmen (Cookie und localStorage).'),
      h('li', {}, h('strong', {}, 'lang: '), 'Ihre gewählte Spracheinstellung DE/EN (localStorage).')
    ),

    h('h2', {}, '5. Kontakt & Vorschlagsformular (Tally)'),
    h('p', {}, 'Wenn Sie uns über den Bereich „Anfragen“ einen fehlenden Dönerladen vorschlagen oder eine Korrektur senden, nutzen wir hierfür das Formular von Tally (Tally BV, Muinkkaai 40, 9000 Gent, Belgien). Die von Ihnen eingegebenen Daten werden ausschließlich zur Bearbeitung des Vorschlags genutzt.'),
    h('p', {}, 'Rechtsgrundlage ist Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO.'),

    h('h2', {}, '6. Ihre Rechte gemäß DSGVO'),
    h('p', {}, 'Ihnen stehen nach der Datenschutz-Grundverordnung folgende Rechte zu:'),
    h('ul', {},
      h('li', {}, 'Recht auf Auskunft (Art. 15 DSGVO)'),
      h('li', {}, 'Recht auf Berichtigung (Art. 16 DSGVO)'),
      h('li', {}, 'Recht auf Löschung (Art. 17 DSGVO)'),
      h('li', {}, 'Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)'),
      h('li', {}, 'Recht auf Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)'),
      h('li', {}, 'Beschwerderecht bei einer zuständigen Datenschutz-Aufsichtsbehörde')
    )
  ] : [
    h('h2', {}, '1. Controller & Contact'),
    h('p', {}, 'The controller responsible for data processing on this website is the operator of acdoener.de. If you have any questions regarding privacy, please contact:'),
    h('p', {}, h('strong', {}, 'Email: '), h('a', { href: 'mailto:info@acdoener.de' }, 'info@acdoener.de')),

    h('h2', {}, '2. Hosting & Content Delivery Network (Cloudflare)'),
    h('p', {}, 'This website is hosted on Cloudflare Pages (Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA).'),
    h('p', {}, 'Cloudflare provides a global CDN and security protections (such as DDoS mitigation). Standard connection logs (including IP address, request timestamp, URL, and browser metadata) are processed to secure and deliver the service.'),
    h('p', {}, 'Legal basis: Art. 6(1)(f) GDPR (legitimate interest in reliable, fast, and secure website delivery). Data transfers to the USA are safeguarded under the EU-U.S. Data Privacy Framework and standard contractual clauses.'),

    h('h2', {}, '3. Voting System & Anonymous Device ID'),
    h('p', {}, 'To allow voting without requiring accounts (1 vote per shop per month), a random UUID device identifier is generated on your first visit and stored in your browser.'),
    h('ul', {},
      h('li', {}, h('strong', {}, 'No plaintext storage: '), 'Your raw device ID is never stored in plaintext on our servers. It is hashed together with a secret monthly cryptographic salt.'),
      h('li', {}, h('strong', {}, 'No user tracking: '), 'We do not store IP addresses, names, or user accounts linked to votes.'),
      h('li', {}, h('strong', {}, 'Monthly reset: '), 'Because the salt rotates every month, votes cannot be linked across different months.')
    ),
    h('p', {}, 'Legal basis: Art. 6(1)(f) GDPR (legitimate interest in vote integrity) and § 25(2)(2) TDDDG.'),

    h('h2', {}, '4. Local Storage & Cookies'),
    h('p', {}, 'We do not use any marketing, profiling, or tracking cookies (no Google Analytics, no tracking pixels). Therefore, no cookie consent banner is needed.'),
    h('p', {}, 'Only strictly necessary values are saved locally:'),
    h('ul', {},
      h('li', {}, h('strong', {}, 'deviceId: '), 'Random UUID for rate-limiting votes (cookie and localStorage).'),
      h('li', {}, h('strong', {}, 'lang: '), 'Selected interface language DE/EN (localStorage).')
    ),

    h('h2', {}, '5. Request Form (Tally)'),
    h('p', {}, 'If you submit a shop request or correction via the "Requests" tab, the embedded form is powered by Tally (Tally BV, Ghent, Belgium / EU). Submitted information is used only to process the request.'),
    h('p', {}, 'Legal basis: Art. 6(1)(b) and (f) GDPR.'),

    h('h2', {}, '6. Your Rights under GDPR'),
    h('p', {}, 'Under the GDPR, you have the right to information, rectification, erasure, restriction of processing, objection, and the right to lodge a complaint with a supervisory data protection authority.')
  ];

  const doc = h('article', { class: 'doc' }, ...content);
  main.replaceChildren(
    h('div', { class: 'heading' }, h('h1', {}, isDe ? 'Datenschutzerklärung' : 'Privacy Policy'), h('p', {}, isDe ? 'Informationen zur Verarbeitung personenbezogener Daten gemäß DSGVO & TDDDG' : 'Information about data processing in accordance with GDPR & TDDDG')),
    doc
  );
}

// ---- router -----------------------------------------------------------------
function currentRoute() {
  const r = location.hash.replace(/^#\/?/, '');
  return ROUTES.includes(r) ? r : 'month';   // monthly ranking is the default page
}

function render() {
  const route = currentRoute();
  const token = ++renderToken;
  document.querySelectorAll('.tabs a').forEach((a) => (a.dataset.route === route ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  if (PERIODS.includes(route)) viewRanking(route, token);
  else if (route === 'history') viewHistory(token);
  else if (route === 'privacy' || route === 'datenschutz') viewPrivacy();
  else viewRequest();
}

window.addEventListener('hashchange', () => { query = ''; render(); window.scrollTo({ top: 0 }); });
document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
  lang = b.dataset.lang; try { localStorage.setItem('lang', lang); } catch { }
  applyStaticText(); render();
}));

applyStaticText();
render();
