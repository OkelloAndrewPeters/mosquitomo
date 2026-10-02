import { getReading, getManyReadings, placeName, searchPlaces, nearbyFacilities, locate, store, TOWNS } from './data.js';
import { headline } from './engine.js';
import { ADVICE, REPORT_KINDS, LEARN, ACTIONS_WILL_TAKE } from './content.js';
import { enqueue, flush, hasBackend, pendingCount, logReading } from './backend.js';
import { CONFIG } from './config.js';

const $view = document.getElementById('view');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg, ms = 2600) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), ms);
}

function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? '1 hour ago' : `${h} hours ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

// ---------- places ----------
const places = {
  all: () => store.get('places', []),
  has: (lat, lon) => places.all().some((p) => Math.abs(p.lat - lat) < 0.002 && Math.abs(p.lon - lon) < 0.002),
  add(p) { const a = places.all(); a.push({ ...p, id: Date.now() }); store.set('places', a); },
  remove(lat, lon) { store.set('places', places.all().filter((p) => !(Math.abs(p.lat - lat) < 0.002 && Math.abs(p.lon - lon) < 0.002))); },
};

// ---------- router ----------
const routes = { here: viewHere, places: viewPlaces, map: viewMap, report: viewReport, learn: viewLearn, feedback: viewFeedback, care: viewCare };

function parseHash() {
  const [name, qs] = (location.hash.slice(1) || 'here').split('?');
  return { name: routes[name] ? name : 'here', params: Object.fromEntries(new URLSearchParams(qs || '')) };
}

let cleanup = null;
async function route() {
  const { name, params } = parseHash();
  if (cleanup) { cleanup(); cleanup = null; }
  const tab = name === 'feedback' || name === 'care' ? 'learn' : name;
  document.querySelectorAll('.tabs a').forEach((a) => { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  window.scrollTo(0, 0);
  await routes[name](params);
}
window.addEventListener('hashchange', route);

const go = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };

// ---------- HERE: the reading ----------
async function viewHere(params) {
  const fixed = params.lat && params.lon;
  if (fixed) {
    return showReading({ lat: +params.lat, lon: +params.lon, name: params.name, area: params.area, source: params.src || 'place' });
  }
  const last = store.get('lastLoc');
  if (!store.get('askedLocation') && !last) return welcome();
  if (last) showReading({ ...last, source: 'gps', refreshing: true });
  else $view.innerHTML = loading('Finding where you are…');
  try {
    const loc = await locate();
    const moved = !last || Math.abs(loc.lat - last.lat) > 0.005 || Math.abs(loc.lon - last.lon) > 0.005;
    store.set('lastLoc', { lat: loc.lat, lon: loc.lon });
    if (moved && parseHash().name === 'here' && !parseHash().params.lat) showReading({ lat: loc.lat, lon: loc.lon, source: 'gps' });
  } catch (e) {
    if (!last) locationProblem(e);
  }
}

function welcome() {
  $view.innerHTML = `
  <section class="state">
    <img src="icons/mark.svg" alt="" width="72" height="72">
    <h2 style="margin-top:16px">Know the risk. Beat the bite.</h2>
    <p class="muted">MosquitoMo shows the mosquito and malaria risk where you are, what is driving it, how it will change over the next 8 weeks, and what to do.</p>
    <button class="btn block" id="useLoc" style="margin-top:22px">Use my location</button>
    <a class="btn secondary block" href="#places" style="margin-top:10px">Search for a place instead</a>
    <p class="small muted" style="margin-top:14px">Your location stays on your phone. MosquitoMo only counts how many readings are checked in each area, rounded to about 1 km.</p>
  </section>`;
  document.getElementById('useLoc').onclick = () => { store.set('askedLocation', true); viewHere({}); };
}

function loading(msg) {
  return `<section class="state" aria-busy="true"><div class="spinner"></div><p class="muted">${esc(msg)}</p></section>`;
}

function locationProblem(e) {
  const denied = e && e.code === 1;
  $view.innerHTML = `
  <section class="state">
    <h2>${denied ? 'Location is turned off for MosquitoMo' : 'Could not find your location'}</h2>
    <p class="muted">${denied ? 'Allow location in your browser settings to see the risk where you are, or search for a place.' : 'Check that location is on, then try again. You can also search for a place.'}</p>
    <button class="btn block" id="retry">Try again</button>
    <a class="btn secondary block" href="#places" style="margin-top:10px">Search for a place</a>
  </section>`;
  document.getElementById('retry').onclick = () => viewHere({});
}

let readingToken = 0;
async function showReading({ lat, lon, name, area, source, refreshing }) {
  const my = ++readingToken;
  if (!refreshing || !$view.querySelector('.reading')) $view.innerHTML = `<div class="skeleton" aria-busy="true" aria-label="Loading reading"></div>`;
  try {
    const [res, nm] = await Promise.all([getReading(lat, lon), name ? { name, area: area || 'Uganda' } : placeName(lat, lon)]);
    if (my !== readingToken) return;
    renderReading({ res, place: nm, lat, lon });
    logReading(lat, lon, res.reading.score, res.reading.level.key, source);
  } catch (e) {
    if (my !== readingToken) return;
    $view.innerHTML = `
    <section class="state">
      <h2>Could not get today's weather data</h2>
      <p class="muted">MosquitoMo needs an internet connection the first time you check a place. Check your data or Wi-Fi and try again.</p>
      <button class="btn block" id="retry">Try again</button>
    </section>`;
    document.getElementById('retry').onclick = () => showReading({ lat, lon, name, area, source });
  }
}

function stripSVG(r) {
  const W = 340, H = 92, base = 74, gap = 4;
  const half = 160, bw = (half - gap * 7) / 8;
  const maxRain = Math.max(60, ...r.weeklyRain.map((w) => w.mm || 0));
  const past = r.weeklyRain.map((w, i) => {
    const h = w.mm == null ? 0 : Math.max(2, (w.mm / maxRain) * (base - 18));
    const x = i * (bw + gap);
    return `<rect x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="#8E9BD0" style="animation-delay:${i * 30}ms"><title>${w.weeksAgo === 0 ? 'This week' : w.weeksAgo + ' weeks ago'}: ${w.mm ?? '?'} mm of rain</title></rect>`;
  }).join('');
  const colors = { standard: '#2E8B57', elevated: '#E0A100', high: '#C8322B' };
  const op = { good: 1, fair: 0.78, rough: 0.5 };
  const future = r.outlook.map((o, i) => {
    const h = Math.max(4, (o.score / 100) * (base - 6));
    const x = W - half + i * (bw + gap);
    return `<rect x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${colors[o.level.key]}" opacity="${op[o.confidence]}" style="animation-delay:${350 + i * 30}ms"><title>In ${o.week} week${o.week > 1 ? 's' : ''}: ${o.score} (${o.level.name})</title></rect>`;
  }).join('');
  return `
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Rain over the past 8 weeks, and expected risk over the next 8 weeks">
    <g class="past">${past}</g>
    <line x1="${W / 2}" x2="${W / 2}" y1="4" y2="${base + 2}" stroke="#fff" stroke-width="1.5" stroke-dasharray="3 3" opacity=".7"/>
    <text x="${W / 2}" y="${base + 16}" fill="#fff" font-size="12" text-anchor="middle" font-weight="700">Today</text>
    <g class="future">${future}</g>
    <line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="rgba(255,255,255,.25)"/>
    <text x="0" y="${base + 16}" fill="#C9D0EA" font-size="12">8 wks ago</text>
    <text x="${W}" y="${base + 16}" fill="#C9D0EA" font-size="12" text-anchor="end">8 wks ahead</text>
  </svg>`;
}

