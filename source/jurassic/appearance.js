import { sculpt, ell, chain, eye, feature, skull, paint } from './sculpt.js';
import { Geometry } from './geometry.js';
import { sstep } from '../src/math.js';

const ivory = [.72, .65, .45], keratin = [.095, .08, .055];
const backHeight = (parts, z) => Math.max(...parts.map(([x, y, cz, rx, ry, rz]) => { const q = 1 - (x / rx) ** 2 - ((z - cz) / rz) ** 2; return q > 0 ? y + ry * Math.sqrt(q) : -Infinity; }));
export function makeAllosaurus(cerato = false) {
  const parts = [ell([0, 2.35, .1], [.54, .66, 1.24]), ell([0, 2.48, .78], [.61, .68, .82]), ell([0, 2.42, -.88], [.46, .64, .68])];
  chain(parts, [[0, 2.5, -.9], [0, 2.9, -1.55], [0, 3.03, -2.05]], [.38, .29, .27]);
  chain(parts, [[0, 2.48, 1], [0, 2.57, 2.3], [0, 2.75, 3.8], [0, 2.86, 5.5]], [.43, .27, .13, .025]);
  for (const s of [-1, 1]) {
    chain(parts, [[s * .45, 2.44, .7], [s * .61, 1.43, -.1], [s * .59, .65, .46], [s * .61, .18, .04]], [.31, .235, .12, .11]);
    parts.push(ell([s * .61, .13, -.12], [.17, .12, .29]));
    chain(parts, [[s * .4, 2.55, -.92], [s * .58, 2.13, -1.12], [s * .47, 1.96, -1.45]], [.12, .085, .055]);
  }
  const head = { joint: 15, pivot: [0, 2.55, -1.35], weight: 1 }, jaw = { ...head, joint: 16 };
  const rig = p => {
    if (p[1] < 1.9 && p[2] > -.6 && Math.abs(p[0]) > .26) return { joint: p[0] > 0 ? 10 : 12, pivot: [Math.sign(p[0]) * .45, 2.44, .7], weight: 1 - sstep(1.35, 1.95, p[1]) };
    if (p[2] > 1.4) return { joint: 14, pivot: [0, 2.48, 1.3], weight: sstep(1.4, 2.5, p[2]) };
    if (p[2] < -1.2) return { ...head, weight: sstep(1.2, 2, -p[2]) };
    return {};
  };
  const g = sculpt(parts, [[-1, -.1, -2.5], [1, 3.45, 5.7]], .065, [.3, .3, .2], rig), deep = cerato ? .07 : 0;
  skull(g, [[-1.94, 3.04, .21, .25], [-2.18, 3.10, .32, .34 + deep], [-2.55, 3.08, .28, .29 + deep], [-3.12, 3.01, .23, .20], [-3.43, 2.99, .16, .17]], [.32, .32, .19], head);
  skull(g, [[-2.02, 2.74, .23, .09], [-2.4, 2.68, .25, .095], [-3.11, 2.70, .20, .065], [-3.40, 2.74, .14, .045]], [.42, .36, .23], jaw);
  for (const s of [-1, 1]) {
    feature(g, head, () => {
      g.ellipsoid([s * .304, 3.22, -2.28], [.026, .094, .12], [.12, .105, .065], 0, 3);
      eye(g, [s * .325, 3.22, -2.29], s, .052);
      g.ellipsoid([s * .181, 3.045, -3.26], [.018, .025, .052], [.045, .04, .025], 0, 2);
      g.tube([[s * .30, 3.29, -2.12], [s * .32, 3.36, -2.3], [s * .26, 3.32, -2.6]], k => [.045, cerato ? .045 : .075, .025][k], [.39, .28, .15], 0, 12);
    });
    for (let t = 0; t < 13; t++) {
      const z = -2.23 - t * .083, x = s * (.255 - t * .0065), y = 2.785 + Math.max(0, t - 7) * .012;
      feature(g, head, () => g.tube([[x, y, z], [x * .98, y - .09, z + .017], [x * .94, y - .12, z + .045]], k => [.025, .014, .001][k], ivory, 0, 7));
      feature(g, jaw, () => g.tube([[x * .92, 2.745, z], [x * .94, 2.80, z], [x * .94, 2.82, z + .025]], k => [.018, .009, .001][k], ivory, 0, 7));
    }
    for (let finger = 0; finger < 3; finger++) feature(g, {}, () => g.tube([[s * .47, 1.96, -1.43 + finger * .035], [s * (.43 + finger * .055), 1.82, -1.64], [s * (.44 + finger * .055), 1.75, -1.58]], k => [.035, .025, .002][k], keratin));
    const foot = { joint: s > 0 ? 10 : 12, pivot: [s * .45, 2.44, .7], weight: 1 };
    for (let t = -1; t <= 1; t++) {
      const x = s * .61 + t * .10;
      const start = g.vertices.length; g.tube([[x, .15, .02], [x + t * .04, .11, -.34], [x + t * .045, .10, -.47]], k => [.065, .043, .027][k], [.3, .28, .17], foot.joint, 10);
      for (let i = start; i < g.vertices.length; i += 16) g.vertices.splice(i + 12, 4, ...foot.pivot, 1);
      feature(g, foot, () => g.tube([[x + t * .045, .1, -.43], [x + t * .05, .12, -.55], [x + t * .05, .07, -.61]], k => [.037, .024, .001][k], keratin));
    }
  }
  if (cerato) {
    feature(g, head, () => {
      const start = g.vertices.length; g.tube([[0, 3.20, -2.94], [0, 3.55, -2.91], [0, 3.67, -2.78]], k => [.14, .10, .002][k], [.43, .30, .16], 0, 16);
      for (let i = start; i < g.vertices.length; i += 16) { g.vertices[i] *= .38; g.vertices[i + 3] /= .38; const n = Math.hypot(...g.vertices.slice(i + 3, i + 6)); for (let k = 3; k < 6; k++) g.vertices[i + k] /= n; }
    });
    for (let i = 0; i < 18; i++) { const z = -1 + i * .32, y = backHeight(parts, z) + .025; feature(g, z > 1.4 ? { joint: 14, pivot: [0, 2.48, 1.3], weight: sstep(1.4, 2.5, z) } : {}, () => g.ellipsoid([0, y, z], [.04, .055, .09], [.24, .19, .12], 0, 2)); }
  }
  paint(g, cerato ? 1 : 0);
  if (cerato) for (let i = 0; i < g.vertices.length; i += 16) { g.vertices[i + 2] *= .88; g.vertices[i + 14] *= .88; }
  return g.finish();
}

