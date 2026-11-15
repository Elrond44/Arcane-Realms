# Arcane Realms — Progress

## Release 1 (brief phases 1 + 2) — status
### Done
- Engine: Three.js r170 (vendored), ES modules, no build step, data-driven configs (src/data.js)
- Enchanted Woodland (10 clearings, hidden hollow path, boss arena) + Forgotten Citadel hub, portal travel with fade
- Hero controller: joystick/WASD, collision + wall sliding, dash with i-frames, flasks, auto-attack, 3-hit combos
- Camera: elevated 3/4, look-ahead, combat/boss zoom, occlusion dither fade, screen shake setting
- 6 weapon categories (sword, dagger, axe, spear, staff, bow) with own timing, geometry, trails, sounds, skills
- 7 enemy archetypes + state-machine AI; Gloomroot 2-phase telegraphed miniboss (slam, sweep, spikes, ring, summons)
- Loot: 6 rarities, 47 items, 8 slots, affixes, sets, passives; gear changes hero look
- Inventory/equipment: paper doll + 3D preview, compare, sort, filters, equip, upgrade, salvage, bulk salvage, lock
- Item Index: silhouettes, sources, discovery rewards, milestones
- Trine Core artifact screen: 3D rotating core, rings, particles, current/next multiplier, cost, facets, upgrade animation
- Resources (gold, essence, crystals, relics, tokens), Forge upgrades, Hero stats, Quests, World map, Settings, title menu
- Interactables: chests, altars, shrine, nodes, forge, lectern, font, armory, map table, portal, boss altar
- HUD per section 11 with safe areas; procedural WebAudio SFX, adaptive music, ambience
- Versioned save with checksum, backup, sanitize, corruption handling; quality presets + auto-detect
- Tests (outside repo, /workspace/arcane-realms/tests): smoke, combat, menus, boss, save, tour

### Published
- Live: https://elrond44.github.io/Arcane-Realms/ (GitHub Pages from main /)
- Screenshots: shots/r1/

### Known limitations / next polish
- Only tested headless (software GL); real-phone performance and balance need play-testing
- Hero is small at default zoom (by design); no pinch-zoom yet
- Woodland lighting is dark/moody; may want a brightness slider
- Desktop/landscape layout works but is not the focus

## Later releases (brief phases 3–5)
- Phase 3: Crystal Caverns, Ancient Catacombs regions + region bosses; unlock via Boss Tokens on the world map
- Phase 4: Ashen Wastes, Astral Sanctuary; more enemy archetypes, elite affixes, more sets/mythics
- Phase 5: endgame — artifact levels 40+, challenge rifts, cosmetic transmog, balance pass on real phones
