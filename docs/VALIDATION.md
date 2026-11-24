# Validation — first playable Jurassic Coast

## Automated checks

`npm run build`, `npm run build:dev`, and `npm test` run from `source/`.

The regression suite covers walking and jumping; crossing the shore, diving, and surfacing; oxygen depletion/recovery; freshwater and food; supply cooldowns; predator damage and cooldowns; land predators abandoning an underwater player; directional animal observation and the air/water boundary; death and full-day objective gating; save round-tripping, corruption, and blocked storage; finite indexed world geometry; and exclusion of development fixtures from the release with embedded MIT attribution.

## Browser checks

The game was opened through the local HTTP preview in the Codex in-app Chromium browser. Its WebGPU shaders compiled, and the coastal forest, dinosaur clearing, and underwater habitat rendered. Stegosaurus and Cryptoclidus observations appeared in the journal. Drinking at the spring restored thirst and completed the water objective; eating consumed a ration and restored hunger. The Allosaurus encounter displayed a warning and reduced health. Opening the journal paused the expedition; reloading restored progress. The pointer-lock fallback was exercised because capture was unavailable in this browser.

Development-only viewpoint buttons were used to reach the separate habitats efficiently. This is a functional smoke check, not an uninterrupted full-day playthrough or a performance benchmark.

## Limits

- No sustained GPU-timestamp benchmark or minimum-fps claim has been established for this prototype. The browser automation environment throttles frame delivery between interactions, so the on-screen readings are not representative device benchmarks.
- No physical phone, tablet, Safari, Firefox, gamepad, or VR validation has been performed. Touch controls are implemented but require real-device testing.
- Win/death conditions are covered by simulation tests. An uninterrupted 12-minute, no-fixtures survival run remains a follow-up playtest.
- Animal meshes and animation are stylized. AI uses basic wandering, avoidance, fleeing, approach, and attack states; it is not a complete ecosystem or navigation system.
- Creature positions reset on reload. Player progress persists locally when browser storage is available.
- The coast is bounded. Crafting, shelters, weapons, multiplayer, and streamed terrain remain outside this milestone.
