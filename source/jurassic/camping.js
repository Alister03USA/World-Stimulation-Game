import { ground } from './terrain.js';
import { LIMIT, WATER_SOURCES, CACHES } from './geography.js';
import { indexColliders, nearby, overlapsHeight } from './spatial.js';

export const ITEMS = { wood: 'Wood', stone: 'Stone', fiber: 'Plant fiber', provisions: 'Cooking provisions', meals: 'Cooked meals', rations: 'Rations' };
export const CAPACITY = { wood: 40, stone: 30, fiber: 40, provisions: 10, meals: 10, rations: 1000 };
export const RECIPES = {
  hatchet: { name: 'Stone hatchet', cost: { wood: 2, stone: 2, fiber: 1 } }, spear: { name: 'Defensive spear', cost: { wood: 3, stone: 1, fiber: 2 } },
  tent: { name: 'Tent', cost: { wood: 8, fiber: 8 }, radius: 2.1, half: [1.4, 1.4] },
  fire: { name: 'Campfire', cost: { wood: 4, stone: 6 }, radius: .8, half: [.65, .65] },
  chest: { name: 'Storage chest', cost: { wood: 6, fiber: 2 }, radius: .85, half: [.65, .45] }
};
export function adventureState() { return { inventory: { wood: 0, stone: 0, fiber: 0, provisions: 0, meals: 0 }, tools: { hatchet: false, spear: false }, equipped: 'hands', depleted: [], camp: {}, resting: false, toolAt: -10, toolMotion: 0, placement: null, campTasks: { gathered: false, crafted: false, built: false, cooked: false, climbed: false } }; }
const result = (ok, message, extra = {}) => ({ ok, message, ...extra });
const amount = (g, key) => key === 'rations' ? g.rations : g.inventory[key];
const add = (g, key, n) => { if (key === 'rations') g.rations += n; else g.inventory[key] += n; };
const fits = (g, changes) => Object.entries(changes).every(([key, n]) => Number.isInteger(n) && amount(g, key) + n >= 0 && amount(g, key) + n <= CAPACITY[key]);
const alive = g => !g.dead && !g.won;
const available = g => alive(g) && !g.player.climb && !g.player.swimming && g.player.y >= .9;
export function canAfford(g, type) { return !!RECIPES[type] && Object.entries(RECIPES[type].cost).every(([key, n]) => amount(g, key) >= n); }
function charge(g, type) { for (const [key, n] of Object.entries(RECIPES[type].cost)) add(g, key, -n); }
export function craft(g, type) {
  if (!alive(g) || g.player.climb) return result(false, 'Finish climbing before crafting.');
  if (!['hatchet', 'spear'].includes(type)) return result(false, 'Choose a tool recipe.');
  if (g.tools[type]) return result(false, 'You already own this tool.');
  if (!canAfford(g, type)) return result(false, 'Not enough materials for ' + RECIPES[type].name.toLowerCase() + '.');
  charge(g, type); g.tools[type] = true; g.equipped = type; g.campTasks.crafted = true; return result(true, RECIPES[type].name + ' crafted and equipped.');
}
export function equip(g, tool) {
  if (!alive(g) || g.player.climb || !['hands', 'hatchet', 'spear'].includes(tool) || tool !== 'hands' && !g.tools[tool]) return result(false, 'That tool is unavailable.');
  g.equipped = tool; return result(true, tool === 'hands' ? 'Hands equipped.' : RECIPES[tool].name + ' equipped.');
}
export function lineClear(g, world, point, ignore) {
  const p = g.player, dx = point.x - p.x, dy = point.y - p.y, dz = point.z - p.z;
  for (let i = 1; i < 12; i++) {
    const t = i / 12, x = p.x + dx * t, y = p.y + dy * t, z = p.z + dz * t;
    if (ground(x, z) > y + .04) return false;
    for (const c of nearby(world.colliders, x, z, .05)) if ((!ignore || c.owner !== ignore) && Math.hypot(x - c.x, z - c.z) < c.radius * .9 && overlapsHeight(c, y, y)) return false;
  }
  return true;
}
export function targetPoint(g, world, target) {
  const p = g.player, dx = target.x - p.x, dy = target.y - p.y, dz = target.z - p.z, d = Math.hypot(dx, dy, dz), cp = Math.cos(p.pitch);
  const along = dx * Math.sin(p.yaw) * cp + dy * Math.sin(p.pitch) - dz * Math.cos(p.yaw) * cp;
  const off = Math.sqrt(Math.max(0, d * d - along * along));
  return d <= target.reach && along > 0 && off <= target.radius + d * .055 && lineClear(g, world, target, target.ignore) ? off / (target.radius + .1) + d * .02 : Infinity;
}
export function campTarget(g, type) {
  const c = g.camp[type]; if (!c) return null;
  const offset = type === 'tent' ? 1.9 : 0;
  return { kind: 'camp', id: type, x: c.x - Math.sin(c.yaw) * offset, z: c.z - Math.cos(c.yaw) * offset, y: c.y + (type === 'tent' ? .9 : .55), radius: type === 'tent' ? .9 : .65, reach: 3.5, ignore: type, label: type === 'tent' && g.resting ? 'Stop resting' : 'Use ' + RECIPES[type].name.toLowerCase() };
}
export function resolveTarget(g, world) {
  if (!alive(g) || g.placement) return null;
  if (g.player.climb) return { kind: 'descend', id: g.player.climb.id, label: 'Descend · W/S to climb' };
  const candidates = [
    ...WATER_SOURCES.map(s => ({ ...s, kind: 'spring', y: ground(s.x, s.z) + .7, radius: 2.5, reach: 6, label: 'Drink at ' + s.name })),
    ...CACHES.map(c => ({ ...c, kind: 'cache', y: ground(c.x, c.z) + .65, radius: .85, reach: 4, label: 'Search ' + c.name })),
    ...world.adventure.nodes.filter(n => !g.depleted.includes(n.id)).map(n => ({ ...n, kind: 'resource', reach: 3.5, radius: .65, y: n.y + .25, label: n.requires ? 'Harvest wood · hatchet required · Q' : 'Collect ' + ITEMS[n.item].toLowerCase() + ' ×' + n.yield })),
    ...world.adventure.climbs.map(t => ({ ...t, kind: 'climb', y: t.y + 1.4, radius: .7, reach: 3, ignore: t.id, label: 'Climb this tree · W/S' })),
    ...['tent', 'fire', 'chest'].map(type => campTarget(g, type)).filter(Boolean)
  ];
  let target = null, best = Infinity;
  for (const candidate of candidates) { const score = targetPoint(g, world, candidate); if (score < best) { target = candidate; best = score; } }
  return target;
}
export function useSupply(g, kind, source) {
  if (!alive(g)) return result(false, 'The expedition has ended.');
  if (kind === 'spring') { g.thirst = 100; g.drank = true; return result(true, source.name + ': thirst restored.'); }
  g.cacheTimes ||= {}; const last = source.id === 'coast' ? g.cacheAt : g.cacheTimes[source.id] ?? -300;
  if (g.elapsed - last < 300) return result(false, 'This cache replenishes after five minutes.');
  if (!fits(g, { rations: 2, provisions: 1 })) return result(false, 'Make room for two rations and one cooking provision.');
  add(g, 'rations', 2); add(g, 'provisions', 1); if (source.id === 'coast') g.cacheAt = g.elapsed; else g.cacheTimes[source.id] = g.elapsed;
  g.supplied = true; return result(true, 'Collected two rations and one cooking provision.');
}
export function gather(g, world, node, tool = false) {
  if (!available(g) || !node || g.depleted.includes(node.id)) return result(false, 'Nothing available to gather.');
  const target = resolveTarget(g, world);
  if (target?.kind !== 'resource' || target.id !== node.id) return result(false, 'Face the resource and get closer.');
  if (node.requires && (!tool || g.equipped !== node.requires || !g.tools[node.requires])) return result(false, 'Equip your hatchet and press Q to harvest this bundle.');
  if (!fits(g, { [node.item]: node.yield })) return result(false, 'Your ' + ITEMS[node.item].toLowerCase() + ' supply is full. Use the storage chest.');
  add(g, node.item, node.yield); g.depleted.push(node.id); g.campTasks.gathered = true; g.toolMotion = tool ? .45 : .25; g.resting = false;
  return result(true, 'Collected ' + node.yield + ' ' + ITEMS[node.item].toLowerCase() + '.');
}
export function useTarget(g, world) {
  if (g.resting) { g.resting = false; return result(true, 'Rest stopped.'); }
  const t = resolveTarget(g, world); if (!t) return result(false, 'Face a nearby resource, spring, cache, campsite, or climbable tree.');
  if (t.kind === 'spring' || t.kind === 'cache') return useSupply(g, t.kind, t);
  if (t.kind === 'resource') return gather(g, world, world.adventure.nodes.find(n => n.id === t.id));
  if (t.kind === 'camp') return result(true, '', { panel: t.id });
  if (t.kind === 'descend') { g.player.climb.descending = true; return result(true, 'Descending.'); }
  if (t.kind === 'climb') {
    if (!available(g) || g.stamina < 8) return result(false, 'Recover stamina on dry ground before climbing.');
    g.player.climb = { id: t.id, height: 0, descending: false, entry: { x: t.x, z: t.z } }; g.resting = false;
    Object.assign(g.player, { x: t.x, z: t.z, vx: 0, vy: 0, vz: 0, grounded: false }); return result(true, 'W/S to climb; E for controlled descent.');
  }
  return result(false, 'Nothing to use.');
}
export function useTool(g, world, creatures) {
  if (!available(g) || g.placement) return result(false, 'Tools require dry ground; finish climbing or placement first.');
  if (g.elapsed - g.toolAt < 1.2) return result(false, 'Wait for your next swing.');
  if (g.equipped === 'hatchet' && g.tools.hatchet) {
    const t = resolveTarget(g, world); if (t?.kind !== 'resource') return result(false, 'Aim at a harvestable wood bundle.');
    const out = gather(g, world, world.adventure.nodes.find(n => n.id === t.id), true); if (out.ok) g.toolAt = g.elapsed; return out;
  }
  if (g.equipped !== 'spear' || !g.tools.spear) return result(false, 'Equip a crafted tool with 2 or 3.');
  if (g.stamina < 20) return result(false, 'You need 20 stamina to use the spear.');
  g.stamina -= 20; g.toolAt = g.elapsed; g.toolMotion = .45; g.resting = false;
  const targets = creatures.filter(c => c.role === 'hunter').map(c => ({ c, score: targetPoint(g, world, { x: c.x, y: c.y + 1.7, z: c.z, radius: .75, reach: 4 }) })).filter(t => Number.isFinite(t.score)).sort((a, b) => a.score - b.score);
  const c = targets[0]?.c;
  if (!c) return result(true, 'Spear thrust. No predator within reach.');
  if ((c.resistUntil ?? -1) > g.elapsed) return result(true, 'The predator resists another interruption. Move away.');
  c.defendUntil = g.elapsed + 2; c.resistUntil = g.elapsed + 8; c.attackWindup = 0; c.state = 'Hesitating'; return result(true, 'Bite interrupted. Use the opening to escape.');
}
function routeDistance(x, z, [ax, az, bx, bz]) { const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2))); return Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t); }
export function candidateAt(type, x, z, yaw = 0) {
  const def = RECIPES[type]; if (!def?.half) return null;
  const [w, d] = def.half, c = Math.cos(yaw), s = Math.sin(yaw), corners = [[-w, -d], [w, -d], [w, d], [-w, d]].map(([a, b]) => ({ x: x + c * a + s * b, z: z - s * a + c * b }));
  const levels = corners.map(p => ground(p.x, p.z)), y = Math.max(ground(x, z), ...levels);
  return { type, x, z, y, yaw, feet: levels.map(h => h - y), fuel: 0, burning: false, cooking: 0, ready: false, storage: {} };
}
export function placementCheck(g, world, site, restoring = false) {
  if (!site || ![site.x, site.z, site.y, site.yaw].every(Number.isFinite) || !RECIPES[site.type]?.half) return 'Invalid building position.';
  const def = RECIPES[site.type], radius = def.radius;
  if (!restoring && (!available(g) || !g.player.grounded)) return 'Build while standing on dry ground.';
  if (!restoring && g.camp[site.type]) return 'You already have a ' + def.name.toLowerCase() + '.';
  if (Math.hypot(site.x, site.z) + radius >= LIMIT) return 'Stay inside the world boundary.';
  for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) {
    const a = dx * def.half[0], b = dz * def.half[1], x = site.x + Math.cos(site.yaw) * a + Math.sin(site.yaw) * b, z = site.z - Math.sin(site.yaw) * a + Math.cos(site.yaw) * b;
    if (ground(x, z) < .8) return 'Choose dry ground above the water.';
    const slope = Math.hypot(ground(x + .25, z) - ground(x - .25, z), ground(x, z + .25) - ground(x, z - .25)) / .5;
    if (slope > Math.tan(Math.PI / 12)) return 'This slope is steeper than 15°. Find flatter ground.';
  }
  if (WATER_SOURCES.some(p => Math.hypot(site.x - p.x, site.z - p.z) < 7 + radius) || CACHES.some(p => Math.hypot(site.x - p.x, site.z - p.z) < 5 + radius)) return 'Leave space around freshwater and supplies.';
  if (world.adventure.clearings.some(([x, z, r]) => Math.hypot(site.x - x, site.z - z) < r + radius) || world.adventure.routes.some(r => routeDistance(site.x, site.z, r) < 5 + radius)) return 'Keep wildlife clearings and travel routes open.';
  if (site.type !== 'tent' && !g.camp.tent) return 'Build your tent first.';
  if (site.type !== 'tent' && Math.hypot(site.x - g.camp.tent.x, site.z - g.camp.tent.z) > 12) return 'Build within 12 metres of your tent.';
  if (site.type === 'fire' && Math.hypot(site.x - g.camp.tent.x, site.z - g.camp.tent.z) < 3) return 'Keep the fire at least three metres from the tent.';
  for (const [type, other] of Object.entries(g.camp)) if (type !== site.type && Math.hypot(site.x - other.x, site.z - other.z) < radius + RECIPES[type].radius + .25) return 'Leave space between camp structures.';
  if (nearby(world.adventure.staticColliders, site.x, site.z, radius).some(c => Math.hypot(site.x - c.x, site.z - c.z) < radius + c.radius + .15)) return 'The building overlaps an obstacle.';
  if (world.adventure.nodes.some(n => !g.depleted.includes(n.id) && Math.hypot(site.x - n.x, site.z - n.z) < radius + .6)) return 'Collect nearby materials before building here.';
  return '';
}
export function placementSite(g) {
  if (!g.placement) return null; const p = g.player, { type, distance, yaw } = g.placement;
  return candidateAt(type, p.x + Math.sin(p.yaw) * distance, p.z - Math.cos(p.yaw) * distance, yaw);
}
export function beginPlacement(g, type) {
  if (!available(g) || !g.player.grounded || !['tent', 'fire', 'chest'].includes(type)) return result(false, 'Build on dry ground after finishing your climb.');
  if (g.camp[type]) return result(false, 'Pack the existing structure before moving it.');
  if (type !== 'tent' && !g.camp.tent) return result(false, 'Build the tent first.');
  if (!canAfford(g, type)) return result(false, 'Not enough building materials.');
  g.placement = { type, yaw: Math.PI - g.player.yaw, distance: 4 }; g.resting = false; return result(true, 'Move to position the preview. T rotates; Z/X move it nearer/farther; E places; Esc cancels.');
}
export function placeStructure(g, world) {
  const site = placementSite(g), reason = placementCheck(g, world, site);
  if (reason) return result(false, reason); if (!canAfford(g, site.type)) return result(false, 'Not enough materials.');
  charge(g, site.type); g.camp[site.type] = site; g.placement = null; g.campTasks.built = true; rebuildCampColliders(g, world); return result(true, RECIPES[site.type].name + ' built. Face it and press E to use it.');
}
export function rebuildCampColliders(g, world) {
  const colliders = [...world.adventure.staticColliders];
  for (const [type, site] of Object.entries(g.camp)) {
    const points = type === 'tent' ? [[-1.2, -.3, .48], [1.2, -.3, .48], [-1.2, .7, .48], [1.2, .7, .48], [0, 1.15, .75]] : [[0, 0, type === 'fire' ? .55 : .7]];
    for (const [x, z, radius] of points) colliders.push({ x: site.x + Math.cos(site.yaw) * x + Math.sin(site.yaw) * z, z: site.z - Math.sin(site.yaw) * x + Math.cos(site.yaw) * z, radius, bottom: site.y - .8, top: site.y + (type === 'tent' ? 2 : type === 'fire' ? .5 : 1.1), owner: type });
  }
  world.colliders = indexColliders(colliders);
}
export function campAction(g, world, type, action, item, quantity = 1) {
  const c = g.camp[type], target = campTarget(g, type);
  if (!available(g) || !c || !target || !Number.isFinite(targetPoint(g, world, target))) return result(false, 'Face the campsite structure and get closer.');
  if (action === 'pack') {
    if (type === 'tent' && (g.camp.fire || g.camp.chest)) return result(false, 'Pack the fire and chest before the tent.');
    if (type === 'fire' && (c.burning || c.cooking || c.ready || c.fuel)) return result(false, 'Extinguish the fire, collect its meal, and reclaim unused fuel first.');
    if (type === 'chest' && Object.values(c.storage).some(n => n > 0)) return result(false, 'Empty the chest first.');
    if (!fits(g, RECIPES[type].cost)) return result(false, 'Make room for the returned construction materials.');
    for (const [key, n] of Object.entries(RECIPES[type].cost)) add(g, key, n); delete g.camp[type]; g.resting = false; rebuildCampColliders(g, world); return result(true, 'Structure packed; construction materials returned.');
  }
  if (type === 'tent' && action === 'rest') { g.resting = !g.resting; return result(true, g.resting ? 'Resting. Movement or E stops rest; the world stays active.' : 'Rest stopped.', { resume: true, save: true }); }
  if (type === 'chest' && ['deposit', 'withdraw'].includes(action) && ITEMS[item] && Number.isInteger(quantity) && quantity > 0 && quantity <= 100) {
    const stored = c.storage[item] || 0, count = Object.values(c.storage).reduce((a, n) => a + n, 0);
    if (action === 'deposit') { if (amount(g, item) < quantity || count + quantity > 100) return result(false, 'Not enough carried items or chest space.'); add(g, item, -quantity); c.storage[item] = stored + quantity; }
    else { if (stored < quantity || !fits(g, { [item]: quantity })) return result(false, 'Not enough stored items or backpack space.'); c.storage[item] = stored - quantity; add(g, item, quantity); }
    return result(true, 'Storage updated.');
  }
  if (type === 'fire') {
    if (action === 'fuel') { if (g.inventory.wood < 1 || c.fuel > 540) return result(false, 'Need one wood and room in the fire.'); g.inventory.wood--; c.fuel += 60; return result(true, 'Added 60 seconds of fuel.'); }
    if (action === 'reclaim') { const wood = Math.floor(c.fuel / 60); if (c.burning || c.cooking || !wood || !fits(g, { wood })) return result(false, 'Extinguish first; only whole unused wood can be reclaimed.'); g.inventory.wood += wood; c.fuel %= 60; return result(true, 'Unused whole fuel logs reclaimed.'); }
    if (action === 'discardFuel') { if (c.burning || c.cooking) return result(false, 'Extinguish and finish cooking first.'); c.fuel = 0; return result(true, 'Remaining embers cleared.'); }
    if (action === 'light') { if (c.fuel <= 0) return result(false, 'Add wood first.'); c.burning = true; return result(true, 'Fire lit. It does not repel wildlife.'); }
    if (action === 'extinguish') { if (c.cooking) return result(false, 'Finish cooking before extinguishing.'); c.burning = false; return result(true, 'Fire extinguished.'); }
    if (action === 'cook') { if (!c.burning || c.fuel < 10 || c.cooking || c.ready || !g.inventory.provisions) return result(false, 'Need one provision, a lit fire, at least 10 seconds of fuel, and an empty cooking slot.'); g.inventory.provisions--; c.cooking = 10; return result(true, 'Cooking for 10 seconds. Close menus to let time advance.', { resume: true }); }
    if (action === 'collect') { if (!c.ready || !fits(g, { meals: 1 })) return result(false, 'No meal ready or your meal supply is full.'); c.ready = false; g.inventory.meals++; return result(true, 'Cooked meal collected.'); }
  }
  return result(false, 'Action unavailable.');
}
export function eatMeal(g) { if (!alive(g) || !g.inventory.meals || g.hunger > 95) return result(false, 'No meal available, or you are already full.'); g.inventory.meals--; g.hunger = Math.min(100, g.hunger + 55); return result(true, 'Ate a cooked meal.'); }
export function stepAdventure(g, input, dt, world) {
  if (!alive(g)) return false;
  g.toolMotion = Math.max(0, g.toolMotion - dt);
  const fire = g.camp.fire;
  if (fire?.burning) {
    const burn = Math.min(dt, fire.fuel); fire.fuel = Math.max(0, fire.fuel - burn);
    if (fire.cooking > 0) { fire.cooking = Math.max(0, fire.cooking - burn); if (fire.cooking < 1e-7) { fire.cooking = 0; fire.ready = true; g.campTasks.cooked = true; } }
    if (!fire.fuel) fire.burning = false;
  }
  if (g.resting && (input.forward || input.backward || input.left || input.right || input.jump || g.player.swimming || !g.camp.tent)) g.resting = false;
  if (g.resting) g.stamina = Math.min(100, g.stamina + dt * 10);
  const climb = g.player.climb; if (!climb) return false;
  const tree = world.adventure.climbs.find(t => t.id === climb.id); if (!tree) { g.player.climb = null; return false; }
  let direction = (input.forward || 0) - (input.backward || 0); if (climb.descending || g.stamina <= 0) { climb.descending = true; direction = -1; }
  if (direction > 0 && climb.height < 6) { const travel = Math.min(dt, g.stamina / 8); climb.height = Math.min(6, climb.height + travel * 1.5); g.stamina = Math.max(0, g.stamina - travel * 8); }
  else if (direction < 0) climb.height = Math.max(0, climb.height - dt * 1.8);
  else if (climb.height >= 6) { g.stamina = Math.min(100, g.stamina + dt * 10); g.campTasks.climbed = true; }
  Object.assign(g.player, { x: tree.x, z: tree.z, y: tree.y + 1.7 + climb.height, vx: 0, vy: 0, vz: 0, swimming: false, grounded: false });
  if (climb.height === 0 && direction < 0) { g.player.climb = null; g.player.grounded = true; }
  return true;
}
export function restoreAdventure(game, data, world) {
  const fresh = adventureState();
  if (data.version === 1) { Object.assign(game, fresh); return true; }
  if (!data.inventory || !data.tools || !data.camp || !Array.isArray(data.depleted)) return false;
  for (const key of Object.keys(fresh.inventory)) { const n = data.inventory[key]; if (!Number.isInteger(n) || n < 0 || n > CAPACITY[key]) return false; fresh.inventory[key] = n; }
  for (const key of ['hatchet', 'spear']) { if (typeof data.tools[key] !== 'boolean') return false; fresh.tools[key] = data.tools[key]; }
  fresh.equipped = ['hands', 'hatchet', 'spear'].includes(data.equipped) && (data.equipped === 'hands' || fresh.tools[data.equipped]) ? data.equipped : 'hands';
  if (data.depleted.length > 10000 || data.depleted.some(id => typeof id !== 'string' || id.length > 64 || world && !world.adventure.nodes.some(n => n.id === id))) return false;
  fresh.depleted = [...new Set(data.depleted)];
  for (const type of Object.keys(data.camp)) {
    const c = data.camp[type]; if (!RECIPES[type]?.half || !c || ![c.x, c.z, c.yaw].every(Number.isFinite) || Math.hypot(c.x, c.z) > LIMIT - 3) return false;
    const site = candidateAt(type, c.x, c.z, c.yaw); if (ground(c.x, c.z) < .8) return false;
    if (type === 'fire') { if (!Number.isFinite(c.fuel) || c.fuel < 0 || c.fuel > 600 || !Number.isFinite(c.cooking) || c.cooking < 0 || c.cooking > 10 || typeof c.ready !== 'boolean' || typeof c.burning !== 'boolean' || c.cooking && (c.ready || !c.burning || c.fuel + 1e-6 < c.cooking)) return false; Object.assign(site, { fuel: c.fuel, burning: c.burning && c.fuel > 0, cooking: c.cooking, ready: c.ready }); }
    if (type === 'chest') { if (!c.storage || Object.entries(c.storage).some(([k, n]) => !ITEMS[k] || !Number.isInteger(n) || n < 0 || n > 100) || Object.values(c.storage).reduce((a, n) => a + n, 0) > 100) return false; site.storage = { ...c.storage }; }
    fresh.camp[type] = site;
  }
  if ((fresh.camp.fire || fresh.camp.chest) && !fresh.camp.tent) return false;
  Object.assign(game, fresh); for (const key of Object.keys(fresh.campTasks)) game.campTasks[key] = data.campTasks?.[key] === true;
  if (world && Object.values(game.camp).some(c => placementCheck(game, world, c, true))) return false;
  const climb = data.player.climb;
  if (climb) {
    const entry = world ? world.adventure.climbs.find(t => t.id === climb.id) : climb.entry;
    if (!entry || !Number.isFinite(entry.x) || !Number.isFinite(entry.z) || Math.hypot(entry.x, entry.z) > LIMIT) return false;
    Object.assign(game.player, { x: entry.x, z: entry.z, y: ground(entry.x, entry.z) + 1.7, climb: null, grounded: true });
  } else game.player.climb = null;
  return true;
}
