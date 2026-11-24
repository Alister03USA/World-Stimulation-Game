import { ground, LIMIT, SPAWN, WATER_SOURCES, CACHES, DAY_SECONDS, SPECIES } from './world.js';
import { clamp } from '../src/math.js';

export const SAVE_KEY = typeof __DEV__ !== 'undefined' && __DEV__ ? 'world-stimulation-jurassic-dev-v1' : 'world-stimulation-jurassic-v1';
export function newGame() {
  return { player: { x: SPAWN.x, y: ground(SPAWN.x, SPAWN.z) + 1.7, z: SPAWN.z, yaw: SPAWN.yaw, pitch: -.06, vy: 0, grounded: true, vx: 0, vz: 0, coyote: .1, jumpBuffer: 0, jumpHeld: false, swimming: false }, health: 100, stamina: 100, hunger: 88, thirst: 82, oxygen: 100, rations: 2, elapsed: 0, clock: 80, cacheAt: -300, discovered: [], drank: false, supplied: false, won: false, dead: false, damage: 0, attackAt: -10 };
}

export { movePlayer } from './movement.js';

export { updateWildlife as updateCreatures } from './wildlife.js';

export function updateSurvival(game, dt) {
  game.elapsed += dt; game.clock += dt; game.damage = Math.max(0, game.damage - dt * 1.8);
  game.hunger = clamp(game.hunger - dt * .085, 0, 100); game.thirst = clamp(game.thirst - dt * .12, 0, 100);
  game.oxygen = clamp(game.oxygen + (game.player.y < -.15 ? -dt * 2.7 : dt * 24), 0, 100);
  if (!game.oxygen || !game.hunger || !game.thirst) game.health = Math.max(0, game.health - dt * (!game.oxygen ? 9 : 1.1));
  else if (game.hunger > 35 && game.thirst > 35 && game.elapsed - game.attackAt > 12) game.health = Math.min(100, game.health + dt * .45);
  if (game.health <= 0) game.dead = true;
  if (!game.dead && game.elapsed >= DAY_SECONDS && game.discovered.length === SPECIES.length && game.drank && game.supplied) game.won = true;
}

export function interact(game) {
  const p = game.player;
  const source = WATER_SOURCES.find(s => Math.hypot(p.x - s.x, p.z - s.z) < 6 && Math.abs(p.y - ground(s.x, s.z)) < 5);
  if (source) {
    game.thirst = 100; game.drank = true; return `${source.name}: fresh water collected. Thirst restored.`;
  }
  const cache = CACHES.find(s => Math.hypot(p.x - s.x, p.z - s.z) < 4 && Math.abs(p.y - ground(s.x, s.z)) < 4);
  if (cache) {
    game.cacheTimes ||= {}; const last = cache.id === 'coast' ? game.cacheAt : game.cacheTimes[cache.id] ?? -300;
    if (game.elapsed - last < 300) return 'This supply cache is empty. More provisions become available in five minutes.';
    game.rations += 2; if (cache.id === 'coast') game.cacheAt = game.elapsed; else game.cacheTimes[cache.id] = game.elapsed;
    game.supplied = true; return `${cache.name}: collected two rations.`;
  }
  return 'Get closer to the freshwater spring or the shoreline supply cache.';
}

export function eat(game) {
  if (game.rations <= 0) return 'No rations left. Find the shoreline supply cache.';
  if (game.hunger > 95) return 'You are already full.';
  game.rations--; game.hunger = Math.min(100, game.hunger + 38); return 'Ate one ration. Hunger restored.';
}

export function inspect(game, creatures) {
  const p = game.player, f = [Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch)];
  let found = null, nearest = 65;
  for (const c of creatures) {
    const dx = c.x - p.x, dy = c.y + (SPECIES[c.species].viewHeight || 0) * (c.scale || 1) - p.y, dz = c.z - p.z, d = Math.hypot(dx, dy, dz);
    if (d < nearest && (dx * f[0] + dy * f[1] + dz * f[2]) / Math.max(d, .01) > .91) {
      // Avoid spotting an animal through a ridge or across the air/water boundary.
      if ((p.y < 0) !== (c.y < 0)) continue;
      let blocked = false;
      for (let t = .08; t < .96; t += .08) if (ground(p.x + dx * t, p.z + dz * t) > p.y + dy * t) { blocked = true; break; }
      if (!blocked) { nearest = d; found = c; }
    }
  }
  return found;
}

export function saveGame(game, storage) {
  try { (storage ?? localStorage).setItem(SAVE_KEY, JSON.stringify({ version: 1, ...game })); return true; } catch { return false; }
}
export function loadGame(storage) {
  try {
    const data = JSON.parse((storage ?? localStorage).getItem(SAVE_KEY));
    if (!data || data.version !== 1 || !data.player || data.dead || data.won) return null;
    const game = newGame(), numeric = ['health', 'stamina', 'hunger', 'thirst', 'oxygen', 'rations', 'elapsed', 'clock', 'cacheAt'];
    if (numeric.some(k => !Number.isFinite(data[k])) || ['x', 'y', 'z', 'yaw', 'pitch'].some(k => !Number.isFinite(data.player[k]))) return null;
    if (Math.hypot(data.player.x, data.player.z) > LIMIT + 1 || data.player.y < -70 || data.player.y > 180 || data.elapsed < 0 || data.rations < 0 || data.rations > 1000) return null;
    Object.assign(game, data); game.discovered = [...new Set((Array.isArray(data.discovered) ? data.discovered : []).filter(i => Number.isInteger(i) && i >= 0 && i < SPECIES.length))];
    game.cacheTimes = Object.fromEntries(CACHES.filter(c => Number.isFinite(data.cacheTimes?.[c.id]) && data.cacheTimes[c.id] >= -300 && data.cacheTimes[c.id] <= game.elapsed).map(c => [c.id, data.cacheTimes[c.id]]));
    for (const k of ['health', 'stamina', 'hunger', 'thirst', 'oxygen']) game[k] = clamp(game[k], 0, 100);
    game.player.vy = game.player.vx = game.player.vz = 0; game.player.jumpHeld = false; game.player.jumpBuffer = 0; game.player.coyote = 0; game.player.swimming = ground(game.player.x, game.player.z) < -.95 && game.player.y < 1.15; game.player.pitch = clamp(game.player.pitch, -1.45, 1.45); game.damage = 0;
    game.player.y = Math.max(ground(game.player.x, game.player.z) + 1.7, game.player.y);
    return game;
  } catch { return null; }
}