function renderReading({ res, place, lat, lon }) {
  const r = res.reading;
  const lvl = r.level.key;
  const adv = ADVICE[lvl];
  const saved = places.has(lat, lon);
  const maxScore = Math.max(...r.outlook.map((o) => o.score));
  const peak = r.outlook.find((o) => o.score === maxScore);
  let trend = '';
  if (maxScore >= r.score + 8) trend = `Risk is expected to rise, peaking around ${maxScore} in about ${peak.week} week${peak.week > 1 ? 's' : ''}.`;
  else if (r.outlook[3].score <= r.score - 8) trend = `Risk is expected to ease over the next month as recent rain dries up.`;
  else trend = `Risk is expected to stay around this level for the next month.`;

  $view.innerHTML = `
  <section class="reading enter" data-level="${lvl}" aria-labelledby="placeName">
    <div class="where">
      <div>
        <div class="place" id="placeName">${esc(place.name)}</div>
        <div class="area">${esc(place.area)}</div>
      </div>
      <button class="icon-btn" id="saveBtn" aria-pressed="${saved}" aria-label="${saved ? 'Remove from My places' : 'Save to My places'}">
        <svg viewBox="0 0 24 24"><path d="M12 17.3 18.2 21l-1.6-7L22 9.2l-7.2-.6L12 2 9.2 8.6 2 9.2 7.4 14l-1.6 7z"/></svg>
      </button>
    </div>
    <div class="score-row">
      <div class="score" aria-label="MosquitoMo Index ${r.score} out of 100">${r.score}</div>
      <div class="score-meta"><span class="level-pill">${r.level.name}</span><span class="of">MosquitoMo Index, out of 100</span></div>
    </div>
    <p class="headline">${esc(headline(r))} ${esc(trend)}</p>
    <div class="strip">
      ${stripSVG(r)}
      <div class="legend"><span><b>Rain</b>, past 8 weeks</span><span><b>Risk</b>, next 8 weeks</span></div>
    </div>
    <p class="updated">${res.stale ? 'Offline. Showing the reading from ' : 'Updated '}${ago(res.at)}${res.elevation != null ? ` · ${res.elevation} m above sea level` : ''}</p>
  </section>

  <section class="panel" data-level="${lvl}">
    <h2>What to do now</h2>
    <p class="advice-summary">${esc(adv.summary)}</p>
    <ul class="todo">${adv.actions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
  </section>

  <section class="panel">
    <h2>Why it reads ${r.score}</h2>
    <ul class="drivers">${r.drivers.map((d) => `<li class="${d.up ? 'up' : 'down'}"><span class="arrow" aria-label="${d.up ? 'Raises risk' : 'Lowers risk'}">${d.up ? '↑' : '↓'}</span><span>${esc(d.text)}</span></li>`).join('')}</ul>
  </section>

  <section class="panel">
    <h2>Next 8 weeks</h2>
    <div class="outlook">${r.outlook.map((o) => `
      <div class="conf-${o.confidence}" data-level="${o.level.key}">
        <div class="bar" style="height:${Math.max(26, o.score * 1.3)}px" title="${o.level.name}, ${o.confidence} confidence">${o.score}</div>
        <div class="wk">${o.week === 1 ? '1 wk' : o.week}</div>
      </div>`).join('')}
    </div>
    <div class="outlook-key"><span>Solid: based on rain that has already fallen or is forecast</span><span>Faded: assumes recent weather continues</span></div>
  </section>

  <section class="fever">
    <div><strong>Fever? Test within 24 hours.</strong><span class="muted small">Any fever could be malaria. Testing is free at government health centres.</span></div>
    <a class="btn secondary" href="#care?lat=${lat}&lon=${lon}">Nearby</a>
  </section>

  <section class="pilot">
    <h3>You are testing an early version</h3>
    <p class="small">The index is built from weather, land and published science, and has not yet been checked against clinic records. Your feedback decides what we fix first.</p>
    <a class="btn block" href="#feedback?score=${r.score}&level=${lvl}">Give feedback (2 minutes)</a>
  </section>`;

  setTimeout(() => $view.querySelector('.reading')?.classList.remove('enter'), 1500);

  document.getElementById('saveBtn').onclick = (ev) => {
    const b = ev.currentTarget;
    if (places.has(lat, lon)) {
      places.remove(lat, lon);
      b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', 'Save to My places');
      toast('Removed from My places');
    } else {
      places.add({ name: place.name, area: place.area, lat, lon });
      b.setAttribute('aria-pressed', 'true'); b.setAttribute('aria-label', 'Remove from My places');
      toast(`Saved ${place.name} to My places`);
    }
  };
}

