import { ground, LIMIT, SPAWN, SPRING, CACHE, DAY_SECONDS, SPECIES } from './world.js';
import { clamp } from '../src/math.js';

export const SAVE_KEY = typeof __DEV__ !== 'undefined' && __DEV__ ? 'world-stimulation-jurassic-dev-v1' : 'world-stimulation-jurassic-v1';
export function newGame() {
  return { player: { x: SPAWN.x, y: ground(SPAWN.x, SPAWN.z) + 1.7, z: SPAWN.z, yaw: SPAWN.yaw, pitch: -.06, vy: 0, grounded: true }, health: 100, stamina: 100, hunger: 88, thirst: 82, oxygen: 100, rations: 2, elapsed: 0, clock: 80, cacheAt: -300, discovered: [], drank: false, supplied: false, won: false, dead: false, damage: 0, attackAt: -10 };
}

export function movePlayer(game, input, dt, colliders) {
  const p = game.player, floor = ground(p.x, p.z), swimming = floor < -.9 && p.y < 1.25;
  let forward = (input.forward || 0) - (input.backward || 0), strafe = (input.right || 0) - (input.left || 0), len = Math.hypot(forward, strafe);
  if (len > 1) { forward /= len; strafe /= len; }
  const sprint = input.sprint && game.stamina > 3 && len > 0;
  const speed = swimming ? sprint ? 4.8 : 2.8 : sprint ? 6.2 : 3.2;
  const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw), pitch = swimming ? Math.cos(p.pitch) : 1;
  const dx = (sy * forward * pitch + cy * strafe) * speed * dt, dz = (-cy * forward * pitch + sy * strafe) * speed * dt;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .3));
  for (let i = 0; i < steps; i++) {
    const oldFloor = ground(p.x, p.z), nx = p.x + dx / steps, nz = p.z + dz / steps;
    if (ground(nx, p.z) < Math.max(oldFloor + .42, p.y - 1.1)) p.x = nx;
    if (ground(p.x, nz) < Math.max(oldFloor + .42, p.y - 1.1)) p.z = nz;
    for (const c of colliders) {
      const x = p.x - c.x, z = p.z - c.z, d = Math.hypot(x, z), r = c.radius + .35;
      if (d < r && d > .001 && Math.abs(p.y - ground(c.x, c.z)) < 28) { p.x = c.x + x / d * r; p.z = c.z + z / d * r; }
    }
  }
  const rad = Math.hypot(p.x, p.z); if (rad > LIMIT) { p.x *= LIMIT / rad; p.z *= LIMIT / rad; }
  const bottom = ground(p.x, p.z) + 1.7;
  if (swimming) {
    const vertical = (input.jump ? 1 : 0) - (input.dive ? 1 : 0), target = vertical * 3 + (vertical ? 0 : .35) + Math.sin(p.pitch) * forward * speed * .45;
    p.vy += (target - p.vy) * Math.min(1, dt * 4); p.y += p.vy * dt;
    if (p.y > .65 && !input.jump) { p.y = .65; p.vy = Math.min(0, p.vy); }
    if (p.y < bottom) { p.y = bottom; p.vy = Math.max(0, p.vy); }
    p.grounded = false;
  } else {
    if (input.jump && p.grounded) { p.vy = 6.8; p.grounded = false; }
    p.vy -= 19 * dt; p.y += p.vy * dt;
    if (p.y <= bottom) { p.y = bottom; p.vy = 0; p.grounded = true; }
  }
  game.stamina = clamp(game.stamina + (sprint ? -8 : 10) * dt, 0, 100);
  return { swimming, moving: len > .05, sprinting: sprint };
}

