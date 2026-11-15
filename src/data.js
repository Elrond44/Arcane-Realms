// Arcane Realms: all game content and balance curves live here (data-driven; gameplay code reads these tables)
export const VERSION = 1;
export const RARITIES = [
  { key: 'common', name: 'Common', color: '#a3a7ad', glow: 0x9aa0a6, affixes: 0, weight: 56, maxUp: 5, salvage: 2 },
  { key: 'uncommon', name: 'Uncommon', color: '#4fd16a', glow: 0x4fd16a, affixes: 1, weight: 27, maxUp: 6, salvage: 5 },
  { key: 'rare', name: 'Rare', color: '#4b9bff', glow: 0x4b9bff, affixes: 2, weight: 12, maxUp: 8, salvage: 12 },
  { key: 'epic', name: 'Epic', color: '#b866ff', glow: 0xb866ff, affixes: 2, weight: 4, maxUp: 10, salvage: 30 },
  { key: 'legendary', name: 'Legendary', color: '#ffbf2e', glow: 0xffbf2e, affixes: 3, weight: 0.9, maxUp: 12, salvage: 70 },
  { key: 'mythic', name: 'Mythic', color: '#ff4040', glow: 0xff4040, affixes: 4, weight: 0.12, maxUp: 15, salvage: 160 },
];
export const SLOTS = ['weapon', 'helm', 'chest', 'gloves', 'boots', 'ring', 'amulet', 'artifact'];
export const SLOT_NAMES = { weapon: 'Weapon', helm: 'Helm', chest: 'Chest', gloves: 'Gloves', boots: 'Boots', ring: 'Ring', amulet: 'Amulet', artifact: 'Artifact' };
export const RESOURCES = {
  gold: { name: 'Gold', color: '#ffd45a', desc: 'Basic upgrades and purchases' },
  essence: { name: 'Essence', color: '#c58bff', desc: 'Magical equipment improvements' },
  crystals: { name: 'Crystals', color: '#6fe7ff', desc: 'Advanced upgrades' },
  relics: { name: 'Relic Fragments', color: '#ff9d4a', desc: 'Trine Core (artifact) progression' },
  tokens: { name: 'Boss Tokens', color: '#ff5470', desc: 'Rare equipment and region unlocks' },
};
export const RES_KEYS = Object.keys(RESOURCES);

// Hero base stats (per level) and combat constants
export const HERO = { hp: 100, hpL: 14, atk: 10, atkL: 2.2, def: 2, defL: 1.1, crit: 0.05, critMult: 1.5, speed: 4.4, radius: 0.32, maxLevel: 30, flaskHeal: 0.4, flasks: 3, dashCd: 2.2, dashDist: 4.2, iframes: 0.32 };
export const xpNeed = (L) => Math.round(40 * Math.pow(L, 1.6));
export const DEF_K = 60; // damage taken = atk * K / (K + def)
export const ENEMY_DEF_K = 100;

