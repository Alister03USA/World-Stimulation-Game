import { ground, SPECIES, nearestWater, isFreshwater, LIMIT } from './world.js';
import { clamp } from '../src/math.js';
import { nearby, overlapsHeight } from './spatial.js';

const TAU = Math.PI * 2, angleTo = (x, z) => Math.atan2(x, -z), difference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const blend = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
// Contact positions follow each mesh's leg layout. Offsets deform the lower limbs, not a full IK skeleton.
export const FOOTPRINTS = [
  [[-.61, -2.29], [-.45, .22], [.54, -1.33], [.53, 1.8]], [[.61, .1], [.61, .1], [-.61, .1], [-.61, .1]], [],
  [[-1.01, -2.42], [-1.01, .09], [.98, -2.31], [.87, 2.68]], [[.88, -1.58], [.88, 1.42], [-.88, -1.58], [-.88, 1.42]], [[.61, .1], [.61, .1], [-.61, .1], [-.61, .1]]
];
export function gaitStep(c, leg) {
  const biped = SPECIES[c.species].role === 'hunter', offsets = biped ? [0, 0, .5, .5] : [0, .5, .75, .25];
  const phase = ((c.gait || 0) / TAU + offsets[leg]) % 1, swing = clamp((phase - .64) / .36, 0, 1);
  const strength = c.gaitStrength ?? Math.min(1, (c.speed || 0) / .45), stride = c.stride || 1;
  return { z: (phase < .64 ? phase / .64 - .5 : .5 - swing) * stride * strength, lift: Math.sin(swing * Math.PI) * (c.stepHeight || .18) * strength, stance: phase < .64 && strength > .08 };
}
export function groundCreature(c, dt) {
  if (SPECIES[c.species].role === 'marine') return;
  const s = c.scale || 1, sy = Math.sin(c.yaw), cy = Math.cos(c.yaw), feet = FOOTPRINTS[c.species];
  const sample = (x, z) => ground(c.x + (cy * x + sy * z) * s, c.z + (-sy * x + cy * z) * s);
  const span = c.species === 3 ? 2.5 : c.species === 4 ? 1.6 : c.species === 0 ? 1.8 : .65, width = c.species === 3 ? 1 : .65;
  const pitch = clamp(Math.atan2(sample(0, -span) - sample(0, span), 2 * span * s), -.27, .27);
  const roll = clamp(Math.atan2(sample(width, 0) - sample(-width, 0), 2 * width * s), -.22, .22);
  c.pitch = blend(c.pitch || 0, pitch, 4, dt); c.roll = blend(c.roll || 0, roll, 4, dt);
  const center = ground(c.x, c.z); c.y = blend(c.y, center, 12, dt);
  c.feet ||= [0, 0, 0, 0]; c.anchors ||= []; c.footDrift ||= new Array(8).fill(0);
  feet.forEach(([x, z], i) => {
    const step = gaitStep(c, i), localZ = z + step.z, wx = c.x + (cy * x + sy * localZ) * s, wz = c.z + (-sy * x + cy * localZ) * s;
    if (!c.anchors[i]?.stance || !step.stance || Math.hypot(c.anchors[i].x - wx, c.anchors[i].z - wz) > s * .85) c.anchors[i] = { x: wx, z: wz, stance: step.stance };
    const anchor = c.anchors[i], dx = step.stance ? anchor.x - wx : 0, dz = step.stance ? anchor.z - wz : 0;
    const driftX = clamp((cy * dx - sy * dz) / s, -.45, .45), driftZ = clamp((sy * dx + cy * dz) / s, -.45, .45);
    c.footDrift[i * 2] = blend(c.footDrift[i * 2], driftX, 20, dt); c.footDrift[i * 2 + 1] = blend(c.footDrift[i * 2 + 1], driftZ, 20, dt);
    const bodyHeight = s * (Math.sin(c.roll) * (x + driftX) - Math.cos(c.roll) * Math.sin(c.pitch) * (localZ + driftZ));
    const offset = clamp((sample(x + driftX, localZ + driftZ) - c.y - bodyHeight) / s, -.7, .7);
    c.feet[i] = blend(c.feet[i], offset, 18, dt);
  });
}

