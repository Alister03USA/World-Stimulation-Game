import { icosphere, rnd, rr, rseed, fbm, clamp } from '../src/math.js';
import { Geometry } from './geometry.js';
import { detailedAnimals } from './assets.js';
import { ground, makeTerrainTiles } from './terrain.js';
import { LIMIT, SPAWN, SPRING, WATER_SOURCES, CACHES, LANDMARKS, regionAt } from './geography.js';
import { indexColliders } from './spatial.js';
export * from './geography.js';
export { ground, terrainHeight, heights } from './terrain.js';
import { makeConifer, makeFern, makeCycad, makeGinkgo, makeHorsetail } from './plants.js';
import { forestHabitat, detailHash, FOREST_GROVES } from './habitat.js';
import { dressLandscape } from './landscape.js';

export const SPECIES = [
  { name: 'Stegosaurus', mesh: 'stego', role: 'browser', kind: 'Herbivore', material: 1, radius: 5.5, viewHeight: 2, detail: 'A Late Jurassic plated browser with a small head and four tail spikes. Keep clear of its tail.', color: '#c7d59b' },
  { name: 'Allosaurus', mesh: 'allo', role: 'hunter', kind: 'Predator', material: 3, radius: 5, viewHeight: 2.6, detail: 'A Late Jurassic theropod with three-fingered hands and crests above its eyes. Keep your distance.', color: '#e5a66b' },
  { name: 'Cryptoclidus', mesh: 'crypto', role: 'marine', kind: 'Marine reptile', material: 3, radius: 5, viewHeight: 0, detail: 'A Middle Jurassic plesiosaur propelled by four flippers. A marine reptile, not a dinosaur.', color: '#8ed1cf' },
  { name: 'Brachiosaurus', mesh: 'brachio', role: 'giant', kind: 'High browser', material: 2, radius: 16, viewHeight: 7, detail: 'A Late Jurassic sauropod with long forelimbs and an elevated neck. Its reconstruction remains partly uncertain.', color: '#d6c69a' },
  { name: 'Diplodocus', mesh: 'diplo', role: 'giant', kind: 'Low browser', material: 3, radius: 16, viewHeight: 3, detail: 'A Late Jurassic sauropod with a low, long neck, small head and whip-like tail. Watch the whole herd from a distance.', color: '#b1c6a1' },
  { name: 'Ceratosaurus', mesh: 'cerato', role: 'hunter', kind: 'Predator', material: 3, radius: 4, viewHeight: 2.4, detail: 'A Late Jurassic carnivore with a nasal horn and a line of small bony scutes on its back.', color: '#d9ab8b' }
];
export const FLORA = [
  { name: 'Araucarian conifers', detail: 'Jurassic forests included relatives of monkey-puzzle trees. Tiered woody branches carry dense sprays of narrow leaves.' },
  { name: 'Ginkgo relatives', detail: 'Ginkgo lineages diversified in the Jurassic. Fan-shaped leaves form a distinct open canopy; this is a lineage-inspired reconstruction.' },
  { name: 'Cycad relatives', detail: 'Seed plants with short trunks, stiff pinnate leaves and cones. They are not palms and must not be treated as edible forage.' },
  { name: 'Tree ferns', detail: 'Tall fern crowns mark damp, sheltered areas. Their fronds unroll from curled young growth.' },
  { name: 'Ground ferns', detail: 'Divided fronds fill the shaded forest floor. No flowering plants or modern lawn grass are used in this habitat.' },
  { name: 'Horsetails', detail: 'Ancient relatives of Equisetum occupy wet margins. Recognizable by jointed stems and whorls of fine branches.' }
];

