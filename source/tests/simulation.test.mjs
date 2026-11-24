import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = await build({ stdin: { contents: "export * from './jurassic/simulation.js'; export * from './jurassic/world.js'; export * from './jurassic/renderer.js'; export * from './jurassic/assets.js'; export * from './jurassic/terrain.js'; export * from './jurassic/wildlife.js'; export * from './jurassic/spatial.js';", resolveDir: root }, write: false, bundle: true, format: 'cjs', platform: 'node', target: 'es2022', loader: { '.bin': 'binary', '.jpg': 'dataurl', '.png': 'dataurl' }, define: { __DEV__: 'false' },
  plugins: [{ name: 'abyssal-math', setup(b) { b.onLoad({ filter: /[\\/]src[\\/]math\.js$/ }, ({ path: p }) => ({ contents: readFileSync(p, 'utf8') + '\nexport { Mesh, icosphere, surfaceNets, sampler3, rnd, rr, rseed, vnoise, fbm, clamp, mix, sstep };', loader: 'js' })); } }] });
const module = { exports: {} }; new Function('module', 'exports', bundle.outputFiles[0].text)(module, module.exports);
const { newGame, movePlayer, updateSurvival, updateCreatures, interact, eat, inspect, ground, makeCreatures, makeWorld, saveGame, loadGame, SAVE_KEY, DAY_SECONDS, CACHE, SPRING, SPECIES, FLORA, writeLightMatrix, detailedAnimals, unpackMesh, writeTransform } = module.exports;
const { LIMIT, MAP_SPAN, WATER_SOURCES, CACHES, LANDMARKS, REGIONS, regionAt, coastHeight, nearestWater, indexColliders, nearby, groundCreature, gaitStep } = module.exports;
let cachedWorld; const testWorld = () => cachedWorld ||= makeWorld();
test('revised animal anatomy is finite, rigged and assigned the embedded skin material', () => {
  const meshes = detailedAnimals();
  for (const [species, key] of [[1, 'allo'], [2, 'crypto'], [4, 'diplo'], [5, 'cerato']]) {
    const { vertices, indices } = meshes[key], joints = new Set();
    assert.equal(SPECIES[species].material, 3);
    for (let i = 0; i < vertices.length; i += 16) {
      for (let k = 0; k < 16; k++) assert.ok(Number.isFinite(vertices[i + k]), `${key} attribute ${i + k}`);
      assert.ok(vertices[i + 15] >= 0 && vertices[i + 15] <= 1); joints.add(vertices[i + 9]);
      if (vertices[i + 10] === -99 && vertices[i + 2] < (key === 'diplo' ? -9 : -2)) assert.ok(vertices[i + 9] >= 15, `${key} detached facial feature`);
    }
    assert.ok(joints.has(15)); if (key !== 'diplo') assert.ok(joints.has(16));
    for (const index of indices) assert.ok(index < vertices.length / 16);
    if (key === 'crypto') for (const joint of [6, 7, 8, 9]) assert.ok(joints.has(joint), 'four independently rigged flippers');
    else for (const joint of [10, 12, 14]) assert.ok(joints.has(joint));
  }
});
test('bundled internet skin matches its recorded CC0 source checksum', () => {
  const manifest = JSON.parse(readFileSync(path.join(root, 'assets/appearance-sources.json'), 'utf8'));
  assert.equal(manifest.texture.license, 'CC0-1.0');
  assert.equal(createHash('sha256').update(readFileSync(path.join(root, 'assets/reptile-skin.png'))).digest('hex'), manifest.texture.sha256);
  assert.equal(module.exports.animalTextures.length, 4); assert.match(module.exports.animalTextures[3][0], /^data:image\/png;base64,/);
});
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
  const w = testWorld(); assert.ok(w.objects.length > 900); assert.ok(w.colliders.length > 100);
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
  const data = new Float32Array(36); writeTransform(data, 0, c); assert.ok(data.every(Number.isFinite));
  assert.ok(Math.abs(data[1]) > .001 || Math.abs(data[9]) > .001); assert.ok(Math.abs(data[24] - c.feet[0]) < .00001);
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