export function makeDiplodocus() {
  const parts = [ell([0, 3.28, .1], [1.02, 1.05, 2.25]), ell([0, 3.6, 1.4], [.97, 1.04, 1.14]), ell([0, 3.42, -1.25], [.81, .87, 1.15])];
  chain(parts, [[0, 3.65, -1.9], [0, 3.70, -4], [0, 3.42, -6.8], [0, 3.55, -9.25]], [.56, .36, .22, .13]);
  chain(parts, [[0, 3.67, 1.8], [0, 3.34, 4], [0, 3.22, 7], [0, 3.52, 11], [0, 4.05, 15]], [.60, .32, .16, .065, .018]);
  for (const s of [-1, 1]) for (const z of [-1.4, 1.6]) {
    chain(parts, [[s * .7, 3.1, z], [s * .84, 1.65, z + .1], [s * .88, .35, z - .13]], [.37, .255, .23]);
    parts.push(ell([s * .88, .21, z - .18], [.29, .21, .34]));
  }
  const head = { joint: 15, pivot: [0, 3.6, -2.5], weight: 1 };
  const rig = p => {
    if (p[1] < 2.7 && Math.abs(p[0]) > .42) return { joint: 10 + (p[0] > 0 ? 0 : 2) + (p[2] > 0 ? 1 : 0), pivot: [Math.sign(p[0]) * .7, 3, p[2] > 0 ? 1.6 : -1.4], weight: 1 - sstep(2.2, 2.8, p[1]) };
    if (p[2] > 2.5) return { joint: 14, pivot: [0, 3.5, 2.3], weight: sstep(2.5, 5, p[2]) };
    if (p[2] < -2.7) return { ...head, weight: sstep(2.7, 6, -p[2]) }; return {};
  };
  const g = sculpt(parts, [[-1.4, -.1, -9.5], [1.4, 4.9, 15.2]], .12, [.3, .34, .25], rig);
  // The whip is narrower than the body voxel grid: sweep its tip explicitly to avoid holes.
  const tailStart = g.vertices.length;
  g.tube([[0, 3.22, 7], [0, 3.34, 9], [0, 3.52, 11], [0, 3.77, 13], [0, 4.05, 15]], k => [.17, .11, .068, .038, .008][k], [.29, .32, .25], 14, 16);
  for (let i = tailStart; i < g.vertices.length; i += 16) g.vertices.splice(i + 12, 4, 0, 3.5, 2.3, 1);
  skull(g, [[-9.13, 3.57, .13, .17], [-9.36, 3.58, .19, .20], [-9.70, 3.48, .17, .13], [-9.96, 3.46, .15, .11]], [.34, .35, .25], head);
  for (const s of [-1, 1]) {
    feature(g, head, () => { eye(g, [s * .185, 3.64, -9.38], s, .04); g.ellipsoid([s * .10, 3.56, -9.81], [.021, .014, .034], [.04, .04, .026]); g.tube([[s * .16, 3.39, -9.94], [s * .17, 3.38, -9.7], [s * .18, 3.44, -9.4]], .009, [.07, .065, .045]); });
    for (const z of [-1.4, 1.6]) {
      const foot = { joint: 10 + (s > 0 ? 0 : 2) + (z > 0 ? 1 : 0), pivot: [s * .7, 3, z], weight: 1 };
      for (let t = 0; t < (z > 0 ? 3 : 1); t++) feature(g, foot, () => g.ellipsoid([s * .88 + (t - 1) * .12, .13, z - .47], [.065, .075, .105], keratin, 0, 2));
    }
  }
  // Small dorsal spines are an artistic reconstruction; their full distribution is uncertain.
  for (let i = 0; i < 28; i++) { const z = -1.9 + i * .2, y = backHeight(parts, z) + .025; feature(g, rig([0, y, z]), () => g.ellipsoid([0, y, z], [.025, .075, .047], [.24, .23, .16], 0, 1)); }
  paint(g, 2); return g.finish();
}