// ---------- PLACES ----------
function placeHref(p, src = 'place') {
  return `#here?lat=${p.lat}&lon=${p.lon}&name=${encodeURIComponent(p.name)}&area=${encodeURIComponent(p.area || '')}&src=${src}`;
}

async function viewPlaces() {
  const saved = places.all();
  $view.innerHTML = `
  <h2>Places</h2>
  <div class="search">
    <label class="sr-only" for="q">Search a village, town, school or park</label>
    <input id="q" type="search" placeholder="Village, town, school, or GPS like 0.38, 32.56" autocomplete="off" enterkeyhint="search">
  </div>
  <ul class="rows" id="results" hidden></ul>
  <h3 style="margin-top:22px">My places</h3>
  ${saved.length ? `<ul class="rows" id="saved">${saved.map((p, i) => `
    <li><a class="row" href="${placeHref(p)}"><span><span class="t">${esc(p.name)}</span><br><span class="s">${esc(p.area)}</span></span><span class="chip-score" id="ps${i}">…</span></a></li>`).join('')}</ul>`
    : `<div class="rows empty">Save home, school, the farm or a relative's village. Open a reading and tap the star.</div>`}
  `;
  const q = document.getElementById('q');
  const results = document.getElementById('results');
  let t;
  q.addEventListener('input', () => {
    clearTimeout(t);
    const v = q.value.trim();
    if (v.length < 3) { results.hidden = true; return; }
    t = setTimeout(async () => {
      results.hidden = false;
      results.innerHTML = `<li class="empty">Searching…</li>`;
      try {
        const list = await searchPlaces(v);
        if (q.value.trim() !== v) return;
        results.innerHTML = list.length
          ? list.map((p) => `<li><a class="row" href="${placeHref(p, 'search')}"><span><span class="t">${esc(p.name)}</span><br><span class="s">${esc(p.area)}</span></span><span aria-hidden="true">›</span></a></li>`).join('')
          : `<li class="empty">No places in Uganda match “${esc(v)}”. Try the parish, town or district name, or GPS coordinates inside Uganda.</li>`;
      } catch {
        results.innerHTML = `<li class="empty">Search needs an internet connection. Check your data and try again.</li>`;
      }
    }, 450);
  });
  saved.forEach(async (p, i) => {
    try {
      const res = await getReading(p.lat, p.lon);
      const el = document.getElementById('ps' + i);
      if (el) { el.textContent = res.reading.score; el.dataset.level = res.reading.level.key; el.style.background = `var(--${res.reading.level.key})`; }
    } catch { const el = document.getElementById('ps' + i); if (el) el.textContent = '–'; }
  });
}

// ---------- MAP ----------
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  return new Promise((res, rej) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'vendor/leaflet/leaflet.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = 'vendor/leaflet/leaflet.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

async function viewMap() {
  $view.innerHTML = `
  <h2>Risk across Uganda</h2>
  <p class="small muted">Readings for ${TOWNS.length} towns. Tap anywhere on the map to check that spot.</p>
  <div class="map-wrap"><div id="map" role="region" aria-label="Map of MosquitoMo readings"></div></div>
  <div class="map-legend"><span><i class="dot" style="background:var(--standard)"></i>Standard</span><span><i class="dot" style="background:var(--elevated)"></i>Elevated</span><span><i class="dot" style="background:var(--high)"></i>High</span><span><i class="dot" style="background:var(--dusk)"></i>Breeding-site report</span></div>`;
  try { await loadLeaflet(); } catch {
    document.getElementById('map').innerHTML = `<div class="state"><p class="muted">The map needs an internet connection.</p></div>`;
    return;
  }
  const L = window.L;
  const last = store.get('lastLoc');
  const map = L.map('map', { zoomControl: true, attributionControl: true }).setView([1.37, 32.29], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
  cleanup = () => map.remove();
  const colors = { standard: '#2E8B57', elevated: '#E0A100', high: '#C8322B' };
  const chip = (score, level) => L.divIcon({
    className: '',
    html: `<div style="background:${colors[level]};color:${level === 'elevated' ? '#1B1500' : '#fff'};font:800 13px/26px 'Bricolage Grotesque',sans-serif;width:30px;height:26px;border-radius:9px;text-align:center;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)">${score}</div>`,
    iconSize: [30, 26], iconAnchor: [15, 13],
  });

  map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    L.popup().setLatLng(e.latlng).setContent(`Check the reading at this spot<br><a class="btn" href="#here?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}&src=map">See reading</a>`).openOn(map);
  });

  getManyReadings(TOWNS).then((items) => {
    items.forEach((t) => L.marker([t.lat, t.lon], { icon: chip(t.score, t.level), title: `${t.name}: ${t.score}` })
      .addTo(map)
      .bindPopup(`<strong>${esc(t.name)}</strong>: ${t.score}<br><a class="btn" href="#here?lat=${t.lat}&lon=${t.lon}&name=${encodeURIComponent(t.name)}&area=Uganda&src=map">Full reading</a>`));
  }).catch(() => toast('Could not load town readings. Check your connection.'));

  places.all().forEach((p) => L.circleMarker([p.lat, p.lon], { radius: 6, color: '#fff', weight: 2, fillColor: '#3A5BD9', fillOpacity: 1 }).addTo(map).bindPopup(`<strong>${esc(p.name)}</strong> (my place)<br><a class="btn" href="${placeHref(p)}">Reading</a>`));

  if (hasBackend()) {
    fetch(`${CONFIG.SUPABASE_URL}/rest/v1/reports?select=kind,lat,lon,created_at,status,photo_url&order=created_at.desc&limit=300`, { headers: { apikey: CONFIG.SUPABASE_ANON_KEY, Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}` } })
      .then((r) => r.json())
      .then((rows) => rows.forEach((x) => x.lat && L.circleMarker([x.lat, x.lon], { radius: 5, color: '#fff', weight: 1.5, fillColor: '#1B2340', fillOpacity: 1 }).addTo(map)
        .bindPopup(`${esc(REPORT_KINDS.find((k) => k.key === x.kind)?.label || x.kind)}<br><span class="muted small">${new Date(x.created_at).toLocaleDateString('en-GB')} · ${esc(x.status)}</span>${x.photo_url ? `<br><img src="${esc(x.photo_url)}" alt="" style="width:160px;border-radius:8px;margin-top:6px">` : ''}`)))
      .catch(() => {});
  }
}

