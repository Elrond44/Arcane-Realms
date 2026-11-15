// Versioned save with migration hooks, field-level validation, checksum and a rolling backup copy.
import { RES_KEYS, UPGRADES, ITEM_BY_ID, SLOTS, QUESTS, HERO, ARTIFACT, AFFIXES, RARITIES } from './data.js?v=1';
import { makeItem } from './items.js?v=1';

export const SAVE_VERSION = 1;
export const KEY = 'arcane-realms-save';
export const BACKUP = 'arcane-realms-save-bak';
export const INV_CAP = 60;

export function freshState() {
  const up = {}; for (const u of UPGRADES) up[u.key] = 0;
  const res = {}; for (const k of RES_KEYS) res[k] = 0;
  const equip = {}; for (const k of SLOTS) equip[k] = null;
  return {
    v: SAVE_VERSION, level: 1, xp: 0, res, inv: [], equip, upgrades: up, artifact: 0, index: {}, indexMs: [],
    quests: {}, tracked: 'q_portal', region: 'citadel', pos: null, opened: {}, shrines: {}, blessings: {}, areas: {}, bossKills: 0,
    flasks: HERO.flasks, hp: null,
    stats: { kills: 0, deaths: 0, playTime: 0, crits: 0, dmg: 0, chests: 0, items: 0, bestHit: 0, upgrades: 0, salvaged: 0 },
    settings: { master: 0.8, music: 0.55, sfx: 0.85, mute: false, quality: 'auto', shake: 'full', autoAttack: true, dmgNums: true, fps: false },
    tips: {}, created: Date.now(), savedAt: Date.now(),
  };
}
export function newGame() {
  const s = freshState();
  for (const [t, slot] of [['rusted_blade', 'weapon'], ['leather_hood', 'helm'], ['padded_tunic', 'chest'], ['worn_boots', 'boots']]) {
    const it = makeItem(t, 1, 1234 + s.inv.length); s.inv.push(it); s.equip[slot] = it.id; s.index[t] = { n: 1, at: Date.now() };
  }
  s.res.gold = 30; return s;
}
const num = (v, d, lo = -Infinity, hi = Infinity) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const int = (v, d, lo, hi) => Math.round(num(v, d, lo, hi));
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

