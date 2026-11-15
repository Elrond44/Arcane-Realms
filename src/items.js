// Equipment database helpers + the progression/stat calculator (deterministic: same save -> same stats)
import { ITEMS, ITEM_BY_ID, RARITIES, AFFIXES, SETS, HERO, UPGRADES, ARTIFACT, WEAPONS, itemScale, PCT_STATS } from './data.js?v=1';
import { mulberry32, uid } from './util.js?v=1';

export function makeItem(tid, ilvl = 1, seed = (Math.random() * 1e9) | 0) {
  const t = ITEM_BY_ID[tid]; const R = RARITIES[t.r]; const rnd = mulberry32(seed);
  const keys = Object.keys(AFFIXES).filter((k) => !(t.slot === 'weapon' && k === 'res'));
  const aff = [];
  for (let i = 0; i < R.affixes && keys.length; i++) {
    const k = keys.splice(Math.floor(rnd() * keys.length), 1)[0]; const A = AFFIXES[k];
    let v = A.lo + (A.hi - A.lo) * rnd(); if (A.perL) v += A.perL * (ilvl - 1); v *= 1 + t.r * 0.12;
    aff.push({ k, v: A.fmt === 'pct' ? +v.toFixed(3) : Math.round(v) });
  }
  return { id: uid(), t: tid, l: Math.max(1, ilvl | 0), up: 0, aff, n: 1, at: Date.now() };
}
export const tmpl = (it) => ITEM_BY_ID[it.t];
// primary stats of an item instance (base scaled by item level and upgrade)
export function itemStats(it, gearMul = 1) {
  const t = tmpl(it); const out = {}; const sc = itemScale(it.l, it.up);
  for (const k in t.base) out[k] = PCT_STATS.has(k) ? t.base[k] * (1 + 0.05 * it.up) * (1 + 0.02 * (it.l - 1)) : t.base[k] * sc;
  for (const a of it.aff) out[a.k] = (out[a.k] || 0) + a.v * (1 + 0.04 * it.up);
  if (gearMul !== 1) for (const k in out) out[k] *= gearMul;
  return out;
}
// single "power" number used for sorting and quick comparison
export function itemPower(it) {
  const s = itemStats(it); let p = 0;
  p += (s.atk || 0) * 3 + (s.def || 0) * 2.2 + (s.hp || 0) * 0.35 + (s.crit || 0) * 300 + (s.critMult || 0) * 120 + (s.spd || 0) * 200 + (s.ap || 0) * 150 + (s.res || 0) * 150 + (s.ampl || 0) * 220 + (s.aspd || 0) * 260 + (s.atkPct || 0) * 260 + (s.find || 0) * 90 + (s.fire || 0) * 2 + (s.frost || 0) * 2;
  if (tmpl(it).passive) p *= 1.15; return Math.round(p);
}
export function setCounts(equipped) { const c = {}; for (const it of equipped) { const s = tmpl(it).set; if (s) c[s] = (c[s] || 0) + 1; } return c; }

