import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = await build({ stdin: { contents: "export * from './jurassic/simulation.js'; export * from './jurassic/world.js'; export * from './jurassic/renderer.js'; export * from './jurassic/assets.js';", resolveDir: root }, write: false, bundle: true, format: 'cjs', platform: 'node', target: 'es2022', loader: { '.bin': 'binary', '.jpg': 'dataurl' }, define: { __DEV__: 'false' },
  plugins: [{ name: 'abyssal-math', setup(b) { b.onLoad({ filter: /[\\/]src[\\/]math\.js$/ }, ({ path: p }) => ({ contents: readFileSync(p, 'utf8') + '\nexport { Mesh, icosphere, surfaceNets, sampler3, rnd, rr, rseed, vnoise, fbm, clamp, mix, sstep };', loader: 'js' })); } }] });
const module = { exports: {} }; new Function('module', 'exports', bundle.outputFiles[0].text)(module, module.exports);
const { newGame, movePlayer, updateSurvival, updateCreatures, interact, eat, inspect, ground, makeCreatures, makeWorld, saveGame, loadGame, SAVE_KEY, DAY_SECONDS, CACHE, SPRING, SPECIES, FLORA, writeLightMatrix, detailedAnimals, unpackMesh, writeTransform } = module.exports;
const tick = (game, input, seconds) => { for (let t = 0; t < seconds; t += 1 / 60) movePlayer(game, input, 1 / 60, []); };

test('walking stays above terrain and jumping returns to the ground', () => {
  const g = newGame(), y = g.player.y; tick(g, { jump: true }, .12); assert.ok(g.player.y > y + .3);
  tick(g, {}, 3); assert.ok(Math.abs(g.player.y - ground(g.player.x, g.player.z) - 1.7) < .001);
  tick(g, { forward: true }, 8); assert.ok(g.player.y >= ground(g.player.x, g.player.z) + 1.69);
});
test('crossing the shoreline transitions to swimming and allows diving and surfacing', () => {
  const g = newGame(); g.player.x = 75; g.player.z = 30; g.player.y = ground(75, 30) + 1.7; g.player.yaw = Math.PI / 2;
  tick(g, { forward: true }, 25); assert.ok(ground(g.player.x, g.player.z) < -.9); assert.ok(g.player.y < 1);
  tick(g, { dive: true }, 3); assert.ok(g.player.y < -3);
  tick(g, { jump: true }, 4); assert.ok(g.player.y > 0);
});
test('oxygen only drains underwater; fresh water and supplies restore resources', () => {
  const g = newGame(); g.player.y = -2; updateSurvival(g, 10); assert.equal(g.oxygen, 73); g.player.y = 3; updateSurvival(g, 1); assert.equal(g.oxygen, 97);
  Object.assign(g.player, { ...SPRING, y: ground(SPRING.x, SPRING.z) + 1.7 }); interact(g); assert.equal(g.thirst, 100); assert.equal(g.drank, true);
  Object.assign(g.player, { ...CACHE, y: ground(CACHE.x, CACHE.z) + 1.7 }); interact(g); assert.equal(g.rations, 4); interact(g); assert.equal(g.rations, 4);
  g.hunger = 40; eat(g); assert.equal(g.hunger, 78); assert.equal(g.rations, 3);
});
test('an ocean visit cannot refill thirst, and a depleted cache has a cooldown', () => {
  const g = newGame(); g.player.x = 150; g.player.z = 30; g.player.y = .5; const thirst = g.thirst; interact(g); assert.equal(g.thirst, thirst);
  Object.assign(g.player, { ...CACHE, y: ground(CACHE.x, CACHE.z) + 1.7 }); interact(g); g.elapsed = 301; interact(g); assert.equal(g.rations, 6);
});
test('land predators attack nearby players but do not chase them into the sea', () => {
  const g = newGame(), animals = makeCreatures(), c = animals.find(c => c.species === 1);
  g.player.x = c.x + 2; g.player.z = c.z; g.player.y = ground(c.x, c.z) + 1.7;
  c.yaw = Math.PI / 2;
  updateCreatures(g, animals, .016); assert.equal(g.health, 100);
  for (let i = 0; i < 40; i++) updateCreatures(g, animals, 1 / 60);
  assert.ok(g.health < 100); const h = g.health;
  updateCreatures(g, animals, .016); assert.equal(g.health, h); // attack cooldown
  g.player.y = -.5; updateCreatures(g, animals, .016); assert.ok(!['Approaching', 'Attacking'].includes(c.state));
});
test('observation requires facing wildlife and cannot cross the air/water boundary', () => {
  const g = newGame(), animal = { x: g.player.x, z: g.player.z - 10, y: g.player.y - 2, species: 0 };
  g.player.yaw = 0; g.player.pitch = 0; assert.equal(inspect(g, [animal]), animal);
  g.player.yaw = Math.PI; assert.equal(inspect(g, [animal]), null);
  g.player.yaw = 0; animal.species = 2; animal.y = -4; assert.equal(inspect(g, [animal]), null);
});
test('death and the full-day objective lead to distinct outcomes', () => {
  const g = newGame(); g.health = 1; g.oxygen = 0; g.player.y = -3; updateSurvival(g, 1); assert.equal(g.dead, true);
  const win = newGame(); win.elapsed = DAY_SECONDS; updateSurvival(win, .01); assert.equal(win.won, false);
  win.discovered = SPECIES.map((_, i) => i); win.drank = win.supplied = true; updateSurvival(win, .01); assert.equal(win.won, true);
});
test('saves round-trip and malformed or finished saves are ignored', () => {
  const memory = new Map(), storage = { setItem: (k, v) => memory.set(k, v), getItem: k => memory.get(k) };
  const g = newGame(); g.discovered = [0, 2]; g.elapsed = 120; assert.equal(saveGame(g, storage), true); assert.equal(loadGame(storage).elapsed, 120);
  memory.set(SAVE_KEY, '{broken'); assert.equal(loadGame(storage), null);
  g.player.x = 1e9; saveGame(g, storage); assert.equal(loadGame(storage), null);
  g.player.x = 10; g.dead = true; saveGame(g, storage); assert.equal(loadGame(storage), null);
  const denied = { getItem() { throw new Error('Storage blocked'); }, setItem() { throw new Error('Storage blocked'); } };
  assert.equal(loadGame(denied), null); assert.equal(saveGame(newGame(), denied), false);
});

