# Jurassic Coast handoff

Expanded world milestone: a bounded world about 1.2 km across, five principal regions, 33 animals, four springs, four provision caches, four landmarks, and nearby/overview maps. Player acceleration, shoreline transitions, stance-foot compensation and obstacle recovery improve movement. The default `index.html` is the game; `abyssal.html` preserves the original underwater demo.

Run `npm ci`, `npm test`, `npm run build`, and `npm start` from `source/`. The local preview is http://127.0.0.1:4173. Build `dev.html` with `npm run build:dev`; backtick opens its development viewpoints. Test fixtures are excluded from release builds.

Implementation is in `source/jurassic/`. The source math helpers and original MIT license are retained. `THIRD_PARTY.md` records provenance and species references.

The two imported CC0 animals use embedded texture maps; the other four use offline-baked authored sculpt meshes. Rendering includes dynamic sun shadows, surface normals, roughness and procedural deformation. Edit `appearance.js` and the helpers in `sculpt.js` then run `npm run assets:sculpt` before rebuilding. Imported GLB conversion instructions, provenance and hashes are in `THIRD_PARTY.md` and `source/assets/manifest.json`.

Existing three-animal saves retain those observations; all six are now required to finish. Known limits: procedural animation rather than full skeleton rigs, basic AI, bounded terrain, desktop-focused validation, no crafting/shelter/weapons/multiplayer, and player saves without persistent creature locations. Next playtest: an uninterrupted full day, checking giant-animal movement and survival balance across all six encounters.

Behavior lives in `source/jurassic/wildlife.js`: state selection, perception/last-seen memory, herd spacing, drinking, local obstacle steering, gait timing and bounded foot-height corrections. Contact profiles must match the model's leg order. Instance data now includes a continuous gait phase, head pose and four contact offsets. The Stegosaurus mesh was realigned to face its direction of travel and imported leg weights were narrowed to avoid moving tail spikes with the feet.

After changing meshes, run `npm run assets:portraits`, then build. This creates embedded 640×400 JPEGs from the actual model geometry and color maps. Journal cards retain full images before discovery and accessible species descriptions. Starting a new expedition preserves renderer instance references while resetting wildlife state.

Next playtest focus: alert/stalk/chase transitions, interrupted bites at the shoreline, herd reunions and migration to the spring. Local steering has no global navigation mesh; tight obstacles may still stall an animal. Contact correction reduces sliding and penetration but cannot provide perfect planted feet or joint articulation on every slope.

Terrain and resource definitions are split into `geography.js` and `terrain.js`. The original coast stays unchanged around the starting habitats, while new mainland connects to the west and extends north/south. Terrain has 400 tiles with shared two-metre samples; the renderer culls tiles separately. `spatial.js` indexes colliders and their vertical bounds. `movement.js` owns smooth player velocity, slope handling, jump buffering/grace, sliding collision and swimming hysteresis.

Wildlife now has regional herd IDs, nearest-spring selection, stance contact anchors and local escape targets. Renderer instance data has 36 floats: matrix, animal parameters, motion, four contact heights, and four X/Z contact corrections. All 16 default vertex attribute slots are used. Restart must reset anchors, gait strength and recovery fields while preserving instance object references.

M opens the paused world map; N toggles nearby/overview on the small map. Added development viewpoints reach River Gate, wetlands, uplands, the lagoon and Riverbend spring. These remain excluded from release. Save version/key remain compatible; extra cache cooldowns are validated independently and movement velocity resets on load. Older western-edge saves can be lifted onto newly connected terrain without changing their X/Z position.

Recommended handoff playtest: follow the river route from the coast, cross the shallow ford, collect Riverbend water and provisions, climb to Needle Ridge, then visit the wetlands and lagoon. Check travel time against the 12-minute expedition objective. No global pathfinding, perfect skeletal foot IK, uninterrupted full-world expedition, or minimum-fps guarantee is claimed.

Appearance handoff: the four authored animal models now use profiled skulls, attached facial details, claws and distinct coloration with embedded CC0 skin variation. Vertex UV.x=-99 marks eyes/teeth/keratin to exclude skin projection. Joint 16 is the lower jaw and inherits head joint 15 motion; joints 6–9 are the four marine flippers. Scene and shadow share deformation. Keep the 64-byte vertex and 144-byte instance formats unchanged. `prepare-skin.mjs` records the original image checksum; run sculpt bake, portrait rendering and both builds after geometry edits. Animation remains procedural, with approximate limb deformation rather than articulated skeletons. Next focused playtest: close predator encounters and underwater flipper strokes from several angles.
