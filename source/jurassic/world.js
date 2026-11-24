import { Mesh, icosphere, rnd, rr, rseed, fbm, clamp, mix, sstep } from '../src/math.js';

export const SEA = 0, LIMIT = 222, DAY_SECONDS = 720;
export const SPAWN = { x: 56, z: 32, yaw: -0.9 };
export const SPRING = { x: 27, z: 12 };
export const CACHE = { x: 50, z: 30 };
export const SPECIES = [
  { name: 'Stegosaurus', kind: 'Herbivore', detail: 'A plated browser. Give its spiked tail room.', color: '#c7d59b' },
  { name: 'Allosaurus', kind: 'Predator', detail: 'A territorial hunter. Keep your distance; water offers an escape.', color: '#e5a66b' },
  { name: 'Cryptoclidus', kind: 'Marine reptile', detail: 'A Jurassic plesiosaur, not a dinosaur. Watch it from a safe distance.', color: '#8ed1cf' }
];

export function terrainHeight(x, z) {
  const dx = (x + 45) / 1.1, dz = z * 0.95, r = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
  const edge = 114 + Math.sin(a * 3) * 7 + Math.sin(a * 5 + 1) * 4;
  const inland = edge - r;
  let h = clamp(inland * 0.24, -34, 24);
  h += (fbm(x * 0.018, 3, z * 0.018, 3) - 0.48) * 17 * sstep(2, 32, inland);
  h += 25 * Math.exp(-((x + 78) ** 2 + (z + 62) ** 2) / 1000);
  h += (fbm(x * 0.09, 8, z * 0.09, 2) - 0.5) * 1.3 * sstep(1, 12, Math.abs(inland));
  const pond = Math.hypot(x - SPRING.x, z - SPRING.z);
  h -= 1.5 * (1 - sstep(1.8, 4.2, pond));
  return h;
}

// Physics and rendering sample the same triangulated height field.
const GRID = 240, SIZE = 480, STEP = SIZE / GRID;
export const heights = new Float32Array((GRID + 1) ** 2);
for (let z = 0; z <= GRID; z++) for (let x = 0; x <= GRID; x++) heights[z * (GRID + 1) + x] = terrainHeight(x * STEP - SIZE / 2, z * STEP - SIZE / 2);
export function ground(x, z) {
  const gx = clamp((x + SIZE / 2) / STEP, 0, GRID - 0.0001), gz = clamp((z + SIZE / 2) / STEP, 0, GRID - 0.0001);
  const ix = Math.floor(gx), iz = Math.floor(gz), u = gx - ix, v = gz - iz, i = iz * (GRID + 1) + ix;
  const a = heights[i], b = heights[i + 1], c = heights[i + GRID + 1], d = heights[i + GRID + 2];
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}

export class Geometry {
  constructor() { this.vertices = []; this.indices = []; }
  vertex(p, n, c, joint = 0) { const i = this.vertices.length / 10; this.vertices.push(...p, ...n, ...c, joint); return i; }
  tri(a, b, c) { this.indices.push(a, b, c); }
  quad(a, b, c, d) { this.indices.push(a, b, c, a, c, d); }
  mesh(mesh, color, joint = 0) {
    const built = mesh.build(), f = new Float32Array(built.vb), s = new Int8Array(built.vb), base = this.vertices.length / 10;
    for (let i = 0; i < built.nv; i++) this.vertex([f[i * 4], f[i * 4 + 1], f[i * 4 + 2]], [s[i * 16 + 12] / 127, s[i * 16 + 13] / 127, s[i * 16 + 14] / 127], color, joint);
    for (const i of built.ib) this.indices.push(base + i);
  }
  ellipsoid(p, scale, color, joint = 0, sub = 2) {
    this.mesh(icosphere(sub, (x, y, z) => [p[0] + x * scale[0], p[1] + y * scale[1], p[2] + z * scale[2]]), color, joint);
  }
  tube(pts, radius, color, joint = 0, sides = 8) { const m = new Mesh(); m.tube(pts, radius, sides); this.mesh(m, color, joint); }
  box(p, size, color) {
    const [x, y, z] = p, [w, h, d] = size, m = new Mesh();
    m.sweep([[x, y - h / 2, z], [x, y + h / 2, z]], w, d, () => [0, 0, 1]); this.mesh(m, color);
  }
  finish() { return { vertices: new Float32Array(this.vertices), indices: new Uint32Array(this.indices) }; }
}

