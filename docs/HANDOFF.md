# Jurassic Coast handoff

Living wildlife milestone: six illustrated animal journal entries, distance-driven walking and terrain contacts, and expanded herbivore/predator behavior. The default `index.html` is the game; `abyssal.html` preserves the original underwater demo.

Run `npm ci`, `npm test`, `npm run build`, and `npm start` from `source/`. The local preview is http://127.0.0.1:4173. Build `dev.html` with `npm run build:dev`; backtick opens its development viewpoints. Test fixtures are excluded from release builds.

Implementation is in `source/jurassic/`. The source math helpers and original MIT license are retained. `THIRD_PARTY.md` records provenance and species references.

The two imported CC0 animals use embedded texture maps; the other four use offline-baked authored sculpt meshes. Rendering includes dynamic sun shadows, surface normals, roughness and procedural deformation. Edit `sculpt.js` then run `npm run assets:sculpt` before rebuilding. Imported GLB conversion instructions, provenance and hashes are in `THIRD_PARTY.md` and `source/assets/manifest.json`.

Existing three-animal saves retain those observations; all six are now required to finish. Known limits: procedural animation rather than full skeleton rigs, basic AI, bounded terrain, desktop-focused validation, no crafting/shelter/weapons/multiplayer, and player saves without persistent creature locations. Next playtest: an uninterrupted full day, checking giant-animal movement and survival balance across all six encounters.

Behavior lives in `source/jurassic/wildlife.js`: state selection, perception/last-seen memory, herd spacing, drinking, local obstacle steering, gait timing and bounded foot-height corrections. Contact profiles must match the model's leg order. Instance data now includes a continuous gait phase, head pose and four contact offsets. The Stegosaurus mesh was realigned to face its direction of travel and imported leg weights were narrowed to avoid moving tail spikes with the feet.

After changing meshes, run `npm run assets:portraits`, then build. This creates embedded 640×400 JPEGs from the actual model geometry and color maps. Journal cards retain full images before discovery and accessible species descriptions. Starting a new expedition preserves renderer instance references while resetting wildlife state.

Next playtest focus: alert/stalk/chase transitions, interrupted bites at the shoreline, herd reunions and migration to the spring. Local steering has no global navigation mesh; tight obstacles may still stall an animal. Contact correction reduces sliding and penetration but cannot provide perfect planted feet or joint articulation on every slope.