// Weapon categories: timing (s), geometry, feel. heavy = 3rd hit of the combo.
export const WEAPONS = {
  sword: { name: 'Sword', cd: 0.52, windup: 0.11, range: 1.75, arc: 120, mult: 1.0, knock: 1.2, heavy: 1.6, crit: 0, trail: 0xbfe6ff, sfx: 'swing', hit: 'hitBlade', skill: 'whirl', desc: 'Balanced speed and damage. 3-hit combo, wide arcs.' },
  dagger: { name: 'Dagger', cd: 0.3, windup: 0.06, range: 1.3, arc: 85, mult: 0.62, knock: 0.5, heavy: 1.5, crit: 0.12, critMult: 0.35, trail: 0x9effc8, sfx: 'swish', hit: 'hitStab', skill: 'flurry', desc: 'Rapid strikes with +12% crit chance and +35% crit damage.' },
  axe: { name: 'Axe', cd: 0.92, windup: 0.24, range: 1.9, arc: 150, mult: 1.75, knock: 2.6, heavy: 1.8, crit: 0, poise: 2.2, trail: 0xffb36b, sfx: 'chop', hit: 'hitHeavy', skill: 'cleave', desc: 'Slow, heavy blows that stagger and knock enemies back.' },
  spear: { name: 'Spear', cd: 0.66, windup: 0.13, range: 2.75, arc: 34, mult: 1.15, knock: 1.6, heavy: 1.7, crit: 0.03, trail: 0xfff1a8, sfx: 'thrust', hit: 'hitStab', skill: 'lunge', desc: 'Long-reach thrusts in a narrow line; hits everything in front.' },
  staff: { name: 'Staff', cd: 0.78, windup: 0.16, range: 8.5, arc: 0, mult: 1.05, knock: 0.9, heavy: 1.7, crit: 0, proj: { speed: 13, radius: 0.35, aoe: 1.3, color: 0xb98cff, kind: 'orb' }, trail: 0xc59bff, sfx: 'cast', hit: 'hitMagic', skill: 'nova', element: 'arcane', desc: 'Arcane orbs that burst on impact and splash nearby foes.' },
  bow: { name: 'Bow', cd: 0.62, windup: 0.14, range: 10.5, arc: 0, mult: 0.92, knock: 0.6, heavy: 1.5, crit: 0.08, proj: { speed: 24, radius: 0.18, aoe: 0, color: 0xfff0b0, kind: 'arrow' }, trail: 0xfff0b0, sfx: 'bow', hit: 'hitStab', skill: 'volley', desc: 'Fast arrows from range with +8% precision crit chance.' },
};
export const WEAPON_KEYS = Object.keys(WEAPONS);
export const SKILLS = {
  whirl: { name: 'Whirlwind', cd: 6, mult: 1.5, radius: 2.6, hits: 2, desc: 'Spin twice, striking everything around you.' },
  flurry: { name: 'Shadow Flurry', cd: 7, mult: 0.75, hits: 5, dash: 3.5, desc: 'Blink to the nearest foe and strike five times.' },
  cleave: { name: 'Earthsplitter', cd: 8, mult: 2.8, length: 7.5, width: 1.6, desc: 'Split the ground in a line; staggers everything hit.' },
  lunge: { name: 'Skewering Lunge', cd: 6, mult: 2.1, dash: 5.5, width: 1.1, desc: 'Charge forward, piercing every enemy in your path.' },
  nova: { name: 'Arcane Nova', cd: 7, mult: 2.3, radius: 4.2, desc: 'Release a ring of arcane force that hurls enemies away.' },
  volley: { name: 'Starfall Volley', cd: 6, mult: 0.85, arrows: 7, spread: 50, desc: 'Loose seven arrows in a wide fan.' },
};

