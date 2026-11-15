// HUD + menus (DOM). Reads game state, sends intents back through game methods. Mobile-first, safe-area aware.
import { RARITIES, SLOTS, SLOT_NAMES, RESOURCES, RES_KEYS, ITEMS, ITEM_BY_ID, WEAPONS, SKILLS, SETS, PASSIVES, AFFIXES, STAT_NAMES, PCT_STATS, UPGRADES, upgCost, upgradeCost, ARTIFACT, QUESTS, QUEST_BY_ID, INDEX_MILESTONES, REGIONS, SOURCES, xpNeed, HERO } from './data.js?v=1';
import { tmpl, itemStats, itemPower, isEquipped, equippedItems, setCounts } from './items.js?v=1';
import { INV_CAP } from './save.js?v=1';
import { itemIcon, SVG } from './icons.js?v=1';
import { fmt, pct, esc, clamp } from './util.js?v=1';
import { PRESETS } from './quality.js?v=1';

const $ = (id) => document.getElementById(id);
const ico = (k) => `<b class="ico">${SVG[k] || ''}</b>`;
const STATN = { ...STAT_NAMES, atkPct: 'Damage', find: 'Gold & Essence Find', fire: 'Fire Damage', frost: 'Frost Damage' };
const fmtStat = (k, v) => (PCT_STATS.has(k) ? '+' + (v * 100).toFixed(v * 100 < 10 ? 1 : 0).replace(/\.0$/, '') + '%' : '+' + Math.round(v));
const costHTML = (c, have) => '<span class="cost">' + Object.keys(c).filter((k) => c[k] > 0).map((k) => `<span class="${(have[k] || 0) < c[k] ? 'no' : ''}">${ico(k)}${fmt(c[k])}</span>`).join('') + '</span>';
const ARMOR = ['helm', 'chest', 'gloves', 'boots'], JEWEL = ['ring', 'amulet'];
const SKILL_ICON = { whirl: 'sword', flurry: 'dash', cleave: 'anvil', lunge: 'dash', nova: 'star', volley: 'star' };