test('walking accelerates, releases smoothly and transitions into a sprint without an instant speed jump', () => {
  const g = newGame(); movePlayer(g, { forward: 1 }, 1 / 60, []); assert.ok(Math.hypot(g.player.vx, g.player.vz) < .6);
  tick(g, { forward: 1 }, 1); const walk = Math.hypot(g.player.vx, g.player.vz); assert.ok(walk > 2 && walk <= 3.21);
  movePlayer(g, { forward: 1, sprint: true }, 1 / 60, []); const run = Math.hypot(g.player.vx, g.player.vz); assert.ok(run > walk && run - walk < .6);
  tick(g, {}, .7); assert.ok(Math.hypot(g.player.vx, g.player.vz) < .03);
});

test('player collision slides past a trunk without penetrating or producing invalid velocity', () => {
  const g = newGame(), p = g.player; p.yaw = 0; const trunk = { x: p.x + .4, z: p.z - 2, radius: .8 };
  for (let i = 0; i < 180; i++) { movePlayer(g, { forward: 1 }, 1 / 60, [trunk]); assert.ok(Math.hypot(p.x - trunk.x, p.z - trunk.z) >= 1.149); }
  assert.ok([p.x, p.y, p.z, p.vx, p.vz].every(Number.isFinite)); assert.ok(p.z < trunk.z);
});

test('swimming keeps its state across the surface band and recovers onto shallow land', () => {
  const g = newGame(), p = g.player; p.x = 120; p.z = 30; p.y = 1.25; p.swimming = true;
  movePlayer(g, {}, .016, []); assert.equal(p.swimming, true);
  p.x = 56; p.z = 32; p.y = ground(56, 32) + 1.7; movePlayer(g, {}, .016, []); assert.equal(p.swimming, false); assert.ok(p.grounded);
});

test('the expanded region has separate wetlands, uplands and lagoon while retaining the starting terrain', () => {
  assert.equal(LIMIT, 600); assert.equal(MAP_SPAN, 1280); assert.equal(REGIONS.length, 5);
  for (const [x, z] of [[56, 32], [42, 16], [-27, -22], [132, 25], [-100.3, 40.7]]) {
    const x0 = Math.floor(x / 2) * 2, z0 = Math.floor(z / 2) * 2, u = (x - x0) / 2, v = (z - z0) / 2;
    const a = Math.fround(coastHeight(x0, z0)), b = Math.fround(coastHeight(x0 + 2, z0)), c = Math.fround(coastHeight(x0, z0 + 2)), d = Math.fround(coastHeight(x0 + 2, z0 + 2));
    const legacy = u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
    assert.ok(Math.abs(ground(x, z) - legacy) < .00001);
  }
  assert.ok(ground(-350, -260) > 35); assert.ok(ground(-170, 280) < 7); assert.ok(ground(330, 210) < -4);
  for (const p of REGIONS.slice(1)) assert.equal(regionAt(p.x, p.z, ground(p.x, p.z)), p.name);
});

test('terrain tiles join at the same heights and carry local positions for culling', () => {
  const w = testWorld(), tiles = w.objects.filter(o => o.mesh.startsWith('terrain_')); assert.equal(tiles.length, 400);
  const a = tiles.find(o => o.mesh === 'terrain_320_320'), b = tiles.find(o => o.mesh === 'terrain_352_320'), va = w.meshes[a.mesh].vertices, vb = w.meshes[b.mesh].vertices;
  for (let row = 0; row <= 32; row++) {
    const ia = (row * 33 + 32) * 16, ib = row * 33 * 16;
    assert.ok(Math.abs(va[ia + 1] + a.y - vb[ib + 1] - b.y) < .00001);
    assert.ok(Math.abs(va[ia] + a.x - vb[ib] - b.x) < .00001);
  }
});

test('all regional springs and caches work with separate persistent provision cooldowns', () => {
  const g = newGame(); assert.equal(WATER_SOURCES.length, 4); assert.equal(CACHES.length, 4); assert.equal(LANDMARKS.length, 4);
  for (const source of WATER_SOURCES) { placePlayer(g, source.x, source.z); g.thirst = 10; interact(g); assert.equal(g.thirst, 100); }
  for (const cache of CACHES) { placePlayer(g, cache.x, cache.z); const r = g.rations; interact(g); assert.equal(g.rations, r + 2); interact(g); assert.equal(g.rations, r + 2); }
  const memory = new Map(), storage = { setItem: (k, v) => memory.set(k, v), getItem: k => memory.get(k) }; saveGame(g, storage); const restored = loadGame(storage);
  assert.ok(restored); const r = restored.rations; interact(restored); assert.equal(restored.rations, r);
});

