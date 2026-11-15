// The Forgotten Citadel hub (Warden's Hall): a warm, torch-lit stone interior with the Trine Core pedestal,
// the Forge (upgrade station), the Curator's lectern (item index), a healing font and the portal arch.
// The south wall is cut away (diorama view) so the camera always sees in.
import * as THREE from 'three';
import { Colliders, Region } from './collide.js?v=1';
import { M, tex, glowDecal, glowSprite, emissive, platform, portalMesh, motes, flame, animFlame, occlude } from './kit.js?v=1';
import { column, statue, arch, chestMesh } from './props.js?v=1';
import { TAU } from './util.js?v=1';

export const CIT = {
  spawn: { x: 0, z: 12 }, fromPortal: { x: 0, z: -13 },
  objects: [
    ['portal', 'toWoodland', 0, -17.6, { to: 'woodland' }],
    ['pedestal', 'trine', 0, -2, {}],
    ['forge', 'forge', 10.5, 2, {}],
    ['lectern', 'index', -10.5, 2, {}],
    ['font', 'font', -10, -11, {}],
    ['armory', 'armory', 10, -11, {}],
    ['mapTable', 'map', 0, 9, {}],
  ],
};
export function buildCitadel(quality) {
  const Q = quality; const root = new THREE.Group(); const col = new Colliders(3);
  const HW = 15, Z0 = -20, Z1 = 18; // interior bounds
  const region = new Region(); region.path([[-HW + 1.2, 0], [HW - 1.2, 0]], 1); region.disc(0, 0, 0); // placeholder union, replaced by a box sdf below
  region.sdf = (x, z) => Math.max(Math.abs(x) - (HW - 0.9), z - (Z1 - 0.8), (Z0 + 1.4) - z); col.region = region;
  // floor
  const ft = tex('floor'); ft.repeat.set(7, 9);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2 + 6, Z1 - Z0 + 6), new THREE.MeshStandardMaterial({ map: ft, color: 0xc8b0a0, roughness: 0.8 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, (Z0 + Z1) / 2); floor.receiveShadow = true; root.add(floor);
  // carpet runner
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(3, 26), new THREE.MeshStandardMaterial({ color: 0x5a1a1e, roughness: 1 })); carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.02, -2); carpet.receiveShadow = true; root.add(carpet);
  for (const s of [-1, 1]) { const tr = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 26), new THREE.MeshStandardMaterial({ color: 0xc9a050, roughness: 0.6, metalness: 0.5 })); tr.rotation.x = -Math.PI / 2; tr.position.set(s * 1.4, 0.025, -2); root.add(tr); }
  // walls: north (tall, with arch niche for the portal), east/west; south side is open (low parapet only)
  const wallMat = M.warmStone; const wt = tex('stone');
  const mkWall = (x, z, w, h, d, rot = 0, occ = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), occ ? wallMat : new THREE.MeshStandardMaterial({ map: wt, color: 0xc09070, roughness: 0.85 })); m.position.set(x, h / 2, z); m.rotation.y = rot; m.castShadow = m.receiveShadow = true; root.add(m); col.add({ type: 'b', x, z, hw: rot ? d / 2 : w / 2, hd: rot ? w / 2 : d / 2, wall: true }); return m; };
  mkWall(-9.6, Z0, 12.2, 7, 1.2); mkWall(9.6, Z0, 12.2, 7, 1.2); // north wall halves around the portal niche
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(7, 1.6, 1.2), wallMat); lintel.position.set(0, 6.2, Z0); root.add(lintel);
  const niche = new THREE.Mesh(new THREE.BoxGeometry(7, 7, 1), M.stoneDark); niche.position.set(0, 3.5, Z0 - 1.6); root.add(niche); col.add({ type: 'b', x: 0, z: Z0 - 1.2, hw: 3.5, hd: 0.6, wall: true });
  mkWall(-HW - 0.6, (Z0 + Z1) / 2, 1.2, 5.2, Z1 - Z0 + 1.2); mkWall(HW + 0.6, (Z0 + Z1) / 2, 1.2, 5.2, Z1 - Z0 + 1.2);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(HW - 2, 0.9, 0.7), M.warmStone); p.position.set(s * (HW / 2 + 1), 0.45, Z1 + 0.3); p.castShadow = true; root.add(p); col.add({ type: 'b', x: s * (HW / 2 + 1), z: Z1 + 0.3, hw: (HW - 2) / 2, hd: 0.35 }); }
  // wall trim + arches along the side walls (columns with torches between)
  const torches = []; const lightSrc = [];
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const z = Z0 + 4 + i * 9; const c = column(4.4, false, M.warmStone); c.position.set(s * (HW - 0.6), 0, z); root.add(c); col.add({ type: 'c', x: s * (HW - 0.6), z, r: 0.55, wall: true });
    if (i < 3) { const tz = z + 4.5; const br = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.5, 6), M.metal); br.position.set(s * (HW - 0.25), 2.6, tz); root.add(br); const f = flame(0.8); f.position.set(s * (HW - 0.35), 2.95, tz); root.add(f); torches.push(f); lightSrc.push({ x: s * (HW - 1), y: 3, z: tz, color: 0xff8a3a, i: 10, d: 10, flicker: true });
      const d = glowDecal(0xff7a2a, 5, 0.2); d.position.set(s * (HW - 1.5), 0.05, tz); root.add(d); }
  }
  // banners on the north wall
  for (const x of [-9, -4.8, 4.8, 9]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.6), new THREE.MeshStandardMaterial({ color: x < 0 ? 0x4a1e5a : 0x1e4a3a, roughness: 1, side: THREE.DoubleSide })); b.position.set(x, 4.2, Z0 + 0.62); root.add(b);
    const em = new THREE.Mesh(new THREE.CircleGeometry(0.4, 3), new THREE.MeshStandardMaterial({ color: 0xd4a84a, metalness: 0.8, roughness: 0.4, emissive: 0x3a2a08 })); em.position.set(x, 4.6, Z0 + 0.64); em.rotation.z = Math.PI / 2; root.add(em); }
  // braziers flanking the portal + centre
  for (const [x, z] of [[-4.6, -15.5], [4.6, -15.5], [-5.5, 5.5], [5.5, 5.5]]) { const b = new THREE.Group(); const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.3, 0.45, 10), M.metal); bowl.position.y = 1.05; b.add(bowl); const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.22, 0.9, 6), M.metal); leg.position.y = 0.45; b.add(leg);
    const f = flame(1.2); f.position.y = 1.45; b.add(f); torches.push(f); b.position.set(x, 0, z); root.add(b); col.add({ type: 'c', x, z, r: 0.55 }); lightSrc.push({ x, y: 1.8, z, color: 0xff9a4a, i: 12, d: 11, flicker: true }); const d = glowDecal(0xff8a3a, 6, 0.28); d.position.set(x, 0.04, z); root.add(d); }
  // warden statues
  for (const [x, z, ry] of [[-7.5, -17.2, 0.3], [7.5, -17.2, -0.3]]) { const st = statue(M.warmStone, 0xffc46a); st.position.set(x, 0, z); st.rotation.y = ry; root.add(st); col.add({ type: 'b', x, z, hw: 0.8, hd: 0.8, wall: true }); }
  // portal arch
  const portal = portalMesh(0x6dffb0, 1.7); portal.position.set(0, 2.25, Z0 + 1.0); root.add(portal);
  const pa = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.3, 8, 32), M.stone); pa.position.set(0, 2.25, Z0 + 1.0); root.add(pa);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; const g = new THREE.Mesh(new THREE.OctahedronGeometry(0.15), emissive(0x6dffb0, 3)); g.position.set(Math.cos(a) * 1.95, 2.25 + Math.sin(a) * 1.95, Z0 + 1.3); root.add(g); }
  const pstep = platform(2.3, 0x6dffb0, 0.18); pstep.position.set(0, 0, Z0 + 2.6); root.add(pstep);
  lightSrc.push({ x: 0, y: 2.2, z: Z0 + 2.5, color: 0x6dffb0, i: 9, d: 10 });
  // central dais with the Trine Core pedestal
  const dais = platform(3.0, 0xffb35a, 0.3); dais.position.set(0, 0, -2); root.add(dais);
  const ped = new THREE.Group(); const pcol = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 1.1, 8), M.warmStone); pcol.position.y = 0.85; ped.add(pcol); const ptop = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.55, 0.2, 8), M.gold); ptop.position.y = 1.45; ped.add(ptop); ped.position.set(0, 0, -2); root.add(ped); col.add({ type: 'c', x: 0, z: -2, r: 0.75 });
  const core = trineCore(0.55); core.position.set(0, 2.35, -2); root.add(core); lightSrc.push({ x: 0, y: 2.6, z: -2, color: 0xffa040, i: 10, d: 9 });
  // forge (upgrade station): anvil + furnace glow
  const forge = new THREE.Group(); const furn = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 1.6), M.stoneDark); furn.position.set(1.2, 1.1, -0.5); forge.add(furn);
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshBasicMaterial({ color: 0xff6a1a, toneMapped: false })); mouth.position.set(1.2, 0.8, 0.31); forge.add(mouth); const ff = flame(1.0); ff.position.set(1.2, 0.85, 0.5); forge.add(ff); torches.push(ff);
  const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.45), M.metal); anvil.position.set(-0.9, 0.85, 0.8); forge.add(anvil); const ab = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.35), M.metal); ab.position.set(-0.9, 0.4, 0.8); forge.add(ab);
  forge.position.set(11.8, 0, 1.6); root.add(forge); col.add({ type: 'b', x: 13, z: 1.1, hw: 1.3, hd: 0.9, wall: true }); col.add({ type: 'c', x: 10.9, z: 2.4, r: 0.5 }); lightSrc.push({ x: 12.5, y: 1, z: 2.5, color: 0xff6a1a, i: 10, d: 8, flicker: true });
  const fd = glowDecal(0xff6a1a, 5, 0.35); fd.position.set(12.5, 0.04, 2.6); root.add(fd);
  // curator's lectern (index) with floating glowing book + shelves
  const lect = new THREE.Group(); const lp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, 1.1, 6), M.wood); lp.position.y = 0.55; lect.add(lp); const lt = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.65), M.wood); lt.position.y = 1.15; lt.rotation.x = -0.4; lect.add(lt);
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x3a1a4a, emissive: 0x6a3aff, emissiveIntensity: 0.6 })); book.position.y = 1.55; lect.add(book); const bs = glowSprite(0xb98cff, 1.6, 0.5); bs.position.y = 1.6; lect.add(bs);
  lect.position.set(-10.5, 0, 1.6); root.add(lect); col.add({ type: 'c', x: -10.5, z: 1.6, r: 0.45 }); lightSrc.push({ x: -10.5, y: 1.8, z: 1.8, color: 0xb98cff, i: 6, d: 6 });
  for (const z of [-3, 5]) { const sh = new THREE.Group(); const fr = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3, 3.2), M.wood); fr.position.y = 1.5; sh.add(fr); for (let k = 0; k < 4; k++) for (let j = 0; j < 7; j++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.25), new THREE.MeshStandardMaterial({ color: [0x6a2a2a, 0x2a4a6a, 0x4a5a2a, 0x6a5a2a][(k + j) % 4], roughness: 0.9 })); b.position.set(0.15, 0.55 + k * 0.7, -1.3 + j * 0.42); sh.add(b); } sh.position.set(-HW + 0.6, 0, z); root.add(sh); col.add({ type: 'b', x: -HW + 0.6, z, hw: 0.4, hd: 1.6, wall: true }); }
  // healing font
  const font = new THREE.Group(); const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.7, 0.8, 12), M.warmStone); basin.position.y = 0.4; font.add(basin); const water = new THREE.Mesh(new THREE.CircleGeometry(0.85, 20), new THREE.MeshStandardMaterial({ color: 0x3affd8, emissive: 0x2affc0, emissiveIntensity: 1.6, roughness: 0.1 })); water.rotation.x = -Math.PI / 2; water.position.y = 0.78; font.add(water); const ws = glowSprite(0x4dffd8, 2.4, 0.45); ws.position.y = 1.0; font.add(ws);
  font.position.set(-10, 0, -11); root.add(font); col.add({ type: 'c', x: -10, z: -11, r: 1.05 }); lightSrc.push({ x: -10, y: 1.4, z: -11, color: 0x4dffd8, i: 7, d: 7 });
  // armory rack (gear stash/inventory) - weapon rack with props
  const rack = new THREE.Group(); const rb = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 0.5), M.wood); rb.position.y = 1.4; rack.add(rb); const rb2 = rb.clone(); rb2.position.y = 0.3; rack.add(rb2);
  for (let i = 0; i < 5; i++) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.04), M.metal); w.position.set(-1 + i * 0.5, 1.0, 0.1); w.rotation.z = (i - 2) * 0.05; rack.add(w); }
  const ch = chestMesh('ornate'); ch.position.set(0, 0, 0.9); rack.add(ch); rack.position.set(10, 0, -11.6); root.add(rack); col.add({ type: 'b', x: 10, z: -11.3, hw: 1.4, hd: 0.8 });
  // map table
  const mt = new THREE.Group(); const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 1.6), M.wood); top.position.y = 0.95; mt.add(top); for (const [a, b] of [[-1.1, -0.65], [1.1, -0.65], [-1.1, 0.65], [1.1, 0.65]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), M.wood); l.position.set(a, 0.45, b); mt.add(l); }
  const mapP = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.35), new THREE.MeshStandardMaterial({ color: 0xd8c08a, roughness: 1, emissive: 0x2a2010 })); mapP.rotation.x = -Math.PI / 2; mapP.position.y = 1.02; mt.add(mapP);
  mt.position.set(0, 0, 9); root.add(mt); col.add({ type: 'b', x: 0, z: 9, hw: 1.35, hd: 0.85 });
  // chandelier glow overhead + dust motes
  const mo = motes(Q === 'low' ? 40 : 110, 30, [0xffd8a0, 0xffb070], 0.08); root.add(mo);
  const groundY = (x, z) => { const d = Math.hypot(x, z + 2); const d2 = Math.hypot(x, z - (Z0 + 2.6)); return Math.max(d < 3.4 ? 0.3 * THREE.MathUtils.smoothstep(3.4 - d, 0, 0.5) : 0, d2 < 2.7 ? 0.18 * THREE.MathUtils.smoothstep(2.7 - d2, 0, 0.5) : 0); };
  return { root, col, region, plats: [], lightSrc, portal, groundY, zoneAt: () => null, fog: { color: 0x120a06, density: 0.012 }, sky: 0x0b0705, core,
    anim(t) { for (const f of torches) animFlame(f, t); portal.userData.mat.uniforms.uT.value = t; mo.material.uniforms.uT.value = t; animTrine(core, t, 1); pstep.userData.runes.rotation.z = t * 0.2; dais.userData.runes.rotation.z = -t * 0.1; book.position.y = 1.55 + Math.sin(t * 1.5) * 0.06; book.rotation.y = Math.sin(t * 0.7) * 0.2; ws.material.opacity = 0.4 + 0.1 * Math.sin(t * 2); } };
}
// The Trine Core: luminous triangular core + rotating rings + orbiting shards (used in the hub and the artifact screen)
export function trineCore(scale = 1, level = 0) {
  const g = new THREE.Group(); const s = scale;
  const triGeo = (r, d) => { const sh = new THREE.Shape(); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + Math.PI / 2; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? sh.lineTo(x, y) : sh.moveTo(x, y); } sh.closePath(); const geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelThickness: d * 0.4, bevelSize: r * 0.08, bevelSegments: 1 }); geo.center(); return geo; };
  const coreMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xff9a3a, emissiveIntensity: 2.2, roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0.95 });
  const core = new THREE.Mesh(triGeo(0.9 * s, 0.32 * s), coreMat); g.add(core);
  const shell = new THREE.Mesh(triGeo(1.25 * s, 0.12 * s), new THREE.MeshStandardMaterial({ color: 0x3a2a1a, metalness: 0.9, roughness: 0.3, emissive: 0x2a1406, wireframe: false })); shell.position.z = -0.05 * s; g.add(shell);
  const inner = new THREE.Mesh(new THREE.OctahedronGeometry(0.28 * s), new THREE.MeshBasicMaterial({ color: 0xfff3d8, toneMapped: false })); g.add(inner);
  const rings = []; for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry((1.5 + i * 0.32) * s, 0.025 * s * (i === 0 ? 1.6 : 1), 6, 64), new THREE.MeshBasicMaterial({ color: [0xffc46a, 0xff9a4a, 0xffe0b0][i], transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); r.rotation.x = Math.PI / 2 + i * 0.5; r.rotation.y = i * 0.8; g.add(r); rings.push(r); }
  const shards = []; for (let i = 0; i < 6; i++) { const sh = new THREE.Mesh(new THREE.TetrahedronGeometry(0.11 * s), new THREE.MeshStandardMaterial({ color: 0xffe0b0, emissive: 0xffa040, emissiveIntensity: 2.5 })); g.add(sh); shards.push(sh); }
  const halo = glowSprite(0xff9a3a, 4.2 * s, 0.55); g.add(halo);
  g.userData = { core, shell, inner, rings, shards, halo, coreMat, pulse: 0, level, s };
  return g;
}
export function animTrine(g, t, k = 1) {
  const u = g.userData; const p = u.pulse; u.core.rotation.y = t * 0.6; u.shell.rotation.y = t * 0.6; u.core.rotation.z = Math.sin(t * 0.4) * 0.15; u.shell.rotation.z = u.core.rotation.z;
  u.inner.rotation.y = -t * 2; u.inner.scale.setScalar(1 + 0.15 * Math.sin(t * 3) + p * 1.2);
  u.rings.forEach((r, i) => { r.rotation.z = t * (0.5 + i * 0.35) * (i % 2 ? -1 : 1); r.rotation.x = Math.PI / 2 + Math.sin(t * 0.3 + i) * 0.6; r.scale.setScalar(1 + p * (0.6 + i * 0.3)); r.material.opacity = 0.55 + 0.3 * Math.sin(t * 2 + i) + p; });
  const lv = Math.min(1, (u.level || 0) / 20); u.shards.forEach((s, i) => { const a = t * (0.8 + lv) + i / u.shards.length * TAU; const R = (1.15 + 0.15 * Math.sin(t * 2 + i)) * u.s * (1 + p * 1.5); s.position.set(Math.cos(a) * R, Math.sin(a * 1.3 + i) * 0.35 * u.s, Math.sin(a) * R); s.rotation.set(t * 2 + i, t * 3, 0); s.visible = i < 3 + Math.min(3, Math.floor((u.level || 0) / 4)); });
  u.coreMat.emissiveIntensity = (1.8 + 0.6 * Math.sin(t * 2.2) + lv * 1.2 + p * 6) * k; u.halo.material.opacity = (0.45 + 0.15 * Math.sin(t * 2.2) + p) * k; u.halo.scale.setScalar(u.s * (4.2 + lv * 1.5 + p * 6));
}