export class UI {
  constructor(game, audio, hooks) {
    this.g = game; this.audio = audio; this.hooks = hooks; this.cur = null; this.tab = null; this.filter = 'all'; this.sort = 'power'; this.idxFilter = 'all'; this.detailOpen = false;
    this.prev = {}; this.toastN = 0; this.fpsT = 0; this.fpsN = 0; this.revealQ = []; this.joy = { id: null, cx: 0, cy: 0 }; this.keys = {};
    for (const el of document.querySelectorAll('.ico[data-i]')) el.innerHTML = SVG[el.dataset.i] || '';
    for (const c of document.querySelectorAll('.act .cd circle')) { c.setAttribute('r', '10'); c.style.fill = 'none'; c.style.stroke = 'rgba(0,0,0,0.62)'; c.style.strokeWidth = '20'; c.style.strokeDasharray = '62.83'; c.style.strokeDashoffset = '62.83'; }
    this.bindInput(); this.bindHUD(); this.bindGame();
  }
  get s() { return this.g.s; }
  settings() { return this.g.s ? this.g.s.settings : this.hooks.preSettings(); }
  // ------------------------------------------------------------------ input
  bindInput() {
    const G = this.g, I = G.input, zone = $('joyZone'), joy = $('joy'), knob = $('joyKnob'); const R = 50;
    const setJoy = (dx, dy) => { const d = Math.hypot(dx, dy); const k = d > R ? R / d : 1; knob.style.transform = `translate(${dx * k}px,${dy * k}px)`; const m = Math.min(1, d / R); const n = d > 4 ? m / (d || 1) : 0; I.mx = dx * n; I.mz = dy * n; };
    zone.addEventListener('pointerdown', (e) => { if (this.joy.id != null) return; this.joy.id = e.pointerId; zone.setPointerCapture(e.pointerId); const zr = zone.getBoundingClientRect(); this.joy.cx = e.clientX; this.joy.cy = e.clientY;
      joy.style.left = (e.clientX - zr.left - 62) + 'px'; joy.style.bottom = (zr.bottom - e.clientY - 62) + 'px'; joy.classList.add('active'); setJoy(0, 0); e.preventDefault(); });
    zone.addEventListener('pointermove', (e) => { if (e.pointerId !== this.joy.id) return; setJoy(e.clientX - this.joy.cx, e.clientY - this.joy.cy); });
    const end = (e) => { if (e.pointerId !== this.joy.id) return; this.joy.id = null; joy.style.left = ''; joy.style.bottom = ''; joy.classList.remove('active'); knob.style.transform = ''; I.mx = 0; I.mz = 0; };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end); zone.addEventListener('lostpointercapture', end);
    const atk = $('btnAttack'); atk.addEventListener('pointerdown', (e) => { I.attack = true; atk.classList.add('on'); atk.setPointerCapture(e.pointerId); e.preventDefault(); });
    const atkUp = () => { I.attack = false; atk.classList.remove('on'); }; atk.addEventListener('pointerup', atkUp); atk.addEventListener('pointercancel', atkUp); atk.addEventListener('lostpointercapture', atkUp);
    const tapBtn = (id, f) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); f(); });
    tapBtn('btnSkill', () => { I.skill = true; }); tapBtn('btnDash', () => { I.dash = true; }); tapBtn('btnFlask', () => { I.flask = true; });
    $('btnInteract').addEventListener('click', () => { I.interact = true; });
    // keyboard (desktop)
    const km = () => { const k = this.keys; let x = 0, z = 0; if (k.KeyA || k.ArrowLeft) x--; if (k.KeyD || k.ArrowRight) x++; if (k.KeyW || k.ArrowUp) z--; if (k.KeyS || k.ArrowDown) z++; if (this.joy.id == null) { const d = Math.hypot(x, z) || 1; I.mx = x / d; I.mz = z / d; } };
    addEventListener('keydown', (e) => { if (e.repeat) return; const c = e.code; if (c === 'Escape') { this.back(); return; } if (this.cur || !G.playing) return; this.keys[c] = true; km();
      if (c === 'KeyJ' || c === 'Space') I.attack = true; if (c === 'KeyK') I.skill = true; if (c === 'KeyL' || c === 'ShiftLeft' || c === 'ShiftRight') I.dash = true; if (c === 'KeyQ') I.flask = true; if (c === 'KeyE' || c === 'Enter') I.interact = true;
      const m = { KeyI: 'inventory', KeyB: 'inventory', KeyX: 'index', KeyT: 'artifact', KeyC: 'stats', KeyU: 'upgrades', KeyM: 'map', KeyO: 'quests' }[c]; if (m) this.open(m); if (['Space', 'ArrowUp', 'ArrowDown'].includes(c)) e.preventDefault(); });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; km(); if (e.code === 'KeyJ' || e.code === 'Space') I.attack = false; });
    addEventListener('blur', () => { this.keys = {}; I.mx = I.mz = 0; I.attack = false; });
    addEventListener('popstate', () => { if (this.detailOpen) this.closeDetail(true); else if (this.cur) this.close(true); });
  }
  bindHUD() {
    for (const b of document.querySelectorAll('[data-open]')) b.addEventListener('click', () => this.open(b.dataset.open));
    $('heroPanel').addEventListener('click', () => this.open('stats')); $('btnSettings').addEventListener('click', () => this.open('settings'));
    $('chipGold').addEventListener('click', () => this.open('upgrades')); $('chipEss').addEventListener('click', () => this.open('inventory'));
    $('objective').addEventListener('click', () => this.open('quests'));
    $('menuClose').addEventListener('click', () => this.back(true)); $('menuBack').addEventListener('click', () => this.back());
    $('detail').addEventListener('click', (e) => { if (e.target.id === 'detail') this.back(); });
    $('btnRise').addEventListener('click', () => { $('death').classList.add('hidden'); this.g.respawn(); this.audio.play('portal'); });
    $('reveal').addEventListener('click', (e) => { if (e.target.closest('button')) return; this.nextReveal(); });
  }
  bindGame() {
    const G = this.g;
    G.on('toast', (t) => this.toast(t.text, t.kind));
    G.on('open', (m) => this.open(m));
    G.on('near', (o) => this.setNear(o));
    G.on('region', (r) => { this.zone(r.name, r.sub); this.setNear(null); });
    G.on('zone', (z) => this.zone(z, this.g.region === 'woodland' ? 'Enchanted Woodland' : ''));
    G.on('fade', (f) => $('fade').classList.toggle('on', f.out));
    G.on('boss', (b) => { this.boss = b; $('bossBar').classList.toggle('on', !!b); $('hud').classList.toggle('bossOn', !!b); if (b) { $('bossName').textContent = b.name; $('bossSub').textContent = b.sub; } });
    G.on('bossPhase', (t) => this.banner('PHASE TWO', t, ''));
    G.on('hurt', (k) => { const h = $('hurt'); h.classList.remove('on'); void h.offsetWidth; h.classList.add('on'); clearTimeout(this.hurtTO); this.hurtTO = setTimeout(() => h.classList.remove('on'), 90 + k * 400); });
    G.on('dead', () => setTimeout(() => { $('death').classList.remove('hidden'); this.closeAll(); }, 1300));
    G.on('loot', (d) => this.lootFeed(d.item, d.isNew));
    G.on('reveal', (d) => this.queueReveal(d));
    G.on('discover', (tid) => { const t = ITEM_BY_ID[tid]; if (t.r < 3) this.toast('New Index entry · ' + t.name, ''); this.dots(); });
    G.on('inv', () => { this.dots(); if (this.cur === 'inventory' && !this.detailOpen) this.render(); });
    G.on('res', (k) => { if (k) { const c = k === 'gold' ? 'chipGold' : k === 'essence' ? 'chipEss' : null; if (c) { const el = $(c); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } } this.dots(); });
    G.on('levelup', (l) => { this.banner('LEVEL UP', 'Level ' + l, 'Health restored · stats increased', 'lvl'); this.dots(); });
    G.on('quests', () => this.objective());
    G.on('questDone', (q) => { this.banner('QUEST COMPLETE', q.name, 'Rewards: ' + this.rewText(q.rew)); const o = $('objective'); o.classList.remove('pulse'); void o.offsetWidth; o.classList.add('pulse'); });
    G.on('cd', () => {});
    G.on('stats', () => { if (this.cur === 'stats') this.render(); });
  }
  rewText(r) { return Object.keys(r).map((k) => fmt(r[k]) + ' ' + RESOURCES[k].name).join(', '); }
  // ------------------------------------------------------------------ HUD frame update
  update(dt) {
    const G = this.g, s = G.s; if (!s) return; const H = G.hero, st = G.st;
    const hpK = clamp(H.hp / st.maxHp, 0, 1); if (hpK !== this.prev.hp) { $('hpFill').style.transform = `scaleX(${hpK})`; $('hpGhost').style.transform = `scaleX(${hpK})`; this.prev.hp = hpK; $('hurt').classList.toggle('low', hpK < 0.3 && H.alive); }
    const hpT = Math.ceil(H.hp) + ' / ' + st.maxHp; if (hpT !== this.prev.hpT) { $('hpText').textContent = hpT; this.prev.hpT = hpT; }
    const xpK = s.level >= HERO.maxLevel ? 1 : s.xp / xpNeed(s.level); if (xpK !== this.prev.xp) { $('xpFill').style.width = (xpK * 100).toFixed(1) + '%'; this.prev.xp = xpK; }
    if (s.level !== this.prev.lvl) { $('lvlNum').textContent = s.level; this.prev.lvl = s.level; }
    for (const k of RES_KEYS) { const v = fmt(s.res[k]); if (this.prev[k] !== v) { $(k).textContent = v; this.prev[k] = v; } }
    // skill / dash cooldown sweeps
    const sk = WEAPONS[st.cat].skill; if (sk !== this.prev.sk) { this.prev.sk = sk; $('skillName').textContent = SKILLS[sk].name; $('btnSkill').querySelector('.ico').innerHTML = SVG[SKILL_ICON[sk]]; }
    this.sweep('btnSkill', Math.max(0, H.skillCd) / (SKILLS[sk].cd * (1 - st.cdr)), H.skillCd); this.sweep('btnDash', Math.max(0, H.dashCd) / st.dashCd, 0);
    if (s.flasks !== this.prev.fl) { $('flaskN').textContent = s.flasks; $('btnFlask').classList.toggle('cool', s.flasks <= 0); this.prev.fl = s.flasks; }
    // buffs
    const bk = G.buffs.map((b) => b.id).join(','); const bl = $('buffs'); if (bk !== this.prev.bk) { this.prev.bk = bk; bl.innerHTML = G.buffs.map((b) => `<div class="buff" style="color:${b.color}" title="${b.name}">${b.glyph}<i></i></div>`).join(''); }
    G.buffs.forEach((b, i) => { const el = bl.children[i]; if (el) el.lastChild.style.height = (b.t / b.max * 100) + '%'; });
    // boss
    if (this.boss && this.boss.e) { const e = this.boss.e; const k = clamp(e.hp / e.maxHp, 0, 1); $('bossFill').style.transform = `scaleX(${k})`; $('bossGhost').style.transform = `scaleX(${k})`; $('bossPct').textContent = Math.ceil(k * 100) + '%'; }
    // interact prompt freshness
    if (this.near) { this.nearT = (this.nearT || 0) - dt; if (this.nearT <= 0) { this.nearT = 0.25; this.setNear(this.near, true); } }
    // fps
    if (s.settings.fps) { this.fpsT += dt; this.fpsN++; if (this.fpsT > 0.5) { $('fps').textContent = Math.round(this.fpsN / this.fpsT) + ' fps · ' + G.quality; this.fpsT = 0; this.fpsN = 0; } } else if (this.prev.fps !== false) { $('fps').textContent = ''; }
    this.prev.fps = s.settings.fps;
    if (this.cur && this.hooks.preview) this.hooks.preview.update(dt);
  }
  sweep(id, k, secs) { const b = $(id); const c = b.querySelector('.cd circle'); const kk = clamp(k, 0, 1); const key = id + 'sw'; const q = Math.round(kk * 200); if (this.prev[key] === q) return; const was = this.prev[key]; this.prev[key] = q; c.style.strokeDashoffset = String(62.83 * (1 - kk)); b.classList.toggle('cool', kk > 0);
    if (id === 'btnSkill') $('skillTime').textContent = kk > 0 && secs > 0 ? Math.ceil(secs) : ''; if (was > 0 && q === 0) { b.classList.remove('ready'); void b.offsetWidth; b.classList.add('ready'); } }
  setNear(o, refresh = false) {
    this.near = o; const b = $('btnInteract'); if (!o) { b.classList.add('hidden'); return; }
    const r = this.g.objReady(o); const txt = r.ok ? o.label : r.why; if (refresh && txt === this.prev.near) return; this.prev.near = txt;
    $('interactLbl').textContent = txt; b.classList.toggle('no', !r.ok); b.classList.remove('hidden');
    if (!refresh) this.audio.play('tap', { vol: 0.4, rate: 1.4 });
  }
  objective() {
    const s = this.s; if (!s) return; const q = s.tracked && QUEST_BY_ID[s.tracked]; const o = $('objective'); if (!q) { o.classList.add('hidden'); return; } o.classList.remove('hidden');
    const e = s.quests[q.id] || { p: 0 }; $('objType').textContent = (q.type === 'main' ? 'MAIN QUEST' : q.type.toUpperCase()) + (q.n > 1 ? ` · ${Math.min(e.p, q.n)}/${q.n}` : '');
    $('objName').textContent = q.name; $('objDesc').textContent = q.desc; $('objFill').style.width = (Math.min(1, e.p / q.n) * 100) + '%';
  }
  dots() {
    const s = this.s; if (!s) return; const unseen = s.inv.filter((it) => it.seen === false).length; const d = $('dotInv'); d.textContent = unseen; d.classList.toggle('on', unseen > 0);
    const idx = Object.keys(s.index).length; const ms = INDEX_MILESTONES.filter((m) => idx >= m.n && !s.indexMs.includes(m.n)).length; const di = $('dotIdx'); di.textContent = ms ? '!' : ''; di.classList.toggle('on', ms > 0);
    const ac = ARTIFACT.cost(s.artifact); const da = $('dotArt'); const can = s.artifact < ARTIFACT.max && this.g.canAfford(ac); da.textContent = can ? '▲' : ''; da.classList.toggle('on', can); da.classList.toggle('up', can);
    const du = $('dotUp'); const cu = UPGRADES.some((u) => s.upgrades[u.key] < u.max && this.g.canAfford(upgCost(u, s.upgrades[u.key]))); du.textContent = cu ? '▲' : ''; du.classList.toggle('on', cu); du.classList.toggle('up', cu);
  }
  toast(text, kind = '') { const box = $('toasts'); const d = document.createElement('div'); d.className = 'toast ' + kind; d.textContent = text; box.appendChild(d); while (box.children.length > 3) box.firstChild.remove(); setTimeout(() => d.remove(), 2900); }
  zone(name, sub) { const z = $('zone'); z.innerHTML = esc(name) + (sub ? `<small>${esc(sub)}</small>` : ''); z.classList.remove('show'); void z.offsetWidth; z.classList.add('show'); }
  banner(small, big, sub, cls = '') { const b = $('banner'); b.className = cls; b.innerHTML = `<div class="bx"><small>${esc(small)}</small><b>${esc(big)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`; clearTimeout(this.banTO); this.banTO = setTimeout(() => b.classList.add('hidden'), 2900); }
  lootFeed(it, isNew) { const t = tmpl(it); const f = $('lootFeed'); const d = document.createElement('div'); d.className = 'loot'; d.style.borderColor = RARITIES[t.r].color;
    d.innerHTML = `<img src="${itemIcon(t.id)}" alt=""><div><span class="c${t.r}">${esc(t.name)}</span><small>${RARITIES[t.r].name} ${SLOT_NAMES[t.slot]}${isNew ? ' · NEW' : ''}</small></div>`; f.prepend(d); while (f.children.length > 4) f.lastChild.remove(); setTimeout(() => d.remove(), 3500); }
  queueReveal(d) { this.revealQ.push(d); if (this.revealQ.length === 1) this.showReveal(); }
  showReveal() {
    const d = this.revealQ[0]; if (!d) return; const el = $('reveal'), c = $('revealCard'); el.classList.remove('hidden'); this.g.paused = true;
    if (d.item) { const it = d.item, t = tmpl(it), R = RARITIES[t.r]; c.style.borderColor = R.color; c.style.boxShadow = `0 0 50px ${R.color}66`;
      const better = !isEquipped(this.s, it) && this.compareTo(it) > 0;
      c.innerHTML = `<small class="c${t.r}">${R.name.toUpperCase()} ${d.isNew ? '· NEW DISCOVERY' : 'DROP'}</small><div class="rimg r${t.r}"><img src="${itemIcon(t.id)}" alt=""></div><h3 class="c${t.r}">${esc(t.name)}</h3><p>${SLOT_NAMES[t.slot]}${t.cat ? ' · ' + WEAPONS[t.cat].name : ''} · Item level ${it.l} · Power ${itemPower(it)}${better ? ' <b style="color:#6aff9a">▲ upgrade</b>' : ''}</p>
        <div class="btnrow">${isEquipped(this.s, it) ? '<button class="btn gold" data-a="ok">Equipped!</button>' : `<button class="btn" data-a="ok">Keep</button><button class="btn gold" data-a="eq">Equip</button>`}</div>`;
      const eq = c.querySelector('[data-a=eq]'); if (eq) eq.onclick = () => { this.g.equip(it); this.nextReveal(); }; c.querySelector('[data-a=ok]').onclick = () => this.nextReveal(); }
    else { c.style.borderColor = d.color; c.style.boxShadow = `0 0 50px ${d.color}66`; c.innerHTML = `<small style="color:${d.color}">${d.big ? 'VICTORY' : 'REVELATION'}</small><div class="rimg" style="border-color:${d.color}"><span class="rglyph" style="color:${d.color}">${d.glyph}</span></div><h3 style="color:${d.color}">${esc(d.title)}</h3><p>${esc(d.text)}</p><div class="btnrow"><button class="btn gold" data-a="ok">Continue</button></div>`;
      c.querySelector('[data-a=ok]').onclick = () => this.nextReveal(); }
    this.audio.play('open', { rate: 1.1 });
  }
  nextReveal() { this.revealQ.shift(); if (this.revealQ.length) this.showReveal(); else { $('reveal').classList.add('hidden'); if (!this.cur && this.g.playing) this.g.paused = false; } }
  // ------------------------------------------------------------------ menus
  open(name, sub) {
    if (!this.g.playing && name !== 'settings') return; if (this.revealQ.length) return;
    const was = this.cur; this.cur = name; this.tab = sub || null; if (!was) { history.pushState({ m: 1 }, ''); this.audio.play('open'); } else this.audio.play('tap');
    $('menu').classList.remove('hidden'); this.g.paused = true; this.g.input.attack = false; this.render(); this.hooks.onMenu && this.hooks.onMenu(true);
  }
  close(fromPop = false) {
    if (!this.cur) return; if (this.cur === 'inventory' && this.s) for (const it of this.s.inv) it.seen = true;
    this.cur = null; $('menu').classList.add('hidden'); this.hooks.preview && this.hooks.preview.unmount(); if (this.g.playing && !this.revealQ.length) this.g.paused = false;
    this.audio.play('close'); if (!fromPop && history.state) { if (history.state.d) history.go(-2); else if (history.state.m) history.back(); } this.dots(); this.hooks.onMenu && this.hooks.onMenu(false); if (this.s) this.g.markDirty();
  }
  closeAll() { this.back(true); }
  back(all = false) { if (this.detailOpen) { if (!all) { this.closeDetail(); return; } this.closeDetail(true); } if (this.cur) this.close(); }
  detail(html, after) { const d = $('detail'), c = $('detailCard'); c.innerHTML = html; d.classList.remove('hidden'); if (!this.detailOpen) { history.pushState({ d: 1 }, ''); this.audio.play('tap'); } this.detailOpen = true; if (after) after(c); }
  closeDetail(fromPop = false) { if (!this.detailOpen) return; this.detailOpen = false; $('detail').classList.add('hidden'); if (!fromPop && history.state && history.state.d) history.back(); }
  render() {
    const n = this.cur; if (!n) return; const T = { inventory: 'Equipment', index: 'Item Index', artifact: 'The Trine Core', upgrades: 'Forge Upgrades', stats: 'Hero', quests: 'Quests', map: 'World Map', settings: 'Settings' };
    $('menuTitle').textContent = T[n]; const s = this.s;
    this.wallet();
    $('menuTabs').innerHTML = ''; $('menuBack').classList.remove('on');
    const body = $('menuBody'); const keepScroll = this.lastRender === n ? body.scrollTop : 0; this.lastRender = n;
    if (n !== 'inventory' && n !== 'artifact') this.hooks.preview && this.hooks.preview.unmount();
    this['r_' + n](body); body.scrollTop = keepScroll;
  }
  wallet() { const s = this.s, n = this.cur; $('menuWallet').innerHTML = s ? (n === 'artifact' ? ['relics', 'essence', 'crystals'] : n === 'upgrades' ? ['gold', 'crystals'] : n === 'inventory' ? ['gold', 'essence', 'crystals'] : []).map((k) => `<span class="mini">${ico(k)}<em>${fmt(s.res[k])}</em></span>`).join('') : ''; }
  tabs(list, cur, f) { const el = $('menuTabs'); el.innerHTML = list.map(([k, l]) => `<button class="tab ${k === cur ? 'on' : ''}" data-k="${k}">${l}</button>`).join(''); for (const b of el.children) b.onclick = () => { this.audio.play('tap'); f(b.dataset.k); }; }
  // ---------- inventory / equipment
  equippedIn(slot) { const id = this.s.equip[slot]; return id ? this.s.inv.find((x) => x.id === id) : null; }
  compareTo(it) { const t = tmpl(it); const cur = this.equippedIn(t.slot); if (!cur) return 1; if (cur === it) return 0; return itemPower(it) - itemPower(cur); }
  slotHTML(slot) { const it = this.equippedIn(slot); if (!it) return `<button class="slot" data-slot="${slot}"><span class="ph">${SLOT_NAMES[slot]}</span></button>`; const t = tmpl(it);
    return `<button class="slot r${t.r}" data-slot="${slot}"><img src="${itemIcon(t.id)}" alt="${esc(t.name)}">${it.up ? `<span class="up">+${it.up}</span>` : ''}<span class="lv">${it.l}</span></button>`; }
  cellHTML(it) { const t = tmpl(it); const eq = isEquipped(this.s, it); const c = eq ? 0 : this.compareTo(it);
    return `<button class="cell r${t.r} bg${t.r}" data-id="${it.id}"><img src="${itemIcon(t.id)}" alt="${esc(t.name)}">${it.up ? `<span class="up">+${it.up}</span>` : ''}${eq ? '<span class="eq">E</span>' : ''}${it.seen === false ? '<span class="new"></span>' : ''}${!eq && c > 0 && t.req <= this.s.level ? '<span class="cmp u">▲</span>' : !eq && c < 0 ? '<span class="cmp d">▼</span>' : ''}${it.lock ? '<span class="lk">🔒︎</span>' : ''}</button>`; }
  r_inventory(body) {
    const s = this.s, st = this.g.st, P = this.hooks.preview;
    const items = this.sortedInv();
    const F = [['all', 'All'], ['weapon', 'Weapons'], ['armor', 'Armor'], ['jewel', 'Jewelry'], ['artifact', 'Prisms']];
    const curF = F.find((f) => f[0] === this.filter) ? this.filter : 'all';
    const pw = equippedItems(s).reduce((a, it) => a + itemPower(it), 0);
    body.innerHTML = `<div class="doll"><div class="dcol">${['weapon', 'helm', 'chest', 'gloves'].map((k) => this.slotHTML(k)).join('')}</div>
      <div class="pv" id="pv"><div class="pstat">Gear Power <b>${fmt(pw)}</b></div></div><div class="dcol">${['boots', 'ring', 'amulet', 'artifact'].map((k) => this.slotHTML(k)).join('')}</div></div>
      <div class="statline"><div><b>${fmt(st.attack)}</b>Attack</div><div><b>${fmt(st.dps)}</b>DPS</div><div><b>${fmt(st.maxHp)}</b>Health</div><div><b>${Math.round(st.def)}</b>Defense</div></div>
      ${this.setsHTML()}
      <div class="invhead"><div class="sec" style="margin:0">INVENTORY <em>&nbsp;${s.inv.length} / ${INV_CAP}</em></div><button class="btn sm" id="bulk">${ico('essence')} Salvage…</button></div>
      <div class="filters">${F.map(([k, l]) => `<button class="fchip ${k === curF ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}${SLOTS.includes(this.filter) ? `<button class="fchip on" data-f="${this.filter}">${SLOT_NAMES[this.filter]} ✕</button>` : ''}
      <select class="fsel" id="sortSel">${[['power', 'Power'], ['rarity', 'Rarity'], ['level', 'Item level'], ['new', 'Newest'], ['slot', 'Slot']].map(([k, l]) => `<option value="${k}" ${k === this.sort ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="grid" id="invGrid">${items.map((it) => this.cellHTML(it)).join('')}${Array.from({ length: Math.max(0, 15 - items.length) }, () => '<div class="cell empty"></div>').join('')}</div>`;
    for (const b of body.querySelectorAll('.slot')) b.onclick = () => { const it = this.equippedIn(b.dataset.slot); if (it) this.itemDetail(it); else { this.filter = b.dataset.slot; this.audio.play('tap'); this.render(); } };
    for (const b of body.querySelectorAll('.fchip')) b.onclick = () => { this.filter = b.dataset.f === this.filter && SLOTS.includes(b.dataset.f) ? 'all' : b.dataset.f; this.audio.play('tap'); this.render(); };
    body.querySelector('#sortSel').onchange = (e) => { this.sort = e.target.value; this.render(); };
    for (const b of body.querySelectorAll('.cell[data-id]')) b.onclick = () => { const it = s.inv.find((x) => x.id === b.dataset.id); if (it) { it.seen = true; this.itemDetail(it); } };
    body.querySelector('#bulk').onclick = () => this.bulkSalvage();
    if (P) P.mount(body.querySelector('#pv'), 'hero', { gear: this.g.gearLook() });
  }
  setsHTML() { const sc = setCounts(equippedItems(this.s)); const keys = Object.keys(sc); if (!keys.length) return ''; return '<div style="margin-top:6px">' + keys.map((k) => { const S = SETS[k]; return `<div class="srow set">${esc(S.name)} ${sc[k]}/${S.pieces.length} · ${S.bonus.map(([n, d]) => `<span style="opacity:${sc[k] >= n ? 1 : 0.45}">(${n}) ${esc(d)}</span>`).join(' ')}</div>`; }).join('') + '</div>'; }
  sortedInv() { const s = this.s; const f = this.filter; let a = s.inv.filter((it) => { const sl = tmpl(it).slot; return f === 'all' || f === sl || (f === 'armor' && ARMOR.includes(sl)) || (f === 'jewel' && JEWEL.includes(sl)); });
    const key = { power: (it) => -itemPower(it), rarity: (it) => -(tmpl(it).r * 1e6 + itemPower(it)), level: (it) => -(it.l * 1e6 + itemPower(it)), new: (it) => -(it.at || 0), slot: (it) => SLOTS.indexOf(tmpl(it).slot) * 1e6 - itemPower(it) }[this.sort];
    a.sort((x, y) => (isEquipped(s, y) - isEquipped(s, x)) || key(x) - key(y)); return a; }
  itemDetail(it) {
    const s = this.s, g = this.g, t = tmpl(it), R = RARITIES[t.r]; const eq = isEquipped(s, it); const cur = this.equippedIn(t.slot); const cmp = !eq && cur ? itemStats(cur) : null; const mine = itemStats(it);
    const baseKeys = Object.keys(t.base); const keys = [...new Set([...baseKeys, ...(cmp ? Object.keys(cmp) : [])])];
    const row = (k, v, cls = '') => { let d = ''; if (cmp) { const dv = (v || 0) - (cmp[k] || 0); if (Math.abs(dv) > 1e-4) d = `<span class="d ${dv > 0 ? 'u' : 'n'}">${dv > 0 ? '▲' : '▼'} ${PCT_STATS.has(k) ? (Math.abs(dv) * 100).toFixed(1).replace(/\.0$/, '') + '%' : Math.round(Math.abs(dv))}</span>`; }
      return `<div class="srow ${cls}"><span>${STATN[k] || k}</span><span><b>${v ? fmtStat(k, v) : '—'}</b>${d}</span></div>`; };
    const affK = it.aff.map((a) => a.k).filter((k) => !baseKeys.includes(k));
    let html = `<div class="ihead bg${t.r}"><div class="big r${t.r}"><img src="${itemIcon(t.id)}" alt=""></div><div><h3 class="c${t.r}">${esc(t.name)}${it.up ? ' +' + it.up : ''}</h3><p>${R.name} ${SLOT_NAMES[t.slot]}${t.cat ? ' · ' + WEAPONS[t.cat].name : ''} · iLvl ${it.l}</p><p>Power <b style="color:var(--gold2)">${itemPower(it)}</b>${cur && !eq ? ` · equipped ${itemPower(cur)}` : ''}${eq ? ' · <span style="color:var(--emerald)">Equipped</span>' : ''}</p>${t.req > s.level ? `<p style="color:#ff7a7a">Requires level ${t.req}</p>` : ''}</div></div>`;
    html += '<div class="stats">' + keys.filter((k) => !affK.includes(k) || baseKeys.includes(k)).map((k) => row(k, mine[k])).join('') + affK.map((k) => row(k, mine[k], 'aff')).join('');
    if (cmp) for (const k of Object.keys(cmp)) if (!keys.includes(k) && !affK.includes(k)) html += row(k, 0);
    if (t.cat) html += `<div class="srow pas">${esc(WEAPONS[t.cat].desc)} Skill: <b>${SKILLS[WEAPONS[t.cat].skill].name}</b> — ${esc(SKILLS[WEAPONS[t.cat].skill].desc)}</div>`;
    if (t.passive) html += `<div class="srow pas">★ ${esc(PASSIVES[t.passive])}</div>`;
    if (t.set) { const S = SETS[t.set]; const n = setCounts(equippedItems(s))[t.set] || 0; html += `<div class="srow set">${esc(S.name)} set (${n}/${S.pieces.length})</div>` + S.bonus.map(([k, d]) => `<div class="srow set ${n >= k ? '' : 'off'}">(${k}) ${esc(d)}</div>`).join(''); }
    html += `</div><div class="desc">“${esc(t.desc)}”</div>`;
    const maxed = it.up >= R.maxUp; const uc = upgradeCost(t.r, it.up);
    html += `<div class="btnrow">${eq ? (t.slot === 'weapon' ? '<button class="btn off" disabled>Equipped</button>' : '<button class="btn" data-a="uneq">Unequip</button>') : `<button class="btn gold ${t.req > s.level ? 'off' : ''}" data-a="eq">Equip</button>`}
      <button class="btn purple ${maxed || !g.canAfford(uc) ? 'off' : ''}" data-a="up">${maxed ? 'Max level' : 'Upgrade +' + (it.up + 1)}<small>${maxed ? R.maxUp + '/' + R.maxUp : costHTML(uc, s.res)}</small></button></div>
      <div class="btnrow"><button class="btn sm" data-a="lock">${it.lock ? 'Unlock' : 'Lock'}</button><button class="btn sm red ${eq || it.lock ? 'off' : ''}" data-a="salv">Salvage<small>+${g.salvageValue(it)} essence</small></button><button class="btn sm ghost" data-a="x">Close</button></div>`;
    this.detail(html, (c) => {
      const on = (a, f) => { const b = c.querySelector(`[data-a=${a}]`); if (b) b.onclick = f; };
      on('eq', () => { if (g.equip(it)) { this.closeDetail(); this.render(); } });
      on('uneq', () => { if (g.unequip(t.slot)) { this.closeDetail(); this.render(); } });
      on('up', () => { if (maxed) return; if (g.upgradeItem(it)) { this.toast(t.name + ' upgraded to +' + it.up, 'buff'); this.itemDetail(it); this.render(); } else this.toast('Not enough resources', 'warn'); });
      on('lock', () => { it.lock = !it.lock; g.markDirty(); this.itemDetail(it); this.render(); });
      on('salv', () => { if (eq || it.lock) { this.audio.play('denied'); this.toast(eq ? 'Unequip it first' : 'Item is locked', 'warn'); return; } const v = g.salvage(it); if (v) { this.toast('Salvaged for ' + v + ' essence'); this.closeDetail(); this.render(); } });
      on('x', () => this.closeDetail());
    });
  }
  bulkSalvage() {
    const s = this.s, g = this.g; const calc = (maxR) => { let n = 0, v = 0; for (const it of s.inv) if (!isEquipped(s, it) && !it.lock && tmpl(it).r <= maxR) { n++; v += g.salvageValue(it); } return { n, v }; };
    const opts = [0, 1, 2].map((r) => ({ r, ...calc(r) }));
    this.detail(`<div class="sec">BULK SALVAGE</div><p class="desc" style="font-style:normal">Breaks down unequipped, unlocked items into Essence. Lock anything you want to keep.</p>
      <div class="btnrow" style="flex-direction:column">${opts.map((o) => `<button class="btn ${o.n ? '' : 'off'}" data-r="${o.r}">Up to ${RARITIES[o.r].name} · ${o.n} item${o.n === 1 ? '' : 's'}<small>+${o.v} essence</small></button>`).join('')}<button class="btn ghost sm" data-r="x">Cancel</button></div>`, (c) => {
      for (const b of c.querySelectorAll('[data-r]')) b.onclick = () => { if (b.dataset.r === 'x') return this.closeDetail(); const r = g.salvageBulk(+b.dataset.r); if (r.n) this.toast(`Salvaged ${r.n} items · +${r.tot} essence`); this.closeDetail(); this.render(); };
    });
  }
  // ---------- index
  r_index(body) {
    const s = this.s, g = this.g; const found = Object.keys(s.index).length, total = ITEMS.length;
    const F = [['all', 'All'], ...SLOTS.map((k) => [k, SLOT_NAMES[k]])];
    const list = ITEMS.filter((t) => this.idxFilter === 'all' || t.slot === this.idxFilter).slice().sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || a.r - b.r);
    body.innerHTML = `<div class="sec">COLLECTION <em>${found} / ${total} · ${Math.round(found / total * 100)}%</em></div><div class="prog"><i style="width:${found / total * 100}%"></i></div>
      <div class="ms">${INDEX_MILESTONES.map((m) => { const done = s.indexMs.includes(m.n), ok = found >= m.n && !done; return `<div class="msc ${done ? 'done' : ok ? 'ok' : ''}"><b>${m.n}</b>${done ? 'Claimed ✓' : this.rewShort(m.rew)}${ok ? `<br><button class="btn gold" data-ms="${m.n}">Claim</button>` : ''}</div>`; }).join('')}</div>
      <div class="filters">${F.map(([k, l]) => `<button class="fchip ${k === this.idxFilter ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
      <div class="grid">${list.map((t) => { const d = s.index[t.id]; return d ? `<button class="cell r${t.r} bg${t.r}" data-t="${t.id}"><img src="${itemIcon(t.id)}" alt="${esc(t.name)}"></button>` : `<button class="cell sil" data-t="${t.id}" style="border-color:${RARITIES[t.r].color}44"><img src="${itemIcon(t.id, true)}" alt="Undiscovered"></button>`; }).join('')}</div>
      <p class="desc" style="text-align:center">First discoveries grant Gold and Essence. Sets: ${Object.values(SETS).map((x) => esc(x.name)).join(', ')}.</p>`;
    for (const b of body.querySelectorAll('[data-ms]')) b.onclick = () => { if (g.claimMilestone(+b.dataset.ms)) { this.toast('Milestone reward claimed', 'buff'); this.render(); this.dots(); } };
    for (const b of body.querySelectorAll('.fchip')) b.onclick = () => { this.idxFilter = b.dataset.f; this.audio.play('tap'); this.render(); };
    for (const b of body.querySelectorAll('[data-t]')) b.onclick = () => this.indexDetail(ITEM_BY_ID[b.dataset.t]);
  }
  rewShort(r) { return Object.keys(r).map((k) => `<span style="color:${RESOURCES[k].color}">${fmt(r[k])}</span>${ico(k)}`).join(' '); }
  indexDetail(t) {
    const d = this.s.index[t.id]; const R = RARITIES[t.r]; const src = t.drop.map((k) => SOURCES[k]).join(' · ');
    const rr = t.r; const disc = { gold: 8 * (rr + 1) * (rr + 1), essence: 3 * (rr + 1) };
    let html = `<div class="ihead bg${d ? t.r : 0}"><div class="big ${d ? 'r' + t.r : ''}" style="${d ? '' : 'border-color:#4a3a28'}"><img src="${itemIcon(t.id, !d)}" alt=""></div><div><h3 class="${d ? 'c' + t.r : ''}">${d ? esc(t.name) : 'Undiscovered'}</h3><p><span class="c${t.r}">${R.name}</span> ${SLOT_NAMES[t.slot]}${t.cat ? ' · ' + WEAPONS[t.cat].name : ''}</p><p>${d ? `Found ×${d.n} · first on ${new Date(d.at).toLocaleDateString()}` : 'Not yet found'}</p></div></div><div class="stats">`;
    if (d) { for (const k in t.base) html += `<div class="srow"><span>${STATN[k]}</span><b>${fmtStat(k, t.base[k])} <small style="color:var(--dim)">(iLvl 1)</small></b></div>`; if (t.passive) html += `<div class="srow pas">★ ${esc(PASSIVES[t.passive])}</div>`; if (t.set) html += `<div class="srow set">Part of the ${esc(SETS[t.set].name)} set</div>`; html += `<div class="srow"><span>Random affixes</span><b>${R.affixes}</b></div><div class="srow"><span>Max upgrade</span><b>+${R.maxUp}</b></div>`; }
    html += `<div class="srow"><span>Sources</span><b style="text-align:right;max-width:65%">${esc(src)}</b></div><div class="srow"><span>Requires level</span><b>${t.req}</b></div>${d ? '' : `<div class="srow"><span>Discovery reward</span><b>${this.rewShort(disc)}</b></div>`}</div>`;
    html += d ? `<div class="desc">“${esc(t.desc)}”</div>` : `<div class="desc">A silhouette in the Curator's ledger. Seek it from: ${esc(src)}.</div>`;
    html += '<div class="btnrow"><button class="btn" data-a="x">Close</button></div>';
    this.detail(html, (c) => { c.querySelector('[data-a=x]').onclick = () => this.closeDetail(); });
  }
  // ---------- artifact
  r_artifact(body) {
    body.innerHTML = `<div class="art" id="artpv"><div class="alvl" id="alvl"></div><div class="flash" id="aflash"></div></div><div id="artInfo"></div>`;
    if (this.hooks.preview) this.hooks.preview.mount(body.querySelector('#artpv'), 'artifact', { level: this.s.artifact });
    this.artInfo();
  }
  artInfo(anim = false) {
    const s = this.s, g = this.g, st = g.st; const L = s.artifact; const max = L >= ARTIFACT.max; const amp = 1 + st.ampl;
    const cur = st.artMult, next = max ? cur : +(1 + (ARTIFACT.mult(L + 1) - 1) * amp).toFixed(2); const c = ARTIFACT.cost(L); const can = !max && g.canAfford(c);
    const resNow = 1 + (cur - 1) * ARTIFACT.resShare, resNext = 1 + (next - 1) * ARTIFACT.resShare;
    const nf = ARTIFACT.facets.find((f) => f.at > L); const pf = [...ARTIFACT.facets].reverse().find((f) => f.at <= L);
    $('alvl').textContent = `LEVEL ${L} / ${ARTIFACT.max}`;
    $('artInfo').innerHTML = `<div class="mult"><div><small>CURRENT</small><b id="mcur">×${cur.toFixed(2)}</b></div><span class="arr">➜</span><div class="nx"><small>NEXT</small><b>${max ? 'MAX' : '×' + next.toFixed(2)}</b></div></div>
      <div class="effects"><div>All damage<b>×${cur.toFixed(2)} <em>${max ? '' : '→ ×' + next.toFixed(2)}</em></b></div><div>Gold · Essence · Crystals<b>×${resNow.toFixed(2)} <em>${max ? '' : '→ ×' + resNext.toFixed(2)}</em></b></div>
      <div>Prism amplification<b>+${Math.round(st.ampl * 100)}%</b></div><div>${nf ? 'Next facet · Lv ' + nf.at : 'All facets awakened'}<b>${nf ? esc(nf.name) : '✓'}</b></div></div>
      ${nf ? `<div class="prog" style="margin:4px 0 8px"><i style="width:${(L - (pf ? pf.at : 0)) / (nf.at - (pf ? pf.at : 0)) * 100}%"></i></div>` : ''}
      ${max ? '' : `<div class="req">${Object.keys(c).filter((k) => c[k] > 0).map((k) => `<div class="${s.res[k] < c[k] ? 'no' : ''}">${ico(k)}${fmt(s.res[k])}<small>/ ${fmt(c[k])}</small></div>`).join('')}</div>`}
      <button class="btn gold" id="artUp" style="width:100%;font-size:17px;padding:14px" ${can ? '' : 'disabled'}>${max ? 'Fully Awakened' : can ? `Awaken · Level ${L + 1}` : 'Gather more resources'}</button>
      <p class="desc" style="text-align:center;font-style:normal">Relic Fragments drop from elites, ornate chests, the Moonwell quest and Gloomroot. Equip prisms in the Artifact slot to amplify the multiplier.</p>
      <div class="sec">FACETS</div><div class="facets">${ARTIFACT.facets.map((f) => `<div class="facet ${L >= f.at ? 'on' : ''}"><span class="lv">${f.at}</span><div><b>${esc(f.name)}</b><br>${esc(f.desc)}</div></div>`).join('')}</div>`;
    $('artUp').onclick = () => { if (!g.upgradeArtifact()) { this.toast('Not enough resources', 'warn'); return; } const P = this.hooks.preview; if (P) { P.setLevel(s.artifact); P.pulse(); }
      const fl = $('aflash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); this.wallet(); this.artInfo(); this.dots(); const m = $('mcur'); if (m) { m.classList.add('roll'); } this.banner('TRINE CORE', '×' + g.st.artMult.toFixed(2), 'Level ' + s.artifact + ' · damage and resources amplified'); };
    if (this.hooks.preview) this.hooks.preview.setLevel(L);
  }
  // ---------- upgrades (forge)
  r_upgrades(body) {
    const s = this.s, g = this.g; const tot = Object.values(s.upgrades).reduce((a, b) => a + b, 0);
    const eff = (u, l) => { if (u.key === 'precision') return `+${l}% crit · +${l * 4}% crit dmg`; if (u.key === 'arcana') return `+${l * 7}% ability · -${Math.min(40, l * 2)}% cd`; if (u.key === 'renewal') return `+${(l * 0.5).toFixed(1)}%/s regen`; return '+' + Math.round(l * u.per * 100) + '%'; };
    body.innerHTML = `<div class="sec">GENERAL UPGRADES <em>${tot} purchased</em></div>` + UPGRADES.map((u) => { const l = s.upgrades[u.key]; const max = l >= u.max; const c = upgCost(u, l); const can = !max && g.canAfford(c); const segs = 10; const on = Math.round(l / u.max * segs);
      return `<div class="ucard" data-k="${u.key}"><div class="ui">${SVG[u.icon]}</div><div class="um"><h4>${esc(u.name)}<em>Lv ${l}/${u.max}</em></h4><p>${esc(u.desc)} · <b style="color:var(--txt)">${eff(u, l)}</b>${max ? '' : ` → <b style="color:#8affb0">${eff(u, l + 1)}</b>`}</p><div class="pips">${Array.from({ length: segs }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</div></div>
        <button class="btn ${can ? 'gold' : 'off'}" data-buy="${u.key}">${max ? 'MAX' : 'Upgrade'}${max ? '' : `<small>${costHTML(c, s.res)}</small>`}</button></div>`; }).join('') +
      `<p class="desc" style="text-align:center;font-style:normal">Item upgrades (+1 … +15) are done from each item in Equipment. Crystals are mined from blue nodes in the woodland.</p>`;
    for (const b of body.querySelectorAll('[data-buy]')) b.onclick = () => { const k = b.dataset.buy; if (g.buyUpgrade(k)) { this.render(); const card = $('menuBody').querySelector(`.ucard[data-k=${k}]`); if (card) { card.classList.add('flash'); } } else { this.toast('Not enough resources', 'warn'); } };
  }
  // ---------- stats
  r_stats(body) {
    const s = this.s, st = this.g.st; const W = WEAPONS[st.cat]; const ss = s.stats; const tm = Math.floor(ss.playTime / 60);
    const kv = (rows) => '<div class="kv">' + rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('') + '</div>';
    const red = 1 - 60 / (60 + st.def);
    body.innerHTML = `<div class="ihead bg4"><div class="big r4" style="font-family:Cinzel;font-size:30px;color:var(--gold2)">${s.level}</div><div><h3 style="color:var(--gold2)">Warden of the Citadel</h3><p>Level ${s.level} · ${s.level >= HERO.maxLevel ? 'Max level' : fmt(s.xp) + ' / ' + fmt(xpNeed(s.level)) + ' XP'}</p><p>${W.name} · ${SKILLS[W.skill].name}</p></div></div>
      <div class="sec">OFFENSE</div>${kv([['Attack', fmt(st.attack)], ['Est. DPS', fmt(st.dps)], ['Weapon', W.name], ['Trine multiplier', '×' + st.artMult.toFixed(2)], ['Crit chance', pct(st.crit, 1)], ['Crit damage', pct(st.critMult)], ['Attack speed', pct(st.aspd)], ['Ability power', pct(st.ap)], ['Cooldown reduction', pct(st.cdr)], ['Elemental', '+' + Math.round(st.ele.fire + st.ele.frost)]])}
      <div class="sec">DEFENSE</div>${kv([['Max health', fmt(st.maxHp)], ['Defense', Math.round(st.def)], ['Damage reduction', pct(red, 1)], ['Elemental resist', pct(st.res)], ['Regen (out of combat)', pct(0.01 + st.regen, 1) + '/s'], ['Flasks', s.flasks + ' / ' + HERO.flasks]])}
      <div class="sec">UTILITY</div>${kv([['Move speed', (st.speed).toFixed(1)], ['Dash cooldown', st.dashCd.toFixed(1) + 's'], ['Resource gain', '×' + st.resMult.toFixed(2)], ['XP gain', pct(st.xpMult)], ['Loot luck', '+' + Math.round(st.find * 25) + '%'], ['Passives', st.passives.size || '—']])}
      ${st.passives.size ? '<div class="stats">' + [...st.passives].map((p) => `<div class="srow pas">★ ${esc(PASSIVES[p])}</div>`).join('') + '</div>' : ''}${this.setsHTML()}
      ${Object.keys(s.blessings).length ? `<div class="srow set">☾ Moonwell blessing: +5% max health, +5% damage</div>` : ''}
      <div class="sec">RECORDS</div>${kv([['Enemies slain', fmt(ss.kills)], ['Bosses slain', s.bossKills], ['Critical hits', fmt(ss.crits)], ['Best hit', fmt(ss.bestHit)], ['Damage dealt', fmt(ss.dmg)], ['Deaths', ss.deaths], ['Chests opened', ss.chests], ['Items found', ss.items], ['Index', Object.keys(s.index).length + ' / ' + ITEMS.length], ['Play time', Math.floor(tm / 60) + 'h ' + (tm % 60) + 'm']])}`;
  }
  // ---------- quests
  r_quests(body) {
    const s = this.s, g = this.g; const act = g.activeQuests(); const done = QUESTS.filter((q) => s.quests[q.id] && s.quests[q.id].claimed); const locked = QUESTS.filter((q) => !act.includes(q) && !done.includes(q));
    const card = (q, st) => { const e = s.quests[q.id] || { p: 0 }; const p = Math.min(e.p, q.n); return `<div class="qcard ${st === 'done' ? 'done' : ''} ${s.tracked === q.id ? 'tr' : ''}" data-q="${q.id}"><div class="qt"><h4>${esc(q.name)}</h4><span class="qtag ${q.type}">${q.type}</span></div><p>${esc(q.desc)}</p>${st === 'active' ? `<div class="prog" style="height:6px"><i style="width:${p / q.n * 100}%;background:var(--emerald)"></i></div>` : ''}<div class="qr" style="margin-top:5px"><span>${st === 'done' ? '✓ Completed' : st === 'locked' ? '🔒︎ Continue the main quest' : p + ' / ' + q.n}${s.tracked === q.id ? ' · <span style="color:var(--emerald)">Tracked</span>' : ''}</span><span>${this.rewShort(q.rew)}</span></div></div>`; };
    body.innerHTML = `<div class="sec">ACTIVE <em>tap to track</em></div>${act.map((q) => card(q, 'active')).join('') || '<p class="desc">All available quests complete. More await in the next release.</p>'}${locked.length ? '<div class="sec">LOCKED</div>' + locked.map((q) => card(q, 'locked')).join('') : ''}${done.length ? '<div class="sec">COMPLETED</div>' + done.map((q) => card(q, 'done')).join('') : ''}`;
    for (const c of body.querySelectorAll('.qcard')) c.onclick = () => { if (!act.find((q) => q.id === c.dataset.q)) return; s.tracked = c.dataset.q; this.objective(); this.audio.play('tap'); this.render(); };
  }
  // ---------- map
  r_map(body) {
    const g = this.g, s = this.s; const P = { citadel: [50, 80], woodland: [50, 52], caverns: [22, 30], catacombs: [78, 30], ashen: [28, 10], astral: [72, 9] };
    const lines = [['citadel', 'woodland'], ['woodland', 'caverns'], ['woodland', 'catacombs'], ['caverns', 'ashen'], ['catacombs', 'astral']];
    body.innerHTML = `<div class="wmap"><svg class="paths" viewBox="0 0 100 100" preserveAspectRatio="none">${lines.map(([a, b]) => { const A = REGIONS.find((r) => r.id === b); return `<line x1="${P[a][0]}" y1="${P[a][1]}" x2="${P[b][0]}" y2="${P[b][1]}" stroke="${A.open ? '#d4a84a' : '#5a4a36'}" stroke-width="0.6" stroke-dasharray="${A.open ? '0' : '1.5 1.5'}" vector-effect="non-scaling-stroke" style="stroke-width:2px"/>`; }).join('')}</svg>
      ${REGIONS.map((r) => { const here = g.region === r.id; return `<button class="node ${r.open ? '' : 'lock'} ${here ? 'here' : ''}" data-r="${r.id}" style="left:${P[r.id][0]}%;top:${P[r.id][1]}%;color:${r.color}"><div class="nd" style="border-color:${r.color}">${r.open ? (r.id === 'citadel' ? '♜' : '❦') : SVG.lock}</div><b>${esc(r.name)}</b><small>${here ? 'You are here' : esc(r.sub)}</small></button>`; }).join('')}</div>
      <p class="desc" style="text-align:center;font-style:normal">Travel between unlocked regions through the portal network. Sealed regions open in future chapters.</p>`;
    for (const b of body.querySelectorAll('.node')) b.onclick = () => { const r = REGIONS.find((x) => x.id === b.dataset.r); if (!r.open) { this.audio.play('denied'); this.toast(r.name + ' is sealed · ' + r.sub, 'warn'); return; } if (g.region === r.id) { this.toast('You are already here'); return; } if (g.bossE) { this.toast('Cannot travel during a boss fight', 'warn'); return; } this.close(); g.travel(r.id); };
  }
  // ---------- settings
  r_settings(body) {
    const S = this.settings(); const q = this.hooks.qualityInfo();
    const slider = (k, l) => `<div class="set"><span>${l}</span><input type="range" min="0" max="1" step="0.05" value="${S[k]}" data-s="${k}"></div>`;
    const tog = (k, l, sub) => `<div class="set"><span>${l}${sub ? `<small>${sub}</small>` : ''}</span><button class="tog ${S[k] ? 'on' : ''}" data-t="${k}" aria-label="${l}"></button></div>`;
    const seg = (k, opts, l, sub) => `<div class="set"><span>${l}${sub ? `<small>${sub}</small>` : ''}</span><div class="seg">${opts.map(([v, n]) => `<button class="${S[k] === v ? 'on' : ''}" data-g="${k}" data-v="${v}">${n}</button>`).join('')}</div></div>`;
    body.innerHTML = `<div class="sec">AUDIO</div>${slider('master', 'Master volume')}${slider('music', 'Music')}${slider('sfx', 'Sound effects')}${tog('mute', 'Mute all')}
      <div class="sec">GRAPHICS</div>${seg('quality', [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Med'], ['high', 'High']], 'Quality', S.quality === 'auto' ? 'Auto picked ' + q.cur.toUpperCase() + (q.why ? ' · ' + esc(q.why) : '') : esc(PRESETS[S.quality].label))}
      ${seg('shake', [['full', 'Full'], ['reduced', 'Low'], ['off', 'Off']], 'Screen shake')}${tog('fps', 'Show FPS counter')}
      <div class="sec">GAMEPLAY</div>${tog('autoAttack', 'Auto-attack', 'Attack nearby enemies when standing still')}${tog('dmgNums', 'Damage numbers')}
      <div class="sec">SAVE DATA</div><div class="set"><span>Progress saves automatically<small id="saveInfo">${this.s ? 'Last saved ' + new Date(this.s.savedAt || Date.now()).toLocaleTimeString() : 'No game in progress'}</small></span>${this.s ? '<button class="btn sm" id="saveNow">Save now</button>' : ''}</div>
      <div class="set"><span>Reset all progress<small>Deletes your save on this device</small></span><button class="btn sm red" id="wipe">Reset</button></div>
      <p class="ver" style="text-align:center;margin-top:12px">Arcane Realms · Release 1 · original procedural art &amp; audio<br>Controls: joystick to move · ⚔ attack (hold) · ★ skill · dash · flask</p>`;
    const apply = () => { this.hooks.applySettings(S); if (this.s) this.g.markDirty(); };
    for (const r of body.querySelectorAll('[data-s]')) r.oninput = () => { S[r.dataset.s] = +r.value; apply(); };
    for (const b of body.querySelectorAll('[data-t]')) b.onclick = () => { S[b.dataset.t] = !S[b.dataset.t]; b.classList.toggle('on', S[b.dataset.t]); apply(); this.audio.play('tap'); };
    for (const b of body.querySelectorAll('[data-g]')) b.onclick = () => { S[b.dataset.g] = b.dataset.v; apply(); this.audio.play('tap'); this.render(); };
    const sn = body.querySelector('#saveNow'); if (sn) sn.onclick = () => { const ok = this.g.saveNow(); this.toast(ok ? 'Game saved' : 'Save failed · storage unavailable', ok ? '' : 'warn'); this.render(); };
    body.querySelector('#wipe').onclick = () => this.detail(`<div class="sec">RESET PROGRESS?</div><p class="desc" style="font-style:normal">This permanently deletes your hero, items, upgrades and Index on this device.</p><div class="btnrow"><button class="btn" data-a="x">Cancel</button><button class="btn red" data-a="y">Delete everything</button></div>`, (c) => {
      c.querySelector('[data-a=x]').onclick = () => this.closeDetail(); c.querySelector('[data-a=y]').onclick = () => this.hooks.wipe(); });
  }
}
