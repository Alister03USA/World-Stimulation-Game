/*! World Stimulation Game. Based on Abyssal Garden by Maksymilian Dendura (MIT). */
import { makeWorld, makeCreatures, ground, SPECIES, FLORA, WATER_SOURCES, CACHES, LANDMARKS, MAP_SPAN, regionAt, DAY_SECONDS } from './world.js';
import { newGame, movePlayer, updateCreatures, updateSurvival, eat, inspect, saveGame, loadGame, SAVE_KEY } from './simulation.js';
import { makeRenderer } from './renderer.js';
import { makeAudio } from './audio.js';
import { portraits } from './portraits.js';
import { resolveTarget, useTarget, useTool, equip, stepAdventure, placementSite, placementCheck, placeStructure, rebuildCampColliders } from './camping.js';
import { syncAdventure } from './adventure-world.js';
import { makeCampingUI } from './camping-ui.js';
import { weatherAt, rainExposure } from './weather.js';

const $ = id => document.getElementById(id), canvas = $('world'), audio = makeAudio();
let game = newGame(), creatures = makeCreatures(), world, renderer, paused = true, ready = false, fatal = false, last = 0, hudTime = 0, saveTime = 0, renderTime = 0, seen = null, toastTime = 0, frames = 0, fps = 60;
const input = {}, coarse = matchMedia('(pointer:coarse)').matches;
let lookPointer = null, movePointer = null, moveOrigin = null, lastLook = null, touchForward = 0, touchStrafe = 0;
const campUI = makeCampingUI({ game: () => game, world: () => world, pause: () => setPause(true), resume: () => setPause(false), notify: toast, save: () => saveGame(game) });
function action(out) { if (out.message) toast(out.message); if (out.ok) { saveGame(game); syncAdventure(game, world); } if (out.panel) campUI.open(out.panel); updateHUD(); }

function toast(text) { $('toast').textContent = text; $('toast').classList.add('visible'); toastTime = 4; }
function fail(message) {
  if (fatal) return; fatal = true; paused = true; document.body.classList.remove('playing');
  $('loading').hidden = false; $('status').textContent = message; $('loading-title').textContent = 'Unable to enter the world'; $('load-progress').hidden = true;
  $('menu').hidden = true; $('retry').hidden = false; audio.update(false, false, true);
}
function setPause(value) {
  if (!ready || fatal) return;
  paused = value; document.body.classList.toggle('playing', !value); $('menu').hidden = !value; $('hud').inert = value;
  if (!value) { $('atlas').hidden = true; $('guide').hidden = true; campUI.close(false); }
  if (value) {
    $('toast').classList.remove('visible');
    clearInput(); if (document.pointerLockElement) document.exitPointerLock();
    $('enter').textContent = game.elapsed > 0 ? 'Resume expedition' : 'Begin expedition';
    if (!game.dead && !game.won) saveGame(game);
    $('enter').focus();
  } else {
    audio.start();
    if (!__DEV__ && !coarse && document.pointerLockElement !== canvas) {
      try { const request = canvas.requestPointerLock(); request?.catch(() => toast('Drag across the world to look around.')); } catch { toast('Drag across the world to look around.'); }
    }
  }
  last = performance.now(); audio.update(game.player.y < 0, ground(game.player.x, game.player.z) < 5, paused);
}
function clearInput() { for (const k of Object.keys(input)) input[k] = 0; game.player.vx = game.player.vz = 0; touchForward = touchStrafe = 0; movePointer = lookPointer = null; moveOrigin = lastLook = null; $('stick-knob').style.transform = ''; }
function restart() {
  game = newGame();
  campUI.close(false); rebuildCampColliders(game, world); syncAdventure(game, world);
  // Preserve the objects held by the renderer's instance groups when starting again.
  makeCreatures().forEach((fresh, i) => Object.assign(creatures[i], fresh));
  try { localStorage.removeItem(SAVE_KEY); } catch {}
  $('outcome').hidden = true; $('guide').hidden = true; $('atlas').hidden = true; $('enter').disabled = false; updateJournal(); drawMap(); updateHUD(); setPause(false); toast('A new expedition begins. Your first supplies are nearby.');
}

