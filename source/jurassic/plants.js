import { Geometry } from './geometry.js';

const TAU = Math.PI * 2;
function blade(g, base, tip, width, color, joint = 30) {
  const dx = tip[0] - base[0], dz = tip[2] - base[2], length = Math.hypot(dx, dz) || 1, sx = -dz / length * width, sz = dx / length * width;
  const middle = base.map((v, i) => (v + tip[i]) * .5 + (i === 1 ? width * .35 : 0));
  const a = g.vertex(base, [0, 1, 0], color, joint), b = g.vertex([middle[0] + sx, middle[1], middle[2] + sz], [-sx * .2, 1, -sz * .2], color, joint);
  const c = g.vertex(tip, [0, 1, 0], color.map(v => v * 1.1), joint), d = g.vertex([middle[0] - sx, middle[1], middle[2] - sz], [sx * .2, 1, sz * .2], color, joint);
  const ridge = g.vertex([middle[0], middle[1] + width * .22, middle[2]], [0, 1, 0], color.map(v => v * 1.15), joint);
  g.tri(a, b, ridge); g.tri(b, c, ridge); g.tri(c, d, ridge); g.tri(d, a, ridge);
}
function frond(g, angle, height, length, count, color, stiff = false) {
  const ca = Math.cos(angle), sa = Math.sin(angle), points = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count, r = length * t, y = height + Math.sin(t * (stiff ? 1.7 : 2.5)) * length * .27 - (stiff ? 0 : t * t * length * .12);
    points.push([ca * r, y, sa * r]);
    if (i < 2 || i === count) continue;
    const span = Math.sin(t * Math.PI) ** .65 * length * (stiff ? .15 : .22);
    for (const side of [-1, 1]) blade(g, [ca * r, y, sa * r], [ca * (r + length * .06) - sa * side * span, y - span * .12, sa * (r + length * .06) + ca * side * span], length * (stiff ? .014 : .028), color);
  }
  g.tube(points, k => .025 * (1 - k / (count + 1)), color.map(v => v * .75), 30, 4);
}

export function makeFern(tree = false, aquatic = false) {
  const g = new Geometry(), height = tree ? 4.5 : .12, length = tree ? 3.4 : aquatic ? 2.3 : 1.7;
  if (tree) {
    g.tube([[0, 0, 0], [.06, 2.2, .03], [0, height, 0]], k => .25 - k * .035, [.20, .15, .085], 0, 10);
    for (let i = 0; i < 26; i++) { const a = i * 2.4, y = i / 26 * height; g.ellipsoid([Math.cos(a) * .2, y, Math.sin(a) * .2], [.09, .07, .07], [.28, .20, .11], 0, 1); }
  }
  for (let i = 0; i < (tree ? 11 : 8); i++) frond(g, i * 2.399, height, length * (.84 + .16 * Math.sin(i * 4.1)), tree ? 16 : 11, aquatic ? [.11, .29, .20] : [.14, .30 + i * .006, .065]);
  for (let j = 0; j < 3; j++) {
    const a = j * 2.4, pts = [];
    for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push([Math.cos(a) * (.15 + Math.sin(t * 5) * .13), height + t * .9, Math.sin(a) * .15 + Math.cos(t * 5) * .08]); }
    g.tube(pts, .02, [.24, .36, .11], 30, 4);
  }
  return g.finish();
}

export function makeCycad() {
  const g = new Geometry(); g.ellipsoid([0, .52, 0], [.27, .62, .27], [.26, .19, .10], 0, 3);
  for (let i = 0; i < 35; i++) { const a = i * 2.4, y = i / 35; g.ellipsoid([Math.cos(a) * .26, y, Math.sin(a) * .26], [.07, .08, .07], [.35, .26, .13], 0, 1); }
  for (let i = 0; i < 12; i++) frond(g, i * 2.4, 1, 2.1 + Math.sin(i) * .15, 17, [.10, .25 + i * .002, .075], true);
  g.ellipsoid([0, 1.38, 0], [.15, .42, .15], [.56, .33, .12], 0, 3); return g.finish();
}

export function makeConifer() {
  const g = new Geometry();
  g.tube([[0, 0, 0], [.12, 8, 0], [-.15, 16, .1], [0, 24, 0]], k => [.65, .44, .27, .045][k], [.24, .16, .085], 0, 12);
  for (let level = 0; level < 8; level++) for (let arm = 0; arm < 5; arm++) {
    const a = arm * TAU / 5 + level * 1.7, ca = Math.cos(a), sa = Math.sin(a), y = 6.5 + level * 2.1, length = 5.7 - level * .55;
    g.tube([[0, y, 0], [ca * length * .55, y - .3, sa * length * .55], [ca * length, y + .65, sa * length]], k => [.16, .10, .015][k], [.26, .18, .095], 0, 5);
    for (let j = 1; j <= 8; j++) {
      const t = j / 8, cx = ca * length * t, cz = sa * length * t, cy = y + t * t * .8 - .25, leafLength = (.7 + (1 - t) * .7) * (1 - level * .025);
      for (let needle = 0; needle < 6; needle++) {
        const b = a + (needle / 5 - .5) * 2.8;
        blade(g, [cx, cy, cz], [cx + Math.cos(b) * leafLength, cy + .2 + needle % 2 * .12, cz + Math.sin(b) * leafLength], .065 + (1 - t) * .025, [.10 + level * .004, .235 + level * .005, .09]);
      }
    }
  }
  for (let i = 0; i < 5; i++) { const a = i * 2.4; g.tube([[0, .4, 0], [Math.cos(a) * 1.7, .05, Math.sin(a) * 1.7]], k => k ? .05 : .26, [.24, .17, .08], 0, 6); }
  return g.finish();
}

export function makeGinkgo() {
  const g = new Geometry(); g.tube([[0, 0, 0], [.12, 7, .1], [-.2, 15, .1], [0, 19, 0]], k => [.44, .30, .15, .025][k], [.30, .23, .15], 0, 10);
  for (let j = 0; j < 18; j++) {
    const a = j * 2.4, y = 6 + j * .66, length = 4.6 - j * .12, ca = Math.cos(a), sa = Math.sin(a);
    g.tube([[0, y, 0], [ca * length * .6, y + 1.2, sa * length * .6], [ca * length, y + 2, sa * length]], k => [.12, .07, .01][k], [.31, .24, .14], 0, 5);
    for (let leaf = 0; leaf < 22; leaf++) {
      const t = .25 + leaf / 29, spread = Math.sin(leaf * 4.3) * 1.0, base = [ca * length * t - sa * spread, y + 1.9 * t + Math.cos(leaf * 3) * .25, sa * length * t + ca * spread], size = .25;
      const center = g.vertex(base, [0, 1, 0], [.30, .40, .12], 30);
      for (let k = 0; k <= 7; k++) {
        const ang = a + (k / 7 - .5) * 2.1, r = size * (k === 3 || k === 4 ? .9 : 1);
        g.vertex([base[0] + Math.cos(ang) * r, base[1] + .06 + Math.sin(k) * .018, base[2] + Math.sin(ang) * r], [0, 1, 0], [.28 + leaf % 4 * .012, .40 + leaf % 5 * .01, .105], 30);
        if (k) g.tri(center, center + k, center + k + 1);
      }
    }
  }
  return g.finish();
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
  return g.finish();
}