// Item templates. base = primary stat at item level 1 (atk for weapons, def for armor, etc.)
// drop tags: start, common (any creature), elite, chest, boss, hidden, shrine
const T = (id, name, slot, r, o) => ({ id, name, slot, r, req: 1, drop: ['common', 'chest'], ...o });
export const ITEMS = [
  // weapons
  T('rusted_blade', 'Rusted Shortsword', 'weapon', 0, { cat: 'sword', base: { atk: 6 }, look: { metal: 0x8d8478, accent: 0x6b4a2e }, drop: ['start', 'common'], desc: 'Pitted steel from the citadel armory. Still holds an edge, barely.' }),
  T('warden_sword', 'Grovewarden Blade', 'weapon', 1, { cat: 'sword', base: { atk: 9 }, req: 2, set: 'grove', look: { metal: 0xb9c2b0, accent: 0x3fae5c, glow: 0x6dff9a }, desc: 'Leaf-etched blade carried by the forest wardens.' }),
  T('moonsilver_saber', 'Moonsilver Saber', 'weapon', 3, { cat: 'sword', base: { atk: 15 }, req: 5, look: { metal: 0xd8e6ff, accent: 0x5a7dff, glow: 0x9ec4ff }, drop: ['elite', 'chest'], desc: 'Forged under a full moon; its edge glimmers in the dark.' }),
  T('emberfang', 'Emberfang', 'weapon', 4, { cat: 'sword', base: { atk: 21 }, req: 7, passive: 'ignite', look: { metal: 0x2b2420, accent: 0xff6a1a, glow: 0xff7a2a }, drop: ['elite', 'chest', 'boss'], desc: 'A blade with a coal for a heart.' }),
  T('thorn_shiv', 'Thorn Shiv', 'weapon', 0, { cat: 'dagger', base: { atk: 4 }, look: { metal: 0x7d8a6a, accent: 0x4b3a26 }, desc: 'A sharpened briar thorn bound in leather.' }),
  T('whisper_kris', 'Whisper Kris', 'weapon', 2, { cat: 'dagger', base: { atk: 8 }, req: 3, look: { metal: 0xa7b6c9, accent: 0x2e7a8a, glow: 0x6ff0ff }, desc: 'Wavy blade that hums when it finds a gap in armor.' }),
  T('nightsting', 'Nightsting', 'weapon', 3, { cat: 'dagger', base: { atk: 11 }, req: 5, passive: 'cdrCrit', look: { metal: 0x3a3352, accent: 0x9f5bff, glow: 0xb57bff }, drop: ['elite', 'chest', 'hidden'], desc: 'Strike from the dark, and strike again sooner.' }),
  T('woodcutter_axe', 'Woodcutter Axe', 'weapon', 0, { cat: 'axe', base: { atk: 8 }, look: { metal: 0x8a8a86, accent: 0x6d4a2a }, desc: 'Meant for trees. Works on bark-hided brutes too.' }),
  T('bramble_axe', 'Bramble Reaver', 'weapon', 2, { cat: 'axe', base: { atk: 13 }, req: 3, look: { metal: 0x5d6b4a, accent: 0x3b8a3a, glow: 0x7dff6a }, desc: 'Its haft still sprouts thorns.' }),
  T('ironbark_cleaver', 'Ironbark Cleaver', 'weapon', 4, { cat: 'axe', base: { atk: 25 }, req: 7, passive: 'shockwave', look: { metal: 0x4a3a2e, accent: 0xffb347, glow: 0xffc46a }, drop: ['elite', 'boss', 'chest'], desc: 'Hewn from a petrified heartwood; the ground answers its blows.' }),
  T('ash_pike', 'Ashwood Pike', 'weapon', 1, { cat: 'spear', base: { atk: 8 }, req: 2, look: { metal: 0xa9a49a, accent: 0x7a5a3a }, desc: 'Light, straight, and long enough to keep wolves honest.' }),
  T('starpiercer', 'Starpiercer', 'weapon', 5, { cat: 'spear', base: { atk: 30 }, req: 8, passive: 'chain', look: { metal: 0xeaf2ff, accent: 0xff4040, glow: 0xff6060 }, drop: ['boss', 'hidden'], desc: 'Said to have pinned a falling star to the earth. Lightning still runs along it.' }),
  T('willow_staff', 'Willow Staff', 'weapon', 0, { cat: 'staff', base: { atk: 6 }, look: { metal: 0x6d5a3a, accent: 0x8a6aff, glow: 0xa98bff }, desc: 'A green willow branch that remembers the old songs.' }),
  T('glowcap_staff', 'Glowcap Staff', 'weapon', 2, { cat: 'staff', base: { atk: 11 }, req: 3, look: { metal: 0x4a3a5a, accent: 0x3ff0c8, glow: 0x4dffd8 }, desc: 'Crowned with a luminous mushroom that never wilts.' }),
  T('moonweaver', 'Moonweaver', 'weapon', 4, { cat: 'staff', base: { atk: 19 }, req: 6, passive: 'novaCrit', look: { metal: 0xcfd8ff, accent: 0x6a8aff, glow: 0x8fb0ff }, drop: ['elite', 'chest', 'boss'], desc: 'Critical strikes unravel into small arcane novas.' }),
  T('hunters_bow', 'Hunter\'s Recurve', 'weapon', 1, { cat: 'bow', base: { atk: 7 }, req: 1, look: { metal: 0x7a5a36, accent: 0xd8c08a }, desc: 'Reliable, quiet, accurate.' }),
  T('whisperwind', 'Whisperwind', 'weapon', 3, { cat: 'bow', base: { atk: 14 }, req: 5, passive: 'split', look: { metal: 0xd9e8d0, accent: 0x5affc8, glow: 0x7affd8 }, drop: ['elite', 'chest', 'hidden'], desc: 'Every third arrow splits in flight.' }),
  // helms
  T('leather_hood', 'Traveler\'s Hood', 'helm', 0, { base: { def: 2, hp: 6 }, look: { style: 'hood', color: 0x5a4632 }, drop: ['start', 'common'], desc: 'Keeps the rain and the curious off.' }),
  T('warden_helm', 'Grovewarden Cowl', 'helm', 1, { base: { def: 4, hp: 12 }, req: 2, set: 'grove', look: { style: 'hood', color: 0x2f6a3a, trim: 0xc9b37a }, desc: 'Moss-green cowl of the forest wardens.' }),
  T('sentinel_helm', 'Sentinel Greathelm', 'helm', 2, { base: { def: 7, hp: 10 }, req: 3, set: 'sentinel', look: { style: 'helm', color: 0x8d8e92, trim: 0xd4a84a }, drop: ['elite', 'chest'], desc: 'Visored helm of the citadel\'s last guard.' }),
  T('antler_crown', 'Antler Crown', 'helm', 3, { base: { def: 5, hp: 30, ap: 0.08 }, req: 5, look: { style: 'crown', color: 0xd9c9a3, trim: 0x6dff9a, glow: 0x6dff9a }, drop: ['elite', 'chest', 'hidden'], desc: 'Shed by something very old that still walks the grove.' }),
  T('gloom_visage', 'Visage of Gloom', 'helm', 5, { base: { def: 11, hp: 40 }, req: 8, passive: 'dread', look: { style: 'visage', color: 0x2a2030, trim: 0xff4040, glow: 0xff3a3a }, drop: ['boss'], desc: 'Enemies near you deal 12% less damage.' }),
  // chest
  T('padded_tunic', 'Padded Tunic', 'chest', 0, { base: { def: 3, hp: 10 }, look: { style: 'tunic', color: 0x6a5238 }, drop: ['start', 'common'], desc: 'Quilted linen. Better than nothing.' }),
  T('warden_mail', 'Grovewarden Mail', 'chest', 1, { base: { def: 6, hp: 18 }, req: 2, set: 'grove', look: { style: 'mail', color: 0x2f6a3a, trim: 0xc9b37a }, desc: 'Leaf-scale mail stitched over green wool.' }),
  T('sentinel_plate', 'Sentinel Plate', 'chest', 2, { base: { def: 10, hp: 16 }, req: 3, set: 'sentinel', look: { style: 'plate', color: 0x8d8e92, trim: 0xd4a84a }, drop: ['elite', 'chest'], desc: 'Heavy, dented, unbroken.' }),
  T('mosswoven_robe', 'Mosswoven Robe', 'chest', 3, { base: { def: 6, hp: 36, ap: 0.12 }, req: 5, look: { style: 'robe', color: 0x24443a, trim: 0x4dffd8, glow: 0x4dffd8 }, desc: 'Living moss, woven while it slept.' }),
  T('heartwood_aegis', 'Heartwood Aegis', 'chest', 4, { base: { def: 16, hp: 45 }, req: 7, passive: 'thorns', look: { style: 'plate', color: 0x5a3a24, trim: 0xffbf2e, glow: 0xffbf2e }, drop: ['elite', 'boss', 'chest'], desc: 'Attackers are pricked for 30% of your defense as damage.' }),
  // gloves
  T('cloth_wraps', 'Cloth Wraps', 'gloves', 0, { base: { def: 1, atk: 1 }, look: { color: 0x7a6a52 }, drop: ['start', 'common'], desc: 'Simple hand wraps.' }),
  T('warden_grips', 'Grovewarden Grips', 'gloves', 1, { base: { def: 2, atk: 2 }, req: 2, set: 'grove', look: { color: 0x2f6a3a }, desc: 'Supple bark-leather gloves.' }),
  T('sentinel_gauntlets', 'Sentinel Gauntlets', 'gloves', 2, { base: { def: 4, atk: 3 }, req: 3, set: 'sentinel', look: { color: 0x8d8e92 }, drop: ['elite', 'chest'], desc: 'Plated fists of the citadel guard.' }),
  T('emberhand', 'Emberhand', 'gloves', 3, { base: { def: 3, atk: 6 }, req: 5, look: { color: 0x3a2018, glow: 0xff6a1a }, drop: ['elite', 'chest', 'hidden'], desc: 'Warm to the touch. Always.' }),
  // boots
  T('worn_boots', 'Worn Boots', 'boots', 0, { base: { def: 1, spd: 0.02 }, look: { color: 0x4a3a2a }, drop: ['start', 'common'], desc: 'Comfortable, and full of holes.' }),
  T('warden_treads', 'Grovewarden Treads', 'boots', 1, { base: { def: 2, spd: 0.04 }, req: 2, set: 'grove', look: { color: 0x2f6a3a }, desc: 'Silent on fallen leaves.' }),
  T('sentinel_greaves', 'Sentinel Greaves', 'boots', 2, { base: { def: 4, spd: 0.02 }, req: 3, set: 'sentinel', look: { color: 0x8d8e92 }, drop: ['elite', 'chest'], desc: 'Heavy steps that do not yield.' }),
  T('mistwalkers', 'Mistwalkers', 'boots', 4, { base: { def: 4, spd: 0.1 }, req: 6, passive: 'mistDash', look: { color: 0xc8d8e8, glow: 0x9fe0ff }, drop: ['elite', 'hidden', 'chest'], desc: 'Dash recharges 35% faster and leaves you briefly untouchable.' }),
  // rings
  T('copper_band', 'Copper Band', 'ring', 0, { base: { crit: 0.02 }, look: { color: 0xc07a3a }, desc: 'A plain band, lucky or not.' }),
  T('jade_loop', 'Jade Loop', 'ring', 1, { base: { crit: 0.03, hp: 8 }, req: 2, look: { color: 0x3fd07a, glow: 0x3fd07a }, desc: 'Cool, green, calming.' }),
  T('sapphire_signet', 'Sapphire Signet', 'ring', 2, { base: { crit: 0.04, critMult: 0.12 }, req: 3, look: { color: 0x3a6aff, glow: 0x5a8aff }, drop: ['elite', 'chest'], desc: 'Bears the seal of a forgotten house.' }),
  T('eclipse_ring', 'Eclipse Ring', 'ring', 4, { base: { crit: 0.06, critMult: 0.2 }, req: 7, passive: 'vampiric', look: { color: 0x1a1a22, glow: 0xffbf2e }, drop: ['boss', 'elite', 'hidden'], desc: 'Heals you for 4% of damage dealt.' }),
  // amulets
  T('bone_charm', 'Bone Charm', 'amulet', 0, { base: { hp: 14 }, look: { color: 0xd8ccb0 }, desc: 'Something\'s knucklebone on a cord.' }),
  T('grove_pendant', 'Grove Pendant', 'amulet', 1, { base: { hp: 22, res: 0.05 }, req: 2, look: { color: 0x4fd16a, glow: 0x6dff9a }, desc: 'A seed in amber, still alive.' }),
  T('starlit_locket', 'Starlit Locket', 'amulet', 3, { base: { hp: 40, ap: 0.15, res: 0.08 }, req: 5, look: { color: 0xc8d8ff, glow: 0x9ec4ff }, drop: ['elite', 'chest', 'shrine'], desc: 'Opens to a sky that is not this one.' }),
  T('gloomroot_heart', 'Gloomroot Heart', 'amulet', 5, { base: { hp: 80, ap: 0.2, res: 0.12 }, req: 6, passive: 'secondWind', look: { color: 0x3a1a2a, glow: 0xff4060 }, drop: ['boss'], desc: 'Once per fight, a killing blow leaves you at 30% health instead.' }),
  // artifact-slot prisms (empower the Trine Core multiplier)
  T('cracked_prism', 'Cracked Prism', 'artifact', 1, { base: { ampl: 0.08 }, req: 2, look: { color: 0x9fe0ff, glow: 0x9fe0ff }, drop: ['common', 'chest', 'shrine'], desc: 'A chipped facet. The Trine Core resonates with it faintly.' }),
  T('verdant_prism', 'Verdant Prism', 'artifact', 2, { base: { ampl: 0.15, res: 0.05 }, req: 3, look: { color: 0x6dff9a, glow: 0x6dff9a }, drop: ['elite', 'chest'], desc: 'Grown, not cut, in the heart of the grove.' }),
  T('sunfire_prism', 'Sunfire Prism', 'artifact', 3, { base: { ampl: 0.25, crit: 0.02 }, req: 5, look: { color: 0xffbf2e, glow: 0xffc46a }, drop: ['elite', 'chest', 'hidden'], desc: 'Holds a sliver of a sunrise.' }),
  T('trine_shard', 'Shard of the First Trine', 'artifact', 4, { base: { ampl: 0.4, critMult: 0.15 }, req: 7, look: { color: 0xff9d4a, glow: 0xffa060 }, drop: ['boss', 'hidden'], desc: 'A splinter of the original Trine Core.' }),
];
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((t) => [t.id, t]));
export const SOURCES = { start: 'Starting gear', common: 'Woodland creatures', elite: 'Elite guardians', chest: 'Treasure chests', boss: 'Gloomroot (miniboss)', hidden: 'Hidden Hollow cache', shrine: 'Shrine offerings' };
export const SETS = {
  grove: { name: 'Grovewarden', pieces: ['warden_helm', 'warden_mail', 'warden_grips', 'warden_treads', 'warden_sword'], bonus: [[2, '+15% max health', { hpPct: 0.15 }], [4, '+10% attack speed and +10% damage', { aspd: 0.1, dmgPct: 0.1 }]] },
  sentinel: { name: 'Citadel Sentinel', pieces: ['sentinel_helm', 'sentinel_plate', 'sentinel_gauntlets', 'sentinel_greaves'], bonus: [[2, '+20% defense', { defPct: 0.2 }], [4, 'Take 15% less damage below half health', { lastStand: 0.15 }]] },
};
export const PASSIVES = {
  ignite: 'Hits ignite foes, burning for 60% of the hit over 3 s.',
  cdrCrit: 'Critical hits refund 0.6 s of skill cooldown.',
  shockwave: 'Heavy hits send a shockwave through nearby enemies.',
  chain: 'Hits arc lightning to 2 nearby enemies for 45% damage.',
  novaCrit: 'Critical hits release a small arcane nova.',
  split: 'Every third arrow splits into three.',
  dread: 'Enemies near you deal 12% less damage.',
  thorns: 'Attackers take 30% of your defense as damage.',
  vampiric: 'Heal for 4% of damage dealt.',
  secondWind: 'Once per fight, survive a killing blow at 30% health.',
  mistDash: 'Dash recharges 35% faster with longer invulnerability.',
};
// random affixes (rolled per item instance; count set by rarity)
export const AFFIXES = {
  hp: { name: 'Max Health', fmt: 'flat', lo: 6, hi: 14, perL: 2.2 },
  atkPct: { name: 'Damage', fmt: 'pct', lo: 0.03, hi: 0.07 },
  crit: { name: 'Crit Chance', fmt: 'pct', lo: 0.01, hi: 0.03 },
  critMult: { name: 'Crit Damage', fmt: 'pct', lo: 0.05, hi: 0.12 },
  aspd: { name: 'Attack Speed', fmt: 'pct', lo: 0.03, hi: 0.06 },
  spd: { name: 'Move Speed', fmt: 'pct', lo: 0.02, hi: 0.05 },
  res: { name: 'Elemental Resist', fmt: 'pct', lo: 0.03, hi: 0.07 },
  ap: { name: 'Ability Power', fmt: 'pct', lo: 0.04, hi: 0.09 },
  find: { name: 'Gold & Essence Find', fmt: 'pct', lo: 0.04, hi: 0.1 },
  fire: { name: 'Fire Damage', fmt: 'flat', lo: 1, hi: 3, perL: 0.5 },
  frost: { name: 'Frost Damage', fmt: 'flat', lo: 1, hi: 3, perL: 0.5 },
};
export const STAT_NAMES = { atk: 'Attack', def: 'Defense', hp: 'Max Health', crit: 'Crit Chance', critMult: 'Crit Damage', spd: 'Move Speed', ap: 'Ability Power', res: 'Elemental Resist', ampl: 'Trine Amplification', aspd: 'Attack Speed' };
export const PCT_STATS = new Set(['crit', 'critMult', 'spd', 'ap', 'res', 'ampl', 'aspd', 'atkPct', 'find']);
export const itemScale = (ilvl, up) => (1 + 0.12 * (ilvl - 1)) * (1 + 0.1 * up);
export function upgradeCost(rarity, up) { return { gold: Math.round(30 * Math.pow(1.38, up) * (1 + rarity * 0.6)), essence: Math.round(6 * Math.pow(1.32, up) * (1 + rarity * 0.5)), crystals: up >= 5 ? Math.ceil((up - 4) * (1 + rarity * 0.5)) : 0 }; }