function keyAction(code) {
  if (code === 'Escape' && game.placement) { game.placement = null; toast('Building placement cancelled.'); return; }
  if (code === 'Escape' && campUI.isOpen) { campUI.close(true); return; }
  if (['KeyI', 'KeyB'].includes(code) && ready && !game.dead && !game.won) { if (campUI.isOpen) campUI.close(true); else campUI.open(code === 'KeyI' ? 'inventory' : 'build'); return; }
  if (code === 'Escape') { if (!$('atlas').hidden) { $('atlas').hidden = true; return; } if (!$('guide').hidden) { $('guide').hidden = true; return; } setPause(!paused); return; }
  if (code === 'KeyJ' && ready && !game.dead && !game.won) { campUI.close(false); const open = $('guide').hidden; setPause(true); $('guide').hidden = !open; $('guide-close').focus(); return; }
  if (code === 'KeyM' && ready && !game.dead && !game.won) { campUI.close(false); const open = $('atlas').hidden; setPause(true); $('atlas').hidden = !open; drawMap(); if (open) $('map-close').focus(); return; }
  if (code === 'KeyN') { mapNearby = !mapNearby; drawMap(); return; }
  if (code === 'KeyV') { const muted = audio.toggle(); $('sound').textContent = muted ? 'Sound off' : 'Sound on'; return; }
  if (paused || game.dead || game.won) return;
  if (game.placement && ['KeyT', 'KeyZ', 'KeyX'].includes(code)) { if (code === 'KeyT') game.placement.yaw += Math.PI / 12; else game.placement.distance = Math.max(2, Math.min(8, game.placement.distance + (code === 'KeyX' ? .5 : -.5))); return; }
  if (code === 'KeyE') action(game.placement ? placeStructure(game, world) : useTarget(game, world));
  if (code === 'KeyQ') action(useTool(game, world, creatures));
  if (['Digit1', 'Digit2', 'Digit3'].includes(code)) action(equip(game, ['hands', 'hatchet', 'spear'][Number(code.slice(-1)) - 1]));
  if (code === 'KeyR') toast(eat(game));
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
document.addEventListener('camp-command', e => keyAction(e.detail));
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
$('map-open').onclick = () => keyAction('KeyM'); $('map-close').onclick = () => { $('atlas').hidden = true; $('enter').focus(); }; $('map-scale').onclick = () => keyAction('KeyN');
$('sound').onclick = () => { audio.start(); keyAction('KeyV'); };
addEventListener('pagehide', () => { if (ready && !game.dead && !game.won) saveGame(game); });

function updateJournal() {
  $('journal-count').textContent = `${game.discovered.length} / ${SPECIES.length}`;
  $('journal-entries').replaceChildren(...SPECIES.map((s, i) => {
    const article = document.createElement('article'), discovered = game.discovered.includes(i);
    article.className = discovered ? 'record observed' : 'record';
    const image = document.createElement('img'); image.src = portraits[i]; image.alt = `${s.name} — full-body view of the game model`; image.className = 'animal-portrait'; image.width = 640; image.height = 400; image.loading = 'lazy'; image.decoding = 'async';
    const label = document.createElement('span'); label.className = 'eyebrow'; label.textContent = discovered ? 'Observed' : 'Not yet observed';
    const heading = document.createElement('h3'); heading.textContent = s.name;
    const type = document.createElement('p'); type.className = 'record-type'; type.textContent = s.kind;
    const text = document.createElement('p'); text.textContent = s.detail;
    article.append(image, label, heading, type, text); return article;
  }));
  $('world-entries').replaceChildren(...LANDMARKS.map(place => {
    const card = document.createElement('article'), title = document.createElement('h3'), text = document.createElement('p');
    card.className = 'record flora-record'; title.textContent = place.id + ' · ' + place.name; text.textContent = place.detail; card.append(title, text); return card;
  }));
  $('flora-entries').replaceChildren(...FLORA.map(plant => {
    const article = document.createElement('article'), title = document.createElement('h3'), text = document.createElement('p');
    article.className = 'record flora-record'; title.textContent = plant.name; text.textContent = plant.detail; article.append(title, text); return article;
  }));
}

let mapBase, mapNearby = true;
function prepareMap() {
  mapBase = document.createElement('canvas'); mapBase.width = mapBase.height = 512; const ctx = mapBase.getContext('2d'), image = ctx.createImageData(512, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const h = ground((x / 512 - .5) * MAP_SPAN, (y / 512 - .5) * MAP_SPAN), c = h < 0 ? [20, 57 + h * .55, 63 + h * .5] : h < 4 ? [134, 126, 88] : [40 + h * .6, 66 + h * .6, 46 + h * .4];
    image.data.set([...c, 255], (x + y * 512) * 4);
  }
  ctx.putImageData(image, 0, 0);
}
function drawSurvey(canvas, span, cx, cz, labels = false) {
  const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height, mx = v => (v - cx) / span * w + w / 2, mz = v => (v - cz) / span * h + h / 2;
  ctx.fillStyle = '#15383d'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(mapBase, ((cx - span / 2) / MAP_SPAN + .5) * 512, ((cz - span / 2) / MAP_SPAN + .5) * 512, span / MAP_SPAN * 512, span / MAP_SPAN * 512, 0, 0, w, h);
  ctx.strokeStyle = '#ffffff18'; ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(i * w / 6, 0); ctx.lineTo(i * w / 6, h); ctx.moveTo(0, i * h / 6); ctx.lineTo(w, i * h / 6); ctx.stroke(); }
  const dot = (point, color, radius) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(mx(point.x), mz(point.z), radius, 0, Math.PI * 2); ctx.fill(); };
  for (const point of WATER_SOURCES) dot(point, '#9bd9db', labels ? 5 : 3);
  for (const point of CACHES) { ctx.fillStyle = '#e6c784'; ctx.fillRect(mx(point.x) - 2, mz(point.z) - 2, labels ? 6 : 4, labels ? 6 : 4); }
  ctx.font = labels ? 'bold 14px sans-serif' : '10px sans-serif'; ctx.textAlign = 'center';
  for (const point of LANDMARKS) {
    dot(point, '#d9c7a5', labels ? 4 : 2); ctx.fillStyle = '#fff4db'; ctx.fillText(labels ? point.id + ' · ' + point.name : point.id, mx(point.x), mz(point.z) - (labels ? 12 : 6));
  }
  if (labels) { ctx.fillStyle = '#b6d9da'; ctx.font = '12px sans-serif'; for (const point of WATER_SOURCES) ctx.fillText(point.name, mx(point.x), mz(point.z) + 21); }
  const p = game.player; ctx.save(); ctx.translate(mx(p.x), mz(p.z)); ctx.rotate(p.yaw); ctx.fillStyle = '#faf5df'; ctx.strokeStyle = '#17271e'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(-5, 5); ctx.lineTo(0, 2); ctx.lineTo(5, 5); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
}
function drawMap() {
  if (!mapBase) return;
  drawSurvey($('map'), mapNearby ? 320 : MAP_SPAN, mapNearby ? game.player.x : 0, mapNearby ? game.player.z : 0);
  $('map-scale').textContent = mapNearby ? 'Nearby · N' : 'Overview · N';
  if (!$('atlas').hidden) drawSurvey($('atlas-map'), MAP_SPAN, 0, 0, true);
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
  $('weather-label').textContent = weatherAt(game.elapsed).label;
  const h = ground(game.player.x, game.player.z), wet = game.player.y < 0;
  $('biome').textContent = regionAt(game.player.x, game.player.z, h);
  $('mode').textContent = wet ? `${Math.round(-game.player.y)} m below the surface` : game.player.swimming ? 'Swimming' : h < 0 ? 'Wading' : 'On land';
  $('ration-count').textContent = game.rations;
  $('survived').textContent = `${Math.floor(game.elapsed / 60)}m ${String(Math.floor(game.elapsed % 60)).padStart(2, '0')}s`;
  $('day-progress').style.width = `${Math.min(100, game.elapsed / DAY_SECONDS * 100)}%`;
  const tasks = [game.supplied, game.drank, game.discovered.length === SPECIES.length, game.elapsed >= DAY_SECONDS];
  tasks.forEach((done, i) => { $(`task-${i}`).classList.toggle('done', done); $(`task-${i}`).querySelector('span').textContent = done ? '✓' : '○'; });
  $('species-progress').textContent = `${game.discovered.length}/${SPECIES.length}`;
  const target = resolveTarget(game, world), site = placementSite(game), reason = site ? placementCheck(game, world, site) : '';
  $('interaction').hidden = !target || !!game.placement;
  $('interaction-text').textContent = target?.label || '';
  campUI.update(site ? `${reason || 'Valid site · E to build'} · T rotate · Z/X nearer/farther · Esc cancel` : '');
  seen = inspect(game, creatures); $('animal').hidden = !seen;
  if (seen) { const s = SPECIES[seen.species]; $('animal-name').textContent = s.name; $('animal-state').textContent = `${s.kind} · ${seen.state.toLowerCase()} · F to observe`; }
  const threat = creatures.find(c => ['Watching', 'Stalking', 'Chasing', 'Tracking', 'Attacking', 'Recovering'].includes(c.state) && Math.hypot(c.x - game.player.x, c.z - game.player.z) < 34);
  $('warning').hidden = !threat;
  if (threat) $('warning').textContent = `${SPECIES[threat.species].name.toUpperCase()} · ${threat.state.toUpperCase()} · ${SPECIES[threat.species].role === 'hunter' ? 'Keep your distance or reach the water' : 'Give it space'}`;
  $('fps').textContent = `${Math.round(fps)} fps`; drawMap();
}