function terrainMesh() {
  const g = new Geometry();
  for (let z = 0; z <= GRID; z++) for (let x = 0; x <= GRID; x++) {
    const px = x * STEP - SIZE / 2, pz = z * STEP - SIZE / 2, h = heights[z * (GRID + 1) + x];
    const nx = terrainHeight(px - 0.5, pz) - terrainHeight(px + 0.5, pz), nz = terrainHeight(px, pz - 0.5) - terrainHeight(px, pz + 0.5), len = Math.hypot(nx, 1, nz);
    const n = fbm(px * 0.08, 5, pz * 0.08, 2), green = sstep(2.4, 8, h), cliff = sstep(0.55, 1.7, Math.hypot(nx, nz));
    let c = [mix(0.58, 0.12 + n * 0.055, green), mix(0.49, 0.20 + n * 0.09, green), mix(0.32, 0.085 + n * 0.04, green)];
    c = c.map((v, k) => mix(v, [0.27, 0.29, 0.25][k], cliff));
    g.vertex([px, h, pz], [nx / len, 1 / len, nz / len], c);
    if (x < GRID && z < GRID) { const i = z * (GRID + 1) + x; g.tri(i, i + GRID + 1, i + 1); g.tri(i + 1, i + GRID + 1, i + GRID + 2); }
  }
  return g.finish();
}

function cone(g, y, radius, height, color, sides = 11) {
  const m = new Mesh(), top = m.v(0, y + height, 0), ring = [];
  for (let i = 0; i < sides; i++) { const a = i / sides * Math.PI * 2; ring.push(m.v(Math.cos(a) * radius, y + Math.sin(i * 9) * 0.4, Math.sin(a) * radius)); }
  for (let i = 0; i < sides; i++) m.tri(ring[i], top, ring[(i + 1) % sides]);
  g.mesh(m, color);
}

function conifer() {
  const g = new Geometry();
  g.tube([[0, 0, 0], [0.12, 7, 0], [-0.1, 17, 0], [0, 22, 0]], k => 0.65 * (1 - k / 4), [0.24, 0.17, 0.095]);
  for (let i = 0; i < 6; i++) cone(g, 8 + i * 2.1, 5.4 - i * 0.69, 5.2, [0.085 + i * 0.008, 0.20 + i * 0.015, 0.105]);
  for (let i = 0; i < 5; i++) { const a = i * 2.4; g.tube([[0, 0.2, 0], [Math.cos(a) * 1.8, 0.05, Math.sin(a) * 1.8]], k => k ? 0.06 : 0.35, [0.23, 0.16, 0.085]); }
  return g.finish();
}

function fern(aquatic = false) {
  const g = new Geometry(), n = aquatic ? 7 : 9;
  for (let j = 0; j < n; j++) {
    const a = j / n * Math.PI * 2, len = 1.6 + 0.45 * Math.sin(j * 4), ca = Math.cos(a), sa = Math.sin(a);
    for (let k = 0; k < 8; k++) {
      const t = k / 8, t2 = (k + 1) / 8, r = t * len, r2 = t2 * len;
      const y = aquatic ? t * 3 : Math.sin(t * 2) * 0.85, y2 = aquatic ? t2 * 3 : Math.sin(t2 * 2) * 0.85;
      const w = Math.sin(t * Math.PI) * (aquatic ? 0.18 : 0.43), c = aquatic ? [0.10, 0.31, 0.23] : [0.17, 0.32 + t * 0.06, 0.10];
      const p = [ca * r, y, sa * r], q = [ca * r2, y2, sa * r2];
      const b = g.vertex([p[0] - sa * w, p[1], p[2] + ca * w], [0, 1, 0], c, aquatic ? 5 : 0);
      const d = g.vertex([p[0] + sa * w, p[1], p[2] - ca * w], [0, 1, 0], c, aquatic ? 5 : 0);
      const e = g.vertex(q, [0, 1, 0], c, aquatic ? 5 : 0); g.tri(b, d, e);
    }
  }
  return g.finish();
}

