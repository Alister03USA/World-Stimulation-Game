import { Geometry } from './geometry.js';

const TAU = Math.PI * 2;
function blade(g, base, tip, width, color, joint = 30) {
  const dx = tip[0] - base[0], dz = tip[2] - base[2], length = Math.hypot(dx, dz) || 1, sx = -dz / length * width, sz = dx / length * width;
  const middle = base.map((v, i) => (v + tip[i]) * .5 + (i === 1 ? width * .35 : 0));
  const aged = Math.sin(base[0] * 19 + base[1] * 7 + base[2] * 23) > .86, tipColor = aged ? [.30, .25, .095] : color.map(v => v * 1.13);
  const a = g.vertex(base, [0, 1, 0], color, joint, [0, 0], base, 0), b = g.vertex([middle[0] + sx, middle[1], middle[2] + sz], [-sx * .2, 1, -sz * .2], color, joint, [1, .5], base, .5);
  const c = g.vertex(tip, [0, 1, 0], tipColor, joint, [0, 1], base, 1), d = g.vertex([middle[0] - sx, middle[1], middle[2] - sz], [sx * .2, 1, sz * .2], color, joint, [-1, .5], base, .5);
  const ridge = g.vertex([middle[0], middle[1] + width * .22, middle[2]], [0, 1, 0], color.map(v => v * 1.12), joint, [0, .5], base, .5);
  g.tri(a, b, ridge); g.tri(b, c, ridge); g.tri(c, d, ridge); g.tri(d, a, ridge);
}
function frond(g, angle, height, length, count, color, stiff = false, fine = false) {
  const ca = Math.cos(angle), sa = Math.sin(angle), points = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count, r = length * t, y = height + Math.sin(t * (stiff ? 1.7 : 2.5)) * length * .27 - (stiff ? 0 : t * t * length * .12);
    points.push([ca * r, y, sa * r]);
    if (i < 2 || i === count) continue;
    const span = Math.sin(t * Math.PI) ** .65 * length * (stiff ? .15 : .22);
    for (const side of [-1, 1]) {
      const base = [ca * r, y, sa * r], tip = [ca * (r + length * .06) - sa * side * span, y - span * .12, sa * (r + length * .06) + ca * side * span];
      blade(g, base, tip, length * (stiff ? .014 : fine ? .017 : .028), color);
      if (fine && !stiff) for (let k = 1; k <= 4; k++) for (const edge of [-1, 1]) {
        const t = k / 5, p = base.map((v, j) => v + (tip[j] - v) * t), width = span * .19 * Math.sin(t * Math.PI);
        blade(g, p, [p[0] + ca * edge * width - sa * side * width * .35, p[1] - width * .15, p[2] + sa * edge * width + ca * side * width * .35], length * .008, color);
      }
    }
  }
  g.tube(points, k => .025 * (1 - k / (count + 1)), color.map(v => v * .75), 30, 4);
}

export function makeFern(tree = false, aquatic = false, fine = false) {
  const g = new Geometry(), height = tree ? 4.5 : .12, length = tree ? 3.4 : aquatic ? 2.3 : 1.7;
  if (tree) {
    g.tube([[0, 0, 0], [.06, 2.2, .03], [0, height, 0]], k => .25 - k * .035, [.20, .15, .085], 0, 10);
    for (let i = 0; i < 26; i++) { const a = i * 2.4, y = i / 26 * height; g.ellipsoid([Math.cos(a) * .2, y, Math.sin(a) * .2], [.09, .07, .07], [.28, .20, .11], 0, 1); }
  }
  for (let i = 0; i < (tree ? 11 : 8); i++) frond(g, i * 2.399, height, length * (.84 + .16 * Math.sin(i * 4.1)), tree ? 16 : 11, aquatic ? [.11, .29, .20] : [.11, .245 + i * .006, .055], false, fine);
  for (let j = 0; j < 3; j++) {
    const a = j * 2.4, pts = [], ca = Math.cos(a), sa = Math.sin(a), rise = .49 + j * .045;
    for (let k = 0; k <= 5; k++) { const t = k / 5; pts.push([ca * (.10 + t * .08), height + t * (rise - .16), sa * (.10 + t * .08)]); }
    for (let k = 0; k <= 20; k++) { const t = k / 20, angle = -Math.PI / 2 + t * Math.PI * 2.3, r = .16 * (1 - t * .88); pts.push([ca * (.18 + Math.cos(angle) * r), height + rise + Math.sin(angle) * r, sa * (.18 + Math.cos(angle) * r)]); }
    g.tube(pts, k => .018 - k / (pts.length - 1) * .008, [.16, .30, .075], 30, 5);
    g.ellipsoid(pts[pts.length - 1], [.012, .012, .012], [.18, .31, .08], 30, 1);
  }
  return plantFinish(g);
}

export function makeCycad() {
  const g = new Geometry(); g.ellipsoid([0, .52, 0], [.27, .62, .27], [.26, .19, .10], 0, 3);
  for (let i = 0; i < 35; i++) { const a = i * 2.4, y = i / 35; g.ellipsoid([Math.cos(a) * .26, y, Math.sin(a) * .26], [.07, .08, .07], [.35, .26, .13], 0, 1); }
  for (let i = 0; i < 12; i++) frond(g, i * 2.4, 1, 2.1 + Math.sin(i) * .15, 17, [.10, .25 + i * .002, .075], true);
  g.ellipsoid([0, 1.38, 0], [.15, .42, .15], [.45, .28, .11], 0, 3);
  for (let i = 0; i < 35; i++) { const a = i * 2.399, y = 1.08 + i / 35 * .6, r = .13 * Math.sin(i / 35 * Math.PI); g.ellipsoid([Math.cos(a) * r, y, Math.sin(a) * r], [.045, .027, .045], [.39, .245, .10], 42, 1); }
  return plantFinish(g);
}

