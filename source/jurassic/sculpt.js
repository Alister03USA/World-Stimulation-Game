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

export function makeAllosaurus(cerato = false) {
  const parts = [ell([0, 2.2, .1], [.66, .83, 1.25]), ell([0, 2.3, .82], [.73, .82, .75]), ell([0, 2.36, -.82], [.56, .72, .8]), ell([0, 3.12, -2.42], [.38, .38, .62]), ell([0, 2.99, -2.94], [.29, .24, .52]), ell([0, 2.79, -2.82], [.27, .11, .56])];
  chain(parts, [[0, 2.5, -.9], [0, 2.87, -1.6], [0, 3.12, -2]], [.43, .35, .30]);
  chain(parts, [[0, 2.35, 1.1], [0, 2.52, 2.3], [0, 2.7, 3.7], [0, 2.78, 5.1]], [.55, .34, .17, .065]);
  for (const side of [-1, 1]) {
    chain(parts, [[side * .5, 2.05, .65], [side * .64, 1.25, -.02], [side * .63, .48, .58], [side * .61, .16, .1]], [.35, .27, .13, .12]);
    parts.push(ell([side * .61, .13, -.12], [.24, .13, .40]));
    chain(parts, [[side * .43, 2.6, -.88], [side * .63, 2.08, -1.12], [side * .52, 1.88, -1.42]], [.15, .10, .065]);
  }
  const rig = p => {
    if (p[1] < 1.85 && p[2] > -.6 && Math.abs(p[0]) > .26) return { joint: p[0] > 0 ? 10 : 12, pivot: [Math.sign(p[0]) * .55, 2.1, .65], weight: 1 - sstep(1.35, 1.9, p[1]) };
    if (p[2] > 1.4) return { joint: 14, pivot: [0, 2.4, 1.3], weight: sstep(1.4, 2.5, p[2]) };
    return {};
  };
  const g = sculpt(parts, [[-1.2, -.14, -3.65], [1.2, 3.8, 5.4]], .075, cerato ? [.40, .28, .20] : [.35, .39, .23], rig);
  for (const side of [-1, 1]) {
    eye(g, [side * .34, 3.22, -2.65], side);
    g.ellipsoid([side * .20, 3.07, -3.26], [.035, .034, .06], [.025, .03, .02], 0, 2);
    g.tube([[side * .25, 2.91, -3.33], [side * .32, 2.90, -2.8], [side * .29, 2.94, -2.25]], .017, [.06, .045, .025]);
    if (!cerato) g.ellipsoid([side * .28, 3.45, -2.54], [.12, .15, .26], [.52, .29, .13], 0, 3);
    for (let finger = 0; finger < 3; finger++) g.tube([[side * .52, 1.89, -1.4 + finger * .055], [side * (.46 + finger * .07), 1.78, -1.57], [side * (.48 + finger * .07), 1.69, -1.58]], k => [.043, .029, .01][k], [.16, .15, .10]);
    for (let toe = -1; toe <= 1; toe++) g.tube([[side * .61 + toe * .11, .13, -.05], [side * .61 + toe * .17, .10, -.47], [side * .61 + toe * .18, .12, -.60]], k => [.07, .045, .008][k], [.18, .17, .12], side > 0 ? 1 : 2);
  }
  if (cerato) {
    g.tube([[0, 3.20, -2.97], [0, 3.48, -2.90], [0, 3.60, -2.83]], k => [.12, .07, .005][k], [.59, .36, .19], 0, 12);
    for (let i = 0; i < 17; i++) g.ellipsoid([0, 3.04 - Math.abs(i - 7) * .017, -1.2 + i * .27], [.075, .10, .10], [.44, .34, .20], 0, 1);
  }
  return g.finish();
}