export function canSense(c, target, colliders = []) {
  const dx = target.x - c.x, dz = target.z - c.z, d = Math.hypot(dx, dz), marine = SPECIES[c.species].role === 'marine';
  if (d > (marine ? 18 : 34)) return false;
  if (d > 7 && Math.cos(difference(angleTo(dx, dz), c.yaw)) < .15) return false;
  const eye = c.y + (marine ? .4 : 2.3 * c.scale), targetY = target.y;
  for (let t = .12; t < .95; t += .12) if (ground(c.x + dx * t, c.z + dz * t) > eye + (targetY - eye) * t) return false;
  return !nearby(colliders, c.x, c.z, d + 1).some(o => {
    const t = clamp(((o.x - c.x) * dx + (o.z - c.z) * dz) / Math.max(d * d, .01), 0, 1);
    const y = eye + (targetY - eye) * t;
    return t > .05 && t < .95 && overlapsHeight(o, y, y) && Math.hypot(c.x + dx * t - o.x, c.z + dz * t - o.z) < o.radius + .15;
  });
}

function clearPath(c, yaw, distance, colliders) {
  const aquatic = SPECIES[c.species].role === 'marine', radius = c.bodyRadius || .9;
  for (const t of [.5, 1]) {
    const x = c.x + Math.sin(yaw) * distance * t, z = c.z - Math.cos(yaw) * distance * t, h = ground(x, z);
    if (Math.hypot(x, z) > LIMIT - 8 || (aquatic ? h > -5 || isFreshwater(x, z) : h < .35 || Math.abs(h - ground(c.x, c.z)) / Math.max(distance * t, .1) > .48)) return false;
    if (colliders.some(o => { if (!overlapsHeight(o, c.y - (aquatic ? .6 : 0), c.y + (aquatic ? .6 : c.scale * 2))) return false; const before = Math.hypot(c.x - o.x, c.z - o.z), after = Math.hypot(x - o.x, z - o.z), gap = o.radius + radius; return after < gap && (before >= gap || after < before + .00001); })) return false;
  }
  return true;
}

function steer(c, target, wanted, dt, colliders, neighbors) {
  const role = SPECIES[c.species].role, giant = role === 'giant', aquatic = role === 'marine';
  const requested = wanted;
  c.recoverTime = Math.max(0, (c.recoverTime || 0) - dt);
  if (c.recoverTime > 0) target = c.escapeTarget;
  let dx = target.x - c.x, dz = target.z - c.z;
  for (const other of neighbors) {
    if (other.id === c.id) continue;
    const x = c.x - other.x, z = c.z - other.z, d = Math.hypot(x, z), gap = c.bodyRadius + other.bodyRadius + .8;
    if (d < gap + 2) { const a = (c.id + other.id) * 2.399, sign = c.id < other.id ? 1 : -1, force = (gap + 2 - d) * 3; dx += (d > .001 ? x / d : Math.sin(a) * sign) * force; dz += (d > .001 ? z / d : Math.cos(a) * sign) * force; }
  }
  const desired = angleTo(dx, dz), lookAhead = c.bodyRadius + 1 + c.speed * .65;
  let chosen = null, best = Infinity;
  for (const offset of [0, .45, -.45, .9, -.9, 1.4, -1.4, 2, -2, Math.PI]) {
    const yaw = desired + offset; if (!clearPath(c, yaw, lookAhead, colliders)) continue;
    const score = Math.abs(offset) + Math.abs(difference(yaw, c.yaw)) * .35 + (c.avoidYaw === undefined ? 0 : Math.abs(difference(yaw, c.avoidYaw)) * .15);
    if (score < best) { best = score; chosen = yaw; }
  }
  if (chosen === null) { wanted = 0; c.timer = Math.min(c.timer, 0); }
  else { c.avoidYaw = chosen; c.yaw += clamp(difference(chosen, c.yaw), -(giant ? .55 : aquatic ? .75 : 1.5) * dt, (giant ? .55 : aquatic ? .75 : 1.5) * dt); }
  if (chosen !== null) wanted *= Math.max(0, Math.cos(difference(chosen, c.yaw)));
  if (Math.hypot(dx, dz) < 1) wanted = 0;
  const acceleration = giant ? .5 : aquatic ? .9 : 1.8;
  c.speed += clamp(wanted - c.speed, -acceleration * 1.7 * dt, acceleration * dt);
  const distance = c.speed * dt, nx = c.x + Math.sin(c.yaw) * distance, nz = c.z - Math.cos(c.yaw) * distance;
  if (distance > 0 && clearPath(c, c.yaw, Math.max(distance, .05), colliders)) {
    c.x = nx; c.z = nz; c.gait += distance / ((c.stride || 1) * c.scale) * TAU;
  } else c.speed = Math.max(0, c.speed - acceleration * 2 * dt);
  c.stuckTime = requested > .1 && c.speed < .12 ? (c.stuckTime || 0) + dt : Math.max(0, (c.stuckTime || 0) - dt * 2);
  if (c.stuckTime > 1.3 && !c.recoverTime) {
    let escape = null, score = -Infinity;
    for (let i = 0; i < 16; i++) {
      const yaw = c.yaw + i / 16 * TAU; if (!clearPath(c, yaw, c.bodyRadius + 1.5, colliders)) continue;
      const value = Math.cos(difference(yaw, desired)) + Math.abs(Math.sin(yaw - c.yaw)) * .2;
      if (value > score) { score = value; escape = { x: c.x + Math.sin(yaw) * 7, z: c.z - Math.cos(yaw) * 7 }; }
    }
    if (escape) { c.escapeTarget = escape; c.recoverTime = 3; } c.stuckTime = 0;
  }
}

