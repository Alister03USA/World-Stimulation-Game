import { fbm, sstep, clamp } from '../src/math.js';
import { riverX, regionAt } from './geography.js';

// A continuous field shared by planting and ground shading; no modern lawn-grass biome.
export const FOREST_GROVES = [[-122, 65], [-128, -28], [10, 80], [-72, -90], [-280, -95], [-385, -210], [-290, 180], [-205, 290]];
export function forestHabitat(x, z, height, slope = 0) {
  const region = regionAt(x, z, height), river = 1 - sstep(15, 85, Math.abs(x - riverX(z)));
  const moisture = clamp((region === 'Fern wetlands' ? .72 : .24) + river * .35 + fbm(x * .017, 31, z * .017, 2) * .3, 0, 1);
  const clusters = Math.max(...FOREST_GROVES.map(([gx, gz]) => 1 - sstep(18, 43, Math.hypot(x - gx, z - gz))));
  const groves = Math.max(sstep(.30, .65, fbm(x * .013, 17, z * .013, 3)), clusters * .96);
  const canopy = groves * sstep(3, 8, height) * (1 - sstep(.6, 1.4, slope));
  return { canopy, moisture, rock: sstep(.48, 1.05, slope), region };
}
export const detailHash = (x, z, seed = 0) => { const n = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453; return n - Math.floor(n); };
