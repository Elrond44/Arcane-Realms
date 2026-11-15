// Arcane Realms boot: renderer, post-processing, quality presets, lighting, title screen, main loop.
import * as THREE from 'three';
import { EffectComposer } from '../vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/addons/postprocessing/OutputPass.js';
import { PRESETS, detectQuality, AdaptiveQuality } from './quality.js?v=1';
import { Audio } from './audio.js?v=1';
import { Game } from './game.js?v=1';
import { UI } from './ui.js?v=1';
import { Preview } from './preview.js?v=1';
import { load, newGame, wipe, freshState, save as writeSave } from './save.js?v=1';
import { damp } from './util.js?v=1';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false }); }
catch (e) { $('loadMsg').textContent = 'WebGL is not available on this device/browser.'; throw e; }
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x0a1416, 0.02); scene.background = new THREE.Color(0x05080a);
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.5, 160);
// lighting: hemisphere fill + a key light (moon / torchlight) that follows the hero so its shadow map stays tight
const hemi = new THREE.HemisphereLight(0x6a8aa8, 0x1a2414, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xa8c0ff, 1.6); sun.position.set(-8, 18, 6); scene.add(sun); scene.add(sun.target);
sun.shadow.camera.left = -16; sun.shadow.camera.right = 16; sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16; sun.shadow.camera.near = 1; sun.shadow.camera.far = 50; sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;

const audio = new Audio();
const game = new Game(scene, camera, audio, $('floats'));
const preview = new Preview();
// ---------------- quality ----------------
const detected = detectQuality(renderer); const adapt = new AdaptiveQuality();
if (window.AR_FORCE_QUALITY && PRESETS[window.AR_FORCE_QUALITY]) { detected.q = window.AR_FORCE_QUALITY; detected.why += ' (pinned by test harness)'; adapt.off = true; }
let composer = null, bloom = null, curQ = null, autoQ = detected.q;
function applyQuality(q) {
  const P = PRESETS[q]; curQ = q; const pr = Math.min(window.devicePixelRatio || 1, P.pr); renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = q !== 'low'; sun.castShadow = q !== 'low'; const ms = q === 'high' ? 2048 : 1024; if (sun.shadow.mapSize.x !== ms) { sun.shadow.mapSize.set(ms, ms); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  if (composer) { composer.dispose(); composer = null; }
  if (P.post && P.bloom > 0) { composer = new EffectComposer(renderer); composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight); composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), q === 'high' ? 0.85 : 0.7, 0.55, 0.82); composer.addPass(bloom); composer.addPass(new OutputPass()); }
  game.setQuality(q); audio.setLow(q === 'low');
  scene.traverse((o) => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; for (const x of m) x.needsUpdate = true; } });
}
function wantQuality(S) { return S.quality === 'auto' ? autoQ : S.quality; }
// ---------------- settings ----------------
let preSettings = null; // settings before a game is loaded (title screen)
function applySettings(S) { audio.setVolumes({ master: S.master, music: S.music, sfx: S.sfx, mute: S.mute }); const q = wantQuality(S); if (q !== curQ) applyQuality(q); }
const ui = new UI(game, audio, {
  preview,
  preSettings: () => preSettings,
  applySettings,
  qualityInfo: () => ({ cur: curQ, why: detected.why, gpu: detected.gpu }),
  wipe: () => { wipe(); try { localStorage.removeItem('arcane-realms-settings'); } catch (e) { /* */ } location.reload(); },
});
// ---------------- region lighting moods ----------------
game.on('region', (r) => {
  if (r.id === 'woodland') { hemi.color.set(0x6f94b0); hemi.groundColor.set(0x18261a); hemi.intensity = 0.95; sun.color.set(0xb0c8ff); sun.intensity = 1.5; renderer.toneMappingExposure = 1.12; }
  else { hemi.color.set(0xffc890); hemi.groundColor.set(0x2a1a10); hemi.intensity = 0.55; sun.color.set(0xffc890); sun.intensity = 0.7; renderer.toneMappingExposure = 1.15; }
});
// ---------------- resize ----------------
function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight, false); if (composer) { composer.setSize(innerWidth, innerHeight); } }
addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 200));
// ---------------- audio unlock on first gesture ----------------
const unlock = () => { audio.unlock(); }; addEventListener('pointerdown', unlock, { capture: true }); addEventListener('keydown', unlock, { capture: true });
// ---------------- title ----------------
let mode = 'boot'; let loaded = null; let titleT = 0;
function boot() {
  loaded = load(); preSettings = loaded.s ? loaded.s.settings : freshState().settings;
  applyQuality(wantQuality(preSettings)); applySettings(preSettings);
  game.loadRegion('citadel', null); // backdrop (no save yet: nothing persists)
  mode = 'title'; $('loadMsg').textContent = loaded.error && !loaded.s ? 'Your save could not be read (a copy was kept). Starting fresh is safe.' : loaded.from === 'backup' ? 'Main save was damaged — restored from backup.' : '';
  $('btnNew').classList.remove('hidden'); $('btnTitleSettings').classList.remove('hidden');
  if (loaded.s) { $('btnContinue').classList.remove('hidden'); $('btnContinue').textContent = `Continue · Level ${loaded.s.level}`; } else $('btnNew').classList.add('gold');
  audio.setMusic('menu'); audio.setAmbience('citadel');
}
function begin(s, fresh) {
  mode = 'play'; $('title').classList.add('hidden'); $('hud').classList.remove('hidden'); preSettings = s.settings;
  game.start(s); applySettings(s.settings); ui.objective(); ui.dots(); audio.play('portal');
  if (fresh) { setTimeout(() => ui.toast('Move with the joystick · step into the glowing portal'), 1800); setTimeout(() => ui.toast('Your attacks fire automatically near enemies'), 5200); }
  window.AR.started = true;
}
$('btnContinue').addEventListener('click', () => { audio.unlock(); begin(loaded.s, false); });
$('btnNew').addEventListener('click', () => { audio.unlock();
  if (loaded.s && !confirmNew) { confirmNew = true; $('btnNew').textContent = 'Tap again to overwrite save'; $('btnNew').classList.add('red'); return; }
  const s = newGame(); if (preSettings) s.settings = { ...s.settings, ...preSettings }; writeSave(s); begin(s, true); });
