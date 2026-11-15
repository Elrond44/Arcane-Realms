// Enemy and boss models (primitive-built, each with its own materials so hit-flashes are per-enemy)
import * as THREE from 'three';
import { glowSprite, tex } from './kit.js?v=1';
import { TAU, mulberry32 } from './util.js?v=1';

function kit() { const mats = []; const std = (color, o = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: true, ...o }); m.userData.e0 = m.emissive.clone(); m.userData.k0 = m.emissiveIntensity; mats.push(m); return m; };
  const glow = (color, k = 3) => { const m = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: k }); m.userData.e0 = m.emissive.clone(); m.userData.k0 = k; mats.push(m); return m; };
  const mesh = (geo, mat, x = 0, y = 0, z = 0, p) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; if (p) p.add(m); return m; }; return { mats, std, glow, mesh }; }
const pivot = (p, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };
export function buildEnemy(type) {
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body); const { mats, std, glow, mesh } = kit(); const P = { body }; let eyeH = 1;
  if (type === 'mossling') {
    const moss = std(0x4f8a3a); const blob = mesh(new THREE.IcosahedronGeometry(0.32, 1), moss, 0, 0.32, 0, body); blob.scale.set(1, 0.85, 1);
    const belly = mesh(new THREE.SphereGeometry(0.2, 8, 6), std(0x8a7a52), 0, 0.26, 0.15, body); belly.scale.set(1, 0.8, 0.5);
    for (const s of [-1, 1]) { mesh(new THREE.SphereGeometry(0.055, 6, 4), glow(0xd8ff5a, 4), s * 0.11, 0.42, 0.26, body); }
    const leaf = mesh(new THREE.ConeGeometry(0.08, 0.3, 4), std(0x7ad04a), 0.05, 0.72, 0, body); leaf.rotation.z = -0.4;
    P.legs = [-1, 1].map((s) => { const l = pivot(body, s * 0.14, 0.14, 0); mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.15, 5), std(0x3a5a2a), 0, -0.07, 0, l); return l; });
    P.arms = [-1, 1].map((s) => { const a = pivot(body, s * 0.3, 0.34, 0.05); mesh(new THREE.CapsuleGeometry(0.045, 0.14, 2, 5), moss, 0, -0.1, 0, a); return a; }); eyeH = 0.8;
  } else if (type === 'thornfang') {
    const fur = std(0x4a4a58), dark = std(0x26262e); const torso = mesh(new THREE.CapsuleGeometry(0.17, 0.5, 3, 8), fur, 0, 0.42, 0, body); torso.rotation.x = Math.PI / 2;
    P.head = pivot(body, 0, 0.52, 0.38); mesh(new THREE.BoxGeometry(0.22, 0.2, 0.24), fur, 0, 0, 0, P.head); mesh(new THREE.BoxGeometry(0.12, 0.1, 0.2), dark, 0, -0.04, 0.18, P.head);
    for (const s of [-1, 1]) { mesh(new THREE.ConeGeometry(0.05, 0.14, 4), dark, s * 0.07, 0.14, -0.04, P.head); mesh(new THREE.SphereGeometry(0.025, 5, 4), glow(0xff3a2a, 5), s * 0.06, 0.04, 0.12, P.head); }
    for (let i = 0; i < 5; i++) { const sp = mesh(new THREE.ConeGeometry(0.035, 0.18, 4), std(0x6a8a3a), 0, 0.62, 0.22 - i * 0.12, body); sp.rotation.x = -0.4; }
    P.legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([s, f]) => { const l = pivot(body, s * 0.11, 0.32, f * 0.22); mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.32, 5), fur, 0, -0.16, 0, l); return l; });
    P.tail = pivot(body, 0, 0.48, -0.36); const tl = mesh(new THREE.ConeGeometry(0.06, 0.32, 5), fur, 0, 0, -0.14, P.tail); tl.rotation.x = -Math.PI / 2 - 0.4; eyeH = 0.9;
  } else if (type === 'barkhide') {
    const bark = std(0x6a4a32, { map: tex('bark') }), moss = std(0x3a6a34), rock = std(0x5a5a58);
    const torso = mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.9, 7), bark, 0, 0.95, 0, body); torso.scale.set(1.1, 1, 0.8);
    mesh(new THREE.IcosahedronGeometry(0.34, 0), moss, -0.28, 1.4, 0, body); mesh(new THREE.IcosahedronGeometry(0.3, 0), moss, 0.3, 1.42, -0.05, body);
    P.head = pivot(body, 0, 1.48, 0.1); mesh(new THREE.BoxGeometry(0.34, 0.28, 0.3), bark, 0, 0.08, 0, P.head); for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.04, 5, 4), glow(0xffb02a, 5), s * 0.08, 0.1, 0.16, P.head);
    for (let i = 0; i < 4; i++) { const br = mesh(new THREE.CylinderGeometry(0.015, 0.04, 0.4, 4), bark, (i - 1.5) * 0.12, 0.42, -0.05, P.head); br.rotation.z = (i - 1.5) * 0.4; }
    P.arms = [-1, 1].map((s) => { const a = pivot(body, s * 0.52, 1.28, 0); mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.7, 6), bark, 0, -0.35, 0, a); mesh(new THREE.DodecahedronGeometry(0.24, 0), rock, 0, -0.78, 0.04, a); return a; });
    P.legs = [-1, 1].map((s) => { const l = pivot(body, s * 0.2, 0.5, 0); mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.5, 6), bark, 0, -0.25, 0, l); return l; }); eyeH = 1.9;
  } else if (type === 'briar') {
    const cloak = std(0x5a2a4a), skin = std(0x6a8a4a), wood = std(0x5a3a22);
    const robe = mesh(new THREE.ConeGeometry(0.25, 0.6, 7), cloak, 0, 0.38, 0, body);
    P.head = pivot(body, 0, 0.72, 0); mesh(new THREE.SphereGeometry(0.15, 8, 6), skin, 0, 0, 0, P.head); const hood = mesh(new THREE.ConeGeometry(0.19, 0.34, 7), cloak, 0, 0.1, -0.03, P.head); hood.rotation.x = -0.3;
    for (const s of [-1, 1]) { mesh(new THREE.SphereGeometry(0.025, 5, 4), glow(0xffe05a, 5), s * 0.05, 0.0, 0.13, P.head); const ear = mesh(new THREE.ConeGeometry(0.03, 0.16, 4), skin, s * 0.16, 0.02, 0, P.head); ear.rotation.z = -s * 1.3; }
    P.arms = [-1, 1].map((s) => { const a = pivot(body, s * 0.17, 0.58, 0); mesh(new THREE.CapsuleGeometry(0.035, 0.18, 2, 5), cloak, 0, -0.12, 0, a); return a; });
    const bow = mesh(new THREE.TorusGeometry(0.22, 0.015, 4, 12, Math.PI), wood, 0, -0.26, 0.05, P.arms[0]); bow.rotation.y = Math.PI / 2; bow.rotation.z = Math.PI / 2; eyeH = 1.0;
  } else if (type === 'wisp') {
    const core = mesh(new THREE.IcosahedronGeometry(0.2, 1), glow(0xff8a2a, 3.5), 0, 1.1, 0, body); const inner = mesh(new THREE.SphereGeometry(0.11, 8, 6), glow(0xfff0a0, 5), 0, 1.1, 0.08, body);
    const sp = glowSprite(0xff7a2a, 1.6, 0.75); sp.position.y = 1.1; body.add(sp); P.sprite = sp; P.core = core;
    P.embers = []; for (let i = 0; i < 3; i++) { const e = mesh(new THREE.TetrahedronGeometry(0.06), glow(0xffc04a, 4), 0, 1.1, 0, body); P.embers.push(e); }
    for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.03, 5, 4), glow(0x2a0a00, 0.1), s * 0.07, 1.14, 0.17, body); eyeH = 1.5;
  } else if (type === 'sporemender') {
    const stalk = std(0xd8c8b0), capm = std(0xa04a98), spot = glow(0xff9af0, 2.6);
    mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.55, 8), stalk, 0, 0.3, 0, body);
    P.head = pivot(body, 0, 0.6, 0); const c = mesh(new THREE.SphereGeometry(0.38, 12, 8, 0, TAU, 0, Math.PI / 2), capm, 0, 0, 0, P.head); c.scale.set(1, 0.6, 1);
    const r = mulberry32(5); for (let i = 0; i < 7; i++) { const a = r() * TAU, d = 0.1 + r() * 0.22; mesh(new THREE.SphereGeometry(0.04 + r() * 0.03, 5, 4), spot, Math.cos(a) * d, 0.18 - d * 0.35, Math.sin(a) * d, P.head); }
    for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.03, 5, 4), glow(0x3affb0, 4), s * 0.06, -0.12, 0.15, P.head);
    P.arms = [-1, 1].map((s) => { const a = pivot(body, s * 0.17, 0.42, 0); mesh(new THREE.CapsuleGeometry(0.03, 0.14, 2, 5), stalk, 0, -0.1, 0, a); return a; });
    const sg = glowSprite(0xff7ae0, 1.2, 0.3); sg.position.y = 0.7; body.add(sg); eyeH = 1.0;
  } else if (type === 'sentinel') {
    const st = std(0x8a8678), dk = std(0x4a4842), mossM = std(0x3a6a34);
    const torso = mesh(new THREE.BoxGeometry(0.62, 0.62, 0.42), st, 0, 1.05, 0, body);
    mesh(new THREE.BoxGeometry(0.5, 0.3, 0.38), dk, 0, 0.66, 0, body); mesh(new THREE.IcosahedronGeometry(0.16, 0), mossM, 0.25, 1.38, -0.1, body);
    P.head = pivot(body, 0, 1.45, 0.02); mesh(new THREE.BoxGeometry(0.32, 0.34, 0.32), st, 0, 0.14, 0, P.head); mesh(new THREE.BoxGeometry(0.24, 0.04, 0.02), glow(0x6dffd8, 5), 0, 0.15, 0.17, P.head); mesh(new THREE.BoxGeometry(0.04, 0.16, 0.36), dk, 0, 0.36, 0, P.head);
    for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.28, 0.16, 0.36), dk, s * 0.42, 1.34, 0, body);
    P.arms = [-1, 1].map((s) => { const a = pivot(body, s * 0.42, 1.25, 0); mesh(new THREE.BoxGeometry(0.17, 0.55, 0.17), st, 0, -0.28, 0, a); return a; });
    const shield = mesh(new THREE.BoxGeometry(0.08, 0.75, 0.55), dk, -0.05, -0.45, 0.18, P.arms[0]); mesh(new THREE.OctahedronGeometry(0.08), glow(0x6dffd8, 3), -0.1, -0.45, 0.2, P.arms[0]); P.shield = shield;
    const sw = mesh(new THREE.BoxGeometry(0.07, 1.0, 0.03), std(0xb0b0b8, { metalness: 0.7, roughness: 0.3 }), 0, -0.9, 0.12, P.arms[1]); sw.rotation.x = 0.3;
    P.legs = [-1, 1].map((s) => { const l = pivot(body, s * 0.16, 0.55, 0); mesh(new THREE.BoxGeometry(0.2, 0.55, 0.22), st, 0, -0.28, 0, l); return l; }); eyeH = 2.1;
  } else if (type === 'gloomroot') {
    const bark = std(0x3a2a24, { map: tex('bark') }), dark = std(0x1e1614), moss = std(0x2a4a30), heartM = glow(0xff3a5a, 3);
    const trunk = mesh(new THREE.CylinderGeometry(0.75, 1.05, 2.3, 8), bark, 0, 2.0, 0, body); trunk.scale.set(1, 1, 0.8);
    const chest = mesh(new THREE.CylinderGeometry(1.05, 0.8, 0.9, 8), bark, 0, 3.4, 0, body); chest.scale.set(1.1, 1, 0.8);
    const cav = mesh(new THREE.SphereGeometry(0.42, 10, 8), dark, 0, 2.95, 0.45, body); cav.scale.set(1, 1.2, 0.5);
    P.heart = mesh(new THREE.IcosahedronGeometry(0.26, 1), heartM, 0, 2.95, 0.55, body); P.heartMat = heartM; const hs = glowSprite(0xff3a5a, 3, 0.7); hs.position.set(0, 2.95, 0.7); body.add(hs); P.heartSprite = hs;
    for (const [x, y, z, s] of [[-0.8, 3.7, 0, 0.55], [0.85, 3.75, -0.1, 0.5], [0, 3.95, -0.4, 0.6], [-0.4, 1.4, 0.6, 0.35]]) { const m = mesh(new THREE.IcosahedronGeometry(s, 0), moss, x, y, z, body); m.scale.y = 0.7; }
    P.head = pivot(body, 0, 4.0, 0.25); mesh(new THREE.BoxGeometry(0.8, 0.7, 0.7), bark, 0, 0.2, 0, P.head); for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.09, 6, 4), glow(0xff5a3a, 6), s * 0.2, 0.25, 0.36, P.head);
    const r = mulberry32(9); for (let i = 0; i < 9; i++) { const br = mesh(new THREE.CylinderGeometry(0.03, 0.12, 1.6 + r() * 1.2, 5), bark, (r() - 0.5) * 1.4, 1.2, (r() - 0.5) * 0.6, P.head); br.rotation.z = (r() - 0.5) * 1.6; br.rotation.x = (r() - 0.5) * 0.8; }
    P.arms = [-1, 1].map((s) => { const a = pivot(body, s * 1.1, 3.55, 0); const u = mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.5, 6), bark, 0, -0.7, 0, a); const el = pivot(a, 0, -1.45, 0); mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.3, 6), bark, 0, -0.6, 0.0, el);
      for (let k = 0; k < 4; k++) { const c = mesh(new THREE.ConeGeometry(0.07, 0.6, 4), dark, (k - 1.5) * 0.12, -1.35, 0.1, el); c.rotation.x = Math.PI; } return { a, el }; });
    P.legs = [-1, 1].map((s) => { const l = pivot(body, s * 0.6, 1.0, 0); mesh(new THREE.CylinderGeometry(0.3, 0.45, 1.0, 6), bark, 0, -0.5, 0, l); for (let k = 0; k < 3; k++) { const rt = mesh(new THREE.CylinderGeometry(0.06, 0.16, 0.9, 5), bark, 0, -0.9, 0, l); rt.rotation.z = (k - 1) * 0.9; rt.rotation.x = 0.3; } return l; });
    eyeH = 5.6;
  }
  g.userData = { P, mats, eyeH };
  g.traverse((o) => { if (o.isMesh) o.receiveShadow = false; });
  return g;
}
export function flashModel(g, k, color = 0xffffff) { for (const m of g.userData.mats) { if (k > 0) { m.emissive.set(color); m.emissiveIntensity = Math.max(m.userData.k0, k * 1.2); } else { m.emissive.copy(m.userData.e0); m.emissiveIntensity = m.userData.k0; } } }
// world-space health bar (billboard)
export function hpBar(w = 0.9, elite = false) {
  const g = new THREE.Group(); const bg = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.06, 0.13), new THREE.MeshBasicMaterial({ color: 0x0a0604, transparent: true, opacity: 0.8, depthTest: false }));
  const ghost = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.08), new THREE.MeshBasicMaterial({ color: 0xffe0a0, depthTest: false })); const fill = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.08), new THREE.MeshBasicMaterial({ color: elite ? 0xffb02a : 0xe8384a, depthTest: false }));
  for (const [m, i] of [[bg, 0], [ghost, 1], [fill, 2]]) { m.renderOrder = 30 + i; g.add(m); } ghost.position.z = 0.001; fill.position.z = 0.002;
  g.userData = { fill, ghost, w, gv: 1 }; g.visible = false; return g;
}
export function setBar(b, v, dt) { const u = b.userData; v = Math.max(0, Math.min(1, v)); u.fill.scale.x = Math.max(0.0001, v); u.fill.position.x = -u.w * (1 - v) / 2; u.gv = Math.max(v, u.gv - dt * 0.6); u.ghost.scale.x = Math.max(0.0001, u.gv); u.ghost.position.x = -u.w * (1 - u.gv) / 2; }
