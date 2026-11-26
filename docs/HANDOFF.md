# Jurassic Coast handoff

Expanded world milestone: a bounded world about 1.2 km across, five principal regions, 32 animals, four springs, four provision caches, four landmarks, and nearby/overview maps. Player acceleration, shoreline transitions, stance-foot compensation and obstacle recovery improve movement. The default `index.html` is the game; `abyssal.html` preserves the original underwater demo.

Run `npm ci`, `npm test`, `npm run build`, and `npm start` from `source/`. The local preview is http://127.0.0.1:4173. Build `dev.html` with `npm run build:dev`; backtick opens its development viewpoints. Test fixtures are excluded from release builds.

Implementation is in `source/jurassic/`. The source math helpers and original MIT license are retained. `THIRD_PARTY.md` records provenance and species references.

The two imported CC0 animals use embedded texture maps; the other four use offline-baked authored sculpt meshes. Rendering includes dynamic sun shadows, surface normals, roughness and procedural deformation. Edit `appearance.js` and the helpers in `sculpt.js` then run `npm run assets:sculpt` before rebuilding. Imported GLB conversion instructions, provenance and hashes are in `THIRD_PARTY.md` and `source/assets/manifest.json`.

Existing three-animal saves retain those observations; all six are now required to finish. Known limits: procedural animation rather than full skeleton rigs, basic AI, bounded terrain, desktop-focused validation, no hunting, tree felling or multiplayer, and player saves without persistent creature locations. Next playtest: an uninterrupted full day, checking giant-animal movement and survival balance across all six encounters.

Behavior lives in `source/jurassic/wildlife.js`: state selection, perception/last-seen memory, herd spacing, drinking, local obstacle steering, gait timing and bounded foot-height corrections. Contact profiles must match the model's leg order. Instance data now includes a continuous gait phase, head pose and four contact offsets. The Stegosaurus mesh was realigned to face its direction of travel and imported leg weights were narrowed to avoid moving tail spikes with the feet.

After changing meshes, run `npm run assets:portraits`, then build. This creates embedded 640×400 JPEGs from the actual model geometry and color maps. Journal cards retain full images before discovery and accessible species descriptions. Starting a new expedition preserves renderer instance references while resetting wildlife state.

Next playtest focus: alert/stalk/chase transitions, interrupted bites at the shoreline, herd reunions and migration to the spring. Local steering has no global navigation mesh; tight obstacles may still stall an animal. Contact correction reduces sliding and penetration but cannot provide perfect planted feet or joint articulation on every slope.

Terrain and resource definitions are split into `geography.js` and `terrain.js`. The original coast stays unchanged around the starting habitats, while new mainland connects to the west and extends north/south. Terrain has 400 tiles with shared two-metre samples; the renderer culls tiles separately. `spatial.js` indexes colliders and their vertical bounds. `movement.js` owns smooth player velocity, slope handling, jump buffering/grace, sliding collision and swimming hysteresis.

Wildlife now has regional herd IDs, nearest-spring selection, stance contact anchors and local escape targets. Renderer instance data has 36 floats: matrix, animal parameters, motion, four contact heights, and four X/Z contact corrections. All 16 default vertex attribute slots are used. Restart must reset anchors, gait strength and recovery fields while preserving instance object references.

M opens the paused world map; N toggles nearby/overview on the small map. Added development viewpoints reach River Gate, wetlands, uplands, the lagoon and Riverbend spring. These remain excluded from release. Save version/key remain compatible; extra cache cooldowns are validated independently and movement velocity resets on load. Older western-edge saves can be lifted onto newly connected terrain without changing their X/Z position.

Recommended handoff playtest: follow the river route from the coast, cross the shallow ford, collect Riverbend water and provisions, climb to Needle Ridge, then visit the wetlands and lagoon. Check travel time against the 12-minute expedition objective. No global pathfinding, perfect skeletal foot IK, uninterrupted full-world expedition, or minimum-fps guarantee is claimed.

Appearance handoff: the four authored animal models now use profiled skulls, attached facial details, claws and distinct coloration with embedded CC0 skin variation. Vertex UV.x=-99 marks eyes/teeth/keratin to exclude skin projection. Joint 16 is the lower jaw and inherits head joint 15 motion; joints 6–9 are the four marine flippers. Scene and shadow share deformation. Keep the 64-byte vertex and 144-byte instance formats unchanged. `prepare-skin.mjs` records the original image checksum; run sculpt bake, portrait rendering and both builds after geometry edits. Animation remains procedural, with approximate limb deformation rather than articulated skeletons. Next focused playtest: close predator encounters and underwater flipper strokes from several angles.

Forest handoff: `habitat.js` shares grove, moisture and slope fields between planting and terrain colors; `landscape.js` builds deterministic ground dressing and low deadwood colliders. `plants.js` owns fuller crowns, leaf UVs/anchored flutter, curled young fern fronds and near-detail fern meshes. Surface tags 40–45 select terrain, stone, bark, litter, log bark and cut wood shading; 30 remains living foliage. Conifer instance feet store four local ground samples for root alignment, while creature foot channels retain their existing meaning. Scene and shadow use the same deformation.

Fine fern instances select their detailed mesh within 22 m and coarse mesh beyond it; litter/pebbles have a 38 m centre distance plus mesh radius. Tiny dressing does not cast shadows; small-plant shadows are limited to 45 m plus radius. Two development-only viewpoints inspect the forest floor and canopy, and their panel can now hide correctly. Existing geometry/saves/objectives remain compatible. Rebuild both HTML versions after changes; no animal rebake or journal portrait rerender is needed for this forest pass. Follow `FOREST_REFERENCES.md` for the focused walking playtest; a complete survival/performance playtest remains outstanding.

## Gathering and campsite handoff

The optional survival loop now includes finite hand-gathered resources, hatchet timber harvesting, defensive spear interruptions, tent/fire/chest placement, conserved storage, fueled cooking, live rest and bounded tree climbing. I opens inventory/crafting, B selects buildings, 1/2/3 equip hands/hatchet/spear, Q uses tools and E targets the object under the crosshair. T and Z/X adjust previews. See CAMPING.md for costs, limits and packing rules.

All 57 checks pass, retaining the original 42. Browser QA exercised gathering through crafting, harvesting, construction, transfers, cooking/eating, rest, climbing/descent and reload using development travel fixtures and normal resource transactions. Final standalone WebGPU startup reported no warning/error logs. Screenshots accompany the standalone HTML and source archive. The jurassic-coast draft PR remains unmerged.

Save version 2 retains the original key for migration. Keep gameplay time separate from wall time. Reserve dynamic instances before renderer initialization; sync toggles their active state and resource visibility. Rebuild a fresh combined collision array after construction/packing. Shared target resolution must gate both prompts and actions. Development fixtures are absent from release; development pointer lock is disabled to make fixture interactions predictable.

Next playtest: an uninterrupted expedition with close predator encounters, campsite balance and long travel. A sustained GPU benchmark and physical mobile-device validation remain separate. AI uses local steering, and construction/animal collision shapes are approximations.
## Weather handoff

Weather now follows expedition elapsed time through clear, cloudy, shower, mist and clearing phases with smooth transitions. No save schema change is needed. weather.js owns the schedule, tent exposure and 76-float uniform packing; shaders.js owns cloud/light/fog, damp surfaces, wind and a 640-streak rain pool. Audio adds pooled rain/wind layers. Release excludes the four development weather fixtures. All 61 tests pass; final Chromium WebGPU startup and rain reload were checked. See WEATHER.md for exact coverage and limits.
