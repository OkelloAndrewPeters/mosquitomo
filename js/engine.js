// MosquitoMo Index — Layer 1 (biological suitability).
// Transparent, published-curve model. Not yet calibrated against clinic data.
//
//   Index = 100 × √thermal × (0.7 × rain + 0.3 × humidity) × terrain
//
// rain     : lagged rainfall, weighted to the 1–9 weeks before the date (peak at 3–5 weeks),
//            following the Iganga-Mayuge finding that risk rises ~2 weeks after heavy rain,
//            peaks ~4 weeks and lasts up to 8.
// thermal  : suitability curve for P. falciparum in Anopheles, optimum 25 °C,
//            range ~16–34 °C (Mordecai et al. 2013; later syntheses).
// humidity : adult mosquito survival; poor below ~45 % RH.
// terrain  : local topographic position — valleys collect water (×1.15), hilltops drain (×0.85).

export const LEVELS = [
  { key: 'standard', name: 'Standard', min: 0, max: 40 },
  { key: 'elevated', name: 'Elevated', min: 41, max: 70 },
  { key: 'high', name: 'High', min: 71, max: 100 },
];

export function levelFor(score) {
  if (score >= 71) return LEVELS[2];
  if (score >= 41) return LEVELS[1];
  return LEVELS[0];
}

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function thermalSuitability(t) {
  if (t == null || isNaN(t)) return 0.8;
  if (t <= 16 || t >= 34) return 0;
  const s = t < 25 ? 4.5 : 3.5;
  let v = Math.exp(-((t - 25) ** 2) / (2 * s * s));
  // taper to zero at the edges of the transmission range
  if (t < 18) v *= (t - 16) / 2;
  if (t > 32) v *= (34 - t) / 2;
  return v;
}

export function humiditySuitability(rh) {
  if (rh == null || isNaN(rh)) return 0.75;
  return clamp((rh - 45) / 35, 0, 1);
}

// lag weight for rain that fell `d` days before the target date
export function rainKernel(d) {
  if (d < 7 || d > 63) return 0;
  if (d < 21) return (d - 7) / 14;
  if (d <= 35) return 1;
  return (63 - d) / 28;
}
const KERNEL = Array.from({ length: 64 }, (_, d) => rainKernel(d));
const KSUM = KERNEL.reduce((a, b) => a + b, 0);

export function rainSuitability(mmPerWeek) {
  return 1 - Math.exp(-mmPerWeek / 35);
}

export function terrainMultiplier(tpi) {
  if (tpi == null || isNaN(tpi)) return 1;
  return clamp(1 - tpi / 60, 0.85, 1.15);
}

