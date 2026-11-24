import stegosaurus from '../assets/stegosaurus.bin';
import brachiosaurus from '../assets/brachiosaurus.bin';
import allosaurus from '../assets/allosaurus.bin';
import ceratosaurus from '../assets/ceratosaurus.bin';
import diplodocus from '../assets/diplodocus.bin';
import cryptoclidus from '../assets/cryptoclidus.bin';
import stegoColor from '../assets/stegosaurus-color.jpg';
import stegoNormal from '../assets/stegosaurus-normal.jpg';
import stegoOrm from '../assets/stegosaurus-orm.jpg';
import brachioColor from '../assets/brachiosaurus-color.jpg';
import brachioNormal from '../assets/brachiosaurus-normal.jpg';
import brachioOrm from '../assets/brachiosaurus-orm.jpg';

export function unpackMesh(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x3252554a || view.getUint32(12, true) !== 64) throw new Error('Unsupported animal mesh.');
  const vertices = view.getUint32(4, true), indices = view.getUint32(8, true), end = 16 + vertices * 64;
  if (end + indices * 4 !== bytes.byteLength) throw new Error('Truncated animal mesh.');
  // Copy into aligned buffers; the bundler need not align its decoded Uint8Array backing store.
  return { vertices: new Float32Array(bytes.slice(16, end).buffer), indices: new Uint32Array(bytes.slice(end).buffer) };
}
export const detailedAnimals = () => ({ stego: unpackMesh(stegosaurus), brachio: unpackMesh(brachiosaurus), allo: unpackMesh(allosaurus), cerato: unpackMesh(ceratosaurus), diplo: unpackMesh(diplodocus), crypto: unpackMesh(cryptoclidus) });
export const animalTextures = [null, [stegoColor, stegoNormal, stegoOrm], [brachioColor, brachioNormal, brachioOrm]];
