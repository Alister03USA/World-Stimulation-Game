import { Geometry } from './geometry.js';
import { icosphere } from '../src/math.js';
import { ground } from './terrain.js';
import { forestHabitat, detailHash as hash } from './habitat.js';
import { WATER_SOURCES, CACHES, SPAWN } from './geography.js';

function litter() {
  const g = new Geometry();
  for (let i = 0; i < 20; i++) {
    const a = i * 2.399, r = .13 + hash(i, 0) * .8, x = Math.cos(a) * r, z = Math.sin(a) * r, length = .055 + hash(i, 2) * .16, width = length * (i < 14 ? .055 : .22);
    const color = [.19 + hash(i, 3) * .09, .135 + hash(i, 4) * .05, .055], y = .018 + hash(i, 1) * .035;
    const p = g.vertex([x, y, z], [0, 1, 0], color, 43), q = g.vertex([x + Math.cos(a) * length, y + .025, z + Math.sin(a) * length], [0, 1, 0], color, 43);
    const b = g.vertex([x + Math.cos(a) * length * .5 - Math.sin(a) * width, y, z + Math.sin(a) * length * .5 + Math.cos(a) * width], [0, 1, 0], color, 43);
    const c = g.vertex([x + Math.cos(a) * length * .5 + Math.sin(a) * width, y, z + Math.sin(a) * length * .5 - Math.cos(a) * width], [0, 1, 0], color, 43);
    g.tri(p, b, q); g.tri(p, q, c);
  }
  for (let i = 0; i < 3; i++) { const a = i * 2.4; g.tube([[Math.cos(a) * .3, .04, Math.sin(a) * .3], [Math.cos(a + .4) * .7, .055, Math.sin(a + .4) * .7]], .015, [.20, .14, .07], 44, 4); }
  for (let i = 0; i < 2; i++) for (let k = 0; k < 6; k++) for (const side of [-1, 1]) {
    const a = i * 2.4, t = k / 6, x = Math.cos(a) * t * .65 - .2, z = Math.sin(a) * t * .65, span = Math.sin(t * Math.PI) * .14;
    const color = [.23, .17, .07], p = g.vertex([x, .035, z], [0, 1, 0], color, 43), q = g.vertex([x - Math.sin(a) * side * span + Math.cos(a) * .05, .04, z + Math.cos(a) * side * span + Math.sin(a) * .05], [0, 1, 0], color, 43);
    const b = g.vertex([x + Math.cos(a) * .045, .035, z + Math.sin(a) * .045], [0, 1, 0], color, 43); g.tri(p, q, b);
  }
  return g.finish();
}
function deadwood(stump = false) {
  const g = new Geometry(), r = stump ? .43 : .32, length = stump ? 1.1 : 4.7;
  const point = (t, angle, radius) => stump ? [Math.cos(angle) * radius, t * length, Math.sin(angle) * radius] : [Math.cos(angle) * radius, .34 + Math.sin(angle) * radius, (t - .5) * length];
  for (let ring = 0; ring <= 12; ring++) for (let j = 0; j <= 16; j++) {
    const t = ring / 12, a = j / 16 * Math.PI * 2, radius = r * (1 - t * .15) * (1 + Math.sin(a * 7 + t * 5) * .07), p = point(t, a, radius);
    const n = stump ? [Math.cos(a), 0, Math.sin(a)] : [Math.cos(a), Math.sin(a), 0];
    g.vertex(p, n, [.235, .165, .085], stump ? 42 : 44);
    if (ring && j) { const k = ring * 17 + j; g.quad(k, k - 1, k - 18, k - 17); }
  }
  for (const t of [0, 1]) {
    const p = point(t, 0, 0), n = stump ? [0, t ? 1 : -1, 0] : [0, 0, t ? 1 : -1], center = g.vertex(p, n, [.36, .265, .14], 45, [0, 0]);
    for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2, q = point(t, a, r * (1 - t * .15)); g.vertex(q, n, [.39, .29, .16], 45, [Math.cos(a), Math.sin(a)]); if (i) g.tri(center, center + i, center + i + 1); }
  }
  if (!stump) g.tube([[.12, .45, .4], [.50, .85, .25], [.72, 1.03, .34]], k => [.10, .065, .006][k], [.22, .15, .075], 44, 7);
  return g.finish();
}
export function groundTransform(x, z, scale, yaw) {
  const gx = (ground(x + .5, z) - ground(x - .5, z)), gz = (ground(x, z + .5) - ground(x, z - .5));
  return { x, z, y: ground(x, z) + .018, scale, yaw, roll: Math.atan(gx * Math.cos(yaw) - gz * Math.sin(yaw)), pitch: -Math.atan(gx * Math.sin(yaw) + gz * Math.cos(yaw)) };
}
export function dressLandscape(meshes, objects, colliders, clear) {
  meshes.litter = litter(); meshes.deadwood = deadwood(); meshes.stump = deadwood(true);
  const stones = new Geometry();
  for (let i = 0; i < 7; i++) { const a = i * 2.399, r = .18 + hash(i, 0) * .16; stones.mesh(icosphere(1, (x, y, z) => [Math.cos(a) * .55 + x * r, .035 + y * r * .48, Math.sin(a) * .55 + z * r]), [.33 + i * .009, .31 + i * .006, .24], 41); }
  meshes.pebbles = stones.finish();
  const blocked = (x, z) => Math.hypot(x - SPAWN.x, z - SPAWN.z) < 2.5 || WATER_SOURCES.some(p => Math.hypot(x - p.x, z - p.z) < 3.5) || CACHES.some(p => Math.hypot(x - p.x, z - p.z) < 2);
  // Small clusters follow actual tree positions, not a uniform carpet across every biome.
  const trees = objects.filter(o => ['tree', 'coniferBroad', 'ginkgo', 'treefern'].includes(o.mesh));
  for (const tree of trees) for (let i = 0; i < 4; i++) {
    const a = hash(tree.x, tree.z, i + 8) * Math.PI * 2, r = .9 + hash(tree.x, tree.z, i + 17) * 3.8, x = tree.x + Math.cos(a) * r, z = tree.z + Math.sin(a) * r;
    if (blocked(x, z) || ground(x, z) < .6) continue;
    const transform = groundTransform(x, z, .75 + hash(x, z) * .8, a);
    if (Math.max(Math.abs(transform.roll), Math.abs(transform.pitch)) > .6) continue;
    objects.push({ mesh: 'litter', ...transform });
  }
  for (let i = 0; i < 2400; i++) {
    const x = -530 + hash(i, 19) * 970, z = -470 + hash(i, 23) * 950, h = ground(x, z);
    if (h < -.3 || h > 100 || blocked(x, z)) continue;
    const transform = groundTransform(x, z, .55 + hash(i, 29) * 1.05, hash(i, 31) * 6.28), habitat = forestHabitat(x, z, h);
    if (Math.max(Math.abs(transform.roll), Math.abs(transform.pitch)) > .55) continue;
    const wood = h > 5 && habitat.canopy > .38 && i % 7 === 0 && !clear(x, z);
    const mesh = wood ? i % 3 ? 'deadwood' : 'stump' : 'pebbles';
    objects.push({ mesh, ...transform });
    if (wood) {
      if (mesh === 'stump') colliders.push({ x, z, radius: .43 * transform.scale, bottom: h - .2, top: h + 1.2 * transform.scale });
      else for (let k = -1; k <= 1; k++) { const d = k * 1.55 * transform.scale, px = x + Math.sin(transform.yaw) * d, pz = z + Math.cos(transform.yaw) * d; colliders.push({ x: px, z: pz, radius: .53 * transform.scale, bottom: ground(px, pz) - .2, top: ground(px, pz) + 1.05 * transform.scale }); }
    }
  }
}