// ---------- REPORT ----------
function compressImage(file, max = 1024) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      res(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

async function viewReport() {
  let mine = store.get('myReports', []);
  if (hasBackend() && pendingCount() === 0 && mine.some((r) => !r.sent)) {
    mine = mine.map((r) => ({ ...r, sent: true }));
    store.set('myReports', mine);
  }
  $view.innerHTML = `
  <h2>Report a breeding site</h2>
  <p class="muted">Standing water that lasts a week can breed malaria mosquitoes. Reports go to the MosquitoMo map so local leaders and village health teams can act.</p>
  <form id="rep" novalidate>
    <fieldset>
      <legend>What did you see?</legend>
      <div class="chips">${REPORT_KINDS.map((k, i) => `<label><input type="radio" name="kind" value="${k.key}" ${i === 0 ? 'checked' : ''}><span>${k.label}</span></label>`).join('')}</div>
    </fieldset>
    <div>
      <span class="q" style="font-weight:700;display:block;margin-bottom:6px">Photo (optional)</span>
      <label class="photo-drop" id="drop"><span id="dropText">Tap to take a photo</span>
        <input type="file" accept="image/*" capture="environment" id="photo" aria-label="Take or choose a photo">
      </label>
    </div>
    <div>
      <span class="q" style="font-weight:700;display:block;margin-bottom:6px">Location</span>
      <p class="gps" id="gps">Finding your location…</p>
    </div>
    <div>
      <label class="q" for="note">Anything else? (optional)</label>
      <textarea id="note" maxlength="400" placeholder="For example: next to the school gate, water has been there for two weeks"></textarea>
    </div>
    <button class="btn block" id="send" type="submit" disabled>Send report</button>
  </form>
  <h3 style="margin-top:26px">Your reports</h3>
  ${mine.length ? `<ul class="rows">${mine.slice().reverse().map((r) => `<li class="row" style="cursor:default"><span><span class="t">${esc(REPORT_KINDS.find((k) => k.key === r.kind)?.label)}</span><br><span class="s">${esc(r.place || '')} · ${new Date(r.at).toLocaleDateString('en-GB')}</span></span><span class="status-tag ${r.sent ? 'sent' : ''}">${r.sent ? 'Sent' : 'Waiting to send'}</span></li>`).join('')}</ul>`
    : `<div class="rows empty">Reports you send will appear here.</div>`}
  `;
  let photo = null, pos = null, pname = '';
  const gps = document.getElementById('gps');
  const send = document.getElementById('send');
  locate().then(async (p) => {
    pos = p;
    send.disabled = false;
    gps.textContent = `Located to within about ${Math.round(p.acc)} m.`;
    const n = await placeName(p.lat, p.lon);
    pname = n.name;
    gps.textContent = `${n.name}, ${n.area} (within about ${Math.round(p.acc)} m)`;
  }).catch(() => {
    gps.innerHTML = `Location is needed to place the report on the map. Turn on location and <button type="button" class="linkish" id="regps">try again</button>.`;
    document.getElementById('regps').onclick = () => viewReport();
  });
  document.getElementById('photo').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      photo = await compressImage(f);
      const d = document.getElementById('drop');
      d.querySelector('img')?.remove();
      const im = document.createElement('img'); im.src = photo; im.alt = 'Your photo';
      d.prepend(im);
      document.getElementById('dropText').textContent = '';
    } catch { toast('That photo could not be read. Try another.'); }
  });
  document.getElementById('rep').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pos) return;
    send.disabled = true;
    const kind = new FormData(e.target).get('kind');
    const row = { kind, note: document.getElementById('note').value.trim() || null, lat: +pos.lat.toFixed(5), lon: +pos.lon.toFixed(5), accuracy_m: Math.round(pos.acc), place_name: pname, photo_data: photo };
    const list = store.get('myReports', []);
    list.push({ kind, place: pname, at: Date.now(), sent: false });
    store.set('myReports', list);
    const r = await enqueue('reports', row);
    if (hasBackend() && r.left === 0) {
      const l2 = store.get('myReports', []); l2.forEach((x) => (x.sent = true)); store.set('myReports', l2);
      toast('Report sent. Thank you.');
    } else toast('Report saved. It will send when you are online.');
    viewReport();
  });
}

