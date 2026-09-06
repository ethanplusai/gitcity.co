import { BoxGeometry, BufferGeometry, BufferAttribute } from 'three';

// Keep BoxGeometry's face normals and UV seams, but write repeated boxes
// directly into a single buffer instead of allocating a geometry per object.
const template = new BoxGeometry(1, 1, 1);
const positions = template.attributes.position.array;
const normals = template.attributes.normal.array;
const uvs = template.attributes.uv.array;
const indices = template.index.array;
template.dispose();

export class BoxBatch {
  constructor() {
    this.count = 0;
    this.capacity = 0;
  }
  add(w, h, d, x, y, z, rotation = 0, uvMode = 0, roomX = 0, roomY = 0) {
    if (this.count === this.capacity) {
      this.capacity = Math.max(32, this.capacity * 2);
      for (const [name, stride, Type] of [
        ['position', 72, Float32Array],
        ['normal', 72, Float32Array],
        ['uv', 48, Float32Array],
        ['index', 36, Uint32Array],
      ]) {
        const next = new Type(this.capacity * stride);
        if (this[name]) next.set(this[name]);
        this[name] = next;
      }
    }
    const c = Math.cos(rotation),
      s = Math.sin(rotation);
    const offset = this.count * 72;
    for (let i = 0; i < 72; i += 3) {
      const px = uvMode ? Math.fround(positions[i] * w) : positions[i] * w,
        pz = uvMode ? Math.fround(positions[i + 2] * d) : positions[i + 2] * d;
      this.position[offset + i] = c * px + s * pz + x;
      this.position[offset + i + 1] =
        (uvMode ? Math.fround(positions[i + 1] * h) : positions[i + 1] * h) + y;
      this.position[offset + i + 2] = -s * px + c * pz + z;
      this.normal[offset + i] = c * normals[i] + s * normals[i + 2];
      this.normal[offset + i + 1] = normals[i + 1];
      this.normal[offset + i + 2] = -s * normals[i] + c * normals[i + 2];
    }
    this.uv.set(uvs, this.count * 48);
    if (uvMode)
      for (let i = 0; i < 24; i++) {
        const p = offset + i * 3,
          uv = this.count * 48 + i * 2;
        this.uv[uv] =
          uvMode === 1
            ? this.position[p + (Math.abs(this.normal[p]) > 0.5 ? 2 : 0)] * 3.9
            : uvs[i * 2] + roomX;
        this.uv[uv + 1] =
          uvMode === 1
            ? this.position[p + (Math.abs(this.normal[p + 1]) > 0.5 ? 2 : 1)] * 3.9
            : uvs[i * 2 + 1] + roomY;
      }
    for (let i = 0; i < 36; i++) this.index[this.count * 36 + i] = indices[i] + this.count * 24;
    this.count++;
  }
  geometry() {
    if (!this.count) return null;
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute(this.position.slice(0, this.count * 72), 3),
    );
    geometry.setAttribute('normal', new BufferAttribute(this.normal.slice(0, this.count * 72), 3));
    geometry.setAttribute('uv', new BufferAttribute(this.uv.slice(0, this.count * 48), 2));
    geometry.setIndex(new BufferAttribute(this.index.slice(0, this.count * 36), 1));
    return geometry;
  }
}
