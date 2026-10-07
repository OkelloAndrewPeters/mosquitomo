// Offline gazetteer: Ugandan district towns and main Kampala areas, so search works with no internet.
// Coordinates are approximate town centres (±1–2 km), enough for a breeding-risk reading.
// [name, area, lat, lon]
export const PLACES = [
  // Kampala & metro
  ['Kampala', 'Kampala', 0.3476, 32.5825], ['Makerere', 'Kawempe, Kampala', 0.3350, 32.5680], ['Kavule', 'Makerere, Kampala', 0.3390, 32.5640],
  ['Wandegeya', 'Kawempe, Kampala', 0.3310, 32.5720], ['Kawempe', 'Kampala', 0.3750, 32.5570], ['Kalerwe', 'Kawempe, Kampala', 0.3560, 32.5660],
  ['Bwaise', 'Kawempe, Kampala', 0.3540, 32.5560], ['Nakawa', 'Kampala', 0.3330, 32.6160], ['Rubaga', 'Kampala', 0.3040, 32.5530],
  ['Makindye', 'Kampala', 0.2800, 32.5900], ['Ntinda', 'Nakawa, Kampala', 0.3540, 32.6150], ['Kisenyi', 'Central, Kampala', 0.3130, 32.5700],
  ['Kira', 'Wakiso', 0.3970, 32.6400], ['Nansana', 'Wakiso', 0.3640, 32.5280], ['Wakiso', 'Wakiso', 0.4044, 32.4594], ['Entebbe', 'Wakiso', 0.0512, 32.4637],
  ['Mukono', 'Mukono', 0.3533, 32.7553], ['Mpigi', 'Mpigi', 0.2290, 32.3260], ['Gayaza', 'Wakiso', 0.4550, 32.6110],
  // Central
  ['Luweero', 'Luweero', 0.8492, 32.4731], ['Nakasongola', 'Nakasongola', 1.3089, 32.4564], ['Mityana', 'Mityana', 0.4175, 32.0228],
  ['Mubende', 'Mubende', 0.5578, 31.3950], ['Kiboga', 'Kiboga', 0.9161, 31.7742], ['Masaka', 'Masaka', -0.3338, 31.7341],
  ['Kalangala', 'Kalangala', -0.3089, 32.2250], ['Kyotera', 'Kyotera', -0.6333, 31.5350], ['Rakai', 'Rakai', -0.7200, 31.4000],
  ['Sembabule', 'Sembabule', -0.0800, 31.4500], ['Lyantonde', 'Lyantonde', -0.4000, 31.1600], ['Kayunga', 'Kayunga', 0.7000, 32.8900],
  ['Lugazi', 'Buikwe', 0.3690, 32.9400], ['Buikwe', 'Buikwe', 0.3400, 33.0300], ['Kakumiro', 'Kakumiro', 0.7800, 31.3200],
  // Western
  ['Mbarara', 'Mbarara', -0.6072, 30.6545], ['Isingiro', 'Isingiro', -0.8436, 30.8022], ['Ibanda', 'Ibanda', -0.1339, 30.4950],
  ['Bushenyi', 'Bushenyi', -0.5419, 30.1878], ['Ntungamo', 'Ntungamo', -0.8794, 30.2642], ['Rukungiri', 'Rukungiri', -0.7900, 29.9250],
  ['Kanungu', 'Kanungu', -0.9000, 29.7800], ['Kabale', 'Kabale', -1.2486, 29.9897], ['Kisoro', 'Kisoro', -1.2850, 29.6850],
  ['Kiruhura', 'Kiruhura', -0.2000, 30.8400], ['Kasese', 'Kasese', 0.1833, 30.0833], ['Fort Portal', 'Kabarole', 0.6710, 30.2750],
  ['Bundibugyo', 'Bundibugyo', 0.7100, 30.0600], ['Kamwenge', 'Kamwenge', 0.1900, 30.4500], ['Kyenjojo', 'Kyenjojo', 0.6328, 30.6214],
  ['Kagadi', 'Kagadi', 0.9378, 30.8089], ['Kibaale', 'Kibaale', 0.8000, 31.0700], ['Hoima', 'Hoima', 1.4331, 31.3524],
  ['Masindi', 'Masindi', 1.6744, 31.7150], ['Buliisa', 'Buliisa', 2.1200, 31.4100], ['Kiryandongo', 'Kiryandongo', 1.8800, 32.0600],
  // Eastern
  ['Jinja', 'Jinja', 0.4244, 33.2042], ['Njeru', 'Buikwe', 0.4300, 33.1500], ['Iganga', 'Iganga', 0.6092, 33.4686],
  ['Mayuge', 'Mayuge', 0.4597, 33.4803], ['Kamuli', 'Kamuli', 0.9472, 33.1197], ['Buyende', 'Buyende', 1.1500, 33.1600],
  ['Kaliro', 'Kaliro', 0.8900, 33.5000], ['Luuka', 'Luuka', 0.7200, 33.3000], ['Namutumba', 'Namutumba', 0.8400, 33.6900],
  ['Bugiri', 'Bugiri', 0.5714, 33.7417], ['Busia', 'Busia', 0.4669, 34.0900], ['Tororo', 'Tororo', 0.6925, 34.1809],
  ['Butaleja', 'Butaleja', 0.9300, 33.9500], ['Budaka', 'Budaka', 1.0200, 33.9500], ['Mbale', 'Mbale', 1.0827, 34.1750],
  ['Sironko', 'Sironko', 1.2300, 34.2500], ['Bududa', 'Bududa', 1.0100, 34.3300], ['Pallisa', 'Pallisa', 1.1450, 33.7094],
  ['Kapchorwa', 'Kapchorwa', 1.3964, 34.4508], ['Bukedea', 'Bukedea', 1.3500, 34.0500], ['Kumi', 'Kumi', 1.4608, 33.9361],
  ['Ngora', 'Ngora', 1.4300, 33.7800], ['Serere', 'Serere', 1.5000, 33.5500], ['Soroti', 'Soroti', 1.7146, 33.6111],
  ['Kaberamaido', 'Kaberamaido', 1.7400, 33.1600], ['Katakwi', 'Katakwi', 1.8911, 33.9661],
  // Karamoja
  ['Moroto', 'Moroto', 2.5345, 34.6666], ['Nakapiripirit', 'Nakapiripirit', 1.8520, 34.7200], ['Amudat', 'Amudat', 1.9500, 34.9500],
  ['Kotido', 'Kotido', 2.9806, 34.1331], ['Kaabong', 'Kaabong', 3.5200, 34.1300], ['Abim', 'Abim', 2.7017, 33.6761],
  // Northern
  ['Lira', 'Lira', 2.2499, 32.8999], ['Apac', 'Apac', 1.9756, 32.5386], ['Dokolo', 'Dokolo', 1.9200, 33.1700],
  ['Amolatar', 'Amolatar', 1.6300, 32.8400], ['Alebtong', 'Alebtong', 2.2500, 33.2500], ['Gulu', 'Gulu', 2.7724, 32.2881],
  ['Amuru', 'Amuru', 2.8200, 31.9400], ['Anaka', 'Nwoya', 2.6000, 31.9500], ['Kitgum', 'Kitgum', 3.2783, 32.8867],
  ['Pader', 'Pader', 2.8761, 33.0864], ['Patongo', 'Agago', 2.8000, 33.3000], ['Padibe', 'Lamwo', 3.4700, 32.8300],
  // West Nile
  ['Arua', 'Arua', 3.0201, 30.9111], ['Nebbi', 'Nebbi', 2.4783, 31.0889], ['Pakwach', 'Pakwach', 2.4600, 31.5000],
  ['Paidha', 'Zombo', 2.4200, 30.9800], ['Koboko', 'Koboko', 3.4136, 30.9600], ['Maracha', 'Maracha', 3.2500, 30.9200],
  ['Yumbe', 'Yumbe', 3.4651, 31.2469], ['Adjumani', 'Adjumani', 3.3779, 31.7909], ['Moyo', 'Moyo', 3.6610, 31.7247],
].map(([name, area, lat, lon]) => ({ name, area, lat, lon }));

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim();

/** Offline search: names starting with the query first, then names or areas containing it. */
export function searchLocal(q, limit = 8) {
  const n = norm(q); if (!n) return [];
  const starts = [], has = [];
  for (const p of PLACES) {
    const a = norm(p.name), b = norm(p.area);
    if (a.startsWith(n)) starts.push(p);
    else if (a.includes(n) || b.includes(n)) has.push(p);
  }
  return [...starts, ...has].slice(0, limit).map((p) => ({ ...p, local: true }));
}
