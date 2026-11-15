// Simple, robust top-down collision: circles + oriented boxes in a spatial hash, plus an optional
// "walkable region" signed-distance field (union of capsules/discs) that keeps everyone inside the level.
export class Colliders {
  constructor(cell = 4) { this.cell = cell; this.grid = new Map(); this.all = []; this.region = null; }
  key(i, j) { return i * 73856093 ^ j * 19349663; }
  add(c) { // c: {type:'c', x,z,r} | {type:'b', x,z,hw,hd,rot}; flags: wall (blocks sight/projectiles), low (blocks movement only)
    if (c.type === 'b') { c.cos = Math.cos(c.rot || 0); c.sin = Math.sin(c.rot || 0); c.br = Math.hypot(c.hw, c.hd); } else c.br = c.r;
    this.all.push(c); const r = c.br, s = this.cell;
    for (let i = Math.floor((c.x - r) / s); i <= Math.floor((c.x + r) / s); i++) for (let j = Math.floor((c.z - r) / s); j <= Math.floor((c.z + r) / s); j++) { const k = this.key(i, j); let b = this.grid.get(k); if (!b) this.grid.set(k, (b = [])); b.push(c); }
    return c;
  }
  near(x, z, r, out = []) { out.length = 0; const s = this.cell; const seen = this._seen || (this._seen = new Set()); seen.clear();
    for (let i = Math.floor((x - r) / s); i <= Math.floor((x + r) / s); i++) for (let j = Math.floor((z - r) / s); j <= Math.floor((z + r) / s); j++) { const b = this.grid.get(this.key(i, j)); if (b) for (const c of b) if (!seen.has(c)) { seen.add(c); out.push(c); } }
    return out; }
  // push a circle (x,z,r) out of every overlapping collider; returns {x,z,hit}
  resolve(p, r, ignoreLow = false) {
    let hit = false; const list = this.near(p.x, p.z, r + 0.5, this._buf || (this._buf = []));
    for (let pass = 0; pass < 2; pass++) for (const c of list) {
      if (c.off || (ignoreLow && c.low)) continue;
      if (c.type === 'c') { const dx = p.x - c.x, dz = p.z - c.z; const d2 = dx * dx + dz * dz, R = r + c.r; if (d2 < R * R) { const d = Math.sqrt(d2) || 1e-4; const k = (R - d) / d; p.x += dx * k; p.z += dz * k; hit = true; } }
      else { const dx = p.x - c.x, dz = p.z - c.z; const lx = dx * c.cos + dz * c.sin, lz = -dx * c.sin + dz * c.cos;
        const cx = Math.max(-c.hw, Math.min(c.hw, lx)), cz = Math.max(-c.hd, Math.min(c.hd, lz)); let ex = lx - cx, ez = lz - cz; let d2 = ex * ex + ez * ez;
        if (d2 < r * r) { let nx, nz, push; if (d2 > 1e-8) { const d = Math.sqrt(d2); nx = ex / d; nz = ez / d; push = r - d; } else { // centre inside the box: exit via the nearest face
            const px = c.hw - Math.abs(lx), pz = c.hd - Math.abs(lz); if (px < pz) { nx = Math.sign(lx) || 1; nz = 0; push = px + r; } else { nx = 0; nz = Math.sign(lz) || 1; push = pz + r; } }
          p.x += (nx * c.cos - nz * c.sin) * push; p.z += (nx * c.sin + nz * c.cos) * push; hit = true; } }
    }
    if (this.region) { const d = this.region.sdf(p.x, p.z) + r; if (d > 0) { const e = 0.05; const gx = (this.region.sdf(p.x + e, p.z) - this.region.sdf(p.x - e, p.z)) / (2 * e), gz = (this.region.sdf(p.x, p.z + e) - this.region.sdf(p.x, p.z - e)) / (2 * e); const gl = Math.hypot(gx, gz) || 1; p.x -= gx / gl * d; p.z -= gz / gl * d; hit = true; } }
    return hit;
  }
  pointBlocked(x, z, wallsOnly = true) {
    const list = this.near(x, z, 0.1, this._buf2 || (this._buf2 = []));
    for (const c of list) { if (c.off || (wallsOnly && !c.wall)) continue;
      if (c.type === 'c') { if ((x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) return c; }
      else { const dx = x - c.x, dz = z - c.z; const lx = dx * c.cos + dz * c.sin, lz = -dx * c.sin + dz * c.cos; if (Math.abs(lx) < c.hw && Math.abs(lz) < c.hd) return c; } }
    if (this.region && this.region.sdf(x, z) > 0.6) return { region: true };
    return null;
  }
  segBlocked(ax, az, bx, bz, step = 0.35) { const L = Math.hypot(bx - ax, bz - az); const n = Math.max(1, Math.ceil(L / step)); for (let i = 1; i < n; i++) { const t = i / n; if (this.pointBlocked(ax + (bx - ax) * t, az + (bz - az) * t)) return true; } return false; }
}
// walkable region: union of capsules (polyline segments with half-width) and discs
export class Region {
  constructor() { this.caps = []; this.discs = []; }
  path(pts, w) { for (let i = 0; i < pts.length - 1; i++) this.caps.push({ ax: pts[i][0], az: pts[i][1], bx: pts[i + 1][0], bz: pts[i + 1][1], w }); return this; }
  disc(x, z, r) { this.discs.push({ x, z, r }); return this; }
  sdf(x, z) { let d = 1e9;
    for (const c of this.caps) { const abx = c.bx - c.ax, abz = c.bz - c.az; const t = Math.max(0, Math.min(1, ((x - c.ax) * abx + (z - c.az) * abz) / (abx * abx + abz * abz))); const dd = Math.hypot(x - c.ax - abx * t, z - c.az - abz * t) - c.w; if (dd < d) d = dd; }
    for (const c of this.discs) { const dd = Math.hypot(x - c.x, z - c.z) - c.r; if (dd < d) d = dd; }
    return d; }
}
