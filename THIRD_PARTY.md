# Attribution

This project is based on [Abyssal Garden](https://github.com/Noniv/abyssal-garden) by Maksymilian Dendura, copyright (c) 2026, released under the MIT license in [LICENSE](LICENSE).

The starting snapshot was commit `a596354eff400d458bc2aeb9bdf5e0a9734b2bcf`. The original procedural underwater experience remains available as `abyssal.html`, with its documentation in `README-abyssal.md`. Its original source remains in `source/src/` and `source/template.html`.

The Jurassic prototype reuses the original seeded random, noise, mesh, and icosphere helpers from `source/src/math.js`. Its rendering and audio designs also draw on the original project's direct WebGPU instancing, procedural shading, and synthesized soundscape. The new height-field world, creature meshes, behavior, survival simulation, interface, and renderer are in `source/jurassic/`.

The distributed Jurassic HTML includes a short attribution comment. When redistributing it, include LICENSE and this attribution file as well.

## Development dependency

esbuild is used at build time under its MIT license. There are no runtime engine, model, texture, font, or audio downloads.

## Species references

- [Natural History Museum: Allosaurus](https://www.nhm.ac.uk/discover/dino-directory/allosaurus.html)
- [Natural History Museum: Stegosaurus](https://www.nhm.ac.uk/discover/dino-directory/stegosaurus.html)
- [Plesiosaur Directory: Cryptoclidus](https://plesiosauria.com/genera/cryptoclidus/)

The habitat combines Jurassic animals from different places and times. Models, vegetation, coloration, behavior, and survival systems are stylized, rather than a reconstruction of one fossil locality. Cryptoclidus is a marine reptile, not a dinosaur. Modern supply crates establish the player as a fictional visitor; food gathering does not imply that Jurassic plants are safe to eat.
