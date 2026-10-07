// Live data: Open-Meteo (weather + elevation), OpenStreetMap Nominatim (place names),
// Overpass (health facilities). All free, keyless and callable from the browser.
import { computeReading } from './engine.js';
import { PLACES, searchLocal } from './places-ug.js';

export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
const todayUG = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });

const WX = 'https://api.open-meteo.com/v1/forecast';
const ELEV = 'https://api.open-meteo.com/v1/elevation';
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search';

const TTL = 6 * 3600 * 1000;

export const store = {
  get(k, d = null) {
    try { const v = localStorage.getItem('mm:' + k); return v == null ? d : JSON.parse(v); } catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem('mm:' + k, JSON.stringify(v)); } catch { /* storage full or blocked */ }
  },
};

const key = (lat, lon) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

async function getJSON(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) {
    const e = new Error(`HTTP ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

function wxURL(lats, lons, withRH) {
  const daily = ['precipitation_sum', 'temperature_2m_mean'];
  if (withRH) daily.push('relative_humidity_2m_mean');
  const p = new URLSearchParams({
    latitude: lats.join(','),
    longitude: lons.join(','),
    daily: daily.join(','),
    past_days: '92',
    forecast_days: '16',
    timezone: 'Africa/Kampala',
  });
  return `${WX}?${p}`;
}

function toSeries(d) {
  const dates = d.daily.time;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });
  let todayIndex = dates.indexOf(today);
  if (todayIndex < 0) todayIndex = Math.min(92, dates.length - 1);
  return {
    dates,
    rain: d.daily.precipitation_sum,
    temp: d.daily.temperature_2m_mean,
    rh: d.daily.relative_humidity_2m_mean || dates.map(() => null),
    todayIndex,
  };
}

async function fetchWeather(lats, lons) {
  try {
    return await getJSON(wxURL(lats, lons, true));
  } catch (e) {
    if (e.status === 400) return getJSON(wxURL(lats, lons, false)); // humidity variable not offered
    throw e;
  }
}

// Topographic position: centre elevation minus the mean of 8 points ~1.5 km around it.
async function fetchTPI(lat, lon) {
  const dLat = 1.5 / 111;
  const dLon = 1.5 / (111 * Math.cos((lat * Math.PI) / 180));
  const lats = [lat], lons = [lon];
  for (let a = 0; a < 8; a++) {
    const th = (a * Math.PI) / 4;
    lats.push(+(lat + dLat * Math.sin(th)).toFixed(5));
    lons.push(+(lon + dLon * Math.cos(th)).toFixed(5));
  }
  const p = new URLSearchParams({ latitude: lats.join(','), longitude: lons.join(',') });
  const d = await getJSON(`${ELEV}?${p}`);
  const e = d.elevation;
  const ring = e.slice(1).reduce((a, b) => a + b, 0) / 8;
  return { elevation: Math.round(e[0]), tpi: Math.round(e[0] - ring) };
}

/** Re-score a saved reading for today, so offline readings stay current for up to 16 days. */
function refresh(saved) {
  if (!saved.series) return { ...saved, daysOld: null };
  const i = saved.series.dates.indexOf(todayUG());
  if (i < 0) return { ...saved, expired: true };
  const series = { ...saved.series, todayIndex: i };
  return { ...saved, reading: computeReading(series, saved.tpi), daysLeft: saved.series.dates.length - 1 - i };
}

/** All readings saved on the phone: [{lat, lon, at, ...}] */
function savedReadings() {
  const out = [];
  try {
    for (let n = 0; n < localStorage.length; n++) {
      const k = localStorage.key(n);
      if (!k || !k.startsWith('mm:r:')) continue;
      const v = JSON.parse(localStorage.getItem(k));
      if (v && v.series) out.push(v);
    }
  } catch { /* storage blocked */ }
  return out;
}

/** Nearest saved reading within `km`, with the name of the nearest known town. */
export function nearestSaved(lat, lon, km = 40) {
  let best = null, bd = Infinity;
  for (const r of savedReadings()) { const d = distKm(lat, lon, r.lat, r.lon); if (d < bd) { bd = d; best = r; } }
  return best && bd <= km ? { ...best, km: bd } : null;
}

function nearestPlace(lat, lon) {
  let best = null, bd = Infinity;
  for (const p of PLACES) { const d = distKm(lat, lon, p.lat, p.lon); if (d < bd) { bd = d; best = p; } }
  return best ? { ...best, km: bd } : null;
}

/** Reading for a point. Falls back to the saved copy, then to the nearest saved place, when the network fails. */
export async function getReading(lat, lon, { force = false } = {}) {
  const k = 'r:' + key(lat, lon);
  const cached = store.get(k);
  if (!force && cached && Date.now() - cached.at < TTL) return { ...refresh(cached), fromCache: true };
  try {
    if (isOffline()) throw new Error('offline');
    const [wx, terrain] = await Promise.all([
      fetchWeather([lat], [lon]),
      fetchTPI(lat, lon).catch(() => ({ elevation: null, tpi: null })),
    ]);
    const series = toSeries(wx);
    const reading = computeReading(series, terrain.tpi);
    const out = { at: Date.now(), lat, lon, elevation: terrain.elevation, tpi: terrain.tpi, reading, series };
    store.set(k, out);
    return out;
  } catch (e) {
    if (cached) return { ...refresh(cached), fromCache: true, stale: true };
    const near = nearestSaved(lat, lon);
    if (near) {
      const np = nearestPlace(near.lat, near.lon);
      return { ...refresh(near), fromCache: true, stale: true, near: { name: np && np.km < 5 ? np.name : 'a saved place', km: Math.round(near.km) } };
    }
    throw e;
  }
}

/** Save readings for the towns in the offline pack, so readings work anywhere with no internet. */
export async function syncPack({ force = false } = {}) {
  const last = store.get('packAt', 0);
  if (isOffline() || (!force && Date.now() - last < 12 * 3600 * 1000)) return { count: store.get('packCount', 0), at: last };
  let count = 0;
  for (let i = 0; i < PLACES.length; i += 50) {
    const chunk = PLACES.slice(i, i + 50);
    const d = await fetchWeather(chunk.map((p) => p.lat), chunk.map((p) => p.lon));
    const arr = Array.isArray(d) ? d : [d];
    arr.forEach((one, j) => {
      const p = chunk[j];
      const k = 'r:' + key(p.lat, p.lon);
      const prev = store.get(k);
      if (prev && prev.tpi != null && Date.now() - prev.at < TTL) { count++; return; } // keep a fuller, fresh reading
      const series = toSeries(one);
      store.set(k, { at: Date.now(), lat: p.lat, lon: p.lon, elevation: null, tpi: null, reading: computeReading(series, null), series });
      count++;
    });
  }
  store.set('packAt', Date.now()); store.set('packCount', count);
  return { count, at: Date.now() };
}
export const packInfo = () => ({ count: store.get('packCount', 0), at: store.get('packAt', 0) });

/** Readings for many points in one request (map). Terrain is skipped to stay light. */
export async function getManyReadings(points) {
  const k = 'many:' + points.length + ':' + key(points[0].lat, points[0].lon);
  const cached = store.get(k);
  if (cached && Date.now() - cached.at < TTL) return cached.items;
  try {
    const out = [];
    for (let i = 0; i < points.length; i += 50) {
      const chunk = points.slice(i, i + 50);
      const d = await fetchWeather(chunk.map((p) => p.lat), chunk.map((p) => p.lon));
      const arr = Array.isArray(d) ? d : [d];
      arr.forEach((one, j) => {
        const r = computeReading(toSeries(one), null);
        out.push({ ...chunk[j], score: r.score, level: r.level.key });
      });
    }
    store.set(k, { at: Date.now(), items: out });
    return out;
  } catch (e) {
    if (cached) return cached.items;
    // never opened the map online: use readings saved in the offline pack
    const items = points.map((p) => { const r = store.get('r:' + key(p.lat, p.lon)); if (!r) return null; const x = refresh(r); return { ...p, score: x.reading.score, level: x.reading.level.key }; }).filter(Boolean);
    if (items.length) return items;
    throw e;
  }
}

/** Human name for a point: "Kalerwe, Kawempe Division". */
export async function placeName(lat, lon) {
  const k = 'n:' + key(lat, lon);
  const c = store.get(k);
  if (c) return c;
  try {
    const p = new URLSearchParams({ format: 'jsonv2', lat, lon, zoom: '16', addressdetails: '1', 'accept-language': 'en' });
    const d = await getJSON(`${NOMINATIM}/reverse?${p}`);
    const a = d.address || {};
    const name = a.village || a.neighbourhood || a.suburb || a.hamlet || a.quarter || a.town || a.city_district || a.city || a.county || 'Your location';
    const area = [a.city_district, a.county, a.city, a.state_district, a.state].find((x) => x && x !== name) || 'Uganda';
    const out = { name, area };
    store.set(k, out);
    return out;
  } catch {
    const np = nearestPlace(lat, lon);
    if (np && np.km < 8) return { name: np.km < 1.5 ? np.name : `Near ${np.name}`, area: np.area };
    return { name: 'Your location', area: `${lat.toFixed(3)}, ${lon.toFixed(3)}` };
  }
}

/** Search villages, towns, schools, parks in Uganda. */
export async function searchPlaces(q) {
  // Typed coordinates, e.g. "0.38, 32.56" or "0.38 32.56" (as copied from Google Maps)
  const m = q.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (m) {
    const lat = +m[1], lon = +m[2];
    const inUganda = lat > -1.6 && lat < 4.3 && lon > 29.5 && lon < 35.1;
    if (!inUganda) return [];
    const n = await placeName(lat, lon);
    return [{ name: n.name === 'Your location' ? `${lat.toFixed(4)}, ${lon.toFixed(4)}` : n.name, area: `${n.area} · ${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon }];
  }
  const local = searchLocal(q);
  if (isOffline()) return local;
  try {
    const p = new URLSearchParams({ q, format: 'jsonv2', countrycodes: 'ug', limit: '8', addressdetails: '1', 'accept-language': 'en' });
    const d = await getJSON(`${NOMINATIM}/search?${p}`);
    if (d.length) {
      const seen = new Set(local.map((x) => x.name.toLowerCase()));
      return [...local, ...d.map((x) => {
        const a = x.address || {};
        const name = x.name || x.display_name.split(',')[0];
        const area = [a.city_district, a.county, a.city, a.state_district, a.state].find((v) => v && v !== name) || 'Uganda';
        return { name, area, lat: +x.lat, lon: +x.lon };
      }).filter((x) => !seen.has(x.name.toLowerCase()))].slice(0, 10);
    }
  } catch { if (local.length) return local; }
  if (local.length) return local;
  const p = new URLSearchParams({ name: q, count: '8', countryCode: 'UG', language: 'en' });
  const d = await getJSON(`${GEOCODE}?${p}`);
  return (d.results || []).map((x) => ({ name: x.name, area: x.admin2 || x.admin1 || 'Uganda', lat: x.latitude, lon: x.longitude }));
}

