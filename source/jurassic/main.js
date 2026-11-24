/*! World Stimulation Game. Based on Abyssal Garden by Maksymilian Dendura (MIT). */
import { makeWorld, makeCreatures, ground, SPECIES, SPRING, CACHE, DAY_SECONDS } from './world.js';
import { newGame, movePlayer, updateCreatures, updateSurvival, interact, eat, inspect, saveGame, loadGame, SAVE_KEY } from './simulation.js';
import { makeRenderer } from './renderer.js';
import { makeAudio } from './audio.js';

const $ = id => document.getElementById(id), canvas = $('world'), audio = makeAudio();
let game = loadGame() || newGame(), creatures = makeCreatures(), world, renderer, paused = true, ready = false, fatal = false, last = 0, hudTime = 0, saveTime = 0, renderTime = 0, seen = null, toastTime = 0, frames = 0, fps = 60;
const input = {}, coarse = matchMedia('(pointer:coarse)').matches;
let lookPointer = null, movePointer = null, moveOrigin = null, lastLook = null, touchForward = 0, touchStrafe = 0;

function toast(text) { $('toast').textContent = text; $('toast').classList.add('visible'); toastTime = 4; }
function fail(message) {
  if (fatal) return; fatal = true; paused = true; document.body.classList.remove('playing');
  $('loading').hidden = false; $('status').textContent = message; $('loading-title').textContent = 'Unable to enter the world'; $('load-progress').hidden = true;
  $('menu').hidden = true; $('retry').hidden = false; audio.update(false, false, true);
}
function setPause(value) {
  if (!ready || fatal) return;
  paused = value; document.body.classList.toggle('playing', !value); $('menu').hidden = !value; $('hud').inert = value;
  if (value) {
    $('toast').classList.remove('visible');
    clearInput(); if (document.pointerLockElement) document.exitPointerLock();
    $('enter').textContent = game.elapsed > 0 ? 'Resume expedition' : 'Begin expedition';
    if (!game.dead && !game.won) saveGame(game);
    $('enter').focus();
  } else {
    audio.start();
    if (!coarse && document.pointerLockElement !== canvas) {
      try { const request = canvas.requestPointerLock(); request?.catch(() => toast('Drag across the world to look around.')); } catch { toast('Drag across the world to look around.'); }
    }
  }
  last = performance.now(); audio.update(game.player.y < 0, ground(game.player.x, game.player.z) < 5, paused);
}
function clearInput() { for (const k of Object.keys(input)) input[k] = 0; touchForward = touchStrafe = 0; movePointer = lookPointer = null; moveOrigin = lastLook = null; $('stick-knob').style.transform = ''; }
function restart() {
  game = newGame(); creatures.splice(0, creatures.length, ...makeCreatures());
  // Keep the renderer's instance object references while resetting creature state.
  if (renderer) renderer.resetCreatures(creatures);
  try { localStorage.removeItem(SAVE_KEY); } catch {}
  $('outcome').hidden = true; $('guide').hidden = true; $('enter').disabled = false; updateJournal(); drawMap(); updateHUD(); setPause(false); toast('A new expedition begins. Your first supplies are nearby.');
}

