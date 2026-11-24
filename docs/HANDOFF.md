# Jurassic Coast handoff

First playable milestone: strict Jurassic species selection with relaxed survival in a fictional coastal habitat. The default `index.html` is the new game; `abyssal.html` preserves the original underwater demo.

Run `npm ci`, `npm test`, `npm run build`, and `npm start` from `source/`. The local preview is http://127.0.0.1:4173. Build `dev.html` with `npm run build:dev`; backtick opens its development viewpoints. Test fixtures are excluded from release builds.

Implementation is in `source/jurassic/`. The source math helpers and original MIT license are retained. `THIRD_PARTY.md` records provenance and species references.

Known limits: prototype animal animation and AI, bounded terrain, desktop-focused validation, no crafting/shelter/weapons/multiplayer, and player saves without persistent creature locations. Choose the next milestone after playing the first expedition.
