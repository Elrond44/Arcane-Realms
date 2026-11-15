// Arcane Realms audio engine: 100% procedural WebAudio (adapted from the Stellar Frontier engine).
// SFX are synthesised once into small AudioBuffers (OfflineAudioContext) and played through a voice-limited
// chain -> SFX bus (+ reverb send). Music is generative and adaptive (explore / combat / boss / menu layers).
// Buses: sfx + music + ambience -> master -> compressor -> limiter -> destination. Unlocks on the first tap.
const SR = 32000; // render rate for SFX buffers (played back resampled; keeps memory small)
const rv = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rv(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function makeNoise(c, kind, dur, sr = c.sampleRate) {
  const n = Math.ceil(dur * sr); const b = c.createBuffer(1, n, sr); const d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w;
    else if (kind === 'pink') { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22; }
    else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
  }
  return b;
}
// Generated impulse response: decaying stereo noise that darkens over time (no samples needed)
function makeIR(c, dur, decay, bright = 0.6) {
  const sr = c.sampleRate, n = Math.ceil(dur * sr), pre = Math.floor(0.012 * sr); const b = c.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let y = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / (n - pre); const k = bright * (1 - t) + 0.04; // one-pole lowpass closing over time
      y += ((Math.random() * 2 - 1) - y) * k; d[i] = y * Math.pow(1 - t, decay) * (i < pre + 400 ? (i - pre) / 400 : 1);
    }
  }
  return b;
}
function tanhCurve(k) { const n = 1024, cu = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; cu[i] = Math.tanh(x * k) / Math.tanh(k); } return cu; }