function keyAction(code) {
  if (code === 'Escape') { if (!$('guide').hidden) { $('guide').hidden = true; return; } setPause(!paused); return; }
  if (code === 'KeyJ' && ready && !game.dead && !game.won) { const open = $('guide').hidden; setPause(true); $('guide').hidden = !open; $('guide-close').focus(); return; }
  if (code === 'KeyV') { const muted = audio.toggle(); $('sound').textContent = muted ? 'Sound off' : 'Sound on'; return; }
  if (paused || game.dead || game.won) return;
  if (code === 'KeyE') toast(interact(game));
  if (code === 'KeyR') toast(eat(game));
  if (code === 'KeyM') { $('map-wrap').hidden = !$('map-wrap').hidden; }
  if (code === 'KeyF') {
    const animal = inspect(game, creatures);
    if (!animal) toast('Face a nearby animal and try again. Enter the water to observe marine life.');
    else {
      const fresh = !game.discovered.includes(animal.species);
      if (fresh) game.discovered.push(animal.species);
      toast(`${SPECIES[animal.species].name} ${fresh ? 'added to your field journal' : 'already recorded'}.`);
      updateJournal(); saveGame(game);
    }
  }
}
const keys = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'backward', ArrowDown: 'backward', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'jump', ControlLeft: 'dive', ControlRight: 'dive', KeyC: 'dive' };
addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
  if (keys[e.code] && !paused) { input[keys[e.code]] = 1; e.preventDefault(); }
  if (!e.repeat) keyAction(e.code);
});
addEventListener('keyup', e => { if (keys[e.code]) input[keys[e.code]] = 0; });
addEventListener('blur', () => { if (ready && !paused) setPause(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && ready && !paused) setPause(true); });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && ready && !paused && !coarse) setPause(true); });
document.addEventListener('mousemove', e => {
  if (paused || document.pointerLockElement !== canvas) return;
  game.player.yaw += e.movementX * .0023; game.player.pitch = Math.max(-1.45, Math.min(1.45, game.player.pitch - e.movementY * .0023));
});
canvas.addEventListener('pointerdown', e => {
  if (paused) return;
  lookPointer = e.pointerId; lastLook = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (paused || e.pointerId !== lookPointer || document.pointerLockElement === canvas) return;
  game.player.yaw += (e.clientX - lastLook[0]) * .004; game.player.pitch = Math.max(-1.45, Math.min(1.45, game.player.pitch - (e.clientY - lastLook[1]) * .004)); lastLook = [e.clientX, e.clientY];
});
canvas.addEventListener('pointerup', () => { lookPointer = null; });
canvas.addEventListener('pointercancel', clearInput);
$('stick').addEventListener('pointerdown', e => { movePointer = e.pointerId; moveOrigin = [e.clientX, e.clientY]; $('stick').setPointerCapture(e.pointerId); });
$('stick').addEventListener('pointermove', e => {
  if (e.pointerId !== movePointer) return;
  const x = e.clientX - moveOrigin[0], y = e.clientY - moveOrigin[1], l = Math.max(38, Math.hypot(x, y));
  touchStrafe = x / l; touchForward = -y / l; $('stick-knob').style.transform = `translate(${x / l * 33}px,${y / l * 33}px)`;
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) $('stick').addEventListener(event, () => { movePointer = null; touchForward = touchStrafe = 0; input.forward = input.backward = input.left = input.right = 0; $('stick-knob').style.transform = ''; });
for (const [id, action] of [['touch-jump', 'jump'], ['touch-dive', 'dive'], ['touch-run', 'sprint']]) {
  $(id).addEventListener('pointerdown', e => { input[action] = 1; $(id).setPointerCapture(e.pointerId); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) $(id).addEventListener(event, () => { input[action] = 0; });
}
for (const [id, code] of [['touch-use', 'KeyE'], ['touch-eat', 'KeyR'], ['touch-observe', 'KeyF']]) $(id).onclick = () => keyAction(code);
$('enter').onclick = () => setPause(false); $('pause').onclick = () => setPause(true); $('new-game').onclick = restart;
$('retry').onclick = () => location.reload(); $('restart').onclick = restart;
$('journal').onclick = () => keyAction('KeyJ'); $('guide-close').onclick = () => { $('guide').hidden = true; $('enter').focus(); };
$('sound').onclick = () => { audio.start(); keyAction('KeyV'); };
addEventListener('pagehide', () => { if (ready && !game.dead && !game.won) saveGame(game); });

function updateJournal() {
  $('journal-count').textContent = `${game.discovered.length} / 3`;
  $('journal-entries').replaceChildren(...SPECIES.map((s, i) => {
    const article = document.createElement('article'), discovered = game.discovered.includes(i);
    article.className = discovered ? 'record observed' : 'record';
    const label = document.createElement('span'); label.className = 'eyebrow'; label.textContent = discovered ? 'Observed' : 'Not yet observed';
    const heading = document.createElement('h3'); heading.textContent = s.name;
    const type = document.createElement('p'); type.className = 'record-type'; type.textContent = s.kind;
    const text = document.createElement('p'); text.textContent = s.detail;
    article.append(label, heading, type, text); return article;
  }));
}

let mapBase;
function prepareMap() {
  mapBase = document.createElement('canvas'); mapBase.width = mapBase.height = 180; const ctx = mapBase.getContext('2d'), image = ctx.createImageData(180, 180);
  for (let y = 0; y < 180; y++) for (let x = 0; x < 180; x++) {
    const h = ground((x / 180 - .5) * 470, (y / 180 - .5) * 470), c = h < 0 ? [20, 57 + h * .55, 63 + h * .5] : h < 4 ? [134, 126, 88] : [40 + h * .6, 66 + h * .6, 46 + h * .4], i = (x + y * 180) * 4;
    image.data.set([...c, 255], i);
  }
  ctx.putImageData(image, 0, 0);
}
function drawMap() {
  if (!mapBase) return;
  const ctx = $('map').getContext('2d'), m = v => (v / 470 + .5) * 180, p = game.player;
  ctx.drawImage(mapBase, 0, 0); ctx.strokeStyle = '#ffffff14'; ctx.lineWidth = 1;
  for (let i = 30; i < 180; i += 30) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 180); ctx.moveTo(0, i); ctx.lineTo(180, i); ctx.stroke(); }
  for (const [point, color] of [[SPRING, '#9bd9db'], [CACHE, '#e6c784']]) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(m(point.x), m(point.z), 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.save(); ctx.translate(m(p.x), m(p.z)); ctx.rotate(p.yaw); ctx.fillStyle = '#faf5df'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-4, 4); ctx.lineTo(0, 2); ctx.lineTo(4, 4); ctx.closePath(); ctx.fill(); ctx.restore();
}
function updateHUD() {
  for (const key of ['health', 'stamina', 'hunger', 'thirst', 'oxygen']) {
    const value = Math.ceil(game[key]); $(`${key}-value`).textContent = value; $(`${key}-bar`).style.width = `${value}%`; $(`${key}-stat`).classList.toggle('low', value < 25);
  }
  $('oxygen-stat').hidden = game.player.y >= 0 && game.oxygen >= 100;
  const degrees = ((game.player.yaw * 180 / Math.PI) % 360 + 360) % 360;
  $('heading').textContent = `${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8]}  ${Math.round(degrees)}°`;
  const hour = ((game.clock / DAY_SECONDS * 24 + 6) % 24), minutes = Math.floor((hour % 1) * 60);
  $('clock').textContent = `${String(Math.floor(hour)).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  $('daylight-label').textContent = hour > 6 && hour < 18 ? 'Daylight' : 'Nightfall';
  const h = ground(game.player.x, game.player.z), wet = game.player.y < 0;
  $('biome').textContent = wet ? 'Jurassic shallows' : h < 5 ? 'Eastern shoreline' : h > 30 ? 'Conifer highlands' : 'Fern lowlands';
  $('mode').textContent = wet ? `${Math.round(-game.player.y)} m below the surface` : h < -1 ? 'Swimming' : 'On land';
  $('ration-count').textContent = game.rations;
  $('survived').textContent = `${Math.floor(game.elapsed / 60)}m ${String(Math.floor(game.elapsed % 60)).padStart(2, '0')}s`;
  $('day-progress').style.width = `${Math.min(100, game.elapsed / DAY_SECONDS * 100)}%`;
  const tasks = [game.supplied, game.drank, game.discovered.length === 3, game.elapsed >= DAY_SECONDS];
  tasks.forEach((done, i) => { $(`task-${i}`).classList.toggle('done', done); $(`task-${i}`).querySelector('span').textContent = done ? '✓' : '○'; });
  $('species-progress').textContent = `${game.discovered.length}/3`;
  const nearSpring = Math.hypot(game.player.x - SPRING.x, game.player.z - SPRING.z) < 6, nearCache = Math.hypot(game.player.x - CACHE.x, game.player.z - CACHE.z) < 4;
  $('interaction').hidden = !nearSpring && !nearCache;
  $('interaction-text').textContent = nearSpring ? 'Drink from the freshwater spring' : 'Search the shoreline supply cache';
  seen = inspect(game, creatures); $('animal').hidden = !seen;
  if (seen) { const s = SPECIES[seen.species]; $('animal-name').textContent = s.name; $('animal-state').textContent = `${s.kind} · ${seen.state.toLowerCase()} · F to observe`; }
  const threat = creatures.find(c => (c.state === 'Approaching' || c.state === 'Attacking') && Math.hypot(c.x - game.player.x, c.z - game.player.z) < 26);
  $('warning').hidden = !threat;
  if (threat) $('warning').textContent = threat.species === 1 ? 'ALLOSAURUS NEARBY · Keep your distance or reach the water' : 'MARINE REPTILE NEARBY · Give it space';
  $('fps').textContent = `${Math.round(fps)} fps`; drawMap();
}

function endGame() {
  paused = true; clearInput(); if (document.pointerLockElement) document.exitPointerLock();
  $('menu').hidden = true; $('guide').hidden = true; $('outcome').hidden = false; $('hud').inert = true; document.body.classList.remove('playing');
  $('outcome-title').textContent = game.dead ? 'The coast endured.' : 'You belong to the coast.';
  $('outcome-text').textContent = game.dead ? `Your expedition lasted ${Math.floor(game.elapsed / 60)}m ${Math.floor(game.elapsed % 60)}s. Start again, keep supplies close, and give predators space.` : 'You survived a full day, found fresh water and supplies, and recorded all three Jurassic animals. Your first expedition is complete.';
  audio.update(false, false, true); try { localStorage.removeItem(SAVE_KEY); } catch {}
  $('restart').focus();
}
function frame(now) {
  if (fatal) return;
  requestAnimationFrame(frame);
  const rawDt = Math.max(0, (now - last) / 1000); last = now; const dt = Math.min(.1, rawDt);
  if (!paused) {
    if (movePointer !== null) { input.forward = Math.max(0, touchForward); input.backward = Math.max(0, -touchForward); input.right = Math.max(0, touchStrafe); input.left = Math.max(0, -touchStrafe); }
    const steps = Math.max(1, Math.ceil(dt / .016));
    for (let i = 0; i < steps; i++) { movePlayer(game, input, dt / steps, world.colliders); updateCreatures(game, creatures, dt / steps, world.colliders); updateSurvival(game, dt / steps); if (game.dead || game.won) break; }
    toastTime -= dt; if (toastTime <= 0) $('toast').classList.remove('visible');
    saveTime += dt; if (saveTime > 10) { saveGame(game); saveTime = 0; }
    if (game.dead || game.won) endGame();
  }
  hudTime += rawDt; renderTime += rawDt; frames++;
  if (hudTime > .15) { fps += ((1 / Math.max(.001, rawDt)) - fps) * .1; updateHUD(); hudTime = 0; }
  // Cap at 60 fps, and 10 fps while paused; avoid running the GPU at the display's maximum refresh rate.
  if (renderTime >= (paused ? .1 : 1 / 60) - .001) {
    const day = .10 + .90 * Math.max(0, Math.sin(game.clock / DAY_SECONDS * Math.PI * 2 + .23));
    renderer.render(game.player, game.clock, day, game.damage, renderTime); renderTime = 0;
    audio.update(game.player.y < 0, ground(game.player.x, game.player.z) < 5, paused);
  }
}

async function boot() {
  try {
    $('status').textContent = 'Raising the coastline…'; await new Promise(resolve => requestAnimationFrame(resolve));
    world = makeWorld(); $('load-progress').value = .65;
    $('status').textContent = 'Bringing the Jurassic to life…';
    renderer = await makeRenderer(canvas, world, creatures, fail);
    // Reset by copying into the existing GPU instance objects, not by replacing their references.
    const animalRefs = [...creatures]; renderer.resetCreatures = next => animalRefs.forEach((o, i) => { Object.assign(o, next[i]); creatures[i] = o; });
    prepareMap(); updateJournal(); updateHUD(); $('loading').hidden = true; $('menu').hidden = false;
    $('enter').textContent = game.elapsed > 0 ? 'Resume expedition' : 'Begin expedition'; $('enter').disabled = false; ready = true; last = performance.now(); requestAnimationFrame(frame);
    $('hud').inert = true;
    if (__DEV__) Object.defineProperty(window, 'jurassicDev', { value: {
      snapshot: () => ({ player: { ...game.player }, health: game.health, hunger: game.hunger, thirst: game.thirst, oxygen: game.oxygen, stamina: game.stamina, rations: game.rations, elapsed: game.elapsed, discovered: [...game.discovered], paused, dead: game.dead, won: game.won, creatures: creatures.map(c => ({ species: c.species, x: c.x, z: c.z, y: c.y, state: c.state })) }),
      world: () => ({ objects: world.objects.length, colliders: world.colliders.length, meshes: Object.keys(world.meshes) })
    } });
    if (__DEV__) {
      const panel = document.createElement('aside'); panel.id = 'dev-tools'; panel.hidden = true;
      panel.style.cssText = 'position:fixed;top:75px;left:50%;transform:translateX(-50%);z-index:30;display:flex;gap:4px;background:#102019;padding:8px';
      const poses = [
        ['Coast', 56, 32, -.9, -.06, null], ['Grove', 27, 4, -.3, -.1, null],
        ['Spring', 29, 14, -.8, -.35, null], ['Predator', -23, -15, -.5, -.05, null],
        ['Dive', 130, 34, .3, 0, -4], ['Surface', 130, 34, -1.5, 0, .65]
      ];
      for (const [name, x, z, yaw, pitch, y] of poses) {
        const b = document.createElement('button'); b.textContent = name; b.onclick = () => {
          Object.assign(game.player, { x, z, y: y ?? ground(x, z) + 1.7, yaw, pitch, vy: 0 });
          game.oxygen = 100; game.health = 100; game.hunger = 70; game.thirst = 70; updateHUD();
        }; panel.append(b);
      }
      document.body.append(panel);
      addEventListener('keydown', e => { if (e.code === 'Backquote') panel.hidden = !panel.hidden; });
    }
  } catch (error) { console.error(error); fail(error.message); }
}
boot();
