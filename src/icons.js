// Procedural item icons (Canvas2D -> cached data URLs). Every item gets a unique drawing from its
// category/style plus its look colors; undiscovered index entries use the same drawing as a silhouette.
import { ITEM_BY_ID } from './data.js?v=1';
const cache = new Map();
const hex = (c) => '#' + (c >>> 0).toString(16).padStart(6, '0');
function shade(c, k) { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; const f = (v) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)))); return '#' + [f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, '0')).join(''); }
function lin(x, a, b, c0, c1, horiz = false) { const g = horiz ? x.createLinearGradient(a, 0, b, 0) : x.createLinearGradient(0, a, 0, b); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; }
function glow(x, cx, cy, r, col, a = 0.55) { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = a; x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); x.globalAlpha = 1; }
function stroke(x, w = 2.2, c = 'rgba(10,6,4,0.85)') { x.lineWidth = w; x.strokeStyle = c; x.stroke(); }
const P = {
  blade(x, L, metal, accent, gl, w = 9, curve = 0) { // generic diagonal blade drawn in a rotated frame
    x.save(); x.translate(48, 50); x.rotate(-Math.PI / 4);
    if (gl) glow(x, 0, -14, 40, hex(gl), 0.35);
    x.beginPath(); x.moveTo(-w / 2, 6); x.lineTo(-w / 2 + curve, -L + 10); x.lineTo(curve * 0.6, -L); x.lineTo(w / 2 + curve, -L + 10); x.lineTo(w / 2, 6); x.closePath();
    x.fillStyle = lin(x, -w / 2, w / 2, shade(metal, 0.45), shade(metal, -0.35), true); x.fill(); stroke(x);
    x.beginPath(); x.moveTo(0, 4); x.lineTo(curve * 0.6, -L + 6); x.strokeStyle = shade(metal, 0.7); x.lineWidth = 1.2; x.stroke();
    if (gl) { x.beginPath(); x.moveTo(-1.5, 0); x.lineTo(curve * 0.5 - 1, -L + 14); x.strokeStyle = hex(gl); x.globalAlpha = 0.8; x.lineWidth = 2; x.stroke(); x.globalAlpha = 1; }
    x.fillStyle = shade(accent, 0.1); x.beginPath(); x.roundRect(-15, 5, 30, 6, 3); x.fill(); stroke(x, 1.6);
    x.fillStyle = lin(x, -3, 3, shade(accent, 0.3), shade(accent, -0.4), true); x.beginPath(); x.roundRect(-3.5, 11, 7, 20, 2); x.fill(); stroke(x, 1.6);
    x.fillStyle = shade(metal, 0.2); x.beginPath(); x.arc(0, 34, 5, 0, 7); x.fill(); stroke(x, 1.6); x.restore();
  },
  sword(x, t) { const l = t.look; P.blade(x, 52, l.metal, l.accent, l.glow, 10, t.id === 'moonsilver_saber' ? 6 : 0); },
  dagger(x, t) { const l = t.look; P.blade(x, 34, l.metal, l.accent, l.glow, 9, t.id === 'whisper_kris' ? 3 : 0); },
  axe(x, t) { const l = t.look; x.save(); x.translate(50, 50); x.rotate(-Math.PI / 4); if (l.glow) glow(x, 6, -26, 34, hex(l.glow), 0.35);
    x.fillStyle = lin(x, -4, 4, shade(l.accent, 0.3), shade(l.accent, -0.45), true); x.beginPath(); x.roundRect(-4, -40, 8, 76, 3); x.fill(); stroke(x);
    x.beginPath(); x.moveTo(3, -38); x.quadraticCurveTo(34, -44, 30, -22); x.quadraticCurveTo(26, -8, 3, -14); x.closePath();
    x.fillStyle = lin(x, 0, 32, shade(l.metal, -0.3), shade(l.metal, 0.5), true); x.fill(); stroke(x);
    if (t.id !== 'woodcutter_axe') { x.beginPath(); x.moveTo(-3, -36); x.quadraticCurveTo(-20, -34, -18, -22); x.quadraticCurveTo(-14, -14, -3, -18); x.closePath(); x.fillStyle = shade(l.metal, -0.1); x.fill(); stroke(x); }
    if (l.glow) { x.beginPath(); x.moveTo(28, -40); x.quadraticCurveTo(33, -30, 28, -18); x.strokeStyle = hex(l.glow); x.lineWidth = 2.5; x.stroke(); }
    x.restore(); },
  spear(x, t) { const l = t.look; x.save(); x.translate(48, 48); x.rotate(-Math.PI / 4); if (l.glow) glow(x, 0, -34, 30, hex(l.glow), 0.5);
    x.fillStyle = lin(x, -3, 3, shade(l.accent, 0.3), shade(l.accent, -0.4), true); x.beginPath(); x.roundRect(-2.6, -26, 5.2, 70, 2); x.fill(); stroke(x, 1.6);
    x.beginPath(); x.moveTo(0, -48); x.lineTo(7, -30); x.lineTo(0, -24); x.lineTo(-7, -30); x.closePath(); x.fillStyle = lin(x, -7, 7, shade(l.metal, 0.5), shade(l.metal, -0.3), true); x.fill(); stroke(x);
    x.fillStyle = shade(l.accent, -0.2); x.fillRect(-5, -25, 10, 4); x.restore(); },
  staff(x, t) { const l = t.look; x.save(); x.translate(48, 50); x.rotate(-Math.PI / 5);
    x.fillStyle = lin(x, -3, 3, shade(l.metal, 0.3), shade(l.metal, -0.4), true); x.beginPath(); x.moveTo(-3, 40); x.quadraticCurveTo(-6, 0, -2, -30); x.lineTo(3, -30); x.quadraticCurveTo(0, 0, 3, 40); x.closePath(); x.fill(); stroke(x, 1.6);
    glow(x, 0, -36, 30, hex(l.glow || l.accent), 0.8);
    if (t.id === 'glowcap_staff') { x.beginPath(); x.ellipse(0, -36, 14, 9, 0, Math.PI, 0); x.closePath(); x.fillStyle = hex(l.accent); x.fill(); stroke(x, 1.6); }
    else { x.beginPath(); x.moveTo(-2, -30); x.quadraticCurveTo(-14, -40, -6, -48); x.moveTo(2, -30); x.quadraticCurveTo(14, -40, 6, -48); stroke(x, 3.5, shade(l.metal, 0.1)); x.beginPath(); x.arc(0, -40, 6.5, 0, 7); x.fillStyle = '#fff'; x.fill(); x.beginPath(); x.arc(0, -40, 5, 0, 7); x.fillStyle = hex(l.glow || l.accent); x.globalAlpha = 0.7; x.fill(); x.globalAlpha = 1; }
    x.restore(); },
  bow(x, t) { const l = t.look; x.save(); x.translate(50, 48); x.rotate(-Math.PI / 4); if (l.glow) glow(x, -6, 0, 40, hex(l.glow), 0.3);
    x.beginPath(); x.moveTo(6, -40); x.quadraticCurveTo(-22, -20, -10, 0); x.quadraticCurveTo(-22, 20, 6, 40); stroke(x, 7, 'rgba(10,6,4,0.85)'); x.strokeStyle = lin(x, -40, 40, shade(l.metal, 0.3), shade(l.metal, -0.3)); x.lineWidth = 4.5; x.stroke();
    x.beginPath(); x.moveTo(6, -40); x.lineTo(6, 40); x.strokeStyle = 'rgba(240,230,210,0.8)'; x.lineWidth = 1; x.stroke();
    x.fillStyle = shade(l.accent, 0); x.fillRect(-14, -5, 6, 10);
    x.beginPath(); x.moveTo(6, 0); x.lineTo(-28, 0); stroke(x, 2, shade(l.accent, 0.4)); x.beginPath(); x.moveTo(-34, 0); x.lineTo(-27, -3); x.lineTo(-27, 3); x.closePath(); x.fillStyle = l.glow ? hex(l.glow) : '#ddd'; x.fill(); x.restore(); },
  helm(x, t) { const l = t.look; const c = l.color; const tr = l.trim || shade(c, 0.3);
    if (l.glow) glow(x, 48, 46, 44, hex(l.glow), 0.35);
    x.save(); x.translate(48, 52);
    if (l.style === 'hood') { x.beginPath(); x.moveTo(-26, 28); x.quadraticCurveTo(-30, -30, 0, -34); x.quadraticCurveTo(30, -30, 26, 28); x.quadraticCurveTo(0, 18, -26, 28); x.fillStyle = lin(x, -34, 28, shade(c, 0.25), shade(c, -0.45)); x.fill(); stroke(x);
      x.beginPath(); x.ellipse(0, 6, 15, 18, 0, 0, 7); x.fillStyle = '#120c08'; x.fill(); if (typeof tr === 'number') { x.beginPath(); x.moveTo(-26, 28); x.quadraticCurveTo(0, 18, 26, 28); stroke(x, 3, hex(tr)); } }
    else if (l.style === 'helm') { x.beginPath(); x.moveTo(-24, 24); x.lineTo(-25, -8); x.quadraticCurveTo(-22, -32, 0, -33); x.quadraticCurveTo(22, -32, 25, -8); x.lineTo(24, 24); x.closePath(); x.fillStyle = lin(x, -33, 24, shade(c, 0.45), shade(c, -0.4)); x.fill(); stroke(x);
      x.fillStyle = '#0d0a0a'; x.fillRect(-17, -4, 34, 5); x.fillRect(-2, -4, 4, 20); x.beginPath(); x.moveTo(0, -33); x.lineTo(0, 22); stroke(x, 2.5, hex(tr)); }
    else if (l.style === 'crown') { x.beginPath(); x.ellipse(0, 12, 22, 9, 0, 0, 7); x.fillStyle = shade(c, -0.2); x.fill(); stroke(x);
      for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 10, 8); x.quadraticCurveTo(s * 30, -6, s * 26, -30); x.moveTo(s * 22, -6); x.lineTo(s * 36, -14); x.moveTo(s * 27, -20); x.lineTo(s * 16, -32); stroke(x, 7); x.strokeStyle = lin(x, -32, 10, shade(c, 0.4), shade(c, -0.2)); x.lineWidth = 4.5; x.stroke(); }
      x.beginPath(); x.arc(0, 10, 4, 0, 7); x.fillStyle = hex(l.glow); x.fill(); }
    else { x.beginPath(); x.moveTo(-22, -26); x.quadraticCurveTo(0, -38, 22, -26); x.lineTo(18, 14); x.lineTo(0, 30); x.lineTo(-18, 14); x.closePath(); x.fillStyle = lin(x, -36, 30, shade(c, 0.35), shade(c, -0.3)); x.fill(); stroke(x);
      x.fillStyle = hex(l.glow); for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 4, -6); x.lineTo(s * 15, -10); x.lineTo(s * 12, -2); x.closePath(); x.fill(); }
      x.beginPath(); x.moveTo(-8, 14); x.lineTo(8, 14); stroke(x, 2, hex(tr)); }
    x.restore(); },
  chest(x, t) { const l = t.look; const c = l.color; const tr = l.trim ? hex(l.trim) : shade(c, 0.35); if (l.glow) glow(x, 48, 48, 44, hex(l.glow), 0.3);
    x.save(); x.translate(48, 50);
    const robe = l.style === 'robe';
    x.beginPath(); x.moveTo(-14, -30); x.lineTo(-30, -24); x.lineTo(-34, 2); x.lineTo(-24, 4); x.lineTo(-22, robe ? 36 : 28); x.lineTo(22, robe ? 36 : 28); x.lineTo(24, 4); x.lineTo(34, 2); x.lineTo(30, -24); x.lineTo(14, -30); x.quadraticCurveTo(0, -20, -14, -30);
    x.fillStyle = lin(x, -30, 30, shade(c, 0.35), shade(c, -0.45)); x.fill(); stroke(x);
    if (l.style === 'mail') { x.strokeStyle = shade(c, -0.5); x.lineWidth = 1; for (let yy = -16; yy < 26; yy += 6) for (let xx = -18; xx < 20; xx += 7) { x.beginPath(); x.arc(xx + (yy % 12 ? 3.5 : 0), yy, 3, 0, Math.PI); x.stroke(); } }
    if (l.style === 'plate') { for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 26, -20, 11, 8, s * 0.3, 0, 7); x.fillStyle = shade(c, 0.2); x.fill(); stroke(x, 1.8); } x.beginPath(); x.moveTo(0, -22); x.lineTo(0, 24); stroke(x, 2, tr); }
    if (l.style === 'tunic') { x.beginPath(); x.moveTo(-20, 8); x.lineTo(20, 8); stroke(x, 3.5, '#3a2a1a'); x.fillStyle = '#c8a050'; x.fillRect(-3, 5, 6, 6); }
    if (robe) { x.beginPath(); x.moveTo(-6, -26); x.lineTo(-4, 34); x.moveTo(6, -26); x.lineTo(4, 34); stroke(x, 2, tr); }
    x.beginPath(); x.moveTo(-14, -30); x.quadraticCurveTo(0, -20, 14, -30); stroke(x, 2.5, tr);
    if (l.glow) { x.beginPath(); x.arc(0, -8, 4, 0, 7); x.fillStyle = hex(l.glow); x.fill(); }
    x.restore(); },
  gloves(x, t) { const l = t.look; const c = l.color; if (l.glow) glow(x, 48, 48, 40, hex(l.glow), 0.4);
    x.save(); x.translate(48, 52); x.rotate(-0.2);
    x.beginPath(); x.moveTo(-14, 30); x.lineTo(-16, 2); x.quadraticCurveTo(-26, -6, -24, -14); x.lineTo(-14, -6); x.lineTo(-13, -28); x.quadraticCurveTo(-10, -32, -7, -28); x.lineTo(-6, -12); x.lineTo(-4, -34); x.quadraticCurveTo(0, -37, 3, -33); x.lineTo(3, -12); x.lineTo(7, -30); x.quadraticCurveTo(11, -32, 13, -28); x.lineTo(12, -10); x.lineTo(16, -22); x.quadraticCurveTo(20, -23, 20, -18); x.lineTo(16, 4); x.lineTo(16, 30); x.closePath();
    x.fillStyle = lin(x, -36, 30, shade(c, 0.35), shade(c, -0.4)); x.fill(); stroke(x);
    x.fillStyle = shade(c, -0.25); x.fillRect(-16, 18, 32, 12); x.strokeRect(-16, 18, 32, 12);
    if (l.glow) { x.fillStyle = hex(l.glow); x.beginPath(); x.arc(0, 4, 4, 0, 7); x.fill(); } x.restore(); },
  boots(x, t) { const l = t.look; const c = l.color; if (l.glow) glow(x, 48, 50, 40, hex(l.glow), 0.4);
    x.save(); x.translate(44, 50);
    x.beginPath(); x.moveTo(-12, -32); x.lineTo(10, -32); x.lineTo(10, 10); x.quadraticCurveTo(30, 12, 32, 24); x.lineTo(32, 30); x.lineTo(-14, 30); x.lineTo(-14, 6); x.closePath();
    x.fillStyle = lin(x, -32, 30, shade(c, 0.35), shade(c, -0.45)); x.fill(); stroke(x);
    x.fillStyle = shade(c, -0.55); x.fillRect(-14, 25, 46, 5); x.fillStyle = shade(c, 0.25); x.fillRect(-13, -32, 23, 7);
    if (l.glow) { x.beginPath(); x.moveTo(-18, -10); x.lineTo(-30, -18); x.moveTo(-18, 0); x.lineTo(-32, -2); stroke(x, 2.5, hex(l.glow)); } x.restore(); },
  ring(x, t) { const l = t.look; glow(x, 48, 40, 34, hex(l.glow || l.color), l.glow ? 0.6 : 0.2);
    x.beginPath(); x.ellipse(48, 56, 22, 18, 0, 0, 7); x.ellipse(48, 56, 15, 11, 0, 0, 7, true); x.fillStyle = lin(x, 38, 74, '#f3dc8e', '#7a5a1e'); if (t.id === 'eclipse_ring') x.fillStyle = lin(x, 38, 74, '#555566', '#111118'); if (t.id === 'copper_band') x.fillStyle = lin(x, 38, 74, '#f0a060', '#6a3a14'); x.fill('evenodd'); stroke(x, 1.8);
    x.beginPath(); x.moveTo(48, 24); x.lineTo(60, 36); x.lineTo(48, 46); x.lineTo(36, 36); x.closePath(); x.fillStyle = lin(x, 24, 46, shade(l.color, 0.5), shade(l.color, -0.35)); if (t.id !== 'copper_band') { x.fill(); stroke(x, 1.8); x.beginPath(); x.moveTo(42, 34); x.lineTo(48, 28); x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 1.5; x.stroke(); } },
  amulet(x, t) { const l = t.look; x.beginPath(); x.moveTo(22, 14); x.quadraticCurveTo(48, 58, 74, 14); stroke(x, 2.5, '#c9a45a');
    glow(x, 48, 58, 36, hex(l.glow || l.color), l.glow ? 0.7 : 0.25);
    x.beginPath(); if (t.id === 'bone_charm') { x.ellipse(48, 60, 8, 16, 0.3, 0, 7); } else if (t.id === 'gloomroot_heart') { x.moveTo(48, 78); x.bezierCurveTo(20, 58, 30, 36, 48, 48); x.bezierCurveTo(66, 36, 76, 58, 48, 78); } else { x.arc(48, 58, 15, 0, 7); }
    x.fillStyle = lin(x, 42, 78, shade(l.color, 0.45), shade(l.color, -0.4)); x.fill(); stroke(x, 2);
    if (t.id === 'starlit_locket') { x.fillStyle = '#fff'; for (const [a, b] of [[44, 54], [52, 60], [47, 63], [54, 52]]) { x.beginPath(); x.arc(a, b, 1.3, 0, 7); x.fill(); } }
    if (t.id === 'grove_pendant') { x.beginPath(); x.ellipse(48, 58, 4, 7, 0.4, 0, 7); x.fillStyle = '#3a2a10'; x.fill(); } },
  artifact(x, t) { const l = t.look; glow(x, 48, 50, 44, hex(l.glow), 0.75);
    x.beginPath(); x.moveTo(48, 14); x.lineTo(78, 70); x.lineTo(18, 70); x.closePath(); x.fillStyle = lin(x, 14, 70, shade(l.color, 0.6), shade(l.color, -0.45)); x.fill(); stroke(x, 2.2);
    x.beginPath(); x.moveTo(48, 14); x.lineTo(48, 52); x.lineTo(78, 70); x.moveTo(48, 52); x.lineTo(18, 70); x.strokeStyle = 'rgba(255,255,255,0.45)'; x.lineWidth = 1.4; x.stroke();
    if (t.id === 'cracked_prism') { x.beginPath(); x.moveTo(56, 30); x.lineTo(50, 44); x.lineTo(58, 52); stroke(x, 1.6); }
    x.beginPath(); x.arc(48, 50, 4, 0, 7); x.fillStyle = '#fff'; x.fill(); },
};
export function itemIcon(tid, silhouette = false) {
  const key = tid + (silhouette ? ':s' : ''); if (cache.has(key)) return cache.get(key);
  const t = ITEM_BY_ID[tid]; const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d');
  const fn = t.slot === 'weapon' ? P[t.cat] : P[t.slot]; try { fn(x, t); } catch (e) { console.warn('icon', tid, e); }
  if (silhouette) { x.globalCompositeOperation = 'source-in'; x.fillStyle = '#06070a'; x.fillRect(0, 0, 96, 96); x.globalCompositeOperation = 'source-over'; }
  const url = c.toDataURL(); cache.set(key, url); return url;
}
// SVG UI icons (resources, menus); stroke-based, currentColor
export const SVG = {
  gold: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="#f7c948" stroke="#7a5212" stroke-width="1.6"/><circle cx="12" cy="12" r="5.2" fill="none" stroke="#b07f1c" stroke-width="1.3"/><path d="M9 9.5l2-1.3" stroke="#fff6c8" stroke-width="1.4" stroke-linecap="round"/></svg>',
  essence: '<svg viewBox="0 0 24 24"><path d="M12 2.5c3 4 6 6.5 6 10.5a6 6 0 0 1-12 0c0-4 3-6.5 6-10.5z" fill="#b57bff" stroke="#4a2280" stroke-width="1.5"/><path d="M10 13.5a2.5 2.5 0 0 0 2.5 2.5" stroke="#f0e0ff" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>',
  crystals: '<svg viewBox="0 0 24 24"><path d="M12 2l5 7-5 13-5-13z" fill="#6fe7ff" stroke="#14607a" stroke-width="1.4"/><path d="M7 9h10M12 2v20" stroke="#d8fbff" stroke-width="0.9"/></svg>',
  relics: '<svg viewBox="0 0 24 24"><path d="M12 3l8 15H4z" fill="#ff9d4a" stroke="#6a3010" stroke-width="1.5"/><path d="M12 8l3.5 7h-7z" fill="#ffe2b8"/></svg>',
  tokens: '<svg viewBox="0 0 24 24"><path d="M12 2l3 3h4v4l3 3-3 3v4h-4l-3 3-3-3H5v-4l-3-3 3-3V5h4z" fill="#ff5470" stroke="#6a1020" stroke-width="1.3"/><circle cx="12" cy="12" r="3.3" fill="#ffd0d8"/></svg>',
  bag: '<svg viewBox="0 0 32 32"><path d="M9 11h14l2 16H7z M12 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M13 17h6" stroke="currentColor" stroke-width="2"/></svg>',
  book: '<svg viewBox="0 0 32 32"><path d="M6 6h9a3 3 0 0 1 3 3v17a3 3 0 0 0-3-3H6zM26 6h-6a3 3 0 0 0-2 1" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M26 6v17h-8" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  trine: '<svg viewBox="0 0 32 32"><path d="M16 4l11 20H5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="16" cy="17" r="3" fill="currentColor"/><ellipse cx="16" cy="17" rx="13" ry="4.5" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".6"/></svg>',
  stats: '<svg viewBox="0 0 32 32"><circle cx="16" cy="9" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 27c0-6 3.5-9 8-9s8 3 8 9" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  quest: '<svg viewBox="0 0 32 32"><path d="M9 5h14v3H9zM10 8v17a2 2 0 0 0 2 2h11V8M23 27a2 2 0 0 0 2-2v-2h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M13 13h6M13 17h6M13 21h4" stroke="currentColor" stroke-width="1.8"/></svg>',
  anvil: '<svg viewBox="0 0 32 32"><path d="M4 10h18c0 4 3 5 6 5v2c-4 0-6 1-7 3h-3l1 3h3v3H10v-3h3l1-3h-3c-2-4-5-5-7-6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  map: '<svg viewBox="0 0 32 32"><path d="M4 8l7-3 10 3 7-3v19l-7 3-10-3-7 3zM11 5v19M21 8v19" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.7a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.7a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5A3.5 3.5 0 1 1 13 8.5a3.5 3.5 0 0 1 0 7z"/></svg>',
  sword: '<svg viewBox="0 0 32 32"><path d="M25 4l3 0 0 3-13 13-3-3zM10 16l6 6M8 20l4 4M6 26l3-3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dash: '<svg viewBox="0 0 32 32"><path d="M6 10h10M3 16h13M6 22h10M18 8l9 8-9 8z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  flask: '<svg viewBox="0 0 32 32"><path d="M13 4h6M14 4v7l-6 9a5 5 0 0 0 4 8h8a5 5 0 0 0 4-8l-6-9V4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M10 20h12l1 2a3 3 0 0 1-3 4h-8a3 3 0 0 1-3-4z" fill="#ff4a5a"/></svg>',
  hand: '<svg viewBox="0 0 32 32"><path d="M11 17V7a2 2 0 0 1 4 0v8-10a2 2 0 0 1 4 0v10-8a2 2 0 0 1 4 0v12c0 6-3 9-8 9-4 0-6-2-8-6l-3-5a2 2 0 0 1 3-2l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  shield: '<svg viewBox="0 0 32 32"><path d="M16 3l10 4v8c0 7-5 11-10 14-5-3-10-7-10-14V7z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  heart: '<svg viewBox="0 0 32 32"><path d="M16 27C6 20 4 15 4 11a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 4-2 9-12 16z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  wing: '<svg viewBox="0 0 32 32"><path d="M4 24c8-1 14-6 16-18 3 3 6 8 7 13-4 0-7 1-10 4-4 1-9 2-13 1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  star: '<svg viewBox="0 0 32 32"><path d="M16 3l3.5 8.5L28 13l-6.5 6 2 9L16 23.5 8.5 28l2-9L4 13l8.5-1.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  eye: '<svg viewBox="0 0 32 32"><path d="M3 16c4-7 9-10 13-10s9 3 13 10c-4 7-9 10-13 10S7 23 3 16z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="16" r="4" fill="currentColor"/></svg>',
  coin: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19 11h-4a2.5 2.5 0 0 0 0 5h2a2.5 2.5 0 0 1 0 5h-4M16 8v3M16 21v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  leaf: '<svg viewBox="0 0 32 32"><path d="M6 26C6 12 14 6 27 5c0 13-6 21-19 21zM6 26l12-12" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
};