let confirmNew = false;
$('btnTitleSettings').addEventListener('click', () => { audio.unlock(); ui.open('settings'); });
// ---------------- persistence hooks ----------------
addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') game.saveNow(); });
addEventListener('pagehide', () => { if (mode === 'play') game.saveNow(); });
// ---------------- loop ----------------
let last = performance.now(); let slowAcc = 0;
function frame(now) {
  requestAnimationFrame(frame); const rawDt = Math.min(0.1, (now - last) / 1000); last = now;
  if (mode === 'title') { titleT += rawDt; const a = titleT * 0.08; camera.position.set(Math.sin(a) * 20, 15, -2 + Math.cos(a) * 20); camera.lookAt(0, 1.5, -2); if (game.world) game.world.anim(titleT); game.fx.update(rawDt, titleT); game.lights.update(rawDt, titleT, game.world ? game.world.lightSrc : [], 0, 0); }
  else if (mode === 'play') {
    game.update(rawDt); ui.update(rawDt);
    const H = game.hero; sun.position.set(H.x - 8, 18, H.z + 6); sun.target.position.set(H.x, 0, H.z);
    if (!adapt.off && game.s.settings.quality === 'auto') { const q = adapt.tick(rawDt, curQ); if (q) { autoQ = q; applyQuality(q); ui.toast('Graphics lowered to ' + q.toUpperCase() + ' for smoother play'); } }
  }
  if (ui.cur && mode !== 'play') preview.update(rawDt);
  if (composer) composer.render(); else renderer.render(scene, camera);
}
window.AR = { game, ui, audio, renderer, scene, camera, preview, detected, quality: () => curQ, mode: () => mode, begin: (fresh = true) => { const s = fresh ? newGame() : loaded.s; begin(s, fresh); } };
boot(); requestAnimationFrame(frame);