/** Health facilities within ~6 km (OpenStreetMap). */
export async function nearbyFacilities(lat, lon) {
  const q = `[out:json][timeout:20];(
    node(around:6000,${lat},${lon})[amenity~"^(hospital|clinic|doctors)$"];
    way(around:6000,${lat},${lon})[amenity~"^(hospital|clinic|doctors)$"];
    node(around:6000,${lat},${lon})[healthcare~"^(hospital|clinic|centre)$"];
  );out center 40;`;
  const d = await getJSON(OVERPASS, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  const seen = new Set();
  return d.elements
    .map((e) => {
      const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon;
      return { name: e.tags?.name, kind: e.tags?.amenity || e.tags?.healthcare, lat: la, lon: lo, km: distKm(lat, lon, la, lo) };
    })
    .filter((f) => f.name && !seen.has(f.name) && seen.add(f.name))
    .sort((a, b) => a.km - b.km)
    .slice(0, 8);
}

export function distKm(a, b, c, d) {
  const R = 6371, toR = Math.PI / 180;
  const x = Math.sin(((c - a) * toR) / 2) ** 2 + Math.cos(a * toR) * Math.cos(c * toR) * Math.sin(((d - b) * toR) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function locate() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('no-geolocation'));
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }),
      (e) => rej(e),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