// General upgrades (Citadel forge / Upgrades menu)
export const UPGRADES = [
  { key: 'might', name: 'Weapon Mastery', icon: 'sword', desc: '+6% weapon damage', per: 0.06, max: 30, gold: 40, g: 1.3, crys: 10 },
  { key: 'bulwark', name: 'Armor Training', icon: 'shield', desc: '+6% armor effectiveness', per: 0.06, max: 30, gold: 35, g: 1.3, crys: 10 },
  { key: 'vitality', name: 'Vitality', icon: 'heart', desc: '+8% maximum health', per: 0.08, max: 30, gold: 35, g: 1.29, crys: 10 },
  { key: 'swiftness', name: 'Swiftness', icon: 'wing', desc: '+3% attack speed', per: 0.03, max: 20, gold: 60, g: 1.34, crys: 6 },
  { key: 'arcana', name: 'Arcana', icon: 'star', desc: '+7% ability damage, -2% cooldowns', per: 0.07, max: 25, gold: 55, g: 1.33, crys: 7 },
  { key: 'precision', name: 'Precision', icon: 'eye', desc: '+1% crit chance, +4% crit damage', per: 0.01, max: 15, gold: 70, g: 1.38, crys: 4 },
  { key: 'fortune', name: 'Fortune', icon: 'coin', desc: '+6% gold and essence gained', per: 0.06, max: 25, gold: 50, g: 1.33, crys: 8 },
  { key: 'renewal', name: 'Renewal', icon: 'leaf', desc: '+0.5% health per second out of combat', per: 0.005, max: 15, gold: 45, g: 1.35, crys: 6 },
];
export const UPG_BY_KEY = Object.fromEntries(UPGRADES.map((u) => [u.key, u]));
export function upgCost(u, l) { return { gold: Math.round(u.gold * Math.pow(u.g, l)), crystals: l >= u.crys ? Math.ceil((l - u.crys + 1) * 1.5) : 0 }; }

