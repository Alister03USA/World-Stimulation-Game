import { surfaceNets, sampler3, sstep, mix } from '../src/math.js';
import { Geometry } from './geometry.js';

// Smooth unions turn anatomical volumes into one continuous skin instead of intersecting spheres.
function sculpt(parts, bounds, step, color, rig) {
  const [lo, hi] = bounds, dims = hi.map((v, i) => Math.ceil((v - lo[i]) / step) + 1), [nx, ny, nz] = dims, field = new Float32Array(nx * ny * nz);
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const px = lo[0] + x * step, py = lo[1] + y * step, pz = lo[2] + z * step; let d = 1000;
    for (const [cx, cy, cz, rx, ry, rz] of parts) {
      const a = (px - cx) / rx, b = (py - cy) / ry, c = (pz - cz) / rz, k0 = Math.hypot(a, b, c), k1 = Math.hypot(a / rx, b / ry, c / rz);
      const e = k1 > 1e-7 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz), h = Math.max(.20 - Math.abs(d - e), 0) / .20;
      d = Math.min(d, e) - h * h * .05;
    }
    field[x + nx * (y + ny * z)] = -d;
  }
  const mesh = surfaceNets(field, nx, ny, nz), sample = sampler3(field, nx, ny, nz), g = new Geometry();
  for (let i = 0; i < mesh.pos.length; i += 3) {
    const [x, y, z] = mesh.pos.subarray(i, i + 3), p = [lo[0] + x * step, lo[1] + y * step, lo[2] + z * step];
    let nx0 = sample(x - .4, y, z) - sample(x + .4, y, z), ny0 = sample(x, y - .4, z) - sample(x, y + .4, z), nz0 = sample(x, y, z - .4) - sample(x, y, z + .4), len = Math.hypot(nx0, ny0, nz0) || 1;
    const r = rig(p), tone = .84 + .16 * sstep(.5, 3.5, p[1]);
    g.vertex(p, [nx0 / len, ny0 / len, nz0 / len], color.map(v => v * tone), r.joint || 0, [p[0], p[2]], r.pivot || [0, 0, 0], r.weight || 0);
  }
  for (const i of mesh.idx) g.indices.push(i);
  return g;
}
const ell = (p, r) => [...p, ...r];
function chain(parts, points, radii, squash = 1) {
  for (let k = 0; k < points.length - 1; k++) {
    const a = points[k], b = points[k + 1], n = Math.max(2, Math.ceil(Math.hypot(...a.map((v, i) => v - b[i])) / (Math.min(radii[k], radii[k + 1]) * 1.4 + .15)));
    for (let i = 0; i <= n; i++) { const t = i / n, r = mix(radii[k], radii[k + 1], t); parts.push(ell(a.map((v, j) => mix(v, b[j], t)), [r, r * squash, r])); }
  }
}
function eye(g, p, side, size = .085) {
  g.ellipsoid(p, [size * .48, size, size], [.035, .025, .018], 0, 2);
  g.ellipsoid([p[0] + side * size * .28, p[1], p[2] - .008], [size * .24, size * .68, size * .68], [.65, .42, .12], 0, 2);
  g.ellipsoid([p[0] + side * size * .45, p[1], p[2] - .01], [size * .10, size * .49, size * .25], [.008, .012, .01], 0, 2);
}

// Facial accessories share the head rig; -99 excludes teeth, eyes and keratin from skin projection.
function feature(g, rig, draw) {
  const start = g.vertices.length; draw();
  for (let i = start; i < g.vertices.length; i += 16) { g.vertices[i + 9] = rig.joint || 0; g.vertices[i + 10] = -99; g.vertices.splice(i + 12, 4, ...(rig.pivot || [0, 0, 0]), rig.weight || 0); }
}
function skull(g, sections, color, rig) {
  const base = g.vertices.length / 16, sides = 24;
  for (let k = 0; k < sections.length; k++) {
    const [z, y, w, h] = sections[k], prev = sections[Math.max(0, k - 1)], next = sections[Math.min(sections.length - 1, k + 1)];
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), x = Math.sign(c) * Math.abs(c) ** .72, v = Math.sign(s) * Math.abs(s) ** .72;
      const n = [x / w, v / h, -(next[1] - prev[1] + v * (next[3] - prev[3])) / Math.max(.001, Math.abs(next[0] - prev[0])) / h], len = Math.hypot(...n);
      g.vertex([x * w, y + v * h, z], n.map(q => q / len), color, rig.joint, [0, 0], rig.pivot, rig.weight);
      if (k && j) { const b = base + k * (sides + 1) + j; g.quad(b, b - 1, b - sides - 2, b - sides - 1); }
    }
  }
  for (const k of [0, sections.length - 1]) { const [z, y] = sections[k], c = g.vertex([0, y, z], [0, 0, k ? -1 : 1], color, rig.joint, [0, 0], rig.pivot, rig.weight); for (let j = 0; j < sides; j++) g.tri(c, base + k * 25 + j, base + k * 25 + j + 1); }
}
function paint(g, species) {
  const palettes = [[[.29, .31, .17], [.57, .49, .32]], [[.36, .20, .12], [.62, .47, .29]], [[.29, .32, .25], [.57, .53, .40]], [[.10, .25, .25], [.53, .59, .48]]], [back, belly] = palettes[species];
  for (let i = 0; i < g.vertices.length; i += 16) {
    if (g.vertices[i + 10] === -99) continue;
    const y = g.vertices[i + 1], z = g.vertices[i + 2], underside = sstep(.05, -.8, g.vertices[i + 4]), bands = .82 + .18 * Math.sin(z * (species === 2 ? 1.6 : 3.2) + y * 1.8) ** 6;
    for (let c = 0; c < 3; c++) g.vertices[i + 6 + c] = mix(back[c] * bands, belly[c], underside * .85);
  }
}


export { sculpt, ell, chain, eye, feature, skull, paint };