export function makeCryptoclidus() {
  const parts = [ell([0, 0, 0], [.64, .38, 1.04])];
  chain(parts, [[0, .04, -.75], [0, .12, -1.5], [0, .20, -2.2], [0, .24, -2.77]], [.28, .20, .13, .10]);
  chain(parts, [[0, -.01, .85], [0, -.04, 1.75]], [.24, .025]);
  const head = { joint: 15, pivot: [0, 0, -1.2], weight: 1 };
  const g = sculpt(parts, [[-.85, -.6, -2.9], [.85, .6, 1.9]], .055, [.12, .26, .26], p => p[2] < -1.3 ? { ...head, weight: sstep(1.3, 2.3, -p[2]) } : {});
  skull(g, [[-2.68, .25, .10, .12], [-2.82, .26, .17, .14], [-3.06, .25, .13, .085], [-3.28, .24, .08, .055]], [.13, .27, .27], head);
  skull(g, [[-2.77, .13, .13, .035], [-3.08, .14, .115, .025], [-3.27, .17, .07, .015]], [.40, .49, .40], { ...head, joint: 16 });
  for (const s of [-1, 1]) for (let pair = 0; pair < 2; pair++) {
    const z = pair ? .65 : -.61, pivot = [s * .43, -.12, z], base = g.vertices.length / 16;
    for (let i = 0; i <= 24; i++) for (let j = 0; j <= 16; j++) {
      const t = i / 24, a = j / 16 * Math.PI * 2, chord = .33 * Math.sin(Math.PI * t) ** .6 + .025, thick = .045 * Math.sin(Math.PI * t) + .009;
      const n = [s * .14, Math.sin(a) / thick, Math.cos(a) / chord], len = Math.hypot(...n);
      g.vertex([s * (.43 + t * 1.2), -.12 + Math.sin(a) * thick - t * .045, z + t * .40 + Math.cos(a) * chord], n.map(v => v / len), [.14, .27, .26], 6 + pair * 2 + (s < 0 ? 1 : 0), [0, 0], pivot, t);
      if (i < 24 && j < 16) { const k = base + i * 17 + j; g.quad(k, k + 17, k + 18, k + 1); }
    }
  }
  for (const s of [-1, 1]) feature(g, head, () => { eye(g, [s * .158, .31, -2.84], s, .032); g.ellipsoid([s * .075, .30, -3.12], [.016, .01, .024], [.025, .04, .035]); for (let i = 0; i < 8; i++) { const z = -2.9 - i * .04, x = s * (.13 - i * .006); g.tube([[x, .18, z], [x, .115, z + .018]], k => k ? .001 : .009, ivory, 0, 6); } });
  paint(g, 3); return g.finish();
}
