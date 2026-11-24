// Offline orthographic renders of the exact game meshes; no extra GPU or image downloads at runtime.
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const assets = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets'), out = path.join(assets, 'portraits');
await mkdir(out, { recursive: true });
const width = 640, height = 400, right = [.585, 0, .811], up = [-.203, .968, .146], view = [.785, .25, -.566];
const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0), clamp = (x, a, b) => Math.max(a, Math.min(b, x));
for (const name of ['stegosaurus', 'allosaurus', 'cryptoclidus', 'brachiosaurus', 'diplodocus', 'ceratosaurus']) {
  const file = await readFile(path.join(assets, name + '.bin')), count = file.readUInt32LE(4), n = file.readUInt32LE(8);
  const vertices = new Float32Array(count * 16), indices = new Uint32Array(n);
  for (let i = 0; i < vertices.length; i++) vertices[i] = file.readFloatLE(16 + i * 4);
  for (let i = 0; i < n; i++) indices[i] = file.readUInt32LE(16 + vertices.byteLength + i * 4);
  const textured = name === 'stegosaurus' || name === 'brachiosaurus';
  const texture = textured ? await sharp(path.join(assets, name + '-color.jpg')).removeAlpha().raw().toBuffer({ resolveWithObject: true }) : null;
  const projected = [], min = [Infinity, Infinity], max = [-Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    const p = [...vertices.subarray(i * 16, i * 16 + 3)], q = [dot(p, right), dot(p, up), dot(p, view)];
    for (let k = 0; k < 2; k++) { min[k] = Math.min(min[k], q[k]); max[k] = Math.max(max[k], q[k]); }
    projected.push(q);
  }
  const scale = Math.min((width - 64) / (max[0] - min[0]), (height - 66) / (max[1] - min[1])), center = (min[0] + max[0]) / 2;
  for (const q of projected) { q[0] = width / 2 + (q[0] - center) * scale; q[1] = height - 36 - (q[1] - min[1]) * scale; }
  const pixels = Buffer.alloc(width * height * 3), depth = new Float32Array(width * height).fill(-Infinity);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const glow = Math.exp(-((x - 320) ** 2 / 90000 + (y - 180) ** 2 / 50000)), shadow = name === 'cryptoclidus' ? 0 : Math.exp(-((x - 320) ** 2 / 19000 + (y - 363) ** 2 / 65));
    pixels.set([24 + glow * 23 - shadow * 14, 40 + glow * 26 - shadow * 19, 34 + glow * 19 - shadow * 14], (x + y * width) * 3);
  }
  for (let i = 0; i < n; i += 3) {
    const ids = [indices[i], indices[i + 1], indices[i + 2]], [a, b, c] = ids.map(j => projected[j]);
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(den) < .001) continue;
    const loX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), hiX = Math.min(width - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const loY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), hiY = Math.min(height - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    for (let y = loY; y <= hiY; y++) for (let x = loX; x <= hiX; x++) {
      const u = ((b[1] - c[1]) * (x + .5 - c[0]) + (c[0] - b[0]) * (y + .5 - c[1])) / den;
      const v = ((c[1] - a[1]) * (x + .5 - c[0]) + (a[0] - c[0]) * (y + .5 - c[1])) / den, w = 1 - u - v;
      if (u < 0 || v < 0 || w < 0) continue;
      const at = x + y * width, z = a[2] * u + b[2] * v + c[2] * w; if (z <= depth[at]) continue; depth[at] = z;
      const weights = [u, v, w], attribute = k => ids.reduce((sum, j, t) => sum + vertices[j * 16 + k] * weights[t], 0);
      const normal = [attribute(3), attribute(4), attribute(5)], len = Math.hypot(...normal) || 1;
      const light = .44 + .70 * Math.max(0, dot(normal, [.35, .8, -.48]) / len) + .10 * Math.max(0, dot(normal, view) / len);
      let color;
      if (texture) {
        const tx = clamp(Math.round(attribute(10) * (texture.info.width - 1)), 0, texture.info.width - 1), ty = clamp(Math.round(attribute(11) * (texture.info.height - 1)), 0, texture.info.height - 1);
        const offset = (tx + ty * texture.info.width) * 3; color = [...texture.data.subarray(offset, offset + 3)];
      } else { const stripe = .86 + .10 * Math.sin(attribute(2) * 2.1 + attribute(1)); color = [6, 7, 8].map(k => Math.pow(clamp(attribute(k) * stripe, 0, 1), .72) * 255); }
      pixels.set(color.map(v => clamp(Math.round(v * light), 0, 255)), at * 3);
    }
  }
  await sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg({ quality: 90 }).toFile(path.join(out, name + '.jpg'));
  console.log('Portrait: ' + name);
}
