// Arcane Realms core: world/region manager, hero controller, camera, combat manager, enemy spawning,
// loot & resources, interactions, quests, progression and persistence hooks. UI listens to events.
import * as THREE from 'three';
import { HERO, WEAPONS, SKILLS, ENEMIES, ITEM_BY_ID, RARITIES, SLOTS, QUESTS, QUEST_BY_ID, UPGRADES, upgCost, ARTIFACT, INDEX_MILESTONES, xpNeed, DEF_K, ENEMY_DEF_K, RES_KEYS, upgradeCost, ITEMS } from './data.js?v=1';
import { computeStats, makeItem, tmpl, rollRarity, rollTemplate, itemPower, isEquipped } from './items.js?v=1';
import { save as writeSave, INV_CAP } from './save.js?v=1';
import { buildWoodland, WOOD } from './woodland.js?v=1';
import { buildCitadel, CIT, trineCore } from './citadel.js?v=1';
import { OCC, interactMarker, glowSprite, emissive, tex, initMaterials } from './kit.js?v=1';
import { chestMesh } from './props.js?v=1';
import { HeroModel } from './hero.js?v=1';
import { Enemy } from './enemies.js?v=1';
import { Boss } from './boss.js?v=1';
import { FX, LightPool, Floaters } from './fx.js?v=1';
import { clamp, lerp, damp, angDiff, TAU, mulberry32, fmt } from './util.js?v=1';

