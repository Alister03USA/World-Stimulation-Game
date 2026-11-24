// Convert the two CC0 Grab3D source GLBs into compact, locally bundled game assets.
// Usage: node source/tools/prepare-assets.mjs <directory containing the original GLBs>
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), input = process.argv[2];
if (!input) throw new Error('Provide the directory containing stegosaurus.glb and brachiosaurus.glb.');
const out = path.join(root, 'assets'); await mkdir(out, { recursive: true }); await MeshoptSimplifier.ready;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const manifest = [];
for (const [name, target] of [['stegosaurus', 24000], ['brachiosaurus', 20000]]) {
  const file = await readFile(path.join(input, name + '.glb'));
  if (file.readUInt32LE(0) !== 0x46546c67 || file.readUInt32LE(4) !== 2) throw new Error('Expected a glTF 2 GLB.');
  const jsonBytes = file.readUInt32LE(12), gltf = JSON.parse(file.toString('utf8', 20, 20 + jsonBytes)), bin = file.subarray(28 + jsonBytes);
  if (gltf.nodes.length !== 1 || gltf.meshes[0].primitives.length !== 1 || gltf.nodes[0].matrix || gltf.nodes[0].rotation || gltf.nodes[0].scale) throw new Error('Asset requires transform baking before conversion.');
  const primitive = gltf.meshes[0].primitives[0];
  function accessor(id) {
    const a = gltf.accessors[id], b = gltf.bufferViews[a.bufferView], n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const size = a.componentType === 5126 || a.componentType === 5125 ? 4 : 2, stride = b.byteStride || n * size, offset = (b.byteOffset || 0) + (a.byteOffset || 0);
    const data = a.componentType === 5126 ? new Float32Array(a.count * n) : new Uint32Array(a.count * n);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) data[i * n + k] = a.componentType === 5126 ? bin.readFloatLE(offset + i * stride + k * size) : size === 4 ? bin.readUInt32LE(offset + i * stride + k * size) : bin.readUInt16LE(offset + i * stride + k * size);
    return data;
  }
  const positions = accessor(primitive.attributes.POSITION), normals = accessor(primitive.attributes.NORMAL), uv = accessor(primitive.attributes.TEXCOORD_0), indices = accessor(primitive.indices);
  const attributes = new Float32Array(positions.length / 3 * 5);
  for (let i = 0; i < positions.length / 3; i++) attributes.set([...normals.subarray(i * 3, i * 3 + 3), ...uv.subarray(i * 2, i * 2 + 2)], i * 5);
  const [simple, error] = MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3, attributes, 5, [.3, .3, .3, 1, 1], null, target * 3, .008, ['Prune']);
  const min = gltf.accessors[primitive.attributes.POSITION].min, max = gltf.accessors[primitive.attributes.POSITION].max, height = max[1] - min[1], length = max[2] - min[2], width = max[0] - min[0];
  // The source sauropod's raised head identifies its forward direction. The stegosaur's narrow tail is +Z.
  let headZ = 0, headN = 0;
  for (let i = 0; i < positions.length; i += 3) if (positions[i + 1] > height * .88) { headZ += positions[i + 2]; headN++; }
  const flip = name === 'brachiosaurus' && headZ / headN > 0;
  const feet = [];
  for (const side of [-1, 1]) for (const end of [-1, 1]) {
    let x = 0, z = 0, n = 0;
    for (let i = 0; i < positions.length; i += 3) {
      const px = positions[i] * (flip ? -1 : 1), pz = positions[i + 2] * (flip ? -1 : 1);
      if (positions[i + 1] < height * .12 && Math.sign(px) === side && Math.sign(pz) === end) { x += px; z += pz; n++; }
    }
    feet.push([n ? x / n : side * width * .28, height * (name === 'brachiosaurus' ? .36 : .42), n ? z / n : end * length * .2]);
  }
  const remap = new Map(), verts = [], packedIndices = new Uint32Array(simple.length);
  for (let k = 0; k < simple.length; k++) {
    const old = simple[k]; let next = remap.get(old);
    if (next === undefined) {
      next = remap.size; remap.set(old, next);
      const sign = flip ? -1 : 1, x = positions[old * 3] * sign, y = positions[old * 3 + 1] - min[1], z = positions[old * 3 + 2] * sign;
      let joint = 0, weight = 0, pivot = [0, 0, 0], nearest = Infinity;
      for (let i = 0; i < feet.length; i++) {
        const foot = feet[i], distance = Math.hypot((x - foot[0]) * 1.4, (z - foot[2]) * .75);
        if (distance < nearest && y < foot[1] && Math.abs(x) > width * .12) { nearest = distance; pivot = foot; joint = 10 + i; weight = 1 - smooth(foot[1] * .65, foot[1], y); }
      }
      if (!weight && z > length * .2 && y < height * .7) { joint = 14; pivot = [0, height * .40, length * .18]; weight = smooth(length * .20, length * .38, z); }
      if (!weight && name === 'brachiosaurus' && y > height * .45) { joint = 15; pivot = [0, height * .4, -length * .20]; weight = smooth(height * .45, height * .66, y) * .7; }
      verts.push(x, y, z, normals[old * 3] * sign, normals[old * 3 + 1], normals[old * 3 + 2] * sign, 1, 1, 1, joint, uv[old * 2], uv[old * 2 + 1], ...pivot, weight);
    }
    packedIndices[k] = next;
  }
  const vertices = new Float32Array(verts), header = Buffer.alloc(16); header.write('JUR2'); header.writeUInt32LE(vertices.length / 16, 4); header.writeUInt32LE(packedIndices.length, 8); header.writeUInt32LE(64, 12);
  const mesh = Buffer.concat([header, Buffer.from(vertices.buffer), Buffer.from(packedIndices.buffer)]); await writeFile(path.join(out, name + '.bin'), mesh);
  const material = gltf.materials[primitive.material], textures = { color: material.pbrMetallicRoughness.baseColorTexture.index, normal: material.normalTexture.index, orm: material.pbrMetallicRoughness.metallicRoughnessTexture.index };
  for (const [kind, id] of Object.entries(textures)) {
    const image = gltf.images[gltf.textures[id].source], view = gltf.bufferViews[image.bufferView], bytes = bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    await sharp(bytes).resize(1024, 1024, { fit: 'fill' }).jpeg({ quality: kind === 'color' ? 88 : 93, chromaSubsampling: '4:4:4' }).toFile(path.join(out, `${name}-${kind}.jpg`));
  }
  const record = { name, source: `https://grab3d.com/models/creatures/${name}/`, download: `https://grab3d.com/dl/${name}/${name}.glb`, author: 'Grab3D', license: 'CC0-1.0', licenseUrl: 'https://grab3d.com/license/', sourceSha256: createHash('sha256').update(file).digest('hex'), originalTriangles: indices.length / 3, triangles: simple.length / 3, vertices: vertices.length / 16, relativeSimplificationError: error, size: { width, height, length }, forwardFlipped: flip, feet, modification: 'Mesh simplification; 1K texture resizing; forward alignment; procedural deformation weights. Source is a static model, not a skeletal rig.' };
  manifest.push(record); console.log(JSON.stringify(record));
}
await writeFile(path.join(out, 'manifest.json'), JSON.stringify({ assets: manifest }, null, 2) + '\n');
