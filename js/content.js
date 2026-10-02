// All advice wording in one place so it can be reviewed with the National Malaria Control
// Division and translated. Wording follows the concept note, section 5.4 (safe messaging):
// there is no "low" or "safe" level, and every level keeps the baseline protection.

export const ADVICE = {
  standard: {
    summary: 'Normal seasonal risk. Malaria is still present all year in most of Uganda.',
    actions: [
      'Sleep under a treated net every night, all year.',
      'Fill or drain puddles near your home.',
      'Fever? Get a malaria test within 24 hours.',
    ],
  },
  elevated: {
    summary: 'Mosquito breeding is rising after recent rains. Malaria cases are likely to rise in the coming weeks.',
    actions: [
      'Drain puddles and clear blocked drains around your home this week.',
      'Cover arms and legs from dusk.',
      'Everyone sleeps under a treated net every night.',
      'Fever? Get a malaria test within 24 hours.',
    ],
  },
  high: {
    summary: 'High malaria risk in your area. A rise in malaria cases is likely.',
    actions: [
      'Clear standing water around your home now: puddles, drains, tyres, containers.',
      'Everyone sleeps under a treated net every night, especially children and pregnant women.',
      'Take any child with fever to a health centre today.',
      'Fever? Get a malaria test within 24 hours. Do not wait.',
    ],
  },
};

export const REPORT_KINDS = [
  { key: 'puddle', label: 'Puddle or pool' },
  { key: 'drain', label: 'Blocked drain' },
  { key: 'brick_pit', label: 'Brick pit or quarry' },
  { key: 'construction', label: 'Construction site water' },
  { key: 'containers', label: 'Tyres or containers' },
  { key: 'other', label: 'Something else' },
];

export const LEARN = [
  {
    id: 'which',
    title: 'Which mosquitoes carry malaria?',
    body: `<p>Only female <em>Anopheles</em> mosquitoes spread malaria. Many of the mosquitoes that buzz and bite in town in the evening are nuisance mosquitoes that do not carry it.</p>
<p>So the mosquitoes you notice are not a good guide to your malaria risk. That is why MosquitoMo looks at the conditions that let <em>Anopheles</em> breed instead.</p>`,
  },
  {
    id: 'when',
    title: 'When do they bite?',
    body: `<p>Malaria mosquitoes mostly bite late at night and in the early morning, while people are asleep. A treated bed net, used every night, is the best protection.</p>
<p>Some also bite outdoors in the evening, so covering arms and legs from dusk helps when risk is raised.</p>`,
  },
  {
    id: 'where',
    title: 'Where do they breed?',
    body: `<p><em>Anopheles</em> lay eggs in clean, shallow, sunlit water on the ground: puddles, tyre ruts, hoof prints, brick pits, blocked drains, rice paddies and flooded construction sites.</p>
<p>A puddle that lasts about a week is long enough for eggs to become adult mosquitoes. Filling or draining it breaks the cycle. You can report places like this from the Report tab.</p>`,
  },
  {
    id: 'lag',
    title: 'Why does risk rise weeks after rain?',
    body: `<p>Rain makes pools. Eggs in those pools take about one to two weeks to become adults, and the malaria parasite then needs more time to develop inside the mosquito before it can infect anyone.</p>
<p>Studies in Iganga and Mayuge found malaria risk starts rising about two weeks after very heavy rain, peaks around four weeks and can stay high for up to eight. By then most people have forgotten the rain. MosquitoMo remembers it for you.</p>`,
  },
  {
    id: 'fever',
    title: 'Fever and getting care',
    body: `<p>Any fever in Uganda could be malaria. Get a malaria test within 24 hours of the fever starting. Children whose care is delayed by more than a day are much more likely to become seriously ill.</p>
<p>Testing is free at government health centres and with village health teams. MosquitoMo does not diagnose malaria or advise on treatment.</p>`,
  },
  {
    id: 'travel',
    title: 'Travelling within Uganda',
    body: `<p>Malaria is present in nearly all of Uganda. If you are visiting from outside Uganda, or from a highland area, see a doctor about malaria tablets before you travel, whatever MosquitoMo shows for your destination. A Standard reading never means you can skip them.</p>`,
  },
  {
    id: 'method',
    title: 'How the MosquitoMo Index works',
    body: `<p>The index (0 to 100) combines four things for the exact spot you check:</p>
<ul>
<li><strong>Rain over the past 9 weeks</strong>, counting rain from 3 to 5 weeks ago the most, because that is when it turns into malaria risk.</li>
<li><strong>Temperature</strong>. Malaria spreads best near 25 °C and slows when it is cooler than about 18 °C or hotter than about 30 °C.</li>
<li><strong>Humidity</strong>, which helps mosquitoes live long enough to spread malaria.</li>
<li><strong>The shape of the land</strong>. Low ground where water collects scores higher than a hilltop nearby.</li>
</ul>
<p>Weather data comes from Open-Meteo (ECMWF and national weather models) and is updated several times a day. The 8-week outlook uses the rain that has already fallen plus the 16-day forecast. Beyond that it assumes recent weather continues, so later weeks are less certain.</p>
<p><strong>Honest limits.</strong> This is a pilot. The index is built from published science and has not yet been checked against clinic records for your district. It describes an area of a few hundred metres to a few kilometres, not your compound, so always check for standing water around your own home.</p>`,
  },
];

export const ACTIONS_WILL_TAKE = [
  { key: 'net', label: 'Use a net every night' },
  { key: 'drain', label: 'Drain or fill standing water' },
  { key: 'cover', label: 'Cover up in the evening' },
  { key: 'test', label: 'Get tested sooner if I have fever' },
  { key: 'tell', label: 'Tell family or neighbours' },
  { key: 'report', label: 'Report breeding sites' },
  { key: 'nothing', label: 'Nothing different' },
];