export function makeWorld() {
  rseed(410);
  const meshes = { tree: makeConifer(), coniferBroad: makeConifer(1), ginkgo: makeGinkgo(), fern: makeFern(), fern_detail: makeFern(false, false, true), treefern: makeFern(true), treefern_detail: makeFern(true, false, true), cycad: makeCycad(), horsetail: makeHorsetail(), weed: makeFern(false, true), ...detailedAnimals() };
  const rock = new Geometry(); rock.mesh(icosphere(2, (x, y, z) => { const r = 1 + (fbm(x * 2, y * 2, z * 2, 2) - 0.5) * 0.5; return [x * r, y * r * 0.8, z * r]; }), [0.34, 0.35, 0.28], 41); meshes.rock = rock.finish();
  const box = new Geometry(); box.box([0, 0.5, 0], [1.2, 0.8, 0.9], [0.24, 0.18, 0.10]); box.box([0, 0.94, 0], [1.3, 0.13, 0.98], [0.45, 0.37, 0.21]); box.box([0, 1.02, 0], [0.17, 0.03, 0.8], [0.83, 0.72, 0.42]); meshes.cache = box.finish();
  const objects = [], colliders = [];
  for (const tile of makeTerrainTiles()) { meshes[tile.name] = tile.mesh; objects.push({ mesh: tile.name, x: tile.x, y: tile.y, z: tile.z }); }
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
  const routes = [[50, 30, -125, 35], [-125, 35, -210, 20], [-210, 20, -265, 40], [-210, 20, -185, 140], [-185, 140, -165, 270], [-210, 20, -300, -100], [-300, -100, -350, -230]];
  const nearRoute = (x, z) => routes.some(([ax, az, bx, bz]) => { const t = clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2), 0, 1); return Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t) < 5; });
  const regionalClearings = [[-300, 40, 24], [-310, 90, 26], [-125, 235, 14], [-305, -300, 15], [-180, 250, 25], [-350, -220, 30], [-410, -140, 26], ...LANDMARKS.map(p => [p.x, p.z, 15])];
  const clear = (x, z) => nearRoute(x, z) || WATER_SOURCES.some(p => Math.hypot(x - p.x, z - p.z) < 12) || CACHES.some(p => Math.hypot(x - p.x, z - p.z) < 7) || regionalClearings.some(p => Math.hypot(x - p[0], z - p[1]) < p[2]);
  for (let i = 0; i < 7000; i++) {
    const x = rr(-555, 470), z = rr(-495, 500), h = ground(x, z), region = regionAt(x, z, h);
    if (Math.hypot(x, z) < 205 || Math.hypot(x, z) > LIMIT - 20 || h < (region === 'Fern wetlands' ? .8 : 6) || clear(x, z)) continue;
    const scale = rr(.8, 1.35), type = region === 'Fern wetlands' ? 'treefern' : rnd() > .82 ? 'ginkgo' : 'tree';
    add(type, x, z, scale, rnd() * 6.28); colliders.push({ x, z, radius: (type === 'tree' ? .6 : type === 'ginkgo' ? .43 : .22) * scale });
  }
  for (let i = 0; i < 22000; i++) {
    const x = rr(-560, 475), z = rr(-500, 510), h = ground(x, z);
    if (Math.hypot(x, z) < 205 || Math.hypot(x, z) > LIMIT - 15) continue;
    const region = regionAt(x, z, h), pick = rnd();
    if (h > .2 && h < 90) {
      const type = h < 4 ? pick < .65 ? 'horsetail' : 'fern' : region === 'Fern wetlands' && pick < .3 ? 'treefern' : pick < .25 ? 'cycad' : 'fern';
      if (type === 'treefern' && clear(x, z)) continue;
      add(type, x, z, rr(.65, 1.3), rnd() * 6.28); if (type === 'treefern') colliders.push({ x, z, radius: .23 });
    } else if (h < -2 && h > -18 && pick < .45) add('weed', x, z, rr(.8, 1.5), rnd() * 6.28);
  }
  for (let i = 0; i < 850; i++) {
    const x = rr(-550, 470), z = rr(-500, 500), h = ground(x, z), scale = rr(.6, 3);
    if (Math.hypot(x, z) < 205 || Math.hypot(x, z) > LIMIT - 15 || clear(x, z)) continue;
    add('rock', x, z, scale, rnd() * 6.28); if (h > 0 && scale > 1) colliders.push({ x, z, radius: scale * .85 });
  }
  for (let i = 0; i < 960; i++) {
    const center = FOREST_GROVES[i % FOREST_GROVES.length], a = detailHash(i, 6) * 6.28, r = Math.sqrt(detailHash(i, 7)) * 36, x = center[0] + Math.cos(a) * r, z = center[1] + Math.sin(a) * r, h = ground(x, z);
    if (h < 5 || clear(x, z) || clearings.some(c => Math.hypot(x - c[0], z - c[1]) < c[2]) || Math.hypot(x - SPAWN.x, z - SPAWN.z) < 12) continue;
    const slope = Math.hypot(ground(x + 1, z) - ground(x - 1, z), ground(x, z + 1) - ground(x, z - 1)) / 2;
    if (slope > .75) continue;
    const size = .72 + detailHash(i, 9) * .65, type = i % 6 === 0 ? 'ginkgo' : 'coniferBroad'; add(type, x, z, size, a); colliders.push({ x, z, radius: (type === 'ginkgo' ? .43 : .6) * size });
  }
  const forestTrees = objects.filter(o => ['tree', 'coniferBroad', 'ginkgo'].includes(o.mesh));
  for (const tree of forestTrees) for (let i = 0; i < 4; i++) {
    const a = detailHash(tree.x, tree.z, i + 41) * 6.28, r = 1.5 + detailHash(tree.x, tree.z, i + 51) * 5, x = tree.x + Math.cos(a) * r, z = tree.z + Math.sin(a) * r, h = ground(x, z);
    if (h < 2 || WATER_SOURCES.some(p => Math.hypot(x - p.x, z - p.z) < 4) || CACHES.some(p => Math.hypot(x - p.x, z - p.z) < 2.5)) continue;
    const habitat = forestHabitat(x, z, h), type = habitat.moisture > .7 && i === 0 && !clear(x, z) ? 'treefern' : 'fern';
    add(type, x, z, .45 + detailHash(x, z) * .6, a); if (type === 'treefern') colliders.push({ x, z, radius: .22 });
  }
  const arch = new Geometry();
  for (let i = 0; i < 15; i++) { const a = i / 14 * Math.PI; arch.ellipsoid([Math.cos(a) * 7, 3 + Math.sin(a) * 8, 0], [1.5, 2.2, 1.8], [.36, .32, .23], 0, 2); }
  for (const x of [-7, 7]) arch.ellipsoid([x, -2, 0], [2, 10, 2.2], [.32, .30, .23], 0, 2);
  meshes.arch = arch.finish(); add('arch', -265, 40);
  for (const x of [-272, -258]) colliders.push({ x, z: 40, radius: 2 });
  const spire = new Geometry(); spire.ellipsoid([0, 10, 0], [3.8, 12, 3], [.33, .31, .25], 0, 2); spire.ellipsoid([1.5, 5, 0], [4, 7, 4], [.29, .29, .25], 0, 2); meshes.spire = spire.finish();
  add('spire', -360, -280); colliders.push({ x: -360, z: -280, radius: 4 });
  for (let i = 0; i < 5; i++) { const x = 285 + i * 9, z = 180 + Math.sin(i * 1.7) * 8, scale = .45 + i % 2 * .12; add('spire', x, z, scale, i); colliders.push({ x, z, radius: 4 * scale }); }
  for (const cache of CACHES) add('cache', cache.x, cache.z, 1.15, .4);
  const springY = ground(SPRING.x, SPRING.z) + 0.7;
  const pool = new Geometry(), center = pool.vertex([0, 0, 0], [0, 1, 0], [.045, .34, .35]);
  for (let i = 0; i <= 32; i++) { const a = i / 32 * Math.PI * 2; pool.vertex([Math.cos(a) * 2.8, 0, Math.sin(a) * 2.8], [0, 1, 0], [.065, .38, .34]); if (i) pool.tri(center, i + 1, i); }
  meshes.spring = pool.finish();
  for (const source of WATER_SOURCES) { add('spring', source.x, source.z, 1, 0, { y: ground(source.x, source.z) + .7 }); if (source.id !== 'coast') for (let i = 0; i < 22; i++) { const a = i * 2.399, r = 4.5 + i % 3; add('horsetail', source.x + Math.cos(a) * r, source.z + Math.sin(a) * r); } }
  dressLandscape(meshes, objects, colliders, clear);
  for (const name of ['arch', 'spire']) for (let i = 9; i < meshes[name].vertices.length; i += 16) meshes[name].vertices[i] = 41;
  for (const o of objects) if (o.mesh === 'fern' || o.mesh === 'treefern') o.detailMesh = o.mesh + '_detail';
  for (const o of objects) if (o.mesh === 'tree' || o.mesh === 'coniferBroad') {
    const c = Math.cos(o.yaw), s = Math.sin(o.yaw), r = 2 * o.scale;
    o.feet = [[c, -s], [-c, s], [s, c], [-s, -c]].map(([dx, dz]) => (ground(o.x + dx * r, o.z + dz * r) - o.y) / o.scale);
  }
  const lookup = new Map(objects.map(o => [`${o.x},${o.z}`, o])), modelHeights = { tree: 25, coniferBroad: 25, ginkgo: 20, treefern: 5 }, bounds = {};
  for (const name of ['rock', 'spire']) { let radius = 0, top = 0; const v = meshes[name].vertices; for (let i = 0; i < v.length; i += 16) { radius = Math.max(radius, Math.hypot(v[i], v[i + 2])); top = Math.max(top, v[i + 1]); } bounds[name] = { radius, top }; }
  for (const c of colliders) { if (Number.isFinite(c.top) && Number.isFinite(c.bottom)) continue; const o = lookup.get(`${c.x},${c.z}`), bound = o && bounds[o.mesh], scale = o?.scale || 1; if (bound) c.radius = bound.radius * scale; c.bottom = ground(c.x, c.z) - .6; c.top = ground(c.x, c.z) + (o ? (bound?.top || modelHeights[o.mesh] || 14) * scale : 14); }
  return { meshes, objects, colliders: indexColliders(colliders), springY };
}

