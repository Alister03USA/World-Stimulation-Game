# Validation — expanded Jurassic Coast

## Automated checks

`npm run build`, `npm run build:dev`, and `npm test` run from `source/`.

All 15 regression tests pass. They cover walking and jumping; crossing the shore, diving, and surfacing; oxygen depletion/recovery; freshwater and food; supply cooldowns; predator damage and cooldowns; land predators abandoning an underwater player; directional animal observation and the air/water boundary; death and full-day objective gating; save round-tripping, corruption, and blocked storage; finite indexed world geometry; and exclusion of development fixtures from release with embedded MIT attribution. Expansion checks cover all six animals and plant meshes, packed UV/deformation data, Ceratosaurus attacks, preservation of old observations with six-animal completion gating, and the sun shadow projection.

## Browser checks

The game was opened through the local HTTP preview in the Codex in-app Chromium browser. Its WebGPU shaders compiled, and the coastal forest, dinosaur clearing, and underwater habitat rendered. Stegosaurus and Cryptoclidus observations appeared in the journal. Drinking at the spring restored thirst and completed the water objective; eating consumed a ration and restored hunger. The Allosaurus encounter displayed a warning and reduced health. Opening the journal paused the expedition; reloading restored progress. The pointer-lock fallback was exercised because capture was unavailable in this browser.

Development-only viewpoint buttons were used to reach the separate habitats efficiently. This is a functional smoke check, not an uninterrupted full-day playthrough or a performance benchmark.

For the visual expansion, Chromium WebGPU compiled the revised textured/shadow shaders and rendered the detailed Stegosaurus and Brachiosaurus, sculpted Diplodocus and Ceratosaurus, and expanded plant geometry. Observations of Brachiosaurus, Diplodocus, Ceratosaurus and Cryptoclidus were recorded through gameplay controls. The Ceratosaurus warning used its own name and an approach reduced health. The journal displayed all six animals and six plant groups. These checks used the browser's narrow 512-pixel viewport; they do not establish physical mobile-device support.

## Limits

- No sustained GPU-timestamp benchmark or minimum-fps claim has been established for this prototype. The browser automation environment throttles frame delivery between interactions, so the on-screen readings are not representative device benchmarks.
- No physical phone, tablet, Safari, Firefox, gamepad, or VR validation has been performed. Touch controls are implemented but require real-device testing.
- Win/death conditions are covered by simulation tests. An uninterrupted 12-minute, no-fixtures survival run remains a follow-up playtest.
- Two animals use detailed imported models; four use authored sculpted meshes. Movement remains procedural rather than a complete skeletal animation system. AI uses basic wandering, avoidance, fleeing, approach, and attack states; it is not a complete ecosystem or navigation system. Large animals can intersect uneven terrain or vegetation.
- Creature positions reset on reload. Player progress persists locally when browser storage is available.
- The coast is bounded. Crafting, shelters, weapons, multiplayer, and streamed terrain remain outside this milestone.