function endGame() {
  campUI.close(false); game.placement = null; game.resting = false;
  paused = true; clearInput(); if (document.pointerLockElement) document.exitPointerLock();
  $('menu').hidden = true; $('guide').hidden = true; $('outcome').hidden = false; $('hud').inert = true; document.body.classList.remove('playing');
  $('outcome-title').textContent = game.dead ? 'The coast endured.' : 'You belong to the coast.';
  $('outcome-text').textContent = game.dead ? `Your expedition lasted ${Math.floor(game.elapsed / 60)}m ${Math.floor(game.elapsed % 60)}s. Start again, keep supplies close, and give predators space.` : `You survived a full day, found fresh water and supplies, and recorded all ${SPECIES.length} Jurassic animals. Your first expedition is complete.`;
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
    for (let i = 0; i < steps; i++) { if (!stepAdventure(game, input, dt / steps, world)) movePlayer(game, input, dt / steps, world.colliders); updateCreatures(game, creatures, dt / steps, world.colliders); updateSurvival(game, dt / steps); if (game.dead || game.won) break; }
    toastTime -= dt; if (toastTime <= 0) $('toast').classList.remove('visible');
    saveTime += dt; if (saveTime > 10) { saveGame(game); saveTime = 0; }
    if (game.dead || game.won) endGame();
  }
  hudTime += rawDt; renderTime += rawDt; frames++;
  if (hudTime > .15) { fps += ((1 / Math.max(.001, rawDt)) - fps) * .1; updateHUD(); hudTime = 0; }
  // Cap at 60 fps, and 10 fps while paused; avoid running the GPU at the display's maximum refresh rate.
  if (renderTime >= (paused ? .1 : 1 / 60) - .001) {
    const day = .10 + .90 * Math.max(0, Math.sin(game.clock / DAY_SECONDS * Math.PI * 2 + .23));
    const weather = weatherAt(game.elapsed), exposure = rainExposure(game.player, game.camp.tent);
    syncAdventure(game, world); renderer.render(game.player, game.clock, day, game.damage, renderTime, game.dead || game.won ? null : game.camp.fire, weather, exposure); renderTime = 0;
    const fire = game.camp.fire, fireVolume = fire?.burning ? 1 / (1 + Math.hypot(game.player.x - fire.x, game.player.z - fire.z) ** 2 * .1) : 0;
    audio.update(game.player.y < 0, ground(game.player.x, game.player.z) < 5, paused, fireVolume, weather, exposure);
  }
}