// ---------- tiny offline synthesis toolkit ----------
class Syn {
  constructor(c) { this.c = c; this.out = c.destination; this.nb = {}; }
  noise(kind) { return this.nb[kind] || (this.nb[kind] = makeNoise(this.c, kind, 1.5)); }
  gain(v = 1, to = this.out) { const g = this.c.createGain(); g.gain.value = v; g.connect(to); return g; }
  filt(type, f, q = 0.7, to = this.out, f1, t = 0, d = 0) {
    const b = this.c.createBiquadFilter(); b.type = type; b.Q.value = q; b.frequency.setValueAtTime(f, t);
    if (f1) b.frequency.exponentialRampToValueAtTime(f1, t + d); b.connect(to); return b;
  }
  shaper(k, to = this.out, post = 0.7) { const w = this.c.createWaveShaper(); w.curve = tanhCurve(k); w.oversample = '2x'; const g = this.gain(post, to); w.connect(g); return w; }
  env(g, t, a, v, d) { const p = g.gain; p.setValueAtTime(0, t); p.linearRampToValueAtTime(v, t + a); p.exponentialRampToValueAtTime(0.0001, t + a + d); }
  osc({ type = 'sine', f = 440, f1, t = 0, a = 0.002, d = 0.3, v = 0.3, to = this.out, glide, detune = 0 }) {
    const c = this.c, o = c.createOscillator(), g = c.createGain(); o.type = type; o.detune.value = detune;
    o.frequency.setValueAtTime(f, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + (glide || a + d));
    this.env(g, t, a, v, d); o.connect(g); g.connect(to); o.start(t); o.stop(t + a + d + 0.05); return o;
  }
  nz({ kind = 'white', t = 0, a = 0.001, d = 0.2, v = 0.3, type = 'lowpass', f = 1000, f1, q = 0.7, to = this.out }) {
    const c = this.c, s = c.createBufferSource(); s.buffer = this.noise(kind); s.loop = true;
    const fl = this.filt(type, f, q, undefined, undefined); fl.disconnect(); fl.frequency.setValueAtTime(f, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + a + d);
    const g = c.createGain(); this.env(g, t, a, v, d); s.connect(fl); fl.connect(g); g.connect(to); s.start(t, Math.random()); s.stop(t + a + d + 0.05); return s;
  }
  partials(f, ratios, vols, decs, t, to = this.out, a = 0.002) { ratios.forEach((r, i) => this.osc({ f: f * r, t, a, d: decs[i], v: vols[i], to })); }
  brass(f, t, d, v, to = this.out) { // two detuned saws through an enveloped lowpass
    const c = this.c; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(f * 1.2, t); lp.frequency.linearRampToValueAtTime(f * 7, t + 0.07); lp.frequency.linearRampToValueAtTime(f * 3.5, t + Math.min(d, 0.5));
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.04); g.gain.setValueAtTime(v * 0.85, t + d * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    lp.connect(g); g.connect(to);
    for (const det of [-7, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; const vib = c.createOscillator(); vib.frequency.value = 5.2; const vg = c.createGain(); vg.gain.value = 4; vib.connect(vg); vg.connect(o.detune); o.connect(lp); o.start(t); o.stop(t + d + 0.05); vib.start(t); vib.stop(t + d + 0.05); }
  }
}
// ---------- sound recipes: name: [duration, variants, fn] ----------
const whoosh = (s, f0, f1, d, v, q = 1.4) => { s.nz({ kind: 'pink', a: d * 0.35, d: d * 0.65, v, type: 'bandpass', f: f0, f1, q }); };
const RECIPES = {
  swing: [0.35, 4, (s) => { whoosh(s, rv(500, 700), rv(2200, 3000), 0.22, 0.9); s.nz({ t: 0.08, d: 0.08, v: 0.15, type: 'highpass', f: 5000 }); }],
  swish: [0.22, 4, (s) => { whoosh(s, rv(1200, 1500), rv(4000, 5000), 0.12, 0.8, 2); }],
  chop: [0.5, 3, (s) => { whoosh(s, rv(250, 320), rv(900, 1200), 0.32, 1.1, 1); s.osc({ f: 90, f1: 60, t: 0.1, a: 0.08, d: 0.2, v: 0.3 }); }],
  thrust: [0.3, 3, (s) => { whoosh(s, rv(900, 1100), rv(2500, 3200), 0.14, 0.9, 2.5); s.osc({ type: 'triangle', f: 300, f1: 180, d: 0.06, v: 0.12 }); }],
  cast: [0.6, 3, (s) => { for (let i = 0; i < 5; i++) { const f = mtof(ri(76, 90)); s.osc({ f, f1: f * 1.5, t: i * 0.03, a: 0.01, d: 0.3, v: 0.07 }); } s.nz({ a: 0.05, d: 0.35, v: 0.35, type: 'bandpass', f: 1500, f1: 5000, q: 3 }); s.osc({ type: 'sawtooth', f: 220, f1: 440, a: 0.03, d: 0.25, v: 0.08, to: s.filt('lowpass', 1500) }); }],
  bow: [0.5, 3, (s) => { const f = rv(160, 200); s.osc({ type: 'sawtooth', f, f1: f * 0.98, d: 0.25, v: 0.25, to: s.filt('lowpass', 1600, 3) }); s.osc({ type: 'triangle', f: f * 2, d: 0.15, v: 0.15 }); s.nz({ d: 0.02, v: 0.4, type: 'highpass', f: 3000 }); whoosh(s, 2000, 5000, 0.18, 0.35, 2); }],
  hitBlade: [0.45, 4, (s) => { const d = s.shaper(2.5); s.osc({ f: rv(140, 170), f1: 55, d: 0.12, v: 0.8, to: d }); s.nz({ kind: 'pink', d: 0.08, v: 0.7, type: 'bandpass', f: rv(1500, 2200), f1: 600, q: 1.2, to: d }); s.partials(rv(1400, 1900), [1, 2.4, 3.9], [0.06, 0.04, 0.025], [0.25, 0.18, 0.12], 0.005); }],
  hitStab: [0.35, 4, (s) => { const d = s.shaper(2); s.osc({ f: rv(200, 240), f1: 80, d: 0.08, v: 0.7, to: d }); s.nz({ d: 0.05, v: 0.6, type: 'bandpass', f: rv(2500, 3500), f1: 900, q: 1.5 }); s.nz({ kind: 'pink', d: 0.1, v: 0.35, type: 'lowpass', f: 900 }); }],
  hitHeavy: [0.7, 3, (s) => { const d = s.shaper(3.5); s.osc({ f: rv(85, 100), f1: 32, d: 0.3, v: 1, to: d }); s.nz({ kind: 'pink', d: 0.25, v: 0.8, type: 'lowpass', f: 2500, f1: 200, to: d }); for (let i = 0; i < 5; i++) s.nz({ t: rv(0.01, 0.2), d: 0.015, v: 0.25, type: 'bandpass', f: rv(800, 2500), q: 4 }); }],
  hitMagic: [0.7, 3, (s) => { s.nz({ d: 0.25, v: 0.6, type: 'bandpass', f: 4000, f1: 800, q: 2 }); s.osc({ f: 180, f1: 70, d: 0.15, v: 0.5 }); for (let i = 0; i < 6; i++) { const f = mtof(ri(79, 96)); s.osc({ f, t: rv(0, 0.12), a: 0.003, d: rv(0.2, 0.45), v: 0.05 }); } }],
  crit: [0.8, 3, (s) => { const d = s.shaper(3); s.osc({ f: 120, f1: 40, d: 0.25, v: 1, to: d }); s.nz({ d: 0.05, v: 0.9, type: 'highpass', f: 2500 }); s.partials(rv(1700, 2000), [1, 1.5, 2.01, 3.02], [0.12, 0.09, 0.07, 0.04], [0.6, 0.5, 0.4, 0.3], 0.01); whoosh(s, 3000, 900, 0.3, 0.3, 2); }],
  creatureHurt: [0.35, 4, (s) => { const f = rv(320, 480); const bp = s.filt('bandpass', rv(900, 1300), 3, s.gain(1.5)); s.osc({ type: 'sawtooth', f, f1: f * 0.6, d: 0.18, v: 0.5, to: bp }); s.nz({ kind: 'pink', d: 0.08, v: 0.4, type: 'lowpass', f: 1200 }); }],
  creatureDie: [0.9, 3, (s) => { const f = rv(260, 360); const bp = s.filt('bandpass', 1000, 2.5, s.gain(1.4)); s.osc({ type: 'sawtooth', f, f1: f * 0.35, a: 0.01, d: 0.5, v: 0.5, to: bp }); s.nz({ kind: 'pink', t: 0.05, a: 0.02, d: 0.5, v: 0.5, type: 'lowpass', f: 3000, f1: 200 }); for (let i = 0; i < 6; i++) s.osc({ f: mtof(ri(84, 96)), t: 0.15 + i * 0.05, d: 0.25, v: 0.035 }); }],
  growl: [0.9, 3, (s) => { const f = rv(70, 95); const bp = s.filt('bandpass', 500, 2, s.gain(1.6)); const d = s.shaper(3, bp); s.osc({ type: 'sawtooth', f, f1: f * 1.3, a: 0.08, d: 0.6, v: 0.6, to: d }); s.nz({ kind: 'brown', a: 0.08, d: 0.6, v: 0.6, type: 'bandpass', f: 400, q: 2 }); }],
  howl: [1.2, 2, (s) => { const f = rv(500, 600); const bp = s.filt('bandpass', 1400, 4, s.gain(1.5)); s.osc({ type: 'sawtooth', f: f * 0.8, f1: f * 1.2, a: 0.15, d: 0.9, v: 0.35, to: bp, glide: 0.5 }); }],
  arrow: [0.4, 3, (s) => { s.osc({ type: 'sawtooth', f: rv(220, 260), d: 0.12, v: 0.2, to: s.filt('lowpass', 1800, 4) }); whoosh(s, 2500, 6000, 0.2, 0.3, 2); }],
  fireCast: [0.8, 3, (s) => { s.nz({ kind: 'pink', a: 0.08, d: 0.5, v: 0.8, type: 'bandpass', f: 600, f1: 2200, q: 1 }); s.osc({ f: 110, f1: 220, a: 0.05, d: 0.4, v: 0.25 }); for (let i = 0; i < 8; i++) s.nz({ t: rv(0.05, 0.5), d: 0.01, v: 0.3, type: 'bandpass', f: rv(2000, 5000), q: 6 }); }],
  fireBurst: [1.0, 3, (s) => { const d = s.shaper(2.5); s.nz({ kind: 'pink', a: 0.005, d: 0.6, v: 1, type: 'lowpass', f: 4000, f1: 300, to: d }); s.osc({ f: 90, f1: 35, d: 0.4, v: 0.8, to: d }); for (let i = 0; i < 12; i++) s.nz({ t: rv(0.05, 0.8), d: 0.008, v: 0.3, type: 'bandpass', f: rv(2000, 6000), q: 6 }); }],
  heal: [1.2, 2, (s) => { [0, 4, 7, 12, 16].forEach((n, i) => s.osc({ f: mtof(72 + n), t: i * 0.07, a: 0.01, d: 0.7, v: 0.09 })); s.nz({ a: 0.2, d: 0.6, v: 0.15, type: 'bandpass', f: 6000, q: 3 }); }],
  clank: [0.6, 3, (s) => { s.partials(rv(500, 700), [1, 2.7, 5.2, 8.1], [0.25, 0.15, 0.08, 0.05], [0.4, 0.3, 0.2, 0.12], 0); s.nz({ d: 0.03, v: 0.6, type: 'highpass', f: 2000 }); s.osc({ f: 120, f1: 60, d: 0.1, v: 0.5 }); }],
  block: [0.5, 3, (s) => { s.partials(rv(900, 1200), [1, 2.3, 3.7], [0.2, 0.12, 0.06], [0.35, 0.25, 0.15], 0); s.nz({ d: 0.04, v: 0.7, type: 'highpass', f: 3000 }); }],
  bossRoar: [2.4, 2, (s) => { const bp = s.filt('bandpass', 380, 1.5, s.gain(2)); const d = s.shaper(4, bp); s.osc({ type: 'sawtooth', f: 48, f1: 70, a: 0.3, d: 1.7, v: 0.7, to: d, glide: 1 }); s.osc({ type: 'sawtooth', f: 73, f1: 52, a: 0.3, d: 1.7, v: 0.5, to: d }); s.nz({ kind: 'brown', a: 0.3, d: 1.8, v: 0.8, type: 'bandpass', f: 300, q: 1.5 }); s.nz({ kind: 'pink', a: 0.4, d: 1.3, v: 0.25, type: 'bandpass', f: 1500, q: 2 }); }],
  slam: [1.6, 3, (s) => { const d = s.shaper(3); s.osc({ f: 62, f1: 24, d: 0.9, v: 1, to: d }); s.nz({ kind: 'brown', d: 1.2, v: 0.9, type: 'lowpass', f: 400, f1: 60 }); s.nz({ kind: 'pink', d: 0.3, v: 0.6, type: 'lowpass', f: 3000, f1: 300, to: d }); for (let i = 0; i < 14; i++) s.nz({ t: rv(0.05, 1.0), d: rv(0.01, 0.04), v: 0.2, type: 'bandpass', f: rv(600, 2500), q: 4 }); }],
  roots: [1.0, 3, (s) => { for (let i = 0; i < 10; i++) s.nz({ t: rv(0, 0.4), d: rv(0.02, 0.06), v: 0.4, type: 'bandpass', f: rv(300, 1500), q: 5 }); s.osc({ f: 80, f1: 40, d: 0.4, v: 0.6 }); s.nz({ kind: 'brown', a: 0.02, d: 0.6, v: 0.6, type: 'lowpass', f: 600 }); }],
  telegraph: [0.9, 2, (s) => { s.osc({ type: 'sawtooth', f: 110, f1: 220, a: 0.5, d: 0.3, v: 0.25, to: s.filt('lowpass', 1200, 4), glide: 0.8 }); s.nz({ a: 0.6, d: 0.2, v: 0.2, type: 'bandpass', f: 800, f1: 3000, q: 3 }); }],
  playerHurt: [0.5, 3, (s) => { const d = s.shaper(2.5); s.osc({ f: 140, f1: 60, d: 0.18, v: 0.9, to: d }); s.nz({ kind: 'pink', d: 0.12, v: 0.6, type: 'lowpass', f: 1800, f1: 300 }); s.osc({ type: 'sawtooth', f: 200, f1: 150, a: 0.01, d: 0.12, v: 0.12, to: s.filt('bandpass', 700, 3) }); }],
  dash: [0.45, 3, (s) => { whoosh(s, 400, 3500, 0.3, 1, 1.2); s.nz({ t: 0.05, d: 0.25, v: 0.2, type: 'highpass', f: 4000, f1: 8000 }); }],
  flask: [1.2, 1, (s) => { for (let i = 0; i < 4; i++) s.osc({ f: rv(300, 420), f1: rv(500, 650), t: i * 0.11, a: 0.01, d: 0.08, v: 0.2 }); [0, 7, 12, 19].forEach((n, i) => s.osc({ f: mtof(76 + n), t: 0.45 + i * 0.06, d: 0.5, v: 0.07 })); }],
  step: [0.15, 6, (s) => { s.nz({ kind: 'pink', d: 0.05, v: 0.5, type: 'bandpass', f: rv(500, 900), q: 1.5 }); s.osc({ f: rv(70, 90), f1: 50, d: 0.05, v: 0.3 }); }],
  stepStone: [0.15, 6, (s) => { s.nz({ d: 0.035, v: 0.45, type: 'bandpass', f: rv(1800, 2600), q: 2 }); s.osc({ f: rv(110, 140), f1: 70, d: 0.04, v: 0.3 }); }],
  coin: [0.6, 3, (s) => { const f = rv(2200, 2500); s.partials(f, [1, 1.5, 2.6], [0.12, 0.08, 0.04], [0.35, 0.25, 0.15], 0); s.partials(f * 1.33, [1, 1.5], [0.1, 0.05], [0.4, 0.3], 0.07); }],
  essence: [0.8, 3, (s) => { for (let i = 0; i < 6; i++) s.osc({ f: mtof(84 + [0, 3, 7, 10, 12, 15][i]), t: i * 0.035, a: 0.005, d: 0.35, v: 0.06 }); s.nz({ a: 0.05, d: 0.3, v: 0.1, type: 'bandpass', f: 7000, q: 3 }); }],
  crystal: [1.0, 3, (s) => { const f = rv(1300, 1600); s.partials(f, [1, 2.76, 5.4], [0.12, 0.07, 0.04], [0.8, 0.5, 0.3], 0); s.nz({ d: 0.02, v: 0.4, type: 'highpass', f: 4000 }); }],
  crystalHit: [0.5, 4, (s) => { const f = rv(1700, 2200); s.partials(f, [1, 2.76, 5.4], [0.15, 0.08, 0.04], [0.35, 0.2, 0.1], 0); s.nz({ d: 0.03, v: 0.6, type: 'highpass', f: 3000 }); s.osc({ f: 160, f1: 80, d: 0.05, v: 0.3 }); }],
  lootDrop: [0.8, 2, (s) => { s.osc({ f: 120, f1: 60, d: 0.1, v: 0.5 }); [0, 7, 12].forEach((n, i) => s.osc({ f: mtof(79 + n), t: 0.05 + i * 0.06, d: 0.4, v: 0.08 })); }],
  lootRare: [2.0, 1, (s) => { [0, 4, 7, 11, 14, 19, 23].forEach((n, i) => s.osc({ f: mtof(72 + n), t: i * 0.07, a: 0.01, d: 1.1, v: 0.08 })); s.nz({ a: 0.3, d: 1.2, v: 0.15, type: 'bandpass', f: 5000, f1: 9000, q: 2 }); s.osc({ f: 65, f1: 45, d: 0.6, v: 0.4 }); }],
  chest: [1.6, 1, (s) => { s.osc({ type: 'sawtooth', f: 90, f1: 140, a: 0.05, d: 0.35, v: 0.2, to: s.filt('bandpass', 600, 6) }); s.osc({ f: 100, f1: 50, t: 0.42, d: 0.12, v: 0.6 }); s.nz({ t: 0.42, d: 0.08, v: 0.4, type: 'lowpass', f: 1500 }); [0, 4, 7, 12, 16].forEach((n, i) => s.osc({ f: mtof(76 + n), t: 0.5 + i * 0.06, d: 0.8, v: 0.07 })); }],
  portal: [2.2, 1, (s) => { s.nz({ kind: 'pink', a: 0.4, d: 1.6, v: 0.8, type: 'bandpass', f: 300, f1: 3000, q: 2 }); s.osc({ type: 'sawtooth', f: 55, f1: 220, a: 0.3, d: 1.5, v: 0.15, to: s.filt('lowpass', 900, 3), glide: 1.6 }); for (let i = 0; i < 10; i++) s.osc({ f: mtof(ri(76, 100)), t: rv(0.2, 1.4), d: 0.4, v: 0.04 }); }],
  shrine: [3.0, 1, (s) => { [[62, 0], [69, 0.05], [74, 0.1], [78, 0.15], [81, 0.2]].forEach(([n, t]) => { s.osc({ f: mtof(n), t, a: 0.3, d: 2.2, v: 0.07 }); s.osc({ f: mtof(n) * 1.003, t, a: 0.3, d: 2.2, v: 0.05 }); }); s.nz({ a: 0.6, d: 1.8, v: 0.12, type: 'bandpass', f: 2500, q: 6 }); }],
  altar: [2.0, 1, (s) => { const d = s.shaper(2); s.osc({ f: 70, f1: 40, d: 0.8, v: 0.8, to: d }); [57, 64, 69, 76].forEach((n, i) => s.osc({ type: 'triangle', f: mtof(n), t: 0.1 + i * 0.05, a: 0.05, d: 1.4, v: 0.08 })); s.nz({ a: 0.1, d: 1.2, v: 0.3, type: 'bandpass', f: 1200, f1: 400, q: 2 }); }],
  levelUp: [2.6, 1, (s) => { [[60, 0], [64, 0.12], [67, 0.24], [72, 0.36]].forEach(([n, t]) => s.brass(mtof(n), t, 0.5, 0.18)); s.brass(mtof(72), 0.5, 1.6, 0.2); s.brass(mtof(76), 0.5, 1.6, 0.14); s.brass(mtof(79), 0.5, 1.6, 0.12); s.nz({ t: 0.5, a: 0.05, d: 1.5, v: 0.12, type: 'bandpass', f: 7000, q: 2 }); }],
  quest: [2.0, 1, (s) => { [67, 72, 76, 79, 84].forEach((n, i) => s.osc({ type: 'triangle', f: mtof(n), t: i * 0.08, a: 0.01, d: 1.0, v: 0.1 })); s.osc({ f: 65, f1: 50, t: 0.32, d: 0.5, v: 0.4 }); }],
  upgrade: [1.4, 2, (s) => { s.partials(rv(600, 700), [1, 2.7, 5.2], [0.25, 0.14, 0.07], [0.6, 0.4, 0.25], 0); s.nz({ d: 0.03, v: 0.7, type: 'highpass', f: 2000 }); s.osc({ f: 100, f1: 50, d: 0.15, v: 0.6 }); [0, 7, 12, 19].forEach((n, i) => s.osc({ f: mtof(79 + n), t: 0.2 + i * 0.06, d: 0.6, v: 0.06 })); }],
  artifactUp: [3.2, 1, (s) => { s.osc({ type: 'sawtooth', f: 110, f1: 880, a: 1.2, d: 0.3, v: 0.15, to: s.filt('lowpass', 2500, 4), glide: 1.4 }); s.nz({ a: 1.2, d: 0.4, v: 0.4, type: 'bandpass', f: 400, f1: 6000, q: 2 }); const d = s.shaper(2); s.osc({ f: 80, f1: 30, t: 1.45, d: 1.2, v: 1, to: d }); [60, 67, 72, 76, 79, 84].forEach((n, i) => { s.osc({ f: mtof(n), t: 1.45 + i * 0.04, a: 0.01, d: 1.5, v: 0.07 }); }); s.nz({ t: 1.45, a: 0.01, d: 1.4, v: 0.25, type: 'bandpass', f: 6000, q: 2 }); }],
  equip: [0.5, 3, (s) => { s.nz({ kind: 'pink', d: 0.12, v: 0.5, type: 'bandpass', f: 1200, q: 1 }); s.partials(rv(1100, 1400), [1, 2.7], [0.08, 0.04], [0.2, 0.12], 0.06); s.osc({ f: 150, f1: 90, t: 0.05, d: 0.06, v: 0.3 }); }],
  tap: [0.12, 2, (s) => { s.osc({ type: 'triangle', f: rv(1100, 1250), f1: 900, d: 0.04, v: 0.25 }); s.nz({ d: 0.01, v: 0.15, type: 'highpass', f: 4000 }); }],
  open: [0.5, 1, (s) => { s.nz({ kind: 'pink', a: 0.05, d: 0.2, v: 0.4, type: 'bandpass', f: 600, f1: 2200, q: 1.5 }); s.osc({ type: 'triangle', f: 660, t: 0.05, d: 0.25, v: 0.12 }); s.osc({ type: 'triangle', f: 990, t: 0.1, d: 0.25, v: 0.08 }); }],
  close: [0.4, 1, (s) => { s.nz({ kind: 'pink', a: 0.03, d: 0.15, v: 0.35, type: 'bandpass', f: 2000, f1: 600, q: 1.5 }); s.osc({ type: 'triangle', f: 880, f1: 660, d: 0.15, v: 0.1 }); }],
  denied: [0.4, 1, (s) => { s.osc({ type: 'square', f: 180, d: 0.1, v: 0.12, to: s.filt('lowpass', 900) }); s.osc({ type: 'square', f: 140, t: 0.12, d: 0.14, v: 0.12, to: s.filt('lowpass', 900) }); }],
  discover: [1.6, 1, (s) => { for (let i = 0; i < 9; i++) s.osc({ type: 'triangle', f: mtof(67 + [0, 2, 4, 7, 9, 12, 14, 16, 19][i]), t: i * 0.045, a: 0.004, d: 0.8, v: 0.07 }); }],
  victory: [2.6, 1, (s) => { [[67, 0, 0.3], [67, 0.18, 0.15], [72, 0.36, 1.8]].forEach(([n, t, d]) => { s.brass(mtof(n), t, d, 0.18); s.brass(mtof(n - 5), t, d, 0.12); }); s.osc({ f: 60, f1: 40, t: 0.36, d: 0.8, v: 0.5 }); }],
  death: [2.8, 1, (s) => { [[62, 0], [61, 0.5], [58, 1.0]].forEach(([n, t]) => s.brass(mtof(n), t, 0.9, 0.12)); s.osc({ f: 55, f1: 35, d: 2, v: 0.4 }); }],
};
// mix: [vol, minGap, maxSame, priority, reverbSend, pitchVar, volVar]
const MIX = {
  swing: [0.5, 0.04, 3, 2, 0.15, 0.06, 0.2], swish: [0.45, 0.03, 3, 2, 0.1, 0.08, 0.2], chop: [0.6, 0.05, 2, 2, 0.15, 0.05, 0.2], thrust: [0.5, 0.04, 3, 2, 0.12, 0.06, 0.2], cast: [0.45, 0.05, 3, 2, 0.35, 0.05, 0.2], bow: [0.5, 0.04, 3, 2, 0.15, 0.05, 0.2],
  hitBlade: [0.55, 0.03, 4, 3, 0.15, 0.08, 0.2], hitStab: [0.5, 0.03, 4, 3, 0.12, 0.08, 0.2], hitHeavy: [0.7, 0.04, 3, 3, 0.2, 0.06, 0.2], hitMagic: [0.5, 0.03, 4, 3, 0.3, 0.06, 0.2], crit: [0.6, 0.06, 2, 4, 0.3, 0.05, 0.1],
  creatureHurt: [0.35, 0.06, 3, 1, 0.15, 0.12, 0.3], creatureDie: [0.45, 0.05, 3, 2, 0.25, 0.1, 0.2], growl: [0.4, 0.4, 2, 1, 0.3, 0.1, 0.2], howl: [0.3, 1, 1, 1, 0.6, 0.08, 0.2], arrow: [0.35, 0.05, 3, 1, 0.2, 0.1, 0.2], fireCast: [0.45, 0.1, 3, 2, 0.3, 0.08, 0.2], fireBurst: [0.55, 0.06, 3, 3, 0.35, 0.08, 0.2], heal: [0.4, 0.3, 2, 2, 0.5, 0.03, 0.1],
  clank: [0.45, 0.05, 3, 2, 0.3, 0.08, 0.2], block: [0.5, 0.05, 3, 3, 0.25, 0.08, 0.2], bossRoar: [0.8, 1, 1, 5, 0.5, 0.03, 0], slam: [0.85, 0.15, 2, 5, 0.45, 0.05, 0.1], roots: [0.6, 0.1, 3, 4, 0.3, 0.08, 0.2], telegraph: [0.35, 0.15, 3, 3, 0.3, 0.05, 0.1],
  playerHurt: [0.6, 0.08, 2, 4, 0.15, 0.06, 0.1], dash: [0.5, 0.1, 2, 3, 0.15, 0.06, 0.1], flask: [0.5, 0.3, 1, 4, 0.3, 0, 0], step: [0.16, 0.12, 2, 0, 0.05, 0.12, 0.3], stepStone: [0.16, 0.12, 2, 0, 0.25, 0.12, 0.3],
  coin: [0.3, 0.035, 4, 2, 0.2, 0.06, 0.2], essence: [0.32, 0.05, 3, 2, 0.3, 0.05, 0.2], crystal: [0.4, 0.05, 3, 2, 0.35, 0.05, 0.2], crystalHit: [0.45, 0.04, 3, 2, 0.3, 0.08, 0.2], lootDrop: [0.45, 0.08, 3, 3, 0.3, 0.04, 0.1], lootRare: [0.6, 0.3, 1, 5, 0.45, 0, 0], chest: [0.6, 0.3, 1, 4, 0.3, 0, 0],
  portal: [0.6, 0.5, 1, 4, 0.5, 0, 0], shrine: [0.55, 0.5, 1, 4, 0.6, 0, 0], altar: [0.6, 0.5, 1, 4, 0.5, 0, 0], levelUp: [0.6, 0.5, 1, 5, 0.4, 0, 0], quest: [0.55, 0.4, 1, 5, 0.4, 0, 0], upgrade: [0.5, 0.08, 2, 4, 0.3, 0.02, 0], artifactUp: [0.7, 0.5, 1, 5, 0.5, 0, 0],
  equip: [0.45, 0.06, 2, 3, 0.15, 0.06, 0.1], tap: [0.3, 0.03, 2, 1, 0.05, 0.04, 0.1], open: [0.35, 0.08, 1, 2, 0.2, 0, 0], close: [0.3, 0.08, 1, 2, 0.2, 0, 0], denied: [0.35, 0.15, 1, 2, 0, 0, 0], discover: [0.5, 0.2, 1, 4, 0.4, 0, 0], victory: [0.6, 0.5, 1, 5, 0.4, 0, 0], death: [0.6, 1, 1, 5, 0.5, 0, 0],
};
const DRUMS = {
  frame: [0.6, 2, (s) => { s.osc({ f: 95, f1: 55, d: 0.35, v: 0.8 }); s.nz({ kind: 'pink', d: 0.12, v: 0.35, type: 'bandpass', f: 600, q: 1 }); }],
  taiko: [1.2, 2, (s) => { const d = s.shaper(1.8); s.osc({ f: 62, f1: 38, d: 0.8, v: 1, to: d }); s.nz({ kind: 'brown', d: 0.5, v: 0.7, type: 'lowpass', f: 500, f1: 100 }); s.nz({ d: 0.02, v: 0.3, type: 'bandpass', f: 1500 }); }],
  shaker: [0.2, 3, (s) => { s.nz({ a: 0.01, d: 0.06, v: 0.35, type: 'highpass', f: 6000 }); }],
  rim: [0.2, 2, (s) => { s.osc({ type: 'triangle', f: 820, f1: 600, d: 0.04, v: 0.3 }); s.nz({ d: 0.02, v: 0.3, type: 'bandpass', f: 3000, q: 3 }); }],
};

// ---------- generative music ----------
// D dorian (explore), D aeolian + taiko (combat), D phrygian/harmonic (boss), slow pads only (menu)
const SCALES = { dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], phryg: [0, 1, 4, 5, 7, 8, 10] };
const PROG = { explore: [[0, 'dorian'], [3, 'dorian'], [5, 'dorian'], [4, 'dorian']], combat: [[0, 'aeolian'], [5, 'aeolian'], [3, 'aeolian'], [4, 'aeolian']], boss: [[0, 'phryg'], [1, 'phryg'], [0, 'phryg'], [5, 'phryg']] };
class Music {
  constructor(a) {
    this.a = a; const c = a.ctx; this.c = c; this.out = c.createGain(); this.out.connect(a.musicBus);
    this.rev = c.createConvolver(); this.rev.buffer = makeIR(c, 3.2, 2.2, 0.5); const rg = c.createGain(); rg.gain.value = 0.5; this.rev.connect(rg); rg.connect(this.out);
    this.layers = {}; for (const k of ['pad', 'harp', 'flute', 'perc', 'boss']) { const g = c.createGain(); g.gain.value = 0; g.connect(this.out); const s = c.createGain(); s.gain.value = k === 'perc' ? 0.12 : 0.45; g.connect(s); s.connect(this.rev); this.layers[k] = g; }
    this.mode = 'menu'; this.bar = 0; this.beat = 0; this.next = c.currentTime + 0.2; this.bpm = 72; this.timer = setInterval(() => this.schedule(), 100);
  }
  setMode(m) { this.mode = m; const t = this.c.currentTime; const L = this.layers;
    const tgt = { menu: [0.5, 0.25, 0, 0, 0], explore: [0.55, 0.55, 0.35, 0, 0], citadel: [0.5, 0.5, 0.25, 0, 0], combat: [0.5, 0.45, 0.3, 0.75, 0], boss: [0.5, 0.2, 0.2, 0.8, 0.8] }[m] || [0.5, 0.5, 0.3, 0, 0];
    ['pad', 'harp', 'flute', 'perc', 'boss'].forEach((k, i) => L[k].gain.setTargetAtTime(tgt[i], t, 1.2)); }
  voice(dest, nodes, end) { nodes[0].onended = () => { for (const n of nodes) n.disconnect(); }; nodes[0].stop(end); }
  pad(m, t, d) { const c = this.c; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 0.5; const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + d * 0.35); g.gain.linearRampToValueAtTime(0, t + d); lp.connect(g); g.connect(this.layers.pad);
    const os = [-8, 7].map((det) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det; o.connect(lp); o.start(t); return o; }); os[0].onended = () => { for (const o of os) o.disconnect(); lp.disconnect(); g.disconnect(); }; for (const o of os) o.stop(t + d + 0.05); }
  pluck(m, t, v = 0.08, dest = this.layers.harp) { const c = this.c; const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m); const o2 = c.createOscillator(); o2.frequency.value = mtof(m) * 2; const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6); const g2 = c.createGain(); g2.gain.value = 0.25; o.connect(g); o2.connect(g2); g2.connect(g); g.connect(dest); o.start(t); o2.start(t); o.stop(t + 1.7); o2.stop(t + 1.7); o.onended = () => { o.disconnect(); o2.disconnect(); g.disconnect(); g2.disconnect(); }; }
  flute(m, t, d, v = 0.05) { const c = this.c; const o = c.createOscillator(); o.frequency.value = mtof(m); const vib = c.createOscillator(); vib.frequency.value = 5; const vg = c.createGain(); vg.gain.value = 0; vg.gain.linearRampToValueAtTime(6, t + d * 0.6); vib.connect(vg); vg.connect(o.detune);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.08); g.gain.setValueAtTime(v * 0.8, t + d * 0.7); g.gain.linearRampToValueAtTime(0, t + d); o.connect(g); g.connect(this.layers.flute); o.start(t); vib.start(t); o.stop(t + d + 0.05); vib.stop(t + d + 0.05); o.onended = () => { o.disconnect(); vib.disconnect(); vg.disconnect(); g.disconnect(); }; }
  drum(name, t, v, dest = this.layers.perc) { const bs = this.a.buf[name]; if (!bs) return; const s = this.c.createBufferSource(); s.buffer = pick(bs); const g = this.c.createGain(); g.gain.value = v; s.connect(g); g.connect(dest); s.onended = () => { s.disconnect(); g.disconnect(); }; s.start(t); }
  brassStab(m, t, d, v) { const c = this.c; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(1400, t + 0.1); lp.frequency.linearRampToValueAtTime(600, t + d); const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.05); g.gain.linearRampToValueAtTime(0, t + d); lp.connect(g); g.connect(this.layers.boss);
    const os = [-6, 6].map((det) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + d + 0.05); return o; }); os[0].onended = () => { for (const o of os) o.disconnect(); lp.disconnect(); g.disconnect(); }; }
  schedule() {
    const c = this.c; if (c.state !== 'running') { this.next = c.currentTime + 0.1; return; }
    const fight = this.mode === 'combat' || this.mode === 'boss'; const bpm = this.mode === 'boss' ? 116 : fight ? 104 : 72; const spb = 60 / bpm / 2; // eighth notes
    while (this.next < c.currentTime + 0.35) {
      const t = this.next; const step = this.beat % 16; const prog = PROG[this.mode === 'boss' ? 'boss' : fight ? 'combat' : 'explore']; const [deg, sc] = prog[this.bar % 4]; const S = SCALES[sc];
      const root = 50; const note = (i) => root + S[((deg + i) % 7 + 7) % 7] + 12 * Math.floor((deg + i) / 7);
      if (step === 0) { const d = spb * 16 + 0.6; for (const i of [0, 2, 4]) this.pad(note(i) - 12, t, d); this.pad(note(0) - 24, t, d); }
      // harp arpeggio
      if (this.mode !== 'menu' || step % 4 === 0) { const pat = fight ? [0, 2, 4, 7, 4, 2, 0, 4] : [0, 4, 7, 9, 11, 9, 7, 4]; if (fight || step % 2 === 0 || Math.random() < 0.35) this.pluck(note(pat[step % 8]) + (fight ? 0 : 12), t, fight ? 0.06 : 0.07); }
      // flute melody: sparse, stepwise random walk in the scale
      if (step % 4 === 0 && Math.random() < (fight ? 0.5 : 0.6)) { this.mel = clamp((this.mel ?? 4) + pick([-2, -1, -1, 1, 1, 2, 0]), 0, 11); this.flute(note(this.mel) + 12, t, spb * pick([2, 4, 4, 6]), 0.045); }
      // percussion (combat/boss layers)
      if (fight) { if (step % 8 === 0) this.drum('taiko', t, 0.9); if (step % 8 === 4) this.drum('frame', t, 0.7); if (step % 2 === 1) this.drum('shaker', t, 0.4); if (this.mode === 'boss' && (step === 6 || step === 14)) this.drum('taiko', t, 0.6); if (step === 15) this.drum('rim', t, 0.5); }
      else if (this.mode === 'explore' && step % 8 === 4 && Math.random() < 0.4) this.drum('frame', t, 0.25);
      if (this.mode === 'boss' && step % 4 === 0) this.brassStab(note(step === 0 ? 0 : step === 8 ? 4 : 2) - 12, t, spb * 3, 0.06);
      this.next += spb; this.beat++; if (this.beat % 16 === 0) this.bar++;
    }
  }
}
// ---------- ambience beds (forest / citadel) ----------
class Ambience {
  constructor(a) { this.a = a; const c = a.ctx; this.c = c; this.out = c.createGain(); this.out.gain.value = 0; this.out.connect(a.ambBus); this.kind = null; this.nodes = []; this.timer = setInterval(() => this.tick(), 250); }
  set(kind) { if (kind === this.kind) return; this.kind = kind; const c = this.c, t = c.currentTime; this.out.gain.setTargetAtTime(0, t, 0.3); setTimeout(() => this.build(kind), 700); }
  build(kind) { const c = this.c; for (const n of this.nodes) { try { n.stop && n.stop(); } catch (e) { /* */ } n.disconnect(); } this.nodes = [];
    if (!kind) return; const t = c.currentTime;
    const ns = c.createBufferSource(); ns.buffer = this.a.pinkBuf; ns.loop = true; const f = c.createBiquadFilter(); f.type = kind === 'forest' ? 'bandpass' : 'lowpass'; f.frequency.value = kind === 'forest' ? 500 : 220; f.Q.value = 0.6; const g = c.createGain(); g.gain.value = kind === 'forest' ? 0.35 : 0.5;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = kind === 'forest' ? 260 : 60; lfo.connect(lg); lg.connect(f.frequency); ns.connect(f); f.connect(g); g.connect(this.out); ns.start(0, rv(0, 1)); lfo.start(); this.nodes.push(ns, f, g, lfo, lg);
    if (kind === 'citadel') { const o = c.createOscillator(); o.frequency.value = 55; const og = c.createGain(); og.gain.value = 0.05; o.connect(og); og.connect(this.out); o.start(); this.nodes.push(o, og); }
    this.out.gain.setTargetAtTime(1, t, 1.5); }
  chirp(t) { const c = this.c; const o = c.createOscillator(); const g = c.createGain(); const f = rv(2800, 4200); o.frequency.setValueAtTime(f, t); const n = ri(2, 5); g.gain.setValueAtTime(0, t);
    for (let i = 0; i < n; i++) { const tt = t + i * 0.09; o.frequency.setValueAtTime(f * rv(0.9, 1.15), tt); o.frequency.exponentialRampToValueAtTime(f * rv(0.6, 0.8), tt + 0.06); g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.025, tt + 0.01); g.gain.linearRampToValueAtTime(0, tt + 0.07); }
    const p = c.createStereoPanner(); p.pan.value = rv(-0.9, 0.9); o.connect(g); g.connect(p); p.connect(this.out); o.start(t); o.stop(t + n * 0.1 + 0.1); o.onended = () => { o.disconnect(); g.disconnect(); p.disconnect(); }; }
  crackle(t) { const c = this.c; for (let i = 0; i < ri(2, 6); i++) { const s = c.createBufferSource(); s.buffer = this.a.noiseBuf; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = rv(1500, 5000); bp.Q.value = 4; const g = c.createGain(); const tt = t + rv(0, 0.4); g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(rv(0.05, 0.14), tt + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, tt + rv(0.01, 0.04)); s.connect(bp); bp.connect(g); g.connect(this.out); s.start(tt, rv(0, 1)); s.stop(tt + 0.06); s.onended = () => { s.disconnect(); bp.disconnect(); g.disconnect(); }; } }
  tick() { if (!this.kind || this.c.state !== 'running') return; const t = this.c.currentTime + 0.05;
    if (this.kind === 'forest') { if (Math.random() < 0.07) this.chirp(t); if (Math.random() < 0.012) this.a.play('howl', { vol: 0.35, rate: rv(0.8, 1.1) }); }
    else if (Math.random() < 0.6) this.crackle(t); }
}

