// Bake authored continuous-skin meshes once, so players do not wait for sculpting at startup.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = await build({ entryPoints: [path.join(root, 'jurassic/sculpt.js')], bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022',
  plugins: [{ name: 'abyssal-math', setup(b) { b.onLoad({ filter: /[\\/]src[\\/]math\.js$/ }, ({ path: p }) => ({ contents: readFileSync(p, 'utf8') + '\nexport { Mesh, icosphere, surfaceNets, sampler3, rnd, rr, rseed, vnoise, fbm, clamp, mix, sstep };', loader: 'js' })); } }] });
const sculpt = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
for (const [name, make] of [['allosaurus', () => sculpt.makeAllosaurus()], ['ceratosaurus', () => sculpt.makeAllosaurus(true)], ['diplodocus', sculpt.makeDiplodocus], ['cryptoclidus', sculpt.makeCryptoclidus]]) {
  const { vertices, indices } = make(), header = Buffer.alloc(16); header.write('JUR2'); header.writeUInt32LE(vertices.length / 16, 4); header.writeUInt32LE(indices.length, 8); header.writeUInt32LE(64, 12);
  writeFileSync(path.join(root, 'assets', name + '.bin'), Buffer.concat([header, Buffer.from(vertices.buffer), Buffer.from(indices.buffer)]));
  console.log(`${name}: ${vertices.length / 16} vertices, ${indices.length / 3} triangles`);
}