async function boot() {
  try {
    $('status').textContent = 'Raising the coastline…'; await new Promise(resolve => requestAnimationFrame(resolve));
    world = makeWorld(); game = loadGame(undefined, world) || newGame(); rebuildCampColliders(game, world); syncAdventure(game, world); $('load-progress').value = .65;
    $('status').textContent = 'Bringing the Jurassic to life…';
    renderer = await makeRenderer(canvas, world, creatures, fail);
    // Reset by copying into the existing GPU instance objects, not by replacing their references.
    const animalRefs = [...creatures]; renderer.resetCreatures = next => animalRefs.forEach((o, i) => { Object.assign(o, next[i]); creatures[i] = o; });
    prepareMap(); updateJournal(); updateHUD(); $('loading').hidden = true; $('menu').hidden = false;
    $('enter').textContent = game.elapsed > 0 ? 'Resume expedition' : 'Begin expedition'; $('enter').disabled = false; ready = true; last = performance.now(); requestAnimationFrame(frame);
    $('hud').inert = true;
    if (__DEV__) Object.defineProperty(window, 'jurassicDev', { value: {
      snapshot: () => ({ player: { ...game.player }, health: game.health, hunger: game.hunger, thirst: game.thirst, oxygen: game.oxygen, stamina: game.stamina, rations: game.rations, inventory: { ...game.inventory }, tools: { ...game.tools }, camp: structuredClone(game.camp), depleted: [...game.depleted], elapsed: game.elapsed, discovered: [...game.discovered], paused, dead: game.dead, won: game.won, creatures: creatures.map(c => ({ species: c.species, x: c.x, z: c.z, y: c.y, state: c.state })) }),
      world: () => ({ objects: world.objects.length, colliders: world.colliders.length, meshes: Object.keys(world.meshes) })
    } });
    if (__DEV__) {
      const panel = document.createElement('aside'); panel.id = 'dev-tools'; panel.hidden = true;
      panel.style.cssText = 'position:fixed;top:75px;left:50%;transform:translateX(-50%);z-index:30;display:none;flex-wrap:wrap;justify-content:center;width:min(1000px,94vw);gap:4px;background:#102019;padding:8px';
      const poses = [
        ['Coast', 56, 32, -.9, -.06, null], ['Stegosaurus', 51, 29, -.55, .025, null],
        ['Brachiosaurus', 26, -10, -.7, .19, null], ['Diplodocus', -35, 48, -.8, .05, null], ['Ceratosaurus', -61, -9, -.65, .04, null],
        ['River Gate', -240, 65, -.7, .08, null], ['Wetlands', -148, 290, -.7, 0, null], ['Uplands', -390, -245, .70, .20, null], ['Lagoon', 320, 215, -.5, -.07, -4], ['River spring', -208, 23, -.5, -.2, null],
        ['Spring', 29, 14, -.8, -.35, null], ['Predator', -23, -15, -.5, -.05, null],
        ['Forest floor', -110, 68, -.8, -.24, null], ['Conifer grove', -118, 81, -.4, .24, null],
        ['Dive', 130, 34, .3, 0, -4], ['Surface', 130, 34, -1.5, 0, .65]
      ];
      for (const [name, x, z, yaw, pitch, y] of poses) {
        const b = document.createElement('button'); b.textContent = name; b.onclick = () => {
          Object.assign(game.player, { x, z, y: y ?? ground(x, z) + 1.7, yaw, pitch, vy: 0, vx: 0, vz: 0, swimming: false });
          game.oxygen = 100; game.health = 100; game.hunger = 70; game.thirst = 70; updateHUD();
        }; panel.append(b);
      }
      document.body.append(panel);
      const viewPoint = (point, offset = 2.6) => { const x = point.x, z = point.z + offset, y = ground(x, z) + 1.7; Object.assign(game.player, { x, z, y, yaw: offset < 0 ? Math.PI : 0, pitch: Math.atan2(point.y - y, Math.abs(offset)), climb: null, swimming: false, grounded: true, vx: 0, vy: 0, vz: 0 }); game.resting = false; updateHUD(); };
      const fixture = (name, run) => { const b = document.createElement('button'); b.textContent = name; b.onclick = run; panel.append(b); };
      for (const [name, time] of [['Clear', 60], ['Cloudy', 155], ['Rain', 255], ['Mist', 425]]) fixture('Weather: ' + name, () => { game.elapsed = time; updateHUD(); });
      for (const item of ['wood', 'stone', 'fiber', 'timber']) fixture('Next ' + item, () => { const n = world.adventure.nodes.filter(n => !game.depleted.includes(n.id) && (item === 'timber' ? n.requires : n.item === item && !n.requires)).sort((a, b) => Math.hypot(a.x - 56, a.z - 32) - Math.hypot(b.x - 56, b.z - 32))[0]; if (n) viewPoint({ ...n, y: n.y + .25 }); });
      fixture('Climb entry', () => viewPoint({ ...world.adventure.climbs[0], y: world.adventure.climbs[0].y + 1.4 }, 1.8));
      fixture('Supply cache', () => viewPoint({ ...CACHES[0], y: ground(CACHES[0].x, CACHES[0].z) + .65 }, 2));
      fixture('Camp site view', () => {
        const type = game.placement?.type || 'tent', origin = game.camp.tent || { x: 54, z: 52 };
        for (let r = 0; r < (type === 'tent' ? 90 : 12); r += 1.5) for (let j = 0; j < 24; j++) {
          const a = j * Math.PI / 12, x = origin.x + Math.sin(a) * r, z = origin.z + Math.cos(a) * r, p = game.player;
          const old = { ...p }; Object.assign(p, { x, z: z + 4, y: ground(x, z + 4) + 1.7, yaw: 0, swimming: false, grounded: true, climb: null });
          const previous = game.placement; game.placement = { type, distance: 4, yaw: 0 }; const site = placementSite(game);
          if (!placementCheck(game, world, site)) { if (!previous) game.placement = null; viewPoint({ x, z, y: site.y + .5 }, 4); return; }
          Object.assign(p, old); game.placement = previous;
        }
        toast('No free campsite found near this fixture.');
      });
      for (const type of ['tent', 'fire', 'chest']) fixture('Face ' + type, () => { const c = game.camp[type]; if (!c) return; const x = c.x - Math.sin(c.yaw) * (type === 'tent' ? 1.9 : 0), z = c.z - Math.cos(c.yaw) * (type === 'tent' ? 1.9 : 0); viewPoint({ x, z, y: c.y + (type === 'tent' ? .9 : .55) }, type === 'tent' ? -2 : 2); });
      fixture('Advance world 12s', () => { if (paused) return; for (let i = 0; i < 750; i++) { if (!stepAdventure(game, {}, .016, world)) movePlayer(game, {}, .016, world.colliders); updateCreatures(game, creatures, .016, world.colliders); updateSurvival(game, .016); if (game.dead || game.won) break; } updateHUD(); });
      addEventListener('keydown', e => { if (e.code === 'Backquote') { panel.hidden = !panel.hidden; panel.style.display = panel.hidden ? 'none' : 'flex'; } });
    }
  } catch (error) { console.error(error); fail(error.message); }
}
boot();
