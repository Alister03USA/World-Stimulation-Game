# World Stimulation Game — Jurassic Coast

A first-person survival prototype in a fictional Jurassic world about 1.2 kilometres across. Explore the original coast, a river valley, fern wetlands, conifer uplands and an offshore lagoon. Walk among Stegosaurus, Brachiosaurus and Diplodocus, avoid Allosaurus and Ceratosaurus, and dive with Cryptoclidus. Find fresh water and supplies, record all six species, and survive one full day.

Built on [Abyssal Garden](https://github.com/Noniv/abyssal-garden) by Maksymilian Dendura. The original MIT license and attribution are preserved. The original underwater experience is still available in [abyssal.html](abyssal.html), with its [original README](README-abyssal.md).

## Play

Open `index.html` in a current Chrome or Edge with WebGPU and hardware acceleration enabled. The generated HTML embeds all code, geometry, textures, interface, and synthesized audio; no assets or runtime libraries are downloaded. A local HTTP server is recommended for development.

```sh
cd source
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:4173**. Choose **Begin expedition**. If pointer lock is unavailable, drag across the world to look around.

## First expedition

- Search the gold supply marker on the map. It is close to the starting position.
- Follow blue markers to freshwater springs and press **E** to drink. Four springs support longer expeditions; open the world map with **M**. Sea water and uncollected river water do not restore thirst.
- Face each animal and press **F** to record it in the journal. Dive to observe marine life.
- Use **R** to eat a ration. Each of the four gold provision caches replenishes two rations every five in-game minutes, with its own saved cooldown.
- Keep your distance from Allosaurus and Ceratosaurus on land and Cryptoclidus in water. Sprint to escape; land predators will not pursue you into the sea.
- Survive a full day, lasting **12 minutes of simulation time**, with all six animals observed and water and supplies collected.

Health recovers slowly when you are fed, hydrated, and out of danger. Sprinting consumes stamina. Staying underwater consumes oxygen; surface to recover. Starvation, dehydration, drowning, and predators can end an expedition. The result screen lets you restart.

## Controls

| Action | Control |
| --- | --- |
| Move | WASD or arrow keys |
| Look | Mouse, or drag if capture is unavailable |
| Sprint | Shift |
| Jump / swim up | Space |
| Dive | C or Ctrl |
| Search supplies / drink | E near the resource |
| Eat a ration | R |
| Observe an animal | F while facing it within 65 metres |
| Field journal | J |
| Open / close world map | M |
| Switch small map between nearby and overview | N |
| Pause / resume | Esc |
| Mute | V |

On a touchscreen, use the left virtual stick to move, drag the world to look, and use the action buttons. Physical phone/tablet performance and touch behavior have not yet been validated; desktop is the current reference experience.

## Saves

Progress saves locally every ten simulation seconds and when pausing or leaving. Reload and choose **Resume expedition** to continue. Position, survival stats, rations, time, and observations persist. Creature positions reset on reload. Saves stay on the current browser and origin; there is no account or cloud sync. If storage is blocked, the game still runs but cannot retain progress. Starting a fresh expedition replaces the save. Development builds use a separate save slot.

Earlier save data remains compatible. The original starting coast retains its terrain heights, and loaded players are raised to the ground if an extended part of the landscape is now higher. Movement velocity resets on loading. Higher upland positions and provision cooldowns at the added caches also persist.

## Scope and accuracy

This is a playable foundation with a bounded region. The visual upgrade adds detailed CC0 Stegosaurus and Brachiosaurus models with color, normal, and roughness maps; continuous sculpted meshes for the other four animals; procedural limb, neck, tail, and breathing motion; dynamic sun shadows; and revised skin and water lighting. These are artistic reconstructions with procedural deformation, not fully rigged motion-captured animals or a photorealism claim. Crafting, shelters, combat weapons, multiplayer, and large streamed worlds are not implemented.

The five dinosaurs are Late Jurassic animals; Cryptoclidus is a Jurassic marine reptile. Araucarian conifers, ginkgo relatives, cycads, tree ferns, ground ferns, and horsetails represent plant lineages present in the Jurassic, rather than exact fossil species. The fictional region brings organisms together from different places and times. Colors and behavior are artistic approximations. Modern supply crates represent provisions left for the fictional visitor. See [species references and attribution](THIRD_PARTY.md).

Older saves retain their first three observations; discovering the added animals is required to complete the expanded six-animal objective.

## Wildlife and field portraits

Every animal journal card includes a full-body portrait rendered offline from its actual game mesh and textures. All six images are embedded, visible before observation, and keep the existing discovery status. Regenerate them with `npm run assets:portraits` after changing animal assets.

Animals accelerate and brake gradually, slow down during turns, and steer around nearby obstacles. Walking phase follows distance traveled, with longer stance periods, lifted swing steps, slope-aligned bodies, and bounded lower-limb contact corrections. Browsing and drinking lower the head; marine animals bank during turns and paddle with their travel rhythm. These remain procedural mesh deformations rather than complete skeletal rigs or inverse kinematics.

The movement pass adds brief stance-foot anchors that compensate for small turns, smoothed gait strength during braking, and short escape targets when an animal stalls. Herd membership is regional, so distant animals do not try to follow a leader across the entire map. Rock and trunk collisions use vertical bounds, including submerged lagoon pinnacles.

Player movement now accelerates and stops smoothly, slows uphill, slides along obstacles, and allows a short jump grace period at ledges. Swimming uses separate enter/exit thresholds to reduce shoreline switching. Holding jump does not repeatedly trigger land jumps; release and press again.

Herbivores forage, browse, rest, follow separated herd members, make room for the player, flee nearby predators, and seek the freshwater spring when thirsty. Hunters use a forward field of view, close-range awareness and approximate terrain/trunk occlusion. They watch, stalk, chase, track the last seen position, search, then resume patrols. Bites have a short windup and cooldown; reaching water interrupts land-predator pursuit. Warning text shows the encounter state. These are gameplay approximations, not claims about fossil behavior.

## Beyond the coast

The world contains 33 animals across the six species, with regional herds and marine groups. Press **M** or click **Map** to pause and view all springs, provisions and landmarks. The small map follows the player; **N** switches it to the full overview. The journal describes the four landmarks:

- **A — River Gate:** a natural stone arch beside the western river valley and a shallow crossing.
- **B — Needle Ridge:** a rock spire in the northwest conifer uplands.
- **C — Fern Basin:** southern wetlands with tree ferns, horsetails and a nearby spring.
- **D — Lagoon Teeth:** submerged and exposed rock pinnacles in the southeast lagoon.

The terrain uses shared two-metre height samples in 400 individually culled tiles. A spatial index limits collision searches to nearby objects. The world is bounded and loaded at startup; this is not an infinite streaming world. Dense vegetation and the larger landscape need real-device performance testing.

## Source

| File | Purpose |
| --- | --- |
| `source/jurassic/world.js` | Coastline, species catalog, flora catalog, habitats and creature placement |
| `source/jurassic/geography.js` | World bounds, regions, springs, provisions and landmarks |
| `source/jurassic/terrain.js` | Original coast, connected terrain, shared heights and terrain tiles |
| `source/jurassic/movement.js` | Player acceleration, slopes, jumping, collision and swimming |
| `source/jurassic/spatial.js` | Nearby collision queries and vertical collision bounds |
| `source/jurassic/plants.js` | Branches, fan leaves, fronds, cycads and segmented horsetails |
| `source/jurassic/sculpt.js` | Authored continuous animal geometry, baked offline |
| `source/jurassic/assets.js` | Embedded mesh and texture loading |
| `source/assets/` | Optimized models, texture maps, source hashes and provenance manifest |
| `source/tools/` | Repeatable model conversion and sculpt baking tools |
| `source/jurassic/simulation.js` | Walking/swimming physics, creature behavior, survival, interaction, save validation |
| `source/jurassic/wildlife.js` | Perception, herd behavior, steering, acceleration, gait and ground contacts |
| `source/jurassic/portraits.js` | The six embedded field-journal images |
| `source/jurassic/renderer.js` | WebGPU instancing, visibility/distance culling, resize and quality scaling |
| `source/jurassic/shaders.js` | Land/water lighting, sky, fog, caustics, creature animation |
| `source/jurassic/main.js` | Game loop, inputs, menus, journal, map, objectives |
| `source/jurassic/audio.js` | Synthesized land/sea ambience |
| `source/jurassic/template.html` | Full-screen game interface and controls |
| `source/src/math.js` | Original Abyssal Garden mesh and noise helpers, adapted at build time without changing the file |
| `source/build-jurassic.mjs` | Builds the self-contained Jurassic HTML |

```sh
cd source
npm test              # simulation and geometry regression checks
npm run build         # release index.html
npm run build:dev     # readable dev.html with development-only viewpoints
npm run build:abyssal # rebuild the original demo as abyssal.html
npm run assets:sculpt # rebake the four authored animals after editing sculpt.js
npm run assets:import -- /path/to/glbs # reconvert the two original licensed source GLBs
npm run assets:portraits # rerender all six journal portraits from the baked meshes
```

In `dev.html`, press the backtick key to show the development viewpoints. They exist only in that build. These fixtures help inspect the coast, dinosaur clearing, spring, predator, underwater habitat, and surface without a long walk. They reset some stats and must not be used to assess survival balance.

WebGPU is required; unsupported devices get an on-screen startup message. The renderer reports shader compilation and device-loss errors on screen, caps rendering at 60 fps, and reduces resolution on slower devices. These measures do not guarantee 60 fps on every device. See [validation and limitations](docs/VALIDATION.md).

## License

[MIT](LICENSE) code and authored geometry; the two imported Grab3D model/texture sets are CC0. Preserve the original copyright and license when redistributing. The Jurassic HTML embeds the original MIT text for its reused code. See [THIRD_PARTY.md](THIRD_PARTY.md) for provenance and source links.
