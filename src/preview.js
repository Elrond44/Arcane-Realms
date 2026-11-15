// Small secondary renderer for menu previews: the equipped hero (paper doll) and the Trine Core (artifact screen).
// One shared WebGL context, mounted into whichever menu container is open; renders only while visible.
import * as THREE from 'three';
import { HeroModel } from './hero.js?v=1';
import { trineCore, animTrine } from './citadel.js?v=1';
import { tex } from './kit.js?v=1';
import { TAU } from './util.js?v=1';

export class Preview {
  constructor() {
    this.r = null; this.mode = null; this.el = null; this.t = 0; this.drag = 0; this.rotY = 0;
  }
  init() {
    if (this.r) return true;
    try { this.r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); } catch (e) { return false; }
    const r = this.r; r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15; r.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene(); this.cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    this.scene.add(new THREE.HemisphereLight(0xffe2c0, 0x2a1a10, 1.4)); const key = new THREE.DirectionalLight(0xffe0b0, 2.4); key.position.set(2, 4, 3); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fb0ff, 1.6); rim.position.set(-3, 2, -3); this.scene.add(rim); this.warm = new THREE.PointLight(0xffa040, 0, 6, 1.5); this.warm.position.set(0, 0.5, 1.5); this.scene.add(this.warm);
    // hero rig
    this.hero = new HeroModel(); this.heroRoot = new THREE.Group(); this.heroRoot.add(this.hero.group); this.scene.add(this.heroRoot);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.08, 32), new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.6, metalness: 0.4 })); ped.position.y = -0.04; this.heroRoot.add(ped);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.44, 0.5, 48), new THREE.MeshBasicMaterial({ color: 0xffb050, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.005; this.heroRoot.add(ring);
    // artifact rig
    this.artRoot = new THREE.Group(); this.core = trineCore(1, 0); this.artRoot.add(this.core); this.scene.add(this.artRoot);
    const n = 140; const pos = new Float32Array(n * 3); this.sp = []; for (let i = 0; i < n; i++) this.sp.push({ a: Math.random() * TAU, r: 1.6 + Math.random() * 1.6, y: (Math.random() - 0.5) * 2.4, s: 0.2 + Math.random() * 0.6, ph: Math.random() * TAU });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.sparks = new THREE.Points(geo, new THREE.PointsMaterial({ map: tex('spark'), color: 0xffc070, size: 0.16, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true })); this.artRoot.add(this.sparks);
    const r2 = r.domElement; r2.addEventListener('pointerdown', (e) => { this.dx = e.clientX; this.dragging = true; r2.setPointerCapture(e.pointerId); });
    r2.addEventListener('pointermove', (e) => { if (!this.dragging) return; this.rotY += (e.clientX - this.dx) * 0.012; this.dx = e.clientX; this.drag = 2; });
    r2.addEventListener('pointerup', () => { this.dragging = false; }); r2.style.touchAction = 'none';
    return true;
  }
  mount(el, mode, data = {}) {
    if (!this.init()) return; this.el = el; this.mode = mode; el.appendChild(this.r.domElement); this.resize();
    this.heroRoot.visible = mode === 'hero'; this.artRoot.visible = mode === 'artifact';
    if (mode === 'hero') { this.hero.setGear(data.gear || {}); this.cam.fov = 26; this.cam.position.set(0, 1.0, 3.6); this.cam.lookAt(0, 0.55, 0); this.warm.intensity = 2; }
    else { this.core.userData.level = data.level || 0; this.cam.fov = 34; this.cam.position.set(0, 0.4, 7.2); this.cam.lookAt(0, 0, 0); this.warm.intensity = 0; }
    this.cam.updateProjectionMatrix();
  }
  setGear(g) { if (this.hero) this.hero.setGear(g); }
  setLevel(l) { if (this.core) this.core.userData.level = l; }
  pulse() { if (!this.core) return; this.core.userData.pulse = 1; this.burst = 1; }
  unmount() { if (this.r && this.r.domElement.parentNode) this.r.domElement.parentNode.removeChild(this.r.domElement); this.el = null; this.mode = null; }
  resize() { if (!this.el) return; const w = this.el.clientWidth || 300, h = this.el.clientHeight || 250; this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
  update(dt) {
    if (!this.el || !this.mode) return; this.t += dt; const w = this.el.clientWidth, h = this.el.clientHeight; if (w && (w !== this.r.domElement.width / this.r.getPixelRatio() || h !== this.r.domElement.height / this.r.getPixelRatio())) this.resize();
    this.drag -= dt; if (this.drag <= 0) this.rotY += dt * 0.5;
    if (this.mode === 'hero') { this.heroRoot.rotation.y = this.rotY; this.hero.update(dt, { speed: 0 }); }
    else { const u = this.core.userData; u.pulse = Math.max(0, u.pulse - dt * 0.9); animTrine(this.core, this.t, 1.1); this.artRoot.rotation.y = this.rotY * 0.3;
      this.burst = Math.max(0, (this.burst || 0) - dt * 0.8); const a = this.sparks.geometry.attributes.position; const lv = Math.min(1, (u.level || 0) / 20);
      for (let i = 0; i < this.sp.length; i++) { const p = this.sp[i]; const ang = p.a + this.t * p.s * (0.6 + lv); const rr = p.r * (1 + this.burst * 1.8 * Math.sin(this.burst * Math.PI)); a.setXYZ(i, Math.cos(ang) * rr, p.y + Math.sin(this.t * 1.5 + p.ph) * 0.2, Math.sin(ang) * rr); }
      a.needsUpdate = true; this.sparks.material.opacity = 0.55 + 0.35 * lv + this.burst * 0.5; this.sparks.material.size = 0.14 + this.burst * 0.12; }
    this.r.render(this.scene, this.cam);
  }
}