export function migrate(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('Save data is not an object');
  const v = int(d.v, 1, 0, 999); if (v > SAVE_VERSION) throw new Error('Save is from a newer version (v' + v + ')');
  // future: if (v < 2) { ...; }
  return { ...d, v: SAVE_VERSION };
}
export function sanitize(raw) {
  const d = migrate(raw); const s = freshState();
  s.level = int(d.level, 1, 1, HERO.maxLevel); s.xp = num(d.xp, 0, 0, 1e12);
  for (const k of RES_KEYS) s.res[k] = int(obj(d.res)[k], 0, 0, 1e13);
  const seen = new Set();
  s.inv = (Array.isArray(d.inv) ? d.inv : []).filter((it) => it && typeof it === 'object' && typeof it.id === 'string' && ITEM_BY_ID[it.t] && !seen.has(it.id) && seen.add(it.id)).slice(0, INV_CAP + 8).map((it) => ({
    id: it.id, t: it.t, l: int(it.l, 1, 1, 99), up: int(it.up, 0, 0, RARITIES[ITEM_BY_ID[it.t].r].maxUp), n: 1, at: num(it.at, Date.now(), 0, 1e15), lock: !!it.lock, seen: it.seen !== false,
    aff: (Array.isArray(it.aff) ? it.aff : []).filter((a) => a && AFFIXES[a.k] && typeof a.v === 'number' && isFinite(a.v)).slice(0, 4).map((a) => ({ k: a.k, v: a.v })),
  }));
  const eq = obj(d.equip);
  for (const k of SLOTS) { const id = eq[k]; const it = s.inv.find((x) => x.id === id); s.equip[k] = it && ITEM_BY_ID[it.t].slot === k ? id : null; }
  for (const u of UPGRADES) s.upgrades[u.key] = int(obj(d.upgrades)[u.key], 0, 0, u.max);
  s.artifact = int(d.artifact, 0, 0, ARTIFACT.max);
  for (const [k, e] of Object.entries(obj(d.index))) if (ITEM_BY_ID[k]) s.index[k] = { n: int(obj(e).n, 1, 1, 1e9), at: num(obj(e).at, Date.now(), 0, 1e15) };
  for (const it of s.inv) if (!s.index[it.t]) s.index[it.t] = { n: 1, at: Date.now() };
  s.indexMs = (Array.isArray(d.indexMs) ? d.indexMs : []).filter((n) => typeof n === 'number');
  for (const q of QUESTS) { const e = obj(d.quests)[q.id]; if (e && typeof e === 'object') s.quests[q.id] = { p: int(e.p, 0, 0, 1e9), done: !!e.done, claimed: !!e.claimed }; }
  s.tracked = typeof d.tracked === 'string' && QUESTS.some((q) => q.id === d.tracked) ? d.tracked : s.tracked;
  s.region = d.region === 'woodland' ? 'woodland' : 'citadel';
  const p = obj(d.pos); s.pos = typeof p.x === 'number' && isFinite(p.x) && typeof p.z === 'number' && isFinite(p.z) ? { x: num(p.x, 0, -200, 200), z: num(p.z, 0, -200, 200) } : null;
  for (const k of ['opened', 'shrines', 'areas']) for (const [a, b] of Object.entries(obj(d[k]))) if (b) s[k][a] = 1;
  const bl = obj(d.blessings); for (const k of ['hpPct', 'dmgPct', 'res', 'apPct']) if (typeof bl[k] === 'number') s.blessings[k] = num(bl[k], 0, 0, 2);
  s.bossKills = int(d.bossKills, 0, 0, 1e6); s.flasks = int(d.flasks, HERO.flasks, 0, HERO.flasks);
  s.hp = d.hp == null ? null : num(d.hp, null, 1, 1e9);
  for (const k in s.stats) s.stats[k] = num(obj(d.stats)[k], 0, 0, 1e15);
  const st = obj(d.settings);
  for (const k of ['master', 'music', 'sfx']) s.settings[k] = num(st[k], s.settings[k], 0, 1);
  for (const k of ['mute', 'autoAttack', 'dmgNums', 'fps']) if (typeof st[k] === 'boolean') s.settings[k] = st[k];
  if (['auto', 'low', 'medium', 'high'].includes(st.quality)) s.settings.quality = st.quality;
  if (['full', 'reduced', 'off'].includes(st.shake)) s.settings.shake = st.shake;
  for (const [a, b] of Object.entries(obj(d.tips))) if (b) s.tips[a] = 1;
  s.created = num(d.created, Date.now(), 0, 1e15); s.savedAt = num(d.savedAt, Date.now(), 0, 1e15);
  return s;
}
function checksum(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
export function serialize(s) { s.savedAt = Date.now(); const body = JSON.stringify(s); return JSON.stringify({ c: checksum(body), body }); }
function parse(str) {
  const w = JSON.parse(str);
  if (w && typeof w.body === 'string') { if (checksum(w.body) !== w.c) throw new Error('checksum mismatch'); return JSON.parse(w.body); }
  return w; // tolerate an unwrapped object
}
export function save(s) {
  try {
    const str = serialize(s); parse(str); // verify before replacing anything
    const prev = localStorage.getItem(KEY); if (prev) localStorage.setItem(BACKUP, prev);
    localStorage.setItem(KEY, str); return true;
  } catch (e) { console.warn('save failed', e); return false; }
}
// returns { s, from: 'main'|'backup'|'fresh', error }
export function load() {
  let error = null;
  for (const [k, from] of [[KEY, 'main'], [BACKUP, 'backup']]) {
    const str = localStorage.getItem(k); if (!str) continue;
    try { return { s: sanitize(parse(str)), from, error }; }
    catch (e) { error = (error ? error + '; ' : '') + from + ': ' + e.message; try { localStorage.setItem('arcane-realms-corrupt-' + from, str); } catch (e2) { /* quota */ } }
  }
  return { s: null, from: 'fresh', error };
}
export function hasSave() { return !!(localStorage.getItem(KEY) || localStorage.getItem(BACKUP)); }
export function wipe() { localStorage.removeItem(KEY); localStorage.removeItem(BACKUP); }