function stegosaurus() {
  const g = new Geometry(), skin = [0.34, 0.40, 0.22], dark = [0.25, 0.31, 0.16];
  g.ellipsoid([0, 2.15, 0], [1.15, 1.15, 2.15], skin);
  g.ellipsoid([0, 1.6, -2.2], [0.48, 0.55, 0.95], skin);
  g.ellipsoid([0, 1.32, -3.05], [0.33, 0.34, 0.65], dark);
  g.tube([[0, 2, 1.65], [0, 1.8, 3], [0, 1.45, 4.6], [0, 1.65, 5.6]], k => [0.61, 0.40, 0.16, 0.025][k], dark, 3);
  for (const side of [-1, 1]) for (const front of [-1, 1]) {
    const x = side * 0.7, z = front < 0 ? -1.2 : 1.25, joint = side * front > 0 ? 1 : 2;
    g.tube([[x, 2, z], [x * 1.1, 0.85, z + 0.1], [x * 1.15, 0.2, z - 0.15]], k => [0.38, 0.26, 0.23][k], dark, joint);
    g.ellipsoid([x * 1.15, 0.18, z - 0.25], [0.30, 0.18, 0.44], dark, joint, 1);
  }
  for (let i = 0; i < 10; i++) {
    const z = -2 + i * 0.59, h = Math.sin((i + 0.6) / 10 * Math.PI) * 1.1 + 0.28, y = 2.15 + Math.sqrt(Math.max(0, 1 - (z / 2.8) ** 2)) * 0.9, x = i % 2 ? 0.23 : -0.23;
    const m = new Mesh(), v = [[x - 0.08, y, z - 0.35], [x, y + h, z - 0.10], [x + 0.08, y + h * 0.8, z + 0.1], [x + 0.08, y, z + 0.35]].map(p => m.v(...p));
    m.quad(...v); g.mesh(m, [0.64, 0.36 + i * 0.009, 0.18]);
  }
  for (const side of [-1, 1]) for (const z of [4.65, 5.1]) g.tube([[0, 1.5, z], [side * 0.8, 1.9, z + 0.22]], k => k ? 0.015 : 0.13, [0.74, 0.68, 0.45], 3);
  for (const side of [-1, 1]) g.ellipsoid([side * 0.29, 1.45, -3.35], [0.07, 0.07, 0.08], [0.045, 0.04, 0.02], 0, 1);
  return g.finish();
}

function allosaurus() {
  const g = new Geometry(), skin = [0.42, 0.29, 0.16], belly = [0.57, 0.46, 0.28], dark = [0.25, 0.19, 0.12];
  g.ellipsoid([0, 2.5, 0], [0.8, 0.9, 1.65], skin);
  g.tube([[0, 2.6, -0.9], [0, 3.2, -1.8], [0, 3.4, -2.6]], k => [0.60, 0.43, 0.38][k], skin);
  g.ellipsoid([0, 3.5, -2.9], [0.44, 0.46, 0.85], skin);
  g.ellipsoid([0, 3.14, -3.04], [0.35, 0.11, 0.70], belly);
  g.box([0, 3.28, -3.4], [0.63, 0.045, 0.74], [0.11, 0.055, 0.035]);
  for (const side of [-1, 1]) {
    const joint = side > 0 ? 1 : 2;
    g.tube([[side * 0.58, 2.45, 0.3], [side * 0.73, 1.32, -0.38], [side * 0.66, 0.48, 0.42], [side * 0.65, 0.18, 0]], k => [0.44, 0.30, 0.15, 0.15][k], skin, joint);
    g.ellipsoid([side * 0.65, 0.14, -0.25], [0.24, 0.14, 0.58], dark, joint, 1);
    g.tube([[side * 0.53, 2.8, -1], [side * 0.9, 2.18, -1.3], [side * 0.74, 2.02, -1.65]], k => [0.17, 0.12, 0.06][k], skin);
    g.ellipsoid([side * 0.38, 3.63, -3.06], [0.075, 0.075, 0.09], [0.025, 0.028, 0.012], 0, 1);
    g.ellipsoid([side * 0.32, 3.95, -2.95], [0.11, 0.14, 0.23], [0.62, 0.33, 0.13], 0, 1);
    for (let i = 0; i < 6; i++) g.tube([[side * 0.29, 3.25, -3.65 + i * 0.17], [side * 0.27, 3.12, -3.65 + i * 0.17]], k => k ? 0.005 : 0.035, [0.83, 0.78, 0.6]);
  }
  g.tube([[0, 2.6, 1], [0, 2.55, 2.5], [0, 2.7, 4.4], [0, 2.8, 5.7]], k => [0.64, 0.38, 0.15, 0.015][k], skin, 3);
  for (let i = 0; i < 7; i++) g.ellipsoid([0, 3.19, -0.8 + i * 0.4], [0.61, 0.12, 0.09], dark, 0, 1);
  return g.finish();
}

function cryptoclidus() {
  const g = new Geometry(), skin = [0.18, 0.34, 0.35], belly = [0.57, 0.64, 0.52];
  g.ellipsoid([0, 0, 0], [0.77, 0.54, 1.5], skin);
  g.ellipsoid([0, -0.23, -0.1], [0.64, 0.30, 1.35], belly);
  g.tube([[0, 0.1, -1], [0, 0.23, -2.2], [0, 0.43, -3.4], [0, 0.45, -4.15]], k => [0.36, 0.24, 0.17, 0.15][k], skin, 4);
  g.ellipsoid([0, 0.45, -4.35], [0.22, 0.19, 0.43], skin, 4);
  g.tube([[0, 0, 1.2], [0, -0.03, 2.3]], k => k ? 0.015 : 0.3, skin, 3);
  for (const side of [-1, 1]) for (const end of [-1, 1]) {
    g.ellipsoid([side * 1.05, -0.18, end * 0.85 + 0.3], [1.08, 0.1, 0.40], skin, side > 0 ? 6 : 7);
  }
  for (const side of [-1, 1]) g.ellipsoid([side * 0.18, 0.52, -4.47], [0.04, 0.04, 0.05], [0.015, 0.025, 0.02], 4, 1);
  return g.finish();
}