// Trine Core artifact
export const ARTIFACT = {
  name: 'The Trine Core', max: 40,
  mult: (L) => +(1 + 0.12 * L + 0.004 * L * L).toFixed(2),
  cost: (L) => ({ relics: Math.ceil(2 + L * 1.5), essence: Math.round(25 * Math.pow(1.24, L)), crystals: L >= 4 ? Math.ceil((L - 3) * 1.2) : 0 }),
  facets: [ // milestones unlocked at levels
    { at: 3, name: 'Facet of Fortune', desc: '+10% gold, essence and crystals', k: 'find', v: 0.1 },
    { at: 6, name: 'Facet of Ruin', desc: '+15% crit damage', k: 'critMult', v: 0.15 },
    { at: 10, name: 'Facet of Insight', desc: '+15% experience gained', k: 'xp', v: 0.15 },
    { at: 15, name: 'Facet of Haste', desc: '+8% attack speed', k: 'aspd', v: 0.08 },
    { at: 20, name: 'Facet of Harmony', desc: '+10% to all equipment bonuses', k: 'gear', v: 0.1 },
    { at: 30, name: 'Facet of Ascension', desc: '+20% ability damage', k: 'ap', v: 0.2 },
  ],
  // the multiplier boosts damage fully and resource gain at half strength
  resShare: 0.5,
};