test('release excludes development fixtures and preserves the upstream license and demo', () => {
  const html = readFileSync(path.join(root, '..', 'index.html'), 'utf8');
  assert.ok(!html.includes('jurassicDev')); assert.ok(!html.includes('dev-tools'));
  assert.ok(html.includes('Copyright (c) 2026 Maksymilian Dendura'));
  assert.ok(html.includes('Permission is hereby granted, free of charge'));
  assert.ok(readFileSync(path.join(root, '..', 'abyssal.html'), 'utf8').includes('Abyssal Garden'));
});
test('the procedural world builds finite indexed geometry and all six species', () => {
  const w = makeWorld(); assert.ok(w.objects.length > 900); assert.ok(w.colliders.length > 100);
  for (const [name, mesh] of Object.entries(w.meshes)) { assert.ok(mesh.vertices.every(Number.isFinite), name); assert.ok(mesh.indices.every(i => i < mesh.vertices.length / 16), name); }
  assert.deepEqual([...new Set(makeCreatures().map(c => c.species))], [0, 1, 2, 3, 4, 5]);
  for (const name of ['tree', 'ginkgo', 'cycad', 'treefern', 'fern', 'horsetail']) assert.ok(w.objects.some(o => o.mesh === name), name);
});

test('expanded Jurassic catalog uses distinct models and roles', () => {
  assert.equal(SPECIES.length, 6); assert.equal(FLORA.length, 6);
  assert.equal(new Set(SPECIES.map(s => s.mesh)).size, 6);
  assert.equal(SPECIES[3].name, 'Brachiosaurus'); assert.equal(SPECIES[4].name, 'Diplodocus'); assert.equal(SPECIES[5].name, 'Ceratosaurus');
  const animals = makeCreatures();
  for (const c of animals) { assert.equal(c.role, SPECIES[c.species].role); assert.equal(c.material, SPECIES[c.species].material); }
});

test('detailed meshes retain UVs, deformation weights, and smooth finite normals', () => {
  const models = detailedAnimals();
  for (const [name, m] of Object.entries(models)) {
    assert.ok(m.indices.length > 12000, name); assert.equal(m.vertices.length % 16, 0);
    for (let i = 0; i < m.vertices.length; i += 16) {
      assert.ok(m.vertices.subarray(i, i + 16).every(Number.isFinite), name);
      assert.ok(m.vertices[i + 15] >= 0 && m.vertices[i + 15] <= 1, name);
    }
  }
  assert.ok(models.stego.vertices.some((v, i) => i % 16 === 15 && v > .5));
  assert.throws(() => unpackMesh(new Uint8Array(16)), /Unsupported/);
});