export function makeCreatures() {
  const list = [];
  const add = (species, x, z, scale, yaw, herd = 'coast-' + species) => list.push({ id: list.length, herd, species, mesh: SPECIES[species].mesh, role: SPECIES[species].role, material: SPECIES[species].material, radius: SPECIES[species].radius, x, z, y: SPECIES[species].role === 'marine' ? -4 : ground(x, z), homeX: x, homeZ: z, scale, yaw, pitch: 0, roll: 0, phase: list.length * 1.9, gait: list.length * 1.9, gaitStrength: 0, anchors: [], footDrift: new Array(8).fill(0), stuckTime: 0, recoverTime: 0, escapeTarget: null, avoidYaw: undefined, stride: species === 3 ? 1.5 : species === 4 ? 1.25 : 1, stepHeight: species === 3 ? .24 : .18, feet: [0, 0, 0, 0], bodyRadius: (species === 3 ? 1.7 : species === 4 ? 1.4 : .8) * scale, state: 'Resting', speed: 0, timer: 2 + list.length % 4 * 3, decisions: 0, cooldown: 0, memory: 0, searchTime: 0, attackWindup: 0, headPose: 0, thirst: .25 + list.length % 3 * .06, drinkTime: 0, targetX: x, targetZ: z });
  add(0, 42, 16, 1, -1.1); add(0, 33, 4, .83, .8); add(0, 48, 7, .58, -.3);
  add(1, -27, -22, 1.05, 0.5);
  add(2, 132, 25, 1.3, 1.4); add(2, 141, 38, 0.9, 0.4);
  add(3, 7, -30, 1.08, -1.1); add(3, -4, -39, .78, -.4);
  add(4, -54, 30, .91, 1.1); add(4, -65, 39, .7, 1.5);
  add(5, -74, -24, .91, .5);
  for (const [species, x, z, count, herd] of [[0, -300, 40, 3, 'river-stego'], [4, -310, 90, 3, 'river-diplo'], [0, -180, 250, 3, 'marsh-stego'], [5, -125, 235, 1, 'marsh-hunter'], [3, -350, -220, 3, 'upland-brachio'], [1, -305, -300, 1, 'upland-hunter'], [4, -410, -140, 2, 'western-diplo'], [2, 330, 170, 3, 'lagoon-marine'], [2, 160, 140, 2, 'outer-marine']]) {
    for (let i = 0; i < count; i++) add(species, x + Math.sin(i * 2.4) * 9, z + i * 8, i ? .72 + i * .06 : 1.04, i * .7, herd);
  }
  return list;
}
