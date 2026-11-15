// The Enchanted Woodland: a dark forest region with tree-lined paths, clearings, ruins, a crystal grove,
// a hidden hollow and the Grove Heart arena. Everything is procedural; layout is data below.
import * as THREE from 'three';
import { Colliders, Region } from './collide.js?v=1';
import { M, tex, glowDecal, glowSprite, emissive, platform, portalMesh, mistPlane, motes, flame } from './kit.js?v=1';
import { treeGeos, rockGeo, instanced, mushroomGeos, crystalGeo, column, wall, arch, statue, lantern } from './props.js?v=1';
import { mulberry32, fbm, TAU } from './util.js?v=1';

export const WOOD = {
  spawn: { x: 0, z: 57 }, portal: { x: 0, z: 64 },
  paths: [
    [[[0, 64], [0, 40], [0, 8]], 3.0], [[[3, 30], [22, 24], [34, 17]], 2.7], [[[-4, 8], [-20, 7], [-32, 4]], 2.7],
    [[[-36, -6], [-41, -16], [-46, -28], [-44, -40]], 1.25], // the hidden way
    [[[0, -6], [9, -20], [19, -31]], 2.8], [[[-3, -6], [-14, -26]], 2.8], [[[36, 14], [35, -4], [24, -26]], 2.5],
    [[[18, -40], [6, -54]], 2.8], [[[-16, -38], [-6, -54]], 2.8], [[[0, -52], [0, -62]], 3.6], [[[-34, 2], [-36, -8]], 3.2],
  ],
  clearings: [[0, 63, 6.5, 'arrival'], [0, 36, 8.5, 'glade'], [0, 0, 9, 'moonwell'], [36, 16, 8.5, 'den'], [-34, 3, 9.5, 'ruins'], [-37, -10, 6.5, 'ruins2'],
    [21, -34, 9.5, 'crystal'], [-16, -32, 8.5, 'brutes'], [-42, -46, 6.5, 'hollow'], [0, -74, 13.5, 'arena']],
  camps: [
    { id: 'glade', x: 0, z: 34, r: 5, lvl: 1, list: [['mossling', 4]] },
    { id: 'glade2', x: 2, z: 20, r: 3, lvl: 1, list: [['mossling', 2], ['thornfang', 1]] },
    { id: 'den', x: 37, z: 15, r: 5, lvl: 2, list: [['thornfang', 4]] },
    { id: 'denpath', x: 20, z: 24, r: 3, lvl: 2, list: [['mossling', 2], ['briar', 1]] },
    { id: 'ruins', x: -33, z: 4, r: 6, lvl: 3, list: [['briar', 3], ['mossling', 2]] },
    { id: 'ruins2', x: -37, z: -10, r: 3, lvl: 4, list: [['sentinel', 1]] },
    { id: 'brutes', x: -16, z: -32, r: 5, lvl: 4, list: [['barkhide', 2], ['sporemender', 1], ['mossling', 2]] },
    { id: 'crystal', x: 21, z: -34, r: 6, lvl: 4, list: [['wisp', 3], ['sporemender', 1], ['thornfang', 2]] },
    { id: 'eastloop', x: 33, z: -6, r: 3, lvl: 3, list: [['briar', 2], ['thornfang', 1]] },
    { id: 'approach', x: 0, z: -56, r: 3, lvl: 5, list: [['barkhide', 1], ['wisp', 2], ['briar', 1]] },
    { id: 'hollow', x: -42, z: -44, r: 3, lvl: 6, list: [['sentinel', 1], ['wisp', 1]] },
  ],
  // interactables: kind, id, x, z, extra
  objects: [
    ['portal', 'toCitadel', 0, 66.5, { to: 'citadel' }],
    ['shrine', 'moonwell', 0, 0, { bless: { hpPct: 0.05, dmgPct: 0.05 }, label: 'Moonwell' }],
    ['altar', 'fury', -29, -1.5, { buff: 'fury' }], ['altar', 'fortune', 39, 10.5, { buff: 'fortune' }],
    ['chest', 'w_glade', 6.5, 39, { kind: 'wood' }], ['chest', 'w_den', 41, 20, { kind: 'wood' }], ['chest', 'w_ruins', -39.5, 8, { kind: 'ornate' }],
    ['chest', 'w_ruins2', -40.5, -12.5, { kind: 'ornate' }], ['chest', 'w_crystal', 27, -37, { kind: 'wood' }], ['chest', 'w_brutes', -21.5, -35, { kind: 'ornate' }],
    ['chest', 'w_hidden', -42, -49.5, { kind: 'hidden' }], ['chest', 'w_east', 37.5, -3, { kind: 'wood' }],
    ['crystalNode', 'cn1', 16, -30], ['crystalNode', 'cn2', 25, -30.5], ['crystalNode', 'cn3', 24.5, -40], ['crystalNode', 'cn4', 15.5, -38], ['crystalNode', 'cn5', -45.5, -44], ['crystalNode', 'cn6', -38.5, -47], ['crystalNode', 'cn7', -40, 6],
    ['glowcap', 'gc1', -5, 41], ['glowcap', 'gc2', 31, 21], ['glowcap', 'gc3', -14, -27.5], ['glowcap', 'gc4', 6, -13], ['glowcap', 'gc5', 4, -58],
    ['bossAltar', 'heart', 0, -65.5, {}],
  ],
  areas: [['hollow', -42, -46, 6], ['arena', 0, -74, 13], ['moonwell', 0, 0, 8]],
  zoneNames: [['arrival', 'Wayfarer\'s Clearing'], ['glade', 'Mossling Glade'], ['moonwell', 'The Moonwell'], ['den', 'Thornfang Den'], ['ruins', 'Warden Ruins'], ['ruins2', 'Warden Ruins'], ['crystal', 'Crystal Grove'], ['brutes', 'Barkhide Thicket'], ['hollow', 'Hidden Hollow'], ['arena', 'The Grove Heart']],
  boss: { x: 0, z: -77, arena: { x: 0, z: -74, r: 13 } },
};

