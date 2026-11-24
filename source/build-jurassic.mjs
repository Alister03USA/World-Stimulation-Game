import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const dev = process.argv.includes('--dev');
const result = await build({
  entryPoints: [path.join(here, 'jurassic/main.js')], bundle: true, write: false, minify: !dev,
  format: 'iife', target: 'es2022', define: { __DEV__: String(dev) }, legalComments: 'inline',
  // Adapt the original, unchanged concatenation-based math helpers to ES module imports.
  plugins: [{ name: 'abyssal-math', setup(b) {
    b.onLoad({ filter: /[\\/]src[\\/]math\.js$/ }, ({ path: p }) => ({
      contents: readFileSync(p, 'utf8') + '\nexport { Mesh, icosphere, rnd, rr, rseed, vnoise, fbm, clamp, mix, sstep };', loader: 'js'
    }));
  } }]
});
const script = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const template = readFileSync(path.join(here, 'jurassic/template.html'), 'utf8');
const attribution = `<!-- Based on Abyssal Garden by Maksymilian Dendura. Source: https://github.com/Noniv/abyssal-garden\n${readFileSync(path.join(here, '..', 'LICENSE'), 'utf8')}\nSee THIRD_PARTY.md for project attribution. -->`;
const html = template.replace('<!--ATTRIBUTION-->', attribution).replace('/*SCRIPT*/', () => script);
const name = dev ? 'dev.html' : 'index.html';
writeFileSync(path.join(here, '..', name), html);
console.log(`${name}: ${Buffer.byteLength(html)} bytes; ${gzipSync(html).length} bytes gzip`);
