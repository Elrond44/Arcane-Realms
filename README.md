# Arcane Realms

A portrait-first 3D fantasy action RPG / dungeon crawler for mobile browsers. A tiny warden explores a dark enchanted woodland, fights with real-time combat, collects six-rarity gear, fills the Item Index and awakens the Trine Core artifact.

**Play:** https://elrond44.github.io/Arcane-Realms/

## Controls
- **Phone:** left-side joystick to move; ⚔ attack (hold, or let auto-attack work), ★ weapon skill, dash, flask; the green prompt button interacts.
- **Desktop:** WASD / arrows move, J or Space attack, K skill, L or Shift dash, Q flask, E interact, I gear, X index, T artifact, U forge, M map, Esc back.

## Tech
Three.js r170 (vendored), plain ES modules with no build step, data-driven content in `src/data.js`, procedural geometry/textures and procedural WebAudio. Versioned localStorage save with checksum + backup. Low/Medium/High quality presets with auto-detect.

Run locally: `python3 -m http.server` in this folder, then open http://localhost:8000.
