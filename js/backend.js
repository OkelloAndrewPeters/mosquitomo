// Sends breeding-site reports, pilot feedback and anonymous usage counts to Supabase.
// Anything that cannot be sent (offline, or no backend yet) waits in a queue on the phone.
import { CONFIG } from './config.js';
import { store } from './data.js';

export const hasBackend = () => !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);

export function deviceId() {
  let id = store.get('device');
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2) + Date.now();
    store.set('device', id);
  }
  return id;
}

const headers = () => ({
  apikey: CONFIG.SUPABASE_ANON_KEY,
  Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
});

async function insert(table, row) {
  const r = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`${table} ${r.status}: ${await r.text()}`);
}

async function uploadPhoto(dataUrl, name) {
  const blob = await (await fetch(dataUrl)).blob();
  const r = await fetch(`${CONFIG.SUPABASE_URL}/storage/v1/object/report-photos/${name}`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
    body: blob,
  });
  if (!r.ok) throw new Error(`photo ${r.status}`);
  return `${CONFIG.SUPABASE_URL}/storage/v1/object/public/report-photos/${name}`;
}

const queue = () => store.get('queue', []);
const setQueue = (q) => store.set('queue', q);

const BACKGROUND = new Set(['readings', 'events']); // usage counts, sent in batches

export function pendingCount() {
  return queue().filter((x) => !BACKGROUND.has(x.table)).length;
}

export function enqueue(table, row) {
  const q = queue();
  q.push({ table, row: { ...row, device_id: deviceId(), created_at: new Date().toISOString() } });
  // keep usage counts from growing without limit on phones that are offline for a long time
  let bg = q.filter((x) => BACKGROUND.has(x.table)).length;
  const trimmed = q.filter((x) => !(BACKGROUND.has(x.table) && bg-- > 400));
  setQueue(trimmed);
  return flush();
}

let flushing = false;
export async function flush() {
  if (!hasBackend() || flushing || !navigator.onLine) return { sent: 0, left: pendingCount() };
  flushing = true;
  let sent = 0;
  try {
    let q = queue();
    while (q.length) {
      const first = q[0];
      let n = 1;
      if (BACKGROUND.has(first.table)) {
        // batch consecutive usage rows of the same table into one request
        while (n < q.length && n < 50 && q[n].table === first.table) n++;
        await insert(first.table, q.slice(0, n).map((x) => x.row));
      } else {
        const row = { ...first.row };
        if (row.photo_data) {
          row.photo_url = await uploadPhoto(row.photo_data, `${row.device_id}-${Date.parse(row.created_at)}.jpg`);
          delete row.photo_data;
        }
        await insert(first.table, row);
      }
      q = queue().slice(n);
      setQueue(q);
      sent += n;
    }
  } catch (e) {
    console.warn('MosquitoMo: will retry sending later', e);
  } finally {
    flushing = false;
  }
  return { sent, left: pendingCount() };
}

/** Anonymous usage event: app opened, screen viewed, app installed, place saved, search used. */
export function track(event, detail = null) {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ua = navigator.userAgent;
  const platform = /android/i.test(ua) ? 'android' : /iphone|ipad|ipod/i.test(ua) ? 'iphone' : 'desktop';
  enqueue('events', { event, detail: detail == null ? null : String(detail).slice(0, 80), installed: !!standalone, platform });
}

/** Anonymous count of a reading being checked; location rounded to ~5 km. */
export function logReading(lat, lon, score, level, source) {
  const last = store.get('lastlog', {});
  const k = `${lat.toFixed(1)},${lon.toFixed(1)}`;
  if (last[k] && Date.now() - last[k] < 3 * 3600 * 1000) return; // at most once per area every 3 hours
  last[k] = Date.now();
  store.set('lastlog', last);
  enqueue('readings', { lat: +lat.toFixed(2), lon: +lon.toFixed(2), score, level, source });
}

window.addEventListener('online', () => flush());
