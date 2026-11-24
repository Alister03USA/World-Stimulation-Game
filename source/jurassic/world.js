import { icosphere, rnd, rr, rseed, fbm, clamp, mix, sstep } from '../src/math.js';
import { Geometry } from './geometry.js';
import { detailedAnimals } from './assets.js';
import { makeConifer, makeFern, makeCycad, makeGinkgo, makeHorsetail } from './plants.js';

export const SEA = 0, LIMIT = 222, DAY_SECONDS = 720;
export const SPAWN = { x: 56, z: 32, yaw: -0.9 };
export const SPRING = { x: 27, z: 12 };
export const CACHE = { x: 50, z: 30 };
export const SPECIES = [
  { name: 'Stegosaurus', mesh: 'stego', role: 'browser', kind: 'Herbivore', material: 1, radius: 5.5, viewHeight: 2, detail: 'A Late Jurassic plated browser with a small head and four tail spikes. Keep clear of its tail.', color: '#c7d59b' },
  { name: 'Allosaurus', mesh: 'allo', role: 'hunter', kind: 'Predator', material: 0, radius: 5, viewHeight: 2.6, detail: 'A Late Jurassic theropod with three-fingered hands and crests above its eyes. Keep your distance.', color: '#e5a66b' },
  { name: 'Cryptoclidus', mesh: 'crypto', role: 'marine', kind: 'Marine reptile', material: 0, radius: 5, viewHeight: 0, detail: 'A Middle Jurassic plesiosaur propelled by four flippers. A marine reptile, not a dinosaur.', color: '#8ed1cf' },
  { name: 'Brachiosaurus', mesh: 'brachio', role: 'giant', kind: 'High browser', material: 2, radius: 16, viewHeight: 7, detail: 'A Late Jurassic sauropod with long forelimbs and an elevated neck. Its reconstruction remains partly uncertain.', color: '#d6c69a' },
  { name: 'Diplodocus', mesh: 'diplo', role: 'giant', kind: 'Low browser', material: 0, radius: 16, viewHeight: 3, detail: 'A Late Jurassic sauropod with a low, long neck, small head and whip-like tail. Watch the whole herd from a distance.', color: '#b1c6a1' },
  { name: 'Ceratosaurus', mesh: 'cerato', role: 'hunter', kind: 'Predator', material: 0, radius: 4, viewHeight: 2.4, detail: 'A Late Jurassic carnivore with a nasal horn and a line of small bony scutes on its back.', color: '#d9ab8b' }
];
export const FLORA = [
  { name: 'Araucarian conifers', detail: 'Jurassic forests included relatives of monkey-puzzle trees. Tiered woody branches carry dense sprays of narrow leaves.' },
  { name: 'Ginkgo relatives', detail: 'Ginkgo lineages diversified in the Jurassic. Fan-shaped leaves form a distinct open canopy; this is a lineage-inspired reconstruction.' },
  { name: 'Cycad relatives', detail: 'Seed plants with short trunks, stiff pinnate leaves and cones. They are not palms and must not be treated as edible forage.' },
  { name: 'Tree ferns', detail: 'Tall fern crowns mark damp, sheltered areas. Their fronds unroll from curled young growth.' },
  { name: 'Ground ferns', detail: 'Divided fronds fill the shaded forest floor. No flowering plants or modern lawn grass are used in this habitat.' },
  { name: 'Horsetails', detail: 'Ancient relatives of Equisetum occupy wet margins. Recognizable by jointed stems and whorls of fine branches.' }
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

export function makeWorld() {
  rseed(410);
  const meshes = { terrain: terrainMesh(), tree: makeConifer(), ginkgo: makeGinkgo(), fern: makeFern(), treefern: makeFern(true), cycad: makeCycad(), horsetail: makeHorsetail(), weed: makeFern(false, true), ...detailedAnimals() };
  const rock = new Geometry(); rock.mesh(icosphere(2, (x, y, z) => { const r = 1 + (fbm(x * 2, y * 2, z * 2, 2) - 0.5) * 0.5; return [x * r, y * r * 0.8, z * r]; }), [0.34, 0.35, 0.28]); meshes.rock = rock.finish();
  const box = new Geometry(); box.box([0, 0.5, 0], [1.2, 0.8, 0.9], [0.24, 0.18, 0.10]); box.box([0, 0.94, 0], [1.3, 0.13, 0.98], [0.45, 0.37, 0.21]); box.box([0, 1.02, 0], [0.17, 0.03, 0.8], [0.83, 0.72, 0.42]); meshes.cache = box.finish();
  const objects = [], colliders = [];
  const add = (mesh, x, z, scale = 1, yaw = 0, extra = {}) => { const o = { mesh, x, y: ground(x, z), z, scale, yaw, ...extra }; objects.push(o); return o; };
  const clearings = [[42, 13, 17], [7, -30, 23], [-54, 30, 23], [-74, -24, 15], [-27, -22, 18]];
  for (let i = 0; i < 520; i++) {
    const x = rr(-177, 76), z = rr(-130, 132), h = ground(x, z);
    if (h < 5.2 || Math.hypot(x - SPAWN.x, z - SPAWN.z) < 15 || Math.hypot(x - SPRING.x, z - SPRING.z) < 8 || clearings.some(c => Math.hypot(x - c[0], z - c[1]) < c[2])) continue;
    const size = rr(0.70, 1.35), type = rnd() > .78 ? 'ginkgo' : 'tree'; add(type, x, z, size, rnd() * Math.PI * 2); colliders.push({ x, z, radius: (type === 'tree' ? .6 : .43) * size });
  }
  for (let i = 0; i < 1700; i++) {
    const x = rr(-180, 160), z = rr(-170, 170), h = ground(x, z);
    if (h > 4 && h < 34 && Math.hypot(x - SPRING.x, z - SPRING.z) > 5) {
      const pick = rnd(), type = pick < .12 ? 'treefern' : pick < .32 ? 'cycad' : 'fern';
      add(type, x, z, rr(.65, 1.3), rnd() * Math.PI * 2);
      if (type === 'treefern') colliders.push({ x, z, radius: .22 });
    } else if (h < -2 && h > -28) add('weed', x, z, rr(.6, 1.4), rnd() * Math.PI * 2);
    else if (h > .3 && h < 4) add('horsetail', x, z, rr(.75, 1.4), rnd() * Math.PI * 2);
  }
  for (let i = 0; i < 55; i++) { const a = rnd() * Math.PI * 2, r = rr(3.8, 7); add('horsetail', SPRING.x + Math.cos(a) * r, SPRING.z + Math.sin(a) * r, rr(.8, 1.15), a); }
  for (let i = 0; i < 380; i++) {
    const x = rr(-200, 200), z = rr(-200, 200), scale = rr(0.4, 2.9);
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 9 || Math.hypot(x - SPRING.x, z - SPRING.z) < 7 || clearings.some(c => Math.hypot(x - c[0], z - c[1]) < c[2] * .7)) continue;
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
  const add = (species, x, z, scale, yaw) => list.push({ species, mesh: SPECIES[species].mesh, role: SPECIES[species].role, material: SPECIES[species].material, radius: SPECIES[species].radius, x, z, y: SPECIES[species].role === 'marine' ? -4 : ground(x, z), homeX: x, homeZ: z, scale, yaw, phase: list.length * 1.9, state: 'Wandering', speed: 0, timer: 2, cooldown: 0, targetX: x, targetZ: z });
  add(0, 42, 16, 1, -1.1); add(0, 33, 4, .83, .8); add(0, 48, 7, .58, -.3);
  add(1, -27, -22, 1.05, 0.5);
  add(2, 132, 25, 1.3, 1.4); add(2, 141, 38, 0.9, 0.4);
  add(3, 7, -30, 1.08, -1.1); add(3, -4, -39, .78, -.4);
  add(4, -54, 30, .91, 1.1); add(4, -65, 39, .7, 1.5);
  add(5, -74, -24, .91, .5);
  return list;
}
