// Gloomroot, the Hollow Elder: two-phase miniboss with telegraphed attacks.
// P1: Root Slam (circle at you), Thorn Sweep (frontal cone), Root Spikes (line toward you).
// P2 (<50%): roars and knocks you back, then adds the Gloom Ring (huge donut: hug the boss to dodge),
// triple spike fans, summoned Mosslings and faster cadence.
import { Enemy } from './enemies.js?v=1';
import { clamp, angDiff, TAU } from './util.js?v=1';

export class Boss extends Enemy {
  constructor(lvl, x, z, arena) { super('gloomroot', lvl, x, z, null); this.boss = true; this.phase2 = false; this.arena = arena; this.cd = 2.2; this.ringCd = 6; this.summonCd = 9; this.r = 1.3; this.pattern = 0; this.tels = []; this.state = 'intro'; this.st = 2.4; this.lastAtk = ''; }
  update(G, dt) {
    const H = G.hero; this.walk = 0; this.anim += dt;
    if (this.flash > 0) { this.flash -= dt; if (this.flash <= 0) this.unflash(); }
    if (this.burn) { this.burn.t -= dt; this.burn.tick -= dt; if (this.burn.tick <= 0) { this.burn.tick = 0.5; G.dot(this, this.burn.dps * 0.5, 'burn'); } if (this.burn && this.burn.t <= 0) this.burn = null; }
    if (!this.alive) { this.deadT += dt; this.animDeathBoss(G, dt); return; }
    const dx = H.x - this.x, dz = H.z - this.z; const d = Math.hypot(dx, dz); this._d = d; this.st -= dt; this.cd -= dt; this.ringCd -= dt; this.summonCd -= dt;
    if (this.state === 'intro') { this.face(H.x, H.z, dt, 3); if (this.st <= 0) { this.state = 'fight'; } }
    else if (this.state === 'transition') { if (this.st <= 0) { this.state = 'fight'; this.cd = 0.8; } }
    else if (this.state === 'attack') this.updateBossAttack(G, dt);
    else if (this.state === 'fight') {
      if (!this.phase2 && this.hp / this.maxHp <= 0.5) { this.phase2 = true; this.state = 'transition'; this.st = 2.2; this.clearTels(); G.bossPhase(this); return; }
      if (d > 3.2) this.move(G, H.x, H.z, this.D.speed * (this.phase2 ? 1.3 : 1), dt); else this.face(H.x, H.z, dt, 3);
      if (this.cd <= 0 && H.alive) this.chooseAttack(G, d);
    }
    // stay inside the arena
    const A = this.arena; const ad = Math.hypot(this.x - A.x, this.z - A.z); if (ad > A.r - 2) { this.x = A.x + (this.x - A.x) / ad * (A.r - 2); this.z = A.z + (this.z - A.z) / ad * (A.r - 2); }
    this.y = G.world.groundY(this.x, this.z); this.animateBoss(G, dt);
  }
  unflash() { for (const m of this.model.userData.mats) { m.emissive.copy(m.userData.e0); m.emissiveIntensity = m.userData.k0; } }
  clearTels() { for (const t of this.tels) t.h.done(); this.tels = []; }
  chooseAttack(G, d) {
    const H = G.hero; const p2 = this.phase2; const opts = [];
    if (p2 && this.ringCd <= 0) opts.push('ring');
    else if (p2 && this.summonCd <= 0 && G.enemies.filter((e) => e.alive && e.summoned).length < 3) opts.push('summon');
    else if (d < 5.5) opts.push('sweep', 'slam', d < 4 ? 'sweep' : 'spikes');
    else opts.push('spikes', 'slam', 'spikes');
    let k = opts[Math.floor(Math.random() * opts.length)]; if (k === this.lastAtk && opts.length > 1) k = opts.find((o) => o !== k);
    this.lastAtk = k; this.beginBoss(G, k);
  }
  addTel(G, shape, x, z, o, fire) { const h = G.fx.telegraph(shape, x, z, o); this.tels.push({ h, fire, shape, x, z, o, done: false }); return h; }
  beginBoss(G, k) {
    const H = G.hero; const sp = this.phase2 ? 0.8 : 1; const ang = Math.atan2(H.x - this.x, H.z - this.z); this.ang = ang; this.ak = k; this.state = 'attack'; this.atkT = 0; this.tels = [];
    const dmg = this.atkPow();
    if (k === 'slam') { this.wind = 1.15 * sp; const tx = H.x + H.vx * 0.3, tz = H.z + H.vz * 0.3; this.addTel(G, 'circle', tx, tz, { r: 3.0, color: 0xff3a2a }, () => G.slam(tx, tz, 3.0, dmg * 1.25, 'phys', this, 0x9a6a4a, 6));
      if (this.phase2) { const t2x = H.x + (Math.random() - 0.5) * 6, t2z = H.z + (Math.random() - 0.5) * 6; this.addTel(G, 'circle', t2x, t2z, { r: 2.4, color: 0xff3a2a }, () => G.slam(t2x, t2z, 2.4, dmg, 'phys', this, 0x9a6a4a, 4)); } G.audio.play('telegraph', { x: this.x, z: this.z, rate: 0.7 }); }
    else if (k === 'sweep') { this.wind = 0.95 * sp; this.addTel(G, 'cone', this.x, this.z, { r: 5.8, angle: 130, rot: ang, color: 0xff3a2a }, () => G.cone(this.x, this.z, ang, 5.8, 130, dmg * 1.1, 'phys', this, 6)); G.audio.play('growl', { x: this.x, z: this.z, rate: 0.6 }); }
    else if (k === 'spikes') { this.wind = 1.05 * sp; const fan = this.phase2 ? [-0.38, 0, 0.38] : [0]; for (const f of fan) { const a = ang + f; this.addTel(G, 'line', this.x, this.z, { length: 15, width: 1.8, rot: a, color: 0xff3a2a }, () => G.spikes(this.x, this.z, a, 15, 1.8, dmg, this)); } G.audio.play('telegraph', { x: this.x, z: this.z }); }
    else if (k === 'ring') { this.wind = 1.6; this.ringCd = 11 + Math.random() * 3; this.addTel(G, 'donut', this.x, this.z, { r: 12.5, r0: 3.2, color: 0xb03aff }, () => G.gloomRing(this.x, this.z, 3.2, 12.5, dmg * 1.4, this)); G.audio.play('bossRoar', { x: this.x, z: this.z, rate: 1.25, vol: 0.6 }); G.toast('Get close to Gloomroot!', 'warn'); }
    else if (k === 'summon') { this.wind = 1.0; this.summonCd = 15 + Math.random() * 4; G.audio.play('roots', { x: this.x, z: this.z }); }
    this.windT = this.wind;
  }
  atkPow() { return this.atk; }
  updateBossAttack(G, dt) {
    this.atkT += dt; const u = this.atkT / this.wind; for (const t of this.tels) if (!t.done) t.h.prog(u);
    if (this.atkT >= this.wind && !this.fired) { this.fired = true; for (const t of this.tels) { t.done = true; t.h.done(); t.fire(); } this.tels = [];
      if (this.ak === 'summon') G.summonAdds(this, this.phase2 ? 3 : 2); this.recover = this.phase2 ? 0.55 : 0.8; }
    if (this.fired) { this.recover -= dt; if (this.recover <= 0) { this.fired = false; this.state = 'fight'; this.cd = (this.phase2 ? 1.1 : 1.7) + Math.random() * 0.6; } }
  }
  animateBoss(G, dt) {
    const P = this.model.userData.P; const m = this.model; m.position.set(this.x, this.y, this.z); m.rotation.y = this.ang; const t = this.anim; const w = this.walk ? 1 : 0; const sw = Math.sin(t * 3.2) * w;
    P.legs[0].rotation.x = sw * 0.35; P.legs[1].rotation.x = -sw * 0.35; P.body.rotation.set(0, 0, Math.sin(t * 1.6) * 0.03); P.body.position.y = Math.abs(Math.sin(t * 3.2)) * 0.08 * w;
    let aL = -sw * 0.3, aR = sw * 0.3, eL = -0.3, eR = -0.3;
    if (this.state === 'attack') { const u = clamp(this.atkT / this.wind, 0, 1); const hit = this.fired;
      if (this.ak === 'slam') { aL = aR = hit ? 0.4 : -2.6 * u; eL = eR = hit ? 0 : -0.6 * u; P.body.rotation.x = hit ? 0.25 : -0.15 * u; }
      else if (this.ak === 'sweep') { aR = hit ? -1.2 : -1.0 * u; P.arms[1].a.rotation.z = hit ? 1.4 : -1.2 * u; P.body.rotation.y = hit ? 0.5 : -0.5 * u; }
      else if (this.ak === 'spikes') { aL = aR = -0.5; P.body.rotation.x = hit ? 0.35 : -0.2 * u; }
      else if (this.ak === 'ring' || this.ak === 'summon') { aL = aR = -2.0 * u; P.arms[0].a.rotation.z = -0.8 * u; P.arms[1].a.rotation.z = 0.8 * u; P.head.rotation.x = -0.4 * u; }
    } else { P.arms[0].a.rotation.z = 0.15; P.arms[1].a.rotation.z = -0.15; P.head.rotation.x = 0; }
    if (this.state === 'transition' || this.state === 'intro') { const r = Math.sin(t * 20) * 0.03; P.head.rotation.x = -0.5; aL = aR = -2.4; P.body.rotation.z = r; }
    P.arms[0].a.rotation.x = aL; P.arms[1].a.rotation.x = aR; P.arms[0].el.rotation.x = eL; P.arms[1].el.rotation.x = eR;
    const hk = this.phase2 ? 5 + 2 * Math.sin(t * 8) : 2.5 + Math.sin(t * 3); P.heartMat.emissiveIntensity = this.flash > 0 ? 8 : hk; P.heartSprite.material.opacity = this.phase2 ? 0.9 : 0.6; P.heartSprite.scale.setScalar(this.phase2 ? 4 + Math.sin(t * 8) : 3);
    if (this.phase2 && Math.random() < 0.4) G.fx.puff(this.x + (Math.random() - 0.5) * 2, 2 + Math.random() * 3, this.z + (Math.random() - 0.5) * 2, 0xb03aff, 0.35, 1.0);
  }
  animDeathBoss(G, dt) { const P = this.model.userData.P; const u = clamp(this.deadT / 2.4, 0, 1); P.body.rotation.x = -u * 0.6; P.body.rotation.z = Math.sin(this.deadT * 25) * 0.04 * (1 - u); this.model.position.y = this.y - u * u * 2.5; P.heartMat.emissiveIntensity = 10 * (1 - u); if (Math.random() < 0.6 * (1 - u)) G.fx.burst(this.x + (Math.random() - 0.5) * 3, 1 + Math.random() * 4, this.z + (Math.random() - 0.5) * 3, { n: 6, color: [0xff3a5a, 0xb03aff, 0x6a4a3a], speed: 4, life: 0.8 }); if (u >= 1) this.model.visible = false; }
}