// Enemies. cls drives the AI profile.
export const ENEMIES = {
  mossling: { name: 'Mossling', cls: 'melee', hp: 30, atk: 6, def: 0, speed: 2.7, range: 1.0, cd: 1.5, windup: 0.42, detect: 7, leash: 16, xp: 6, gold: [2, 5], poise: 10, size: 0.55, el: 'phys', drop: 0.08, color: 0x4f8a3a },
  thornfang: { name: 'Thornfang', cls: 'fast', hp: 26, atk: 7, def: 1, speed: 5.4, range: 1.35, cd: 1.7, windup: 0.32, detect: 10, leash: 20, xp: 8, gold: [3, 6], poise: 12, size: 0.6, el: 'phys', drop: 0.09, lunge: 3.2, color: 0x5a5a6a },
  barkhide: { name: 'Barkhide Brute', cls: 'heavy', hp: 120, atk: 17, def: 8, speed: 1.9, range: 2.0, cd: 2.8, windup: 0.85, detect: 8, leash: 15, xp: 24, gold: [8, 14], poise: 70, size: 1.25, el: 'phys', drop: 0.18, aoe: 2.3, color: 0x5a4030 },
  briar: { name: 'Briar Archer', cls: 'ranged', hp: 32, atk: 8, def: 1, speed: 3.1, range: 9, keep: 6, cd: 2.0, windup: 0.55, detect: 11, leash: 18, xp: 10, gold: [3, 7], poise: 10, size: 0.6, el: 'phys', drop: 0.1, proj: { speed: 15, color: 0xffe0a0, kind: 'arrow' }, color: 0x6a3a5a },
  wisp: { name: 'Ember Wisp', cls: 'caster', hp: 28, atk: 11, def: 0, speed: 2.5, range: 8.5, keep: 5.5, cd: 3.2, windup: 0.9, detect: 10, leash: 18, xp: 12, gold: [2, 5], essence: [2, 5], poise: 8, size: 0.5, el: 'fire', drop: 0.1, proj: { speed: 7.5, color: 0xff8a3a, kind: 'orb', homing: 1.6 }, color: 0xff7a2a, fly: true },
  sporemender: { name: 'Sporemender', cls: 'support', hp: 42, atk: 4, def: 2, speed: 2.4, range: 7, keep: 7, cd: 4.5, windup: 1.0, detect: 9, leash: 16, xp: 14, gold: [4, 8], essence: [1, 3], poise: 14, size: 0.7, el: 'nature', drop: 0.12, heal: 0.18, color: 0xb05aa8 },
  sentinel: { name: 'Ruin Sentinel', cls: 'elite', hp: 300, atk: 20, def: 14, speed: 2.4, range: 1.9, cd: 2.2, windup: 0.6, detect: 9, leash: 14, xp: 70, gold: [25, 40], relics: [1, 2], poise: 120, size: 1.15, el: 'phys', drop: 0.75, guard: 0.6, charge: 8, color: 0x8a8678, elite: true },
  gloomroot: { name: 'Gloomroot, the Hollow Elder', cls: 'boss', hp: 1250, atk: 22, def: 10, speed: 1.6, range: 3, cd: 1.6, windup: 1.0, detect: 30, leash: 40, xp: 400, gold: [180, 240], relics: [4, 6], essence: [40, 60], crystals: [6, 10], tokens: [1, 1], poise: 9999, size: 3.2, el: 'nature', drop: 1, color: 0x3a2a24, boss: true },
};
export const enemyScale = (lvl) => ({ hp: 1 + 0.24 * (lvl - 1) + 0.012 * (lvl - 1) * (lvl - 1), atk: 1 + 0.15 * (lvl - 1), def: 1 + 0.1 * (lvl - 1), rew: 1 + 0.18 * (lvl - 1) });

