#!/usr/bin/env node
// GPU bake ↔ CPU noise parity (F13LD.noise v0.12.0+).
//
// The 3D preview bakes the field on the GPU (noiseGLSL); the export, F13LD.mesh, F13LD.lab and
// F13LD.sweep build from the CPU library (DeterministicNoise, noise revision 2). This drives the
// real page in Chrome, bakes each case, reads the baked grid back, and compares it with
// DeterministicNoise evaluated at the same grid points in the same page.
//
//   python -m http.server 8777          (from the folder that holds f13ld.noise)
//   node tests/gpu-parity.js [--url http://127.0.0.1:8777/f13ld.noise/index.html]
//                            [--chrome <path>] [--quality low|medium|high] [--stride 2] [--headed]
//
// Pass: on every case, |Δ| ≤ 5e-3 (normalized units, field range ≈ ±1) at ≥ 99.9 % of points and
// a sheet band (center 0, half-width 0.15) that disagrees at ≤ 0.05 % of points.
// Noise revision 2 makes the lattice exact on both sides (integer permutation, gradient index,
// fold test and Worley cell hash), so what is left is 32-bit rounding of the smooth part:
// ~3e-5 for the Worley types (the 16-bit bake storage), up to a few 1e-3 for the simplex types
// (domain warp amplifies it), and the odd single point on a simplex-cell seam — the 0.6-radius
// simplex kernel has small seams there, and 32- and 64-bit floats can land on either side.
// Needs playwright (NODE_PATH or a global install).
'use strict';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const URL = opt('--url', 'http://127.0.0.1:8777/f13ld.noise/index.html');
const QUALITY = opt('--quality', 'low');
const STRIDE = +opt('--stride', 2);
let chromium;
for (const m of ['playwright', 'playwright-core', '/opt/npm-tools/node_modules/playwright']) {
  try { chromium = require(m).chromium; break; } catch (e) { /* next */ }
}
if (!chromium) { console.error('playwright not found — npm i -g playwright (or set NODE_PATH)'); process.exit(2); }

const CASES = [
  ['simplex', {}],
  ['simplex s42 aniso', { noiseType: 'simplex', seed: 42, scaleY: 2.0 }],
  ['fbm 5 oct', { noiseType: 'fbm', octaves: 5 }],
  ['fbm lac2.5 g.6 s7', { noiseType: 'fbm', octaves: 3, lacunarity: 2.5, gain: 0.6, seed: 7 }],
  ['ridged s11', { noiseType: 'ridged', frequency: 0.25, seed: 11 }],
  ['billow', { noiseType: 'billow' }],
  ['warp 1.5', { noiseType: 'warp', warpStrength: 1.5 }],
  ['warp 2.5 8 oct', { noiseType: 'warp', warpStrength: 2.5, octaves: 8, seed: 4 }],
  ['veined', { noiseType: 'veined', veinTurb: 3, veinFreq: 3, seed: 2 }],
  ['veined aniso', { noiseType: 'veined', veinTurb: 5, veinFreq: 4.5, seed: 13, scaleX: 0.5, octaves: 2 }],
  ['curl', { noiseType: 'curl', curlStep: 0.15, potentialScale: 1.3 }],
  ['cellular euc', { noiseType: 'cellular', frequency: 0.4 }],
  ['cellular man j1 s5', { noiseType: 'cellular', distanceMetric: 'manhattan', jitter: 1.0, seed: 5, frequency: 0.4 }],
  ['cellular cheb j0', { noiseType: 'cellular', distanceMetric: 'chebyshev', jitter: 0.0, frequency: 0.5 }],
  ['foam', { noiseType: 'foam', frequency: 0.4 }],
  ['foam man j.3', { noiseType: 'foam', distanceMetric: 'manhattan', jitter: 0.3, seed: 8, frequency: 0.45 }],
  ['strut', { noiseType: 'strut', frequency: 0.4 }],
  ['strut cheb j.9', { noiseType: 'strut', distanceMetric: 'chebyshev', jitter: 0.9, seed: 2, frequency: 0.35 }],
  ['high frequency', { noiseType: 'fbm', frequency: 1.0, octaves: 4 }],
];
const DEF = { noiseType: 'simplex', frequency: 0.30, octaves: 4, lacunarity: 2.0, gain: 0.5, warpStrength: 1.0,
  distanceMetric: 'euclidean', curlStep: 0.10, potentialScale: 1.0, veinTurb: 3.0, veinFreq: 3.0, jitter: 0.6,
  seed: 0, scaleX: 1, scaleY: 1, scaleZ: 1 };

