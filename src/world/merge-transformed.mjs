import { BufferGeometry, BufferAttribute, Matrix3, Vector3 } from 'three';

// Write each source directly into its final batch. No transformed geometry
// clones or temporary JavaScript index arrays are needed.
export function mergeTransformed(parts) {
  if (!parts.length) return null;
  const first = parts[0].geometry;
  const names = Object.keys(first.attributes);
  let vertices = 0,
    indices = 0;
  for (const { geometry } of parts) {
    if (
      Boolean(geometry.index) !== Boolean(first.index) ||
      Object.keys(geometry.attributes).length !== names.length
    )
      throw new Error('Incompatible geometry in architecture batch');
    for (const name of names) {
      const a = geometry.attributes[name],
        b = first.attributes[name];
      if (
        !a ||
        a.isInterleavedBufferAttribute ||
        a.itemSize !== b.itemSize ||
        a.normalized !== b.normalized ||
        a.array.constructor !== b.array.constructor
      )
        throw new Error('Incompatible attribute in architecture batch');
    }
    vertices += geometry.attributes.position.count;
    indices += geometry.index?.count || 0;
  }
  const result = new BufferGeometry();
  for (const name of names) {
    const attribute = first.attributes[name];
    result.setAttribute(
      name,
      new BufferAttribute(
        new attribute.array.constructor(vertices * attribute.itemSize),
        attribute.itemSize,
        attribute.normalized,
      ),
    );
  }
  if (first.index)
    result.setIndex(
      new BufferAttribute(
        vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices),
        1,
      ),
    );
  let vertexOffset = 0,
    indexOffset = 0;
  const vector = new Vector3(),
    normalMatrix = new Matrix3();
  for (const { geometry, matrix } of parts) {
    for (const name of names) {
      const source = geometry.attributes[name],
        target = result.attributes[name];
      target.array.set(source.array, vertexOffset * source.itemSize);
    }
    if (matrix) normalMatrix.getNormalMatrix(matrix);
    for (const name of matrix ? ['position', 'normal', 'tangent'] : []) {
      const source = geometry.attributes[name],
        target = result.attributes[name];
      if (!source) continue;
      for (let i = 0; i < source.count; i++) {
        vector.fromBufferAttribute(source, i);
        if (name === 'position') vector.applyMatrix4(matrix);
        else if (name === 'normal') vector.applyNormalMatrix(normalMatrix);
        else vector.transformDirection(matrix);
        target.setXYZ(vertexOffset + i, vector.x, vector.y, vector.z);
      }
    }
    if (geometry.index)
      for (let i = 0; i < geometry.index.count; i++)
        result.index.setX(indexOffset++, geometry.index.getX(i) + vertexOffset);
    vertexOffset += geometry.attributes.position.count;
  }
  return result;
}
