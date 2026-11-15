// The miniature hero: modular primitive-built model whose helm/armor/gloves/boots/weapon/amulet/artifact
// change with equipment, animated procedurally (locomotion blend, weapon-specific attacks, cast, dash,
// hurt, death, victory, interact).
import * as THREE from 'three';
import { emissive, glowSprite } from './kit.js?v=1';
import { clamp, lerp, TAU } from './util.js?v=1';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o });
function cap(r, len, mat) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 8), mat); m.castShadow = true; return m; }
// weapon geometry by category; returns group with userData.base/tip markers (for trails) and glow material
export function buildWeapon(cat, look = {}) {
  const g = new THREE.Group(); const metal = std(look.metal ?? 0x9a9a9a, { metalness: 0.75, roughness: 0.35 }); const acc = std(look.accent ?? 0x6b4a2e, { roughness: 0.6 });
  const glowC = look.glow; const gm = glowC ? emissive(glowC, 2.4) : null; const base = new THREE.Object3D(), tip = new THREE.Object3D(); g.add(base, tip);
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m); return m; };
  if (cat === 'sword' || cat === 'dagger') {
    const L = cat === 'sword' ? 0.62 : 0.32, W = cat === 'sword' ? 0.075 : 0.06;
    add(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 6), acc, 0, 0.0, 0); add(new THREE.BoxGeometry(cat === 'sword' ? 0.22 : 0.13, 0.035, 0.05), acc, 0, 0.09, 0);
    const bl = new THREE.Shape(); bl.moveTo(-W / 2, 0); bl.lineTo(-W / 2, L * 0.82); bl.lineTo(0, L); bl.lineTo(W / 2, L * 0.82); bl.lineTo(W / 2, 0); bl.closePath();
    const bg = new THREE.ExtrudeGeometry(bl, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1 }); bg.translate(0, 0, -0.007); add(bg, metal, 0, 0.1, 0);
    if (gm) add(new THREE.BoxGeometry(0.014, L * 0.7, 0.03), gm, 0, 0.1 + L * 0.4, 0);
    add(new THREE.SphereGeometry(0.03, 6, 4), metal, 0, -0.09, 0); base.position.set(0, 0.15, 0); tip.position.set(0, 0.1 + L, 0);
  } else if (cat === 'axe') {
    add(new THREE.CylinderGeometry(0.025, 0.03, 0.8, 6), acc, 0, 0.25, 0);
    const hd = new THREE.Shape(); hd.moveTo(0, -0.08); hd.quadraticCurveTo(0.22, -0.16, 0.25, 0.02); hd.quadraticCurveTo(0.22, 0.18, 0, 0.1); hd.closePath();
    const hg = new THREE.ExtrudeGeometry(hd, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 }); hg.translate(0.02, 0, -0.015); add(hg, metal, 0, 0.55, 0);
    if (gm) add(new THREE.BoxGeometry(0.02, 0.26, 0.04), gm, 0.25, 0.57, 0); base.position.set(0, 0.45, 0); tip.position.set(0.25, 0.6, 0);
  } else if (cat === 'spear') {
    add(new THREE.CylinderGeometry(0.02, 0.022, 1.45, 6), acc, 0, 0.35, 0); add(new THREE.ConeGeometry(0.05, 0.22, 4), gm || metal, 0, 1.17, 0); add(new THREE.BoxGeometry(0.1, 0.03, 0.03), metal, 0, 1.06, 0);
    base.position.set(0, 0.7, 0); tip.position.set(0, 1.28, 0);
  } else if (cat === 'staff') {
    add(new THREE.CylinderGeometry(0.022, 0.03, 1.3, 6), std(look.metal ?? 0x6d5a3a), 0, 0.35, 0);
    for (const s of [-1, 1]) add(new THREE.TorusGeometry(0.07, 0.014, 4, 8, Math.PI), std(look.metal ?? 0x6d5a3a), s * 0.0, 1.03, 0, 0, s > 0 ? 0 : Math.PI / 2, 0);
    const orb = add(new THREE.SphereGeometry(0.065, 10, 8), emissive(look.glow ?? look.accent ?? 0xa98bff, 3.2), 0, 1.06, 0); const sp = glowSprite(look.glow ?? 0xa98bff, 0.6, 0.7); sp.position.copy(orb.position); g.add(sp);
    base.position.set(0, 0.9, 0); tip.position.set(0, 1.08, 0); g.userData.orb = orb;
  } else if (cat === 'bow') {
    const arc = add(new THREE.TorusGeometry(0.36, 0.018, 4, 16, Math.PI * 0.9), std(look.metal ?? 0x7a5a36), 0, 0, 0, 0, 0, Math.PI / 2 + Math.PI * 0.05); arc.position.x = -0.12;
    const str = add(new THREE.CylinderGeometry(0.004, 0.004, 0.7, 3), std(0xeeeeee, { emissive: glowC ?? 0x000000, emissiveIntensity: 1 }), 0.11, 0, 0); g.userData.string = str;
    if (gm) add(new THREE.SphereGeometry(0.03, 6, 4), gm, -0.48, 0, 0);
    base.position.set(0, 0, 0); tip.position.set(0, 0.35, 0);
  }
  g.userData.base = base; g.userData.tip = tip; return g;
}
export class HeroModel {
  constructor() {
    const g = this.group = new THREE.Group(); const body = this.body = new THREE.Group(); g.add(body);
    this.skin = std(0xe8b896); this.cloth = std(0x5a4632); this.armor = std(0x6a5238); this.trimM = std(0xc9b37a, { metalness: 0.6, roughness: 0.4 }); this.glove = std(0x7a6a52); this.boot = std(0x4a3a2a); this.capeM = std(0x7a2a2a, { side: THREE.DoubleSide });
    this.hips = new THREE.Group(); this.hips.position.y = 0.46; body.add(this.hips);
    // legs
    this.legs = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.085, 0, 0); this.hips.add(p); const l = cap(0.062, 0.24, this.cloth); l.position.y = -0.17; p.add(l); const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.18), this.boot); b.position.set(0, -0.38, 0.03); b.castShadow = true; p.add(b); return p; });
    // torso
    this.torso = new THREE.Group(); this.hips.add(this.torso);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.36, 8), this.armor); t.position.y = 0.18; t.castShadow = true; this.torso.add(t); this.torsoMesh = t;
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.05, 8), std(0x3a2414)); belt.position.y = 0.03; this.torso.add(belt);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.02), this.trimM); buckle.position.set(0, 0.03, 0.135); this.torso.add(buckle);
    this.skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.16, 8, 1, true), this.armor); this.skirt.position.y = -0.06; this.torso.add(this.skirt);
    this.pauld = [-1, 1].map((s) => { const p = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6, 0, TAU, 0, Math.PI / 2), this.trimM); p.position.set(s * 0.18, 0.34, 0); p.rotation.z = -s * 0.5; p.castShadow = true; this.torso.add(p); return p; });
    // amulet gem
    this.gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.03), emissive(0xffffff, 2)); this.gem.position.set(0, 0.27, 0.15); this.torso.add(this.gem);
    // cape
    const cg = new THREE.PlaneGeometry(0.34, 0.5, 2, 4); cg.translate(0, -0.25, 0); this.cape = new THREE.Mesh(cg, this.capeM); this.cape.position.set(0, 0.36, -0.13); this.cape.castShadow = true; this.torso.add(this.cape); this.capeBase = cg.attributes.position.array.slice();
    // head + helm slots
    this.neck = new THREE.Group(); this.neck.position.y = 0.4; this.torso.add(this.neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), this.skin); head.position.y = 0.13; head.castShadow = true; this.neck.add(head); this.head = head;
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), std(0x1a1210)); e.position.set(s * 0.06, 0.14, 0.15); this.neck.add(e); }
    this.hair = new THREE.Mesh(new THREE.SphereGeometry(0.175, 10, 8, 0, TAU, 0, Math.PI * 0.55), std(0x5a3a22)); this.hair.position.y = 0.15; this.hair.rotation.x = -0.25; this.neck.add(this.hair);
    this.helm = new THREE.Group(); this.neck.add(this.helm);
    // arms
    this.arms = [-1, 1].map((s) => { const sh = new THREE.Group(); sh.position.set(s * 0.2, 0.32, 0); this.torso.add(sh); const up = cap(0.048, 0.16, this.cloth); up.position.y = -0.1; sh.add(up);
      const el = new THREE.Group(); el.position.y = -0.2; sh.add(el); const fo = cap(0.045, 0.13, this.armor); fo.position.y = -0.08; el.add(fo); const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), this.glove); hand.position.y = -0.18; hand.castShadow = true; el.add(hand);
      const grip = new THREE.Group(); grip.position.y = -0.18; el.add(grip); return { sh, el, grip, hand, fo }; });
    // artifact familiar: tiny glowing triangle orbiting the shoulder
    this.fam = new THREE.Group(); const tri = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.02, 3), emissive(0xffa040, 3)); tri.rotation.x = Math.PI / 2; this.fam.add(tri); const fs = glowSprite(0xffa040, 0.35, 0.8); this.fam.add(fs); this.famMat = tri.material; this.famSprite = fs; this.fam.visible = false; g.add(this.fam);
    // soft hero light disc so the hero always reads against dark ground
    this.weapon = null; this.cat = 'sword'; this.phase = 0; this.t = 0; this.speedK = 0; this.lean = 0; this.hurtT = 0; this.deadT = -1; this.vicT = -1; this.useT = -1; this.castT = -1;
    this.atk = null; // {cat, t, dur, combo, heavy}
    this.spin = 0; this.dash = 0;
  }
  setGear(gear) { // gear: {weapon:{cat,look}, helm:look, chest:look, gloves:look, boots:look, amulet:look, artifact:look, ring}
    const w = gear.weapon || { cat: 'sword', look: {} }; this.cat = w.cat;
    if (this.weapon) this.weapon.parent.remove(this.weapon);
    this.weapon = buildWeapon(w.cat, w.look); const hand = w.cat === 'bow' ? this.arms[0].grip : this.arms[1].grip; hand.add(this.weapon);
    if (w.cat === 'bow') { this.weapon.rotation.set(Math.PI / 2, 0, 0); this.weapon.position.set(0, -0.02, 0.03); } else if (w.cat === 'spear' || w.cat === 'staff') { this.weapon.rotation.set(Math.PI / 2, 0, 0); this.weapon.position.set(0, 0, -0.35); } else { this.weapon.rotation.set(Math.PI / 2, 0, 0); this.weapon.position.set(0, 0, 0); }
    const ch = gear.chest || { style: 'tunic', color: 0x6a5238 }; this.armor.color.set(ch.color); this.trimM.color.set(ch.trim ?? 0xa08050); this.capeM.color.set(ch.trim ? new THREE.Color(ch.color).multiplyScalar(0.8) : 0x6a2424);
    this.armor.emissive = new THREE.Color(ch.glow ? ch.glow : 0x000000); this.armor.emissiveIntensity = ch.glow ? 0.15 : 0;
    const heavy = ch.style === 'plate' || ch.style === 'mail'; this.pauld.forEach((p) => { p.visible = heavy; p.scale.setScalar(ch.style === 'plate' ? 1.25 : 0.95); });
    this.skirt.scale.set(1, ch.style === 'robe' ? 2.6 : 1, 1); this.skirt.position.y = ch.style === 'robe' ? -0.16 : -0.06; this.cape.visible = ch.style !== 'tunic' || true;
    this.glove.color.set((gear.gloves && gear.gloves.color) ?? 0xe0b090); this.glove.emissive = new THREE.Color((gear.gloves && gear.gloves.glow) || 0); this.glove.emissiveIntensity = gear.gloves && gear.gloves.glow ? 0.8 : 0;
    this.boot.color.set((gear.boots && gear.boots.color) ?? 0x3a2a1a); this.boot.emissive = new THREE.Color((gear.boots && gear.boots.glow) || 0); this.boot.emissiveIntensity = gear.boots && gear.boots.glow ? 0.6 : 0;
    this.gem.visible = !!gear.amulet; if (gear.amulet) this.gem.material.emissive.set(gear.amulet.glow ?? gear.amulet.color);
    this.fam.visible = !!gear.artifact; if (gear.artifact) { this.famMat.emissive.set(gear.artifact.glow ?? gear.artifact.color); this.famSprite.material.color.set(gear.artifact.glow ?? gear.artifact.color); }
    // helm
    this.helm.clear(); const h = gear.helm; this.hair.visible = true;
    if (h) { const hm = std(h.color, { metalness: h.style === 'helm' ? 0.7 : 0.1, roughness: h.style === 'helm' ? 0.35 : 0.85 }); const tm = std(h.trim ?? 0xc9b37a, { metalness: 0.7, roughness: 0.4 });
      if (h.style === 'hood') { const hd = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, TAU, 0, Math.PI * 0.62), hm); hd.position.y = 0.13; hd.rotation.x = -0.35; this.helm.add(hd); const tipc = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 8), hm); tipc.position.set(0, 0.25, -0.12); tipc.rotation.x = -1.1; this.helm.add(tipc); if (h.trim) { const tr = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.015, 4, 16, Math.PI), tm); tr.position.set(0, 0.13, 0.05); tr.rotation.x = 0.4; this.helm.add(tr); } this.hair.visible = false; }
      else if (h.style === 'helm') { const hd = new THREE.Mesh(new THREE.SphereGeometry(0.195, 12, 8, 0, TAU, 0, Math.PI * 0.7), hm); hd.position.y = 0.12; this.helm.add(hd); const vis = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.035, 0.05), std(0x111111)); vis.position.set(0, 0.13, 0.17); this.helm.add(vis); const crest = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.3), tm); crest.position.set(0, 0.32, -0.01); this.helm.add(crest); this.hair.visible = false; }
      else if (h.style === 'crown') { for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.022, 0.32, 5), hm); a.position.set(s * 0.12, 0.38, -0.02); a.rotation.z = -s * 0.5; this.helm.add(a); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.14, 5), hm); b.position.set(s * 0.2, 0.43, 0); b.rotation.z = -s * 1.2; this.helm.add(b); } const band = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 4, 16), tm); band.rotation.x = Math.PI / 2; band.position.y = 0.24; this.helm.add(band); if (h.glow) { const gg = new THREE.Mesh(new THREE.OctahedronGeometry(0.03), emissive(h.glow, 3)); gg.position.set(0, 0.25, 0.16); this.helm.add(gg); } }
      else { const hd = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, TAU, 0, Math.PI * 0.75), hm); hd.position.y = 0.11; this.helm.add(hd); for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), emissive(h.glow ?? 0xff3a3a, 4)); e.position.set(s * 0.06, 0.14, 0.18); this.helm.add(e); const horn = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.2, 5), tm); horn.position.set(s * 0.16, 0.3, 0); horn.rotation.z = -s * 0.6; this.helm.add(horn); } this.hair.visible = false; }
      this.helm.traverse((o) => { if (o.isMesh) o.castShadow = true; }); }
  }
  attack(cat, dur, combo, heavy) { this.atk = { cat, t: 0, dur, combo, heavy }; }
  update(dt, st) { // st: {speed (0..1+), moving, dead, dashing, spinning}
    this.t += dt; const A = this.arms, Lg = this.legs; const sp = clamp(st.speed, 0, 1.3); this.speedK = lerp(this.speedK, sp, 1 - Math.exp(-12 * dt));
    this.phase += dt * (4 + 7 * this.speedK) * (this.speedK > 0.05 ? 1 : 0);
    const k = this.speedK; const sw = Math.sin(this.phase), cw = Math.cos(this.phase);
    // locomotion base pose
    const legAmp = 0.75 * k; Lg[0].rotation.x = sw * legAmp; Lg[1].rotation.x = -sw * legAmp;
    this.hips.position.y = 0.46 + Math.abs(cw) * 0.045 * k + Math.sin(this.t * 2) * 0.006 * (1 - k);
    this.torso.rotation.x = 0.12 * k + this.lean; this.torso.rotation.y = sw * 0.12 * k; this.torso.position.y = Math.sin(this.t * 2.2) * 0.008 * (1 - k);
    let la = { x: -sw * 0.7 * k + 0.05, z: 0.12, ex: -0.3 - 0.4 * k }, ra = { x: sw * 0.7 * k + 0.05, z: -0.12, ex: -0.3 - 0.4 * k };
    if (this.cat === 'bow') la = { x: -0.4 - sw * 0.3 * k, z: 0.15, ex: -0.4 };
    if (this.cat === 'spear' || this.cat === 'staff') ra = { x: -0.3 + sw * 0.25 * k, z: -0.1, ex: -0.9 };
    this.neck.rotation.x = -0.05 - 0.08 * k; this.neck.rotation.y = 0;
    // attack overlay
    let bodyTwist = 0;
    if (this.atk) { const a = this.atk; a.t += dt; const u = clamp(a.t / a.dur, 0, 1); const wind = 0.28, hit = 0.5;
      const e = u < wind ? u / wind : u < hit ? 1 + (u - wind) / (hit - wind) : 2 + (u - hit) / (1 - hit); // 0..1 windup, 1..2 strike, 2..3 recover
      const sgn = a.combo % 2 ? -1 : 1;
      const W = (x0, x1, x2, x3) => (e < 1 ? lerp(x0, x1, e) : e < 2 ? lerp(x1, x2, 1 - Math.pow(1 - (e - 1), 3)) : lerp(x2, x3, e - 2));
      if (a.cat === 'sword' || a.cat === 'axe' || a.cat === 'dagger') {
        if (a.heavy) { ra = { x: W(0, -2.9, 0.5, 0), z: -0.1, ex: W(-0.3, -0.6, 0, -0.4) }; this.torso.rotation.x += W(0, -0.25, 0.35, 0); }
        else { ra = { x: W(0, -1.4, -1.2, 0), z: W(-0.1, -1.3 * sgn, 0.9 * sgn, -0.1), ex: W(-0.3, -1.2, -0.2, -0.4) }; bodyTwist = W(0, 0.6 * sgn, -0.7 * sgn, 0) * (a.cat === 'axe' ? 1.2 : 0.8); }
      } else if (a.cat === 'spear') { ra = { x: W(-0.3, -0.9, -1.55, -0.4), z: -0.1, ex: W(-0.9, -1.4, 0, -0.9) }; la = { x: W(0, -0.7, -1.3, 0), z: 0.3, ex: -0.6 }; bodyTwist = W(0, -0.4, 0.2, 0); this.torso.rotation.x += W(0, -0.1, 0.25, 0); }
      else if (a.cat === 'staff') { ra = { x: W(-0.3, -2.2, -1.5, -0.3), z: -0.1, ex: W(-0.9, -0.5, -0.2, -0.9) }; la = { x: W(0, -1.0, -1.5, 0), z: 0.4, ex: -0.3 }; }
      else if (a.cat === 'bow') { la = { x: -1.55, z: 0.05, ex: 0 }; ra = { x: W(-1.2, -1.5, -1.5, -0.4), z: W(0.1, 0.2, 0.2, -0.1), ex: W(-1.5, -2.4, -0.6, -0.4) }; bodyTwist = -0.35; if (this.weapon && this.weapon.userData.string) this.weapon.userData.string.position.x = 0.11 - W(0, 0.12, 0, 0); }
      if (u >= 1) this.atk = null; }
    if (this.castT >= 0) { this.castT += dt; const u = this.castT / 0.5; la = { x: -2.4 + u, z: 0.5, ex: -0.2 }; ra = { x: -2.4 + u, z: -0.5, ex: -0.2 }; if (u >= 1) this.castT = -1; }
    if (this.useT >= 0) { this.useT += dt; const u = this.useT / 0.6; const r = Math.sin(clamp(u, 0, 1) * Math.PI); ra = { x: -1.3 * r, z: -0.1, ex: -0.3 }; la = { x: -1.1 * r, z: 0.1, ex: -0.3 }; this.torso.rotation.x += 0.5 * r; Lg[0].rotation.x = -0.6 * r; Lg[1].rotation.x = 0.3 * r; this.hips.position.y -= 0.08 * r; if (u >= 1) this.useT = -1; }
    A[0].sh.rotation.x = la.x; A[0].sh.rotation.z = la.z; A[0].el.rotation.x = la.ex; A[1].sh.rotation.x = ra.x; A[1].sh.rotation.z = ra.z; A[1].el.rotation.x = ra.ex;
    this.torso.rotation.y += bodyTwist;
    // hurt flinch (additive), dash lean, spin
    if (this.hurtT > 0) { this.hurtT -= dt; const h = Math.sin(clamp(this.hurtT / 0.25, 0, 1) * Math.PI); this.torso.rotation.x -= 0.4 * h; this.neck.rotation.x -= 0.3 * h; }
    if (st.dashing) { this.torso.rotation.x += 0.6; Lg[0].rotation.x = -0.9; Lg[1].rotation.x = 0.6; A[0].sh.rotation.x = 0.9; A[1].sh.rotation.x = 0.9; }
    this.body.rotation.y = st.spin || 0;
    // victory
    if (this.vicT >= 0) { this.vicT += dt; const u = clamp(this.vicT / 1.4, 0, 1); const r = Math.sin(u * Math.PI); A[1].sh.rotation.x = -2.9 * r; A[1].sh.rotation.z = -0.2; A[0].sh.rotation.z = 0.6 * r; this.body.position.y = Math.abs(Math.sin(u * Math.PI * 2)) * 0.25 * r; if (u >= 1) { this.vicT = -1; this.body.position.y = 0; } }
    // death
    if (st.dead) { this.deadT = Math.min(1, (this.deadT < 0 ? 0 : this.deadT) + dt / 0.7); const u = this.deadT; this.body.rotation.x = -Math.PI / 2 * (1 - Math.pow(1 - u, 3)); this.body.position.y = 0.08 * u; A[0].sh.rotation.z = 1.2 * u; A[1].sh.rotation.z = -1.2 * u; }
    else if (this.deadT >= 0) { this.deadT = -1; this.body.rotation.x = 0; this.body.position.y = 0; }
    // cape sway (vertex wave)
    const cp = this.cape.geometry.attributes.position; const b = this.capeBase; for (let i = 0; i < cp.count; i++) { const y = b[i * 3 + 1]; const d = -y / 0.5; cp.setZ(i, b[i * 3 + 2] - d * d * (0.12 + 0.35 * k) + Math.sin(this.t * 6 + y * 8) * 0.02 * d); } cp.needsUpdate = true;
    // artifact familiar orbit
    if (this.fam.visible) { const a = this.t * 1.6; this.fam.position.set(Math.cos(a) * 0.38, 1.05 + Math.sin(this.t * 2.3) * 0.08, Math.sin(a) * 0.38); this.fam.rotation.y = this.t * 3; }
  }
  // world positions of the weapon base and tip (for trails)
  bladePoints(b, t) { if (!this.weapon) return false; this.weapon.userData.base.getWorldPosition(b); this.weapon.userData.tip.getWorldPosition(t); return true; }
}