// ---------- CARE ----------
async function viewCare(params) {
  const lat = +params.lat || store.get('lastLoc')?.lat, lon = +params.lon || store.get('lastLoc')?.lon;
  const fever = LEARN.find((x) => x.id === 'fever');
  $view.innerHTML = `
  <h2>Fever and care</h2>
  <section class="panel"><div class="body">${fever.body}</div></section>
  <section class="panel"><h2>Health facilities nearby</h2><div id="fac">${lat ? loading('Looking for health facilities…') : '<p class="muted">Open a reading first so MosquitoMo knows where to look.</p>'}</div>
  <p class="small muted" style="margin-top:10px">From OpenStreetMap. Some facilities may be missing. Ask your village health team for the nearest place to test.</p></section>`;
  if (!lat) return;
  try {
    const list = await nearbyFacilities(lat, lon);
    document.getElementById('fac').innerHTML = list.length
      ? `<ul class="facilities">${list.map((f) => `<li><span><a href="https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lon}" target="_blank" rel="noopener">${esc(f.name)}</a><br><span class="small muted">${esc(f.kind || 'health facility')}</span></span><span class="small">${f.km.toFixed(1)} km</span></li>`).join('')}</ul>`
      : `<p class="muted">No facilities are mapped within 6 km. Ask your village health team or local council.</p>`;
  } catch {
    document.getElementById('fac').innerHTML = `<p class="muted">Could not search right now. Check your connection and try again.</p>`;
  }
}

