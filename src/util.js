// Small shared helpers: seeded RNG, math, formatting
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt); // frame-rate independent smoothing
export const smooth = (t) => t * t * (3 - 2 * t);
export const TAU = Math.PI * 2;
export function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
export function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function hash2(x, z) { let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
// value noise for terrain tint / ground undulation
export function vnoise(x, z) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi; const u = smooth(xf), v = smooth(zf);
  return lerp(lerp(hash2(xi, zi), hash2(xi + 1, zi), u), lerp(hash2(xi, zi + 1), hash2(xi + 1, zi + 1), u), v); }
export function fbm(x, z, o = 3) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += vnoise(x * f, z * f) * a; f *= 2.03; a *= 0.5; } return s; }
export function fmt(n) { n = Math.floor(n); if (n < 10000) return String(n); if (n < 1e6) return (n / 1000).toFixed(n < 1e5 ? 1 : 0).replace(/\.0$/, '') + 'K'; if (n < 1e9) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'; return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B'; }
export function pct(v, d = 0) { return (v * 100).toFixed(d) + '%'; }
export const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];
export function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
export function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }
