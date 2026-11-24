# Jurassic Coast handoff

Expanded visual milestone: six Jurassic animals and six plant lineages in a fictional coastal habitat. The default `index.html` is the game; `abyssal.html` preserves the original underwater demo.

Run `npm ci`, `npm test`, `npm run build`, and `npm start` from `source/`. The local preview is http://127.0.0.1:4173. Build `dev.html` with `npm run build:dev`; backtick opens its development viewpoints. Test fixtures are excluded from release builds.

Implementation is in `source/jurassic/`. The source math helpers and original MIT license are retained. `THIRD_PARTY.md` records provenance and species references.

The two imported CC0 animals use embedded texture maps; the other four use offline-baked authored sculpt meshes. Rendering includes dynamic sun shadows, surface normals, roughness and procedural deformation. Edit `sculpt.js` then run `npm run assets:sculpt` before rebuilding. Imported GLB conversion instructions, provenance and hashes are in `THIRD_PARTY.md` and `source/assets/manifest.json`.

Existing three-animal saves retain those observations; all six are now required to finish. Known limits: procedural animation rather than full skeleton rigs, basic AI, bounded terrain, desktop-focused validation, no crafting/shelter/weapons/multiplayer, and player saves without persistent creature locations. Next playtest: an uninterrupted full day, checking giant-animal movement and survival balance across all six encounters.