test('new predator uses the same attack cooldown and water escape rules', () => {
  const g = newGame(), c = makeCreatures().find(c => c.species === 5);
  g.player.x = c.x + 2; g.player.z = c.z; g.player.y = ground(c.x, c.z) + 1.7;
  c.yaw = Math.PI / 2;
  updateCreatures(g, [c], .016); assert.equal(g.health, 100);
  for (let i = 0; i < 40; i++) updateCreatures(g, [c], 1 / 60);
  assert.equal(g.health, 87);
  updateCreatures(g, [c], .016); assert.equal(g.health, 87);
  g.player.y = -.5; updateCreatures(g, [c], .016); assert.ok(!['Approaching', 'Attacking'].includes(c.state));
});

test('existing three-species saves keep observations while the expanded goal requires six', () => {
  const g = newGame(), memory = new Map(), storage = { setItem: (k, v) => memory.set(k, v), getItem: k => memory.get(k) };
  g.discovered = [0, 1, 2]; g.elapsed = DAY_SECONDS; g.drank = g.supplied = true;
  saveGame(g, storage); const restored = loadGame(storage); assert.deepEqual(restored.discovered, [0, 1, 2]);
  updateSurvival(restored, .01); assert.equal(restored.won, false);
  restored.discovered.push(3, 4, 5); updateSurvival(restored, .01); assert.equal(restored.won, true);
});

test('shadow projection stays finite and centers its tracked region', () => {
  const out = new Float32Array(64), light = [.4, .8, -.4], l = Math.hypot(...light); writeLightMatrix(out, 44, 20, 10, -30, light.map(v => v / l));
  assert.ok(out.every(Number.isFinite));
  const m = out.subarray(44), p = [20, 10, -30];
  assert.ok(Math.abs(m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) < .00001);
  assert.ok(Math.abs(m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) < .00001);
  assert.ok(Math.abs(m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14] - .5) < .00001);
});

const wildlifeTick = (g, animals, seconds, colliders = []) => { for (let t = 0; t < seconds; t += 1 / 60) { g.clock += 1 / 60; g.elapsed += 1 / 60; updateCreatures(g, animals, 1 / 60, colliders); } };
const placePlayer = (g, x, z) => Object.assign(g.player, { x, z, y: ground(x, z) + 1.7 });

test('predators notice a nearby player, accelerate gradually and keep gait phase continuous', () => {
  const g = newGame(), c = makeCreatures().find(c => c.species === 1); placePlayer(g, c.x, c.z - 8); c.yaw = 0;
  const phase = c.gait; updateCreatures(g, [c], 1 / 60); assert.equal(c.state, 'Chasing'); assert.ok(c.speed > 0 && c.speed < .1); assert.ok(c.gait >= phase);
  wildlifeTick(g, [c], .5); assert.ok(c.speed > .3 && c.speed < 1.3); const gait = c.gait;
  placePlayer(g, c.x, c.z - 14); updateCreatures(g, [c], 1 / 60); assert.ok(c.gait >= gait && c.gait - gait < .3);
});

test('distant players behind a predator or behind an obstacle are not automatically detected', () => {
  const g = newGame(), c = makeCreatures().find(c => c.species === 1); c.yaw = 0; placePlayer(g, c.x, c.z + 15);
  updateCreatures(g, [c], .016); assert.equal(c.memory, 0); assert.equal(c.state, 'Patrolling');
  placePlayer(g, c.x, c.z - 15); const blocker = { x: c.x, z: c.z - 7, radius: 1.5 };
  updateCreatures(g, [c], .016, [blocker]); assert.equal(c.memory, 0);
  updateCreatures(g, [c], .016); assert.ok(c.memory > 0); assert.equal(c.state, 'Stalking');
});

