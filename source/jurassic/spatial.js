// Keep large forests inexpensive to query; plain arrays remain supported by simulation fixtures.
export function indexColliders(colliders, size = 24) {
  const cells = new Map(); let largest = 0;
  for (const c of colliders) {
    largest = Math.max(largest, c.radius); const key = `${Math.floor(c.x / size)},${Math.floor(c.z / size)}`;
    if (!cells.has(key)) cells.set(key, []); cells.get(key).push(c);
  }
  Object.defineProperty(colliders, 'near', { value(x, z, radius) {
    const found = [], r = radius + largest;
    for (let iz = Math.floor((z - r) / size); iz <= Math.floor((z + r) / size); iz++) for (let ix = Math.floor((x - r) / size); ix <= Math.floor((x + r) / size); ix++) {
      for (const c of cells.get(`${ix},${iz}`) || []) if (Math.hypot(c.x - x, c.z - z) <= radius + c.radius) found.push(c);
    }
    return found;
  } });
  return colliders;
}
export const nearby = (colliders, x, z, radius) => colliders.near ? colliders.near(x, z, radius) : colliders;
export const overlapsHeight = (collider, bottom, top) => (collider.top ?? Infinity) >= bottom && (collider.bottom ?? -Infinity) <= top;