const V = new THREE.Vector3(), V2 = new THREE.Vector3();
export class Game {
  constructor(scene, camera, audio, floatsEl) {
    this.scene = scene; this.camera = camera; this.audio = audio; initMaterials();
    this.fx = new FX(scene); this.lights = new LightPool(scene, 4); this.floats = new Floaters(floatsEl, camera);
    this.handlers = {}; this.worlds = {}; this.world = null; this.region = null; this.enemies = []; this.projs = []; this.pickups = []; this.objs = []; this.camps = []; this.buffs = [];
    this.input = { mx: 0, mz: 0, attack: false, skill: false, dash: false, flask: false, interact: false };
    this.t = 0; this.paused = true; this.playing = false; this.timeScale = 1; this.hitstop = 0; this.shake = 0; this.shakeV = new THREE.Vector3(); this.rng = mulberry32(20261115);
    this.cam = { x: 0, z: 0, dist: 21, want: 21, lx: 0, lz: 0 }; this.quality = 'medium';
    this.heroModel = new HeroModel(); scene.add(this.heroModel.group);
    this.heroLight = new THREE.PointLight(0xffd9a8, 4, 6, 1.6); scene.add(this.heroLight);
    this.trail = this.fx.trail(0xffffff, 12); this.trailB = new THREE.Vector3(); this.trailT = new THREE.Vector3();
    this.hero = { x: 0, z: 0, y: 0, vx: 0, vz: 0, kx: 0, kz: 0, ang: Math.PI, r: HERO.radius, hp: 100, alive: true, iframes: 0, dashT: 0, dashCd: 0, atkCd: 0, combo: 0, comboT: 0, skillCd: 0, skillT: 0, flaskCd: 0, deadT: 0, inCombat: 0, regenT: 0, secondWind: true };
    this.saveT = 0; this.dirty = false; this.zoneName = null; this.bossE = null; this.arenaLock = null; this.splitN = 0;
  }
  on(n, f) { (this.handlers[n] || (this.handlers[n] = [])).push(f); }
  emit(n, d) { for (const f of this.handlers[n] || []) f(d); }
  toast(text, kind = '') { this.emit('toast', { text, kind }); }
  // ---------------- state / stats ----------------
  start(s) { this.s = s;
    if (!s.equip.weapon) { let w = s.inv.find((it) => tmpl(it).slot === 'weapon' && tmpl(it).req <= s.level); if (!w) { w = makeItem('rusted_blade', 1, 4321); s.inv.push(w); s.index.rusted_blade = s.index.rusted_blade || { n: 1, at: Date.now() }; } s.equip.weapon = w.id; }
    this.recalc(); const H = this.hero; H.hp = s.hp && s.hp > 0 ? Math.min(s.hp, this.st.maxHp) : this.st.maxHp; this.refreshGear(); this.playing = true; this.paused = false;
    const region = s.region || 'citadel'; this.loadRegion(region, s.pos); this.questTick(); this.emit('state'); }
  recalc() { const prevMax = this.st ? this.st.maxHp : 0; this.st = computeStats(this.s, this.buffs); if (prevMax && this.hero.hp > this.st.maxHp) this.hero.hp = this.st.maxHp; this.trail.color.set(WEAPONS[this.st.cat].trail); this.emit('stats'); }
  gearLook() { const g = {}; for (const slot of SLOTS) { const id = this.s.equip[slot]; const it = id && this.s.inv.find((x) => x.id === id); if (!it) continue; const t = tmpl(it); g[slot] = slot === 'weapon' ? { cat: t.cat, look: t.look } : t.look; } return g; }
  refreshGear() { this.heroModel.setGear(this.gearLook()); }
  markDirty(now = false) { this.dirty = true; if (now) this.saveNow(); }
  saveNow() { if (!this.s) return; const H = this.hero; this.s.hp = H.alive ? H.hp : null; this.s.region = this.region; this.s.pos = this.region === 'woodland' && !this.arenaLock ? { x: H.x, z: H.z } : null; this.dirty = false; const ok = writeSave(this.s); this.emit('saved', ok); return ok; }
  setQuality(q) { this.quality = q; this.fx.setQuality(q); this.lights.set(this.scene, q === 'low' ? 1 : q === 'medium' ? 4 : 6); this.heroLight.visible = q !== 'low';
    // worlds are built per-quality; rebuild the current one if detail level changed
    if (this.region && this.worlds[this.region] && this.worlds[this.region].q !== q) { const r = this.region; const H = this.hero; for (const k in this.worlds) { this.scene.remove(this.worlds[k].root); } this.worlds = {}; this.world = null; this.region = null; this.loadRegion(r, { x: H.x, z: H.z }, true); } }
  // ---------------- regions ----------------
  buildWorld(id) { const w = id === 'woodland' ? buildWoodland(this.quality) : buildCitadel(this.quality); w.q = this.quality; w.id = id; return w; }
  loadRegion(id, pos, keepEnemies = false) {
    if (this.world) this.scene.remove(this.world.root);
    for (const e of this.enemies) this.scene.remove(e.model); this.enemies = []; for (const p of this.projs) this.scene.remove(p.mesh); this.projs = []; for (const p of this.pickups) this.scene.remove(p.mesh); this.pickups = [];
    for (const o of this.objs) { if (o.marker) this.scene.remove(o.marker); if (o.own) this.scene.remove(o.own); } this.objs = []; this.fx.clear(); this.floats.clear(); this.bossE = null; this.arenaLock = null; this.emit('boss', null);
    const w = this.worlds[id] || (this.worlds[id] = this.buildWorld(id)); this.world = w; this.region = id; this.scene.add(w.root); this.col = w.col;
    this.scene.fog.color.set(w.fog.color); this.scene.fog.density = w.fog.density; this.scene.background = new THREE.Color(w.sky);
    this.safeZone = id === 'citadel';
    const H = this.hero; const sp = pos || (id === 'woodland' ? WOOD.spawn : CIT.spawn); H.x = sp.x; H.z = sp.z; H.vx = H.vz = H.kx = H.kz = 0; H.ang = Math.PI; this.col.resolve(H, H.r);
    this.cam.x = H.x; this.cam.z = H.z; this.cam.lx = this.cam.lz = 0;
    this.buildObjects(id);
    if (id === 'woodland') { this.camps = WOOD.camps.map((c) => ({ ...c, alive: [], respawn: 0 })); for (const c of this.camps) this.spawnCamp(c); }
    else this.camps = [];
    this.audio.setAmbience(id === 'woodland' ? 'forest' : 'citadel');
    this.zoneName = null; this.emit('region', { id, name: id === 'woodland' ? 'Enchanted Woodland' : 'Forgotten Citadel', sub: id === 'woodland' ? 'Region · Levels 1–7' : 'Warden\'s Hall · Sanctuary' });
    this.questEvent('enter', id); this.saveNow();
  }
  travel(to) { if (this.travelling) return; this.travelling = true; this.audio.play('portal'); this.emit('fade', { out: true });
    this.heroModel.group.scale.setScalar(1); this.portalT = 0.6; const H = this.hero;
    setTimeout(() => { this.loadRegion(to, to === 'citadel' ? CIT.fromPortal : { x: WOOD.spawn.x, z: WOOD.spawn.z }); this.cam.dist = this.cam.want + 6; this.emit('fade', { out: false }); this.travelling = false; this.portalT = 0; this.heroModel.group.scale.setScalar(1); H.iframes = 1.5; }, 650); }
  spawnCamp(c) {
    c.alive = []; for (const [type, n] of c.list) for (let i = 0; i < n; i++) { const a = Math.random() * TAU, r = Math.random() * c.r; const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r; const lvl = c.lvl + (ENEMIES[type].elite ? 1 : 0); const e = new Enemy(type, lvl, x, z, c); this.col.resolve(e, e.r); e.home = { x: e.x, z: e.z }; this.addEnemy(e); c.alive.push(e); }
  }
  addEnemy(e) { this.enemies.push(e); this.scene.add(e.model); return e; }
  // ---------------- interactables ----------------
  buildObjects(id) {
    const list = id === 'woodland' ? WOOD.objects : CIT.objects; const s = this.s;
    for (const [kind, oid, x, z, ex = {}] of list) {
      const o = { kind, id: oid, x, z, r: 2.0, ex, cd: 0, y: this.world.groundY(x, z) };
      const set = (label, glyph, color, r = 2.0) => { o.label = label; o.glyph = glyph; o.color = color; o.r = r; };
      if (kind === 'portal') set(ex.to === 'citadel' ? 'Enter Portal · Forgotten Citadel' : 'Enter Portal · Enchanted Woodland', '◈', ex.to === 'citadel' ? 0xb98cff : 0x6dffb0, 2.4);
      else if (kind === 'shrine') set('Pray at the Moonwell', '☾', 0x6fd8ff, 2.8);
      else if (kind === 'altar') { set(ex.buff === 'fury' ? 'Altar of Fury · +30% damage' : 'Altar of Fortune · +50% loot', ex.buff === 'fury' ? '⚔' : '✦', ex.buff === 'fury' ? 0xff5a3a : 0xffd45a, 1.9); o.own = this.altarMesh(ex.buff); }
      else if (kind === 'chest') { set(ex.kind === 'hidden' ? 'Open Hidden Cache' : ex.kind === 'ornate' ? 'Open Ornate Chest' : 'Open Chest', '◆', ex.kind === 'hidden' ? 0xff5070 : 0xffc45a, 1.7); o.own = chestMesh(ex.kind); if (s.opened[oid]) { o.opened = true; o.own.userData.lid.rotation.x = -1.9; } }
      else if (kind === 'crystalNode') { set('Mine Crystals', '♦', 0x6fe7ff, 1.7); o.own = this.nodeMesh('crystal'); }
      else if (kind === 'glowcap') { set('Harvest Glowcaps · Essence', '✿', 0xc58bff, 1.6); o.own = this.nodeMesh('glowcap'); }
      else if (kind === 'bossAltar') { set('Light the Grove Heart', '✹', 0x6dff9a, 2.2); o.own = this.altarMesh('heart'); }
      else if (kind === 'pedestal') set('Trine Core · Artifact', '△', 0xffa040, 2.6);
      else if (kind === 'forge') set('Forge · Upgrades', '⚒', 0xff8a3a, 2.4);
      else if (kind === 'lectern') set('Curator\'s Lectern · Item Index', '❖', 0xb98cff, 2.2);
      else if (kind === 'font') set('Healing Font · Restore', '✚', 0x4dffd8, 2.3);
      else if (kind === 'armory') set('Armory · Equipment', '⚔', 0xd4a84a, 2.3);
      else if (kind === 'mapTable') set('War Table · World Map', '⌖', 0xd4a84a, 2.3);
      if (o.own) { o.own.position.set(x, o.y, z); if (kind === 'chest') o.own.rotation.y = Math.atan2(-x, -z) * 0 + Math.PI * (z < 0 && kind === 'chest' ? 0 : 0); this.scene.add(o.own); if (kind !== 'glowcap') this.col.add({ type: 'c', x, z, r: kind === 'chest' ? 0.55 : 0.5, obj: true }); }
      o.marker = interactMarker(o.r * 0.55, o.color, o.glyph); o.marker.position.set(x, o.y, z); o.marker.userData.icon.position.y = kind === 'portal' ? 4.6 : kind === 'pedestal' ? 4.2 : 2.3; this.scene.add(o.marker);
      if (o.opened) o.marker.visible = false; this.objs.push(o);
    }
  }
  altarMesh(kind) { const g = new THREE.Group(); const c = kind === 'fury' ? 0xff5a3a : kind === 'fortune' ? 0xffd45a : 0x6dff9a; const st = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 0.9, 6), new THREE.MeshStandardMaterial({ map: tex('stone'), color: 0x8a847a, roughness: 0.9 })); st.position.y = 0.45; st.castShadow = true; g.add(st);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.6, 0.15, 6), new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 0.8 })); top.position.y = 0.95; g.add(top);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(kind === 'heart' ? 0.32 : 0.22), emissive(c, 3)); gem.position.y = 1.5; g.add(gem); const sp = glowSprite(c, 2.2, 0.6); sp.position.y = 1.5; g.add(sp); g.userData = { gem, sp, c }; return g; }
  nodeMesh(kind) { const g = new THREE.Group(); if (kind === 'crystal') { for (let i = 0; i < 5; i++) { const h = 0.5 + Math.random() * 0.7; const m = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.16, h, 5), emissive(0x4ad8ff, 2.2)); m.position.set((Math.random() - 0.5) * 0.5, h / 2, (Math.random() - 0.5) * 0.5); m.rotation.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6); g.add(m); } const sp = glowSprite(0x4ad8ff, 2, 0.5); sp.position.y = 0.6; g.add(sp); }
    else { for (let i = 0; i < 6; i++) { const s = 0.5 + Math.random() * 0.8; const st = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.06 * s, 0.4 * s, 5), new THREE.MeshStandardMaterial({ color: 0xd8d0c0 })); const cp = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 8, 5, 0, TAU, 0, Math.PI / 2), emissive(0xc070ff, 2.6)); const a = Math.random() * TAU, d = Math.random() * 0.5; st.position.set(Math.cos(a) * d, 0.2 * s, Math.sin(a) * d); cp.position.set(st.position.x, 0.38 * s, st.position.z); g.add(st, cp); } const sp = glowSprite(0xc070ff, 1.8, 0.45); sp.position.y = 0.4; g.add(sp); }
    return g; }
  nearestObj() { const H = this.hero; let best = null, bd = 1e9; for (const o of this.objs) { if (o.opened || o.depleted) continue; const d = Math.hypot(H.x - o.x, H.z - o.z); if (d < o.r && d < bd && !this.col.segBlocked(H.x, H.z, o.x, o.z)) { best = o; bd = d; } } return best; }
  objReady(o) { if (o.cd > 0) return { ok: false, why: o.kind === 'altar' ? 'Recharging · ' + Math.ceil(o.cd) + 's' : 'Recovering · ' + Math.ceil(o.cd) + 's' }; if (o.kind === 'bossAltar') { if (this.bossE) return { ok: false, why: 'Gloomroot has awakened' }; if (this.s.bossKills > 0 && this.s.res.essence < 40) return { ok: false, why: 'Offer 40 Essence to re-awaken' }; } return { ok: true }; }
  useObj(o) {
    const s = this.s, H = this.hero; const r = this.objReady(o); if (!r.ok) { this.audio.play('denied'); this.toast(r.why, 'warn'); return; }
    this.heroModel.useT = 0; H.ang = Math.atan2(o.x - H.x, o.z - H.z);
    switch (o.kind) {
      case 'portal': this.travel(o.ex.to); break;
      case 'shrine': { this.audio.play('shrine'); this.healFull(); o.cd = 45; this.fx.ring(o.x, o.z, { r1: 6, color: 0x6fd8ff, life: 1.2 }); this.fx.burst(o.x, 1, o.z, { n: 50, color: [0x6fd8ff, 0xffffff], speed: 4, up: 5, life: 1.4, grav: -1 });
        if (!s.shrines[o.id]) { s.shrines[o.id] = 1; for (const k in o.ex.bless) s.blessings[k] = (s.blessings[k] || 0) + o.ex.bless[k]; this.recalc(); this.emit('reveal', { title: 'Moonwell Blessing', text: 'Permanent: +5% max health and +5% damage', glyph: '☾', color: '#6fd8ff' }); }
        else this.toast('The Moonwell restores you'); this.questEvent('shrine', o.id); break; }
      case 'altar': { this.audio.play('altar'); o.cd = o.ex.buff === 'fury' ? 120 : 150; this.addBuff(o.ex.buff); this.fx.ring(o.x, o.z, { r1: 4, color: o.color, life: 0.8 }); this.fx.burst(H.x, 1, H.z, { n: 30, color: o.color, speed: 3, up: 4, life: 1 }); break; }
      case 'chest': this.openChest(o); break;
      case 'crystalNode': { const n = 2 + Math.floor(Math.random() * 3); this.audio.play('crystalHit', { x: o.x, z: o.z }); this.fx.burst(o.x, 0.6, o.z, { n: 24, color: [0x6fe7ff, 0xffffff], speed: 4, life: 0.7 }); this.dropRes('crystals', n, o.x, o.z); o.cd = 0; o.depleted = 120; o.own.visible = false; o.marker.visible = false; break; }
      case 'glowcap': { const n = 3 + Math.floor(Math.random() * 4); this.audio.play('essence'); this.fx.burst(o.x, 0.4, o.z, { n: 20, color: [0xc58bff, 0xff9af0], speed: 2, up: 3, life: 1 }); this.dropRes('essence', n, o.x, o.z); o.depleted = 90; o.own.visible = false; o.marker.visible = false; break; }
      case 'bossAltar': { if (s.bossKills > 0) s.res.essence -= 40; this.audio.play('altar'); this.summonBoss(); break; }
      case 'pedestal': this.emit('open', 'artifact'); break;
      case 'forge': this.emit('open', 'upgrades'); break;
      case 'lectern': this.emit('open', 'index'); break;
      case 'armory': this.emit('open', 'inventory'); break;
      case 'mapTable': this.emit('open', 'map'); break;
      case 'font': { this.audio.play('heal'); this.healFull(); this.fx.burst(H.x, 0.8, H.z, { n: 30, color: [0x4dffd8, 0xffffff], speed: 2, up: 4, life: 1, grav: -1 }); this.toast('Health and flasks restored'); break; }
    }
    this.markDirty();
  }
  healFull() { const H = this.hero; H.hp = this.st.maxHp; this.s.flasks = HERO.flasks; this.emit('stats'); }
  openChest(o) {
    const s = this.s; o.opened = true; s.opened[o.id] = 1; s.stats.chests++; o.marker.visible = false; this.audio.play('chest'); this.openAnim = { o, t: 0 };
    const k = o.ex.kind; const lvl = this.zoneLevel(o.x, o.z);
    this.dropRes('gold', Math.round((k === 'wood' ? 30 : k === 'ornate' ? 70 : 140) * (1 + lvl * 0.2)), o.x, o.z, 6);
    if (k !== 'wood') this.dropRes('relics', k === 'hidden' ? 4 : 1 + (Math.random() < 0.5 ? 1 : 0), o.x, o.z);
    if (k === 'hidden') this.dropRes('crystals', 6, o.x, o.z);
    const n = k === 'wood' ? 1 : 2; for (let i = 0; i < n; i++) this.dropItem(k === 'hidden' ? 'hidden' : 'chest', lvl, o.x + (Math.random() - 0.5), o.z + 0.8);
    this.fx.burst(o.x, 0.8, o.z, { n: 40, color: [0xffd45a, 0xffffff], speed: 3, up: 6, life: 1.2 }); this.markDirty(true);
  }
  zoneLevel(x, z) { if (this.region !== 'woodland') return 1; let best = 1, bd = 1e9; for (const c of WOOD.camps) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = c.lvl; } } return best; }
  // ---------------- buffs ----------------
  addBuff(kind) { const B = { fury: { name: 'Fury', mod: { dmgPct: 0.3 }, t: 60, color: '#ff5a3a', glyph: '⚔' }, fortune: { name: 'Fortune', mod: { find: 0.5 }, t: 90, color: '#ffd45a', glyph: '✦' } }[kind]; this.buffs = this.buffs.filter((b) => b.id !== kind); this.buffs.push({ id: kind, ...B, max: B.t }); this.recalc(); this.toast(B.name + ' empowers you · ' + B.t + 's', 'buff'); }
  // ---------------- boss ----------------
  summonBoss() {
    const B = WOOD.boss; const lvl = Math.min(14, 6 + this.s.bossKills); const b = new Boss(lvl, B.x, B.z, B.arena); this.addEnemy(b); this.bossE = b; this.arenaLock = B.arena; b.aggro = true;
    this.audio.play('bossRoar'); this.audio.duck(0.4, 2); this.addShake(0.6); this.fx.ring(B.x, B.z, { r1: 10, color: 0x6dff9a, life: 1.5 }); for (let i = 0; i < 40; i++) this.fx.burst(B.x + (Math.random() - 0.5) * 6, 0.3, B.z + (Math.random() - 0.5) * 6, { n: 2, color: [0x5a3a2a, 0x6dff9a], speed: 3, up: 6, life: 1.2, norm: true });
    this.emit('boss', { name: b.D.name, sub: 'Level ' + lvl + ' · Miniboss', e: b });
  }
  bossPhase(b) { this.audio.play('bossRoar', { rate: 0.85 }); this.addShake(0.8); this.fx.ring(b.x, b.z, { r1: 8, color: 0xb03aff, life: 0.9 }); const H = this.hero; const dx = H.x - b.x, dz = H.z - b.z, d = Math.hypot(dx, dz) || 1; if (d < 7) { H.kx += dx / d * 14; H.kz += dz / d * 14; } this.emit('bossPhase', 'The Hollow Elder enrages!'); this.toast('Phase 2 · Gloomroot enrages', 'warn'); }
  summonAdds(b, n) { let c = 0; for (let i = 0; i < n; i++) { const a = Math.random() * TAU; const x = b.x + Math.cos(a) * 3.5, z = b.z + Math.sin(a) * 3.5; const e = new Enemy('mossling', b.lvl - 1, x, z, null); e.summoned = true; e.home = { x, z }; e.D = { ...e.D, leash: 60, detect: 40 }; e.set('detect', 0.6); e.aggro = true; this.addEnemy(e); this.fx.burst(x, 0.3, z, { n: 14, color: [0x6dff9a, 0x5a3a2a], speed: 3, up: 4, life: 0.8 }); c++; } }
  // ---------------- per-frame update ----------------
  update(rawDt) {
    if (!this.s) return; let dt = Math.min(rawDt, 0.05);
    if (this.hitstop > 0) { this.hitstop -= rawDt; dt *= 0.08; }
    this.t += dt; const H = this.hero; const s = this.s;
    if (!this.paused) { s.stats.playTime += rawDt; this.simulate(dt); }
    // world anim + camera always (menus dim the world but keep it alive)
    if (this.world) this.world.anim(this.t);
    this.updateCamera(rawDt);
    this.fx.update(this.paused ? 0 : dt, this.t); this.floats.update(rawDt, innerWidth, innerHeight);
    this.lights.update(dt, this.t, this.world ? this.world.lightSrc : [], this.cam.x, this.cam.z);
    this.heroLight.position.set(H.x, 1.8 + H.y, H.z + 0.6);
    OCC.uHero.value.set(H.x, H.y, H.z); OCC.uCam.value.copy(this.camera.position);
    if (this.world && this.world.motes) this.world.motes.material.uniforms.uC.value.set(this.cam.x, 0, this.cam.z);
    if (this.world && this.world.core) this.world.core.userData.level = s.artifact;
    if (!this.paused) { this.saveT += rawDt; if (this.saveT > 30 || (this.dirty && this.saveT > 3)) { this.saveT = 0; this.saveNow(); } }
  }
  simulate(dt) {
    const H = this.hero, s = this.s, st = this.st, I = this.input;
    // buffs
    let bch = false; for (const b of this.buffs) { b.t -= dt; if (b.t <= 0) bch = true; } if (bch) { this.buffs = this.buffs.filter((b) => b.t > 0); this.recalc(); }
    for (const o of this.objs) { if (o.cd > 0) o.cd -= dt; if (o.depleted) { o.depleted -= dt; if (o.depleted <= 0) { o.depleted = 0; o.own.visible = true; o.marker.visible = true; } } }
    if (this.openAnim) { const a = this.openAnim; a.t += dt; const u = clamp(a.t / 0.5, 0, 1); a.o.own.userData.lid.rotation.x = -1.9 * (1 - Math.pow(1 - u, 3)); a.o.own.userData.inner.material.opacity = Math.sin(clamp(a.t / 1.4, 0, 1) * Math.PI) * 0.9; if (a.t > 1.5) this.openAnim = null; }
    // hero
    if (H.alive) this.updateHero(dt); else { H.deadT += dt; this.heroModel.update(dt, { speed: 0, dead: true }); }
    // enemies
    let aggro = 0; for (const e of this.enemies) { e.update(this, dt); if (e.alive && e.aggro && e._d < 14) aggro++; }
    for (let i = this.enemies.length - 1; i >= 0; i--) { const e = this.enemies[i]; if (!e.alive && e.deadT > (e.boss ? 3 : 1.2)) { this.scene.remove(e.model); this.enemies.splice(i, 1); } }
    H.inCombat = aggro > 0 ? 4 : Math.max(0, H.inCombat - dt);
    // camp respawns (only out of sight)
    for (const c of this.camps) { c.alive = c.alive.filter((e) => e.alive); if (!c.alive.length) { c.respawn += dt; if (c.respawn > 50 && Math.hypot(H.x - c.x, H.z - c.z) > 20) { c.respawn = 0; this.spawnCamp(c); } } }
    this.updateProjs(dt); this.updatePickups(dt); this.tickAnims(dt);
    // interactions prompt
    const o = H.alive ? this.nearestObj() : null; if (o !== this.nearObj) { this.nearObj = o; this.emit('near', o); }
    for (const ob of this.objs) { if (!ob.marker.visible) continue; const u = ob.marker.userData; const near = ob === o; const d = Math.hypot(H.x - ob.x, H.z - ob.z); const prox = clamp(1 - (d - ob.r) / 6, 0, 1);
      u.ring.material.opacity = near ? 0.95 : 0.25 + 0.3 * prox; u.fill.material.opacity = near ? 0.35 + 0.1 * Math.sin(this.t * 6) : 0.05 * prox; u.icon.material.opacity = 0.55 + 0.45 * prox; u.icon.position.y += Math.sin(this.t * 2.4 + ob.x) * 0.002; u.icon.scale.setScalar(near ? 0.95 : 0.75);
      if (ob.own && ob.own.userData.gem) { ob.own.userData.gem.rotation.y = this.t * 1.5; ob.own.userData.gem.position.y = 1.5 + Math.sin(this.t * 2) * 0.08; ob.own.userData.sp.material.opacity = ob.cd > 0 ? 0.15 : 0.6; } }
    if (I.interact) { I.interact = false; if (o && H.alive) this.useObj(o); }
    // zone banner
    if (this.world.zoneAt) { const z = this.world.zoneAt(H.x, H.z); if (z && z !== this.zoneName) { this.zoneName = z; this.emit('zone', z); } }
    if (this.region === 'woodland') for (const [id, x, z, r] of WOOD.areas) if (Math.hypot(H.x - x, H.z - z) < r) this.questEvent('area', id);
    // music
    this.audio.setMusic(this.bossE && this.bossE.alive ? 'boss' : aggro > 0 ? 'combat' : this.region === 'citadel' ? 'citadel' : 'explore');
    this.audio.listener(H.x, H.z);
  }
  updateHero(dt) {
    const H = this.hero, st = this.st, I = this.input, W = WEAPONS[st.cat]; const hm = this.heroModel;
    H.iframes -= dt; H.atkCd -= dt; H.comboT -= dt; H.skillCd -= dt; H.dashCd -= dt; H.flaskCd -= dt; if (H.comboT <= 0) H.combo = 0;
    // regen out of combat
    if (H.inCombat <= 0 && H.hp < st.maxHp) { H.hp = Math.min(st.maxHp, H.hp + st.maxHp * (0.01 + st.regen) * dt); }
    let mx = I.mx, mz = I.mz; const mag = Math.min(1, Math.hypot(mx, mz)); if (mag > 1e-3) { mx /= Math.hypot(mx, mz); mz /= Math.hypot(I.mx, I.mz) ? 1 : 1; }
    const dl = Math.hypot(I.mx, I.mz) || 1; const dirx = I.mx / dl, dirz = I.mz / dl;
    // dash
    if (I.dash) { I.dash = false; if (H.dashCd <= 0 && H.dashT <= 0) { H.dashT = 0.2; H.dashCd = st.dashCd; H.iframes = st.passives.has('mistDash') ? 0.5 : HERO.iframes; const a = mag > 0.2 ? Math.atan2(dirx, dirz) : H.ang; H.dashDir = { x: Math.sin(a), z: Math.cos(a) }; H.ang = a; this.audio.play('dash'); this.fx.burst(H.x, 0.4, H.z, { n: 14, color: [0xbfe6ff, 0xffffff], speed: 2, life: 0.4, dir: { x: -H.dashDir.x, z: -H.dashDir.z } }); this.emit('cd'); } else if (H.dashCd > 0) this.audio.play('denied', { vol: 0.5 }); }
    if (I.flask) { I.flask = false; this.useFlask(); }
    if (I.skill) { I.skill = false; this.useSkill(); }
    // movement
    let spd = st.speed * mag; const attacking = H.atkCd > 0 && hm.atk; if (attacking) spd *= (W.proj ? 0.7 : 0.45); if (H.skillT > 0 && this.skillKind === 'whirl') spd = st.speed * mag * 0.6;
    let tvx = dirx * spd, tvz = dirz * spd; if (mag < 0.12) { tvx = 0; tvz = 0; }
    const acc = mag < 0.12 ? 22 : 16; H.vx = damp(H.vx, tvx, acc, dt); H.vz = damp(H.vz, tvz, acc, dt);
    let px = H.vx, pz = H.vz;
    if (H.dashT > 0) { H.dashT -= dt; const ds = HERO.dashDist / 0.2; px = H.dashDir.x * ds; pz = H.dashDir.z * ds; if (Math.random() < 0.8) this.fx.puff(H.x, 0.5, H.z, 0xbfe6ff, 0.3, 0.3); }
    if (this.lungeT > 0) { this.lungeT -= dt; px = this.lungeDir.x * 22; pz = this.lungeDir.z * 22; this.lungeHits(); }
    if (this.blink) { H.x = this.blink.x; H.z = this.blink.z; this.blink = null; }
    // knockback (decays fast; stable)
    px += H.kx; pz += H.kz; const kd = Math.exp(-10 * dt); H.kx *= kd; H.kz *= kd;
    // integrate with sub-steps so fast moves never tunnel through thin walls
    const steps = Math.ceil(Math.hypot(px, pz) * dt / 0.25) || 1; for (let i = 0; i < steps; i++) { H.x += px * dt / steps; H.z += pz * dt / steps; this.col.resolve(H, H.r); if (this.arenaLock) { const A = this.arenaLock; const d = Math.hypot(H.x - A.x, H.z - A.z); if (d > A.r - 0.6) { H.x = A.x + (H.x - A.x) / d * (A.r - 0.6); H.z = A.z + (H.z - A.z) / d * (A.r - 0.6); } } }
    H.y = damp(H.y, this.world.groundY(H.x, H.z), 14, dt);
    // facing
    if (mag > 0.15 && !attacking && H.skillT <= 0) { const a = Math.atan2(dirx, dirz); H.ang += angDiff(H.ang, a) * Math.min(1, 14 * dt); }
    else if (this.faceTo) { const a = Math.atan2(this.faceTo.x - H.x, this.faceTo.z - H.z); H.ang += angDiff(H.ang, a) * Math.min(1, 20 * dt); }
    // attacks: manual (held) or auto
    const tgt = this.findTarget(); this.target = tgt;
    const reach = W.proj ? W.range : W.range + 0.9;
    const want = I.attack || (this.s.settings.autoAttack && tgt && tgt.d <= reach && (mag < 0.3 || W.proj || tgt.d < W.range * 0.7));
    if (want && H.atkCd <= 0 && H.dashT <= 0 && H.skillT <= 0) this.heroAttack(tgt);
    if (this.pendingHit) { this.pendingHit.t -= dt; if (this.pendingHit.t <= 0) { const p = this.pendingHit; this.pendingHit = null; this.resolveHit(p); } }
    if (H.skillT > 0) this.updateSkill(dt);
    // footsteps
    const moving = Math.hypot(H.vx, H.vz); this.stepT = (this.stepT || 0) + moving * dt; if (this.stepT > 1.15) { this.stepT = 0; this.audio.play(this.region === 'citadel' ? 'stepStone' : 'step', { vol: 0.8 }); if (this.region === 'woodland' && Math.random() < 0.5) this.fx.burst(H.x, 0.05, H.z, { n: 2, color: 0x6a7a5a, speed: 0.6, up: 0.8, life: 0.4, size: 0.12, norm: true }); }
    // model
    const g = hm.group; g.position.set(H.x, H.y, H.z); g.rotation.y = H.ang;
    hm.update(dt, { speed: moving / HERO.speed, dashing: H.dashT > 0 || this.lungeT > 0, spin: this.skillKind === 'whirl' && H.skillT > 0 ? (0.7 - H.skillT) * 22 : 0 });
    // flicker while invulnerable after a hit
    g.visible = !(H.iframes > 0 && H.iframes < 0.35 && this.hurtFlash && Math.floor(this.t * 30) % 2 === 0);
    // weapon trail
    const trailing = (hm.atk && hm.atk.t > hm.atk.dur * 0.22 && hm.atk.t < hm.atk.dur * 0.62 && !W.proj) || (H.skillT > 0 && this.skillKind !== 'volley' && this.skillKind !== 'nova');
    this.trail.active = trailing; if (trailing && hm.bladePoints(this.trailB, this.trailT)) this.trail.push(this.trailB, this.trailT);
    if (this.portalT > 0) { this.portalT -= dt; g.scale.setScalar(Math.max(0.05, this.portalT / 0.6)); g.rotation.y += (0.6 - this.portalT) * 20; }
  }
  findTarget(maxD = 12) { const H = this.hero; let best = null, bd = maxD; for (const e of this.enemies) { if (!e.alive || e.state === 'reset') continue; const d = Math.hypot(e.x - H.x, e.z - H.z) - e.r; if (d < bd && (d < 3 || this.los(H.x, H.z, e.x, e.z))) { bd = d; best = e; } } return best ? { e: best, d: bd } : null; }
  los(ax, az, bx, bz) { return !this.col.segBlocked(ax, az, bx, bz, 0.5); }
  heroAttack(tgt) {
    const H = this.hero, st = this.st, W = WEAPONS[st.cat]; const dur = W.cd / st.aspd; H.atkCd = dur; const heavy = H.combo === 2; const combo = H.combo; H.combo = (H.combo + 1) % 3; H.comboT = dur + 0.6;
    let tx, tz; if (tgt) { tx = tgt.e.x; tz = tgt.e.z; H.ang = Math.atan2(tx - H.x, tz - H.z); this.faceTo = { x: tx, z: tz }; } else { this.faceTo = null; }
    // short attack-step toward a target just out of melee reach
    if (tgt && !W.proj && tgt.d > W.range * 0.8 && tgt.d < W.range + 2.5) { const k = Math.min(1.4, tgt.d - W.range * 0.7); H.kx += Math.sin(H.ang) * k * 9; H.kz += Math.cos(H.ang) * k * 9; }
    this.heroModel.attack(st.cat, dur * 0.95, combo, heavy);
    this.pendingHit = { t: (W.windup + (heavy ? 0.05 : 0)) / st.aspd, heavy, tgt: tgt && tgt.e, combo };
    this.audio.play(W.sfx, { rate: heavy ? 0.85 : 1 + combo * 0.05 });
  }
  resolveHit(p) {
    const H = this.hero, st = this.st, W = WEAPONS[st.cat]; const fx = Math.sin(H.ang), fz = Math.cos(H.ang); const mult = p.heavy ? W.heavy : 1;
    if (W.proj) { // projectile weapons
      const t = p.tgt && p.tgt.alive ? p.tgt : null; let a = H.ang; if (t) { const lead = Math.hypot(t.x - H.x, t.z - H.z) / W.proj.speed; a = Math.atan2(t.x + (t.vx || 0) * lead - H.x, t.z + (t.vz || 0) * lead - H.z); }
      const n = st.cat === 'bow' && st.passives.has('split') && (++this.splitN % 3 === 0) ? 3 : 1;
      for (let i = 0; i < n; i++) this.heroShot(a + (i - (n - 1) / 2) * 0.18, mult, W.proj, { heavy: p.heavy }); return; }
    const reach = W.range + (p.heavy ? 0.3 : 0); const half = (W.arc / 2) * Math.PI / 180; let hits = 0;
    for (const e of this.enemies) { if (!e.alive) continue; const dx = e.x - H.x, dz = e.z - H.z; const d = Math.hypot(dx, dz); if (d - e.r > reach) continue; const ang = Math.acos(clamp((dx * fx + dz * fz) / (d || 1), -1, 1)); if (d > e.r + 0.4 && ang > half + Math.atan2(e.r, d)) continue;
      this.damageEnemy(e, mult, { heavy: p.heavy, dir: { x: dx / (d || 1), z: dz / (d || 1) }, knock: W.knock * (p.heavy ? 1.6 : 1), poise: (W.poise || 1) * (p.heavy ? 18 : 10) }); hits++; }
    // swing sparks in the arc even on whiffs (readable feedback)
    const tipx = H.x + fx * reach * 0.8, tipz = H.z + fz * reach * 0.8; if (!hits) this.fx.burst(tipx, 0.6, tipz, { n: 4, color: W.trail, speed: 2, life: 0.25, size: 0.1 });
    if (p.heavy && hits && st.passives.has('shockwave')) { this.fx.ring(H.x + fx * 1.2, H.z + fz * 1.2, { r1: 3.2, color: 0xffc46a }); for (const e of this.enemies) if (e.alive && Math.hypot(e.x - H.x - fx * 1.2, e.z - H.z - fz * 1.2) < 3.2) this.damageEnemy(e, 0.6, { dir: { x: fx, z: fz }, knock: 2, poise: 15, proc: true }); }
    if (p.heavy && hits) { this.addShake(0.15); if (st.cat === 'axe') this.audio.play('hitHeavy'); }
  }
  heroShot(a, mult, P, o = {}) { const H = this.hero; const m = this.projMesh(P.kind === 'orb' ? 'orb' : 'arrow', P.color); const sx = H.x + Math.sin(a) * 0.5, sz = H.z + Math.cos(a) * 0.5;
    const pr = { mesh: m, x: sx, z: sz, y: 0.85 + H.y, vx: Math.sin(a) * P.speed, vz: Math.cos(a) * P.speed, life: (WEAPONS[this.st.cat].range + 2) / P.speed, owner: 'hero', mult, r: P.radius, aoe: P.aoe, kind: P.kind, color: P.color, heavy: o.heavy, skill: o.skill, pierce: o.pierce || 0, hit: new Set() };
    m.position.set(pr.x, pr.y, pr.z); m.rotation.y = a; this.scene.add(m); this.projs.push(pr); return pr; }
  enemyShot(e, P, dmg) { const H = this.hero; const d = Math.hypot(H.x - e.x, H.z - e.z); const lead = d / P.speed * 0.6; const a = Math.atan2(H.x + H.vx * lead - e.x, H.z + H.vz * lead - e.z); const m = this.projMesh(P.kind, P.color);
    const pr = { mesh: m, x: e.x + Math.sin(a) * 0.5, z: e.z + Math.cos(a) * 0.5, y: P.kind === 'orb' ? 1.0 : 0.75, vx: Math.sin(a) * P.speed, vz: Math.cos(a) * P.speed, life: 14 / P.speed + 0.5, owner: 'enemy', src: e, dmg, el: e.D.el, r: P.kind === 'orb' ? 0.3 : 0.15, kind: P.kind, color: P.color, homing: P.homing || 0, speed: P.speed, slow: P.slow };
    m.position.set(pr.x, pr.y, pr.z); m.rotation.y = a; this.scene.add(m); this.projs.push(pr); this.audio.play(P.kind === 'arrow' ? 'arrow' : 'fireCast', { x: e.x, z: e.z, rate: P.kind === 'arrow' ? 1 : 1.3, vol: 0.7 }); }
  projMesh(kind, color) { const g = new THREE.Group(); if (kind === 'arrow') { const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 4), new THREE.MeshBasicMaterial({ color: 0x8a6a4a })); sh.rotation.x = Math.PI / 2; g.add(sh); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), new THREE.MeshBasicMaterial({ color })); tip.rotation.x = Math.PI / 2; tip.position.z = 0.32; g.add(tip); const s = glowSprite(color, 0.6, 0.6); s.position.z = 0.25; g.add(s); }
    else { const c = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); g.add(c); const s = glowSprite(color, 1.3, 0.9); g.add(s); } return g; }
  updateProjs(dt) {
    const H = this.hero;
    for (let i = this.projs.length - 1; i >= 0; i--) { const p = this.projs[i]; p.life -= dt; let dead = p.life <= 0;
      if (p.homing && H.alive) { const a = Math.atan2(p.vx, p.vz), want = Math.atan2(H.x - p.x, H.z - p.z); const na = a + clamp(angDiff(a, want), -p.homing * dt, p.homing * dt); p.vx = Math.sin(na) * p.speed; p.vz = Math.cos(na) * p.speed; p.mesh.rotation.y = na; }
      const n = Math.ceil(Math.hypot(p.vx, p.vz) * dt / 0.3) || 1;
      for (let k = 0; k < n && !dead; k++) { p.x += p.vx * dt / n; p.z += p.vz * dt / n;
        if (this.col.pointBlocked(p.x, p.z)) { dead = true; this.projImpact(p, null); break; }
        if (p.owner === 'hero') { for (const e of this.enemies) { if (!e.alive || p.hit.has(e)) continue; const yy = e.boss ? 1.6 : 0; if (Math.hypot(e.x - p.x, e.z - p.z) < e.r + p.r + yy * 0.3) { p.hit.add(e); this.projImpact(p, e); if (p.pierce-- <= 0) { dead = true; break; } } } }
        else if (H.alive && Math.hypot(H.x - p.x, H.z - p.z) < H.r + p.r) { dead = true; if (H.iframes <= 0) { this.hurtHero(p.dmg, p.el, p.src, { kx: p.vx / (p.speed || 10), kz: p.vz / (p.speed || 10), k: 1.5 }); if (p.slow) H.slowT = p.slow; } this.fx.burst(p.x, p.y, p.z, { n: 10, color: p.color, speed: 3, life: 0.35 }); } }
      p.mesh.position.set(p.x, p.y, p.z); if (p.kind === 'orb' && Math.random() < 0.7) this.fx.puff(p.x, p.y, p.z, p.color, 0.3, 0.3);
      if (dead) { this.scene.remove(p.mesh); this.projs.splice(i, 1); } }
  }
  projImpact(p, e) {
    if (p.owner !== 'hero') { this.fx.burst(p.x, p.y, p.z, { n: 8, color: p.color, speed: 2, life: 0.3 }); return; }
    const dir = { x: p.vx / Math.hypot(p.vx, p.vz), z: p.vz / Math.hypot(p.vx, p.vz) };
    if (p.aoe) { this.fx.burst(p.x, p.y, p.z, { n: 18, color: [p.color, 0xffffff], speed: 4, life: 0.45 }); this.fx.ring(p.x, p.z, { r1: p.aoe, color: p.color, life: 0.35 }); this.audio.play('hitMagic', { x: p.x, z: p.z });
      for (const o of this.enemies) if (o.alive && Math.hypot(o.x - p.x, o.z - p.z) < p.aoe + o.r) this.damageEnemy(o, o === e ? p.mult : p.mult * 0.6, { dir, knock: 1, poise: 10, heavy: p.heavy, skill: p.skill, ranged: true, el: 'arcane' }); }
    else if (e) this.damageEnemy(e, p.mult, { dir, knock: 0.7, poise: 8, heavy: p.heavy, skill: p.skill, ranged: true });
  }
  // ---------------- damage ----------------
  roll() { return this.rng(); }
  heroDamage(mult, o = {}) { const st = this.st; let base = st.attack * WEAPONS[st.cat].mult * mult * st.artMult * (o.skill ? st.ap : 1) * (0.93 + this.roll() * 0.14); base += (st.ele.fire + st.ele.frost) * (o.proc ? 0.5 : 1); const crit = !o.noCrit && this.roll() < st.crit; if (crit) base *= st.critMult; return { amt: base, crit }; }
  damageEnemy(e, mult, o = {}) {
    if (!e.alive) return 0; const H = this.hero; const st = this.st; let { amt, crit } = this.heroDamage(mult, o);
    if (e.state === 'intro' || e.state === 'transition') { amt *= 0.1; crit = false; }
    // elite guard: frontal hits are blocked unless staggered/heavy/skill
    let blocked = false; if (e.D.guard && e.state !== 'stagger' && !o.skill && !o.heavy) { const dx = H.x - e.x, dz = H.z - e.z; const d = Math.hypot(dx, dz) || 1; if ((dx * Math.sin(e.ang) + dz * Math.cos(e.ang)) / d > 0.3) { amt *= 1 - e.D.guard; blocked = true; } }
    amt = Math.max(1, amt * ENEMY_DEF_K / (ENEMY_DEF_K + e.def)); amt = Math.round(amt);
    e.hp -= amt; e.flash = 0.12; e.lastHit = this.t; e.bar.visible = true; if (!e.aggro && !e.boss) e.alert(this); this.s.stats.dmg += amt; if (amt > this.s.stats.bestHit) this.s.stats.bestHit = amt;
    if (crit) this.s.stats.crits++;
    // feedback: number, particles in the attack direction, sound, knockback, camera impulse on crits
    const dir = o.dir || { x: 0, z: 1 }; const hy = (e.boss ? 3 : e.model.userData.eyeH * 0.6) + e.y;
    if (this.s.settings.dmgNums) this.floats.spawn(e.x, hy + 0.4, e.z, (blocked ? '⛨' : '') + fmt(amt) + (crit ? '!' : ''), crit ? 'crit' : blocked ? 'blk' : o.skill ? 'skl' : '');
    const W = WEAPONS[st.cat]; const col = blocked ? [0xbfe6ff, 0xffffff] : crit ? [0xffd45a, 0xffffff, 0xff8a3a] : [W.trail, 0xffffff];
    this.fx.burst(e.x - dir.x * e.r * 0.5, hy * 0.7, e.z - dir.z * e.r * 0.5, { n: crit ? 22 : 10, color: col, speed: crit ? 6 : 4.5, life: 0.4, dir, size: 0.16 });
    if (e.type === 'barkhide' || e.type === 'gloomroot') this.fx.burst(e.x, hy * 0.6, e.z, { n: 5, color: [0x5a3a24, 0x3a6a34], speed: 3, life: 0.6, dir, norm: true, size: 0.14 });
    if (!o.proc) this.audio.play(blocked ? 'block' : crit ? 'crit' : (o.ranged && W.proj && W.proj.kind === 'orb') ? 'hitMagic' : W.hit, { x: e.x, z: e.z, rate: o.heavy ? 0.85 : 1 });
    if (!o.proc && Math.random() < 0.5 && !e.boss) this.audio.play(e.type === 'sentinel' ? 'clank' : 'creatureHurt', { x: e.x, z: e.z, rate: e.D.size > 1 ? 0.6 : 1.2 - e.D.size * 0.4 });
    if (crit) { this.addShake(0.12); this.hitstop = Math.max(this.hitstop, 0.05); this.lights.flash(e.x, 1, e.z, 0xffd45a, 10, 5, 0.15); this.fx.ring(e.x, e.z, { r1: 1.2, color: 0xffd45a, life: 0.25, y: e.y }); }
    else if (o.heavy) this.hitstop = Math.max(this.hitstop, 0.035);
    const mass = e.boss ? 0 : e.D.cls === 'heavy' || e.D.elite ? 0.25 : 1; const kb = (o.knock || 1) * mass * (crit ? 1.4 : 1) * 3; e.vx += dir.x * kb; e.vz += dir.z * kb;
    if (!e.boss) { e.poise -= (o.poise || 10) * (crit ? 1.5 : 1); if (e.poise <= 0 && e.state !== 'stagger') { e.stagger(this, e.D.cls === 'heavy' || e.D.elite ? 1.2 : 0.6); e.poise = e.D.poise; if (e.D.elite || e.D.cls === 'heavy') { this.floats.spawn(e.x, hy + 1.0, e.z, 'STAGGER', 'stg'); this.audio.play('clank', { x: e.x, z: e.z, rate: 0.6 }); } } }
    // passives
    const P = st.passives;
    if (!o.proc) {
      if (P.has('vampiric')) H.hp = Math.min(st.maxHp, H.hp + amt * 0.04);
      if (P.has('ignite')) { e.burn = { t: 3, tick: 0.5, dps: amt * 0.2 }; }
      if (P.has('cdrCrit') && crit) H.skillCd -= 0.6;
      if (P.has('novaCrit') && crit) { this.fx.ring(e.x, e.z, { r1: 2.2, color: 0x8fb0ff }); for (const o2 of this.enemies) if (o2 !== e && o2.alive && Math.hypot(o2.x - e.x, o2.z - e.z) < 2.2) this.damageEnemy(o2, 0.5, { dir, proc: true, poise: 6 }); }
      if (P.has('chain')) { let n = 0; for (const o2 of this.enemies) { if (n >= 2) break; if (o2 === e || !o2.alive || Math.hypot(o2.x - e.x, o2.z - e.z) > 5) continue; n++; this.zap(e, o2); this.damageEnemy(o2, 0.45 * mult, { dir, proc: true, poise: 4 }); } }
    }
    if (e.hp <= 0) this.killEnemy(e, dir);
    return amt;
  }
  dot(e, amt, kind) { if (!e.alive) return; amt = Math.max(1, Math.round(amt)); e.hp -= amt; e.flash = 0.06; if (this.s.settings.dmgNums) this.floats.spawn(e.x, (e.boss ? 3 : e.model.userData.eyeH * 0.6) + 0.5, e.z, fmt(amt), 'dot'); this.fx.burst(e.x, 0.8, e.z, { n: 4, color: [0xff7a2a, 0xffd45a], speed: 1.5, up: 2, life: 0.5 }); if (e.hp <= 0) this.killEnemy(e, { x: 0, z: 1 }); }
  zap(a, b) { const n = 8; for (let i = 0; i <= n; i++) { const t = i / n; this.fx.puff(a.x + (b.x - a.x) * t + (Math.random() - 0.5) * 0.3, 1 + (Math.random() - 0.5) * 0.4, a.z + (b.z - a.z) * t + (Math.random() - 0.5) * 0.3, 0xff8080, 0.25, 0.2); } this.audio.play('hitMagic', { x: b.x, z: b.z, rate: 1.5, vol: 0.5 }); }
  killEnemy(e, dir) {
    if (!e.alive) return; e.alive = false; e.hp = 0; e.deadT = 0; if (e.tele) { e.tele.done(); e.tele = null; } if (e.clearTels) e.clearTels(); const s = this.s; const D = e.D; const H = this.hero;
    s.stats.kills++; this.audio.play('creatureDie', { x: e.x, z: e.z, rate: D.size > 1 ? 0.6 : 1 });
    const cols = { mossling: [0x6dff5a, 0x4f8a3a], thornfang: [0xff3a2a, 0x8a8a9a], barkhide: [0xffb02a, 0x6a4a32], briar: [0xffe05a, 0xa04a88], wisp: [0xff8a2a, 0xffe0a0], sporemender: [0xff9af0, 0x6affb0], sentinel: [0x6dffd8, 0xb0b0a8], gloomroot: [0xff3a5a, 0xb03aff] }[e.type] || [0xffffff];
    this.fx.burst(e.x, 0.6 + e.y, e.z, { n: e.boss ? 120 : D.elite ? 50 : 26, color: cols, speed: e.boss ? 8 : 4, up: 4, life: e.boss ? 1.6 : 0.9, dir: { x: dir.x * 0.5, z: dir.z * 0.5 }, size: 0.2 });
    this.fx.ring(e.x, e.z, { r1: e.boss ? 9 : D.size * 2.2, color: cols[0], life: 0.5 });
    // rewards
    this.addXp(Math.round(D.xp * e.rew));
    const g = D.gold; this.dropRes('gold', Math.round((g[0] + Math.random() * (g[1] - g[0])) * e.rew), e.x, e.z, e.boss ? 12 : 3);
    for (const k of ['essence', 'crystals', 'relics', 'tokens']) if (D[k]) this.dropRes(k, Math.round(D[k][0] + Math.random() * (D[k][1] - D[k][0])), e.x, e.z);
    if (!D[ 'essence' ] && Math.random() < 0.25) this.dropRes('essence', 1 + Math.floor(Math.random() * 2), e.x, e.z);
    if (Math.random() < D.drop * (e.summoned ? 0.3 : 1)) this.dropItem(e.boss ? 'boss' : D.elite ? 'elite' : 'common', e.lvl, e.x, e.z);
    if (e.boss) { this.dropItem('boss', e.lvl, e.x + 1, e.z); if (s.bossKills === 0) this.dropItem('boss', e.lvl, e.x - 1, e.z); this.bossKilled(e); }
    this.questEvent('kill', e.type); this.questEvent('killType', e.type); this.markDirty();
  }
  bossKilled(e) { const s = this.s; s.bossKills++; s.stats.bosses = (s.stats.bosses || 0) + 1; this.arenaLock = null; this.bossE = null; for (const o of this.enemies) if (o.summoned && o.alive) this.killEnemy(o, { x: 0, z: 1 });
    this.audio.play('victory'); this.audio.duck(0.3, 3); this.addShake(1); this.heroModel.vicT = 0; this.emit('boss', null); this.emit('reveal', { title: 'Gloomroot Defeated', text: 'The Grove Heart is cleansed. Boss Token earned. The altar can re-awaken it for greater rewards.', glyph: '✹', color: '#6dff9a', big: true }); this.markDirty(true); }
  hurtHero(amt, el, src, k = {}) {
    const H = this.hero, st = this.st; if (!H.alive || H.iframes > 0 || this.paused) return;
    let dmg = amt * DEF_K / (DEF_K + st.def); if (el && el !== 'phys') dmg *= 1 - st.res; if (st.passives.has('dread') && src && Math.hypot(src.x - H.x, src.z - H.z) < 5) dmg *= 0.88; if (st.lastStand && H.hp < st.maxHp * 0.5) dmg *= 1 - st.lastStand;
    dmg = Math.max(1, Math.round(dmg * (0.94 + this.roll() * 0.12))); H.hp -= dmg; H.iframes = 0.3; this.hurtFlash = true; H.inCombat = 4;
    if (st.passives.has('thorns') && src && src.alive) this.dot(src, st.def * 0.3, 'thorns');
    this.floats.spawn(H.x, 1.4 + H.y, H.z, '-' + fmt(dmg), 'hurt'); this.audio.play('playerHurt'); this.heroModel.hurtT = 0.25; this.emit('hurt', dmg / st.maxHp); this.addShake(Math.min(0.35, 0.1 + dmg / st.maxHp));
    this.fx.burst(H.x, 0.8, H.z, { n: 10, color: [0xff3a3a, 0xffa0a0], speed: 3, life: 0.4, dir: { x: k.kx || 0, z: k.kz || 0 } });
    if (k.k) { H.kx += (k.kx || 0) * k.k * 2.2; H.kz += (k.kz || 0) * k.k * 2.2; }
    if (H.hp <= 0) { if (st.passives.has('secondWind') && H.secondWind) { H.secondWind = false; H.hp = st.maxHp * 0.3; H.iframes = 1.5; this.toast('Gloomroot Heart · Second Wind!', 'buff'); this.audio.play('heal'); this.fx.ring(H.x, H.z, { r1: 4, color: 0xff4060 }); return; } this.heroDie(); }
    this.emit('stats');
  }
  heroDie() { const H = this.hero; H.alive = false; H.hp = 0; H.deadT = 0; this.s.stats.deaths++; this.audio.play('death'); this.audio.duck(0.3, 3); this.emit('dead'); this.pendingHit = null; this.heroModel.atk = null; }
  respawn() { const H = this.hero; H.alive = true; H.hp = this.st.maxHp; H.iframes = 2; H.secondWind = true; this.s.flasks = HERO.flasks; this.heroModel.update(0.01, { speed: 0, dead: false });
    if (this.bossE) { this.scene.remove(this.bossE.model); this.enemies = this.enemies.filter((e) => e !== this.bossE && !e.summoned); this.bossE.clearTels(); this.bossE = null; this.emit('boss', null); } this.arenaLock = null;
    const sp = this.region === 'woodland' ? WOOD.spawn : CIT.spawn; H.x = sp.x; H.z = sp.z; this.cam.x = H.x; this.cam.z = H.z; for (const e of this.enemies) if (e.alive && e.aggro) e.set('reset'); this.emit('stats'); this.markDirty(true); }
  // enemy area attacks
  slam(x, z, r, dmg, el, src, color = 0xb08a5a, shake = 3) { const H = this.hero; this.fx.ring(x, z, { r1: r * 1.1, color: 0xffb070, life: 0.45 }); this.fx.burst(x, 0.2, z, { n: 26, color: [color, 0x6a5a4a], speed: 5, up: 5, life: 0.8, norm: true, size: 0.22 }); this.fx.burst(x, 0.2, z, { n: 12, color: 0xffd0a0, speed: 4, life: 0.4 }); this.audio.play('slam', { x, z, rate: r > 2.6 ? 0.85 : 1.15, vol: r > 2.6 ? 1 : 0.6 }); this.addShake(shake * 0.07);
    if (H.alive && Math.hypot(H.x - x, H.z - z) < r + H.r) { const d = Math.hypot(H.x - x, H.z - z) || 1; this.hurtHero(dmg, el, src, { kx: (H.x - x) / d, kz: (H.z - z) / d, k: 4 }); } }
  cone(x, z, ang, r, deg, dmg, el, src, k = 4) { const H = this.hero; const fx = Math.sin(ang), fz = Math.cos(ang); for (let i = 0; i < 18; i++) { const a = ang + (i / 17 - 0.5) * deg * Math.PI / 180; this.fx.burst(x + Math.sin(a) * r * 0.7, 0.5, z + Math.cos(a) * r * 0.7, { n: 2, color: [0xffb070, 0x6a4a32], speed: 3, life: 0.5 }); } this.audio.play('chop', { x, z, rate: 0.55 }); this.addShake(0.15);
    const dx = H.x - x, dz = H.z - z, d = Math.hypot(dx, dz); if (H.alive && d < r + H.r && Math.acos(clamp((dx * fx + dz * fz) / (d || 1), -1, 1)) < deg * Math.PI / 360 + 0.08) this.hurtHero(dmg, el, src, { kx: fx, kz: fz, k }); }
  spikes(x, z, ang, len, w, dmg, src) { const H = this.hero; const fx = Math.sin(ang), fz = Math.cos(ang); this.audio.play('roots', { x, z }); this.addShake(0.12);
    for (let d = 1; d < len; d += 0.9) { const px = x + fx * d, pz = z + fz * d; this.spikeMesh(px + (Math.random() - 0.5) * w * 0.6, pz + (Math.random() - 0.5) * w * 0.6, d * 0.025); }
    const dx = H.x - x, dz = H.z - z; const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx); if (H.alive && along > 0 && along < len && side < w / 2 + H.r) this.hurtHero(dmg, 'nature', src, { kx: -fz * Math.sign(dx * fz - dz * fx) || fx, kz: fx * Math.sign(dx * fz - dz * fx) || fz, k: 3 }); }
  spikeMesh(x, z, delay) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.4, 5), new THREE.MeshStandardMaterial({ color: 0x4a3226, roughness: 0.9, flatShading: true })); m.position.set(x, -1, z); m.rotation.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5); this.scene.add(m); let t = -delay; const tick = (dt) => { t += dt; const y = t < 0 ? -1 : t < 0.12 ? -1 + t / 0.12 * 1.6 : t < 0.9 ? 0.6 : 0.6 - (t - 0.9) * 3; m.position.y = y; if (t > 0 && t < 0.02) this.fx.burst(x, 0.1, z, { n: 3, color: 0x5a4a3a, speed: 2, up: 3, life: 0.4, norm: true }); return t < 1.3; }; this.anims = this.anims || []; this.anims.push({ tick, done: () => { this.scene.remove(m); m.geometry.dispose(); } }); }
  eruption(x, z, r, dmg, el, src) { this.fx.burst(x, 0.2, z, { n: 30, color: [0xff8a2a, 0xffe0a0, 0xff3a1a], speed: 4, up: 7, life: 0.7 }); this.fx.ring(x, z, { r1: r * 1.1, color: 0xff7a1a, life: 0.4 }); this.lights.flash(x, 1, z, 0xff7a1a, 12, 6, 0.3); this.audio.play('fireBurst', { x, z }); const H = this.hero; if (H.alive && Math.hypot(H.x - x, H.z - z) < r + H.r) this.hurtHero(dmg, el, src, { kx: 0, kz: 0 }); }
  gloomRing(x, z, r0, r1, dmg, src) { const H = this.hero; this.fx.ring(x, z, { r0, r1, color: 0xb03aff, life: 0.8 }); for (let i = 0; i < 60; i++) { const a = Math.random() * TAU, d = r0 + Math.random() * (r1 - r0); this.fx.burst(x + Math.cos(a) * d, 0.3, z + Math.sin(a) * d, { n: 1, color: [0xb03aff, 0xff3a8a], speed: 1, up: 5, life: 0.9 }); } this.audio.play('slam', { x, z, rate: 0.7 }); this.audio.play('fireBurst', { x, z, rate: 0.6 }); this.addShake(0.4);
    const d = Math.hypot(H.x - x, H.z - z); if (H.alive && d > r0 - H.r && d < r1) this.hurtHero(dmg, 'nature', src, { kx: (H.x - x) / (d || 1), kz: (H.z - z) / (d || 1), k: 3 }); }
  healFx(t) { this.fx.burst(t.x, 1, t.z, { n: 16, color: [0x6aff9a, 0xffffff], speed: 1.5, up: 3, life: 0.9, grav: -1 }); this.fx.ring(t.x, t.z, { r1: 1.4, color: 0x6aff9a }); this.audio.play('heal', { x: t.x, z: t.z, vol: 0.5 }); if (this.s.settings.dmgNums) this.floats.spawn(t.x, 1.8, t.z, '+' + Math.round(t.maxHp * t.D.heal), 'heal'); }
  onDetect(e) { if (e.type === 'barkhide' || e.type === 'thornfang') this.audio.play('growl', { x: e.x, z: e.z, rate: e.type === 'thornfang' ? 1.4 : 0.8 }); this.floats.spawn(e.x, e.model.userData.eyeH + 0.3 + e.y, e.z, '!', 'alert', { life: 0.6, vy: 0.6 }); }
  addShake(k) { const m = this.s.settings.shake === 'off' ? 0 : this.s.settings.shake === 'reduced' ? 0.4 : 1; this.shake = Math.min(1.2, this.shake + k * m); }
  // ---------------- skills / flask ----------------
  useSkill() {
    const H = this.hero, st = this.st; if (!H.alive) return; if (H.skillCd > 0 || H.skillT > 0) { this.audio.play('denied', { vol: 0.5 }); return; }
    const kind = WEAPONS[st.cat].skill, S = SKILLS[kind]; H.skillCd = S.cd * (1 - st.cdr); this.skillKind = kind; this.skillClock = 0; this.skillEv = []; const tgt = this.findTarget(9); const hm = this.heroModel;
    if (tgt) H.ang = Math.atan2(tgt.e.x - H.x, tgt.e.z - H.z); const fx = Math.sin(H.ang), fz = Math.cos(H.ang); const ap = { skill: true };
    const aoe = (r, mult, knock, poise, cx = null, cz = null) => { const x = cx ?? H.x, z = cz ?? H.z; for (const e of this.enemies) if (e.alive && Math.hypot(e.x - x, e.z - z) < r + e.r) { const d = Math.hypot(e.x - x, e.z - z) || 1; this.damageEnemy(e, mult, { ...ap, dir: { x: (e.x - x) / d, z: (e.z - z) / d }, knock, poise }); } };
    if (kind === 'whirl') { H.skillT = 0.7; for (const at of [0.12, 0.42]) this.skillEv.push({ at, fn: () => { aoe(S.radius, S.mult, 2.5, 22); this.fx.ring(H.x, H.z, { r1: S.radius, color: WEAPONS.sword.trail, life: 0.3, y: H.y }); this.audio.play('swing', { rate: 0.8 }); } }); hm.attack('sword', 0.7, 0, false); }
    else if (kind === 'flurry') { H.skillT = 0.6; H.iframes = 0.6; const e = tgt && tgt.e; if (e) { const bx = e.x - Math.sin(H.ang) * (e.r + 0.6), bz = e.z - Math.cos(H.ang) * (e.r + 0.6); this.fx.burst(H.x, 0.6, H.z, { n: 20, color: [0x9effc8, 0x2a2a3a], speed: 3, life: 0.4 }); this.blink = { x: bx, z: bz }; }
      for (let i = 0; i < S.hits; i++) this.skillEv.push({ at: 0.05 + i * 0.1, fn: () => { const t2 = e && e.alive ? e : this.findTarget(2.5)?.e; if (t2) { this.damageEnemy(t2, S.mult, { ...ap, dir: { x: Math.sin(H.ang), z: Math.cos(H.ang) }, knock: 0.3, poise: 6 }); } hm.attack('dagger', 0.1, i, false); this.audio.play('swish'); } }); }
    else if (kind === 'cleave') { H.skillT = 0.45; hm.attack('axe', 0.45, 0, true); this.skillEv.push({ at: 0.2, fn: () => { this.audio.play('slam', { rate: 1.3, vol: 0.8 }); this.addShake(0.3);
        for (let d = 0.8; d < S.length; d += 0.7) { const px = H.x + fx * d, pz = H.z + fz * d; this.fx.burst(px, 0.15, pz, { n: 3, color: [0xffb36b, 0xffe0a0], speed: 2, up: 4, life: 0.6 }); }
        this.fx.ring(H.x + fx * 1.5, H.z + fz * 1.5, { r1: 2, color: 0xffb36b });
        for (const e of this.enemies) { if (!e.alive) continue; const dx = e.x - H.x, dz = e.z - H.z; const al = dx * fx + dz * fz, sd = Math.abs(dx * fz - dz * fx); if (al > -0.5 && al < S.length && sd < S.width / 2 + e.r) this.damageEnemy(e, S.mult, { ...ap, dir: { x: fx, z: fz }, knock: 3, poise: 200 }); } } }); }
    else if (kind === 'lunge') { H.skillT = 0.3; this.lungeT = 0.25; this.lungeDir = { x: fx, z: fz }; this.lungeSet = new Set(); H.iframes = 0.35; hm.attack('spear', 0.3, 0, true); this.audio.play('dash'); this.audio.play('thrust', { rate: 0.8 }); }
    else if (kind === 'nova') { H.skillT = 0.4; hm.castT = 0; this.skillEv.push({ at: 0.15, fn: () => { aoe(S.radius, S.mult, 5, 30); this.fx.ring(H.x, H.z, { r1: S.radius, color: 0xb98cff, life: 0.5, y: H.y }); this.fx.ring(H.x, H.z, { r1: S.radius * 0.6, color: 0xffffff, life: 0.3, y: H.y }); this.fx.burst(H.x, 0.8, H.z, { n: 50, color: [0xb98cff, 0xffffff, 0x6a8aff], speed: 9, up: 1, life: 0.5 }); this.lights.flash(H.x, 1.5, H.z, 0xb98cff, 16, 9, 0.35); this.audio.play('hitMagic', { rate: 0.6 }); this.audio.play('cast', { rate: 0.7 }); this.addShake(0.25); } }); }
    else if (kind === 'volley') { H.skillT = 0.3; hm.attack('bow', 0.3, 0, true); this.skillEv.push({ at: 0.12, fn: () => { for (let i = 0; i < S.arrows; i++) { const a = H.ang + (i / (S.arrows - 1) - 0.5) * S.spread * Math.PI / 180; this.heroShot(a, S.mult / WEAPONS.bow.mult, { ...WEAPONS.bow.proj, color: 0xffe08a }, { skill: true, pierce: 1 }); } this.audio.play('bow', { rate: 0.8 }); this.audio.play('arrow'); } }); }
    this.emit('cd');
  }
  updateSkill(dt) { const H = this.hero; H.skillT -= dt; this.skillClock += dt; while (this.skillEv.length && this.skillEv[0].at <= this.skillClock) this.skillEv.shift().fn(); if (H.skillT <= 0) { for (const e of this.skillEv) e.fn(); this.skillEv = []; } }
  lungeHits() { const H = this.hero; for (const e of this.enemies) { if (!e.alive || this.lungeSet.has(e)) continue; if (Math.hypot(e.x - H.x, e.z - H.z) < e.r + 1.0) { this.lungeSet.add(e); this.damageEnemy(e, SKILLS.lunge.mult, { skill: true, dir: this.lungeDir, knock: 2.5, poise: 40 }); } } this.fx.puff(H.x, 0.7, H.z, 0xfff1a8, 0.35, 0.25); }
  useFlask() { const H = this.hero, s = this.s; if (!H.alive) return; if (s.flasks <= 0 || H.flaskCd > 0 || H.hp >= this.st.maxHp) { this.audio.play('denied', { vol: 0.5 }); if (s.flasks <= 0) this.toast('No flasks · refill at a shrine or the Healing Font', 'warn'); return; }
    s.flasks--; H.flaskCd = 1; const amt = Math.round(this.st.maxHp * HERO.flaskHeal); H.hp = Math.min(this.st.maxHp, H.hp + amt); this.audio.play('flask'); this.floats.spawn(H.x, 1.6 + H.y, H.z, '+' + amt, 'heal'); this.fx.burst(H.x, 0.6, H.z, { n: 24, color: [0xff5a6a, 0xffd0d0], speed: 1.5, up: 3, life: 0.8, grav: -1 }); this.emit('stats'); this.markDirty(); }
  // ---------------- camera ----------------
  updateCamera(dt) {
    const H = this.hero, c = this.cam, cam = this.camera; const portrait = cam.aspect < 0.8;
    let want = this.bossE ? 29 : (this.enemies.filter((e) => e.alive && e.aggro && e._d < 12).length >= 3 ? 23 : 20.5); if (this.region === 'citadel') want = 23; if (!portrait) want *= 0.78; c.want = want;
    c.dist = damp(c.dist, want, 1.6, dt);
    c.lx = damp(c.lx, clamp(H.vx * 0.45, -2.2, 2.2), 2.5, dt); c.lz = damp(c.lz, clamp(H.vz * 0.45, -2.2, 2.2), 2.5, dt);
    let tx = H.x + c.lx, tz = H.z + c.lz - (portrait ? 1.2 : 0.5);
    if (this.bossE && this.bossE.alive) { tx = lerp(tx, this.bossE.x, 0.3); tz = lerp(tz, this.bossE.z, 0.3); }
    c.x = damp(c.x, tx, 5, dt); c.z = damp(c.z, tz, 5, dt);
    const pitch = 56 * Math.PI / 180; const sx = this.shake * this.shake; this.shake = Math.max(0, this.shake - dt * 2.4);
    const jx = (Math.random() - 0.5) * sx * 0.8, jy = (Math.random() - 0.5) * sx * 0.5;
    cam.position.set(c.x + jx, H.y + Math.sin(pitch) * c.dist + jy, c.z + Math.cos(pitch) * c.dist); cam.lookAt(c.x + jx * 0.5, H.y + 0.5, c.z);
  }
  // ---------------- loot & resources ----------------
  dropRes(k, n, x, z, pieces = 3) { if (n <= 0) return; const m = Math.min(n, k === 'gold' ? pieces : Math.min(4, n)); let left = n; for (let i = 0; i < m; i++) { const part = i === m - 1 ? left : Math.max(1, Math.floor(n / m)); left -= part; this.spawnPickup({ kind: 'res', res: k, n: part }, x, z); } }
  dropItem(src, lvl, x, z) { const st = this.st; const r = rollRarity(this.rng, src, st.find * 0.25); const t = rollTemplate(this.rng, src, r, this.s.level); const it = makeItem(t.id, Math.max(1, lvl + (this.rng() < 0.4 ? 1 : 0)), (this.rng() * 1e9) | 0); this.spawnPickup({ kind: 'item', item: it }, x, z); this.audio.play('lootDrop', { x, z, rate: 1 + t.r * 0.06 }); }
  spawnPickup(p, x, z) {
    const g = new THREE.Group(); const a = Math.random() * TAU, sp = 1.5 + Math.random() * 2.5;
    if (p.kind === 'res') { const C = { gold: 0xffd45a, essence: 0xc58bff, crystals: 0x6fe7ff, relics: 0xff9d4a, tokens: 0xff5470 }[p.res];
      const geo = p.res === 'gold' ? new THREE.CylinderGeometry(0.12, 0.12, 0.04, 10) : p.res === 'crystals' ? new THREE.OctahedronGeometry(0.13) : p.res === 'relics' ? new THREE.TetrahedronGeometry(0.15) : p.res === 'tokens' ? new THREE.DodecahedronGeometry(0.15) : new THREE.SphereGeometry(0.1, 8, 6);
      const m = new THREE.Mesh(geo, emissive(C, p.res === 'gold' ? 1.2 : 2.4)); if (p.res === 'gold') { m.material.color.set(0xb08a2a); m.material.metalness = 0.8; m.material.roughness = 0.3; } g.add(m); const s = glowSprite(C, p.res === 'gold' ? 0.5 : 0.8, 0.6); g.add(s); g.userData.spin = m; }
    else { const R = RARITIES[ITEM_BY_ID[p.item.t].r]; const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, 3.5, 8, 1, true), new THREE.MeshBasicMaterial({ color: R.glow, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); beam.position.y = 1.7; g.add(beam);
      const bag = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), emissive(R.glow, 2.2)); bag.position.y = 0.35; g.add(bag); const s = glowSprite(R.glow, 1.6, 0.8); s.position.y = 0.35; g.add(s); g.userData.spin = bag; g.userData.beam = beam; }
    g.position.set(x, 0.5, z); this.scene.add(g);
    this.pickups.push({ ...p, mesh: g, x, z, y: 0.6, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 4 + Math.random() * 2, t: 0 });
  }
  updatePickups(dt) {
    const H = this.hero;
    for (let i = this.pickups.length - 1; i >= 0; i--) { const p = this.pickups[i]; p.t += dt;
      if (p.vy !== 0 || p.y > 0.3) { p.vy -= 16 * dt; p.y += p.vy * dt; p.x += p.vx * dt; p.z += p.vz * dt; const q = { x: p.x, z: p.z }; this.col.resolve(q, 0.15); p.x = q.x; p.z = q.z; if (p.y < 0.3) { p.y = 0.3; p.vy = Math.abs(p.vy) > 2 ? -p.vy * 0.35 : 0; p.vx *= 0.5; p.vz *= 0.5; } }
      const d = Math.hypot(H.x - p.x, H.z - p.z);
      if (H.alive && p.t > 0.5 && (p.kind === 'res' ? d < 4.5 : d < 1.6) && !(p.kind === 'item' && p.full > 0)) { const k = Math.min(1, dt * (8 + p.t * 6)); p.x += (H.x - p.x) * k; p.z += (H.z - p.z) * k; p.y += (0.8 - p.y) * k; p.vy = 0; }
      if (p.full > 0) p.full -= dt;
      p.mesh.position.set(p.x, p.y + this.world.groundY(p.x, p.z), p.z); if (p.mesh.userData.spin) p.mesh.userData.spin.rotation.y += dt * 3; if (p.mesh.userData.beam) p.mesh.userData.beam.material.opacity = 0.25 + 0.12 * Math.sin(this.t * 4);
      if (H.alive && d < 0.7 && p.t > 0.45) { if (this.collect(p)) { this.scene.remove(p.mesh); this.pickups.splice(i, 1); } }
      else if (p.t > 120 && p.kind === 'res') { this.scene.remove(p.mesh); this.pickups.splice(i, 1); } }
  }
  collect(p) {
    const s = this.s, H = this.hero;
    if (p.kind === 'res') { const mult = p.res === 'relics' || p.res === 'tokens' ? 1 : this.st.resMult; const n = Math.max(1, Math.round(p.n * mult)); s.res[p.res] += n;
      const glyph = { gold: '◉', essence: '✧', crystals: '♦', relics: '▲', tokens: '✹' }[p.res]; this.floats.spawn(H.x + (Math.random() - 0.5) * 0.6, 1.5 + H.y, H.z, '+' + fmt(n) + ' ' + glyph, 'res ' + p.res, { life: 0.9, vy: 1.2 });
      this.audio.play(p.res === 'gold' ? 'coin' : p.res === 'essence' ? 'essence' : 'crystal'); if (p.res === 'relics' || p.res === 'tokens') this.toast('+' + n + ' ' + (p.res === 'relics' ? 'Relic Fragment' : 'Boss Token') + (n > 1 ? 's' : ''), p.res); this.emit('res', p.res); this.markDirty(); return true; }
    if (s.inv.length >= INV_CAP) { if (!p.warned) { this.toast('Inventory full · salvage items to make room', 'warn'); this.audio.play('denied'); } p.warned = true; p.full = 2; return false; }
    this.addItem(p.item); return true;
  }
  addItem(it, quiet = false) {
    const s = this.s; const t = tmpl(it); const R = RARITIES[t.r]; it.seen = false; s.inv.push(it); s.stats.items++; const isNew = this.discover(t.id);
    if (!quiet) { this.audio.play(t.r >= 3 ? 'lootRare' : 'equip'); if (t.r >= 3) this.emit('reveal', { item: it, isNew }); else this.emit('loot', { item: it, isNew });
      this.fx.burst(this.hero.x, 1, this.hero.z, { n: 10 + t.r * 8, color: [R.glow, 0xffffff], speed: 2, up: 4, life: 0.8, grav: -2 }); }
    // auto-equip into an empty slot
    if (!s.equip[t.slot] && t.req <= s.level) this.equip(it, true);
    this.emit('inv'); this.markDirty(); return it;
  }
  discover(tid) { const s = this.s; if (s.index[tid]) { s.index[tid].n++; return false; } s.index[tid] = { n: 1, at: Date.now() }; const r = ITEM_BY_ID[tid].r; this.give({ gold: 8 * (r + 1) * (r + 1), essence: 3 * (r + 1) }, true); this.audio.play('discover'); this.emit('discover', tid); this.questEvent('discover'); return true; }
  give(rew, quiet = false) { for (const k in rew) this.s.res[k] = (this.s.res[k] || 0) + rew[k]; if (!quiet) this.emit('res'); this.emit('stats'); }
  canAfford(c) { for (const k in c) if (c[k] > 0 && (this.s.res[k] || 0) < c[k]) return false; return true; }
  pay(c) { if (!this.canAfford(c)) return false; for (const k in c) this.s.res[k] -= c[k]; return true; }
  equip(it, quiet = false) { const s = this.s, t = tmpl(it); if (t.req > s.level) { if (!quiet) { this.audio.play('denied'); this.toast('Requires level ' + t.req, 'warn'); } return false; } s.equip[t.slot] = it.id; it.seen = true; this.recalc(); this.refreshGear(); if (!quiet) { this.audio.play('equip', { rate: t.slot === 'weapon' ? 0.9 : 1.1 }); this.fx.burst(this.hero.x, 0.8, this.hero.z, { n: 14, color: [RARITIES[t.r].glow, 0xffffff], speed: 2, up: 3, life: 0.6 }); } this.emit('inv'); this.markDirty(); return true; }
  unequip(slot) { if (slot === 'weapon') { this.toast('You always need a weapon equipped', 'warn'); this.audio.play('denied'); return false; } this.s.equip[slot] = null; this.recalc(); this.refreshGear(); this.audio.play('equip', { rate: 0.8 }); this.emit('inv'); this.markDirty(); return true; }
  salvageValue(it) { const t = tmpl(it); return Math.round(RARITIES[t.r].salvage * (1 + it.up * 0.4) * (1 + it.l * 0.05)); }
  salvage(it) { const s = this.s; if (isEquipped(s, it) || it.lock) { this.audio.play('denied'); return 0; } const v = this.salvageValue(it); s.inv = s.inv.filter((x) => x !== it); s.res.essence += v; s.stats.salvaged++; this.audio.play('essence'); this.emit('inv'); this.emit('res'); this.markDirty(); return v; }
  salvageBulk(maxR) { const s = this.s; let tot = 0, n = 0; for (const it of s.inv.slice()) { if (isEquipped(s, it) || it.lock || tmpl(it).r > maxR) continue; tot += this.salvageValue(it); s.inv = s.inv.filter((x) => x !== it); n++; } s.res.essence += tot; s.stats.salvaged += n; if (n) this.audio.play('essence'); this.emit('inv'); this.emit('res'); this.markDirty(); return { n, tot }; }
  upgradeItem(it) { const t = tmpl(it), R = RARITIES[t.r]; if (it.up >= R.maxUp) return false; const c = upgradeCost(t.r, it.up); if (!this.pay(c)) { this.audio.play('denied'); return false; } it.up++; if (isEquipped(this.s, it)) this.recalc(); this.audio.play('upgrade'); this.emit('inv'); this.emit('res'); this.markDirty(true); return true; }
  buyUpgrade(key) { const u = UPGRADES.find((x) => x.key === key); const l = this.s.upgrades[key]; if (l >= u.max) return false; const c = upgCost(u, l); if (!this.pay(c)) { this.audio.play('denied'); return false; } this.s.upgrades[key]++; this.s.stats.upgrades++; this.recalc(); this.audio.play('upgrade'); this.questEvent('upgrades'); this.emit('res'); this.markDirty(true); return true; }
  upgradeArtifact() { const L = this.s.artifact; if (L >= ARTIFACT.max) return false; const c = ARTIFACT.cost(L); if (!this.pay(c)) { this.audio.play('denied'); return false; } this.s.artifact++; this.recalc(); this.audio.play('artifactUp'); this.audio.duck(0.35, 2.5); const f = ARTIFACT.facets.find((x) => x.at === this.s.artifact); if (f) setTimeout(() => this.emit('reveal', { title: f.name + ' unlocked', text: f.desc, glyph: '△', color: '#ffa040' }), 1600); this.questEvent('artifact'); this.emit('res'); this.markDirty(true); return true; }
  addXp(n) { const s = this.s; s.xp += n * this.st.xpMult; let up = false; while (s.level < HERO.maxLevel && s.xp >= xpNeed(s.level)) { s.xp -= xpNeed(s.level); s.level++; up = true; } if (up) { this.recalc(); this.healFull(); this.audio.play('levelUp'); this.audio.duck(0.35, 2); this.heroModel.vicT = 0; const H = this.hero; this.fx.ring(H.x, H.z, { r1: 4, color: 0xffd45a, life: 0.9 }); this.fx.burst(H.x, 0.5, H.z, { n: 60, color: [0xffd45a, 0xffffff], speed: 3, up: 7, life: 1.3, grav: 1 }); this.lights.flash(H.x, 2, H.z, 0xffd45a, 14, 8, 0.6); this.emit('levelup', s.level); this.markDirty(true); } this.emit('xp'); }
  // ---------------- quests ----------------
  activeQuests() { const s = this.s; return QUESTS.filter((q) => !(s.quests[q.id] && s.quests[q.id].claimed) && (!q.after || (s.quests[q.after] && s.quests[q.after].claimed))); }
  derived(q) { const s = this.s; if (q.goal.k === 'artifact') return s.artifact; if (q.goal.k === 'discover') return Object.keys(s.index).length; if (q.goal.k === 'upgrades') return Object.values(s.upgrades).reduce((a, b) => a + b, 0); return null; }
  questEvent(k, v) { if (!this.s) return; let ch = false; for (const q of this.activeQuests()) { if (q.goal.k !== k) continue; if (q.goal.v && q.goal.v !== v) continue; const e = this.s.quests[q.id] || (this.s.quests[q.id] = { p: 0, done: false, claimed: false }); const d = this.derived(q); e.p = d != null ? d : Math.min(q.n, e.p + 1); ch = true; if (e.p >= q.n) this.completeQuest(q); } if (ch) this.emit('quests'); }
  questTick() { for (const q of this.activeQuests()) { const d = this.derived(q); if (d != null) { const e = this.s.quests[q.id] || (this.s.quests[q.id] = { p: 0, done: false, claimed: false }); e.p = d; if (d >= q.n) this.completeQuest(q); } } this.fixTracked(); this.emit('quests'); }
  completeQuest(q) { const e = this.s.quests[q.id]; if (e.claimed) return; e.p = q.n; e.done = true; e.claimed = true; this.give(q.rew); this.audio.play('quest'); this.audio.duck(0.4, 1.5); this.emit('questDone', q); setTimeout(() => this.questTick(), 50); this.fixTracked(); this.markDirty(true); }
  fixTracked() { const act = this.activeQuests(); if (!act.find((q) => q.id === this.s.tracked)) { const m = act.find((q) => q.type === 'main') || act[0]; this.s.tracked = m ? m.id : null; } }
  claimMilestone(n) { const m = INDEX_MILESTONES.find((x) => x.n === n); const s = this.s; if (!m || s.indexMs.includes(n) || Object.keys(s.index).length < n) return false; s.indexMs.push(n); this.give(m.rew); this.audio.play('quest'); this.emit('inv'); this.markDirty(true); return true; }
  tickAnims(dt) { if (!this.anims) return; for (let i = this.anims.length - 1; i >= 0; i--) if (!this.anims[i].tick(dt)) { this.anims[i].done(); this.anims.splice(i, 1); } }
}