test('predators search the last seen area and eventually abandon a lost player', () => {
  const g = newGame(), c = makeCreatures().find(c => c.species === 1); c.yaw = 0; placePlayer(g, c.x, c.z - 12);
  updateCreatures(g, [c], .016); assert.ok(c.memory > 0); placePlayer(g, -100, 40);
  wildlifeTick(g, [c], 5.2); assert.equal(c.state, 'Searching');
  wildlifeTick(g, [c], 7); assert.equal(c.state, 'Patrolling'); assert.equal(c.memory, 0);
});

test('an attack has a windup and can be interrupted by escaping into water', () => {
  const g = newGame(), c = makeCreatures().find(c => c.species === 5); c.yaw = Math.PI / 2; placePlayer(g, c.x + 2, c.z);
  wildlifeTick(g, [c], .25); assert.equal(g.health, 100); assert.equal(c.state, 'Attacking');
  g.player.y = -.5; wildlifeTick(g, [c], .5); assert.equal(g.health, 100); assert.equal(c.attackWindup, 0); assert.equal(c.memory, 0);
});

test('separated herbivores follow their herd, and respond to nearby predators', () => {
  const g = newGame(), herd = makeCreatures().filter(c => c.species === 0); placePlayer(g, 50, 90);
  herd[1].x = herd[0].x - 18; herd[1].z = herd[0].z; herd[1].y = ground(herd[1].x, herd[1].z);
  updateCreatures(g, herd, .016); assert.equal(herd[1].state, 'Following herd');
  const hunter = makeCreatures().find(c => c.species === 1); hunter.x = herd[0].x + 12; hunter.z = herd[0].z; hunter.y = ground(hunter.x, hunter.z);
  updateCreatures(g, [...herd, hunter], .016); assert.equal(herd[0].state, 'Fleeing');
});

test('thirsty herbivores seek freshwater and finish a drinking pause', () => {
  const g = newGame(), c = makeCreatures()[0]; placePlayer(g, -100, 70); c.thirst = .95;
  updateCreatures(g, [c], .016); assert.equal(c.state, 'Seeking water');
  const a = Math.atan2(c.homeZ - SPRING.z, c.homeX - SPRING.x) - .2;
  c.x = SPRING.x + Math.cos(a) * 6.8; c.z = SPRING.z + Math.sin(a) * 6.8; c.y = ground(c.x, c.z); c.speed = 0;
  wildlifeTick(g, [c], 7.5); assert.ok(c.thirst < .15); assert.equal(c.drinkTime, 0);
});

test('terrain alignment and foot corrections stay bounded and reach the instance transform', () => {
  const g = newGame(), c = makeCreatures().find(c => c.species === 3); placePlayer(g, c.x + 10, c.z);
  wildlifeTick(g, [c], 2); assert.ok(Math.abs(c.pitch) > .001 || Math.abs(c.roll) > .001);
  assert.ok(Math.abs(c.pitch) <= .27 && Math.abs(c.roll) <= .22); assert.ok(c.feet.every(v => Number.isFinite(v) && Math.abs(v) <= .7));
  const data = new Float32Array(32); writeTransform(data, 0, c); assert.ok(data.every(Number.isFinite));
  assert.ok(Math.abs(data[1]) > .001 || Math.abs(data[9]) > .001); assert.ok(Math.abs(data[28] - c.feet[0]) < .00001);
});

test('obstacle steering and bounded habitats remain stable over a long simulated encounter', () => {
  const g = newGame(), c = makeCreatures()[0]; placePlayer(g, 50, 100); c.timer = 18; c.yaw = 0; c.targetX = c.x; c.targetZ = c.z - 20;
  const obstacle = { x: c.x, z: c.z - 4, radius: 1.2 }; wildlifeTick(g, [c], 25, [obstacle]);
  assert.ok(Math.hypot(c.x - obstacle.x, c.z - obstacle.z) >= obstacle.radius + c.bodyRadius - .02);
  assert.ok(ground(c.x, c.z) > 2); assert.ok([c.x, c.y, c.z, c.gait, c.speed].every(Number.isFinite));
});

test('Stegosaurus head and tail weights match the common forward direction', () => {
  const { vertices: v } = detailedAnimals().stego; let heads = 0, tails = 0;
  for (let i = 0; i < v.length; i += 16) {
    if (v[i + 9] === 15 && v[i + 15] > .5) { assert.ok(v[i + 2] < 0); heads++; }
    if (v[i + 9] === 14 && v[i + 15] > .5) { assert.ok(v[i + 2] > 0); tails++; }
  }
  assert.ok(heads > 10 && tails > 10);
});