(async () => {
  const launch = { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], headless: !argv.includes('--headed') };
  const ch = opt('--chrome', require('fs').existsSync('/opt/google/chrome/chrome') ? '/opt/google/chrome/chrome' : null);
  if (ch) launch.executablePath = ch;
  if (argv.includes('--headed')) launch.args = [];
  const browser = await chromium.launch(launch);
  const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route(/f13ld\.queue|fonts\.googleapis|fonts\.gstatic/, r => r.abort());
  await page.goto(URL);
  await page.waitForFunction(() => window.raymarcher && raymarcher.hasField, null, { timeout: 180000 });
  await page.evaluate(q => onQualityChange(q), QUALITY);
  console.log(`F13LD.noise GPU bake ↔ CPU parity — quality ${QUALITY}, every ${STRIDE === 1 ? '' : STRIDE + 'nd '}grid point\n`);
  console.log('case'.padEnd(22), 'N'.padStart(4), 'max |Δ|'.padStart(10), 'p99.9 |Δ|'.padStart(10), 'band diff'.padStart(10), '  ms bake');
  let bad = 0;
  for (const [name, ui] of CASES) {
    const v = Object.assign({}, DEF, ui);
    const t0 = Date.now();
    await page.evaluate(v => {
      for (const k in v) { const el = document.getElementById(k); if (el) el.value = String(v[k]); }
      updateControlVisibility();
      raymarcher.setParams(getParams());   // straight to the bake, no debounce
    }, v);
    await page.waitForFunction(() => !raymarcher.bake && raymarcher.viewKey === noiseFieldKeyOf(getParams()) + '|' + BAKE_N[currentQuality], null, { timeout: 300000 });
    const ms = Date.now() - t0;
    const r = await page.evaluate(stride => {
      const f = raymarcher.readField(), N = f.N, H = Math.PI, SC = 5 / Math.PI;
      const p = getParams(), S = SC * p.frequency;
      const mid = (f.noiseMin + f.noiseMax) / 2, hr = Math.max((f.noiseMax - f.noiseMin) / 2, 0.001);
      const ds = []; let band = 0, n = 0;
      for (let k = 0; k < N; k += stride) for (let j = 0; j < N; j += stride) for (let i = 0; i < N; i += stride) {
        const x = -H + i * 2 * H / (N - 1), y = -H + j * 2 * H / (N - 1), z = -H + k * 2 * H / (N - 1);
        const cpu = Math.max(-2, Math.min(2, (DeterministicNoise.sample(p, x * p.scaleX * S, y * p.scaleY * S, z * p.scaleZ * S) - mid) / hr));
        const gpu = f.data[k * N * N + j * N + i];
        ds.push(Math.abs(cpu - gpu)); n++;
        if ((Math.abs(cpu) < 0.15) !== (Math.abs(gpu) < 0.15)) band++;
      }
      ds.sort((a, b) => a - b);
      return { N, max: ds[ds.length - 1], p999: ds[Math.floor(ds.length * 0.999)], band: band / n };
    }, STRIDE);
    const ok = r.p999 <= 5e-3 && r.band <= 5e-4;
    if (!ok) bad++;
    console.log(name.padEnd(22), String(r.N).padStart(4), r.max.toExponential(1).padStart(10), r.p999.toExponential(1).padStart(10),
      ((100 * r.band).toFixed(3) + '%').padStart(10), String(ms).padStart(9), ok ? '' : '  FAIL');
  }
  if (errors.length) { console.log('\npage errors:\n  ' + errors.join('\n  ')); bad++; }
  await browser.close();
  console.log(bad ? `\nFAIL — ${bad} case(s)` : '\nPASS — the GPU preview bakes the same field the CPU exports');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
