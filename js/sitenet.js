// SiteNet on-device inference with ONNX Runtime Web (WebAssembly, single thread).
// The photo never leaves the phone. Model + runtime are cached by the service worker, so this works offline.
import * as ort from '../vendor/ort/ort.wasm.min.mjs';

ort.env.wasm.wasmPaths = new URL('../vendor/ort/', import.meta.url).href;
ort.env.wasm.numThreads = 1;      // GitHub Pages is not cross-origin isolated; one thread also suits low-end phones
ort.env.wasm.proxy = false;

let session = null, meta = null, loading = null;

export async function load() {
  if (session) return { session, meta };
  if (!loading) {
    loading = (async () => {
      meta = await (await fetch(new URL('../models/sitenet_meta.json', import.meta.url))).json();
      const t0 = performance.now();
      session = await ort.InferenceSession.create(new URL('../models/sitenet.onnx', import.meta.url).href, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      meta.loadMs = Math.round(performance.now() - t0);
      return { session, meta };
    })().catch((e) => { loading = null; throw e; });
  }
  return loading;
}

/** Resize shorter side to `resize`, centre-crop `crop`, normalise, NCHW float32. */
function preprocess(bitmap, { resize, center_crop: crop, mean, std }) {
  const s = resize / Math.min(bitmap.width, bitmap.height);
  const w = Math.round(bitmap.width * s), h = Math.round(bitmap.height * s);
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(crop, crop) : Object.assign(document.createElement('canvas'), { width: crop, height: crop });
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, -Math.round((w - crop) / 2), -Math.round((h - crop) / 2), w, h);
  const px = ctx.getImageData(0, 0, crop, crop).data;
  const n = crop * crop, out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    out[i] = (px[i * 4] / 255 - mean[0]) / std[0];
    out[n + i] = (px[i * 4 + 1] / 255 - mean[1]) / std[1];
    out[2 * n + i] = (px[i * 4 + 2] / 255 - mean[2]) / std[2];
  }
  return new ort.Tensor('float32', out, [1, 3, crop, crop]);
}

export async function classify(fileOrBlob) {
  const { session, meta } = await load();
  const bmp = await createImageBitmap(fileOrBlob, { imageOrientation: 'from-image' });
  const x = preprocess(bmp, meta.input);
  const t0 = performance.now();
  const out = await session.run({ [session.inputNames[0]]: x });
  const ms = Math.round(performance.now() - t0);
  const logits = Array.from(out[session.outputNames[0]].data);
  const m = Math.max(...logits);
  const e = logits.map((v) => Math.exp(v - m)); const z = e.reduce((a, b) => a + b, 0);
  const probs = e.map((v) => v / z);
  const ranked = meta.classes.map((c, i) => ({ cls: c, p: probs[i] })).sort((a, b) => b.p - a.p);
  return { top: ranked[0], ranked, ms, model: meta.shipped, bitmap: bmp };
}

export const modelInfo = () => meta;
