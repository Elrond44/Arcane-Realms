// Shared environment kit: procedural textures, materials (with camera-occlusion fade), glow decals,
// mist, floating motes, portal vortex, summoning platforms, rune rings, flames, interact rings.
import * as THREE from 'three';
import { mulberry32, fbm, TAU } from './util.js?v=1';

// ---------- camera occlusion fade (screen-door dither around the camera->hero line) ----------
export const OCC = { uHero: { value: new THREE.Vector3() }, uCam: { value: new THREE.Vector3() }, uOcc: { value: 1 } };
export function occlude(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uHero = OCC.uHero; sh.uniforms.uCam = OCC.uCam; sh.uniforms.uOcc = OCC.uOcc;
    sh.vertexShader = 'varying vec3 vOccW;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 occW = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        occW = instanceMatrix * occW;
      #endif
      occW = modelMatrix * occW; vOccW = occW.xyz;`);
    sh.fragmentShader = 'uniform vec3 uHero; uniform vec3 uCam; uniform float uOcc; varying vec3 vOccW;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      if (uOcc > 0.5) { vec3 hp = uHero + vec3(0.0, 0.55, 0.0); vec3 ab = hp - uCam; float t = clamp(dot(vOccW - uCam, ab) / dot(ab, ab), 0.0, 1.0);
        float d = length(vOccW - (uCam + ab * t));
        float fade = (1.0 - smoothstep(1.6, 3.2, d)) * (1.0 - smoothstep(0.84, 0.97, t)) * smoothstep(hp.y - 0.4, hp.y + 0.6, vOccW.y);
        float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        if (fade * 0.85 > n) discard; }`);
  };
  mat.customProgramCacheKey = () => 'occ' + mat.type;
  return mat;
}
// ---------- canvas textures ----------
function canvasTex(size, draw, repeat = 1, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); draw(x, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const texCache = {};
export function tex(name) {
  if (texCache[name]) return texCache[name];
  const r = mulberry32(name.length * 991 + 7);
  const T = {
    ground: () => canvasTex(512, (x, s) => { const img = x.createImageData(s, s); for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) { const n = fbm(i / 40, j / 40, 4), m = fbm(i / 7 + 50, j / 7, 2); const k = (i * s + j) * 4; const v = 0.55 + n * 0.6 + (m - 0.5) * 0.35; img.data[k] = 255 * 0.42 * v; img.data[k + 1] = 255 * 0.55 * v; img.data[k + 2] = 255 * 0.42 * v; img.data[k + 3] = 255; } x.putImageData(img, 0, 0);
      for (let i = 0; i < 1600; i++) { x.strokeStyle = `rgba(${120 + r() * 60},${150 + r() * 70},${90 + r() * 50},${0.15 + r() * 0.25})`; x.lineWidth = 1; const px = r() * s, py = r() * s; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 4, py - 3 - r() * 5); x.stroke(); }
      for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(30,25,20,${0.2 + r() * 0.3})`; x.beginPath(); x.ellipse(r() * s, r() * s, 1 + r() * 3, 1 + r() * 2, r() * 3, 0, TAU); x.fill(); } }),
    stone: () => canvasTex(512, (x, s) => { x.fillStyle = '#6b6158'; x.fillRect(0, 0, s, s); const rows = 6; const h = s / rows;
      for (let rI = 0; rI < rows; rI++) { let px = (rI % 2) * -h * 0.6; while (px < s) { const w = h * (0.9 + r() * 0.9); const g = 90 + r() * 40; x.fillStyle = `rgb(${g + 12},${g + 4},${g - 6})`; x.fillRect(px + 2, rI * h + 2, w - 4, h - 4);
        for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,240,220'},${r() * 0.08})`; x.fillRect(px + r() * w, rI * h + r() * h, 2 + r() * 6, 2 + r() * 6); } px += w; } }
      x.strokeStyle = 'rgba(20,15,10,0.6)'; x.lineWidth = 3; for (let rI = 0; rI <= rows; rI++) { x.beginPath(); x.moveTo(0, rI * h); x.lineTo(s, rI * h); x.stroke(); } }),
    floor: () => canvasTex(512, (x, s) => { const n = 4, w = s / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const g = 120 + r() * 35; x.fillStyle = `rgb(${g + 24},${g + 6},${g - 18})`; x.fillRect(i * w, j * w, w, w);
        for (let k = 0; k < 120; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '40,25,10' : '255,230,190'},${r() * 0.07})`; x.beginPath(); x.arc(i * w + r() * w, j * w + r() * w, 1 + r() * 7, 0, TAU); x.fill(); }
        x.strokeStyle = 'rgba(25,15,8,0.75)'; x.lineWidth = 4; x.strokeRect(i * w + 1, j * w + 1, w - 2, w - 2); x.strokeStyle = 'rgba(255,220,170,0.08)'; x.lineWidth = 2; x.strokeRect(i * w + 5, j * w + 5, w - 10, w - 10); }
      for (let k = 0; k < 6; k++) { x.strokeStyle = 'rgba(20,12,6,0.5)'; x.lineWidth = 1.2; x.beginPath(); let px = r() * s, py = r() * s; x.moveTo(px, py); for (let q = 0; q < 5; q++) { px += (r() - 0.5) * 40; py += (r() - 0.5) * 40; x.lineTo(px, py); } x.stroke(); } }),
    bark: () => canvasTex(256, (x, s) => { x.fillStyle = '#3a2a1e'; x.fillRect(0, 0, s, s); for (let i = 0; i < 70; i++) { x.strokeStyle = `rgba(${r() < 0.5 ? '15,10,6' : '90,70,50'},${0.3 + r() * 0.4})`; x.lineWidth = 1 + r() * 3; const px = r() * s; x.beginPath(); x.moveTo(px, 0); x.bezierCurveTo(px + (r() - 0.5) * 20, s * 0.3, px + (r() - 0.5) * 20, s * 0.6, px + (r() - 0.5) * 10, s); x.stroke(); } }),
    glow: () => canvasTex(128, (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(0.6, 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }, 1, false),
    spark: () => canvasTex(64, (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }, 1, false),
    runes: () => canvasTex(512, (x, s) => { x.clearRect(0, 0, s, s); x.translate(s / 2, s / 2); x.strokeStyle = '#fff'; x.lineCap = 'round';
      x.lineWidth = 6; x.beginPath(); x.arc(0, 0, s * 0.47, 0, TAU); x.stroke(); x.lineWidth = 3; x.beginPath(); x.arc(0, 0, s * 0.37, 0, TAU); x.stroke(); x.beginPath(); x.arc(0, 0, s * 0.2, 0, TAU); x.stroke();
      for (let i = 0; i < 24; i++) { x.save(); x.rotate(i / 24 * TAU); x.translate(0, -s * 0.42); x.lineWidth = 3; x.beginPath(); const k = Math.floor(r() * 4); if (k === 0) { x.moveTo(-8, -10); x.lineTo(0, 10); x.lineTo(8, -10); } else if (k === 1) { x.moveTo(0, -12); x.lineTo(0, 12); x.moveTo(-8, 0); x.lineTo(8, -6); } else if (k === 2) { x.arc(0, 0, 8, 0, Math.PI * 1.5); } else { x.moveTo(-8, 10); x.lineTo(0, -10); x.lineTo(8, 10); x.moveTo(-5, 3); x.lineTo(5, 3); } x.stroke(); x.restore(); }
      x.lineWidth = 3; x.beginPath(); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU - Math.PI / 2; const px = Math.cos(a) * s * 0.37, py = Math.sin(a) * s * 0.37; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.stroke();
      x.beginPath(); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + Math.PI / 2; const px = Math.cos(a) * s * 0.37, py = Math.sin(a) * s * 0.37; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.stroke(); }, 1, false),
    ring: () => canvasTex(256, (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.75, 'rgba(255,255,255,0.15)'); g.addColorStop(0.9, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }, 1, false),
    leaf: () => canvasTex(256, (x, s) => { x.clearRect(0, 0, s, s); x.translate(s / 2, s); for (let i = -3; i <= 3; i++) { x.save(); x.rotate(i * 0.32); x.fillStyle = `rgb(${20 + r() * 20},${55 + r() * 30},${40 + r() * 20})`; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(-s * 0.12, -s * 0.5, 0, -s * (0.75 + r() * 0.2)); x.quadraticCurveTo(s * 0.12, -s * 0.5, 0, 0); x.fill(); x.strokeStyle = 'rgba(120,180,120,0.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -s * 0.7); x.stroke(); x.restore(); } }, 1),
  };
  return (texCache[name] = T[name]());
}
// ---------- materials ----------
export const M = {};
export function initMaterials() {
  M.bark = occlude(new THREE.MeshStandardMaterial({ map: tex('bark'), color: 0x8a7a6a, roughness: 0.95, flatShading: true }));
  M.leaf = occlude(new THREE.MeshStandardMaterial({ color: 0x2c5a48, roughness: 0.9, flatShading: true, vertexColors: true }));
  M.leafDark = occlude(new THREE.MeshStandardMaterial({ color: 0x1d3b38, roughness: 0.9, flatShading: true, vertexColors: true }));
  M.rock = occlude(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, flatShading: true, vertexColors: true }));
  M.stone = occlude(new THREE.MeshStandardMaterial({ map: tex('stone'), color: 0x9a948a, roughness: 0.9 }));
  M.stoneDark = occlude(new THREE.MeshStandardMaterial({ map: tex('stone'), color: 0x5a5650, roughness: 0.95 }));
  M.warmStone = occlude(new THREE.MeshStandardMaterial({ map: tex('stone'), color: 0xc09070, roughness: 0.85 }));
  M.wood = new THREE.MeshStandardMaterial({ color: 0x5a3c24, roughness: 0.85, flatShading: true });
  M.metal = new THREE.MeshStandardMaterial({ color: 0x8a8580, roughness: 0.4, metalness: 0.8 });
  M.gold = new THREE.MeshStandardMaterial({ color: 0xd4a84a, roughness: 0.35, metalness: 0.9, emissive: 0x3a2a08 });
  M.fern = occlude(new THREE.MeshStandardMaterial({ map: tex('leaf'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, color: 0xa0c0a0 }));
  M.glowAdd = (color, op = 0.6) => new THREE.MeshBasicMaterial({ map: tex('glow'), color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
}
export function emissive(color, k = 2.2) { return new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: k, roughness: 0.4, toneMapped: true }); }
// flat ground-glow decal (fake light pool)
export function glowDecal(color, size, op = 0.5) { const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), M.glowAdd(color, op)); m.rotation.x = -Math.PI / 2; m.position.y = 0.04; m.renderOrder = 2; return m; }
export function glowSprite(color, size, op = 0.8) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex('glow'), color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); s.scale.setScalar(size); return s; }
// ---------- summoning platform with rotating rune ring ----------
export function platform(r, color, h = 0.25) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.06, h, 40), M.stone); base.position.y = h / 2; base.receiveShadow = true; g.add(base);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(r * 1.0, 0.09, 6, 48), M.stoneDark); lip.rotation.x = Math.PI / 2; lip.position.y = h; g.add(lip);
  const rm = new THREE.MeshBasicMaterial({ map: tex('runes'), color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const runes = new THREE.Mesh(new THREE.PlaneGeometry(r * 1.8, r * 1.8), rm); runes.rotation.x = -Math.PI / 2; runes.position.y = h + 0.02; g.add(runes);
  const halo = glowDecal(color, r * 3.2, 0.35); halo.position.y = h + 0.01; g.add(halo);
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const st = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.5 + (i % 2) * 0.35, 0.28), M.stoneDark); st.position.set(Math.cos(a) * (r + 0.35), 0.3, Math.sin(a) * (r + 0.35)); st.rotation.y = a; st.castShadow = true; g.add(st);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), emissive(color, 3)); gem.position.set(st.position.x, st.position.y * 2 + 0.12, st.position.z); g.add(gem); }
  g.userData = { runes, rm, halo, h, r }; return g;
}
export function animPlatform(p, t, k = 1) { const u = p.userData; u.runes.rotation.z = t * 0.15; u.rm.opacity = (0.55 + 0.25 * Math.sin(t * 1.7)) * k; u.halo.material.opacity = 0.25 + 0.12 * Math.sin(t * 1.3) * k; }
// ---------- portal vortex ----------
export function portalMesh(color = 0x8a6aff, r = 1.6) {
  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uC: { value: new THREE.Color(color) }, uK: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform float uT; uniform vec3 uC; uniform float uK; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){ vec2 p = vUv*2.0-1.0; float r = length(p); if (r>1.0) discard; float a = atan(p.y,p.x);
        float sw = a + uT*1.6 + 3.0/(r+0.25); float v = n(vec2(sw*2.0, r*6.0 - uT*2.0))*0.6 + n(vec2(sw*5.0, r*14.0 - uT*3.0))*0.4;
        float core = smoothstep(0.55, 0.0, r); float rim = smoothstep(0.75, 0.97, r) * smoothstep(1.0, 0.95, r);
        vec3 c = uC * (v*1.6*(1.0-r) + rim*2.5) + vec3(1.0,0.95,1.0)*core*0.9*v;
        gl_FragColor = vec4(c*uK, (v*0.7+rim+core*0.6)*smoothstep(1.0,0.9,r)); }` });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 48), mat); g.add(disc); g.userData = { mat, disc }; return g;
}
// ---------- ground mist (one big animated plane) ----------
export function mistPlane(w, d, color = 0x8fb8c8, op = 0.28) {
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uC: { value: new THREE.Color(color) }, uOp: { value: op }, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 } },
    vertexShader: 'varying vec2 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW=w.xz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform float uT; uniform vec3 uC; uniform float uOp; varying vec2 vW;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){ vec2 p = vW*0.08; float v = n(p + vec2(uT*0.05, uT*0.02))*0.55 + n(p*2.3 - vec2(uT*0.07, 0.0))*0.3 + n(p*5.0 + uT*0.1)*0.15;
        v = smoothstep(0.35, 0.9, v); gl_FragColor = vec4(uC, v*uOp); }` });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.y = 0.35; m.renderOrder = 3; m.userData.mat = mat; return m;
}
// ---------- floating motes / fireflies that follow the camera target (GPU animated) ----------
export function motes(n, spread, colors, size = 0.12) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), ph = new Float32Array(n); const r = mulberry32(42); const c = new THREE.Color();
  for (let i = 0; i < n; i++) { pos[i * 3] = (r() - 0.5) * spread; pos[i * 3 + 1] = 0.3 + r() * 4; pos[i * 3 + 2] = (r() - 0.5) * spread; c.set(colors[i % colors.length]); col.set([c.r, c.g, c.b], i * 3); ph[i] = r() * 100; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 }, uC: { value: new THREE.Vector3() }, uS: { value: size }, uSpread: { value: spread }, uPR: { value: 1 }, uMap: { value: tex('spark') } },
    vertexShader: `attribute vec3 color; attribute float ph; uniform float uT; uniform vec3 uC; uniform float uS; uniform float uSpread; uniform float uPR; varying vec3 vC; varying float vA;
      void main(){ vec3 p = position; p.x += sin(uT*0.3+ph)*1.5; p.z += cos(uT*0.23+ph*1.3)*1.5; p.y += sin(uT*0.5+ph*2.0)*0.5;
        p.xz = uC.xz + mod(p.xz - uC.xz + uSpread*0.5, uSpread) - uSpread*0.5;
        vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = uS*uPR*600.0/-mv.z;
        vC = color; vA = (0.55+0.45*sin(uT*2.0+ph*5.0)); }`,
    fragmentShader: 'uniform sampler2D uMap; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC*2.0, t.a*vA); }' });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.userData.mat = mat; return pts;
}
// ---------- torch / brazier flame (billboard sprite stack) ----------
export function flame(scale = 1) {
  const g = new THREE.Group(); const core = glowSprite(0xffd27a, 0.5 * scale, 1); const outer = glowSprite(0xff6a1a, 1.1 * scale, 0.7); const halo = glowSprite(0xff7a2a, 3.2 * scale, 0.22);
  core.position.y = 0.12 * scale; g.add(halo, outer, core); g.userData = { core, outer, halo, s: scale, ph: Math.random() * 10 }; return g;
}
export function animFlame(f, t) { const u = f.userData; const k = 0.85 + 0.15 * Math.sin(t * 13 + u.ph) * Math.sin(t * 7.3 + u.ph * 2); u.outer.scale.set(1.1 * u.s * k, 1.35 * u.s * k, 1); u.core.scale.setScalar(0.5 * u.s * (0.9 + 0.1 * k)); u.halo.material.opacity = 0.18 + 0.06 * k; }
// ---------- interaction ring + floating icon ----------
const iconTexCache = {};
export function iconTexture(glyph, color) {
  const key = glyph + color; if (iconTexCache[key]) return iconTexCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.beginPath(); x.moveTo(64, 6); x.lineTo(116, 58); x.lineTo(64, 110); x.lineTo(12, 58); x.closePath(); x.fillStyle = 'rgba(22,16,12,0.92)'; x.fill(); x.lineWidth = 7; x.strokeStyle = '#d4a84a'; x.stroke(); x.lineWidth = 3; x.strokeStyle = color; x.beginPath(); x.moveTo(64, 18); x.lineTo(104, 58); x.lineTo(64, 98); x.lineTo(24, 58); x.closePath(); x.stroke();
  x.fillStyle = color; x.font = 'bold 50px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(glyph, 64, 61);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (iconTexCache[key] = t);
}
export function interactMarker(radius, color, glyph) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.08, radius, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshBasicMaterial({ map: tex('ring'), color, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  fill.rotation.x = -Math.PI / 2; fill.position.y = 0.05; g.add(fill);
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(glyph, '#' + new THREE.Color(color).getHexString()), transparent: true, depthTest: false, toneMapped: false })); icon.scale.setScalar(0.75); icon.renderOrder = 20; g.add(icon);
  g.userData = { ring, fill, icon, color }; return g;
}