export function makeDiplodocus() {
  const parts = [ell([0, 3.35, .1], [1.12, 1.13, 2.3]), ell([0, 3.7, 1.4], [1.02, 1.10, 1.2]), ell([0, 3.45, -1.25], [.85, .9, 1.25])];
  chain(parts, [[0, 3.65, -1.9], [0, 3.65, -4], [0, 3.35, -6.8], [0, 3.5, -9.1]], [.62, .42, .26, .17]);
  parts.push(ell([0, 3.45, -9.47], [.26, .27, .50]));
  chain(parts, [[0, 3.7, 1.8], [0, 3.3, 4], [0, 3.1, 6.7], [0, 3.4, 9.7], [0, 3.8, 12.7]], [.68, .38, .22, .11, .055]);
  for (const side of [-1, 1]) for (const z of [-1.4, 1.6]) {
    chain(parts, [[side * .7, 3.2, z], [side * .83, 1.65, z + .1], [side * .88, .32, z - .13]], [.43, .29, .24]); parts.push(ell([side * .88, .22, z - .18], [.31, .22, .40]));
  }
  const rig = p => {
    if (p[1] < 2.7 && Math.abs(p[0]) > .42) return { joint: 10 + (p[0] > 0 ? 0 : 2) + (p[2] > 0 ? 1 : 0), pivot: [Math.sign(p[0]) * .7, 3, p[2] > 0 ? 1.6 : -1.4], weight: 1 - sstep(2.2, 2.8, p[1]) };
    if (p[2] > 2.5) return { joint: 14, pivot: [0, 3.5, 2.3], weight: sstep(2.5, 5, p[2]) };
    if (p[2] < -2.7) return { joint: 15, pivot: [0, 3.6, -2.5], weight: sstep(2.7, 6, -p[2]) };
    return {};
  };
  const g = sculpt(parts, [[-1.5, -.1, -10.2], [1.5, 5.2, 13.1]], .14, [.37, .42, .28], rig);
  for (const side of [-1, 1]) eye(g, [side * .23, 3.54, -9.56], side, .075);
  for (let i = 0; i < 34; i++) g.ellipsoid([0, 4.43 - Math.max(0, i - 17) * .055, -2 + i * .19], [.035, .10, .055], [.32, .27, .17], 0, 1);
  return g.finish();
}

export function makeCryptoclidus() {
  const parts = [ell([0, 0, 0], [.70, .48, 1.3])];
  chain(parts, [[0, .05, -1], [0, .17, -2], [0, .32, -3.15], [0, .39, -3.85]], [.31, .22, .15, .12]);
  parts.push(ell([0, .39, -4.02], [.21, .18, .43])); chain(parts, [[0, 0, 1], [0, -.08, 2]], [.29, .045]);
  const g = sculpt(parts, [[-1, -.7, -4.6], [1, .8, 2.3]], .075, [.21, .33, .34], p => p[2] < -1.3 ? { joint: 15, pivot: [0, 0, -1.2], weight: sstep(1.3, 3, -p[2]) } : {});
  for (const side of [-1, 1]) for (const z of [-.68, .83]) {
    const m = new Geometry();
    for (let i = 0; i <= 16; i++) for (let j = 0; j <= 12; j++) {
      const t = i / 16, a = j / 12 * Math.PI * 2, x = side * (.50 + t * 1.7), width = Math.sin(Math.PI * t) ** .6 * .43 + .02;
      m.vertex([x, -.16 + Math.sin(a) * width * .20, z + t * .58 + Math.cos(a) * width], [0, Math.sin(a), Math.cos(a)], [.22, .37, .35], side > 0 ? 6 : 7);
      if (i < 16 && j < 12) { const k = i * 13 + j; m.quad(k, k + 13, k + 14, k + 1); }
    }
    const base = g.vertices.length / 16; g.vertices.push(...m.vertices); for (const i of m.indices) g.indices.push(base + i);
  }
  for (const side of [-1, 1]) eye(g, [side * .18, .46, -4.14], side, .045);
  return g.finish();
}