export function buildWoodland(quality) {
  const Q = quality; const root = new THREE.Group(); const rnd = mulberry32(1337);
  const region = new Region(); for (const [pts, w] of WOOD.paths) region.path(pts, w); for (const [x, z, r] of WOOD.clearings) region.disc(x, z, r);
  const col = new Colliders(4); col.region = region;
  const X0 = -64, X1 = 64, Z0 = -96, Z1 = 78;
  // ---- ground: vertex-coloured plane (moss off-path, earthy trails, darker under the canopy) ----
  const W = X1 - X0, D = Z1 - Z0; const gseg = Q === 'low' ? 1.6 : 1.0;
  const gg = new THREE.PlaneGeometry(W, D, Math.round(W / gseg), Math.round(D / gseg)); gg.rotateX(-Math.PI / 2); gg.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
  const gp = gg.attributes.position; const gc = new Float32Array(gp.count * 3);
  const capDist = (x, z) => { let d = 1e9; for (const [pts] of WOOD.paths) for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; const abx = bx - ax, abz = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * abx + (z - az) * abz) / (abx * abx + abz * abz))); d = Math.min(d, Math.hypot(x - ax - abx * t, z - az - abz * t)); } return d; };
  for (let i = 0; i < gp.count; i++) { const x = gp.getX(i), z = gp.getZ(i); const s = region.sdf(x, z); const n = fbm(x * 0.15, z * 0.15, 3); const pd = capDist(x, z);
    const walk = THREE.MathUtils.smoothstep(-s, -1.5, 2.5); const trail = (1 - THREE.MathUtils.smoothstep(pd, 0.4, 1.6)) * (0.6 + n * 0.5);
    let r = 0.16 + n * 0.1, g = 0.24 + n * 0.12, b = 0.2 + n * 0.08; r *= 0.55 + walk * 0.45; g *= 0.55 + walk * 0.45; b *= 0.6 + walk * 0.4;
    r += trail * 0.2; g += trail * 0.12; b += trail * 0.04; gc[i * 3] = r * 1.5; gc[i * 3 + 1] = g * 1.5; gc[i * 3 + 2] = b * 1.5; gp.setY(i, (s > 2 ? Math.min(1.2, (s - 2) * 0.15) : 0) + n * 0.12 - 0.06); }
  gg.setAttribute('color', new THREE.BufferAttribute(gc, 3)); gg.computeVertexNormals();
  const gtex = tex('ground'); gtex.repeat.set(W / 9, D / 9);
  const ground = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ map: gtex, vertexColors: true, roughness: 0.95 })); ground.receiveShadow = true; root.add(ground);
  // ---- trees: dense outside the walkable region (natural walls), sparse inside big clearings ----
  const kinds = ['broad', 'broad', 'pine', 'dead']; const tv = kinds.map((k, i) => ({ k, geo: treeGeos(k, 11 + i * 17), list: [] }));
  const tvb2 = { k: 'broad', geo: treeGeos('broad', 77), list: [] }; tv.push(tvb2);
  const step = Q === 'low' ? 3.4 : 2.7;
  for (let x = X0; x <= X1; x += step) for (let z = Z0; z <= Z1; z += step) {
    const px = x + (rnd() - 0.5) * step * 0.9, pz = z + (rnd() - 0.5) * step * 0.9; const s = region.sdf(px, pz);
    if (s < 1.0 || s > 16) continue; if (s > 7 && rnd() < 0.35) continue;
    const v = s > 9 ? tv[rnd() < 0.5 ? 0 : 2] : tv[Math.floor(rnd() * tv.length)]; if (v.k === 'dead' && rnd() < 0.6) continue;
    const sc = 0.85 + rnd() * 0.65 + Math.min(0.5, s * 0.03);
    v.list.push({ x: px, z: pz, ry: rnd() * TAU, s: sc, color: new THREE.Color().setHSL(0.36 + rnd() * 0.12, 0.35 + rnd() * 0.2, 0.32 + rnd() * 0.12).getHex() });
    if (s < 5) col.add({ type: 'c', x: px, z: pz, r: 0.5 * sc, tree: true });
  }
  // a few big feature trees inside clearings (obstacles to fight around)
  for (const [x, z, sc] of [[-5, 34, 1.5], [6, 30, 1.2], [40, 13, 1.4], [-5, 2.5, 0], [27, -31, 1.3], [-12, -29, 1.5], [9, -78, 1.6], [-10, -70, 1.5], [10, -68, 1.3]]) { if (!sc) continue; tv[0].list.push({ x, z, ry: rnd() * 6, s: sc, color: 0x88b0a0 }); col.add({ type: 'c', x, z, r: 0.55 * sc, tree: true, wall: true }); }
  const cast = Q === 'high';
  for (const v of tv) { if (!v.list.length) continue; root.add(instanced(v.geo.trunk, M.bark, v.list, { cast })); if (v.k !== 'dead') root.add(instanced(v.geo.crown, v.k === 'pine' ? M.leafDark : M.leaf, v.list, { cast })); }
  // ---- rocks ----
  const rockLists = [[], [], []]; const rg = [rockGeo(3), rockGeo(9, 0.9), rockGeo(21, 0.3)];
  for (let i = 0; i < 260; i++) { const x = X0 + rnd() * W, z = Z0 + rnd() * D; const s = region.sdf(x, z); if (s < -2.5 || s > 6) continue; const sc = 0.4 + rnd() * (s > 0 ? 1.6 : 0.8); rockLists[i % 3].push({ x, z, y: sc * 0.15, ry: rnd() * 6, s: sc, color: 0xffffff }); if (s < 2 && sc > 0.6) col.add({ type: 'c', x, z, r: sc * 0.8 }); }
  // big boulder formations in clearings
  for (const [x, z, sc] of [[-6, 44, 1.7], [44, 18, 2.0], [-30, 12, 1.6], [28, -40, 1.8], [-22, -30, 2.0], [-46, -40, 1.6], [12, -76, 2.2], [-12, -80, 2.0], [-3, 26, 1.0], [30, -26, 1.4]]) { rockLists[0].push({ x, z, y: sc * 0.2, ry: rnd() * 6, s: sc, color: 0xffffff }); col.add({ type: 'c', x, z, r: sc * 0.85, wall: true }); }
  rockLists.forEach((l, i) => root.add(instanced(rg[i], M.rock, l, { cast: Q !== 'low', receive: true })));
  // ---- oversized ferns / foliage silhouettes along the edges ----
  const fernGeo = (() => { const a = new THREE.PlaneGeometry(1, 1); a.translate(0, 0.5, 0); const b = a.clone(); b.rotateY(Math.PI / 2); const c = a.clone(); c.rotateY(Math.PI / 4); return mergeAll([a, b, c]); })();
  const ferns = []; for (let i = 0; i < (Q === 'low' ? 160 : 380); i++) { const x = X0 + rnd() * W, z = Z0 + rnd() * D; const s = region.sdf(x, z); if (s < -0.6 || s > 3.5) continue; ferns.push({ x, z, ry: rnd() * 6, s: 1.2 + rnd() * 1.8, sy: 0.8 + rnd() * 0.5 }); }
  // the hidden way is screened by extra-large ferns
  for (let i = 0; i < 14; i++) { const t = i / 13; ferns.push({ x: -36 - t * 9 + (rnd() - 0.5) * 2.5, z: -6 - t * 18 + (rnd() - 0.5) * 2, ry: rnd() * 6, s: 2.6 + rnd(), sy: 1 }); }
  root.add(instanced(fernGeo, M.fern, ferns));
  // ---- glowing mushrooms (instanced; three colors) + glow pools ----
  const mg = mushroomGeos(); const shroomCols = [0x3ff0ff, 0xff5ad8, 0x9dff5a]; const shLists = [[], [], []]; const lightSrc = [];
  const decals = new THREE.Group(); root.add(decals);
  const addCluster = (x, z, ci, n = 5) => { for (let k = 0; k < n; k++) { const a = rnd() * TAU, d = rnd() * 0.9; shLists[ci].push({ x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, ry: rnd() * 6, s: 0.6 + rnd() * 1.3 }); }
    const dcl = glowDecal(shroomCols[ci], 3.2, 0.32); dcl.position.set(x, 0.05, z); decals.add(dcl); lightSrc.push({ x, y: 0.6, z, color: shroomCols[ci], i: 3, d: 5 }); };
  for (let i = 0; i < 70; i++) { const x = X0 + rnd() * W, z = Z0 + rnd() * D; const s = region.sdf(x, z); if (s < -1.2 || s > 1.8) continue; addCluster(x, z, Math.floor(rnd() * 3), 3 + Math.floor(rnd() * 4)); }
  for (const [x, z] of [[-40, -43], [-44, -49], [-39, -50]]) addCluster(x, z, 1, 6);
  const capMats = shroomCols.map((c) => emissive(c, 2.6)); const stemMat = new THREE.MeshStandardMaterial({ color: 0xd8d0c0, emissive: 0x302820, roughness: 0.8 });
  shLists.forEach((l, i) => { if (!l.length) return; root.add(instanced(mg.stem, stemMat, l)); root.add(instanced(mg.cap, capMats[i], l)); });
  // ---- crystal clusters (crystal grove + hollow + scattered) ----
  const cg = crystalGeo(5); const crysLists = { blue: [], violet: [] };
  const crys = (x, z, s, c) => { crysLists[c].push({ x, z, ry: rnd() * 6, s }); const colr = c === 'blue' ? 0x5ad8ff : 0xb070ff; const d = glowDecal(colr, 4.5 * s, 0.4); d.position.set(x, 0.05, z); decals.add(d); lightSrc.push({ x, y: 1, z, color: colr, i: 6, d: 7 }); };
  for (const [x, z, s] of [[13, -28, 1.2], [28, -35, 1.5], [22, -43, 1.1], [14, -41, 0.9], [30, -29, 0.8], [-47, -47, 1.3], [-37, -42, 1.0], [-44, -52, 1.4], [-6, -78, 1.2], [6, -84, 1.4], [-12, -66, 0.8], [12, -64, 0.9]]) { crys(x, z, s, rnd() < 0.6 ? 'blue' : 'violet'); col.add({ type: 'c', x, z, r: 0.6 * s }); }
  for (let i = 0; i < 18; i++) { const x = X0 + rnd() * W, z = Z0 + rnd() * D; const s = region.sdf(x, z); if (s < 0.5 || s > 3) continue; crys(x, z, 0.5 + rnd() * 0.6, rnd() < 0.5 ? 'blue' : 'violet'); }
  root.add(instanced(cg, emissive(0x3ab8ff, 1.8), crysLists.blue)); root.add(instanced(cg, emissive(0x9a50ff, 1.8), crysLists.violet));
  // ---- ruins (west): walls, columns, arch, statues ----
  const ruins = new THREE.Group(); root.add(ruins);
  const placeWall = (x, z, w, h, rot, seed) => { const m = wall(w, h, 0.8, M.stone, true, seed); m.position.set(x, 0, z); m.rotation.y = rot; ruins.add(m); col.add({ type: 'b', x, z, hw: w / 2, hd: 0.45, rot: -rot, wall: true }); };
  placeWall(-41, 7, 7, 2.2, Math.PI / 2, 3); placeWall(-36, 12, 6, 1.6, 0, 5); placeWall(-27, -5, 4, 1.2, 0.3, 7); placeWall(-42.5, -6, 5, 2.4, Math.PI / 2 + 0.2, 9);
  placeWall(-34, -16, 5, 2.0, 0.15, 13); placeWall(-31.5, -12, 3, 1.4, Math.PI / 2, 15);
  for (const [x, z, h, b] of [[-29, 9, 3.4, 0], [-29, -2.5, 3.4, 1], [-38, 0, 3.0, 1], [-34, -7, 3.6, 0], [-38.6, -17.5, 2.6, 1], [-25, 3, 2.5, 1]]) { const c = column(h, !!b); c.position.set(x, 0, z); ruins.add(c); col.add({ type: 'c', x, z, r: 0.5, wall: true }); }
  { const a = arch(3.4, 3.4); a.position.set(-26, 0, 6.5); a.rotation.y = Math.PI / 2 - 0.25; ruins.add(a); for (const s of [-1, 1]) col.add({ type: 'c', x: -26 + Math.sin(0.25) * s * 1.7, z: 6.5 + Math.cos(0.25) * s * 1.7, r: 0.55, wall: true }); }
  { const st = statue(M.stone, 0x6dff9a); st.position.set(-36, 0, 3); st.rotation.y = Math.PI / 2; ruins.add(st); col.add({ type: 'b', x: -36, z: 3, hw: 0.8, hd: 0.8, wall: true }); }
  { const st = statue(M.stoneDark, 0xff6060); st.position.set(-42, 0, -45.5); st.rotation.y = 0.6; ruins.add(st); col.add({ type: 'b', x: -42, z: -45.5, hw: 0.8, hd: 0.8, wall: true }); }
  for (const [x, z, ry] of [[-4, 58, 0.3], [4, 58, -0.4], [3, 12, 0], [-31, 0, 1], [6, -55, 0.2]]) { const l = lantern(); l.position.set(x, 0, z); l.rotation.y = ry; root.add(l); lightSrc.push({ x: x + 0.4, y: 1.4, z, color: 0xffb35a, i: 4, d: 6 }); col.add({ type: 'c', x, z, r: 0.18 }); }
  // the stone circle around the Moonwell
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.2; const x = Math.cos(a) * 7.3, z = Math.sin(a) * 7.3; if (Math.abs(z - 6) < 3 && Math.abs(x) < 3) continue; if (Math.abs(z + 6) < 3 && Math.abs(x) < 4) continue; const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.2 + (i % 3) * 0.5, 0.5), M.stone); m.position.set(x, 1.1, z); m.rotation.y = -a; m.castShadow = true; root.add(m); col.add({ type: 'c', x, z, r: 0.5, wall: true }); }
  // ---- platforms (summoning circles) ----
  const plats = [];
  const addPlat = (x, z, r, c, h) => { const p = platform(r, c, h); p.position.set(x, 0, z); root.add(p); plats.push({ obj: p, x, z, r, h }); return p; };
  addPlat(0, 0, 3.4, 0x6fd8ff, 0.3); addPlat(0, 64, 3.0, 0xa98bff, 0.22); addPlat(0, -74, 7.5, 0x6dff9a, 0.22); addPlat(-42, -46, 2.2, 0xff6080, 0.2); addPlat(21, -34, 2.2, 0x5ad8ff, 0.2);
  // arena ring of standing stones (decor + blocking outer edge)
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; if (Math.abs(a - Math.PI / 2) < 0.35) continue; const x = Math.cos(a) * 14.4, z = -74 + Math.sin(a) * 14.4; const m = new THREE.Mesh(new THREE.BoxGeometry(1.0, 3 + (i % 2), 0.7), M.stoneDark); m.position.set(x, 1.6, z); m.rotation.y = -a; m.castShadow = true; root.add(m); }
  // ---- enchanted pathway stones: faint rune lights along the main trail ----
  const pathStones = []; for (const [pts] of WOOD.paths) for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; const L = Math.hypot(bx - ax, bz - az); for (let d = 2; d < L; d += 5) { const t = d / L; const nx = -(bz - az) / L, nz = (bx - ax) / L; const side = (Math.floor(d / 5) % 2 ? 1 : -1) * 2.3; pathStones.push({ x: ax + (bx - ax) * t + nx * side, z: az + (bz - az) * t + nz * side, ry: rnd() * 6, s: 1 }); } }
  const psGeo = new THREE.CylinderGeometry(0.22, 0.3, 0.16, 6); psGeo.translate(0, 0.06, 0); root.add(instanced(psGeo, emissive(0x3fbf9a, 0.45), pathStones));
  // ---- portal (arrival) ----
  const portal = portalMesh(0xa98bff, 1.55); const pf = new THREE.Group(); pf.add(portal); portal.position.y = 1.95;
  const ringM = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.22, 8, 32), M.stone); ringM.position.y = 1.95; pf.add(ringM);
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const gm = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), emissive(0xb98cff, 3)); gm.position.set(Math.cos(a) * 1.75, 1.95 + Math.sin(a) * 1.75, 0.2); pf.add(gm); }
  const pbase = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, 1.0), M.stoneDark); pbase.position.y = 0.15; pf.add(pbase);
  pf.position.set(WOOD.portal.x, 0.22, 67.2); root.add(pf); col.add({ type: 'b', x: 0, z: 67.3, hw: 1.9, hd: 0.5, wall: true });
  const pglow = glowDecal(0xa98bff, 6, 0.5); pglow.position.set(0, 0.3, 66.5); root.add(pglow); lightSrc.push({ x: 0, y: 2, z: 66, color: 0xa98bff, i: 8, d: 9 });
  // ---- mist + motes ----
  let mist = null; if (Q !== 'low') { mist = mistPlane(W, D, 0x88b8c8, Q === 'high' ? 0.3 : 0.24); mist.position.set((X0 + X1) / 2, 0.35, (Z0 + Z1) / 2); root.add(mist); }
  const mo = motes(Q === 'low' ? 60 : Q === 'medium' ? 140 : 240, 34, [0xbfff8a, 0x8affe0, 0xffe08a, 0xd0a0ff], 0.11); root.add(mo);
  // ---- named sub-areas for the "region entered" banner ----
  const groundY = (x, z) => { let y = 0; for (const p of plats) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r + 0.4) y = Math.max(y, p.h * THREE.MathUtils.smoothstep(p.r + 0.4 - d, 0, 0.5)); } return y; };
  const zoneAt = (x, z) => { let best = null, bd = 1e9; for (const [cx, cz, r, name] of WOOD.clearings) { const d = Math.hypot(x - cx, z - cz) - r; if (d < bd) { bd = d; best = name; } } return bd < 2 ? WOOD.zoneNames.find((n) => n[0] === best)[1] : null; };
  return { root, col, region, plats, lightSrc, mist, motes: mo, portal, groundY, zoneAt, fog: { color: 0x0a1416, density: 0.021 }, sky: 0x060b0e,
    anim(t) { for (const p of plats) { const u = p.obj.userData; u.runes.rotation.z = t * 0.12; u.rm.opacity = 0.6 + 0.25 * Math.sin(t * 1.5 + p.x); } portal.userData.mat.uniforms.uT.value = t; if (mist) mist.userData.mat.uniforms.uT.value = t; mo.material.uniforms.uT.value = t; } };
}
function mergeAll(geos) { return geos.reduce((acc, g) => { if (!acc) return g; const a = acc.toNonIndexed(), b = g.toNonIndexed(); const out = new THREE.BufferGeometry(); for (const k of ['position', 'normal', 'uv']) { const A = a.attributes[k].array, B = b.attributes[k].array; const C = new Float32Array(A.length + B.length); C.set(A); C.set(B, A.length); out.setAttribute(k, new THREE.BufferAttribute(C, a.attributes[k].itemSize)); } return out; }, null); }