export class Audio {
  constructor() { this.ctx = null; this.ready = false; this.buf = {}; this.voices = []; this.last = {}; this.maxVoices = 24; this.vol = { master: 0.8, music: 0.55, sfx: 0.85, mute: false }; this.lx = 0; this.lz = 0; this.stats = { played: {}, dropped: 0 }; }
  // called from the first user gesture (iOS/Android autoplay policy)
  unlock() {
    if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { return; } this.build(); }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }
  build() {
    const c = this.ctx;
    const L = c.createDynamicsCompressor(); L.threshold.value = -3; L.knee.value = 0; L.ratio.value = 20; L.attack.value = 0.002; L.release.value = 0.12; L.connect(c.destination);
    const C = c.createDynamicsCompressor(); C.threshold.value = -16; C.knee.value = 10; C.ratio.value = 3.5; C.attack.value = 0.004; C.release.value = 0.25; C.connect(L);
    this.master = c.createGain(); this.master.connect(C);
    this.sfxBus = c.createGain(); this.sfxBus.connect(this.master); this.musicBus = c.createGain(); this.musicBus.connect(this.master); this.ambBus = c.createGain(); this.ambBus.connect(this.master);
    this.sfxIn = c.createGain(); this.sfxIn.connect(this.sfxBus);
    this.rev = c.createConvolver(); this.rev.buffer = makeIR(c, 1.8, 2.6, 0.55); this.revSend = c.createGain(); this.revSend.connect(this.rev); const rg = c.createGain(); rg.gain.value = 0.5; this.rev.connect(rg); rg.connect(this.sfxBus);
    this.noiseBuf = makeNoise(c, 'white', 2); this.pinkBuf = makeNoise(c, 'pink', 4);
    this.applyVol();
    this.render().then(() => { this.ready = true; this.music = new Music(this); this.amb = new Ambience(this); this.music.setMode(this.wantMode || 'menu'); if (this.wantAmb) this.amb.set(this.wantAmb); });
  }
  async render() {
    const t0 = performance.now(); let bytes = 0;
    const all = { ...RECIPES, ...DRUMS };
    for (const [name, [dur, variants, fn]] of Object.entries(all)) {
      this.buf[name] = [];
      for (let v = 0; v < variants; v++) {
        const oc = new OfflineAudioContext(1, Math.ceil(SR * dur), SR); const s = new Syn(oc); try { fn(s); } catch (e) { console.warn('sfx', name, e); }
        const b = await oc.startRendering(); this.buf[name].push(b); bytes += b.length * 4;
      }
    }
    this.renderMs = Math.round(performance.now() - t0); this.bufferBytes = bytes;
  }
  setVolumes(v) { Object.assign(this.vol, v); this.applyVol(); }
  applyVol() { if (!this.ctx) return; const t = this.ctx.currentTime; const m = this.vol.mute ? 0 : this.vol.master; this.master.gain.setTargetAtTime(m, t, 0.05); this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05); this.musicBus.gain.setTargetAtTime(this.vol.music * 0.8, t, 0.05); this.ambBus.gain.setTargetAtTime(this.vol.sfx * 0.7, t, 0.05); }
  setLow(low) { this.low = low; this.maxVoices = low ? 14 : 26; }
  setMusic(mode) { this.wantMode = mode; if (this.music && this.music.mode !== mode) this.music.setMode(mode); }
  setAmbience(kind) { this.wantAmb = kind; if (this.amb) this.amb.set(kind); }
  listener(x, z) { this.lx = x; this.lz = z; }
  play(name, o = {}) {
    if (!this.ready || this.vol.mute || this.ctx.state !== 'running') return null; const bs = this.buf[name]; const M = MIX[name]; if (!bs || !M) return null;
    const c = this.ctx, now = c.currentTime; const [vol, gap, cap, pri, rev, pv, vv] = M;
    if (this.last[name] && now - this.last[name] < gap) return null;
    let att = 1, pan = 0;
    if (o.x !== undefined) { const dx = o.x - this.lx, dz = o.z - this.lz; const dist = Math.hypot(dx, dz); if (dist > 40) return null; att = 1 / (1 + Math.pow(dist / 12, 2)); pan = clamp(dx / 10, -1, 1) * 0.7; }
    let same = 0; for (const vo of this.voices) if (vo.name === name) same++;
    if (same >= cap) { this.stats.dropped++; return null; }
    if (this.voices.length >= this.maxVoices) { let vict = null; for (const vo of this.voices) if (vo.pri <= pri && (!vict || vo.t < vict.t)) vict = vo; if (!vict) { this.stats.dropped++; return null; } vict.g.gain.setTargetAtTime(0, now, 0.01); try { vict.s.stop(now + 0.05); } catch (e) { /* */ } this.voices.splice(this.voices.indexOf(vict), 1); }
    this.last[name] = now;
    const s = c.createBufferSource(); s.buffer = bs[Math.floor(Math.random() * bs.length)]; s.playbackRate.value = (o.rate || 1) * (1 + rv(-pv, pv));
    const g = c.createGain(); g.gain.value = vol * (o.vol ?? 1) * att * (1 + rv(-vv, vv) * 0.5); s.connect(g); let tail = g; const nodes = [s, g];
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; tail.connect(p); tail = p; nodes.push(p); }
    tail.connect(this.sfxIn); const r = o.rev ?? rev; if (r > 0 && !this.low) { const sg = c.createGain(); sg.gain.value = r; tail.connect(sg); sg.connect(this.revSend); nodes.push(sg); }
    const vo = { name, s, g, pri, t: now }; this.voices.push(vo); this.stats.played[name] = (this.stats.played[name] || 0) + 1;
    s.onended = () => { for (const n of nodes) n.disconnect(); const i = this.voices.indexOf(vo); if (i >= 0) this.voices.splice(i, 1); };
    s.start(now + (o.delay || 0)); return vo;
  }
  duck(amount = 0.5, hold = 0.4) { if (!this.music) return; const p = this.music.out.gain, t = this.ctx.currentTime; p.cancelScheduledValues(t); p.setTargetAtTime(amount, t, 0.03); p.setTargetAtTime(1, t + hold, 0.8); }
  debug() { return this.ctx ? { state: this.ctx.state, ready: this.ready, sounds: Object.keys(this.buf).length, renderMs: this.renderMs, kb: Math.round((this.bufferBytes || 0) / 1024), voices: this.voices.length, mode: this.music && this.music.mode, amb: this.amb && this.amb.kind, played: { ...this.stats.played } } : { ctx: false }; }
}
