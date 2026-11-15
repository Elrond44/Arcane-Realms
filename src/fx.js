// Pooled visual effects: GPU-drawn CPU-simulated particles, expanding rings, ground telegraphs,
// weapon trails, projectile visuals, pooled point lights and DOM damage numbers.
import * as THREE from 'three';
import { tex } from './kit.js?v=1';
import { clamp, TAU } from './util.js?v=1';

class ParticlePool {
  constructor(n, blending) {
    this.n = n; this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.c = new Float32Array(n * 3); this.a = new Float32Array(n); this.sz = new Float32Array(n); this.life = new Float32Array(n); this.max = new Float32Array(n); this.g = new Float32Array(n); this.drag = new Float32Array(n); this.s0 = new Float32Array(n); this.s1 = new Float32Array(n);
    this.next = 0; this.live = 0;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('color', new THREE.BufferAttribute(this.c, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('alpha', new THREE.BufferAttribute(this.a, 1).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('size', new THREE.BufferAttribute(this.sz, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending, uniforms: { uMap: { value: tex('spark') }, uPR: { value: 1 }, uAdd: { value: blending === THREE.AdditiveBlending ? 1 : 0 } },
      vertexShader: 'attribute vec3 color; attribute float alpha; attribute float size; uniform float uPR; varying vec3 vC; varying float vA; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = size*uPR*520.0/-mv.z; vC=color; vA=alpha; }',
      fragmentShader: 'uniform sampler2D uMap; uniform float uAdd; varying vec3 vC; varying float vA; void main(){ float t = texture2D(uMap, gl_PointCoord).a; if (vA<=0.0) discard; gl_FragColor = vec4(vC*(1.0+uAdd*1.5), t*vA); }' });
    this.pts = new THREE.Points(geo, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = 5; this.geo = geo;
  }
  emit(x, y, z, vx, vy, vz, col, life, size, size1, grav, drag) {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z; this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.c[i * 3] = col.r; this.c[i * 3 + 1] = col.g; this.c[i * 3 + 2] = col.b; this.life[i] = life; this.max[i] = life; this.s0[i] = size; this.s1[i] = size1; this.g[i] = grav; this.drag[i] = drag; this.a[i] = 1;
  }
  update(dt) {
    let live = 0;
    for (let i = 0; i < this.n; i++) { if (this.life[i] <= 0) { if (this.a[i] !== 0) { this.a[i] = 0; this.sz[i] = 0; } continue; }
      live++; this.life[i] -= dt; const k = Math.max(0, this.life[i] / this.max[i]); const dr = Math.exp(-this.drag[i] * dt);
      this.v[i * 3] *= dr; this.v[i * 3 + 2] *= dr; this.v[i * 3 + 1] = this.v[i * 3 + 1] * dr - this.g[i] * dt;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      if (this.p[i * 3 + 1] < 0.03 && this.g[i] > 0) { this.p[i * 3 + 1] = 0.03; this.v[i * 3 + 1] *= -0.3; this.v[i * 3] *= 0.6; this.v[i * 3 + 2] *= 0.6; }
      this.a[i] = Math.min(1, k * 2.2); this.sz[i] = this.s1[i] + (this.s0[i] - this.s1[i]) * k; }
    this.live = live; for (const k of ['position', 'color', 'alpha', 'size']) this.geo.attributes[k].needsUpdate = true;
  }
}
const _c = new THREE.Color(), _v = new THREE.Vector3();
export class FX {
  constructor(scene, quality = 'medium') {
    this.scene = scene; this.q = quality; this.root = new THREE.Group(); scene.add(this.root);
    this.add = new ParticlePool(1400, THREE.AdditiveBlending); this.norm = new ParticlePool(500, THREE.NormalBlending); this.root.add(this.add.pts, this.norm.pts);
    this.rings = []; this.ringGeo = new THREE.PlaneGeometry(1, 1); this.ringTex = tex('ring');
    this.tele = []; this.trails = []; this.flashes = []; this.scale = quality === 'low' ? 0.45 : quality === 'medium' ? 0.8 : 1;
  }
  setQuality(q) { this.q = q; this.scale = q === 'low' ? 0.45 : q === 'medium' ? 0.8 : 1; }
  setPR(pr) { this.add.mat.uniforms.uPR.value = pr; this.norm.mat.uniforms.uPR.value = pr; }
  // directional burst: dir = {x,z} (attack direction) biases velocities; o: {n,color,speed,spread,life,size,up,grav,drag,norm}
  burst(x, y, z, o = {}) {
    const n = Math.max(1, Math.round((o.n || 12) * this.scale)); const pool = o.norm ? this.norm : this.add; const cols = Array.isArray(o.color) ? o.color : [o.color ?? 0xffffff];
    const sp = o.speed ?? 4, spread = o.spread ?? 1, life = o.life ?? 0.5, size = o.size ?? 0.18, up = o.up ?? 1.5, dx = o.dir ? o.dir.x : 0, dz = o.dir ? o.dir.z : 0;
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU; const r = Math.random(); const s = sp * (0.35 + Math.random() * 0.65);
      let vx = Math.cos(a) * spread * s, vz = Math.sin(a) * spread * s; if (o.dir) { vx = vx * 0.5 + dx * s; vz = vz * 0.5 + dz * s; }
      _c.set(cols[i % cols.length]); pool.emit(x + (o.jit || 0) * (Math.random() - 0.5), y, z + (o.jit || 0) * (Math.random() - 0.5), vx, up * (0.4 + r) * (o.upv ?? 1), vz, _c, life * (0.6 + Math.random() * 0.6), size * (0.7 + Math.random() * 0.6), o.size1 ?? size * 0.2, o.grav ?? 6, o.drag ?? 2.5); }
  }
  // persistent emitters call this each frame (e.g. orb trails)
  puff(x, y, z, color, size = 0.25, life = 0.35, norm = false) { _c.set(color); (norm ? this.norm : this.add).emit(x, y, z, (Math.random() - 0.5) * 0.4, 0.2 + Math.random() * 0.3, (Math.random() - 0.5) * 0.4, _c, life, size, size * 0.1, -0.2, 1); }
  ring(x, z, o = {}) { // expanding ground ring
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ map: this.ringTex, color: o.color ?? 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: o.op ?? 0.9 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, (o.y ?? 0) + 0.08, z); m.renderOrder = 4; this.root.add(m); this.rings.push({ m, t: 0, life: o.life ?? 0.45, r0: o.r0 ?? 0.2, r1: o.r1 ?? 2, op: o.op ?? 0.9 });
  }
  // ground telegraph: shape circle|cone|line|donut; returns handle {prog(0..1), done()}
  telegraph(shape, x, z, o = {}) {
    const size = shape === 'line' ? Math.max(o.length, o.width) * 2 + 2 : (o.r || 2) * 2 + 0.5;
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, toneMapped: false, blending: THREE.NormalBlending,
      uniforms: { uP: { value: 0 }, uC: { value: new THREE.Color(o.color ?? 0xff3a2a) }, uShape: { value: { circle: 0, cone: 1, line: 2, donut: 3 }[shape] }, uR: { value: o.r || 2 }, uR0: { value: o.r0 || 0 }, uA: { value: (o.angle || 60) * Math.PI / 360 }, uL: { value: o.length || 6 }, uW: { value: (o.width || 1.5) / 2 }, uSize: { value: size }, uT: { value: 0 } },
      vertexShader: 'varying vec2 vP; uniform float uSize; void main(){ vP = (uv-0.5)*uSize; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform float uP; uniform vec3 uC; uniform int uShape; uniform float uR; uniform float uR0; uniform float uA; uniform float uL; uniform float uW; uniform float uT; varying vec2 vP;
        void main(){ vec2 p = vec2(vP.x, -vP.y); float inside = 0.0; float edge = 0.0; float fillT = 0.0;
          if (uShape==0) { float d = length(p); inside = step(d, uR); edge = smoothstep(uR-0.12, uR, d)*inside; fillT = d/uR; }
          else if (uShape==1) { float d = length(p); float a = abs(atan(p.x, p.y)); inside = step(d, uR)*step(a, uA); edge = max(smoothstep(uR-0.12,uR,d), smoothstep(uA-0.05, uA, a))*inside; fillT = d/uR; }
          else if (uShape==2) { inside = step(0.0, p.y)*step(p.y, uL)*step(abs(p.x), uW); edge = max(smoothstep(uW-0.1,uW,abs(p.x)), smoothstep(uL-0.12, uL, p.y))*inside; fillT = p.y/uL; }
          else { float d = length(p); inside = step(d, uR)*step(uR0, d); edge = max(smoothstep(uR-0.12,uR,d), 1.0-smoothstep(uR0, uR0+0.12, d))*inside; fillT = (d-uR0)/(uR-uR0); }
          if (inside < 0.5) discard;
          float fill = step(fillT, uP); float pulse = 0.5+0.5*sin(uT*14.0);
          float a = 0.16 + edge*0.75 + fill*0.32 + pulse*0.05;
          gl_FragColor = vec4(uC*(1.0+edge*0.8+fill*0.4), a); }` });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat); m.rotation.x = -Math.PI / 2; m.rotation.z = o.rot || 0; m.position.set(x, (o.y || 0) + 0.07, z); m.renderOrder = 3; this.root.add(m);
    const h = { m, mat, dead: false, prog: (p) => { mat.uniforms.uP.value = clamp(p, 0, 1); }, done: () => { if (h.dead) return; h.dead = true; this.root.remove(m); m.geometry.dispose(); mat.dispose(); } };
    this.tele.push(h); return h;
  }
  // weapon trail ribbon; call trail.push(baseWorld, tipWorld) each frame while active
  trail(color, len = 10) {
    const geo = new THREE.BufferGeometry(); const pos = new Float32Array(len * 2 * 3); const al = new Float32Array(len * 2); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('alpha', new THREE.BufferAttribute(al, 1).setUsage(THREE.DynamicDrawUsage));
    const idx = []; for (let i = 0; i < len - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false, uniforms: { uC: { value: new THREE.Color(color) }, uK: { value: 1 } },
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA=alpha; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uC; uniform float uK; varying float vA; void main(){ gl_FragColor = vec4(uC*1.6, vA*uK); }' });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 6; this.root.add(mesh);
    const T = { mesh, mat, pts: [], len, active: false, color: mat.uniforms.uC.value,
      push(b, t) { T.pts.unshift([b.x, b.y, b.z, t.x, t.y, t.z]); if (T.pts.length > len) T.pts.pop(); },
      update(dt) { if (!T.active && T.pts.length) T.pts.pop(); const n = T.pts.length; for (let i = 0; i < len; i++) { const p = T.pts[Math.min(i, n - 1)] || [0, -99, 0, 0, -99, 0]; pos.set(p.slice(0, 3), i * 6); pos.set(p.slice(3), i * 6 + 3); const a = n ? Math.max(0, 1 - i / Math.max(2, n)) * 0.9 : 0; al[i * 2] = a * 0.15; al[i * 2 + 1] = a; } geo.attributes.position.needsUpdate = true; geo.attributes.alpha.needsUpdate = true; mesh.visible = n > 1; } };
    this.trails.push(T); return T;
  }
  update(dt, t) {
    this.add.update(dt); this.norm.update(dt);
    for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.t += dt; const k = r.t / r.life; if (k >= 1) { this.root.remove(r.m); r.m.material.dispose(); this.rings.splice(i, 1); continue; } const e = 1 - Math.pow(1 - k, 3); const s = (r.r0 + (r.r1 - r.r0) * e) * 2; r.m.scale.set(s, s, 1); r.m.material.opacity = r.op * (1 - k); }
    for (let i = this.tele.length - 1; i >= 0; i--) { const h = this.tele[i]; if (h.dead) { this.tele.splice(i, 1); continue; } h.mat.uniforms.uT.value = t; }
    for (const T of this.trails) T.update(dt);
  }
  clear() { for (const r of this.rings) this.root.remove(r.m); this.rings = []; for (const h of this.tele) h.done(); this.tele = []; this.add.life.fill(0); this.norm.life.fill(0); }
}
// pooled point lights: the N most relevant light sources near the camera target + transient flashes
export class LightPool {
  constructor(scene, n) { this.lights = []; this.flashes = []; this.set(scene, n); }
  set(scene, n) { for (const l of this.lights) scene.remove(l); this.lights = []; for (let i = 0; i < n; i++) { const l = new THREE.PointLight(0xffffff, 0, 8, 1.6); l.position.set(0, -50, 0); scene.add(l); this.lights.push(l); } }
  flash(x, y, z, color, intensity, dist, life) { this.flashes.push({ x, y, z, color, i: intensity, d: dist, t: life, life }); }
  update(dt, t, sources, cx, cz) {
    const L = this.lights; if (!L.length) return; const cand = [];
    for (let i = this.flashes.length - 1; i >= 0; i--) { const f = this.flashes[i]; f.t -= dt; if (f.t <= 0) { this.flashes.splice(i, 1); continue; } cand.push({ x: f.x, y: f.y, z: f.z, color: f.color, i: f.i * (f.t / f.life), d: f.d, score: -1e6 }); }
    for (const s of sources) { const d = (s.x - cx) ** 2 + (s.z - cz) ** 2; if (d > 400) continue; cand.push({ ...s, i: s.flicker ? s.i * (0.8 + 0.2 * Math.sin(t * 11 + s.x) * Math.sin(t * 7 + s.z)) : s.i, score: d }); }
    cand.sort((a, b) => a.score - b.score);
    for (let k = 0; k < L.length; k++) { const l = L[k], c = cand[k]; if (!c) { l.intensity = 0; continue; } l.position.set(c.x, c.y, c.z); l.color.set(c.color); l.distance = c.d; const fade = c.score < 0 ? 1 : clamp(1 - (Math.sqrt(c.score) - 12) / 8, 0, 1); l.intensity = c.i * fade; }
  }
}
// DOM damage numbers / floating text, projected from world space every frame
export class Floaters {
  constructor(el, camera) { this.el = el; this.cam = camera; this.pool = []; this.live = []; for (let i = 0; i < 48; i++) { const d = document.createElement('div'); d.className = 'fl'; el.appendChild(d); this.pool.push(d); } this.v = new THREE.Vector3(); }
  spawn(x, y, z, text, cls = '', o = {}) {
    let d = this.pool.pop(); if (!d) { const old = this.live.shift(); d = old.d; } d.className = 'fl ' + cls; d.textContent = text; d.style.opacity = '1';
    this.live.push({ d, x: x + (Math.random() - 0.5) * 0.5, y, z, t: 0, life: o.life ?? (cls.includes('crit') ? 1.1 : 0.85), vx: (Math.random() - 0.5) * 0.6, vy: o.vy ?? 1.6 });
  }
  update(dt, w, h) {
    for (let i = this.live.length - 1; i >= 0; i--) { const f = this.live[i]; f.t += dt; if (f.t >= f.life) { f.d.style.opacity = '0'; f.d.style.transform = 'translate(-999px,-999px)'; this.pool.push(f.d); this.live.splice(i, 1); continue; }
      const k = f.t / f.life; this.v.set(f.x + f.vx * f.t, f.y + f.vy * f.t - 0.9 * f.t * f.t, f.z).project(this.cam);
      const sx = (this.v.x * 0.5 + 0.5) * w, sy = (-this.v.y * 0.5 + 0.5) * h; const pop = k < 0.12 ? 0.6 + k / 0.12 * 0.65 : k < 0.25 ? 1.25 - (k - 0.12) / 0.13 * 0.25 : 1;
      f.d.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px) translate(-50%,-50%) scale(${pop.toFixed(3)})`; f.d.style.opacity = String(k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1); }
  }
  clear() { for (const f of this.live) { f.d.style.opacity = '0'; this.pool.push(f.d); } this.live = []; }
}
