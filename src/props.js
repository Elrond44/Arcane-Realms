// Procedural prop geometry: trees, rocks, mushrooms, crystals, ruins, statues, chests, nodes.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/addons/utils/BufferGeometryUtils.js';
import { M, emissive, glowSprite } from './kit.js?v=1';
import { mulberry32, TAU } from './util.js?v=1';

function colorize(geo, fn) { geo = geo.index ? geo.toNonIndexed() : geo; const p = geo.attributes.position; const n = p.count; const c = new Float32Array(n * 3); const v = new THREE.Vector3(); const col = new THREE.Color();
  for (let i = 0; i < n; i++) { v.fromBufferAttribute(p, i); fn(v, col, i); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; } geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.deleteAttribute('uv'); geo.computeVertexNormals(); return geo; }
function jitter(geo, amt, seed) { const r = mulberry32(seed); const p = geo.attributes.position; const map = new Map(); const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = v.x.toFixed(3) + ',' + v.y.toFixed(3) + ',' + v.z.toFixed(3); let o = map.get(k); if (!o) map.set(k, (o = [(r() - 0.5) * amt, (r() - 0.5) * amt, (r() - 0.5) * amt])); p.setXYZ(i, v.x + o[0], v.y + o[1], v.z + o[2]); } return geo; }
// canopy variants (unit tree ~ 7 tall); returns {trunk, crown}
export function treeGeos(kind, seed) {
  const r = mulberry32(seed); const parts = [];
  if (kind === 'pine') {
    const trunk = new THREE.CylinderGeometry(0.16, 0.42, 2.4, 6); trunk.translate(0, 1.2, 0);
    for (let i = 0; i < 4; i++) { const h = 2.6 - i * 0.35, rad = 2.1 - i * 0.45; const c = new THREE.ConeGeometry(rad, h, 7, 1); c.translate(0, 2.0 + i * 1.25 + h / 2, 0); jitter(c, 0.25, seed + i); parts.push(c.toNonIndexed()); }
    const crown = colorize(mergeGeometries(parts), (v, col) => { const t = THREE.MathUtils.clamp(v.y / 7, 0, 1); col.setRGB(0.32 + t * 0.35, 0.55 + t * 0.4, 0.5 + t * 0.35); });
    return { trunk, crown };
  }
  if (kind === 'dead') {
    const tp = []; const t0 = new THREE.CylinderGeometry(0.18, 0.5, 4.5, 6); t0.translate(0, 2.25, 0); tp.push(t0.toNonIndexed());
    for (let i = 0; i < 4; i++) { const b = new THREE.CylinderGeometry(0.05, 0.14, 2.0, 5); b.translate(0, 1, 0); b.rotateZ(0.6 + r() * 0.5); b.rotateY(i / 4 * TAU + r()); b.translate(0, 2.4 + r() * 1.6, 0); tp.push(b.toNonIndexed()); }
    const trunk = mergeGeometries(tp.map((g) => { g.deleteAttribute('uv'); return g; }));
    const crown = colorize(jitter(new THREE.IcosahedronGeometry(0.01, 0), 0, 1), (v, col) => col.setRGB(1, 1, 1));
    return { trunk, crown };
  }
  // broad, layered canopy (default)
  const trunk = new THREE.CylinderGeometry(0.22, 0.55, 3.6, 7); trunk.translate(0, 1.8, 0); jitter(trunk, 0.12, seed);
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) { const rad = 1.3 + r() * 1.0; const b = new THREE.IcosahedronGeometry(rad, 1); jitter(b, 0.35, seed * 7 + i); b.scale(1, 0.72, 1); const a = r() * TAU, d = i === 0 ? 0 : 0.8 + r() * 1.0; b.translate(Math.cos(a) * d, 3.8 + r() * 1.6 + (i === 0 ? 0.8 : 0), Math.sin(a) * d); parts.push(b.toNonIndexed()); }
  const crown = colorize(mergeGeometries(parts.map((g) => { g.deleteAttribute('uv'); return g; })), (v, col) => { const t = THREE.MathUtils.clamp((v.y - 2.6) / 3.6, 0, 1); col.setRGB(0.3 + t * 0.4, 0.5 + t * 0.45, 0.45 + t * 0.3); });
  return { trunk, crown };
}
export function rockGeo(seed, moss = 0.6) {
  const g = new THREE.IcosahedronGeometry(1, 1); jitter(g, 0.45, seed); g.scale(1, 0.7, 1);
  return colorize(g, (v, col) => { const up = v.y > 0.25 ? Math.min(1, (v.y - 0.25) * 2.5) * moss : 0; col.setRGB(0.42 - up * 0.2, 0.42 + up * 0.08, 0.4 - up * 0.18); });
}
// one InstancedMesh from a list of transforms
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
export function instanced(geo, mat, list, { cast = false, receive = false } = {}) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)); im.count = list.length;
  list.forEach((o, i) => { _e.set(o.rx || 0, o.ry || 0, o.rz || 0); _q.setFromEuler(_e); _p.set(o.x, o.y || 0, o.z); _s.set((o.sx ?? 1) * (o.s ?? 1), (o.sy ?? 1) * (o.s ?? 1), (o.sz ?? 1) * (o.s ?? 1)); _m.compose(_p, _q, _s); im.setMatrixAt(i, _m); if (o.color !== undefined) im.setColorAt(i, _c.set(o.color)); });
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.castShadow = cast; im.receiveShadow = receive; im.computeBoundingSphere(); return im;
}
// glowing mushroom (stem + cap) geos
export function mushroomGeos() { const stem = new THREE.CylinderGeometry(0.05, 0.08, 0.4, 6); stem.translate(0, 0.2, 0); const cap = new THREE.SphereGeometry(0.22, 10, 6, 0, TAU, 0, Math.PI / 2); cap.scale(1, 0.7, 1); cap.translate(0, 0.38, 0); return { stem, cap }; }
export function crystalGeo(seed) { const r = mulberry32(seed); const parts = [];
  for (let i = 0; i < 5; i++) { const h = 0.8 + r() * 1.6; const c = new THREE.CylinderGeometry(0.0, 0.18 + r() * 0.12, h * 0.35, 6); c.translate(0, h * 0.5 + h * 0.175, 0); const b = new THREE.CylinderGeometry(0.18 + r() * 0.12, 0.2 + r() * 0.12, h, 6); b.translate(0, h / 2, 0);
    const g = mergeGeometries([b.toNonIndexed(), c.toNonIndexed()].map((x) => { x.deleteAttribute('uv'); return x; })); g.rotateZ((r() - 0.5) * 0.9); g.rotateX((r() - 0.5) * 0.9); g.translate((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5); parts.push(g); }
  return mergeGeometries(parts); }
// ruins
export function column(h = 3.2, broken = false, mat = M.stone) {
  const g = new THREE.Group(); const base = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.3, 0.95), mat); base.position.y = 0.15; g.add(base);
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, h, 10), mat); sh.position.y = 0.3 + h / 2; g.add(sh);
  if (!broken) { const cap = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.28, 0.95), mat); cap.position.y = 0.3 + h + 0.14; g.add(cap); }
  else { sh.scale.y = 0.55 + Math.random() * 0.3; sh.position.y = 0.3 + h * sh.scale.y / 2; const top = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.36, 0.3, 7), mat); top.position.y = 0.3 + h * sh.scale.y + 0.1; top.rotation.z = 0.3; g.add(top); }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g;
}
export function wall(w, h, d = 0.8, mat = M.stone, ruined = true, seed = 1) {
  const g = new THREE.Group(); const r = mulberry32(seed);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.y = h / 2; m.castShadow = m.receiveShadow = true; g.add(m);
  if (ruined) { const n = Math.floor(w / 1.2); for (let i = 0; i < n; i++) { const bh = 0.3 + r() * 0.9; const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, bh, d * 1.02), mat); b.position.set(-w / 2 + 0.6 + i * 1.2, h + bh / 2 - 0.05, 0); if (r() < 0.35) continue; b.castShadow = true; g.add(b); }
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.5 + r() * 0.5, 0.35, 0.5), mat); b.position.set((r() - 0.5) * w, 0.17, d * (r() < 0.5 ? 1 : -1)); b.rotation.y = r() * 3; g.add(b); } }
  return g;
}
export function arch(w = 3.2, h = 3.6, mat = M.stone) {
  const g = new THREE.Group(); for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, h, 0.9), mat); p.position.set(s * w / 2, h / 2, 0); p.castShadow = true; g.add(p); }
  const top = new THREE.Mesh(new THREE.TorusGeometry(w / 2, 0.4, 6, 12, Math.PI), mat); top.position.y = h; top.castShadow = true; g.add(top);
  const key = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 1.0), mat); key.position.y = h + w / 2; g.add(key); return g;
}
export function statue(mat = M.stone, glow = null) { // hooded warden leaning on a greatsword
  const g = new THREE.Group(); const ped = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 1.5), M.stoneDark); ped.position.y = 0.35; g.add(ped);
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.75, 2.4, 8), mat); robe.position.y = 1.9; g.add(robe);
  const sh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), mat); sh.scale.set(1.2, 0.6, 0.9); sh.position.y = 3.05; g.add(sh);
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.95, 8), mat); hood.position.y = 3.55; g.add(hood);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 })); face.position.set(0, 3.4, 0.22); g.add(face);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.4, 0.06), mat); blade.position.set(0, 1.7, 0.75); g.add(blade);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.14), mat); guard.position.set(0, 2.95, 0.75); g.add(guard);
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), mat); hilt.position.set(0, 3.25, 0.75); g.add(hilt);
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.0, 6), mat); arm.position.set(s * 0.32, 2.75, 0.45); arm.rotation.x = 0.9; arm.rotation.z = -s * 0.3; g.add(arm); }
  if (glow) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), emissive(glow, 4)); e.position.set(-0.08, 3.42, 0.38); g.add(e); const e2 = e.clone(); e2.position.x = 0.08; g.add(e2); }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g;
}
export function chestMesh(kind = 'wood') {
  const g = new THREE.Group(); const wood = kind === 'hidden' ? new THREE.MeshStandardMaterial({ color: 0x2a2440, roughness: 0.6, metalness: 0.2 }) : M.wood; const trim = kind === 'wood' ? M.metal : M.gold;
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.65), wood); base.position.y = 0.25; g.add(base);
  const lidG = new THREE.Group(); lidG.position.set(0, 0.5, -0.32); g.add(lidG);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 1.0, 10, 1, false, 0, Math.PI), wood); lid.rotation.z = Math.PI / 2; lid.rotation.y = 0; lid.position.set(0, 0, 0.32); lid.rotation.x = 0; lidG.add(lid);
  for (const x of [-0.42, 0, 0.42]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 0.68), trim); b.position.set(x, 0.25, 0); g.add(b); const lb = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.035, 4, 10, Math.PI), trim); lb.rotation.y = Math.PI / 2; lb.position.set(x, 0, 0.32); lidG.add(lb); }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.06), trim); lock.position.set(0, 0.42, 0.34); g.add(lock);
  const inner = glowSprite(kind === 'hidden' ? 0xff5070 : kind === 'ornate' ? 0xffc45a : 0xffe0a0, 1.6, 0); inner.position.y = 0.6; g.add(inner);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); g.userData = { lid: lidG, inner }; return g;
}
export function lantern(color = 0xffb35a) { const g = new THREE.Group(); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.6, 6), M.wood); post.position.y = 0.8; g.add(post);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), M.wood); arm.position.set(0.22, 1.55, 0); g.add(arm);
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.3, 6, 1, true), M.metal); cage.position.set(0.42, 1.35, 0); g.add(cage);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), emissive(color, 5)); core.position.copy(cage.position); g.add(core); const s = glowSprite(color, 1.6, 0.6); s.position.copy(cage.position); g.add(s); return g; }
