import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = await build({ stdin: { contents: "export * from './jurassic/simulation.js'; export * from './jurassic/world.js';", resolveDir: root }, write: false, bundle: true, format: 'cjs', platform: 'node',
  plugins: [{ name: 'abyssal-math', setup(b) { b.onLoad({ filter: /[\\/]src[\\/]math\.js$/ }, ({ path: p }) => ({ contents: readFileSync(p, 'utf8') + '\nexport { Mesh, icosphere, rnd, rr, rseed, vnoise, fbm, clamp, mix, sstep };', loader: 'js' })); } }] });
const module = { exports: {} }; new Function('module', 'exports', bundle.outputFiles[0].text)(module, module.exports);
const { newGame, movePlayer, updateSurvival, updateCreatures, interact, eat, inspect, ground, makeCreatures, makeWorld, saveGame, loadGame, SAVE_KEY, DAY_SECONDS, CACHE, SPRING } = module.exports;
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
  updateCreatures(g, animals, .016); assert.ok(g.health < 100); const h = g.health;
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
  win.discovered = [0, 1, 2]; win.drank = win.supplied = true; updateSurvival(win, .01); assert.equal(win.won, true);
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
test('the procedural world builds finite indexed geometry and all three species', () => {
  const w = makeWorld(); assert.ok(w.objects.length > 900); assert.ok(w.colliders.length > 100);
  for (const [name, mesh] of Object.entries(w.meshes)) { assert.ok(mesh.vertices.every(Number.isFinite), name); assert.ok(mesh.indices.every(i => i < mesh.vertices.length / 10), name); }
  assert.deepEqual([...new Set(makeCreatures().map(c => c.species))], [0, 1, 2]);
});
