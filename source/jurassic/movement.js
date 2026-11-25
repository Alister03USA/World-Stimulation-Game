import { ground, LIMIT } from './world.js';
import { clamp } from '../src/math.js';
import { nearby, overlapsHeight } from './spatial.js';

export function movePlayer(game, input, dt, colliders = []) {
  const p = game.player, floor = ground(p.x, p.z);
  p.swimming = p.swimming ? floor < -.45 && p.y < 1.65 : floor < -.95 && p.y < 1.15;
  const swimming = p.swimming;
  let forward = (input.forward || 0) - (input.backward || 0), strafe = (input.right || 0) - (input.left || 0), len = Math.hypot(forward, strafe);
  if (len > 1) { forward /= len; strafe /= len; }
  const moving = len > .05, sprint = input.sprint && game.stamina > 3 && moving;
  const speed = swimming ? sprint ? 4.8 : 2.8 : sprint ? 6.2 : 3.2, sy = Math.sin(p.yaw), cy = Math.cos(p.yaw), cp = swimming ? Math.cos(p.pitch) : 1;
  let tx = (sy * forward * cp + cy * strafe) * speed, tz = (-cy * forward * cp + sy * strafe) * speed;
  const gx = (ground(p.x + .4, p.z) - ground(p.x - .4, p.z)) / .8, gz = (ground(p.x, p.z + .4) - ground(p.x, p.z - .4)) / .8;
  const slope = Math.hypot(gx, gz), uphill = tx * gx + tz * gz;
  if (!swimming && p.grounded && slope > .9 && uphill > 0) { tx -= gx * uphill / (slope * slope); tz -= gz * uphill / (slope * slope); }
  else if (!swimming && uphill > 0) { const factor = 1 / Math.sqrt(1 + slope * slope); tx *= factor; tz *= factor; }
  const rate = swimming ? moving ? 3.5 : 4 : p.grounded ? moving ? 9 : 14 : 2.5, blend = 1 - Math.exp(-rate * dt);
  p.vx = (p.vx || 0) + (tx - (p.vx || 0)) * blend; p.vz = (p.vz || 0) + (tz - (p.vz || 0)) * blend;
  p.coyote = p.grounded ? .10 : Math.max(0, (p.coyote || 0) - dt);
  p.jumpBuffer = input.jump && !p.jumpHeld ? .12 : Math.max(0, (p.jumpBuffer || 0) - dt); p.jumpHeld = !!input.jump;
  const dx = p.vx * dt, dz = p.vz * dt, steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .2));
  const local = nearby(colliders, p.x, p.z, 5 + Math.hypot(dx, dz));
  for (let i = 0; i < steps; i++) {
    const oldFloor = ground(p.x, p.z), nx = p.x + dx / steps, nz = p.z + dz / steps;
    if (ground(nx, p.z) <= Math.max(oldFloor + .24, p.y - 1.15)) p.x = nx; else p.vx *= .5;
    if (ground(p.x, nz) <= Math.max(oldFloor + .24, p.y - 1.15)) p.z = nz; else p.vz *= .5;
    for (const c of local) {
      const x = p.x - c.x, z = p.z - c.z, d = Math.hypot(x, z), r = c.radius + .35;
      if (d >= r || !overlapsHeight(c, p.y - 1.7, p.y + .1)) continue;
      const nx = d > .001 ? x / d : 1, nz = d > .001 ? z / d : 0;
      p.x = c.x + nx * r; p.z = c.z + nz * r;
      const into = p.vx * nx + p.vz * nz; if (into < 0) { p.vx -= into * nx; p.vz -= into * nz; }
    }
  }
  const radius = Math.hypot(p.x, p.z); if (radius > LIMIT) { p.x *= LIMIT / radius; p.z *= LIMIT / radius; p.vx = p.vz = 0; }
  const bottom = ground(p.x, p.z) + 1.7;
  if (swimming) {
    const vertical = (input.jump ? 1 : 0) - (input.dive ? 1 : 0), target = vertical * 3 + (vertical ? 0 : .35) + Math.sin(p.pitch) * forward * speed * .45;
    p.vy += (target - p.vy) * (1 - Math.exp(-4 * dt)); p.y += p.vy * dt;
    if (p.y > .65 && !input.jump) { p.y = .65; p.vy = Math.min(0, p.vy); }
    if (p.y < bottom) { p.y = bottom; p.vy = Math.max(0, p.vy); }
    p.grounded = false; p.coyote = p.jumpBuffer = 0;
  } else {
    if (p.jumpBuffer > 0 && p.coyote > 0) { p.vy = 6.8; p.grounded = false; p.coyote = p.jumpBuffer = 0; }
    p.vy -= 19 * dt; p.y += p.vy * dt;
    if (p.y <= bottom) { p.y = bottom; p.vy = 0; p.grounded = true; } else p.grounded = false;
  }
  game.stamina = clamp(game.stamina + (sprint ? -8 : 10) * dt, 0, 100);
  return { swimming, moving, sprinting: sprint };
}
