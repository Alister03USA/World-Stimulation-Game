# Validation — expanded Jurassic Coast

## Automated checks

`npm run build`, `npm run build:dev`, and `npm test` run from `source/`.

All 42 regression tests pass. They cover walking and jumping; crossing the shore, diving, and surfacing; oxygen depletion/recovery; freshwater and food; supply cooldowns; predator damage and cooldowns; land predators abandoning an underwater player; directional animal observation and the air/water boundary; death and full-day objective gating; save round-tripping, corruption, and blocked storage; finite indexed world geometry; and exclusion of development fixtures from release with embedded MIT attribution. Expansion checks cover all six animals and plant meshes, packed UV/deformation data, Ceratosaurus attacks, preservation of old observations with six-animal completion gating, and the sun shadow projection.

The wildlife milestone adds checks for gradual acceleration and gait continuity, predator field-of-view and obstacle occlusion, last-seen memory/search expiry, attack windup and interruption, herd reunion/fleeing, freshwater seeking and drinking completion, bounded slope/contact data reaching the renderer, obstacle steering over a 25-second encounter, and Stegosaurus forward/head/tail alignment. These are deterministic simulation checks, not measurements of biological accuracy.

## Browser checks

Expanded-world validation adds tests for player acceleration/braking/sprint transitions, sliding collision, swimming hysteresis, preservation of legacy coastal terrain samples, distinct region heights, terrain-tile seams and local coordinates, all regional springs/caches and saved cooldowns, regional herd membership and valid homes, spatial queries across cell boundaries, obstacle-overlap recovery, stance contact anchoring, legacy/high-altitude saves, vertical rock bounds, and marine steering around pinnacles. The final suite passes all 37 tests after the collision and wetland refinements.

The expanded world was checked in Chromium WebGPU using development viewpoints. River Gate, the wetland herd, the upland forest/ridge landmark and underwater lagoon rendered; Stegosaurus observation in the wetlands updated the journal, and Riverbend spring restored water to 100 and completed the water objective. The paused world map displayed the larger coastline, river, four springs, provision markers and landmarks in both development and release builds. No shader/GPU errors appeared in the final browser checks. These are targeted functional/visual checks rather than an uninterrupted journey across the entire world. Browser frame delivery is throttled during automation, so its HUD fps readings are not a device benchmark.

The game was opened through the local HTTP preview in the Codex in-app Chromium browser. Its WebGPU shaders compiled, and the coastal forest, dinosaur clearing, and underwater habitat rendered. Stegosaurus and Cryptoclidus observations appeared in the journal. Drinking at the spring restored thirst and completed the water objective; eating consumed a ration and restored hunger. The Allosaurus encounter displayed a warning and reduced health. Opening the journal paused the expedition; reloading restored progress. The pointer-lock fallback was exercised because capture was unavailable in this browser.

Development-only viewpoint buttons were used to reach the separate habitats efficiently. This is a functional smoke check, not an uninterrupted full-day playthrough or a performance benchmark.

For the visual expansion, Chromium WebGPU compiled the revised textured/shadow shaders and rendered the detailed Stegosaurus and Brachiosaurus, sculpted Diplodocus and Ceratosaurus, and expanded plant geometry. Observations of Brachiosaurus, Diplodocus, Ceratosaurus and Cryptoclidus were recorded through gameplay controls. The Ceratosaurus warning used its own name and an approach reduced health. The journal displayed all six animals and six plant groups. These checks used the browser's narrow 512-pixel viewport; they do not establish physical mobile-device support.

For the wildlife milestone, release and development builds loaded in Chromium without shader/GPU errors. All six journal images decoded at 640×400, with accessible names and preserved discovery states; the existing layouts were observed at the browser's naturally available desktop and narrow widths. A fresh development expedition reset without a renderer-reference error. Development viewpoints showed terrain-aligned animals and the Allosaurus chasing state and its matching encounter warning. Journal rendering was also checked in the release build, where development controls remain absent.

## Limits