// Towns across Uganda for the national map (approximate town-centre coordinates).
export const TOWNS = [
  ['Kampala', 0.3476, 32.5825], ['Entebbe', 0.0512, 32.4637], ['Mukono', 0.3533, 32.7553], ['Wakiso', 0.4044, 32.4594],
  ['Luweero', 0.8492, 32.4731], ['Nakasongola', 1.3089, 32.4564], ['Mityana', 0.4175, 32.0228], ['Mubende', 0.5578, 31.3950],
  ['Kiboga', 0.9161, 31.7742], ['Masaka', -0.3338, 31.7341], ['Kalangala', -0.3089, 32.2250], ['Kyotera', -0.6333, 31.5350],
  ['Mbarara', -0.6072, 30.6545], ['Isingiro', -0.8436, 30.8022], ['Ibanda', -0.1339, 30.4950], ['Bushenyi', -0.5419, 30.1878],
  ['Ntungamo', -0.8794, 30.2642], ['Rukungiri', -0.7900, 29.9250], ['Kabale', -1.2486, 29.9897], ['Kisoro', -1.2850, 29.6850],
  ['Kasese', 0.1833, 30.0833], ['Fort Portal', 0.6710, 30.2750], ['Kyenjojo', 0.6328, 30.6214], ['Kagadi', 0.9378, 30.8089],
  ['Hoima', 1.4331, 31.3524], ['Masindi', 1.6744, 31.7150], ['Jinja', 0.4244, 33.2042], ['Iganga', 0.6092, 33.4686],
  ['Mayuge', 0.4597, 33.4803], ['Kamuli', 0.9472, 33.1197], ['Bugiri', 0.5714, 33.7417], ['Busia', 0.4669, 34.0900],
  ['Tororo', 0.6925, 34.1809], ['Mbale', 1.0827, 34.1750], ['Pallisa', 1.1450, 33.7094], ['Kapchorwa', 1.3964, 34.4508],
  ['Kumi', 1.4608, 33.9361], ['Soroti', 1.7146, 33.6111], ['Katakwi', 1.8911, 33.9661], ['Moroto', 2.5345, 34.6666],
  ['Nakapiripirit', 1.8520, 34.7200], ['Kotido', 2.9806, 34.1331], ['Kaabong', 3.5200, 34.1300], ['Abim', 2.7017, 33.6761],
  ['Lira', 2.2499, 32.8999], ['Apac', 1.9756, 32.5386], ['Gulu', 2.7724, 32.2881], ['Kitgum', 3.2783, 32.8867],
  ['Pader', 2.8761, 33.0864], ['Arua', 3.0201, 30.9111], ['Nebbi', 2.4783, 31.0889], ['Koboko', 3.4136, 30.9600],
  ['Yumbe', 3.4651, 31.2469], ['Adjumani', 3.3779, 31.7909], ['Moyo', 3.6610, 31.7247],
].map(([name, lat, lon]) => ({ name, lat, lon }));
