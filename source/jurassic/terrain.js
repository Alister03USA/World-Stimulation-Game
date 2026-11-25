import { fbm, clamp, mix, sstep } from '../src/math.js';
import { Geometry } from './geometry.js';
import { SPRING, MAP_SPAN, WATER_SOURCES, riverX, regionAt } from './geography.js';
import { forestHabitat } from './habitat.js';

// Keep the original coast and triangulation near the player start; new land joins to the west.
export function coastHeight(x, z) {
  const dx = (x + 45) / 1.1, dz = z * .95, r = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
  const edge = 114 + Math.sin(a * 3) * 7 + Math.sin(a * 5 + 1) * 4, inland = edge - r;
  let h = clamp(inland * .24, -34, 24);
  h += (fbm(x * .018, 3, z * .018, 3) - .48) * 17 * sstep(2, 32, inland);
  h += 25 * Math.exp(-((x + 78) ** 2 + (z + 62) ** 2) / 1000);
  h += (fbm(x * .09, 8, z * .09, 2) - .5) * 1.3 * sstep(1, 12, Math.abs(inland));
  return h - 1.5 * (1 - sstep(1.8, 4.2, Math.hypot(x - SPRING.x, z - SPRING.z)));
}
export function terrainHeight(x, z) {
  const old = coastHeight(x, z), extension = Math.max(sstep(140, 205, -x), sstep(140, 215, Math.abs(z)));
  const r = Math.hypot((x + 240) / 300, (z + 30) / 440), inland = (1 - r) * 300;
  let land = clamp(inland * .22, -38, 32) + (fbm(x * .009, 12, z * .009, 3) - .5) * 14 * sstep(2, 35, inland);
  land += 65 * Math.exp(-((x + 350) ** 2 / 13000 + (z + 270) ** 2 / 17000));
  land += 24 * Math.exp(-((x + 435) ** 2 / 6000 + (z - 100) ** 2 / 18000));
  const river = Math.abs(x - riverX(z)), channel = 1 - sstep(305, 345, Math.abs(z + 5));
  const ford = 1 - sstep(3, 10, Math.abs(z - 40));
  land = mix(land, Math.min(land, mix(mix(-2.8, -.35, ford), 15, sstep(4, 58, river))), channel * (1 - sstep(52, 100, river)));
  const marsh = 1 - sstep(.65, 1, Math.hypot((x + 200) / 150, (z - 290) / 110));
  land = mix(land, Math.min(land, .8 + fbm(x * .045, 2, z * .045, 2) * 3.2), marsh);
  let h = mix(old, Math.max(old, land), extension);
  for (const [px, pz, radius] of [[-210, 315, 38], [-110, 265, 27]]) h = Math.min(h, mix(-.9, h, sstep(radius * .58, radius, Math.hypot(x - px, z - pz))));
  const lagoon = Math.hypot(x - 300, z - 180), basin = 1 - sstep(100, 150, lagoon);
  h = mix(h, -9 - lagoon * .035 + fbm(x * .035, 0, z * .035, 2) * 2.5, basin);
  for (const [px, pz] of [[300, 85], [395, 180], [280, 275]]) h = Math.max(h, 4 - Math.hypot(x - px, z - pz) * .40);
  for (const source of WATER_SOURCES.slice(1)) h -= 1.5 * (1 - sstep(1.8, 4.2, Math.hypot(x - source.x, z - source.z)));
  return h;
}

export const GRID = 640, STEP = 2, TILE = 32;
export const heights = new Float32Array((GRID + 1) ** 2);
for (let z = 0; z <= GRID; z++) for (let x = 0; x <= GRID; x++) heights[z * (GRID + 1) + x] = terrainHeight(x * STEP - MAP_SPAN / 2, z * STEP - MAP_SPAN / 2);
export function ground(x, z) {
  const gx = clamp((x + MAP_SPAN / 2) / STEP, 0, GRID - .0001), gz = clamp((z + MAP_SPAN / 2) / STEP, 0, GRID - .0001);
  const ix = Math.floor(gx), iz = Math.floor(gz), u = gx - ix, v = gz - iz, i = iz * (GRID + 1) + ix;
  const a = heights[i], b = heights[i + 1], c = heights[i + GRID + 1], d = heights[i + GRID + 2];
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
export function makeTerrainTiles() {
  const tiles = [];
  for (let tz = 0; tz < GRID; tz += TILE) for (let tx = 0; tx < GRID; tx += TILE) {
    const cx = (tx + TILE / 2) * STEP - MAP_SPAN / 2, cz = (tz + TILE / 2) * STEP - MAP_SPAN / 2, cy = ground(cx, cz), g = new Geometry();
    for (let z = 0; z <= TILE; z++) for (let x = 0; x <= TILE; x++) {
      const gx = tx + x, gz = tz + z, px = gx * STEP - MAP_SPAN / 2, pz = gz * STEP - MAP_SPAN / 2, h = heights[gz * (GRID + 1) + gx];
      const nx = ground(px - 1, pz) - ground(px + 1, pz), nz = ground(px, pz - 1) - ground(px, pz + 1), len = Math.hypot(nx, 2, nz);
      const n = fbm(px * .08, 5, pz * .08, 2), green = sstep(2.4, 8, h), cliff = sstep(.55, 1.7, Math.hypot(nx, nz) / 2);
      let color = [mix(.58, .12 + n * .055, green), mix(.49, .20 + n * .09, green), mix(.32, .085 + n * .04, green)];
      if (regionAt(px, pz, h) === 'Fern wetlands' && h > -1.5 && h < 6) color = [.12 + n * .08, .19 + n * .08, .065 + n * .045];
      const habitat = forestHabitat(px, pz, h, Math.hypot(nx, nz) / 2);
      color = color.map((v, k) => mix(v, [.16 + n * .045, .135 + n * .04, .065 + n * .02][k], habitat.canopy * .8));
      color = color.map((v, k) => mix(v, [.27, .29, .25][k], cliff));
      g.vertex([px - cx, h - cy, pz - cz], [nx / len, 2 / len, nz / len], color, 40, [habitat.canopy, habitat.moisture]);
      if (x < TILE && z < TILE) { const i = z * (TILE + 1) + x; g.tri(i, i + TILE + 1, i + 1); g.tri(i + 1, i + TILE + 1, i + TILE + 2); }
    }
    tiles.push({ name: `terrain_${tx}_${tz}`, x: cx, y: cy, z: cz, mesh: g.finish() });
  }
  return tiles;
}