export function makeWorld() {
  rseed(410);
  const meshes = { terrain: terrainMesh(), tree: conifer(), fern: fern(), weed: fern(true), stego: stegosaurus(), allo: allosaurus(), crypto: cryptoclidus() };
  const rock = new Geometry(); rock.mesh(icosphere(2, (x, y, z) => { const r = 1 + (fbm(x * 2, y * 2, z * 2, 2) - 0.5) * 0.5; return [x * r, y * r * 0.8, z * r]; }), [0.34, 0.35, 0.28]); meshes.rock = rock.finish();
  const box = new Geometry(); box.box([0, 0.5, 0], [1.2, 0.8, 0.9], [0.24, 0.18, 0.10]); box.box([0, 0.94, 0], [1.3, 0.13, 0.98], [0.45, 0.37, 0.21]); box.box([0, 1.02, 0], [0.17, 0.03, 0.8], [0.83, 0.72, 0.42]); meshes.cache = box.finish();
  const objects = [], colliders = [];
  const add = (mesh, x, z, scale = 1, yaw = 0, extra = {}) => { const o = { mesh, x, y: ground(x, z), z, scale, yaw, ...extra }; objects.push(o); return o; };
  for (let i = 0; i < 730; i++) {
    const x = rr(-177, 76), z = rr(-130, 132), h = ground(x, z);
    if (h < 5.2 || Math.hypot(x - SPAWN.x, z - SPAWN.z) < 16 || Math.hypot(x - SPRING.x, z - SPRING.z) < 8 || Math.hypot(x - 22, z + 9) < 15 || Math.hypot(x + 26, z + 20) < 20) continue;
    const size = rr(0.65, 1.4); add('tree', x, z, size, rnd() * Math.PI * 2); colliders.push({ x, z, radius: 0.6 * size });
  }
  for (let i = 0; i < 1700; i++) {
    const x = rr(-180, 160), z = rr(-170, 170), h = ground(x, z);
    if (h > 5 && h < 34 && Math.hypot(x - SPRING.x, z - SPRING.z) > 5) add('fern', x, z, rr(0.6, 1.5), rnd() * Math.PI * 2);
    else if (h < -2 && h > -28) add('weed', x, z, rr(0.8, 2.6), rnd() * Math.PI * 2);
  }
  for (let i = 0; i < 380; i++) {
    const x = rr(-200, 200), z = rr(-200, 200), scale = rr(0.4, 2.9);
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 9 || Math.hypot(x - SPRING.x, z - SPRING.z) < 7) continue;
    add('rock', x, z, scale, rnd() * Math.PI * 2);
    if (ground(x, z) > 0 && scale > 1) colliders.push({ x, z, radius: scale * 0.85 });
  }
  add('cache', CACHE.x, CACHE.z, 1.15, 0.4);
  const springY = ground(SPRING.x, SPRING.z) + 0.7;
  const pool = new Geometry(), center = pool.vertex([0, 0, 0], [0, 1, 0], [.045, .34, .35]);
  for (let i = 0; i <= 32; i++) { const a = i / 32 * Math.PI * 2; pool.vertex([Math.cos(a) * 2.8, 0, Math.sin(a) * 2.8], [0, 1, 0], [.065, .38, .34]); if (i) pool.tri(center, i + 1, i); }
  meshes.spring = pool.finish(); add('spring', SPRING.x, SPRING.z, 1, 0, { y: springY });
  return { meshes, objects, colliders, springY };
}

export function makeCreatures() {
  const list = [];
  const add = (species, x, z, scale, yaw) => list.push({ species, mesh: ['stego', 'allo', 'crypto'][species], x, z, y: species === 2 ? -4 : ground(x, z), homeX: x, homeZ: z, scale, yaw, phase: list.length * 1.9, state: 'Wandering', speed: 0, timer: 2, cooldown: 0, targetX: x, targetZ: z });
  add(0, 22, -9, 1, -0.3); add(0, 11, -17, 0.82, 1.3); add(0, 30, -18, 0.63, -1);
  add(1, -27, -22, 1.05, 0.5);
  add(2, 132, 25, 1.3, 1.4); add(2, 141, 38, 0.9, 0.4);
  return list;
}
