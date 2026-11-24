# World Stimulation Game — Jurassic Coast

A first-person survival prototype set on a fictional Jurassic coastline. Walk through conifer forests and fern clearings, follow Stegosaurus, avoid an Allosaurus, and dive with Cryptoclidus. Find fresh water and supplies, record all three animals, and survive one full day.

Built on [Abyssal Garden](https://github.com/Noniv/abyssal-garden) by Maksymilian Dendura. The original MIT license and attribution are preserved. The original underwater experience is still available in [abyssal.html](abyssal.html), with its [original README](README-abyssal.md).

## Play

Open `index.html` in a current Chrome or Edge with WebGPU and hardware acceleration enabled. The generated HTML contains all the code, shaders, geometry generators, interface, and synthesized audio; no assets or runtime libraries are downloaded. A local HTTP server is recommended for development.

```sh
cd source
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:4173**. Choose **Begin expedition**. If pointer lock is unavailable, drag across the world to look around.

## First expedition

- Search the gold supply marker on the map. It is close to the starting position.
- Follow the blue marker to the freshwater spring and press **E** to drink. Sea water does not restore thirst.
- Face each animal and press **F** to record it in the journal. Dive to observe marine life.
- Use **R** to eat a ration. The supply cache replenishes two rations every five in-game minutes.
- Keep your distance from the Allosaurus on land and Cryptoclidus in water. Sprint to escape; land predators will not pursue you into the sea.
- Survive a full day, lasting **12 minutes of simulation time**, with all three animals observed and water and supplies collected.

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
| Toggle map | M |
| Pause / resume | Esc |
| Mute | V |

On a touchscreen, use the left virtual stick to move, drag the world to look, and use the action buttons. Physical phone/tablet performance and touch behavior have not yet been validated; desktop is the current reference experience.

## Saves

Progress saves locally every ten simulation seconds and when pausing or leaving. Reload and choose **Resume expedition** to continue. Position, survival stats, rations, time, and observations persist. Creature positions reset on reload. Saves stay on the current browser and origin; there is no account or cloud sync. If storage is blocked, the game still runs but cannot retain progress. Starting a fresh expedition replaces the save. Development builds use a separate save slot.

## Scope and accuracy

This is the first playable foundation, with stylized procedural models and a bounded region. It includes walking, jumping, swimming, tree/rock collision, basic wildlife behavior, survival stats, a day/night cycle, a map, a journal, local saves, and restart/win states. Crafting, shelters, combat weapons, multiplayer, and large streamed worlds are not implemented.

Allosaurus and Stegosaurus are Jurassic dinosaurs; Cryptoclidus is a Jurassic marine reptile. The fictional region brings species together from different Jurassic places and times. It is not a reconstruction of one fossil ecosystem. Colors, vegetation, and behavior are artistic approximations. Modern supply crates represent provisions left for the fictional visitor. See [species references and attribution](THIRD_PARTY.md).

## Source

| File | Purpose |
| --- | --- |
| `source/jurassic/world.js` | Coastline height field, forest and seabed dressing, creature meshes |
| `source/jurassic/simulation.js` | Walking/swimming physics, creature behavior, survival, interaction, save validation |
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
```

In `dev.html`, press the backtick key to show the development viewpoints. They exist only in that build. These fixtures help inspect the coast, dinosaur clearing, spring, predator, underwater habitat, and surface without a long walk. They reset some stats and must not be used to assess survival balance.

WebGPU is required; unsupported devices get an on-screen startup message. The renderer reports shader compilation and device-loss errors on screen, caps rendering at 60 fps, and reduces resolution on slower devices. These measures do not guarantee 60 fps on every device. See [validation and limitations](docs/VALIDATION.md).

## License

[MIT](LICENSE). Preserve the original copyright and license when redistributing. The Jurassic HTML embeds the original MIT text for its reused code. See [THIRD_PARTY.md](THIRD_PARTY.md) for provenance.
