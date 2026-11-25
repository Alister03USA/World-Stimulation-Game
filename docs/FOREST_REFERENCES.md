# Jurassic forest appearance

The forest uses Jurassic plant groups already present in the game: conifers, ginkgo relatives, cycads, tree ferns, ground ferns and horsetails. Tall groves and an understory replace the appearance of isolated trees on uniformly green ground. Fossil evidence guides the plant groups; tree shapes, density, colors, grove positions and surface patterns remain artistic reconstructions in the game's fictional habitat.

## References

- [National Park Service: Morrison Formation, Dinosaur National Monument](https://www.nps.gov/dino/learn/nature/morrison-formation.htm) describes fossil evidence for forests/shrubland, rivers and the major plant groups. It also records drought and flooding, so this reference does not imply that every Jurassic environment was a permanently wet jungle.
- [Natural History Museum: How to grow a dinosaur garden](https://www.nhm.ac.uk/discover/how-to-grow-a-dinosaur-garden.html) illustrates ancient plant lineages, conifer wood and living relatives. Modern garden plants are visual analogues, not proof that those exact modern species lived together in the Jurassic.
- [British Geological Survey: Plants through time](https://www.bgs.ac.uk/discovering-geology/fossils-and-geological-time/plants-2/) provides plant-evolution context and fossil examples. The game does not import the giant club-moss and horsetail forests depicted for the much earlier Carboniferous.

## Authored detail

Conifer foliage has broader sprays and a second crown variant. Ginkgo fans have varied size and vein shading. Ferns include curled young fronds and a close-range mesh with finer divisions. Cycads have cone scales and old leaf bases; tree ferns retain trunk scars. Leaves have subtle tip aging, vein shading and anchored flutter.

The forest floor has fallen conifer needles, leaf/frond fragments, twigs, slope-aligned pebbles, decaying logs, stumps and exposed roots. Terrain colors follow shared grove/moisture fields, with procedural sand grain/ripples, soil variation, damp mud and moss-like patches. Rock surfaces receive mineral/stratum variation and darker wet edges. Deadwood end faces have ring patterns. These are authored visual approximations, not identified fossil specimens or measured geological layers.

All new geometry and surface patterns are code-authored under the project MIT license. No new external image, model, texture or audio file is bundled for this pass. Existing asset credits remain in THIRD_PARTY.md. No modern flowering plants or lawn-grass models are introduced.

## Rendering and playtest

Fine fern geometry is selected within 22 metres; the matching coarse silhouette handles farther views. Leaf litter and pebble clusters are visible only nearby. Tiny ground clutter has no shadow pass, and small-plant shadow distance is limited. This manages rendering cost but establishes no minimum-frame-rate guarantee. Logs/stumps have low collision bounds; resource clearances and main routes remain protected.

Suggested playtest: walk from the starting coast toward the groves around the western coast, inspect the ground and canopy, then follow the river to the wetlands. Look for obvious detail transitions, floating roots/debris and navigation trouble near fallen wood.