// Quests: type in main|combat|collect|explore|challenge|progress
export const QUESTS = [
  { id: 'q_portal', type: 'main', name: 'Into the Woodland', desc: 'Step through the Citadel portal into the Enchanted Woodland.', goal: { k: 'enter', v: 'woodland' }, n: 1, rew: { gold: 40, essence: 10 } },
  { id: 'q_thorns', type: 'combat', name: 'Thinning the Thorns', desc: 'Defeat woodland creatures.', goal: { k: 'kill' }, n: 15, rew: { gold: 90, essence: 20 }, after: 'q_portal' },
  { id: 'q_moonwell', type: 'main', name: 'The Moonwell', desc: 'Reach the Moonwell shrine at the heart of the woodland.', goal: { k: 'shrine', v: 'moonwell' }, n: 1, rew: { gold: 60, relics: 2 }, after: 'q_portal' },
  { id: 'q_relic', type: 'progress', name: 'Resonance', desc: 'Upgrade the Trine Core to level 2 at the Citadel pedestal.', goal: { k: 'artifact' }, n: 2, rew: { crystals: 6, essence: 30 }, after: 'q_moonwell' },
  { id: 'q_index', type: 'collect', name: 'Curator\'s Ledger', desc: 'Discover different items for the Index.', goal: { k: 'discover' }, n: 10, rew: { gold: 150, relics: 2 }, after: 'q_portal' },
  { id: 'q_sentinel', type: 'challenge', name: 'Stone Watch', desc: 'Defeat a Ruin Sentinel in the western ruins.', goal: { k: 'killType', v: 'sentinel' }, n: 1, rew: { gold: 120, relics: 3, crystals: 4 }, after: 'q_moonwell' },
  { id: 'q_hollow', type: 'explore', name: 'The Hidden Hollow', desc: 'Find the hidden hollow somewhere beyond the ruins.', goal: { k: 'area', v: 'hollow' }, n: 1, rew: { gold: 100, crystals: 5 }, after: 'q_moonwell' },
  { id: 'q_upgrade', type: 'progress', name: 'Tempered Steel', desc: 'Buy general upgrades at the Forge.', goal: { k: 'upgrades' }, n: 8, rew: { gold: 120, crystals: 4 }, after: 'q_portal' },
  { id: 'q_gloomroot', type: 'main', name: 'Root of the Gloom', desc: 'Light the Grove Heart altar and defeat Gloomroot.', goal: { k: 'killType', v: 'gloomroot' }, n: 1, rew: { gold: 400, relics: 5, crystals: 10 }, after: 'q_moonwell' },
];
export const QUEST_BY_ID = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
// Index discovery milestones (count of unique items discovered)
export const INDEX_MILESTONES = [
  { n: 5, rew: { gold: 60, essence: 15 } }, { n: 10, rew: { relics: 2, essence: 25 } }, { n: 20, rew: { crystals: 8, relics: 3 } },
  { n: 30, rew: { crystals: 12, relics: 5 } }, { n: 40, rew: { tokens: 1, relics: 8 } }, { n: ITEMS.length, rew: { tokens: 2, crystals: 30 } },
];
export const REGIONS = [
  { id: 'citadel', name: 'Forgotten Citadel', sub: 'Hub · Warden\'s Hall', open: true, lvl: '—', color: '#e0a35a' },
  { id: 'woodland', name: 'Enchanted Woodland', sub: 'Levels 1–7 · Gloomroot', open: true, lvl: '1–7', color: '#5fd38a' },
  { id: 'caverns', name: 'Crystal Caverns', sub: 'Sealed · needs a Boss Token and level 8', open: false, color: '#6fe7ff' },
  { id: 'catacombs', name: 'Ancient Catacombs', sub: 'Sealed by old wards', open: false, color: '#b9a4ff' },
  { id: 'ashen', name: 'Ashen Wastes', sub: 'Sealed by old wards', open: false, color: '#ff8a4a' },
  { id: 'astral', name: 'Astral Sanctuary', sub: 'Sealed by old wards', open: false, color: '#ffe38a' },
];
