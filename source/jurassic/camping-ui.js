import { ITEMS, CAPACITY, RECIPES, canAfford, craft, equip, beginPlacement, campAction, eatMeal } from './camping.js';

export function makeCampingUI({ game, world, pause, resume, notify, save }) {
  const style = document.createElement('style'); style.textContent = `
    #kit{background:#0b1713;overflow:auto;justify-content:flex-start;align-items:stretch;padding:5vh max(24px,calc((100vw - 980px)/2))}#kit h2{font:2.3rem Georgia,serif;margin:.7rem 0}#kit header{display:flex;justify-content:space-between;align-items:center;gap:1rem}#kit header button{flex-shrink:0}.kit-note{color:var(--muted);line-height:1.6;font-size:.9rem}.kit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;margin:1rem 0}.kit-card{padding:1.1rem;border:1px solid var(--line);background:#192a2166}.kit-card h3{font:1.5rem Georgia,serif;margin:.2rem 0 .7rem}.kit-card p{font-size:.85rem;color:var(--muted);line-height:1.5}.kit-card button{margin:.2rem .4rem .2rem 0}.kit-stock{display:flex;flex-wrap:wrap;gap:.6rem;margin:1rem 0}.kit-stock span{padding:.5rem .7rem;border:1px solid var(--line);font-size:.8rem}.store-row{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;align-items:center;gap:.4rem;border-bottom:1px solid var(--line);padding:.6rem 0;font-size:.8rem}.store-row button{font-size:.75rem;padding:.5rem}#kit-message{min-height:1.5em;color:var(--gold);line-height:1.5}#camp-status{position:absolute;bottom:66px;left:50%;transform:translateX(-50%);font-size:.75rem;background:#102019c9;padding:.35rem .7rem;white-space:nowrap}#placement-controls{position:absolute;bottom:140px;left:50%;transform:translateX(-50%);width:min(700px,90vw);padding:.8rem;background:var(--panel);border:1px solid var(--line);text-align:center;pointer-events:auto}#placement-controls button{font-size:.8rem;padding:.5rem;margin:.2rem}#placement-note{font-size:.8rem;line-height:1.5;margin-bottom:.5rem}#camp-check{pointer-events:auto;font-size:.75rem;margin-top:.7rem}#camp-check ul{list-style:none;padding-left:0;line-height:1.8;color:var(--muted)}.camp-open{padding:.5rem}.kit-tools{display:flex;flex-wrap:wrap;gap:.4rem}#kit select{background:#14271d;color:var(--ink);border:1px solid var(--line);padding:.5rem} @media(max-width:650px){.kit-grid{grid-template-columns:1fr}.store-row{grid-template-columns:1fr 1fr;gap:.6rem}#camp-status{bottom:190px;font-size:.7rem}#placement-controls{bottom:250px}#camp-check{max-width:190px;font-size:.68rem}.camp-open{font-size:.7rem;padding:.4rem}.top-actions{flex-wrap:wrap;justify-content:flex-end}.topbar>.brand{max-width:100px}#quickbar{gap:.6rem}}`;
  document.head.append(style);
  const kit = document.createElement('section'); kit.id = 'kit'; kit.className = 'overlay'; kit.hidden = true; kit.setAttribute('aria-label', 'Inventory, crafting, and campsite');
  kit.innerHTML = '<header><div><span class="eyebrow">Field equipment</span><h2 id="kit-title">Inventory & crafting</h2></div><button id="kit-close">Return to world</button></header><p id="kit-message" role="status" aria-live="polite"></p><div id="kit-content"></div>';
  document.body.append(kit); const content = kit.querySelector('#kit-content'), message = kit.querySelector('#kit-message');
  let screen = 'inventory', quantity = '1';
  const button = (text, click, disabled = false, label) => { const b = document.createElement('button'); b.textContent = text; b.disabled = disabled; if (label) b.setAttribute('aria-label', label); b.onclick = click; return b; };
  const note = text => { const p = document.createElement('p'); p.className = 'kit-note'; p.textContent = text; return p; };
  const count = key => key === 'rations' ? game().rations : game().inventory[key];
  const apply = out => { message.textContent = out.message; notify(out.message); if (out.ok) save(); if (out.resume) close(true); else draw(); };
  function close(play = true) { kit.hidden = true; if (play) resume(); }
  function open(type = 'inventory') { const g = game(); if (g.dead || g.won) return; screen = type; pause(); document.getElementById('menu').hidden = true; document.getElementById('guide').hidden = true; document.getElementById('atlas').hidden = true; kit.hidden = false; kit.scrollTop = 0; message.textContent = ''; draw(); kit.querySelector('#kit-close').focus(); }
  kit.querySelector('#kit-close').onclick = () => close(true);
  function draw() {
    const g = game(); content.replaceChildren(); kit.querySelector('#kit-title').textContent = screen === 'inventory' ? 'Inventory & crafting' : screen === 'build' ? 'Build your campsite' : RECIPES[screen]?.name || 'Campsite';
    const stock = document.createElement('div'); stock.className = 'kit-stock'; for (const [key, label] of Object.entries(ITEMS)) { const s = document.createElement('span'); s.textContent = `${label}: ${count(key)}${key === 'rations' ? '' : ' / ' + CAPACITY[key]}`; stock.append(s); } content.append(stock);
    if (screen === 'inventory') {
      const tools = document.createElement('div'); tools.className = 'kit-tools'; for (const type of ['hands', 'hatchet', 'spear']) tools.append(button((g.equipped === type ? '✓ ' : '') + (type === 'hands' ? 'Hands' : RECIPES[type].name), () => apply(equip(g, type)), type !== 'hands' && !g.tools[type], 'Equip ' + type));
      tools.append(button('Eat cooked meal (+55 food)', () => apply(eatMeal(g)), !g.inventory.meals || g.hunger > 95)); content.append(tools);
    }
    if (screen === 'inventory' || screen === 'build') {
      content.append(note(screen === 'build' ? 'One tent, fire, and chest. Tent first; other structures within 12 m. Choose dry, flat ground away from routes, wildlife clearings and supplies.' : 'E collects loose bundles. Equip a hatchet (2) and use Q on larger wood bundles. Equip a spear (3) and Q to interrupt nearby land predators; it cannot kill them.'));
      const grid = document.createElement('div'); grid.className = 'kit-grid';
      for (const type of screen === 'build' ? ['tent', 'fire', 'chest'] : ['hatchet', 'spear']) {
        const def = RECIPES[type], card = document.createElement('article'); card.className = 'kit-card'; const h = document.createElement('h3'); h.textContent = def.name;
        const cost = Object.entries(def.cost).map(([key, n]) => `${n} ${ITEMS[key].toLowerCase()}`).join(' + '); card.append(h, note(cost));
        const owned = screen === 'build' ? !!g.camp[type] : g.tools[type]; card.append(button(owned ? 'Already built / owned' : (screen === 'build' ? 'Place ' : 'Craft ') + def.name.toLowerCase(), () => { const out = screen === 'build' ? beginPlacement(g, type) : craft(g, type); if (out.ok && screen === 'build') { notify(out.message); close(true); } else apply(out); }, owned || !canAfford(g, type) || !!g.player.climb || screen === 'build' && type !== 'tent' && !g.camp.tent)); grid.append(card);
      }
      content.append(grid, note('Menus pause the expedition. Building placement, climbing, resting and cooking happen in the live world.'));
    } else if (screen === 'tent') {
      content.append(note('Rest restores stamina at twice the normal idle rate and saves progress. Hunger, thirst, predators and time continue. Move or press E to stop; a tent is not a respawn point.'), button(g.resting ? 'Stop resting' : 'Rest and save', () => apply(campAction(g, world(), 'tent', 'rest'))));
    } else if (screen === 'fire') {
      const fire = g.camp.fire; if (!fire) { close(true); return; }
      content.append(note(`Fuel: ${Math.ceil(fire.fuel)} s · ${fire.burning ? 'Lit' : 'Unlit'} · ${fire.ready ? 'Meal ready' : fire.cooking ? 'Cooking: ' + Math.ceil(fire.cooking) + ' s remaining' : 'Cooking slot empty'}`));
      const actions = [['Add one wood (+60 s)', 'fuel'], ['Light fire', 'light'], ['Extinguish fire', 'extinguish'], ['Cook one provision', 'cook'], ['Collect cooked meal', 'collect'], ['Reclaim whole unused wood', 'reclaim'], ['Clear remaining fuel (no refund)', 'discardFuel']];
      for (const [label, action] of actions) content.append(button(label, () => apply(campAction(g, world(), 'fire', action))));
      content.append(note('A meal takes 10 simulation seconds with a lit, fueled fire. Only one meal can cook or await collection. Fire never repels wildlife. Clear fuel explicitly only when you want to abandon the remaining burn time.'));
    } else if (screen === 'chest') {
      const chest = g.camp.chest; if (!chest) { close(true); return; }
      const total = Object.values(chest.storage).reduce((a, n) => a + n, 0); content.append(note(`Chest: ${total} / 100 units. Empty it before packing.`));
      const label = document.createElement('label'); label.textContent = 'Transfer amount '; const select = document.createElement('select'); select.setAttribute('aria-label', 'Transfer amount'); for (const value of ['1', '5', 'all']) { const o = document.createElement('option'); o.value = value; o.textContent = value; select.append(o); } select.value = quantity; select.onchange = () => { quantity = select.value; }; label.append(select); content.append(label);
      for (const [key, name] of Object.entries(ITEMS)) { const row = document.createElement('div'); row.className = 'store-row'; row.append(note(name), note(`Carry ${count(key)} · Store ${chest.storage[key] || 0}`)); for (const action of ['deposit', 'withdraw']) row.append(button(action === 'deposit' ? 'Deposit' : 'Withdraw', () => { const amount = quantity === 'all' ? action === 'deposit' ? count(key) : chest.storage[key] || 0 : Number(quantity); apply(campAction(g, world(), 'chest', action, key, amount)); }, false, `${action === 'deposit' ? 'Deposit' : 'Withdraw'} ${key}`)); content.append(row); }
    }
    if (['tent', 'fire', 'chest'].includes(screen)) content.append(button('Pack ' + RECIPES[screen].name.toLowerCase(), () => { const out = campAction(g, world(), screen, 'pack'); if (out.ok) { save(); notify(out.message); close(true); } else apply(out); }));
  }
  const actions = document.querySelector('.top-actions'); actions.append(button('Bag · I', () => open('inventory'), false, 'Inventory and crafting'), button('Build · B', () => open('build'), false, 'Build campsite'));
  for (const b of [...actions.children].slice(-2)) b.classList.add('camp-open');
  const mobile = document.getElementById('mobile-actions'); mobile.append(button('Bag', () => open('inventory')), button('Build', () => open('build')));
  mobile.append(button('Tool · Q', () => document.dispatchEvent(new CustomEvent('camp-command', { detail: 'KeyQ' }))));
  const status = document.createElement('div'); status.id = 'camp-status'; document.getElementById('hud').append(status);
  const checklist = document.createElement('details'); checklist.id = 'camp-check'; checklist.innerHTML = '<summary>Optional campsite</summary><ul></ul>'; document.querySelector('.expedition').append(checklist);
  const placement = document.createElement('div'); placement.id = 'placement-controls'; placement.hidden = true; placement.innerHTML = '<div id="placement-note"></div>'; document.getElementById('hud').append(placement);
  function placementButton(label, code) { placement.append(button(label, () => document.dispatchEvent(new CustomEvent('camp-command', { detail: code })))); }
  for (const [label, code] of [['Rotate · T', 'KeyT'], ['Nearer · Z', 'KeyZ'], ['Farther · X', 'KeyX'], ['Place · E', 'KeyE'], ['Cancel', 'Escape']]) placementButton(label, code);
  return { open, close, get isOpen() { return !kit.hidden; }, update(text) {
    const g = game(); status.textContent = g.player.climb ? `Climbing ${g.player.climb.height.toFixed(1)} / 6 m · W/S · E descend` : g.resting ? 'Resting · movement or E stops rest' : `${g.equipped === 'hands' ? 'Hands' : RECIPES[g.equipped].name} · 1/2/3 equip · Q use · I bag · B build`;
    const names = { gathered: 'Gather materials', crafted: 'Craft a tool', built: 'Build a campsite', cooked: 'Cook a meal', climbed: 'Reach a tree perch' }; checklist.querySelector('summary').textContent = `Optional campsite · ${Object.values(g.campTasks).filter(Boolean).length}/5`; checklist.querySelector('ul').replaceChildren(...Object.entries(names).map(([key, name]) => { const li = document.createElement('li'); li.textContent = `${g.campTasks[key] ? '✓' : '○'} ${name}`; return li; }));
    placement.hidden = !g.placement; placement.querySelector('#placement-note').textContent = text || ''; if (!kit.hidden && screen === 'fire') { const f = g.camp.fire; if (f) message.textContent ||= 'Close this menu to advance fire and cooking time.'; }
  } };
}