export function makeConifer(variant = 0) {
  const g = new Geometry();
  g.tube([[0, 0, 0], [.12, 8, 0], [-.15, 16, .1], [0, 24, 0]], k => [.65, .44, .27, .045][k], [.24, .16, .085], 0, 12);
  for (let level = 0; level < 8; level++) for (let arm = 0; arm < 5; arm++) {
    const a = arm * TAU / 5 + level * (1.7 + variant * .23), ca = Math.cos(a), sa = Math.sin(a), y = 6.5 + level * 2.1, length = (5.7 - level * .55) * (1 + variant * .12) * (1 + Math.sin(level * 3 + arm * 7) * .09);
    g.tube([[0, y, 0], [ca * length * .55, y - .3, sa * length * .55], [ca * length, y + .65, sa * length]], k => [.16, .10, .015][k], [.26, .18, .095], 0, 5);
    for (let j = 1; j <= 8; j++) {
      const t = j / 8, cx = ca * length * t, cz = sa * length * t, cy = y + t * t * .8 - .25, leafLength = (.7 + (1 - t) * .7) * (1 - level * .025);
      for (let needle = 0; needle < 6; needle++) {
        const b = a + (needle / 5 - .5) * 3.6, lift = .16 + Math.sin(needle * 2.4 + level) * .37;
        blade(g, [cx, cy, cz], [cx + Math.cos(b) * leafLength, cy + lift, cz + Math.sin(b) * leafLength], .115 + (1 - t) * .04, [.075 + level * .003, .19 + level * .006, .065]);
      }
    }
  }
  for (let i = 0; i < 5; i++) { const a = i * 2.4; g.tube([[0, .4, 0], [Math.cos(a) * 1.7, .05, Math.sin(a) * 1.7]], k => k ? .05 : .26, [.24, .17, .08], 0, 6); }
  for (let i = 0; i < 12; i++) { const a = i * 2.4, y = .8 + i * .55; g.ellipsoid([Math.cos(a) * .56, y, Math.sin(a) * .56], [.09, .16, .07], [.19, .125, .065], 42, 1); }
  const mesh = plantFinish(g);
  if (variant) for (let i = 0; i < mesh.vertices.length; i += 16) { const lean = Math.sin(mesh.vertices[i + 1] * .12) * .3; mesh.vertices[i] += lean; mesh.vertices[i + 12] += Math.sin(mesh.vertices[i + 13] * .12) * .3; }
  return mesh;
}

export function makeGinkgo() {
  const g = new Geometry(); g.tube([[0, 0, 0], [.12, 7, .1], [-.2, 15, .1], [0, 19, 0]], k => [.44, .30, .15, .025][k], [.30, .23, .15], 0, 10);
  for (let j = 0; j < 18; j++) {
    const a = j * 2.4, y = 6 + j * .66, length = 4.6 - j * .12, ca = Math.cos(a), sa = Math.sin(a);
    g.tube([[0, y, 0], [ca * length * .6, y + 1.2, sa * length * .6], [ca * length, y + 2, sa * length]], k => [.12, .07, .01][k], [.31, .24, .14], 0, 5);
    for (let leaf = 0; leaf < 32; leaf++) {
      const t = .25 + leaf / 43, spread = Math.sin(leaf * 4.3) * 1.25, base = [ca * length * t - sa * spread, y + 1.9 * t + Math.cos(leaf * 3) * .4, sa * length * t + ca * spread], size = .31 + leaf % 4 * .025;
      const center = g.vertex(base, [0, 1, 0], [.23, .34, .09], 30, [0, 0], base, 0);
      for (let k = 0; k <= 7; k++) {
        const ang = a + (k / 7 - .5) * 2.1, r = size * (k === 3 || k === 4 ? .9 : 1);
        g.vertex([base[0] + Math.cos(ang) * r, base[1] + .06 + Math.sin(k) * .018, base[2] + Math.sin(ang) * r], [0, 1, 0], [.22 + leaf % 4 * .012, .34 + leaf % 5 * .01, .085], 30, [(k / 7 - .5) * 2, 1], base, 1);
        if (k) g.tri(center, center + k, center + k + 1);
      }
    }
  }
  return plantFinish(g);
}

export function makeHorsetail() {
  const g = new Geometry();
  for (let shoot = 0; shoot < 7; shoot++) {
    const a = shoot * 2.4, x = Math.cos(a) * .35, z = Math.sin(a) * .35, h = 1.1 + .5 * Math.sin(shoot * 3) ** 2;
    g.tube([[x, 0, z], [x, h, z]], .026, [.21, .35, .13], 30, 6);
    for (let k = 1; k < 8; k++) {
      const y = k / 8 * h; g.ellipsoid([x, y, z], [.038, .017, .038], [.13, .24, .065], 30, 1);
      for (let j = 0; j < 7; j++) { const b = j / 7 * TAU, l = .30 * (1 - k / 11); blade(g, [x, y, z], [x + Math.cos(b) * l, y + .17, z + Math.sin(b) * l], .010, [.21, .37, .12]); }
    }
  }
  return plantFinish(g);
}

function plantFinish(g) {
  for (let i = 0; i < g.vertices.length; i += 16) if (g.vertices[i + 9] === 0) g.vertices[i + 9] = 42;
  return g.finish();
}