const mean = (arr) => {
  const v = arr.filter((x) => x != null && !isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

/**
 * Build a full daily series where the future beyond the forecast is filled by persistence
 * (recent 30-day averages), so the 8-week outlook can be computed.
 * series: { dates[], rain[], temp[], rh[], todayIndex }
 */
export function extendSeries(series, daysAhead = 63) {
  const { dates, rain, temp, rh, todayIndex } = series;
  const n = dates.length;
  const lastObs = Math.min(n, todayIndex + 30);
  const recent = (arr) => mean(arr.slice(Math.max(0, todayIndex - 60), todayIndex + 1));
  const rainFill = recent(rain) ?? 3;
  const tempFill = mean(temp.slice(Math.max(0, n - 14))) ?? 23;
  const rhFill = mean(rh.slice(Math.max(0, n - 14))) ?? 70;
  const out = { dates: [...dates], rain: [...rain], temp: [...temp], rh: [...rh], todayIndex, forecastEnd: n - 1, persisted: [] };
  const last = new Date(dates[n - 1] + 'T00:00:00');
  const need = todayIndex + daysAhead - (n - 1);
  for (let i = 1; i <= need; i++) {
    const d = new Date(last);
    d.setDate(d.getDate() + i);
    out.dates.push(d.toISOString().slice(0, 10));
    out.rain.push(rainFill);
    out.temp.push(tempFill);
    out.rh.push(rhFill);
  }
  void lastObs;
  return out;
}

/** Score the index on day index `i` of an (extended) series. */
export function scoreAt(s, i, tpi = null) {
  let acc = 0, wsum = 0;
  for (let d = 0; d < 64; d++) {
    const j = i - d;
    if (j < 0 || KERNEL[d] === 0) continue;
    const r = s.rain[j];
    if (r == null || isNaN(r)) continue;
    acc += KERNEL[d] * r;
    wsum += KERNEL[d];
  }
  const dailyRain = wsum > KSUM * 0.5 ? acc / wsum : null; // need at least half the window
  const mmWeek = dailyRain == null ? 20 : dailyRain * 7;
  const tMean = mean(s.temp.slice(Math.max(0, i - 20), i + 1));
  const rhMean = mean(s.rh.slice(Math.max(0, i - 13), i + 1));

  const R = rainSuitability(mmWeek);
  const T = thermalSuitability(tMean);
  const H = humiditySuitability(rhMean);
  const M = terrainMultiplier(tpi);
  const score = Math.round(clamp(100 * Math.sqrt(T) * (0.7 * R + 0.3 * H) * M, 0, 100));
  return { score, parts: { R, T, H, M }, inputs: { mmWeek, tMean, rhMean, tpi } };
}

/** Full reading: today's score, drivers, and 8-week outlook. */
export function computeReading(series, tpi = null) {
  const s = extendSeries(series);
  const t = s.todayIndex;
  const now = scoreAt(s, t, tpi);

  const outlook = [];
  for (let w = 1; w <= 8; w++) {
    const i = t + 7 * w;
    const r = scoreAt(s, i, tpi);
    // how much of the rain driving this week is already observed or forecast (vs assumed)
    let known = 0, total = 0;
    for (let d = 0; d < 64; d++) {
      const j = i - d;
      if (KERNEL[d] === 0) continue;
      total += KERNEL[d];
      if (j <= s.forecastEnd) known += KERNEL[d];
    }
    const share = known / total;
    const confidence = share > 0.85 ? 'good' : share > 0.55 ? 'fair' : 'rough';
    outlook.push({ week: w, date: s.dates[i], score: r.score, level: levelFor(r.score), confidence });
  }

  // past 8 weeks of rain, weekly totals (oldest first)
  const weeklyRain = [];
  for (let w = 8; w >= 1; w--) {
    const end = t - 7 * (w - 1);
    const start = end - 6;
    let sum = 0, have = 0;
    for (let j = start; j <= end; j++) {
      if (j >= 0 && s.rain[j] != null) { sum += s.rain[j]; have++; }
    }
    weeklyRain.push({ weeksAgo: w - 1, mm: have ? Math.round(sum) : null });
  }
  let forecastRain = 0;
  for (let j = t + 1; j <= Math.min(s.forecastEnd, t + 14); j++) forecastRain += series.rain[j] ?? 0;

  return {
    score: now.score,
    level: levelFor(now.score),
    parts: now.parts,
    inputs: now.inputs,
    drivers: describeDrivers(now, weeklyRain, forecastRain, tpi),
    outlook,
    weeklyRain,
    forecastRain: Math.round(forecastRain),
  };
}

export function describeDrivers(now, weeklyRain, forecastRain, tpi) {
  const out = [];
  const { tMean, rhMean, mmWeek } = now.inputs;
  // heaviest week 1–8 weeks ago (exclude this week, which hasn't had time to matter)
  const candidates = weeklyRain.filter((w) => w.weeksAgo >= 1 && w.mm != null);
  const heaviest = candidates.reduce((a, b) => (b.mm > (a?.mm ?? -1) ? b : a), null);
  const mmList = candidates.map((w) => w.mm).sort((a, b) => a - b);
  const median = mmList.length ? mmList[Math.floor(mmList.length / 2)] : 0;
  if (heaviest && heaviest.mm >= 40 && heaviest.mm < 1.5 * median) {
    out.push({ kind: 'rain', up: true, text: `Heavy rain week after week for the past two months (about ${Math.round(median)} mm a week).` });
  } else if (heaviest && heaviest.mm >= 40) {
    const when = heaviest.weeksAgo === 1 ? 'last week' : `${heaviest.weeksAgo} weeks ago`;
    out.push({ kind: 'rain', up: true, text: `Heavy rain ${when} (${heaviest.mm} mm). Pools from rain take 2 to 8 weeks to turn into malaria risk.` });
  } else if (mmWeek >= 15) {
    out.push({ kind: 'rain', up: true, text: `Steady rain over the past two months is keeping breeding pools wet.` });
  } else {
    out.push({ kind: 'rain', up: false, text: `Little rain over the past two months, so fewer breeding pools.` });
  }
  if (tMean != null) {
    if (tMean < 19) out.push({ kind: 'temp', up: false, text: `Cool weather (about ${Math.round(tMean)} °C) slows the malaria parasite inside mosquitoes.` });
    else if (tMean > 29) out.push({ kind: 'temp', up: false, text: `Very hot weather (about ${Math.round(tMean)} °C) shortens mosquito lives.` });
    else if (tMean >= 21) out.push({ kind: 'temp', up: true, text: `Warm weather (about ${Math.round(tMean)} °C) is close to the 25 °C that suits malaria best.` });
  }
  if (rhMean != null) {
    if (rhMean >= 70) out.push({ kind: 'humidity', up: true, text: `Humid air (${Math.round(rhMean)}%) helps mosquitoes live longer.` });
    else if (rhMean < 50) out.push({ kind: 'humidity', up: false, text: `Dry air (${Math.round(rhMean)}%) shortens mosquito lives.` });
  }
  if (tpi != null) {
    if (tpi <= -8) out.push({ kind: 'terrain', up: true, text: `This spot sits on low ground where rainwater collects.` });
    else if (tpi >= 8) out.push({ kind: 'terrain', up: false, text: `This spot sits on higher ground that drains well.` });
  }
  if (forecastRain >= 50) out.push({ kind: 'forecast', up: true, text: `About ${Math.round(forecastRain)} mm more rain is forecast in the next two weeks.` });
  return out;
}

/** One-line summary for the reading card. */
export function headline(reading) {
  const bits = [];
  for (const d of reading.drivers) {
    if (d.kind === 'rain') {
      if (/week after week/.test(d.text)) bits.push('weeks of heavy rain');
      else if (/^Heavy rain/.test(d.text)) bits.push('heavy rain ' + d.text.match(/^Heavy rain (.+?) \(/)[1]);
      else if (d.up) bits.push('steady rain');
      else bits.push('little recent rain');
    } else if (d.kind === 'temp') bits.push(d.up ? 'warm weather' : /Cool/.test(d.text) ? 'cool weather' : 'very hot weather');
    else if (d.kind === 'terrain' && d.up) bits.push('low ground');
    else if (d.kind === 'forecast') bits.push('more rain coming');
  }
  const s = bits.slice(0, 3).join(', ');
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}