// ---------- LEARN ----------
function viewLearn() {
  $view.innerHTML = `
  <h2>Learn</h2>
  <div>${LEARN.map((x) => `<details class="learn" id="l-${x.id}"><summary>${esc(x.title)}</summary><div class="body">${x.body}</div></details>`).join('')}</div>
  <section class="pilot">
    <h3>Help shape MosquitoMo</h3>
    <p class="small">MosquitoMo is being tested in October 2026 by a Makerere University student team. Tell us what worked and what did not.</p>
    <a class="btn block" href="#feedback">Give feedback</a>
  </section>
  <p class="small muted">Weather data by Open-Meteo.com (CC BY 4.0). Maps and places © OpenStreetMap contributors. MosquitoMo gives general information and is not medical advice.</p>
  <p class="small muted">${pendingCount() ? `${pendingCount()} item(s) waiting to send.` : ''}</p>`;
}

// ---------- FEEDBACK ----------
function scale(name, n = 5, from = 1) {
  return `<div class="scale${n > 5 ? ' ten' : ''}">${Array.from({ length: n }, (_, i) => `<label><input type="radio" name="${name}" value="${i + from}" required><span>${i + from}</span></label>`).join('')}</div>`;
}

function viewFeedback(params) {
  const done = store.get('feedbackDone');
  $view.innerHTML = `
  <h2>Your feedback</h2>
  <p class="muted">${done ? 'Thanks for your earlier feedback. You can send more any time.' : 'Seven quick questions. No name needed.'} Answers are anonymous and are used to improve MosquitoMo and to report the pilot's results.</p>
  <form id="fb">
    <fieldset><legend>How well did you understand your reading?</legend>${scale('understood')}<div class="scale-ends"><span>Not at all</span><span>Completely</span></div></fieldset>
    <fieldset><legend>How clear was the advice on what to do?</legend>${scale('advice_clear')}<div class="scale-ends"><span>Not clear</span><span>Very clear</span></div></fieldset>
    <fieldset><legend>After seeing it, what will you do? Choose all that apply.</legend>
      <div class="chips">${ACTIONS_WILL_TAKE.map((a) => `<label><input type="checkbox" name="would_act" value="${a.key}"><span>${a.label}</span></label>`).join('')}</div></fieldset>
    <fieldset><legend>How useful is MosquitoMo to you?</legend>${scale('useful')}<div class="scale-ends"><span>Not useful</span><span>Very useful</span></div></fieldset>
    <fieldset><legend>How likely are you to recommend it to a friend?</legend>${scale('recommend', 11, 0)}<div class="scale-ends"><span>Not likely</span><span>Very likely</span></div></fieldset>
    <fieldset><legend>About you (optional)</legend>
      <label class="sr-only" for="district">District</label><input type="text" id="district" name="district" placeholder="Your district, e.g. Kampala, Wakiso, Iganga">
      <label class="sr-only" for="role">You are</label>
      <select id="role" name="role"><option value="">You are…</option><option>Student</option><option>Parent or carer</option><option>Teacher</option><option>Health worker or VHT</option><option>Local leader</option><option>Business or organisation</option><option>Other</option></select>
    </fieldset>
    <div><label class="q" for="comment">What should we change or add?</label><textarea id="comment" name="comment" maxlength="1000"></textarea></div>
    <button class="btn block" type="submit">Send feedback</button>
  </form>`;
  document.getElementById('fb').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    for (const k of ['understood', 'advice_clear', 'useful', 'recommend']) {
      if (!fd.get(k)) { toast('Please answer the questions with numbers.'); e.target.querySelector(`[name="${k}"]`).focus(); return; }
    }
    const ua = navigator.userAgent;
    const row = {
      understood: +fd.get('understood'), advice_clear: +fd.get('advice_clear'), useful: +fd.get('useful'), recommend: +fd.get('recommend'),
      would_act: fd.getAll('would_act'), district: fd.get('district') || null, role: fd.get('role') || null, comment: fd.get('comment') || null,
      phone: /android/i.test(ua) ? 'android' : /iphone|ipad/i.test(ua) ? 'iphone' : 'other',
      level_seen: params.level || null, score_seen: params.score ? +params.score : null,
    };
    await enqueue('feedback', row);
    store.set('feedbackDone', true);
    $view.innerHTML = `<section class="state"><h2>Thank you</h2><p class="muted">Your feedback helps us make MosquitoMo better before it reaches more people.</p><a class="btn block" href="#here">Back to my reading</a></section>`;
  });
}

// ---------- install ----------
let deferred = null;
const installBtn = document.getElementById('installBtn');
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; installBtn.hidden = false; });
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
if (isIOS && !standalone) installBtn.hidden = false;
installBtn.addEventListener('click', async () => {
  if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; installBtn.hidden = true; }
  else if (isIOS) toast('In Safari, tap the Share button, then “Add to Home Screen”.', 6000);
});
window.addEventListener('appinstalled', () => { installBtn.hidden = true; toast('MosquitoMo is installed'); });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

flush();
route();