test('regional wildlife keeps separate herds and valid land or sea homes', () => {
  const animals = makeCreatures(); assert.ok(animals.length >= 30); assert.ok(new Set(animals.map(c => c.herd)).size > 10);
  for (const c of animals) assert.ok(SPECIES[c.species].role === 'marine' ? ground(c.x, c.z) < -4 : ground(c.x, c.z) > .35, `${c.herd}: ${ground(c.x, c.z)}`);
  assert.equal(nearestWater(-350, -220).id, 'upland'); assert.equal(nearestWater(-170, 250).id, 'marsh');
});

test('spatial queries include large colliders across cell boundaries and omit distant cells', () => {
  const colliders = indexColliders([{ x: 23, z: 0, radius: 5 }, { x: 400, z: 400, radius: 2 }]);
  assert.equal(nearby(colliders, 28, 0, 1).length, 1); assert.equal(nearby(colliders, -300, -300, 2).length, 0);
});

test('an animal overlapping an obstacle can recover instead of remaining permanently pinned', () => {
  const g = newGame(), c = makeCreatures()[0]; placePlayer(g, 50, 100); c.timer = 19; c.targetX = c.x; c.targetZ = c.z - 14; c.yaw = 0;
  const obstacle = { x: c.x + .4, z: c.z, radius: 1 }; const before = Math.hypot(c.x - obstacle.x, c.z - obstacle.z);
  wildlifeTick(g, [c], 12, [obstacle]); assert.ok(Math.hypot(c.x - obstacle.x, c.z - obstacle.z) > before + 1);
});

test('a stance foot stays near its captured contact during a small turn', () => {
  const c = makeCreatures()[0]; c.speed = .5; c.gaitStrength = 1; c.gait = .5; groundCreature(c, 1); assert.ok(gaitStep(c, 0).stance);
  const anchor = { ...c.anchors[0] }; c.x += .08; c.yaw += .025; groundCreature(c, .1);
  assert.equal(c.anchors[0].x, anchor.x); assert.equal(c.anchors[0].z, anchor.z); assert.ok(c.footDrift.some(v => Math.abs(v) > .01));
  const data = new Float32Array(36); writeTransform(data, 0, c); assert.ok(Math.abs(data[28] - c.footDrift[0]) < .00001);
});

test('legacy player saves and higher upland saves load with safe reset movement', () => {
  const g = newGame(), memory = new Map(), storage = { setItem: (k, v) => memory.set(k, v), getItem: k => memory.get(k) };
  delete g.player.vx; delete g.player.vz; saveGame(g, storage); let loaded = loadGame(storage); assert.equal(loaded.player.x, g.player.x); assert.equal(loaded.player.vx, 0);
  placePlayer(g, -350, -260); saveGame(g, storage); loaded = loadGame(storage); assert.ok(loaded); assert.equal(loaded.player.z, -260); assert.ok(loaded.player.y >= ground(-350, -260) + 1.7);
});

test('a short rock does not become an invisible column above its actual height', () => {
  const g = newGame(), p = g.player, x = p.x, z = p.z, floor = ground(x, z); p.y = floor + 10; p.grounded = false; p.yaw = 0; p.vz = -3;
  const rock = { x, z: z - .2, radius: .8, bottom: floor - 1, top: floor + 1 };
  movePlayer(g, { forward: 1 }, .1, [rock]); assert.ok(Math.abs(p.x - x) < .001); assert.ok(p.z < z - .25 && p.z > z - .36);
});

test('marine animals steer around rock pinnacles at their swimming depth', () => {
  const g = newGame(), c = makeCreatures().find(c => c.herd === 'lagoon-marine'); placePlayer(g, 56, 32); c.yaw = 0; c.timer = 20; c.targetX = c.x; c.targetZ = c.z - 16;
  const rock = { x: c.x, z: c.z - 5, radius: 1, bottom: -12, top: 2 };
  for (let i = 0; i < 600; i++) { updateCreatures(g, [c], 1 / 60, [rock]); assert.ok(Math.hypot(c.x - rock.x, c.z - rock.z) > rock.radius + c.bodyRadius - .02); }
});
