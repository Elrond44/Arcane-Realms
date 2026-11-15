// Enemy entities + the state-machine AI: idle, patrol, detect, pursue, attack, reposition, retreat,
// stagger, death, reset. Behaviour differs per class (melee/fast/heavy/ranged/caster/support/elite).
import * as THREE from 'three';
import { ENEMIES, enemyScale } from './data.js?v=1';
import { buildEnemy, flashModel, hpBar, setBar } from './models.js?v=1';
import { clamp, angDiff, TAU } from './util.js?v=1';

let NEXT = 1;
export class Enemy {
  constructor(type, lvl, x, z, camp) {
    const D = this.D = ENEMIES[type]; const S = enemyScale(lvl); this.id = NEXT++; this.type = type; this.lvl = lvl; this.camp = camp;
    this.maxHp = Math.round(D.hp * S.hp); this.hp = this.maxHp; this.atk = D.atk * S.atk; this.def = D.def * S.def; this.rew = S.rew;
    this.x = x; this.z = z; this.y = 0; this.vx = 0; this.vz = 0; this.ang = Math.random() * TAU; this.home = { x, z }; this.r = D.size * 0.55;
    this.state = 'idle'; this.st = 1 + Math.random() * 2; this.cd = 0.5 + Math.random(); this.poise = D.poise; this.flash = 0; this.alive = true; this.deadT = 0; this.burn = null; this.slow = 0; this.anim = 0; this.walk = 0; this.aggro = false; this.lastHit = 0; this.seen = false;
    this.model = buildEnemy(type); this.model.position.set(x, 0, z); const s = type === 'gloomroot' ? 1 : 1; this.model.scale.setScalar(s);
    this.bar = hpBar(D.boss ? 0 : D.elite ? 1.3 : 0.8, !!D.elite); this.bar.position.y = this.model.userData.eyeH + 0.25; if (!D.boss) this.model.add(this.bar);
    if (D.elite) this.bar.visible = true;
    this.tele = null; this.patrol = null;
  }
  get dist() { return this._d; }
  face(tx, tz, dt, k = 10) { const a = Math.atan2(tx - this.x, tz - this.z); this.ang += angDiff(this.ang, a) * Math.min(1, k * dt); }
  move(G, tx, tz, spd, dt, keepFacing = false) {
    const dx = tx - this.x, dz = tz - this.z; const d = Math.hypot(dx, dz); if (d < 0.05) return 0;
    let mx = dx / d, mz = dz / d;
    // separation from other enemies
    for (const o of G.enemies) { if (o === this || !o.alive) continue; const ox = this.x - o.x, oz = this.z - o.z; const od = Math.hypot(ox, oz); const R = this.r + o.r + 0.25; if (od < R && od > 1e-3) { mx += ox / od * (R - od) * 1.5; mz += oz / od * (R - od) * 1.5; } }
    const ml = Math.hypot(mx, mz) || 1; const step = Math.min(d, spd * dt * (this.slow > 0 ? 0.55 : 1)); this.x += mx / ml * step; this.z += mz / ml * step;
    if (!keepFacing) this.face(this.x + mx, this.z + mz, dt, 8);
    this.walk = spd; return step;
  }
  set(state, t = 0) { this.state = state; this.st = t; }
  update(G, dt) {
    const D = this.D, H = G.hero; this.walk = 0; this.anim += dt;
    if (this.flash > 0) { this.flash -= dt; flashModel(this.model, Math.max(0, this.flash / 0.12) * 2.2); if (this.flash <= 0) flashModel(this.model, 0); }
    if (this.slow > 0) this.slow -= dt;
    if (!this.alive) { this.deadT += dt; this.animDeath(dt); return; }
    // knockback velocity (stable: exponential decay, then collision)
    if (Math.abs(this.vx) + Math.abs(this.vz) > 0.01) { this.x += this.vx * dt; this.z += this.vz * dt; const k = Math.exp(-8 * dt); this.vx *= k; this.vz *= k; }
    if (this.burn) { this.burn.t -= dt; this.burn.tick -= dt; if (this.burn.tick <= 0) { this.burn.tick = 0.5; G.dot(this, this.burn.dps * 0.5, 'burn'); } if (this.burn && this.burn.t <= 0) this.burn = null; if (!this.alive) return; }
    const dx = H.x - this.x, dz = H.z - this.z; const d = Math.hypot(dx, dz); this._d = d; const heroOk = H.alive && !G.safeZone;
    const homeD = Math.hypot(this.x - this.home.x, this.z - this.home.z);
    this.st -= dt; this.cd -= dt;
    switch (this.state) {
      case 'idle': if (heroOk && d < D.detect && this.sees(G)) { this.alert(G); break; } if (this.st <= 0) { const a = Math.random() * TAU, r = Math.random() * (this.camp ? this.camp.r : 3); this.patrol = { x: this.home.x + Math.cos(a) * r, z: this.home.z + Math.sin(a) * r }; this.set('patrol', 4); } break;
      case 'patrol': if (heroOk && d < D.detect && this.sees(G)) { this.alert(G); break; } if (this.move(G, this.patrol.x, this.patrol.z, D.speed * 0.4, dt) < 0.001 || this.st <= 0) this.set('idle', 1.5 + Math.random() * 3); break;
      case 'detect': this.face(H.x, H.z, dt, 12); if (this.st <= 0) this.set('pursue'); break;
      case 'pursue': {
        if (!heroOk || homeD > D.leash || (d > D.detect * 2.2 && !D.boss)) { this.set('reset'); break; }
        const ranged = D.cls === 'ranged' || D.cls === 'caster' || D.cls === 'support';
        if (ranged) { if (d < D.keep - 1 && this.cd > 0.3) { this.set('reposition', 0.7 + Math.random() * 0.6); this.strafe = Math.random() < 0.5 ? 1 : -1; break; }
          if (d <= D.range && this.cd <= 0 && G.los(this.x, this.z, H.x, H.z)) { this.beginAttack(G); break; }
          if (d > D.range * 0.85 || !G.los(this.x, this.z, H.x, H.z)) this.move(G, H.x, H.z, D.speed, dt); else { this.face(H.x, H.z, dt); this.strafeMove(G, dt, 0.5); } break; }
        if (D.cls === 'support' && this.cd <= 0) { this.beginAttack(G); break; }
        if (d <= D.range + H.r + 0.1 && this.cd <= 0) { this.beginAttack(G); break; }
        if (D.cls === 'elite' && d > 4 && d < D.charge && this.cd <= 0 && Math.random() < 0.02) { this.beginAttack(G, 'charge'); break; }
        if (d > D.range + H.r) this.move(G, H.x, H.z, D.speed, dt); else { this.face(H.x, H.z, dt); if (this.cd > 0.4) this.strafeMove(G, dt, 0.35); }
        break; }
      case 'attack': this.updateAttack(G, dt); break;
      case 'reposition': { if (!heroOk) { this.set('reset'); break; } this.face(H.x, H.z, dt); const away = d < D.keep ? -1 : 0.2; const nx = dx / (d || 1), nz = dz / (d || 1);
        const tx = this.x + (-nz * this.strafe + nx * away) * 2, tz = this.z + (nx * this.strafe + nz * away) * 2; this.move(G, tx, tz, D.speed * 0.85, dt, true); if (this.st <= 0) this.set('pursue'); break; }
      case 'retreat': { const nx = dx / (d || 1), nz = dz / (d || 1); this.move(G, this.x - nx * 2, this.z - nz * 2, D.speed * 0.9, dt); if (this.st <= 0) this.set('pursue'); break; }
      case 'stagger': if (this.st <= 0) { this.poise = D.poise; this.set('pursue'); } break;
      case 'reset': { this.aggro = false; this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25 * dt); this.move(G, this.home.x, this.home.z, D.speed * 1.2, dt); if (homeD < 0.6) { this.hp = this.maxHp; this.set('idle', 2); this.bar.visible = !!D.elite; } break; }
    }
    G.col.resolve(this, this.r * 0.9);
    this.y = G.world.groundY(this.x, this.z);
    this.animate(G, dt);
  }
  sees(G) { return G.los(this.x, this.z, G.hero.x, G.hero.z); }
  alert(G, chain = true) { if (this.state === 'detect' || this.state === 'pursue' || this.state === 'attack') return; this.aggro = true; this.set('detect', this.D.cls === 'fast' ? 0.25 : 0.45); G.onDetect(this);
    if (chain) for (const o of G.enemies) if (o !== this && o.alive && o.camp === this.camp && (o.state === 'idle' || o.state === 'patrol')) o.alert(G, false); }
  strafeMove(G, dt, k) { const H = G.hero; const dx = H.x - this.x, dz = H.z - this.z; const d = Math.hypot(dx, dz) || 1; if (!this.strafe || Math.random() < 0.005) this.strafe = Math.random() < 0.5 ? 1 : -1; this.move(G, this.x - dz / d * this.strafe, this.z + dx / d * this.strafe, this.D.speed * k, dt, true); }
  beginAttack(G, kind) {
    const D = this.D, H = G.hero; this.atkKind = kind || D.cls; this.set('attack', D.windup); this.phase = 'wind'; this.face(H.x, H.z, 1, 1);
    this.aim = { x: H.x, z: H.z }; const dirA = Math.atan2(H.x - this.x, H.z - this.z); this.ang = dirA;
    if (this.atkKind === 'heavy') { const fx = this.x + Math.sin(dirA) * 1.4, fz = this.z + Math.cos(dirA) * 1.4; this.aim = { x: fx, z: fz }; this.tele = G.fx.telegraph('circle', fx, fz, { r: D.aoe, color: 0xff4a2a }); G.audio.play('growl', { x: this.x, z: this.z }); }
    else if (this.atkKind === 'caster') { if (Math.random() < 0.45) { this.atkKind = 'eruption'; this.aim = { x: H.x + H.vx * 0.5, z: H.z + H.vz * 0.5 }; this.tele = G.fx.telegraph('circle', this.aim.x, this.aim.z, { r: 1.7, color: 0xff7a1a }); this.st = D.windup * 1.25; } G.audio.play('fireCast', { x: this.x, z: this.z, rate: 1.1 }); }
    else if (this.atkKind === 'charge') { this.tele = G.fx.telegraph('line', this.x, this.z, { length: D.charge, width: 1.4, rot: dirA, color: 0xff4a2a }); this.st = 0.75; G.audio.play('clank', { x: this.x, z: this.z, rate: 0.7 }); }
    else if (this.atkKind === 'elite') { this.tele = G.fx.telegraph('cone', this.x, this.z, { r: D.range + 0.9, angle: 110, rot: dirA, color: 0xff4a2a }); }
    else if (this.atkKind === 'support') { const tgt = this.healTarget(G); this.healT = tgt; if (!tgt) { this.atkKind = 'spore'; } else { this.tele = G.fx.telegraph('circle', tgt.x, tgt.z, { r: 1.2, color: 0x6aff9a }); } }
    else if (this.atkKind === 'fast') { G.audio.play('growl', { x: this.x, z: this.z, rate: 1.5, vol: 0.5 }); }
    this.windT = this.st; this.atkT = 0;
  }
  healTarget(G) { let best = null, bv = 0.85; for (const o of G.enemies) { if (!o.alive || o === this) continue; const d = Math.hypot(o.x - this.x, o.z - this.z); if (d > this.D.range + 2) continue; const v = o.hp / o.maxHp; if (v < bv) { bv = v; best = o; } } return best; }
  updateAttack(G, dt) {
    const D = this.D, H = G.hero; this.atkT += dt;
    if (this.tele) this.tele.prog(this.atkT / this.windT);
    if (this.phase === 'wind') {
      if (this.atkKind !== 'charge' && this.atkKind !== 'eruption' && this.atkKind !== 'heavy' && this.atkKind !== 'elite') this.face(H.x, H.z, dt, 6);
      if (this.st > 0) return;
      this.phase = 'strike'; if (this.tele) { this.tele.done(); this.tele = null; }
      const fx = Math.sin(this.ang), fz = Math.cos(this.ang);
      switch (this.atkKind) {
        case 'melee': case 'elite': { const reach = D.range + H.r + 0.35; const dx = H.x - this.x, dz = H.z - this.z; const d = Math.hypot(dx, dz); const inFront = (dx * fx + dz * fz) / (d || 1) > (this.atkKind === 'elite' ? 0.2 : 0.3);
          G.audio.play(this.atkKind === 'elite' ? 'chop' : 'swish', { x: this.x, z: this.z, rate: this.atkKind === 'elite' ? 0.8 : 0.7 });
          if (d < reach && inFront) G.hurtHero(this.atk, D.el, this, { kx: fx, kz: fz, k: this.atkKind === 'elite' ? 5 : 2 }); this.st = 0.45; break; }
        case 'fast': this.lunge = 0.25; this.lungeHit = false; this.st = 0.55; break;
        case 'heavy': { G.slam(this.aim.x, this.aim.z, D.aoe, this.atk, D.el, this, 0xb08a5a); this.st = 0.7; break; }
        case 'charge': this.lunge = 0.45; this.lungeHit = false; this.chargeD = 0; this.st = 0.9; break;
        case 'ranged': G.enemyShot(this, D.proj, this.atk); this.st = 0.35; break;
        case 'caster': G.enemyShot(this, D.proj, this.atk); this.st = 0.4; break;
        case 'eruption': G.eruption(this.aim.x, this.aim.z, 1.7, this.atk * 1.2, 'fire', this); this.st = 0.4; break;
        case 'support': { const t = this.healT; if (t && t.alive) { t.hp = Math.min(t.maxHp, t.hp + t.maxHp * D.heal); G.healFx(t); } this.st = 0.5; break; }
        case 'spore': G.enemyShot(this, { speed: 6, color: 0xff7ae0, kind: 'orb', slow: 1.5 }, this.atk * 1.4); this.st = 0.4; break;
      }
      this.cd = D.cd * (0.85 + Math.random() * 0.3);
      return;
    }
    // strike / recover phase
    if (this.lunge > 0) { const sp = this.atkKind === 'charge' ? 16 : D.lunge / 0.25; this.lunge -= dt; const fx = Math.sin(this.ang), fz = Math.cos(this.ang); this.x += fx * sp * dt; this.z += fz * sp * dt;
      if (!this.lungeHit && Math.hypot(H.x - this.x, H.z - this.z) < this.r + H.r + 0.35) { this.lungeHit = true; G.hurtHero(this.atk * (this.atkKind === 'charge' ? 1.4 : 1), D.el, this, { kx: fx, kz: fz, k: this.atkKind === 'charge' ? 7 : 2.5 }); } }
    if (this.st <= 0) { this.lunge = 0; if (D.cls === 'fast' && Math.random() < 0.7) this.set('retreat', 0.7); else if (D.cls === 'ranged' || D.cls === 'caster') { this.strafe = Math.random() < 0.5 ? 1 : -1; this.set('reposition', 0.8 + Math.random() * 0.8); } else if (D.cls === 'support' && this._d < 4) this.set('retreat', 1.4); else this.set('pursue'); }
  }
  stagger(G, t) { if (this.tele) { this.tele.done(); this.tele = null; } this.lunge = 0; this.set('stagger', t); }
  animate(G, dt) {
    const P = this.model.userData.P; const m = this.model; m.position.set(this.x, this.y, this.z); m.rotation.y = this.ang; const t = this.anim; const w = this.walk > 0 ? Math.min(1, this.walk / this.D.speed) : 0;
    const ph = t * (6 + this.D.speed * 2); const sw = Math.sin(ph) * w;
    P.body.position.y = 0; P.body.rotation.set(0, 0, 0);
    if (P.legs) { if (P.legs.length === 4) { P.legs[0].rotation.x = sw * 0.8; P.legs[3].rotation.x = sw * 0.8; P.legs[1].rotation.x = -sw * 0.8; P.legs[2].rotation.x = -sw * 0.8; } else { P.legs[0].rotation.x = sw * 0.6; P.legs[1].rotation.x = -sw * 0.6; } }
    if (P.arms) { P.arms[0].rotation.x = -sw * 0.5; P.arms[1].rotation.x = sw * 0.5; }
    if (this.type === 'mossling') P.body.position.y = Math.abs(Math.sin(ph)) * 0.08 * w + Math.sin(t * 3) * 0.01;
    if (this.type === 'wisp') { P.body.position.y = Math.sin(t * 2.5) * 0.12; P.embers.forEach((e, i) => { const a = t * 3 + i * TAU / 3; e.position.set(Math.cos(a) * 0.32, 1.1 + Math.sin(a * 2) * 0.1, Math.sin(a) * 0.32); }); P.sprite.material.opacity = 0.6 + 0.2 * Math.sin(t * 7); if (Math.random() < 0.3) G.fx.puff(this.x + (Math.random() - 0.5) * 0.2, 1.0 + P.body.position.y, this.z, 0xff7a2a, 0.22, 0.5); }
    if (this.type === 'sporemender' && Math.random() < 0.08) G.fx.puff(this.x + (Math.random() - 0.5) * 0.6, 0.7, this.z + (Math.random() - 0.5) * 0.6, 0xff9af0, 0.12, 1.2);
    if (P.tail) P.tail.rotation.y = Math.sin(t * 8) * 0.4;
    // attack poses
    if (this.state === 'attack') { const wind = this.phase === 'wind'; const u = wind ? 1 - clamp(this.st / this.windT, 0, 1) : 1;
      if (P.arms) { if (this.type === 'barkhide') { P.arms[0].rotation.x = P.arms[1].rotation.x = wind ? -2.6 * u : 0.4; } else if (this.type === 'sentinel') { P.arms[1].rotation.x = wind ? -2.2 * u : 0.6; P.arms[1].rotation.z = wind ? -0.5 : 0.3; } else if (this.type === 'briar') { P.arms[0].rotation.x = -1.5; P.arms[1].rotation.x = -1.5 + (wind ? -0.3 * u : 0); } else { P.arms[0].rotation.x = P.arms[1].rotation.x = wind ? -1.8 * u : 0.5; } }
      if (this.type === 'thornfang') { P.body.rotation.x = wind ? 0.25 * u : -0.2; if (P.head) P.head.rotation.x = wind ? 0.3 : -0.3; }
      if (this.type === 'wisp') { P.core.scale.setScalar(1 + (wind ? 0.4 * u : 0)); }
      if (this.type === 'sporemender' && P.head) { P.head.scale.setScalar(1 + (wind ? 0.15 * u : 0)); }
      if (this.type === 'mossling') P.body.rotation.x = wind ? -0.3 * u : 0.4;
    } else if (P.head && this.type === 'sporemender') P.head.scale.setScalar(1);
    if (this.state === 'stagger') { P.body.rotation.x = -0.25 + Math.sin(t * 30) * 0.05; P.body.rotation.z = Math.sin(t * 9) * 0.12; }
    if (this.state === 'detect') { P.body.position.y += Math.max(0, Math.sin((0.45 - this.st) * 14)) * 0.12; }
    if (this.type === 'sentinel' && P.shield) P.arms[0].rotation.x = this.state === 'attack' ? P.arms[0].rotation.x : -0.6;
    // hp bar
    if (this.bar.parent) { this.bar.quaternion.copy(G.camera.quaternion); this.bar.quaternion.premultiply(m.quaternion.clone().invert()); setBar(this.bar, this.hp / this.maxHp, dt); }
  }
  animDeath(dt) { const P = this.model.userData.P; const u = clamp(this.deadT / 0.5, 0, 1); P.body.rotation.x = -u * 1.3; P.body.position.y = 0; const s = this.deadT > 0.6 ? Math.max(0.001, 1 - (this.deadT - 0.6) / 0.5) : 1; this.model.scale.setScalar(s); this.model.position.y = this.y - (this.deadT > 0.6 ? (this.deadT - 0.6) * 0.6 : 0); this.bar.visible = false; }
}
