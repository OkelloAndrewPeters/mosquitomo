# MosquitoMo pilot app — setup

A web app that installs like a normal app on Android and iPhone. No app store and no build step: it is plain HTML, CSS and JavaScript.

## What works now
- **Here**: the MosquitoMo Index (0–100) for your GPS location, with its level, the reasons behind it, the rain→risk strip, an 8-week outlook and what to do.
- **Places**: search any village, town, school or park in Uganda, and save places.
- **Map**: readings for 55 towns. Tap anywhere on the map to get a reading for that spot.
- **Report**: report a breeding site with a photo, GPS location and a note. Works offline and sends later.
- **Learn**: short lessons, how the index works, and fever and care with nearby health facilities.
- **Feedback**: a 7-question pilot survey.
- **dashboard.html**: users (total, active today and this week, new vs returning each day, installs, Android vs iPhone, screens used), pilot results, a map of reports and readings, and the latest reports.

## What is tracked, and what isn't
Each phone gets a random ID the first time it opens the app. MosquitoMo records when the app is opened, which screens are viewed, whether it was opened as an installed app, the platform (Android, iPhone or desktop), readings rounded to about 1 km, reports and feedback. It never records names, phone numbers or exact home locations. Tell pilot users this, for example on the poster.

Live data comes from Open-Meteo (rain, temperature, humidity, 92 days of history plus a 16-day forecast, and elevation) and from OpenStreetMap (place names and health facilities). These are free and need no keys. Open-Meteo is free for non-commercial use (up to 10,000 calls a day), which is plenty for a pilot.

## 1. Put it online (GitHub Pages, free, about 10 minutes)
The app needs **https** for GPS and for installing, and GitHub Pages provides that.
1. Create a GitHub account if you don't have one, then make a new **public** repository called `mosquitomo`.
2. Upload every file in this folder, keeping the folder structure (Add file → Upload files, then drag in the whole folder contents).
3. Go to Settings → Pages → Source: "Deploy from a branch" → Branch `main`, folder `/ (root)` → Save.
4. After about a minute the app is live at `https://YOURNAME.github.io/mosquitomo/`.

Netlify works too: drag the folder onto app.netlify.com/drop.

## 2. Turn on reports and feedback (Supabase, free, about 10 minutes)
Until you do this, reports and feedback are kept on each phone and sent automatically once this step is done.
1. Create a free project at supabase.com. Choose the region closest to Uganda (for example Frankfurt or Ireland).
2. Open SQL Editor → New query, paste the whole of `supabase/schema.sql` and click Run.
3. Go to Project Settings → API, and copy the **Project URL** and the **anon public** key into `js/config.js`.
4. Upload the changed `config.js` to GitHub.

The anon key is safe to publish. The database rules only let the app *add* rows. Only reports and aggregated totals can be read publicly, and feedback rows stay private.

## 3. Install it on a phone
- **Android (Chrome)**: open the link and tap **Install app** at the top, or use the menu → Install app.
- **iPhone (Safari)**: open the link, tap Share, then **Add to Home Screen**.

## 4. Updating the app
Edit the files and upload them again. If you change files, also change `VERSION` in `sw.js` (for example `mm-v2`) so installed phones pick up the new version.

## Where to change things
| What | File |
|---|---|
| Advice wording, lessons, report types, survey actions | `js/content.js` |
| How the index is calculated | `js/engine.js` |
| Towns on the map | `TOWNS` at the bottom of `js/data.js` |
| Colours and layout | `css/app.css` |
