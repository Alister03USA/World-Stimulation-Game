import { Geometry } from './geometry.js';
import { ground } from './terrain.js';
import { SPAWN, CACHES, WATER_SOURCES } from './geography.js';
import { detailHash as hash } from './habitat.js';
import { nearby } from './spatial.js';
import { placementSite, placementCheck } from './camping.js';

const wood = [.27, .18, .085], stone = [.36, .37, .31];
function campMesh(type) {
  const g = new Geometry();
  if (type === 'tent') {
    for (const s of [-1, 1]) {
      const a = g.vertex([s * 1.4, .15, -1.4], [s * .8, .6, 0], [.31, .30, .17]), b = g.vertex([s * 1.4, .15, 1.4], [s * .8, .6, 0], [.27, .28, .14]), c = g.vertex([0, 2.1, 1.4], [s * .8, .6, 0], [.39, .38, .21]), d = g.vertex([0, 2.1, -1.4], [s * .8, .6, 0], [.38, .37, .20]); g.quad(a, b, c, d);
      g.tube([[s * 1.4, .15, -1.4], [0, 2.1, -1.4], [-s * 1.4, .15, -1.4]], .045, wood, 42, 8);
      g.tube([[s * 1.4, .15, 1.4], [0, 2.1, 1.4], [-s * 1.4, .15, 1.4]], .045, wood, 42, 8);
    }
    const a = g.vertex([-1.4, .15, 1.4], [0, 0, 1], [.28, .28, .15]), b = g.vertex([1.4, .15, 1.4], [0, 0, 1], [.28, .28, .15]), c = g.vertex([0, 2.1, 1.4], [0, 0, 1], [.34, .33, .18]); g.tri(a, b, c);
    g.tube([[0, 2.1, -1.5], [0, 2.1, 1.5]], .055, wood, 42, 8);
    for (let i = 0; i < 4; i++) { const [x, z] = [[-1.4, -1.4], [1.4, -1.4], [1.4, 1.4], [-1.4, 1.4]][i]; g.tube([[x, -.6, z], [x, .35, z]], .06, wood, 48 + i, 8); }
    g.box([0, .09, 0], [1.6, .08, 2.2], [.23, .23, .12]);
  } else if (type === 'fire') {
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; g.ellipsoid([Math.cos(a) * .58, .12, Math.sin(a) * .58], [.18, .15, .15], stone, 41, 1); }
    for (let i = 0; i < 4; i++) { const a = i * 2.4; g.tube([[-Math.cos(a) * .4, .12, -Math.sin(a) * .4], [Math.cos(a) * .4, .23, Math.sin(a) * .4]], .075, [.18, .11, .045], 44, 7); }
    g.tube([[-.72, .05, 0], [-.55, 1.05, 0], [.55, 1.05, 0], [.72, .05, 0]], .035, wood, 42, 6);
    g.ellipsoid([0, .67, 0], [.26, .18, .26], [.12, .13, .105], 0, 2);
  } else { g.box([0, .4, 0], [1.25, .8, .85], wood); g.box([0, .83, 0], [1.34, .12, .93], [.37, .27, .13]); for (const x of [-.42, .42]) g.box([x, .42, -.44], [.055, .75, .025], [.15, .13, .08]); }
  return g.finish();
}
function resourceMesh(item, large = false) {
  const g = new Geometry();
  if (item === 'stone') for (let i = 0; i < 4; i++) g.ellipsoid([Math.cos(i * 2.4) * .23, .09, Math.sin(i * 2.4) * .23], [.18, .11, .14], stone, 41, 1);
  else for (let i = 0; i < (large ? 7 : 5); i++) { const x = (i % 3 - 1) * .13, y = .06 + Math.floor(i / 3) * .08, size = large ? 1.1 : .55; g.tube([[x - .12, y, -size], [x, y + .03, 0], [x + .08, y, size]], item === 'fiber' ? .022 : large ? .065 : .038, item === 'fiber' ? [.35, .31, .14] : wood, item === 'fiber' ? 43 : 44, 6); }
  return g.finish();
}
function toolMesh(spear) {
  const g = new Geometry(); g.tube([[0, 0, .35], [0, .04, spear ? -1.55 : -.55]], .035, wood, 42, 8);
  if (spear) g.tube([[0, .04, -1.5], [0, .04, -1.72], [0, .04, -1.95]], k => [.09, .055, .001][k], stone, 41, 6);
  else g.ellipsoid([.08, .05, -.55], [.23, .09, .13], stone, 41, 1);
  for (let i = 0; i < 5; i++) g.tube([[-.05, -.025 + i * .013, spear ? -1.5 : -.5], [.05, .075 + i * .013, spear ? -1.5 : -.5]], .009, [.43, .37, .18], 43, 5);
  return g.finish();
}
export function addAdventureWorld(world, clearings, routes) {
  const { meshes, objects, colliders } = world;
  for (const type of ['tent', 'fire', 'chest']) {
    meshes['camp_' + type] = campMesh(type);
    for (const valid of [true, false]) { const base = meshes['camp_' + type], v = base.vertices.slice(); for (let i = 0; i < v.length; i += 16) { v.set(valid ? [.16, .65, .30] : [.8, .12, .07], i + 6); v[i + 9] = 46; } meshes[`preview_${type}_${valid}`] = { vertices: v, indices: base.indices }; }
  }
  meshes.resource_wood = resourceMesh('wood'); meshes.resource_stone = resourceMesh('stone'); meshes.resource_fiber = resourceMesh('fiber'); meshes.resource_log = resourceMesh('wood', true);
  meshes.held_hatchet = toolMesh(false); meshes.held_spear = toolMesh(true);
  const flame = new Geometry(); flame.ellipsoid([0, .3, 0], [.16, .4, .16], [1, .32, .025], 52, 2); meshes.camp_flame = flame.finish();
  const smoke = new Geometry(); smoke.ellipsoid([0, 0, 0], [.16, .24, .16], [.27, .29, .25], 53, 1); meshes.camp_smoke = smoke.finish();
  const branch = new Geometry();
  for (let i = 0; i < 5; i++) branch.tube([[0, 1 + i, 0], [.9, 1.1 + i, .05]], k => k ? .055 : .13, wood, 42, 8);
  branch.tube([[0, 5.9, -.3], [1.3, 5.9, -.3]], .16, wood, 42, 10); branch.tube([[0, 5.9, .3], [1.3, 5.9, .3]], .16, wood, 42, 10); meshes.climb_branches = branch.finish();
  const nodes = [], climbs = [], reserved = [];
  const safe = (x, z) => ground(x, z) > .8 && WATER_SOURCES.every(p => Math.hypot(x - p.x, z - p.z) > 4) && CACHES.every(p => Math.hypot(x - p.x, z - p.z) > 2) && nearby(colliders, x, z, .7).every(c => Math.hypot(x - c.x, z - c.z) > c.radius + .7);
  const node = (id, item, x, z, large = false) => { const n = { id, item, x, z, y: ground(x, z), yield: large ? 6 : item === 'fiber' ? 4 : 3, requires: large ? 'hatchet' : null }; nodes.push(n); objects.push({ mesh: large ? 'resource_log' : 'resource_' + item, ...n, yaw: hash(x, z) * 6.28, resourceId: id }); };
  let starter = 0;
  for (let i = 0; i < 500 && starter < 24; i++) { const a = i * 2.399, r = 5 + i * .06, x = SPAWN.x + Math.sin(a) * r, z = SPAWN.z + Math.cos(a) * r; if (!safe(x, z) || nodes.some(n => Math.hypot(x - n.x, z - n.z) < 2)) continue; node('starter-' + starter, ['wood', 'stone', 'fiber'][starter % 3], x, z); starter++; }
  for (let i = 0; i < 700; i++) { const x = -500 + hash(i, 202) * 960, z = -450 + hash(i, 203) * 900; if (safe(x, z)) node('field-' + i, ['wood', 'stone', 'fiber'][i % 3], x, z, i % 9 === 0); }
  for (const [i, log] of objects.filter(o => o.mesh === 'deadwood').entries()) { const x = log.x + 1.5, z = log.z; if (safe(x, z)) node('timber-' + i, 'wood', x, z, true); }
  const trees = objects.filter(o => ['tree', 'coniferBroad'].includes(o.mesh)).sort((a, b) => Math.hypot(a.x - SPAWN.x, a.z - SPAWN.z) - Math.hypot(b.x - SPAWN.x, b.z - SPAWN.z));
  for (const tree of trees) {
    if (climbs.length >= 18 || tree.scale > 1.25 || climbs.some(t => Math.hypot(t.x - tree.x, t.z - tree.z) < 65)) continue;
    const x = tree.x + .6 * tree.scale + .62, z = tree.z; if (ground(x, z) < 1 || Math.abs(ground(x, z) - tree.y) > .5) continue;
    const id = 'climb-' + climbs.length; climbs.push({ id, x, z, y: ground(x, z), treeX: tree.x, treeZ: tree.z });
    objects.push({ mesh: 'climb_branches', x: tree.x, z: tree.z, y: ground(x, z), yaw: 0 });
    const trunk = colliders.find(c => c.x === tree.x && c.z === tree.z); if (trunk) trunk.owner = id;
  }
  const reserve = (mesh, extra = {}) => { const o = { mesh, x: 0, y: 0, z: 0, active: false, ...extra }; objects.push(o); reserved.push(o); return o; };
  const built = {}, previews = {}, tools = {};
  for (const type of ['tent', 'fire', 'chest']) { built[type] = reserve('camp_' + type); previews[type] = [reserve(`preview_${type}_true`, { noShadow: true }), reserve(`preview_${type}_false`, { noShadow: true })]; }
  for (const type of ['hatchet', 'spear']) tools[type] = reserve('held_' + type, { noShadow: true });
  const flames = Array.from({ length: 3 }, () => reserve('camp_flame', { noShadow: true })), smokes = Array.from({ length: 4 }, () => reserve('camp_smoke', { noShadow: true }));
  world.adventure = { nodes, climbs, resourceObjects: objects.filter(o => o.resourceId), staticColliders: colliders, clearings, routes, built, previews, tools, flames, smokes, reserved };
}
export function syncAdventure(g, world) {
  const a = world.adventure;
  for (const o of a.resourceObjects) o.active = !g.depleted.includes(o.resourceId);
  for (const type of ['tent', 'fire', 'chest']) { const c = g.camp[type]; a.built[type].active = !!c; if (c) Object.assign(a.built[type], c, { active: true }); for (const o of a.previews[type]) o.active = false; }
  const site = placementSite(g);
  if (site && !g.dead && !g.won) { const valid = !placementCheck(g, world, site), o = a.previews[site.type][valid ? 0 : 1]; Object.assign(o, site, { active: true }); }
  const fire = g.camp.fire, burning = fire?.burning && !g.dead && !g.won;
  a.flames.forEach((o, i) => { o.active = !!burning; if (burning) Object.assign(o, { x: fire.x + Math.sin(i * 2.4) * .12, y: fire.y + .22 + Math.sin(g.clock * 7 + i) * .06, z: fire.z + Math.cos(i * 2.4) * .12, scale: .7 + Math.sin(g.clock * 5 + i) * .2 }); });
  a.smokes.forEach((o, i) => { o.active = !!burning; if (burning) { const t = (g.clock * .28 + i * .25) % 1; Object.assign(o, { x: fire.x + t * .3, y: fire.y + 1 + t * 1.7, z: fire.z + Math.sin(t * 3) * .15, scale: .4 + t * .8 }); } });
  const p = g.player, s = Math.sin(p.yaw), c = Math.cos(p.yaw), swing = Math.sin(Math.max(0, g.toolMotion) / .45 * Math.PI);
  for (const [type, o] of Object.entries(a.tools)) { o.active = g.equipped === type && !p.climb && !g.placement && !g.dead && !g.won; Object.assign(o, { x: p.x + c * .32 + s * .47, y: p.y - .42 + swing * .10, z: p.z + s * .32 - c * .47, yaw: -p.yaw, pitch: p.pitch - swing * .4, scale: type === 'spear' ? .75 : .85 }); }
}