export function updateWildlife(game, creatures, dt, colliders = []) {
  const p = game.player, neighbors = creatures.map(c => ({ id: c.id, herd: c.herd, yaw: c.yaw, x: c.x, z: c.z, species: c.species, scale: c.scale, bodyRadius: c.bodyRadius, thirst: c.thirst }));
  for (const c of creatures) {
    const local = nearby(colliders, c.x, c.z, 38);
    const role = SPECIES[c.species].role, aquatic = role === 'marine', predator = role === 'hunter' || aquatic, giant = role === 'giant';
    c.timer -= dt; c.cooldown = Math.max(0, c.cooldown - dt); c.memory = Math.max(0, c.memory - dt); c.thirst = Math.min(1, c.thirst + dt / 170);
    const distance = Math.hypot(p.x - c.x, p.z - c.z), validHabitat = aquatic ? p.y < .9 && ground(p.x, p.z) < -2 && !isFreshwater(p.x, p.z) : p.y >= .9 && ground(p.x, p.z) > 0;
    let target = { x: c.targetX, z: c.targetZ }, speed = 0, head = 0;
    if (predator && ((c.defendUntil ?? -1) > game.elapsed || !aquatic && p.climb && p.climb.height > 4.5 && distance < 30)) {
      c.state = p.climb ? 'Watching' : 'Hesitating'; c.attackWindup = 0; c.speed = Math.max(0, c.speed - dt * 8); c.gaitStrength *= Math.exp(-dt * 8); continue;
    }
    if (predator) {
      const sensed = validHabitat && canSense(c, p, local);
      if (sensed) { c.lastX = p.x; c.lastZ = p.z; c.memory = 5; c.searchTime = 6; }
      if (!validHabitat) { c.memory = 0; c.searchTime = 0; c.attackWindup = 0; }
      if (c.memory > 0) {
        target = { x: c.lastX, z: c.lastZ };
        const close = distance < (aquatic ? 3.7 : 3.4), facing = Math.cos(difference(angleTo(p.x - c.x, p.z - c.z), c.yaw)) > .55;
        if (sensed && close && facing && c.cooldown <= 0 && Math.abs(p.y - c.y) < 5) {
          c.state = 'Attacking'; c.attackWindup += dt;
          if (c.attackWindup >= .55) { game.health = Math.max(0, game.health - (aquatic ? 9 : 13)); game.damage = 1; game.attackAt = game.elapsed; c.cooldown = 2.6; c.attackWindup = 0; }
        } else {
          c.attackWindup = 0;
          c.state = c.cooldown > 1.5 ? 'Recovering' : !sensed ? 'Tracking' : distance > 17 ? 'Watching' : distance > 10 ? 'Stalking' : 'Chasing';
          speed = c.state === 'Recovering' || c.state === 'Watching' ? 0 : c.state === 'Stalking' ? .8 : aquatic ? 2.1 : 3.65;
        }
      } else if (c.searchTime > 0) {
        c.searchTime -= dt; c.state = 'Searching'; target = { x: c.lastX + Math.sin(c.searchTime + c.phase) * 4, z: c.lastZ + Math.cos(c.searchTime + c.phase) * 4 }; speed = .65;
      } else { c.state = aquatic ? 'Cruising' : 'Patrolling'; speed = aquatic ? .9 : .55; }
    } else {
      const herd = neighbors.filter(o => o.species === c.species && o.herd === c.herd), leader = herd.reduce((a, b) => a.scale >= b.scale ? a : b);
      const threat = neighbors.find(o => SPECIES[o.species].role === 'hunter' && Math.hypot(o.x - c.x, o.z - c.z) < 19);
      if (threat || distance < (giant ? 5 : 8)) {
        const source = threat || p, dx = c.x - source.x, dz = c.z - source.z, d = Math.hypot(dx, dz) || 1;
        c.state = threat ? 'Fleeing' : 'Moving away'; target = { x: c.x + dx / d * 12, z: c.z + dz / d * 12 }; speed = giant ? 1 : 2;
      } else if (distance < (giant ? 12 : 15)) { c.state = 'Alert'; target = p; }
      else if (Math.max(c.thirst, leader.thirst) > .8) {
        const source = nearestWater(c.homeX, c.homeZ), a = Math.atan2(c.homeZ - source.z, c.homeX - source.x) + (c.id % 3 - 1) * .20;
        target = { x: source.x + Math.cos(a) * 6.8, z: source.z + Math.sin(a) * 6.8 };
        const atWater = Math.hypot(c.x - target.x, c.z - target.z) < 2;
        c.state = atWater ? 'Drinking' : 'Seeking water'; speed = atWater ? 0 : giant ? .65 : .8; head = atWater ? 1 : 0;
        if (atWater) { c.drinkTime += dt; if (c.drinkTime > 7) { c.thirst = .05; c.drinkTime = 0; } }
      } else if (leader.id !== c.id && Math.hypot(c.x - leader.x, c.z - leader.z) > (giant ? 12 : 9)) {
        c.state = 'Following herd'; const side = c.id % 2 ? 1 : -1; target = { x: leader.x + Math.sin(leader.yaw) * -5 + Math.cos(leader.yaw) * side * 4, z: leader.z + Math.cos(leader.yaw) * 5 - Math.sin(leader.yaw) * side * 4 }; speed = giant ? .6 : .85;
      } else {
        const resting = c.timer < 3, feeding = c.timer >= 3 && c.timer < 9;
        c.state = resting ? 'Resting' : feeding ? 'Browsing' : 'Foraging'; speed = resting || feeding ? 0 : giant ? .43 : .65; head = feeding ? .8 : 0;
      }
    }
    if (c.timer <= 0) {
      c.decisions++; const a = c.phase + c.decisions * 2.399;
      c.targetX = c.homeX + Math.sin(a) * (giant ? 9 : aquatic ? 14 : 12); c.targetZ = c.homeZ + Math.cos(a) * (giant ? 9 : aquatic ? 14 : 12); c.timer = 14 + (Math.sin(a) + 1) * 3;
      if (['Foraging', 'Patrolling', 'Cruising', 'Resting'].includes(c.state)) target = { x: c.targetX, z: c.targetZ };
    }
    steer(c, target, speed, dt, local, neighbors);
    c.gaitStrength = blend(c.gaitStrength || 0, Math.min(1, c.speed / .45), 7, dt);
    if (c.role === 'hunter' || aquatic) head = c.state === 'Attacking' ? .9 : c.state === 'Chasing' ? .28 : .035;
    c.headPose = blend(c.headPose, head, 1.8, dt);
    if (aquatic) { c.y = blend(c.y, Math.max(ground(c.x, c.z) + 2, -4.5 + Math.sin(game.clock * .2 + c.phase) * .7), 1.2, dt); c.roll = blend(c.roll || 0, clamp(difference(angleTo(target.x - c.x, target.z - c.z), c.yaw) * -.12, -.15, .15), 2, dt); }
    else groundCreature(c, dt);
  }
}