const turnToward = (angle, target, step) => { const delta = Math.atan2(Math.sin(target - angle), Math.cos(target - angle)); return angle + clamp(delta, -step, step); };
export function updateCreatures(game, creatures, dt, colliders = []) {
  const p = game.player;
  for (const c of creatures) {
    c.timer -= dt; c.cooldown = Math.max(0, c.cooldown - dt);
    const role = SPECIES[c.species].role, distance = Math.hypot(p.x - c.x, p.z - c.z), aquatic = role === 'marine', playerInWater = p.y < .9;
    const danger = role === 'hunter' && !playerInWater && ground(p.x, p.z) > 0 && distance < 25;
    const marineThreat = aquatic && playerInWater && distance < 13;
    const fleeing = role === 'browser' && distance < 7;
    let targetX, targetZ, speed;
    if (danger || marineThreat) { c.state = distance < 5 ? 'Attacking' : 'Approaching'; targetX = p.x; targetZ = p.z; speed = aquatic ? 2.1 : 3.65; }
    else if (fleeing) { c.state = 'Moving away'; targetX = c.x + (c.x - p.x) * 3; targetZ = c.z + (c.z - p.z) * 3; speed = 2; }
    else {
      if (c.timer <= 0) {
        const a = game.clock * .11 + c.phase * 3.1, r = aquatic ? 12 : role === 'giant' ? 7 : 9;
        c.targetX = c.homeX + Math.sin(a) * r; c.targetZ = c.homeZ + Math.cos(a * .73) * r; c.timer = 7 + Math.sin(a) * 2;
      }
      targetX = c.targetX; targetZ = c.targetZ;
      speed = aquatic ? 1.05 : c.timer > 4 ? role === 'giant' ? .43 : .65 : 0; c.state = speed ? 'Wandering' : role === 'browser' || role === 'giant' ? 'Browsing' : 'Resting';
    }
    if (Math.hypot(targetX - c.x, targetZ - c.z) < 1) speed = 0;
    const desired = Math.atan2(targetX - c.x, -(targetZ - c.z)); c.yaw = turnToward(c.yaw, desired, dt * (aquatic ? .6 : 1.1));
    const nx = c.x + Math.sin(c.yaw) * speed * dt, nz = c.z - Math.cos(c.yaw) * speed * dt, h = ground(nx, nz);
    const blocked = !aquatic && colliders.some(o => Math.hypot(nx - o.x, nz - o.z) < o.radius + c.scale * (role === 'giant' ? 1.8 : .9));
    if ((aquatic ? h < -4 : h > 2 && Math.abs(h - ground(c.x, c.z)) < .5) && !blocked) { c.x = nx; c.z = nz; c.speed = speed; }
    else { c.timer = 0; c.yaw += dt; c.speed = 0; }
    if (aquatic) c.y = Math.max(h + 2, -4.5 + Math.sin(game.clock * .2 + c.phase) * 1.2);
    else c.y = ground(c.x, c.z);
    if ((danger || marineThreat) && distance < (aquatic ? 3.7 : 3.4) && Math.abs(p.y - c.y) < 5 && c.cooldown <= 0) {
      game.health = Math.max(0, game.health - (aquatic ? 9 : 13)); c.cooldown = 2.6; game.damage = 1; game.attackAt = game.elapsed;
    }
  }
}

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
  if (Math.hypot(p.x - SPRING.x, p.z - SPRING.z) < 6 && Math.abs(p.y - ground(SPRING.x, SPRING.z)) < 5) {
    game.thirst = 100; game.drank = true; return 'Fresh water collected. Thirst restored.';
  }
  if (Math.hypot(p.x - CACHE.x, p.z - CACHE.z) < 4 && Math.abs(p.y - ground(CACHE.x, CACHE.z)) < 4) {
    if (game.elapsed - game.cacheAt < 300) return 'This supply cache is empty. More provisions wash ashore in five minutes.';
    game.rations += 2; game.cacheAt = game.elapsed; game.supplied = true; return 'Collected two rations from the shoreline cache.';
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
    if (Math.hypot(data.player.x, data.player.z) > LIMIT + 1 || data.player.y < -40 || data.player.y > 90 || data.elapsed < 0 || data.rations < 0 || data.rations > 1000) return null;
    Object.assign(game, data); game.discovered = [...new Set((Array.isArray(data.discovered) ? data.discovered : []).filter(i => Number.isInteger(i) && i >= 0 && i < SPECIES.length))];
    for (const k of ['health', 'stamina', 'hunger', 'thirst', 'oxygen']) game[k] = clamp(game[k], 0, 100);
    game.player.vy = 0; game.player.pitch = clamp(game.player.pitch, -1.45, 1.45); game.damage = 0;
    game.player.y = Math.max(ground(game.player.x, game.player.z) + 1.7, game.player.y);
    return game;
  } catch { return null; }
}