export function computeStats(s, buffs = []) {
  const L = s.level; const eq = equippedItems(s);
  const facet = {}; for (const f of ARTIFACT.facets) if ((s.artifact || 0) >= f.at) facet[f.k] = (facet[f.k] || 0) + f.v;
  const gearMul = 1 + (facet.gear || 0);
  const g = {}; const passives = new Set();
  for (const it of eq) { const st = itemStats(it, gearMul); for (const k in st) g[k] = (g[k] || 0) + st[k]; const p = tmpl(it).passive; if (p) passives.add(p); }
  const set = {}; const sc = setCounts(eq);
  for (const k in sc) for (const [n, , b] of SETS[k].bonus) if (sc[k] >= n) for (const bk in b) set[bk] = (set[bk] || 0) + b[bk];
  const U = s.upgrades || {}; const up = (k) => (U[k] || 0) * UPGRADES.find((u) => u.key === k).per;
  const bl = s.blessings || {}; const bf = {}; for (const b of buffs) for (const k in b.mod) bf[k] = (bf[k] || 0) + b.mod[k];
  const weapon = eq.find((it) => tmpl(it).slot === 'weapon'); const cat = weapon ? tmpl(weapon).cat : 'sword'; const W = WEAPONS[cat];
  const st = {};
  st.cat = cat; st.passives = passives; st.set = sc;
  st.maxHp = Math.round((HERO.hp + HERO.hpL * (L - 1) + (g.hp || 0)) * (1 + up('vitality') + (set.hpPct || 0) + (bl.hpPct || 0)));
  st.weaponAtk = g.atk || 0;
  st.baseAtk = HERO.atk + HERO.atkL * (L - 1);
  st.dmgPct = up('might') + (g.atkPct || 0) + (set.dmgPct || 0) + (bl.dmgPct || 0) + (bf.dmgPct || 0);
  st.def = (HERO.def + HERO.defL * (L - 1) + (g.def || 0)) * (1 + up('bulwark') + (set.defPct || 0));
  st.crit = Math.min(0.75, HERO.crit + (g.crit || 0) + (W.crit || 0) + up('precision') + (bf.crit || 0));
  st.critMult = HERO.critMult + (g.critMult || 0) + (W.critMult || 0) + (U.precision || 0) * 0.04 + (facet.critMult || 0);
  st.aspd = 1 + up('swiftness') + (g.aspd || 0) + (set.aspd || 0) + (facet.aspd || 0) + (bf.aspd || 0);
  st.speed = HERO.speed * (1 + (g.spd || 0) + (bf.spd || 0));
  st.ap = 1 + up('arcana') + (g.ap || 0) + (facet.ap || 0) + (bl.apPct || 0);
  st.cdr = Math.min(0.4, (U.arcana || 0) * 0.02);
  st.res = Math.min(0.6, (g.res || 0) + (bl.res || 0));
  st.find = up('fortune') + (g.find || 0) + (facet.find || 0) + (bf.find || 0);
  st.xpMult = 1 + (facet.xp || 0);
  st.ele = { fire: g.fire || 0, frost: g.frost || 0 };
  st.lastStand = set.lastStand || 0;
  st.regen = up('renewal');
  st.ampl = g.ampl || 0;
  st.artRaw = ARTIFACT.mult(s.artifact || 0);
  st.artMult = +(1 + (st.artRaw - 1) * (1 + st.ampl)).toFixed(3);
  st.resMult = (1 + (st.artMult - 1) * ARTIFACT.resShare) * (1 + st.find);
  st.dashCd = HERO.dashCd * (passives.has('mistDash') ? 0.65 : 1);
  st.attack = (st.baseAtk + st.weaponAtk) * (1 + st.dmgPct); // shown in stats; final hit dmg also * weapon mult * artMult
  st.range = W.range; st.W = W;
  // DPS estimate for the stats screen (expected value, includes crits and artifact)
  const hitMul = W.mult * (1 + (W.heavy - 1) / 3); st.dps = Math.round(st.attack * st.artMult * hitMul * (1 + st.crit * (st.critMult - 1)) * st.aspd / W.cd);
  return st;
}
export function equippedItems(s) { const out = []; for (const k in s.equip) { const id = s.equip[k]; if (!id) continue; const it = s.inv.find((x) => x.id === id); if (it) out.push(it); } return out; }
export function isEquipped(s, it) { return Object.values(s.equip).includes(it.id); }
// weighted rarity roll for a drop source; luck shifts weight to higher tiers
export function rollRarity(rnd, src, luck = 0) {
  const w = RARITIES.map((R, i) => R.weight * Math.pow(1 + luck, i));
  if (src === 'boss') { w[0] = 0; w[1] = 0; w[2] = 0; w[3] *= 4; w[4] *= 6; w[5] *= 10; }
  else if (src === 'elite') { w[0] *= 0.2; w[1] *= 0.6; w[2] *= 2; w[3] *= 3; w[4] *= 3; }
  else if (src === 'chest') { w[0] *= 0.5; w[2] *= 1.6; w[3] *= 2; w[4] *= 2; }
  else if (src === 'hidden') { w[0] = 0; w[1] = 0; w[3] *= 3; w[4] *= 5; w[5] *= 12; }
  else { w[5] = 0; w[4] *= 0.6; }
  const tot = w.reduce((a, b) => a + b, 0); let r = rnd() * tot; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; } return 0;
}
// choose a template for a drop source/rarity that the hero can use soon
export function rollTemplate(rnd, src, rarity, level) {
  const tag = src === 'shrine' ? 'shrine' : src;
  let pool = ITEMS.filter((t) => t.r === rarity && t.drop.includes(tag) && t.req <= level + 3);
  if (!pool.length) pool = ITEMS.filter((t) => t.r === rarity && t.req <= level + 3 && !(t.drop.length === 1 && t.drop[0] === 'boss'));
  if (!pool.length) pool = ITEMS.filter((t) => t.r <= rarity && t.req <= level + 2 && t.drop.includes('common'));
  return pool.length ? pool[Math.floor(rnd() * pool.length)] : ITEMS[0];
}
