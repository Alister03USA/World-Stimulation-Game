# Attribution

This project is based on [Abyssal Garden](https://github.com/Noniv/abyssal-garden) by Maksymilian Dendura, copyright (c) 2026, released under the MIT license in [LICENSE](LICENSE).

The starting snapshot was commit `a596354eff400d458bc2aeb9bdf5e0a9734b2bcf`. The original procedural underwater experience remains available as `abyssal.html`, with its documentation in `README-abyssal.md`. Its original source remains in `source/src/` and `source/template.html`.

The Jurassic prototype reuses the original seeded random, noise, mesh, and icosphere helpers from `source/src/math.js`. Its rendering and audio designs also draw on the original project's direct WebGPU instancing, procedural shading, and synthesized soundscape. The new height-field world, creature meshes, behavior, survival simulation, interface, and renderer are in `source/jurassic/`.

The distributed Jurassic HTML includes a short attribution comment. When redistributing it, include LICENSE and this attribution file as well.

## Imported model and texture assets

The detailed [Stegosaurus](https://grab3d.com/models/creatures/stegosaurus/) and [Brachiosaurus](https://grab3d.com/models/creatures/brachiosaurus/) are by Grab3D, distributed under [CC0 1.0](https://grab3d.com/license/). The source GLBs include base-color, normal and occlusion/roughness/metallic maps. Grab3D describes its process as an AI-generated draft cleaned in Blender; these static models have no supplied skeleton. Our conversion simplifies their geometry, resizes textures, aligns coordinates, and assigns procedural deformation weights. It does not create a conventional skeletal rig.

Optimized derivatives and textures are included in `source/assets/`, and embedded in the generated HTML. `source/assets/manifest.json` records download links, original SHA-256 hashes, mesh counts, bounds and conversion details. Source downloads: [stegosaurus.glb](https://grab3d.com/dl/stegosaurus/stegosaurus.glb), [brachiosaurus.glb](https://grab3d.com/dl/brachiosaurus/brachiosaurus.glb). Original GLBs are not included; the game does not download them at runtime.

The other four animal meshes are authored procedural reconstructions in `source/jurassic/sculpt.js`, baked into `source/assets/` by `source/tools/bake-sculpts.mjs`. Plant geometry is authored in `source/jurassic/plants.js`. Those additions share the project MIT license and reuse the original surface-nets and mesh helpers. No texture or model has been copied from a commercial Jurassic franchise.

## Development dependencies

esbuild (MIT) bundles the game; meshoptimizer (MIT) simplifies imported geometry; sharp (Apache-2.0, with its own dependency notices) resizes source textures. They are development tools, not runtime engine dependencies. Their full dependency licenses remain in installed npm packages. There are no runtime engine, model, texture, font, or audio downloads.

## Species references

- [Natural History Museum: Allosaurus](https://www.nhm.ac.uk/discover/dino-directory/allosaurus.html)
- [Natural History Museum: Stegosaurus](https://www.nhm.ac.uk/discover/dino-directory/stegosaurus.html)
- [Natural History Museum: Brachiosaurus](https://www.nhm.ac.uk/discover/dino-directory/brachiosaurus.html)
- [Natural History Museum: Diplodocus](https://www.nhm.ac.uk/discover/dino-directory/diplodocus.html)
- [Natural History Museum: Ceratosaurus](https://www.nhm.ac.uk/discover/dino-directory/ceratosaurus.html)
- [Plesiosaur Directory: Cryptoclidus](https://plesiosauria.com/genera/cryptoclidus/)
- [Natural History Museum: Jurassic plant groups](https://www.nhm.ac.uk/discover/how-to-grow-a-dinosaur-garden.html)

The habitat combines Jurassic animals from different places and times. Models, vegetation, coloration, behavior, and survival systems are stylized, rather than a reconstruction of one fossil locality. Cryptoclidus is a marine reptile, not a dinosaur. Modern supply crates establish the player as a fictional visitor; food gathering does not imply that Jurassic plants are safe to eat.
