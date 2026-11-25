export const SEA = 0, LIMIT = 600, MAP_SPAN = 1280, DAY_SECONDS = 720;
export const SPAWN = { x: 56, z: 32, yaw: -.9 }, SPRING = { x: 27, z: 12 }, CACHE = { x: 50, z: 30 };
export const WATER_SOURCES = [
  { id: 'coast', name: 'Coastal spring', ...SPRING }, { id: 'river', name: 'Riverbend spring', x: -210, z: 20 },
  { id: 'marsh', name: 'Fern Basin spring', x: -165, z: 270 }, { id: 'upland', name: 'Upland spring', x: -350, z: -230 }
];
export const CACHES = [
  { id: 'coast', name: 'Shoreline supply cache', ...CACHE }, { id: 'river', name: 'Riverbend provisions', x: -190, z: 15 },
  { id: 'marsh', name: 'Wetland provisions', x: -145, z: 260 }, { id: 'upland', name: 'Upland provisions', x: -330, z: -220 }
];
export const LANDMARKS = [
  { id: 'A', name: 'River Gate', x: -265, z: 40, detail: 'A natural stone arch beside the river valley. Travel west from the starting coast.' },
  { id: 'B', name: 'Needle Ridge', x: -360, z: -280, detail: 'A tall rock spire above the conifer uplands, northwest of the coast.' },
  { id: 'C', name: 'Fern Basin', x: -170, z: 280, detail: 'Tree ferns and horsetails fill the southern wetland, with freshwater and provisions nearby.' },
  { id: 'D', name: 'Lagoon Teeth', x: 300, z: 180, detail: 'Rock pinnacles rise from an offshore lagoon southeast of the coast. Bring food before swimming out.' }
];
export const REGIONS = [
  { name: 'Eastern coast', x: 56, z: 32 }, { name: 'River valley', x: -265, z: 40 },
  { name: 'Fern wetlands', x: -170, z: 280 }, { name: 'Conifer uplands', x: -360, z: -280 }, { name: 'Offshore lagoon', x: 300, z: 180 }
];
export const riverX = z => -240 + Math.sin(z * .012) * 42;
export function regionAt(x, z, h) {
  if (x > 180 && z > 30 && Math.hypot(x - 300, z - 180) < 155) return 'Offshore lagoon';
  if (z > 185 && x < 20 && x > -380) return 'Fern wetlands';
  if (z < -165 && x < -150) return 'Conifer uplands';
  if (x < -155 && Math.abs(x - riverX(z)) < 100) return 'River valley';
  if (x < -155 && h > 2) return 'Western woodland';
  return h < 0 ? 'Coastal sea' : h < 5 ? 'Eastern coast' : h > 30 ? 'Conifer highlands' : 'Fern lowlands';
}
export const nearestWater = (x, z) => WATER_SOURCES.reduce((a, b) => Math.hypot(x - a.x, z - a.z) <= Math.hypot(x - b.x, z - b.z) ? a : b);
export const isFreshwater = (x, z) => x < -155 && z > -345 && z < 340 && Math.abs(x - riverX(z)) < 65 || x < -80 && z > 190 && Math.hypot((x + 200) / 150, (z - 290) / 110) < 1;