- No sustained GPU-timestamp benchmark or minimum-fps claim has been established for this prototype. The browser automation environment throttles frame delivery between interactions, so the on-screen readings are not representative device benchmarks.
- No physical phone, tablet, Safari, Firefox, gamepad, or VR validation has been performed. Touch controls are implemented but require real-device testing.
- Win/death conditions are covered by simulation tests. An uninterrupted 12-minute, no-fixtures survival run remains a follow-up playtest.
- Two animals use detailed imported models; four use authored sculpted meshes. Body alignment, distance-driven gait and lower-limb height corrections remain procedural rather than complete skeletal animation or inverse kinematics. Wildlife uses local steering and finite-state behavior without a global navigation mesh or complete ecosystem. Tight obstacles may stall an animal; feet and large bodies can still slide or intersect uneven terrain and vegetation.
- Creature positions reset on reload. Player progress persists locally when browser storage is available.
- The coast is bounded. Multiplayer and streamed terrain remain outside this milestone; optional camping and defensive tools are now implemented.

## Four-animal appearance update

Both release and development builds succeed; all 39 regression tests pass. Added checks validate every revised mesh attribute/index, material assignment, facial-joint attachment, four distinct flipper joints, and the bundled CC0 skin checksum. The four baked meshes contain 25,772 / 31,612 / 21,952 / 14,248 triangles (Allosaurus / Ceratosaurus / Diplodocus / Cryptoclidus). All six regenerated portrait images decode at 640×400.

The four updated portraits were visually inspected together. Diplodocus tail-tip gaps found in the voxel bake were corrected with a continuous swept taper. Chromium WebGPU compiled the revised material/deformation shaders without reported GPU errors. Targeted development viewpoints showed Ceratosaurus on land and Cryptoclidus swimming underwater; the journal showed all six loaded animal portraits. Release startup and journal rendering were checked separately. These checks do not establish photorealism, exact fossil skin/color accuracy, full skeletal animation, device performance or a complete survival playthrough.

## Forest and landscape detail

Release and development builds succeed; all 42 tests pass. New checks cover finite dressing transforms and ground contact, freshwater/supply clearances, low stump collision bounds, matching coarse/fine fern extents, leaf deformation weights and deterministic shoreline/slope/moisture habitat fields. The existing suite checks finite indexed geometry, terrain seams/height compatibility, movement, collisions, wildlife and save behavior.

Chromium WebGPU inspection found and corrected an initial WGSL syntax error before release. The final material/deformation shaders compiled without new reported GPU errors. Development viewpoints rendered the denser conifer grove, detailed forest floor and wetland forest transition; screenshots were saved from the live game. Visual refinement reduced oversized litter fragments, curled young fern growth and aligned exposed conifer roots with local slopes. The release build loaded and entered gameplay with no development controls. These are targeted visual/functional checks, not a measured GPU benchmark, botanical validation of every modeled feature or uninterrupted full-world expedition.

## Gathering, crafting, campsites and climbing

All 57 automated checks pass, retaining the existing 42. Added coverage includes finite starter yields, shared crosshair targeting and obstruction, hatchet requirements, atomic recipes, invalid placement, bounded campsite colliders, storage conservation and the exact 100-unit limit, packing/refund overflow, cooking/fuel timing, spear interruption/resistance, rest, climbing/exhaustion, unreachable-perch predator behavior, version-one migration, version-two persistence, held-tool alignment and new-expedition cleanup. Invalid actions consume nothing; depletion survives reload; storage blocks packing until empty. Finished expeditions stop cooking advancement.

Chromium WebGPU browser QA exercised the connected loop: hand gather, craft hatchet and spear, harvest fallen timber, place a rotated tent and nearby fire/chest, deposit/withdraw supplies, reject packing a nonempty chest, cook a cache provision, collect/eat a meal, rest, climb to six metres, descend and reload. The chest was emptied, packed for its complete refund, then rebuilt. Reload retained campsite structures, stored supplies and depleted nodes. Reload during cooking retained its remaining fuel/job time without offline advancement; a climbing save resumed at the safe ground entry. Tent rest restored stamina while simulation time continued. A night viewpoint rendered the fire's flame, smoke and warm local illumination with the tent, chest and held spear.

These checks used development-only travel/aim fixtures and a time-advance fixture during targeted QA; materials were collected and recipes/builds paid through normal actions, with no inventory grants. They are not an uninterrupted walking survival run. The interface was inspected at 512-pixel and 1280-pixel browser widths. Final standalone release startup reached its expedition menu without warning/error logs; development fixtures remain excluded. Code-authored assets require no animal or texture rebake.

Remaining separate playtests: sustained performance measurement, physical mobile devices, long-route balance and a complete unassisted expedition. Tool motion, supports, wildlife steering and climbing remain procedural approximations; this does not establish photorealism or universal collision correctness.