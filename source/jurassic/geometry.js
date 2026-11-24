import { Mesh, icosphere } from '../src/math.js';

// Shared 64-byte vertex: position, normal, color, joint, UV, pivot, deformation weight.
export class Geometry {
  constructor() { this.vertices = []; this.indices = []; }
  vertex(p, n, c, joint = 0, uv = [0, 0], pivot = [0, 0, 0], weight = 0) { const i = this.vertices.length / 16; this.vertices.push(...p, ...n, ...c, joint, ...uv, ...pivot, weight); return i; }
  tri(a, b, c) { this.indices.push(a, b, c); }
  quad(a, b, c, d) { this.indices.push(a, b, c, a, c, d); }
  mesh(mesh, color, joint = 0) {
    const built = mesh.build(), f = new Float32Array(built.vb), s = new Int8Array(built.vb), base = this.vertices.length / 16;
    for (let i = 0; i < built.nv; i++) this.vertex([f[i * 4], f[i * 4 + 1], f[i * 4 + 2]], [s[i * 16 + 12] / 127, s[i * 16 + 13] / 127, s[i * 16 + 14] / 127], color, joint);
    for (const i of built.ib) this.indices.push(base + i);
  }
  ellipsoid(p, scale, color, joint = 0, sub = 2) { this.mesh(icosphere(sub, (x, y, z) => [p[0] + x * scale[0], p[1] + y * scale[1], p[2] + z * scale[2]]), color, joint); }
  tube(pts, radius, color, joint = 0, sides = 8) { const m = new Mesh(); m.tube(pts, radius, sides); this.mesh(m, color, joint); }
  box(p, size, color) { const [x, y, z] = p, [w, h, d] = size, m = new Mesh(); m.sweep([[x, y - h / 2, z], [x, y + h / 2, z]], w, d, () => [0, 0, 1]); this.mesh(m, color); }
  finish() { return { vertices: new Float32Array(this.vertices), indices: new Uint32Array(this.indices) }; }
}
