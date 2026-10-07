# MosquitoMo

**Know the risk. Beat the bite.**

MosquitoMo shows the mosquito and malaria risk for where you are in Uganda, what is driving it, how it is likely to change over the next 8 weeks, and what to do about it. It is an installable web app (PWA) for Android and iPhone, inspired by AirQo's approach to air quality.

**Works without internet.** After the first visit, the app, readings for 108 towns across Uganda, and the AI photo check are saved on the phone. Saved weather keeps the risk reading current for up to 16 days offline. The app only says "Offline" when the phone really has no connection.

**AI photo check.** When reporting a breeding site, a small on-device AI model (SiteNet: a MobileNetV3 student distilled from OpenCLIP, 4.4 MB, weight-only INT8, run with ONNX Runtime Web) suggests what the photo shows: puddle, blocked drain, container, pit, wetland or no site. It runs on the phone in a fraction of a second; a person always decides what to report. Training and results: [mosquitomo-offline](https://github.com/OkelloAndrewPeters/mosquitomo-offline).

**Pilot version, October 2026.** The MosquitoMo Index is built from published science (lagged rainfall, a temperature suitability curve peaking near 25 °C, humidity and local terrain) using live Open-Meteo weather data. It has not yet been calibrated against clinic records.

- App: `index.html`
- Pilot dashboard: `dashboard.html`
- Setup and deployment: [SETUP.md](SETUP.md)
- 17-day pilot plan: [PLAN.md](PLAN.md)
- Index method: [`js/engine.js`](js/engine.js)

Data: weather by [Open-Meteo.com](https://open-meteo.com) (CC BY 4.0); maps and places © OpenStreetMap contributors; map library Leaflet (BSD-2); ONNX Runtime Web (MIT).
